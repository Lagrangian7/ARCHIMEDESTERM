import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { messageSchema, type Message, insertUserPreferencesSchema, insertDocumentSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { llmService } from "./llm-service";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { weatherService } from "./weather-service";
import { knowledgeService } from "./knowledge-service";
import { BbsService } from "./bbs-service";
import { TelnetProxyService } from "./telnet-proxy";
import { gutendxService } from "./gutendx-service";
import { marketstackService } from "./marketstack-service";
import { radioGardenService } from "./radio-garden-service";
import multer from "multer";
import { z } from "zod";
import WebSocket, { WebSocketServer } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as dns } from 'dns';

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Setup authentication middleware
  await setupAuth(app);

  // Initialize services
  const bbsService = new BbsService();
  
  // Initialize starter data
  await bbsService.initializeStarterData();
  await bbsService.initializeVirtualSystems();

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated?.() || !req.user?.claims?.sub) {
        return res.json({ 
          user: null,
          preferences: null
        });
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const preferences = await storage.getUserPreferences(userId);
      
      res.json({ 
        user: user || null,
        preferences: preferences || null
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      // Return null instead of error to prevent auth loops
      res.json({ 
        user: null,
        preferences: null
      });
    }
  });
  
  // User preferences routes
  app.get("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);
      
      if (!preferences) {
        // Create default preferences if they don't exist
        const defaultPrefs = await storage.createUserPreferences({
          userId,
          defaultMode: "natural",
          voiceEnabled: false,
          selectedVoice: "default",
          voiceRate: "1",
          terminalTheme: "classic"
        });
        return res.json(defaultPrefs);
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Get user preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = insertUserPreferencesSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid preferences data",
          details: validationResult.error.errors
        });
      }
      
      const updatedPreferences = await storage.updateUserPreferences(userId, validationResult.data);
      res.json(updatedPreferences);
    } catch (error) {
      console.error("Update user preferences error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User conversation history routes
  app.get("/api/user/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Get user conversations error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Chat endpoint (enhanced with user support)
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, mode = "natural", sessionId } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const validModes = ["natural", "technical"];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ error: "Invalid mode" });
      }

      const currentSessionId = sessionId || randomUUID();
      
      // Check if user is authenticated to link conversation
      let userId = null;
      const user = req.user as any;
      if (req.isAuthenticated?.() && user?.claims?.sub) {
        userId = user.claims.sub;
      }
      
      // Add user message to conversation
      const userMessage = {
        role: "user" as const,
        content: message,
        timestamp: new Date().toISOString(),
        mode: mode as "natural" | "technical",
      };
      
      await storage.addMessageToConversation(currentSessionId, userMessage);
      
      // Link conversation to user if authenticated
      if (userId) {
        const conversation = await storage.getConversation(currentSessionId);
        if (conversation && !conversation.userId) {
          // Update the conversation to link it to the user and persist in storage
          await storage.updateConversationUserId(currentSessionId, userId);
        }
      }
      
      // Get conversation history for context
      const conversation = await storage.getConversation(currentSessionId);
      const conversationHistory = Array.isArray(conversation?.messages) ? conversation.messages as Message[] : [];
      
      // Generate AI response using LLM with knowledge base integration
      const responseContent = await llmService.generateResponse(message, mode as "natural" | "technical", conversationHistory, userId);
      
      const assistantMessage = {
        role: "assistant" as const,
        content: responseContent,
        timestamp: new Date().toISOString(),
        mode: mode as "natural" | "technical",
      };
      
      await storage.addMessageToConversation(currentSessionId, assistantMessage);
      
      res.json({
        response: responseContent,
        sessionId: currentSessionId,
        mode,
      });
      
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get conversation history
  app.get("/api/conversation/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const conversation = await storage.getConversation(sessionId);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      res.json(conversation);
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Configure multer for file uploads (in-memory storage)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Only allow text files
      const allowedTypes = [
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/json',
        'text/html',
        'text/xml',
      ];
      
      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|md|json|csv|html|xml)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Only text files are allowed'));
      }
    }
  });

  // Document upload endpoint
  app.post("/api/documents/upload", isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Convert buffer to string
      const content = req.file.buffer.toString('utf8');
      
      if (content.length === 0) {
        return res.status(400).json({ error: "File is empty" });
      }

      if (content.length > 1000000) { // 1MB text limit
        return res.status(400).json({ error: "File content is too large (max 1MB)" });
      }

      // Process the document
      const document = await knowledgeService.processDocument(content, {
        userId,
        fileName: `${randomUUID()}-${req.file.originalname}`,
        originalName: req.file.originalname,
        fileSize: req.file.size.toString(),
        mimeType: req.file.mimetype,
      });

      res.json({ 
        message: "Document uploaded successfully",
        document: {
          id: document.id,
          originalName: document.originalName,
          fileSize: document.fileSize,
          summary: document.summary,
          keywords: document.keywords,
          uploadedAt: document.uploadedAt,
        }
      });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Get user documents
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documents = await storage.getUserDocuments(userId);
      
      // Return limited info for list view
      const documentsInfo = documents.map(doc => ({
        id: doc.id,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        summary: doc.summary,
        keywords: doc.keywords,
        uploadedAt: doc.uploadedAt,
        lastAccessedAt: doc.lastAccessedAt,
      }));

      res.json(documentsInfo);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get single document with full content
  app.get("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;
      
      const document = await storage.getDocument(documentId);
      if (!document || document.userId !== userId) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = req.params.id;
      
      const success = await knowledgeService.deleteDocument(documentId, userId);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Search documents and knowledge
  app.get("/api/knowledge/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const results = await knowledgeService.searchKnowledge(userId, query);
      res.json(results);
    } catch (error) {
      console.error("Knowledge search error:", error);
      res.status(500).json({ error: "Failed to search knowledge base" });
    }
  });

  // Get user document statistics
  app.get("/api/knowledge/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await knowledgeService.getUserDocumentStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Knowledge stats error:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base statistics" });
    }
  });

  // Weather API endpoint
  app.get("/api/weather", async (req, res) => {
    try {
      const location = req.query.location as string;
      let weather;
      
      if (req.query.lat && req.query.lon) {
        const lat = parseFloat(req.query.lat as string);
        const lon = parseFloat(req.query.lon as string);
        
        if (isNaN(lat) || isNaN(lon)) {
          return res.status(400).json({ error: "Invalid latitude or longitude" });
        }
        
        weather = await weatherService.getWeatherByCoordinates(lat, lon);
      } else {
        weather = await weatherService.getCurrentWeather(location);
      }
      
      const formattedWeather = weatherService.formatCurrentWeather(weather);
      
      res.json({
        weather,
        formatted: formattedWeather
      });
    } catch (error) {
      console.error("Weather error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch weather data";
      res.status(500).json({ error: message });
    }
  });

  // Gutendx (Project Gutenberg) API endpoints
  app.get("/api/books/search", async (req, res) => {
    try {
      const {
        search,
        languages,
        author_year_start,
        author_year_end,
        copyright,
        topic,
        sort,
        page
      } = req.query;

      const params: any = {};
      
      if (search) params.search = search as string;
      if (languages) {
        // Handle comma-separated languages
        params.languages = (languages as string).split(',').map(l => l.trim());
      }
      if (author_year_start) params.author_year_start = parseInt(author_year_start as string);
      if (author_year_end) params.author_year_end = parseInt(author_year_end as string);
      if (copyright !== undefined) params.copyright = copyright === 'true';
      if (topic) params.topic = topic as string;
      if (sort) params.sort = sort as 'popular' | 'ascending' | 'descending';
      if (page) params.page = parseInt(page as string);

      const response = await gutendxService.searchBooks(params);
      const formatted = gutendxService.formatSearchResults(response, search as string);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Book search error:", error);
      const message = error instanceof Error ? error.message : "Failed to search books";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const response = await gutendxService.getPopularBooks(limit);
      const formatted = gutendxService.formatSearchResults(response);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Popular books error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch popular books";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/:id", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      
      if (isNaN(bookId)) {
        return res.status(400).json({ error: "Invalid book ID" });
      }

      const book = await gutendxService.getBook(bookId);
      const formatted = gutendxService.formatBookForTerminal(book);

      res.json({
        book,
        formatted
      });
    } catch (error) {
      console.error("Get book error:", error);
      const message = error instanceof Error ? error.message : "Failed to get book details";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/author/:name", async (req, res) => {
    try {
      const authorName = req.params.name;
      const response = await gutendxService.getBooksByAuthor(authorName);
      const formatted = gutendxService.formatSearchResults(response, `author: ${authorName}`);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Books by author error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch books by author";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/books/topic/:topic", async (req, res) => {
    try {
      const topic = req.params.topic;
      const response = await gutendxService.getBooksByTopic(topic);
      const formatted = gutendxService.formatSearchResults(response, `topic: ${topic}`);

      res.json({
        results: response,
        formatted
      });
    } catch (error) {
      console.error("Books by topic error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch books by topic";
      res.status(500).json({ error: message });
    }
  });

  // Marketstack (Stock Market Data) API endpoints
  app.get("/api/stocks/quote/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const quote = await marketstackService.getLatestQuote(symbol);
      
      if (!quote) {
        return res.status(404).json({ error: `No data found for symbol ${symbol}` });
      }

      const formatted = marketstackService.formatQuoteForTerminal(quote);

      res.json({
        quote,
        formatted
      });
    } catch (error) {
      console.error("Stock quote error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock quote";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/stocks/quotes", async (req, res) => {
    try {
      const { symbols } = req.body;
      
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: "Symbols array is required" });
      }

      if (symbols.length > 10) {
        return res.status(400).json({ error: "Maximum 10 symbols allowed per request" });
      }

      const quotes = await marketstackService.getMultipleQuotes(symbols);
      const formatted = marketstackService.formatMultipleQuotesForTerminal(quotes);

      res.json({
        quotes,
        formatted
      });
    } catch (error) {
      console.error("Multiple quotes error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock quotes";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/stocks/info/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const info = await marketstackService.getTickerInfo(symbol);
      
      if (!info) {
        return res.status(404).json({ error: `No company information found for symbol ${symbol}` });
      }

      const formatted = marketstackService.formatTickerInfoForTerminal(info);

      res.json({
        info,
        formatted
      });
    } catch (error) {
      console.error("Stock info error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch stock information";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/stocks/historical/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const { days = '30', date_from, date_to } = req.query;
      
      let dateFrom = date_from as string;
      let dateTo = date_to as string;
      
      // If no specific dates provided, use the days parameter
      if (!dateFrom && !dateTo) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(days as string));
        
        dateFrom = startDate.toISOString().split('T')[0];
        dateTo = endDate.toISOString().split('T')[0];
      }

      const response = await marketstackService.getEODData({
        symbols: [symbol],
        dateFrom,
        dateTo,
        limit: 100,
        sort: 'desc'
      });

      const formatted = marketstackService.formatHistoricalDataForTerminal(response.data, symbol);

      res.json({
        data: response.data,
        formatted
      });
    } catch (error) {
      console.error("Historical data error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch historical data";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/stocks/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const tickers = await marketstackService.searchTickers(query, limit);
      
      if (tickers.length === 0) {
        return res.json({
          tickers: [],
          formatted: `No stocks found matching "${query}". Try different keywords or check the symbol.`
        });
      }

      const formatted = `Stock Search Results for "${query}":\n\n` +
        tickers.map((ticker, index) => 
          `${index + 1}. ${ticker.symbol} - ${ticker.name}\n   Exchange: ${ticker.stock_exchange.name} (${ticker.country})`
        ).join('\n\n') +
        `\n\nUse 'stock quote <symbol>' to get current prices.`;

      res.json({
        tickers,
        formatted
      });
    } catch (error) {
      console.error("Stock search error:", error);
      const message = error instanceof Error ? error.message : "Failed to search stocks";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/stocks/intraday/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const { interval = '1min', limit = '50' } = req.query;

      const response = await marketstackService.getIntradayData({
        symbols: [symbol],
        interval: interval as any,
        limit: parseInt(limit as string)
      });

      const formatted = `Intraday Data: ${symbol} (${interval} intervals, last ${response.data.length} points)\n\n` +
        response.data.map(point => {
          const time = new Date(point.date).toLocaleTimeString();
          const change = point.close - point.open;
          const changePercent = ((change / point.open) * 100).toFixed(2);
          return `${time} | $${point.close.toFixed(2)} (${change >= 0 ? '+' : ''}${changePercent}%) Vol: ${point.volume.toLocaleString()}`;
        }).join('\n');

      res.json({
        data: response.data,
        formatted
      });
    } catch (error) {
      console.error("Intraday data error:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch intraday data (may require higher plan)";
      res.status(500).json({ error: message });
    }
  });

  // BBS Directory API endpoints
  app.get("/api/bbs/systems", async (req, res) => {
    try {
      const category = req.query.category as string;
      const search = req.query.search as string;
      
      let systems;
      if (search) {
        systems = await bbsService.searchBbsSystems(search);
      } else if (category) {
        systems = await bbsService.getBbsByCategory(category);
      } else {
        systems = await bbsService.getAllBbsSystems();
      }
      
      res.json(systems);
    } catch (error) {
      console.error("BBS systems error:", error);
      res.status(500).json({ error: "Failed to fetch BBS systems" });
    }
  });

  app.get("/api/bbs/popular", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const systems = await bbsService.getPopularBbsSystems(limit);
      res.json(systems);
    } catch (error) {
      console.error("Popular BBS error:", error);
      res.status(500).json({ error: "Failed to fetch popular BBS systems" });
    }
  });

  app.get("/api/bbs/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await bbsService.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("BBS favorites error:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  app.post("/api/bbs/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { bbsId, nickname } = req.body;
      
      if (!bbsId) {
        return res.status(400).json({ error: "BBS ID is required" });
      }
      
      await bbsService.addToFavorites(userId, bbsId, nickname);
      res.json({ success: true });
    } catch (error) {
      console.error("Add favorite error:", error);
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  app.get("/api/bbs/virtual-systems", async (req, res) => {
    try {
      const systems = await bbsService.getVirtualSystems();
      res.json(systems);
    } catch (error) {
      console.error("Virtual systems error:", error);
      res.status(500).json({ error: "Failed to fetch virtual systems" });
    }
  });

  // Radio Garden API endpoints
  app.get('/api/radio/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }
      
      const stations = await radioGardenService.search(query, limit);
      res.json(stations);
    } catch (error) {
      console.error('Radio Garden search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  app.get('/api/radio/popular', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const stations = await radioGardenService.getPopularStations(limit);
      res.json(stations);
    } catch (error) {
      console.error('Radio Garden popular stations error:', error);
      res.status(500).json({ error: 'Failed to get popular stations' });
    }
  });

  app.get('/api/radio/countries', async (req, res) => {
    try {
      const countries = await radioGardenService.getCountries();
      res.json(countries);
    } catch (error) {
      console.error('Radio Garden countries error:', error);
      res.status(500).json({ error: 'Failed to get countries' });
    }
  });

  app.get('/api/radio/channel/:channelId', async (req, res) => {
    try {
      const channelId = req.params.channelId;
      const channel = await radioGardenService.getChannelDetails(channelId);
      
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      
      res.json(channel);
    } catch (error) {
      console.error('Radio Garden channel error:', error);
      res.status(500).json({ error: 'Failed to get channel details' });
    }
  });

  app.get('/api/radio/random', async (req, res) => {
    try {
      const station = await radioGardenService.getRandomStation();
      
      if (!station) {
        return res.status(404).json({ error: 'No stations available' });
      }
      
      res.json(station);
    } catch (error) {
      console.error('Radio Garden random station error:', error);
      res.status(500).json({ error: 'Failed to get random station' });
    }
  });

  // OSINT API routes
  app.get('/api/osint/whois/:domain', async (req, res) => {
    try {
      const { domain } = req.params;
      
      // Basic domain validation
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      // Use system whois command via child_process
      const execAsync = promisify(exec);
      
      try {
        const { stdout, stderr } = await execAsync(`whois ${domain}`, { 
          timeout: 10000, // 10 second timeout
          encoding: 'utf8'
        });
        
        if (stderr && !stdout) {
          throw new Error(`WHOIS command failed: ${stderr}`);
        }
        
        // Parse the whois output for key information
        const whoisData = stdout || '';
        
        // Extract key fields from whois output
        const extractField = (pattern: string) => {
          const match = whoisData.match(new RegExp(pattern, 'i'));
          return match ? match[1].trim() : 'N/A';
        };
        
        const registrar = extractField('(?:Registrar|Sponsoring Registrar):\\s*(.+)') || 
                         extractField('registrar:\\s*(.+)');
        const created = extractField('(?:Creation Date|Created On|Registered):\\s*(.+)') || 
                       extractField('created:\\s*(.+)');
        const updated = extractField('(?:Updated Date|Last Modified|Modified):\\s*(.+)') || 
                       extractField('changed:\\s*(.+)');
        const expires = extractField('(?:Expiry Date|Registry Expiry Date|Expires):\\s*(.+)') || 
                       extractField('expire:\\s*(.+)');
        const status = extractField('(?:Domain Status|Status):\\s*(.+)') || 
                      extractField('status:\\s*(.+)');
        
        // Extract name servers
        const nsMatches = whoisData.match(/(?:Name Server|nserver):\s*(.+)/gi);
        const nameServers = nsMatches ? 
          nsMatches.map((ns: string) => ns.replace(/(?:Name Server|nserver):\s*/i, '').trim()).slice(0, 4).join(', ') : 
          'N/A';
        
        const formatted = `╭─ WHOIS Information for ${domain}
├─ Domain: ${domain}
├─ Registrar: ${registrar}
├─ Creation Date: ${created}
├─ Updated Date: ${updated}
├─ Expiry Date: ${expires}
├─ Status: ${status}
├─ Name Servers: ${nameServers}
╰─ Query completed using system whois`;
        
        res.json({ formatted });
        
      } catch (execError: any) {
        // If whois command fails, try with alternative approach
        if (execError.code === 'ENOENT' || execError.message.includes('whois: not found')) {
          // whois command not available, use enhanced DNS approach with WHOIS API fallback
          try {
            // Try using free WHOIS API service
            const whoisResponse = await fetch(`https://api.whois.vu/?q=${domain}`, {
              headers: { 'User-Agent': 'ARCHIMEDES-OSINT/1.0' }
            });
            
            if (whoisResponse.ok) {
              const whoisData = await whoisResponse.json();
              
              let formatted = `╭─ WHOIS Information for ${domain}\n`;
              
              if (whoisData.domain) {
                formatted += `├─ Domain: ${whoisData.domain}\n`;
              }
              
              if (whoisData.registrar) {
                formatted += `├─ Registrar: ${whoisData.registrar}\n`;
              }
              
              if (whoisData.registered) {
                formatted += `├─ Registration Date: ${whoisData.registered}\n`;
              }
              
              if (whoisData.expires) {
                formatted += `├─ Expiration Date: ${whoisData.expires}\n`;
              }
              
              if (whoisData.updated) {
                formatted += `├─ Last Updated: ${whoisData.updated}\n`;
              }
              
              if (whoisData.nameservers && whoisData.nameservers.length > 0) {
                formatted += `├─ Name Servers: ${whoisData.nameservers.join(', ')}\n`;
              }
              
              if (whoisData.status && whoisData.status.length > 0) {
                formatted += `├─ Domain Status: ${whoisData.status.join(', ')}\n`;
              }
              
              // Add IP addresses from DNS lookup
              try {
                const addresses = await dns.resolve4(domain);
                formatted += `├─ IPv4 Addresses: ${addresses.join(', ')}\n`;
              } catch (e) {}
              
              formatted += `╰─ WHOIS lookup complete`;
              res.json({ formatted });
              return;
            }
          } catch (whoisApiError) {
            console.log('WHOIS API failed, falling back to enhanced DNS lookup');
          }
          
          // Enhanced DNS fallback with comprehensive information
          try {
            let formatted = `╭─ Enhanced Domain Information for ${domain}\n`;
            
            // Get A records
            try {
              const addresses = await dns.resolve4(domain);
              formatted += `├─ IPv4 Addresses: ${addresses.join(', ')}\n`;
            } catch (e) {}
            
            // Get AAAA records
            try {
              const ipv6Addresses = await dns.resolve6(domain);
              formatted += `├─ IPv6 Addresses: ${ipv6Addresses.join(', ')}\n`;
            } catch (e) {}
            
            // Get MX records
            try {
              const mxRecords = await dns.resolveMx(domain);
              const mxList = mxRecords.map(mx => `${mx.exchange} (${mx.priority})`).join(', ');
              formatted += `├─ Mail Servers: ${mxList}\n`;
            } catch (e) {}
            
            // Get NS records
            try {
              const nsRecords = await dns.resolveNs(domain);
              formatted += `├─ Name Servers: ${nsRecords.join(', ')}\n`;
            } catch (e) {}
            
            // Get TXT records (may contain SPF, DMARC, verification records)
            try {
              const txtRecords = await dns.resolveTxt(domain);
              const txtList = txtRecords.map(record => record.join('')).slice(0, 3); // Limit to 3 records
              if (txtList.length > 0) {
                formatted += `├─ TXT Records: ${txtList.join(' | ')}\n`;
              }
            } catch (e) {}
            
            formatted += `├─ Status: Enhanced DNS resolution (WHOIS service unavailable)\n`;
            formatted += `╰─ Domain analysis complete`;
            
            res.json({ formatted });
          } catch (dnsError) {
            res.json({ 
              formatted: `╭─ Domain lookup for ${domain}\n╰─ Domain does not resolve or all services unavailable` 
            });
          }
        } else {
          // Other execution errors
          res.json({ 
            formatted: `╭─ WHOIS lookup for ${domain}\n╰─ Unable to retrieve WHOIS information: ${execError.message || 'Unknown error'}` 
          });
        }
      }
    } catch (error) {
      console.error('WHOIS error:', error);
      res.status(500).json({ error: 'WHOIS lookup failed' });
    }
  });

  app.get('/api/osint/dns/:domain', async (req, res) => {
    try {
      const { domain } = req.params;
      // DNS module imported at top of file
      
      const results: {
        A: string[];
        AAAA: string[];
        MX: Array<{exchange: string, priority: number}>;
        TXT: string[][];
        NS: string[];
        CNAME: string[] | null;
      } = {
        A: [],
        AAAA: [],
        MX: [],
        TXT: [],
        NS: [],
        CNAME: null
      };

      try {
        // Get A records
        try {
          results.A = await dns.resolve4(domain);
        } catch (e) {}

        // Get AAAA records
        try {
          results.AAAA = await dns.resolve6(domain);
        } catch (e) {}

        // Get MX records  
        try {
          results.MX = await dns.resolveMx(domain);
        } catch (e) {}

        // Get TXT records
        try {
          results.TXT = await dns.resolveTxt(domain);
        } catch (e) {}

        // Get NS records
        try {
          results.NS = await dns.resolveNs(domain);
        } catch (e) {}

        // Get CNAME
        try {
          results.CNAME = await dns.resolveCname(domain);
        } catch (e) {}

        let formatted = `╭─ DNS Records for ${domain}\n`;
        
        if (results.A.length) {
          formatted += `├─ A Records: ${results.A.join(', ')}\n`;
        }
        
        if (results.AAAA.length) {
          formatted += `├─ AAAA Records: ${results.AAAA.join(', ')}\n`;
        }
        
        if (results.MX.length) {
          formatted += `├─ MX Records: ${results.MX.map(mx => `${mx.exchange} (${mx.priority})`).join(', ')}\n`;
        }
        
        if (results.NS.length) {
          formatted += `├─ NS Records: ${results.NS.join(', ')}\n`;
        }
        
        if (results.TXT.length) {
          formatted += `├─ TXT Records: ${results.TXT.map(txt => txt.join(' ')).join(', ')}\n`;
        }
        
        if (results.CNAME) {
          formatted += `├─ CNAME: ${results.CNAME.join(', ')}\n`;
        }
        
        formatted += `╰─ DNS lookup complete`;

        res.json({ formatted });
        
      } catch (error) {
        res.json({ formatted: `╭─ DNS lookup for ${domain}\n╰─ No DNS records found or domain does not exist` });
      }
    } catch (error) {
      console.error('DNS error:', error);
      res.status(500).json({ error: 'DNS lookup failed' });
    }
  });

  app.get('/api/osint/geoip/:ip', async (req, res) => {
    try {
      const { ip } = req.params;
      
      // Basic IP validation
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      
      if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address format' });
      }

      try {
        // Use ip-api.com free service
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`);
        const data = await response.json();
        
        if (data.status === 'success') {
          const formatted = `
╭─ IP Geolocation for ${ip}
├─ Country: ${data.country} (${data.countryCode})
├─ Region: ${data.regionName} (${data.region})
├─ City: ${data.city}
├─ Postal Code: ${data.zip || 'N/A'}
├─ Coordinates: ${data.lat}, ${data.lon}
├─ Timezone: ${data.timezone}
├─ ISP: ${data.isp}
├─ Organization: ${data.org}
╰─ AS: ${data.as}`;
          
          res.json({ formatted });
        } else {
          res.json({ formatted: `╭─ IP Geolocation for ${ip}\n╰─ Geolocation data not available for this IP` });
        }
      } catch (apiError) {
        res.json({ formatted: `╭─ IP Geolocation for ${ip}\n╰─ Geolocation service temporarily unavailable` });
      }
    } catch (error) {
      console.error('GeoIP error:', error);
      res.status(500).json({ error: 'IP geolocation failed' });
    }
  });

  app.get('/api/osint/headers', async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter required' });
      }

      // Basic URL validation
      let targetUrl: URL;
      try {
        targetUrl = new URL(url);
        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'ARCHIMEDES-OSINT/1.0'
          }
        });
        
        let formatted = `╭─ HTTP Headers for ${url}\n`;
        formatted += `├─ Status: ${response.status} ${response.statusText}\n`;
        
        response.headers.forEach((value, key) => {
          formatted += `├─ ${key}: ${value}\n`;
        });
        
        formatted += `╰─ Header analysis complete`;

        res.json({ formatted });
        
      } catch (fetchError) {
        res.json({ formatted: `╭─ HTTP Headers for ${url}\n╰─ Unable to fetch headers - site may be unreachable` });
      }
    } catch (error) {
      console.error('Headers error:', error);
      res.status(500).json({ error: 'Header analysis failed' });
    }
  });

  app.get('/api/osint/wayback', async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter required' });
      }

      try {
        // Use Wayback Machine CDX API
        const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=10&sort=timestamp`;
        const response = await fetch(cdxUrl);
        const data = await response.json();
        
        if (data && data.length > 1) {
          let formatted = `╭─ Wayback Machine snapshots for ${url}\n`;
          
          // Skip first row which contains headers
          const snapshots = data.slice(1, 6); // Show max 5 snapshots
          
          snapshots.forEach((snapshot: any, index: number) => {
            const timestamp = snapshot[1];
            const date = `${timestamp.slice(0,4)}-${timestamp.slice(4,6)}-${timestamp.slice(6,8)} ${timestamp.slice(8,10)}:${timestamp.slice(10,12)}`;
            const statusCode = snapshot[4];
            const archiveUrl = `https://web.archive.org/web/${timestamp}/${url}`;
            
            formatted += `├─ ${index + 1}. ${date} (Status: ${statusCode})\n`;
            formatted += `│   ${archiveUrl}\n`;
          });
          
          formatted += `╰─ Found ${data.length - 1} total snapshots`;
          
          res.json({ formatted });
        } else {
          res.json({ formatted: `╭─ Wayback Machine lookup for ${url}\n╰─ No archived snapshots found` });
        }
        
      } catch (apiError) {
        res.json({ formatted: `╭─ Wayback Machine lookup for ${url}\n╰─ Archive service temporarily unavailable` });
      }
    } catch (error) {
      console.error('Wayback error:', error);
      res.status(500).json({ error: 'Wayback lookup failed' });
    }
  });

  app.get('/api/osint/username/:username', async (req, res) => {
    try {
      const { username } = req.params;
      
      // Basic username validation
      const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
      if (!usernameRegex.test(username) || username.length < 1 || username.length > 30) {
        return res.status(400).json({ error: 'Invalid username format' });
      }

      // List of platforms to check
      const platforms = [
        { name: 'GitHub', url: `https://github.com/${username}`, checkType: 'status' },
        { name: 'Twitter', url: `https://twitter.com/${username}`, checkType: 'status' },
        { name: 'Instagram', url: `https://instagram.com/${username}`, checkType: 'status' },
        { name: 'Reddit', url: `https://reddit.com/user/${username}`, checkType: 'status' },
        { name: 'YouTube', url: `https://youtube.com/@${username}`, checkType: 'status' },
        { name: 'Medium', url: `https://medium.com/@${username}`, checkType: 'status' },
        { name: 'LinkedIn', url: `https://linkedin.com/in/${username}`, checkType: 'status' }
      ];

      let formatted = `╭─ Username availability check: ${username}\n`;
      
      const checks = await Promise.allSettled(
        platforms.map(async (platform) => {
          try {
            const response = await fetch(platform.url, { 
              method: 'HEAD',
              redirect: 'follow',
              headers: {
                'User-Agent': 'ARCHIMEDES-OSINT/1.0'
              }
            });
            
            const exists = response.status === 200;
            return { platform: platform.name, exists, status: response.status };
          } catch (error) {
            return { platform: platform.name, exists: false, status: 'error' };
          }
        })
      );
      
      checks.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { platform, exists, status } = result.value;
          const indicator = exists ? '❌' : '✅';
          const statusText = exists ? 'Taken' : 'Available';
          formatted += `├─ ${indicator} ${platform}: ${statusText}\n`;
        } else {
          formatted += `├─ ⚠️  ${platforms[index].name}: Check failed\n`;
        }
      });
      
      formatted += `╰─ Username check complete`;

      res.json({ formatted });
      
    } catch (error) {
      console.error('Username check error:', error);
      res.status(500).json({ error: 'Username check failed' });
    }
  });

  // Radio streaming proxy endpoint
  app.get('/api/radio/stream', (req, res) => {
    const http = require('http');
    const streamUrl = 'http://204.141.171.164:12340/stream';
    
    // Parse the URL
    const url = new URL(streamUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ARCHIMEDES-Radio/1.0)',
        'Accept': 'audio/*',
        'Connection': 'keep-alive'
      }
    };
    
    const proxyReq = http.request(options, (proxyRes: any) => {
      // Set CORS and streaming headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
      
      // Copy headers from the original stream
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Accept-Ranges', 'none');
      
      // Copy ICY headers if present (Shoutcast metadata)
      Object.keys(proxyRes.headers).forEach(key => {
        if (key.startsWith('icy-')) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      
      console.log(`Radio stream: ${proxyRes.statusCode} - ${proxyRes.headers['content-type']}`);
      
      if (proxyRes.statusCode !== 200) {
        res.status(503).json({ 
          error: 'Stream unavailable',
          status: proxyRes.statusCode 
        });
        return;
      }
      
      // Set status code
      res.status(proxyRes.statusCode);
      
      // Pipe the audio stream
      proxyRes.pipe(res);
      
      proxyRes.on('error', (error: any) => {
        console.error('Stream error:', error);
        res.end();
      });
    });
    
    proxyReq.on('error', (error: any) => {
      console.error('Radio proxy error:', error);
      res.status(503).json({ 
        error: 'Radio stream unavailable',
        message: 'Unable to connect to KLUX 89.5HD stream'
      });
    });
    
    proxyReq.setTimeout(30000, () => {
      console.log('Radio stream timeout');
      proxyReq.destroy();
      res.status(503).json({ error: 'Stream timeout' });
    });
    
    proxyReq.end();
  });

  // CORS proxy for radio streaming - helps bypass CORS restrictions
  app.get("/api/radio-proxy", async (req, res) => {
    try {
      const streamUrl = req.query.url as string;
      
      if (!streamUrl) {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      console.log(`📻 Proxying radio stream: ${streamUrl}`);

      // Set CORS headers for audio streaming
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      // Fetch the stream and proxy it
      const response = await fetch(streamUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'RadioPlayer/1.0',
          'Accept': 'audio/*,*/*;q=0.1',
        }
      });

      if (!response.ok) {
        throw new Error(`Stream server returned ${response.status}`);
      }

      // Set appropriate headers for audio streaming
      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      
      // Pipe the response directly
      if (response.body) {
        const reader = response.body.getReader();
        
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } catch (error) {
            console.error('Streaming error:', error);
            res.end();
          }
        };
        
        pump();
      }

    } catch (error) {
      console.error("Radio proxy error:", error);
      res.status(500).json({ error: "Failed to proxy stream" });
    }
  });

  // Chat system API endpoints
  
  // Get online users
  app.get("/api/chat/online-users", isAuthenticated, async (req: any, res) => {
    try {
      const onlineUsers = await storage.getOnlineUsers();
      res.json(onlineUsers);
    } catch (error) {
      console.error("Get online users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get user's direct chats
  app.get("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chats = await storage.getUserDirectChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Get direct chats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Start or get existing direct chat
  app.post("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { otherUserId } = req.body;

      if (!otherUserId || otherUserId === userId) {
        return res.status(400).json({ error: "Invalid other user ID" });
      }

      const chat = await storage.getOrCreateDirectChat(userId, otherUserId);
      res.json(chat);
    } catch (error) {
      console.error("Create direct chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get messages for a specific chat
  app.get("/api/chat/conversations/:chatId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { chatId } = req.params;
      const { limit = 50 } = req.query;

      // Verify user has access to this chat
      const userChats = await storage.getUserDirectChats(userId);
      const hasAccess = userChats.some(chat => chat.id === chatId);

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getChatMessages(chatId, parseInt(limit));
      res.json(messages);
    } catch (error) {
      console.error("Get chat messages error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send a message
  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { chatId, content, toUserId } = req.body;

      if (!content || !chatId || !toUserId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify user has access to this chat
      const userChats = await storage.getUserDirectChats(userId);
      const hasAccess = userChats.some(chat => chat.id === chatId);

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const message = await storage.sendMessage({
        chatId,
        fromUserId: userId,
        toUserId,
        content,
        messageType: "text",
        isRead: false,
        isDelivered: false,
      });

      // Emit message via WebSocket to connected users
      chatWss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN && 
            (client.userId === userId || client.userId === toUserId)) {
          client.send(JSON.stringify({
            type: 'message',
            data: message
          }));
        }
      });

      res.json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Mark messages as read
  app.put("/api/chat/messages/:messageId/read", isAuthenticated, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      await storage.markMessageAsRead(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark message as read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get unread message count
  app.get("/api/chat/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server for telnet proxy
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws/telnet' 
  });
  
  // Initialize telnet proxy service
  const telnetProxy = new TelnetProxyService(wss);
  console.log('Telnet proxy WebSocket server initialized on /ws/telnet');

  // Create WebSocket server for chat system
  const chatWss = new WebSocketServer({
    server: httpServer,
    path: '/ws/chat'
  });

  // Handle chat WebSocket connections
  chatWss.on('connection', (ws: any, req) => {
    console.log('Chat WebSocket client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'auth':
            try {
              // Set user ID for this connection
              ws.userId = message.userId;
              
              // Update user presence as online (if method exists)
              try {
                await storage.updateUserPresence?.(message.userId, true, ws.id);
              } catch (error) {
                console.error('Error updating user presence:', error);
              }
              
              // Mark messages as delivered for this user (if method exists)  
              try {
                await storage.markMessagesAsDelivered?.(message.userId);
              } catch (error) {
                console.error('Error marking messages as delivered:', error);
              }
              
              // Broadcast user online status
              chatWss.clients.forEach((client: any) => {
                if (client.readyState === WebSocket.OPEN && client !== ws) {
                  client.send(JSON.stringify({
                    type: 'user_online',
                    data: { userId: message.userId }
                  }));
                }
              });
              
              ws.send(JSON.stringify({
                type: 'auth_success',
                data: { connected: true }
              }));
            } catch (error) {
              console.error('Error during WebSocket auth:', error);
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Authentication failed' }
              }));
            }
            break;

          case 'typing':
            // Broadcast typing indicator to other user
            chatWss.clients.forEach((client: any) => {
              if (client.readyState === WebSocket.OPEN && 
                  client.userId === message.toUserId) {
                client.send(JSON.stringify({
                  type: 'typing',
                  data: {
                    fromUserId: ws.userId,
                    chatId: message.chatId,
                    isTyping: message.isTyping
                  }
                }));
              }
            });
            break;

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    ws.on('close', async () => {
      console.log('Chat WebSocket client disconnected');
      
      if (ws.userId) {
        // Set user offline
        await storage.updateUserPresence(ws.userId, false);
        
        // Broadcast user offline status
        chatWss.clients.forEach((client: any) => {
          if (client.readyState === WebSocket.OPEN && client !== ws) {
            client.send(JSON.stringify({
              type: 'user_offline',
              data: { userId: ws.userId }
            }));
          }
        });
      }
    });

    ws.on('error', (error: Error) => {
      console.error('Chat WebSocket error:', error);
    });
  });

  console.log('Chat WebSocket server initialized on /ws/chat');
  
  return httpServer;
}

