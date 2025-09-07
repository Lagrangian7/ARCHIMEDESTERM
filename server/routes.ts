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
          // Update the conversation to link it to the user
          conversation.userId = userId;
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
  
  return httpServer;
}

