import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Message } from '@shared/schema';

interface TerminalEntry {
  id: string;
  type: 'command' | 'response' | 'system' | 'error';
  content: string;
  timestamp: string;
  mode?: 'natural' | 'technical';
}

export function useTerminal(onUploadCommand?: () => void) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: '1',
      type: 'system',
      content: 'ARCHIMEDES AI Terminal v7.0 - Initialized',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      type: 'system',
      content: 'System Status: ONLINE | Voice Synthesis: READY | Mode: NATURAL CHAT',
      timestamp: new Date().toISOString(),
    },
    {
      id: '3',
      type: 'system',
      content: "Welcome to ARCHIMEDES v7. Type 'help' for available commands or start chatting naturally.",
      timestamp: new Date().toISOString(),
    },
  ]);
  
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentMode, setCurrentMode] = useState<'natural' | 'technical'>('natural');
  const [isTyping, setIsTyping] = useState(false);

  const chatMutation = useMutation({
    mutationFn: async ({ message, mode }: { message: string; mode: 'natural' | 'technical' }) => {
      const response = await apiRequest('POST', '/api/chat', {
        message,
        mode,
        sessionId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.response, data.mode);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Error: ${error.message}`);
    },
  });

  const weatherMutation = useMutation({
    mutationFn: async ({ location, coordinates }: { 
      location?: string;
      coordinates?: { lat: number; lon: number } 
    }) => {
      let endpoint = '/api/weather';
      const params = new URLSearchParams();
      
      if (coordinates) {
        params.append('lat', coordinates.lat.toString());
        params.append('lon', coordinates.lon.toString());
      } else if (location) {
        params.append('location', location);
      }
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }
      
      const response = await apiRequest('GET', endpoint);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Weather Error: ${error.message}`);
    },
  });

  const bookSearchMutation = useMutation({
    mutationFn: async (params: {
      search?: string;
      languages?: string[];
      author_year_start?: number;
      author_year_end?: number;
      topic?: string;
      sort?: string;
      page?: number;
    }) => {
      const queryParams = new URLSearchParams();
      
      if (params.search) queryParams.append('search', params.search);
      if (params.languages?.length) queryParams.append('languages', params.languages.join(','));
      if (params.author_year_start) queryParams.append('author_year_start', params.author_year_start.toString());
      if (params.author_year_end) queryParams.append('author_year_end', params.author_year_end.toString());
      if (params.topic) queryParams.append('topic', params.topic);
      if (params.sort) queryParams.append('sort', params.sort);
      if (params.page) queryParams.append('page', params.page.toString());

      const endpoint = `/api/books/search?${queryParams.toString()}`;
      const response = await apiRequest('GET', endpoint);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Book Search Error: ${error.message}`);
    },
  });

  const bookDetailMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const response = await apiRequest('GET', `/api/books/${bookId}`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Book Details Error: ${error.message}`);
    },
  });

  const popularBooksMutation = useMutation({
    mutationFn: async (limit: number = 20) => {
      const response = await apiRequest('GET', `/api/books/popular?limit=${limit}`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Popular Books Error: ${error.message}`);
    },
  });

  const booksByAuthorMutation = useMutation({
    mutationFn: async (authorName: string) => {
      const response = await apiRequest('GET', `/api/books/author/${encodeURIComponent(authorName)}`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Books by Author Error: ${error.message}`);
    },
  });

  const booksByTopicMutation = useMutation({
    mutationFn: async (topic: string) => {
      const response = await apiRequest('GET', `/api/books/topic/${encodeURIComponent(topic)}`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Books by Topic Error: ${error.message}`);
    },
  });

  const stockQuoteMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await apiRequest('GET', `/api/stocks/quote/${symbol.toUpperCase()}`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Stock Quote Error: ${error.message}`);
    },
  });

  const stockMultipleQuotesMutation = useMutation({
    mutationFn: async (symbols: string[]) => {
      const response = await apiRequest('POST', '/api/stocks/quotes', { symbols });
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Stock Quotes Error: ${error.message}`);
    },
  });

  const stockInfoMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await apiRequest('GET', `/api/stocks/info/${symbol.toUpperCase()}`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Stock Info Error: ${error.message}`);
    },
  });

  const stockHistoricalMutation = useMutation({
    mutationFn: async (params: { symbol: string; days?: number }) => {
      let endpoint = `/api/stocks/historical/${params.symbol.toUpperCase()}`;
      if (params.days) {
        endpoint += `?days=${params.days}`;
      }
      const response = await apiRequest('GET', endpoint);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Historical Data Error: ${error.message}`);
    },
  });

  const stockSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest('GET', `/api/stocks/search/${encodeURIComponent(query)}`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Stock Search Error: ${error.message}`);
    },
  });

  const stockIntradayMutation = useMutation({
    mutationFn: async (params: { symbol: string; interval?: string; limit?: number }) => {
      let endpoint = `/api/stocks/intraday/${params.symbol.toUpperCase()}`;
      const queryParams = new URLSearchParams();
      if (params.interval) queryParams.append('interval', params.interval);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (queryParams.toString()) endpoint += `?${queryParams.toString()}`;
      
      const response = await apiRequest('GET', endpoint);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Intraday Data Error: ${error.message}`);
    },
  });

  const addEntry = useCallback((type: TerminalEntry['type'], content: string, mode?: 'natural' | 'technical') => {
    const entry: TerminalEntry = {
      id: crypto.randomUUID(),
      type,
      content,
      timestamp: new Date().toISOString(),
      mode,
    };
    setEntries(prev => [...prev, entry]);
  }, []);

  const processCommand = useCallback((command: string) => {
    const timestamp = new Date().toLocaleTimeString();
    addEntry('command', command);
    
    // Add to command history
    setCommandHistory(prev => [command, ...prev.slice(0, 49)]); // Keep last 50 commands
    setHistoryIndex(-1);
    
    const cmd = command.toLowerCase().trim();
    
    // Handle built-in terminal commands
    if (cmd === 'help') {
      addEntry('system', `Available Commands:
  help - Show this help message
  clear - Clear terminal output
  mode [natural|technical] - Switch AI mode
  voice [on|off] - Toggle voice synthesis
  history - Show command history
  status - Show system status
  weather - Get current weather (uses location if available)
  
Network & BBS Commands:
  telnet <host> <port> - Connect to remote telnet/BBS system
  ping <host> - Test connectivity to remote host
  bbs-list - Show available BBS systems directory
  bbs-search <query> - Search BBS systems by name or location
  bbs-popular - Show popular BBS systems
  bbs-favorites - Show your favorite BBS systems
  
Stock Market Data:
  stock quote <symbol> - Get current stock price and info
  stock quotes <symbols> - Get multiple quotes (comma-separated)
  stock info <symbol> - Get detailed company information
  stock history <symbol> [days] - Historical data (default: 30 days)
  stock search <query> - Search for stocks by name or symbol
  stock intraday <symbol> - Real-time intraday data (premium feature)
  stock help - Show detailed stock command help

Project Gutenberg Books:
  books popular - Show most popular free ebooks
  books search <query> - Search books by title or author
  books author <name> - Find books by specific author
  books topic <topic> - Find books by topic/subject
  books info <id> - Get detailed info and download links for a book
  books help - Show detailed book command help
  
Radio Streaming:
  radio play - Start KLUX 89.5HD stream (Easy Listening)
  radio stop - Stop radio stream
  radio volume <0-100> - Set volume level
  radio status - Show current stream status
  
Games:
  snake - Play the classic Snake game
  
Knowledge Base Commands:
  docs - List your uploaded documents
  upload - Open document upload interface
  search [query] - Search your knowledge base
  knowledge stats - Show knowledge base statistics
  
You can also chat naturally or ask technical questions.`);
      return;
    }
    
    if (cmd === 'clear') {
      setEntries([]);
      return;
    }
    
    if (cmd.startsWith('mode ')) {
      const newMode = cmd.split(' ')[1] as 'natural' | 'technical';
      if (newMode === 'natural' || newMode === 'technical') {
        setCurrentMode(newMode);
        addEntry('system', `Mode switched to: ${newMode.toUpperCase()}`);
        return;
      } else {
        addEntry('error', 'Invalid mode. Use "natural" or "technical"');
        return;
      }
    }
    
    if (cmd === 'status') {
      addEntry('system', `ARCHIMEDES v7 System Status:
  Mode: ${currentMode.toUpperCase()}
  Session ID: ${sessionId}
  Commands Executed: ${commandHistory.length}
  System: ONLINE`);
      return;
    }
    
    if (cmd === 'history') {
      const historyText = commandHistory.length > 0 
        ? commandHistory.slice(0, 10).map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')
        : 'No command history available.';
      addEntry('system', `Recent Commands:\n${historyText}`);
      return;
    }

    // Handle weather command
    if (cmd === 'weather') {
      setIsTyping(true);
      addEntry('system', 'Getting weather information...');
      
      // Try to get user's location
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coordinates = {
              lat: position.coords.latitude,
              lon: position.coords.longitude
            };
            weatherMutation.mutate({ coordinates });
          },
          (error) => {
            // If geolocation fails, get default weather
            weatherMutation.mutate({});
          },
          { timeout: 5000, enableHighAccuracy: false }
        );
      } else {
        // If geolocation not supported, get default weather
        weatherMutation.mutate({});
      }
      return;
    }

    // Knowledge base commands
    if (cmd === 'docs') {
      setIsTyping(true);
      addEntry('system', 'Retrieving your document library...');
      
      // Fetch user documents
      fetch('/api/documents', { credentials: 'include' })
        .then(async (res) => {
          setIsTyping(false);
          if (res.status === 401) {
            addEntry('error', 'Authentication required. Please log in to access your documents.');
            return;
          }
          if (!res.ok) throw new Error('Failed to fetch documents');
          
          const documents = await res.json();
          if (documents.length === 0) {
            addEntry('system', 'No documents found. Use "upload" to add documents to your knowledge base.');
          } else {
            const docList = documents
              .map((doc: any, index: number) => 
                `${index + 1}. ${doc.originalName} (${doc.fileSize} bytes) - ${doc.summary || 'No summary'}`
              )
              .join('\n');
            addEntry('system', `Your Documents (${documents.length} total):\n${docList}\n\nUse "search [query]" to find specific information.`);
          }
        })
        .catch((error) => {
          setIsTyping(false);
          addEntry('error', `Error fetching documents: ${error.message}`);
        });
      return;
    }

    if (cmd === 'upload') {
      if (onUploadCommand) {
        onUploadCommand();
        addEntry('system', 'Opening document upload interface...');
      } else {
        addEntry('system', 'Upload interface not available. Please ensure you are logged in.');
      }
      return;
    }

    if (cmd.startsWith('search ')) {
      const query = command.substring(7).trim();
      if (!query) {
        addEntry('error', 'Please provide a search query. Usage: search [your query]');
        return;
      }

      setIsTyping(true);
      addEntry('system', `Searching knowledge base for: "${query}"`);
      
      fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}`, { 
        credentials: 'include' 
      })
        .then(async (res) => {
          setIsTyping(false);
          if (res.status === 401) {
            addEntry('error', 'Authentication required. Please log in to search your knowledge base.');
            return;
          }
          if (!res.ok) throw new Error('Search failed');
          
          const results = await res.json();
          const { documents, chunks, relevantContent } = results;
          
          if (relevantContent.length === 0) {
            addEntry('system', `No results found for "${query}". Try different keywords or upload more documents.`);
          } else {
            const resultText = `Search Results for "${query}":
Found ${relevantContent.length} relevant passages from ${documents.length} documents:

${relevantContent.map((content: string, i: number) => `${i + 1}. ${content}`).join('\n\n')}

Documents: ${documents.map((doc: any) => doc.originalName).join(', ')}`;
            addEntry('system', resultText);
          }
        })
        .catch((error) => {
          setIsTyping(false);
          addEntry('error', `Search error: ${error.message}`);
        });
      return;
    }

    if (cmd === 'knowledge stats' || cmd === 'kb stats') {
      setIsTyping(true);
      addEntry('system', 'Retrieving knowledge base statistics...');
      
      fetch('/api/knowledge/stats', { credentials: 'include' })
        .then(async (res) => {
          setIsTyping(false);
          if (res.status === 401) {
            addEntry('error', 'Authentication required. Please log in to view statistics.');
            return;
          }
          if (!res.ok) throw new Error('Failed to fetch stats');
          
          const stats = await res.json();
          const sizeInMB = (stats.totalSizeBytes / (1024 * 1024)).toFixed(2);
          
          const statsText = `Knowledge Base Statistics:
  Total Documents: ${stats.totalDocuments}
  Total Size: ${sizeInMB} MB
  Total Chunks: ${stats.totalChunks}
  
Recent Documents:
${stats.recentDocuments.length > 0 
  ? stats.recentDocuments.map((doc: any, i: number) => 
      `  ${i + 1}. ${doc.originalName} (uploaded ${new Date(doc.uploadedAt).toLocaleDateString()})`)
    .join('\n')
  : '  No documents yet'
}

Use "upload" to add more documents or "docs" to list all documents.`;
          addEntry('system', statsText);
        })
        .catch((error) => {
          setIsTyping(false);
          addEntry('error', `Error fetching stats: ${error.message}`);
        });
      return;
    }

    // Project Gutenberg Book Commands
    if (cmd.startsWith('books ')) {
      const subCmd = cmd.substring(6).trim();
      
      if (subCmd === 'help') {
        addEntry('system', `Project Gutenberg Book Commands:

Basic Commands:
  books popular [limit] - Show most downloaded books (default: 20)
  books search <query> - Search books by title or author
  books info <id> - Get detailed information and download links
  books author <name> - Find all books by a specific author  
  books topic <topic> - Find books by subject/topic

Advanced Search:
  books search <query> lang:<codes> - Search with language filter (e.g., lang:en,fr)
  books search <query> year:<start>-<end> - Search by author lifespan
  books search <query> topic:<subject> - Search by specific topic

Examples:
  books popular 10
  books search pride prejudice
  books search shakespeare lang:en
  books search dickens year:1800-1870  
  books author "Mark Twain"
  books topic children
  books info 1342

Over 70,000 free ebooks from Project Gutenberg available!
Download formats: Plain text, EPUB, HTML, and more.`);
        return;
      }
      
      if (subCmd === 'popular' || subCmd.startsWith('popular ')) {
        const parts = subCmd.split(' ');
        const limit = parts.length > 1 ? parseInt(parts[1]) || 20 : 20;
        
        setIsTyping(true);
        addEntry('system', `Fetching ${limit} most popular ebooks...`);
        popularBooksMutation.mutate(limit);
        return;
      }
      
      if (subCmd.startsWith('search ')) {
        const query = subCmd.substring(7).trim();
        if (!query) {
          addEntry('error', 'Usage: books search <query> [lang:<codes>] [year:<start>-<end>] [topic:<subject>]');
          return;
        }
        
        // Parse advanced search options
        const params: any = {};
        let searchQuery = query;
        
        // Extract language filter
        const langMatch = query.match(/\blang:([a-z,]+)/i);
        if (langMatch) {
          params.languages = langMatch[1].split(',').map(l => l.trim());
          searchQuery = searchQuery.replace(/\blang:[a-z,]+/i, '').trim();
        }
        
        // Extract year range filter
        const yearMatch = query.match(/\byear:(\d+)-(\d+)/);
        if (yearMatch) {
          params.author_year_start = parseInt(yearMatch[1]);
          params.author_year_end = parseInt(yearMatch[2]);
          searchQuery = searchQuery.replace(/\byear:\d+-\d+/, '').trim();
        }
        
        // Extract topic filter
        const topicMatch = query.match(/\btopic:(\w+)/i);
        if (topicMatch) {
          params.topic = topicMatch[1];
          searchQuery = searchQuery.replace(/\btopic:\w+/i, '').trim();
        }
        
        if (searchQuery) {
          params.search = searchQuery;
        }
        
        setIsTyping(true);
        addEntry('system', `Searching Project Gutenberg catalog...`);
        bookSearchMutation.mutate(params);
        return;
      }
      
      if (subCmd.startsWith('author ')) {
        const authorName = subCmd.substring(7).trim().replace(/['"]/g, '');
        if (!authorName) {
          addEntry('error', 'Usage: books author <author name>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Finding books by ${authorName}...`);
        booksByAuthorMutation.mutate(authorName);
        return;
      }
      
      if (subCmd.startsWith('topic ')) {
        const topic = subCmd.substring(6).trim();
        if (!topic) {
          addEntry('error', 'Usage: books topic <topic>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Finding books about ${topic}...`);
        booksByTopicMutation.mutate(topic);
        return;
      }
      
      if (subCmd.startsWith('info ')) {
        const bookId = parseInt(subCmd.substring(5).trim());
        if (isNaN(bookId)) {
          addEntry('error', 'Usage: books info <book id>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Retrieving details for book ID ${bookId}...`);
        bookDetailMutation.mutate(bookId);
        return;
      }
      
      // If no valid subcommand, show help
      addEntry('error', 'Unknown books command. Type "books help" for available commands.');
      return;
    }

    // Stock Market Commands
    if (cmd.startsWith('stock ')) {
      const subCmd = cmd.substring(6).trim();
      
      if (subCmd === 'help') {
        addEntry('system', `Stock Market Commands:

Basic Commands:
  stock quote <symbol> - Get current price and trading info
  stock quotes <symbols> - Multiple quotes (comma-separated: AAPL,MSFT,GOOGL)
  stock info <symbol> - Detailed company information
  stock search <query> - Find stocks by company name or symbol
  
Historical Data:
  stock history <symbol> - Last 30 days of trading data
  stock history <symbol> <days> - Specify number of days (max 100)
  
Real-time Data (Premium):
  stock intraday <symbol> - Live intraday data with 1-minute intervals
  
Examples:
  stock quote AAPL
  stock quotes AAPL,MSFT,GOOGL
  stock info TSLA
  stock search Apple
  stock history NVDA 7
  stock intraday AMZN

Data powered by Marketstack API - 125,000+ global stock tickers!
Free plan includes 100 monthly requests with end-of-day data.`);
        return;
      }
      
      if (subCmd.startsWith('quote ')) {
        const symbol = subCmd.substring(6).trim().toUpperCase();
        if (!symbol) {
          addEntry('error', 'Usage: stock quote <symbol>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Fetching current quote for ${symbol}...`);
        stockQuoteMutation.mutate(symbol);
        return;
      }
      
      if (subCmd.startsWith('quotes ')) {
        const symbolsStr = subCmd.substring(7).trim();
        if (!symbolsStr) {
          addEntry('error', 'Usage: stock quotes <symbol1,symbol2,symbol3>');
          return;
        }
        
        const symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        if (symbols.length === 0) {
          addEntry('error', 'Please provide at least one valid stock symbol');
          return;
        }
        
        if (symbols.length > 10) {
          addEntry('error', 'Maximum 10 symbols allowed per request');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Fetching quotes for ${symbols.join(', ')}...`);
        stockMultipleQuotesMutation.mutate(symbols);
        return;
      }
      
      if (subCmd.startsWith('info ')) {
        const symbol = subCmd.substring(5).trim().toUpperCase();
        if (!symbol) {
          addEntry('error', 'Usage: stock info <symbol>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Retrieving company information for ${symbol}...`);
        stockInfoMutation.mutate(symbol);
        return;
      }
      
      if (subCmd.startsWith('search ')) {
        const query = subCmd.substring(7).trim();
        if (!query) {
          addEntry('error', 'Usage: stock search <company name or symbol>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Searching stocks for "${query}"...`);
        stockSearchMutation.mutate(query);
        return;
      }
      
      if (subCmd.startsWith('history ')) {
        const parts = subCmd.substring(8).trim().split(' ');
        const symbol = parts[0]?.toUpperCase();
        const days = parts[1] ? parseInt(parts[1]) : 30;
        
        if (!symbol) {
          addEntry('error', 'Usage: stock history <symbol> [days]');
          return;
        }
        
        if (days && (isNaN(days) || days < 1 || days > 365)) {
          addEntry('error', 'Days must be a number between 1 and 365');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Fetching ${days} days of historical data for ${symbol}...`);
        stockHistoricalMutation.mutate({ symbol, days });
        return;
      }
      
      if (subCmd.startsWith('intraday ')) {
        const parts = subCmd.substring(9).trim().split(' ');
        const symbol = parts[0]?.toUpperCase();
        
        if (!symbol) {
          addEntry('error', 'Usage: stock intraday <symbol>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `Fetching real-time intraday data for ${symbol}...`);
        stockIntradayMutation.mutate({ symbol, interval: '1min', limit: 50 });
        return;
      }
      
      // If no valid subcommand, show help
      addEntry('error', 'Unknown stock command. Type "stock help" for available commands.');
      return;
    }

    // Network & BBS Commands
    if (cmd.startsWith('telnet ')) {
      const parts = cmd.split(' ');
      if (parts.length < 3) {
        addEntry('error', 'Usage: telnet <host> <port>');
        return;
      }
      
      const host = parts[1];
      const port = parseInt(parts[2]);
      
      if (isNaN(port) || port <= 0 || port > 65535) {
        addEntry('error', 'Invalid port number. Port must be between 1 and 65535.');
        return;
      }
      
      addEntry('system', `Opening telnet client and connecting to ${host}:${port}...`);
      
      // Store the connection request for the telnet client
      (window as any).pendingTelnetConnection = { host, port };
      
      // Open the telnet client modal
      const openTelnetModal = (window as any).openTelnetModal;
      if (openTelnetModal) {
        openTelnetModal();
      } else {
        addEntry('error', 'Telnet client not available. Please use the Telnet button in the toolbar.');
      }
      return;
    }

    if (cmd.startsWith('ping ')) {
      const host = cmd.split(' ')[1];
      if (!host) {
        addEntry('error', 'Usage: ping <host>');
        return;
      }
      
      addEntry('system', `PING ${host} - Testing connectivity...`);
      
      // Simulate ping by attempting a basic connectivity test
      const startTime = Date.now();
      fetch(`/api/ping/${encodeURIComponent(host)}`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
        .then(response => {
          const endTime = Date.now();
          const latency = endTime - startTime;
          
          if (response.ok) {
            addEntry('system', `PING ${host}: Host is reachable (${latency}ms)`);
          } else {
            addEntry('error', `PING ${host}: Host unreachable or refusing connection`);
          }
        })
        .catch(error => {
          addEntry('error', `PING ${host}: Request failed - ${error.message}`);
        });
      return;
    }

    if (cmd === 'bbs-list') {
      setIsTyping(true);
      addEntry('system', 'Retrieving BBS directory...');
      
      fetch('/api/bbs/systems')
        .then(response => response.json())
        .then((systems: any[]) => {
          setIsTyping(false);
          if (systems.length === 0) {
            addEntry('system', 'No BBS systems found.');
            return;
          }
          
          const bbsList = systems
            .slice(0, 10) // Show first 10
            .map((bbs, index) => 
              `${index + 1}. ${bbs.name} - ${bbs.host}:${bbs.port}
     Location: ${bbs.location || 'Unknown'}
     Software: ${bbs.software || 'Unknown'}
     Description: ${bbs.description || 'No description available'}
     Connect: telnet ${bbs.host} ${bbs.port}`
            )
            .join('\n\n');
            
          const totalText = systems.length > 10 ? `\nShowing 10 of ${systems.length} systems. Use "bbs-search" to find specific systems.` : '';
          
          addEntry('system', `BBS Systems Directory:\n\n${bbsList}${totalText}`);
        })
        .catch(error => {
          setIsTyping(false);
          addEntry('error', `Failed to fetch BBS directory: ${error.message}`);
        });
      return;
    }

    if (cmd.startsWith('bbs-search ')) {
      const query = cmd.substring(11).trim();
      if (!query) {
        addEntry('error', 'Usage: bbs-search <query>');
        return;
      }
      
      setIsTyping(true);
      addEntry('system', `Searching BBS systems for: "${query}"`);
      
      fetch(`/api/bbs/systems?search=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then((systems: any[]) => {
          setIsTyping(false);
          if (systems.length === 0) {
            addEntry('system', `No BBS systems found matching "${query}".`);
            return;
          }
          
          const searchResults = systems
            .map((bbs, index) => 
              `${index + 1}. ${bbs.name} - ${bbs.host}:${bbs.port}
     Location: ${bbs.location || 'Unknown'}
     Description: ${bbs.description || 'No description available'}
     Connect: telnet ${bbs.host} ${bbs.port}`
            )
            .join('\n\n');
            
          addEntry('system', `BBS Search Results (${systems.length} found):\n\n${searchResults}`);
        })
        .catch(error => {
          setIsTyping(false);
          addEntry('error', `BBS search failed: ${error.message}`);
        });
      return;
    }

    if (cmd === 'bbs-popular') {
      setIsTyping(true);
      addEntry('system', 'Retrieving popular BBS systems...');
      
      fetch('/api/bbs/popular?limit=5')
        .then(response => response.json())
        .then((systems: any[]) => {
          setIsTyping(false);
          if (systems.length === 0) {
            addEntry('system', 'No popular BBS systems found.');
            return;
          }
          
          const popularList = systems
            .map((bbs, index) => 
              `${index + 1}. ${bbs.name} - ${bbs.host}:${bbs.port}
     Connections: ${bbs.totalConnections || 0}
     Location: ${bbs.location || 'Unknown'}
     Connect: telnet ${bbs.host} ${bbs.port}`
            )
            .join('\n\n');
            
          addEntry('system', `Popular BBS Systems:\n\n${popularList}`);
        })
        .catch(error => {
          setIsTyping(false);
          addEntry('error', `Failed to fetch popular BBS systems: ${error.message}`);
        });
      return;
    }

    if (cmd === 'bbs-favorites') {
      setIsTyping(true);
      addEntry('system', 'Retrieving your favorite BBS systems...');
      
      fetch('/api/bbs/favorites', { credentials: 'include' })
        .then(async response => {
          setIsTyping(false);
          if (response.status === 401) {
            addEntry('error', 'Authentication required. Please log in to view your favorites.');
            return;
          }
          if (!response.ok) throw new Error('Failed to fetch favorites');
          
          const systems = await response.json();
          if (systems.length === 0) {
            addEntry('system', 'No favorite BBS systems yet. Connect to systems and save them as favorites!');
            return;
          }
          
          const favoritesList = systems
            .map((bbs: any, index: number) => 
              `${index + 1}. ${bbs.name} - ${bbs.host}:${bbs.port}
     Location: ${bbs.location || 'Unknown'}
     Connect: telnet ${bbs.host} ${bbs.port}`
            )
            .join('\n\n');
            
          addEntry('system', `Your Favorite BBS Systems (${systems.length}):\n\n${favoritesList}`);
        })
        .catch(error => {
          setIsTyping(false);
          addEntry('error', `Failed to fetch favorites: ${error.message}`);
        });
      return;
    }

    // Games
    if (cmd === 'snake') {
      addEntry('system', 'Launching Snake Game...');
      const openSnakeGame = (window as any).openSnakeGame;
      if (openSnakeGame) {
        openSnakeGame();
      } else {
        addEntry('error', 'Snake game not available. Please ensure the game component is loaded.');
      }
      return;
    }

    // Radio streaming commands
    if (cmd.startsWith('radio ')) {
      const subCmd = cmd.substring(6).trim();
      
      if (subCmd === 'play') {
        const radioElement = document.querySelector('audio[src*="/api/radio/stream"]') as HTMLAudioElement;
        if (radioElement) {
          radioElement.play()
            .then(() => addEntry('system', '🎵 KLUX 89.5HD stream started'))
            .catch(() => addEntry('error', 'Error: Unable to start radio stream'));
        } else {
          // Trigger radio interface to open
          const openRadioButton = document.querySelector('[data-testid="button-radio"]') as HTMLButtonElement;
          if (openRadioButton) {
            openRadioButton.click();
            addEntry('system', 'Opening radio interface...');
          } else {
            addEntry('error', 'Radio interface not available');
          }
        }
        return;
      }
      
      if (subCmd === 'stop') {
        const radioElement = document.querySelector('audio[src*="/api/radio/stream"]') as HTMLAudioElement;
        if (radioElement) {
          radioElement.pause();
          addEntry('system', '⏹️ KLUX 89.5HD stream stopped');
        } else {
          addEntry('error', 'Radio is not currently active');
        }
        return;
      }
      
      if (subCmd.startsWith('volume ')) {
        const volumeStr = subCmd.substring(7).trim();
        const volumeNum = parseFloat(volumeStr);
        
        if (isNaN(volumeNum) || volumeNum < 0 || volumeNum > 100) {
          addEntry('error', 'Usage: radio volume <0-100>');
          return;
        }
        
        const radioElement = document.querySelector('audio[src*="/api/radio/stream"]') as HTMLAudioElement;
        if (radioElement) {
          radioElement.volume = volumeNum / 100;
          addEntry('system', `🔊 Volume set to ${volumeNum}%`);
        } else {
          addEntry('error', 'Radio is not currently active');
        }
        return;
      }
      
      if (subCmd === 'status') {
        const radioElement = document.querySelector('audio[src*="/api/radio/stream"]') as HTMLAudioElement;
        if (radioElement) {
          const isPlaying = !radioElement.paused;
          const volume = Math.round(radioElement.volume * 100);
          const status = `Radio Status: ${isPlaying ? 'Streaming 🎵' : 'Stopped ⏹️'}
Station: KLUX 89.5HD - Good Company
Location: Corpus Christi, TX
Format: Easy Listening
Volume: ${volume}%
Connection: ${radioElement.readyState >= 2 ? 'Ready' : 'Loading...'}`;
          addEntry('system', status);
        } else {
          addEntry('system', `Radio Status: Inactive
Use "radio play" to start streaming KLUX 89.5HD`);
        }
        return;
      }
      
      addEntry('error', 'Unknown radio command. Available: play, stop, volume <0-100>, status');
      return;
    }
    
    // For non-command inputs, send to AI
    setIsTyping(true);
    chatMutation.mutate({ message: command, mode: currentMode });
  }, [currentMode, sessionId, commandHistory.length, addEntry, chatMutation, weatherMutation]);

  const clearTerminal = useCallback(() => {
    setEntries([]);
  }, []);

  const switchMode = useCallback((mode: 'natural' | 'technical') => {
    setCurrentMode(mode);
    addEntry('system', `Mode switched to: ${mode.toUpperCase()}`);
  }, [addEntry]);

  const getHistoryCommand = useCallback((direction: 'up' | 'down') => {
    if (direction === 'up' && historyIndex < commandHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      return commandHistory[newIndex];
    } else if (direction === 'down' && historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      return commandHistory[newIndex];
    } else if (direction === 'down' && historyIndex === 0) {
      setHistoryIndex(-1);
      return '';
    }
    return null;
  }, [commandHistory, historyIndex]);

  const loadConversation = useCallback(async (targetSessionId: string) => {
    try {
      const response = await apiRequest('GET', `/api/conversation/${targetSessionId}`);
      const conversation = await response.json();
      
      if (conversation && Array.isArray(conversation.messages)) {
        // Clear current entries and load conversation
        setEntries([
          {
            id: crypto.randomUUID(),
            type: 'system',
            content: `Loaded conversation: ${conversation.title || 'Untitled'}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        
        // Add all messages from the conversation
        conversation.messages.forEach((msg: Message, index: number) => {
          setEntries(prev => [...prev, {
            id: crypto.randomUUID(),
            type: msg.role === 'user' ? 'command' : 'response',
            content: msg.content,
            timestamp: msg.timestamp,
            mode: msg.mode,
          }]);
        });
        
        // Update current mode to match the conversation
        if (conversation.mode) {
          setCurrentMode(conversation.mode);
        }
      }
    } catch (error) {
      addEntry('error', 'Failed to load conversation history');
    }
  }, [addEntry]);

  return {
    entries,
    commandHistory,
    currentMode,
    isTyping,
    processCommand,
    clearTerminal,
    switchMode,
    getHistoryCommand,
    loadConversation,
    isLoading: chatMutation.isPending,
  };
}
