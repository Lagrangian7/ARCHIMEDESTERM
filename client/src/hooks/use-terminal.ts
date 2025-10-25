import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Message } from '@shared/schema';

// Static path to audio file in public directory
const lagrangianSong = '/lagrangian-25.mp3';

interface TerminalEntry {
  id: string;
  type: 'command' | 'response' | 'system' | 'error';
  content: string;
  timestamp: string;
  mode?: 'natural' | 'technical';
}

export function useTerminal(onUploadCommand?: () => void) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [sessionStartTime] = useState(() => new Date());
  const [totalWords, setTotalWords] = useState(0);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  
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
      content: "Archimedes v7 Online",
      timestamp: new Date().toISOString(),
    },
  ]);
  
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentMode, setCurrentMode] = useState<'natural' | 'technical'>('natural');
  const [isTyping, setIsTyping] = useState(false);
  const [backgroundAudio, setBackgroundAudio] = useState<HTMLAudioElement | null>(null);

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

  const researchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest('GET', `/api/research?q=${encodeURIComponent(query)}`);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      // Format research results for terminal display
      const formattedResults = `🔍 Web Search Results for "${data.query}"
Total Results: ${data.total_results}
Search Time: ${new Date(data.search_time).toLocaleTimeString()}

${data.results.map((result: any) => 
  `${result.rank}. ${result.title}
   🔗 ${result.url}
   📄 ${result.description}
   ${result.published ? `📅 ${new Date(result.published).toLocaleDateString()}` : ''}
`).join('\n')}

Use the URLs above to access the full articles and information.`;
      
      addEntry('response', formattedResults);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Research Error: ${error.message}`);
    },
  });

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (backgroundAudio) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
      }
    };
  }, [backgroundAudio]);

  const addEntry = useCallback((type: TerminalEntry['type'], content: string, mode?: 'natural' | 'technical') => {
    const entry: TerminalEntry = {
      id: crypto.randomUUID(),
      type,
      content,
      timestamp: new Date().toISOString(),
      mode,
    };
    setEntries(prev => [...prev, entry]);
    
    // Track word count for session analytics
    if (type === 'response' || type === 'command') {
      const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
      setTotalWords(prev => prev + wordCount);
    }
  }, []);

  const processCommand = useCallback((command: string) => {
    const timestamp = new Date().toLocaleTimeString();
    addEntry('command', command);
    
    // Add to command history
    setCommandHistory(prev => [command, ...prev.slice(0, 49)]); // Keep last 50 commands
    setHistoryIndex(-1);
    
    const cmd = command.toLowerCase().trim();
    
    // Check if we're in OSINT input mode
    const osintMode = localStorage.getItem('osintMode');
    if (osintMode && command.trim()) {
      // Allow users to cancel OSINT mode
      if (cmd === 'cancel' || cmd === 'exit' || cmd === 'quit') {
        localStorage.removeItem('osintMode');
        addEntry('system', '❌ OSINT operation cancelled');
        return;
      }
      
      const target = command.trim();
      localStorage.removeItem('osintMode'); // Clear the mode
      
      // Execute the selected OSINT command
      if (osintMode === 'whois') {
        addEntry('system', `🔍 Performing WHOIS lookup for ${target}...`);
        fetch(`/api/osint/whois/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'WHOIS lookup failed');
          });
        return;
      }
      
      if (osintMode === 'dns') {
        addEntry('system', `🌐 Querying DNS records for ${target}...`);
        fetch(`/api/osint/dns/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'DNS lookup failed');
          });
        return;
      }
      
      if (osintMode === 'geoip') {
        addEntry('system', `🌍 Geolocating IP address ${target}...`);
        fetch(`/api/osint/geoip/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'IP geolocation failed');
          });
        return;
      }
      
      if (osintMode === 'headers') {
        addEntry('system', `🔍 Analyzing HTTP headers for ${target}...`);
        fetch(`/api/osint/headers?url=${encodeURIComponent(target)}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Header analysis failed');
          });
        return;
      }
      
      if (osintMode === 'wayback') {
        addEntry('system', `📚 Searching Wayback Machine for ${target}...`);
        fetch(`/api/osint/wayback?url=${encodeURIComponent(target)}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Wayback Machine search failed');
          });
        return;
      }
      
      if (osintMode === 'username') {
        addEntry('system', `👤 Checking username availability for ${target}...`);
        fetch(`/api/osint/username/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Username check failed');
          });
        return;
      }
      
      if (osintMode === 'traceroute') {
        addEntry('system', `🛤️ Tracing network path to ${target}...`);
        fetch(`/api/osint/traceroute/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Traceroute failed');
          });
        return;
      }
      
      if (osintMode === 'subdomains') {
        addEntry('system', `🌐 Enumerating subdomains for ${target}...`);
        fetch(`/api/osint/subdomains/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Subdomain enumeration failed');
          });
        return;
      }
      
      if (osintMode === 'ssl') {
        addEntry('system', `🔒 Analyzing SSL certificate for ${target}...`);
        fetch(`/api/osint/ssl/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'SSL analysis failed');
          });
        return;
      }
      
      if (osintMode === 'tech') {
        addEntry('system', `⚙️ Detecting technology stack for ${target}...`);
        fetch(`/api/osint/tech/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Technology detection failed');
          });
        return;
      }
      
      if (osintMode === 'reverse-ip') {
        addEntry('system', `🔄 Performing reverse IP lookup for ${target}...`);
        fetch(`/api/osint/reverse-ip/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Reverse IP lookup failed');
          });
        return;
      }
      
      if (osintMode === 'portscan') {
        addEntry('system', `🛡️ Scanning ports on ${target}...`);
        fetch(`/api/osint/portscan/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Port scan failed');
          });
        return;
      }
      
      if (osintMode === 'report') {
        addEntry('system', `📋 Generating comprehensive OSINT report for ${target}...`);
        addEntry('system', 'This may take a moment as we gather intelligence from multiple sources...');
        fetch(`/api/osint/report/${target}`)
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'OSINT report generation failed');
          });
        return;
      }
    }
    
    // Handle built-in terminal commands
    if (cmd === 'help') {
      // Open interactive help menu instead of static text  
      addEntry('system', 'Opening interactive help menu... (Use F1 key for quick access)');
      
      // Trigger the help menu
      setTimeout(() => {
        const openHelpMenu = (window as any).openHelpMenu;
        if (openHelpMenu) {
          openHelpMenu();
        } else {
          addEntry('error', 'Help menu not available. Try pressing F1 key instead.');
        }
      }, 50);
      return;
    }

    if (cmd === 'chat') {
      addEntry('system', 'Opening chat interface... Connect with other online users!');
      
      // Trigger the chat interface
      setTimeout(() => {
        const openChatInterface = (window as any).openChatInterface;
        if (openChatInterface) {
          openChatInterface();
        } else {
          addEntry('error', 'Chat interface not available. Please try using the Chat button in the header.');
        }
      }, 50);
      return;
    }
    
    // Fallback help command if the interactive menu fails
    if (cmd === 'help-text') {
      addEntry('system', `Available Commands:
  help - Show this help message
  clear - Clear terminal output
  mode [natural|technical] - Switch AI mode
  voice [on|off] - Toggle voice synthesis
  history - Show command history
  status - Show system status
  weather - Get current weather (uses location if available)
  research <query> - Search the web using Brave API
  chat - Open user-to-user chat interface
  
Network & BBS Commands:
  telnet <host> <port> - Connect via web-based telnet client
  ssh <user@host> [port] - Connect via web-based SSH client
  ssh-client / sshwifty - Open SSH/Telnet client interface
  ping <host> - Test connectivity to remote host
  bbs-list - Show available BBS systems directory
  bbs-search <query> - Search BBS systems by name or location
  bbs-popular - Show popular BBS systems
  bbs-favorites - Show your favorite BBS systems
  
Stock Market Data:
  stock quote <symbol> - Get current stock price and info
  stock quotes <symbols> - Get multiple quotes (comma-separated)
  stock info <symbol> - Get detailed company information
  stock search <query> - Search for stocks by name or symbol
  stock help - Show detailed stock command help

Academic Research:
  scholar search <query> - Search 200M+ academic papers
  scholar details <paperId> - Get full paper details
  scholar help - Show detailed scholar command help

Wolfram Alpha:
  query <search input> [options] - Query Wolfram Alpha for computational answers
  query help - Show detailed query command help and parameter options

Project Gutenberg Books:
  books popular - Show most popular free ebooks
  books search <query> - Search books by title or author
  books author <name> - Find books by specific author
  books topic <topic> - Find books by topic/subject
  books info <id> - Get detailed info and download links for a book
  books help - Show detailed book command help
  
Radio & Music:
  radio play - Start Radio Swiss Jazz stream
  radio stop - Stop radio stream
  radio volume <0-100> - Set volume level
  radio status - Show current stream status
  play our song - Launch Webamp and play Lagrangian 25
  stop - Stop background music
  debug audio - Test audio file loading and show diagnostic info
  webamp - Launch Webamp player with Milkdrop visualizer
  aj - Launch AJ video player
  
OSINT (Open Source Intelligence):
  whois <domain> - Domain registration lookup
  dns <domain> - DNS records analysis
  geoip <ip> - IP geolocation tracking
  headers <url> - HTTP header analysis
  wayback <url> - Website snapshots
  username <name> - Username availability
  traceroute <host> - Network path trace
  subdomains <domain> - Subdomain discovery
  ssl <domain> - SSL certificate analysis
  tech <domain> - Technology stack detection
  reverse-ip <ip> - Reverse IP lookup
  portscan <target> - Port scanner
  osint-report <target> - Comprehensive OSINT report
  threat-actors - MISP Galaxy threat actor intelligence
  threat-actors <name> - Look up specific threat actor details
  
Audio & Signal Processing:
  dtmf - Start DTMF decoder for touch-tone signals
  
Games:
  snake - Play the classic Snake game
  zork - Play ZORK: The Great Underground Empire
  spacewars - Launch SPACEWAR game in new browser window
  
System Commands:
  privacy - Activate matrix rain privacy screen (type "QWERTY" to unlock)
  xx - Activate screensaver manually
  
Knowledge Base Commands:
  docs - List your uploaded documents
  upload - Open document upload interface
  search [query] - Search your knowledge base
  save - Save last AI response to knowledge base
  knowledge stats - Show knowledge base statistics

Session & Productivity:
  session - View session analytics (time, words, commands)
  copy - Copy last response to clipboard
  bookmark <command> - Save a command as bookmark
  bookmarks - View all bookmarked commands
  bookmark-delete <number> - Remove a bookmark

Code Execution:
  preview / run - Execute and preview code from last AI response
  preview <code> - Execute and preview your pasted HTML/CSS/JS code
  
You can also chat naturally or ask technical questions.`);
      return;
    }
    
    if (cmd === 'clear') {
      setEntries([
        {
          id: crypto.randomUUID(),
          type: 'system',
          content: 'ARCHIMEDES AI Terminal v7.0 - Initialized',
          timestamp: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          type: 'system',
          content: 'System Status: ONLINE | Voice Synthesis: READY | Mode: NATURAL CHAT',
          timestamp: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          type: 'system',
          content: "Welcome to ARCHIMEDES v7.",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }
    
    if (cmd === 'privacy') {
      addEntry('system', 'Privacy screen activated! Matrix rain overlay is now protecting your screen. Type "QWERTY" to unlock and return to normal view.');
      
      // Trigger the privacy screen overlay
      setTimeout(() => {
        const openPrivacyEncoder = (window as any).openPrivacyEncoder;
        if (openPrivacyEncoder) {
          openPrivacyEncoder();
        } else {
          addEntry('error', 'Privacy screen not available. Please try using the Privacy button in the header.');
        }
      }, 50);
      return;
    }
    
    if (cmd === 'xx') {
      addEntry('system', 'Activating screensaver...');
      const activateScreensaver = (window as any).activateScreensaver;
      if (activateScreensaver) {
        activateScreensaver();
      } else {
        addEntry('error', 'Screensaver not available. Please ensure the system is loaded.');
      }
      return;
    }

    if (cmd === 'debug audio' || cmd === 'test audio') {
      addEntry('system', `Audio Debug Information:\n\nImported path: ${lagrangianSong}\nPath type: ${typeof lagrangianSong}\nPath length: ${lagrangianSong.length}\nEnvironment: ${import.meta.env.MODE}\n\nTrying to create Audio element...`);
      
      try {
        const testAudio = new Audio(lagrangianSong);
        addEntry('system', `✓ Audio element created successfully\nAudio src: ${testAudio.src}\n\nAttempting to load metadata...`);
        
        testAudio.addEventListener('loadedmetadata', () => {
          addEntry('system', `✓ Audio metadata loaded\nDuration: ${testAudio.duration}s\nReady to play!`);
        });
        
        testAudio.addEventListener('error', (e) => {
          const errorCode = testAudio.error?.code;
          const errorMessages: Record<number, string> = {
            1: 'MEDIA_ERR_ABORTED - Download aborted',
            2: 'MEDIA_ERR_NETWORK - Network error',
            3: 'MEDIA_ERR_DECODE - Decoding error',
            4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Format not supported or file not found'
          };
          addEntry('error', `✗ Audio loading failed\nError code: ${errorCode}\nError: ${errorMessages[errorCode || 0] || 'Unknown error'}\nSource: ${testAudio.src}`);
        });
        
        testAudio.load();
      } catch (error: any) {
        addEntry('error', `✗ Failed to create audio element: ${error.message}`);
      }
      
      return;
    }
    
    if (cmd === 'play our song') {
      addEntry('system', '🎵 Launching Webamp...\n\nOpening music player with Milkdrop visualizer.');
      
      const openWebamp = (window as any).openWebamp;
      if (openWebamp) {
        openWebamp();
      } else {
        addEntry('error', 'Webamp not available. Please ensure the system is loaded.');
      }
      
      return;
    }

    if (cmd === 'stop') {
      if (backgroundAudio) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
        setBackgroundAudio(null);
        addEntry('system', '🔇 Background music stopped.');
      } else {
        addEntry('system', 'No background music is currently playing.');
      }
      return;
    }
    
    if (cmd === 'ssh-client' || cmd === 'sshwifty') {
      addEntry('system', 'Opening SSH/Telnet client interface...');
      const openSshwiftyInterface = (window as any).openSshwiftyInterface;
      if (openSshwiftyInterface) {
        openSshwiftyInterface();
      } else {
        addEntry('error', 'SSH/Telnet interface not available. Please ensure the system is loaded.');
      }
      return;
    }
    
    if (cmd === 'webamp') {
      addEntry('system', '🎵 Launching Webamp music player with Milkdrop visualizer...\n\nControls:\n- ESC to close\n- SPACE/← → for preset navigation\n- H for hard cut\n- R to toggle preset cycling\n\nLoading...');
      
      const openWebamp = (window as any).openWebamp;
      if (openWebamp) {
        openWebamp();
      } else {
        addEntry('error', 'Webamp not available. Please ensure the system is loaded.');
      }
      return;
    }
    
    if (cmd === 'aj') {
      addEntry('system', '📺 Launching AJ video player...');
      
      const openAJVideo = (window as any).openAJVideo;
      if (openAJVideo) {
        openAJVideo();
      } else {
        addEntry('error', 'AJ video player not available. Please ensure the system is loaded.');
      }
      return;
    }
    
    if (cmd === 'mode') {
      // Toggle between natural and technical
      const newMode = currentMode === 'natural' ? 'technical' : 'natural';
      setCurrentMode(newMode);
      addEntry('system', `Mode switched to: ${newMode.toUpperCase()}`);
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

    if (cmd === 'stop') {
      // Stop speech synthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        addEntry('system', '🛑 Speech synthesis stopped. Awaiting next command...');
      } else {
        addEntry('error', 'Speech synthesis not available in this browser');
      }
      return;
    }

    // Handle weather command
    if (cmd.startsWith('weather')) {
      setIsTyping(true);
      
      // Parse weather command arguments
      const weatherArgs = command.trim().split(/\s+/).slice(1);
      const location = weatherArgs.join(' ');
      
      if (location) {
        // Use provided location
        addEntry('system', `Getting weather information for ${location}...`);
        weatherMutation.mutate({ location });
      } else {
        // Try to get user's location
        addEntry('system', 'Getting weather information...');
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
      }
      return;
    }

    // Handle research command
    if (cmd.startsWith('research ')) {
      const query = command.trim().substring(9); // Remove "research "
      if (!query) {
        addEntry('error', 'Usage: research <search query>');
        return;
      }
      
      setIsTyping(true);
      addEntry('system', `🔍 Searching the web for "${query}"...`);
      researchMutation.mutate(query);
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

    if (cmd.startsWith('read ')) {
      const filename = cmd.substring(5).trim();
      if (!filename) {
        addEntry('error', 'Usage: read <document.txt>');
        return;
      }
      
      addEntry('system', `📖 Reading document: ${filename}...`);
      setIsTyping(true);
      
      fetch(`/api/documents/read/${encodeURIComponent(filename)}`, { credentials: 'include' })
        .then(async (res) => {
          setIsTyping(false);
          if (res.status === 401) {
            addEntry('error', 'Authentication required. Please log in to read documents.');
            return;
          }
          if (res.status === 404) {
            const errorData = await res.json();
            addEntry('error', errorData.formatted || `❌ Document '${filename}' not found in knowledge base.\n\nUse 'docs' command to list available documents.`);
            return;
          }
          if (!res.ok) {
            addEntry('error', `Failed to read document: ${res.status} ${res.statusText}`);
            return;
          }
          
          const data = await res.json();
          if (data.formatted) {
            addEntry('response', data.formatted);
          } else {
            addEntry('response', `📖 Reading: ${filename}\n\n${data.document?.content || 'No content available'}`);
          }
        })
        .catch((error) => {
          setIsTyping(false);
          addEntry('error', `Failed to read document: ${error.message || 'Network error'}`);
        });
      return;
    }

    if (cmd === 'session') {
      const currentTime = new Date();
      const sessionDuration = Math.floor((currentTime.getTime() - sessionStartTime.getTime()) / 1000);
      const hours = Math.floor(sessionDuration / 3600);
      const minutes = Math.floor((sessionDuration % 3600) / 60);
      const seconds = sessionDuration % 60;
      
      const timeString = hours > 0 
        ? `${hours}h ${minutes}m ${seconds}s`
        : minutes > 0 
          ? `${minutes}m ${seconds}s`
          : `${seconds}s`;
      
      const analyticsText = `📊 SESSION ANALYTICS

⏱️  Duration: ${timeString}
📝 Total Words: ${totalWords.toLocaleString()}
🔢 Commands Used: ${commandHistory.length}
🎯 Current Mode: ${currentMode.toUpperCase()}
📅 Session Started: ${sessionStartTime.toLocaleTimeString()}

💡 Tip: Use 'bookmarks' to save your favorite commands!`;
      
      addEntry('system', analyticsText);
      return;
    }

    if (cmd === 'copy') {
      const lastResponse = [...entries].reverse().find(entry => entry.type === 'response');
      
      if (!lastResponse) {
        addEntry('error', 'No response to copy. Please ask a question first.');
        return;
      }

      if (!navigator.clipboard?.writeText) {
        addEntry('error', 'Clipboard API not available. Please use a secure context (HTTPS) or a supported browser.');
        return;
      }

      try {
        navigator.clipboard.writeText(lastResponse.content)
          .then(() => {
            addEntry('system', '📋 Response copied to clipboard!');
          })
          .catch((error) => {
            addEntry('error', `Failed to copy to clipboard: ${error.message}`);
          });
      } catch (error) {
        addEntry('error', `Clipboard error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      return;
    }

    if (cmd === 'preview' || cmd === 'run' || cmd.startsWith('preview ') || cmd.startsWith('run ')) {
      // Check if user pasted code after the command
      const pastedCode = cmd.startsWith('preview ') 
        ? command.substring('preview '.length).trim()
        : cmd.startsWith('run ')
          ? command.substring('run '.length).trim()
          : '';

      if (pastedCode) {
        // User provided code directly - use it
        setPreviewCode(pastedCode);
        addEntry('system', '🚀 Opening code preview with your pasted code...');
        return;
      }

      // No pasted code - extract from last AI response
      const lastResponse = [...entries].reverse().find(entry => entry.type === 'response');
      
      if (!lastResponse) {
        addEntry('error', 'No AI response found. Please ask the AI to generate some code first, or use:\n\npreview <paste your HTML/CSS/JS here>');
        return;
      }

      // Extract code blocks from the response (markdown code blocks or HTML)
      const codeBlockRegex = /```(?:html|css|javascript|js)?\n([\s\S]*?)```/;
      const match = lastResponse.content.match(codeBlockRegex);
      
      if (match && match[1]) {
        setPreviewCode(match[1].trim());
        addEntry('system', '🚀 Opening code preview...');
      } else {
        // Try to find HTML tags directly in the response
        const htmlRegex = /<(?:html|!DOCTYPE|body|div|script|style)/i;
        if (htmlRegex.test(lastResponse.content)) {
          setPreviewCode(lastResponse.content);
          addEntry('system', '🚀 Opening code preview...');
        } else {
          addEntry('error', 'No code blocks found in the last response.\n\nAsk the AI to generate HTML, CSS, or JavaScript code, or use:\n\npreview <paste your code here>');
        }
      }
      return;
    }

    if (cmd === 'bookmark' || cmd.startsWith('bookmark ')) {
      const bookmarkCmd = cmd.substring('bookmark'.length).trim();
      
      if (!bookmarkCmd) {
        addEntry('error', 'Usage: bookmark <command> - Save a command as bookmark\nExample: bookmark weather San Francisco');
        return;
      }
      
      const bookmarks = JSON.parse(localStorage.getItem('terminal-bookmarks') || '[]');
      if (bookmarks.includes(bookmarkCmd)) {
        addEntry('error', `Command "${bookmarkCmd}" is already bookmarked.`);
        return;
      }
      
      bookmarks.push(bookmarkCmd);
      localStorage.setItem('terminal-bookmarks', JSON.stringify(bookmarks));
      addEntry('system', `🔖 Bookmarked: "${bookmarkCmd}"\n\nUse 'bookmarks' to view all bookmarks.`);
      return;
    }

    if (cmd === 'bookmarks') {
      const bookmarks = JSON.parse(localStorage.getItem('terminal-bookmarks') || '[]');
      
      if (bookmarks.length === 0) {
        addEntry('system', '📚 No bookmarks saved yet.\n\nUse "bookmark <command>" to save your favorite commands.\nExample: bookmark weather Tokyo');
        return;
      }
      
      const bookmarkList = bookmarks.map((bm: string, i: number) => `${i + 1}. ${bm}`).join('\n');
      addEntry('system', `📚 YOUR BOOKMARKS (${bookmarks.length}):\n\n${bookmarkList}\n\nType the command to run it, or use "bookmark-delete <number>" to remove.`);
      return;
    }

    if (cmd.startsWith('bookmark-delete ')) {
      const indexStr = cmd.substring('bookmark-delete '.length).trim();
      const index = parseInt(indexStr) - 1;
      
      const bookmarks = JSON.parse(localStorage.getItem('terminal-bookmarks') || '[]');
      
      if (isNaN(index) || index < 0 || index >= bookmarks.length) {
        addEntry('error', `Invalid bookmark number. Use "bookmarks" to see the list.`);
        return;
      }
      
      const deletedBookmark = bookmarks[index];
      bookmarks.splice(index, 1);
      localStorage.setItem('terminal-bookmarks', JSON.stringify(bookmarks));
      addEntry('system', `🗑️ Deleted bookmark: "${deletedBookmark}"`);
      return;
    }

    if (cmd === 'save' || cmd === 'save-response') {
      // Find the last response entry
      const lastResponse = [...entries].reverse().find(entry => entry.type === 'response');
      
      if (!lastResponse) {
        addEntry('error', 'No response to save. Please ask a question first.');
        return;
      }

      setIsTyping(true);
      addEntry('system', '💾 Saving response to knowledge base...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `archimedes-response-${timestamp}.txt`;

      fetch('/api/documents/save-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: lastResponse.content,
          filename: filename
        })
      })
        .then(async (res) => {
          setIsTyping(false);
          if (res.status === 401) {
            addEntry('error', 'Authentication required. Please log in to save responses.');
            return;
          }
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to save');
          }
          
          const data = await res.json();
          addEntry('system', `✅ Response saved successfully!\nFilename: ${data.document.originalName}\nSize: ${data.document.fileSize} bytes\n\nUse "docs" to view all saved documents.`);
        })
        .catch((error) => {
          setIsTyping(false);
          addEntry('error', `Failed to save response: ${error.message}`);
        });
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
  
Examples:
  stock quote AAPL
  stock quotes AAPL,MSFT,GOOGL
  stock info TSLA
  stock search Apple

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
      
      
      
      // If no valid subcommand, show help
      addEntry('error', 'Unknown stock command. Type "stock help" for available commands.');
      return;
    }

    // Scholar (Academic Paper Search) Commands
    if (cmd.startsWith('scholar ')) {
      const subCmd = cmd.substring(8).trim();
      
      if (subCmd === 'help') {
        addEntry('system', `Semantic Scholar Commands:

Academic Paper Search:
  scholar search <query> - Search for academic papers
  scholar details <paperId> - Get full paper details with abstract
  
Examples:
  scholar search quantum computing
  scholar search machine learning neural networks
  scholar details abc123xyz
  
Features:
  • Search 200M+ academic papers
  • View citations, authors, and publication info
  • Find open access PDFs
  • Completely FREE - no API key needed!
  
Data powered by Semantic Scholar API`);
        return;
      }
      
      if (subCmd.startsWith('search ')) {
        const query = subCmd.substring(7).trim();
        if (!query) {
          addEntry('error', 'Usage: scholar search <query>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `🔍 Searching Semantic Scholar for: "${query}"...`);
        
        fetch(`/api/scholar/search/${encodeURIComponent(query)}?limit=10`)
          .then(res => res.json())
          .then(data => {
            setIsTyping(false);
            if (data.error) {
              addEntry('error', `Search failed: ${data.error}`);
            } else {
              addEntry('response', data.formatted);
            }
          })
          .catch(error => {
            setIsTyping(false);
            addEntry('error', `Error searching papers: ${error.message}`);
          });
        return;
      }
      
      if (subCmd.startsWith('details ')) {
        const paperId = subCmd.substring(8).trim();
        if (!paperId) {
          addEntry('error', 'Usage: scholar details <paperId>');
          return;
        }
        
        setIsTyping(true);
        addEntry('system', `📄 Fetching paper details...`);
        
        fetch(`/api/scholar/paper/${encodeURIComponent(paperId)}`)
          .then(res => res.json())
          .then(data => {
            setIsTyping(false);
            if (data.error) {
              addEntry('error', `Failed to get details: ${data.error}`);
            } else {
              addEntry('response', data.formatted);
            }
          })
          .catch(error => {
            setIsTyping(false);
            addEntry('error', `Error fetching paper: ${error.message}`);
          });
        return;
      }
      
      // If no valid subcommand, show help
      addEntry('error', 'Unknown scholar command. Type "scholar help" for available commands.');
      return;
    }

    // Wolfram Alpha Query Command
    if (cmd.startsWith('query ')) {
      // Extract query from original command to preserve case
      const fullQuery = command.trim().substring(6).trim();
      
      // Show help
      if (fullQuery === 'help') {
        addEntry('system', `Wolfram Alpha Query Commands:

Computational Knowledge:
  query <search input> - Ask Wolfram Alpha anything
  query <search input> [options] - Query with additional parameters
  
Optional Parameters:
  --latlong=lat,long       Specify location coordinates (e.g., 40.7128,-74.0060)
  --units=metric           Use metric units (or nonmetric)
  --assumption="value"     Specify interpretation (use quotes for complex values)
  --location="value"       Provide location or IP address (use quotes for names)
  
Examples:
  query population of France
  query solve x^2 + 5x + 6 = 0
  query weather --latlong=40.7128,-74.0060
  query convert 100 km to miles --units=metric
  query weather --location="New York"
  query Mars --assumption="PlanetClass:Planet"
  query distance from earth to mars
  query integral of x^2 dx
  query what is the speed of light
  
Note: Use quotes around parameter values that contain spaces or special characters
  
Features:
  • Computational math and solving equations
  • Unit conversions and measurements
  • Scientific data and constants
  • Weather and location information
  • Real-time data and statistics
  
Powered by Wolfram Alpha Full Results API`);
        return;
      }
      
      if (!fullQuery) {
        addEntry('error', 'Usage: query <search input> [options]');
        addEntry('system', 'Type "query help" for detailed information and examples');
        return;
      }
      
      // Parse query and optional parameters with proper quote handling
      let query = '';
      const params: any = {};
      let i = 0;
      let quoteChar: string | null = null;  // Track which quote character opened the quoted section
      let currentToken = '';
      
      while (i < fullQuery.length) {
        const char = fullQuery[i];
        const prevChar = i > 0 ? fullQuery[i - 1] : '';
        
        // Only treat quotes as opening/closing when they follow '=' or are closing quotes
        const isQuoteAfterEquals = (char === '"' || char === "'") && prevChar === '=' && quoteChar === null;
        const isClosingQuote = char === quoteChar && quoteChar !== null;
        
        if (isQuoteAfterEquals) {
          // Opening quote (only after '=')
          quoteChar = char;
          currentToken += char;
          i++;
        } else if (isClosingQuote) {
          // Closing quote (matches the opening quote)
          quoteChar = null;
          currentToken += char;
          i++;
        } else if (char === ' ' && quoteChar === null) {
          // Process current token (only split on spaces outside quotes)
          if (currentToken.trim()) {
            if (currentToken.startsWith('--')) {
              // Parse parameter flag
              const match = currentToken.match(/^--(\w+)=(.+)$/);
              if (match) {
                const [, key, value] = match;
                // Remove matching quotes if present
                const cleanValue = value.replace(/^["'](.*)["']$/, '$1');
                if (key === 'latlong' || key === 'units' || key === 'assumption' || key === 'location') {
                  params[key] = cleanValue;
                }
              }
            } else {
              query += (query ? ' ' : '') + currentToken;
            }
          }
          currentToken = '';
          i++;
        } else {
          currentToken += char;
          i++;
        }
      }
      
      // Process final token
      if (currentToken.trim()) {
        if (currentToken.startsWith('--')) {
          const match = currentToken.match(/^--(\w+)=(.+)$/);
          if (match) {
            const [, key, value] = match;
            const cleanValue = value.replace(/^["'](.*)["']$/, '$1');
            if (key === 'latlong' || key === 'units' || key === 'assumption' || key === 'location') {
              params[key] = cleanValue;
            }
          }
        } else {
          query += (query ? ' ' : '') + currentToken;
        }
      }
      
      if (!query) {
        addEntry('error', 'No query text provided');
        return;
      }
      
      setIsTyping(true);
      
      // Build display message
      let displayMsg = `🔍 Querying Wolfram Alpha for: "${query}"`;
      if (Object.keys(params).length > 0) {
        const paramStr = Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        displayMsg += `\nParameters: ${paramStr}`;
      }
      addEntry('system', displayMsg);
      
      // Build URL with parameters
      let url = `/api/wolfram/query?q=${encodeURIComponent(query)}`;
      Object.entries(params).forEach(([key, value]) => {
        url += `&${key}=${encodeURIComponent(value as string)}`;
      });
      
      fetch(url)
        .then(res => res.json())
        .then(data => {
          setIsTyping(false);
          if (!data.success || data.error) {
            addEntry('error', `Query failed: ${data.error || 'No results found'}`);
          } else if (data.pods && data.pods.length > 0) {
            let formatted = '<div class="wolfram-results">';
            formatted += '<div style="border: 2px solid var(--terminal-highlight); padding: 10px; margin-bottom: 20px; border-radius: 4px;">';
            formatted += '<div style="text-align: center; font-weight: bold; color: var(--terminal-highlight); font-size: 16px;">WOLFRAM ALPHA QUERY RESULTS</div>';
            formatted += '</div>';
            
            data.pods.forEach((pod: any, index: number) => {
              if (pod.plaintext || (pod.subpods && pod.subpods.length > 0)) {
                formatted += `<div style="margin-bottom: 15px; border-left: 3px solid var(--terminal-highlight); padding-left: 10px;">`;
                formatted += `<div style="font-weight: bold; color: var(--terminal-highlight); margin-bottom: 5px;">${pod.title}</div>`;
                
                if (pod.subpods && pod.subpods.length > 0) {
                  pod.subpods.forEach((subpod: any) => {
                    // Render image if available
                    if (subpod.img && subpod.img.src) {
                      formatted += `<div style="margin: 10px 0;"><img src="${subpod.img.src}" alt="${subpod.img.alt || ''}" title="${subpod.img.title || ''}" style="max-width: 100%; height: auto; background: white; padding: 10px; border-radius: 4px; border: 1px solid var(--terminal-subtle);" /></div>`;
                    }
                    
                    // Render MathML if available
                    if (subpod.mathml) {
                      formatted += `<div class="mathml-content">${subpod.mathml}</div>`;
                    }
                    
                    // Render LaTeX if available
                    if (subpod.latex) {
                      formatted += `<div class="latex-content">$$${subpod.latex}$$</div>`;
                    }
                    
                    // Render plaintext
                    if (subpod.plaintext) {
                      const lines = subpod.plaintext.split('\n');
                      formatted += '<div style="margin: 5px 0;">';
                      lines.forEach((line: string) => {
                        if (line.trim()) {
                          formatted += `${line}<br/>`;
                        }
                      });
                      formatted += '</div>';
                    }
                  });
                } else if (pod.plaintext) {
                  const lines = pod.plaintext.split('\n');
                  formatted += '<div style="margin: 5px 0;">';
                  lines.forEach((line: string) => {
                    if (line.trim()) {
                      formatted += `${line}<br/>`;
                    }
                  });
                  formatted += '</div>';
                }
                
                formatted += '</div>';
              }
            });
            
            formatted += '<div style="margin-top: 20px; text-align: center; color: var(--terminal-subtle); font-size: 12px;">Powered by Wolfram Alpha</div>';
            formatted += '</div>';
            addEntry('response', formatted);
            
            // Trigger MathJax to typeset the new content after a brief delay
            setTimeout(() => {
              if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise().catch((err: any) => console.error('MathJax typeset error:', err));
              }
            }, 100);
          } else {
            addEntry('error', 'No results found for this query');
          }
        })
        .catch(error => {
          setIsTyping(false);
          addEntry('error', `Error querying Wolfram Alpha: ${error.message}`);
        });
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
      
      addEntry('system', `Opening telnet client for ${host}:${port}...`);
      
      // Open Sshwifty in a new window/tab
      const sshwiftyUrl = `/sshwifty?host=${encodeURIComponent(host)}&port=${port}&type=telnet`;
      window.open(sshwiftyUrl, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
      
      addEntry('system', `Telnet client opened in new window for ${host}:${port}`);
      return;
    }

    if (cmd.startsWith('ssh ')) {
      const parts = cmd.split(' ');
      if (parts.length < 2) {
        addEntry('error', 'Usage: ssh <user@host> [port]');
        return;
      }
      
      let userHost = parts[1];
      let port = 22; // Default SSH port
      
      if (parts[2]) {
        port = parseInt(parts[2]);
        if (isNaN(port) || port <= 0 || port > 65535) {
          addEntry('error', 'Invalid port number. Port must be between 1 and 65535.');
          return;
        }
      }
      
      // Parse user@host format
      const atIndex = userHost.indexOf('@');
      if (atIndex === -1) {
        addEntry('error', 'Usage: ssh <user@host> [port]');
        return;
      }
      
      const user = userHost.substring(0, atIndex);
      const host = userHost.substring(atIndex + 1);
      
      addEntry('system', `Opening SSH client for ${user}@${host}:${port}...`);
      
      // Open Sshwifty in a new window/tab
      const sshwiftyUrl = `/sshwifty?host=${encodeURIComponent(host)}&port=${port}&user=${encodeURIComponent(user)}&type=ssh`;
      window.open(sshwiftyUrl, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
      
      addEntry('system', `SSH client opened in new window for ${user}@${host}:${port}`);
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
    
    if (cmd === 'theharvester' || cmd === 'harvester') {
      addEntry('system', 'Launching theHarvester OSINT reconnaissance tool...');
      const openTheHarvester = (window as any).openTheHarvester;
      if (openTheHarvester) {
        openTheHarvester();
      } else {
        addEntry('error', 'theHarvester interface not available. Please ensure the OSINT tool is loaded.');
      }
      return;
    }

    if (cmd === 'mud') {
      addEntry('system', 'Launching MUD Client...');
      const openMudClient = (window as any).openMudClient;
      if (openMudClient) {
        openMudClient();
      } else {
        addEntry('error', 'MUD client not available. Please ensure the MUD system is loaded.');
      }
      return;
    }

    if (cmd === 'zork') {
      addEntry('system', 'Launching ZORK: The Great Underground Empire...');
      const openZorkGame = (window as any).openZorkGame;
      if (openZorkGame) {
        openZorkGame();
      } else {
        addEntry('error', 'ZORK game not available. Please ensure the game component is loaded.');
      }
      return;
    }

    if (cmd === 'spacewars') {
      addEntry('system', 'Launching SPACEWAR in new window...');
      try {
        const gameWindow = window.open('/spacewar.html?v=' + Date.now(), '_blank', 'width=1200,height=800,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no');
        if (gameWindow) {
          addEntry('system', 'SPACEWAR game launched successfully! Defend against the alien invasion!');
        } else {
          addEntry('error', 'Popup blocked! Please:');
          addEntry('system', '1. Allow popups for this site (check address bar for popup blocker icon)');
          addEntry('system', '2. Or manually open: ' + window.location.origin + '/spacewar.html?v=' + Date.now());
          addEntry('system', '3. Try holding Ctrl while running the command');
        }
      } catch (error) {
        addEntry('error', 'Error launching SPACEWAR: ' + (error as Error).message);
        addEntry('system', 'Manual link: ' + window.location.origin + '/spacewar.html?v=' + Date.now());
      }
      return;
    }

    // DTMF Decoder
    if (cmd === 'dtmf') {
      addEntry('system', 'Launching DTMF Decoder...');
      const openDTMFDecoder = (window as any).openDTMFDecoder;
      if (openDTMFDecoder) {
        openDTMFDecoder();
      } else {
        addEntry('error', 'DTMF decoder not available. Please ensure the decoder component is loaded.');
      }
      return;
    }

    // Radio Garden streaming commands
    if (cmd === 'radio') {
      // Show radio help when just "radio" is typed
      const helpText = 
        `📻 RADIO GARDEN - Global Live Radio Streams\\n\\n` +
        `Available Commands:\\n` +
        `radio play        - Open radio interface\\n` +
        `radio stop        - Stop current stream\\n` +
        `radio search <q>  - Search for stations\\n` +
        `radio random      - Get random station\\n` +
        `radio countries   - List countries\\n` +
        `radio volume <n>  - Set volume (0-100)\\n` +
        `radio status      - Check status\\n\\n` +
        `💡 Radio Garden provides access to thousands of live stations worldwide`;
      addEntry('system', helpText);
      return;
    }
    
    if (cmd.startsWith('radio ')) {
      const subCmd = cmd.substring(6).trim();
      
      if (subCmd === 'play') {
        const radioElement = document.querySelector('audio') as HTMLAudioElement;
        if (radioElement && radioElement.src) {
          // Set volume to 70% (reduced by 30%) before playing
          radioElement.volume = 0.7;
          radioElement.play()
            .then(() => addEntry('system', '🎵 Radio station playback started (volume: 70%)'))
            .catch(() => addEntry('error', 'Error: Unable to start radio stream'));
        } else {
          // Trigger radio interface to open
          const openRadioButton = document.querySelector('[data-testid="button-radio"]') as HTMLButtonElement;
          if (openRadioButton) {
            openRadioButton.click();
            addEntry('system', '📻 Opening Radio Garden interface...');
          } else {
            addEntry('error', 'Radio interface not available');
          }
        }
        return;
      }
      
      if (subCmd === 'stop') {
        const radioElement = document.querySelector('audio') as HTMLAudioElement;
        if (radioElement) {
          radioElement.pause();
          addEntry('system', '⏹️ Radio stream stopped');
        } else {
          addEntry('error', 'Radio is not currently active');
        }
        return;
      }
      
      if (subCmd.startsWith('search ')) {
        const query = subCmd.substring(7).trim();
        if (!query) {
          addEntry('error', 'Usage: radio search <station name or location>');
          return;
        }
        
        addEntry('system', `🔍 Searching Radio Garden for: "${query}"`);
        
        fetch(`/api/radio/search?q=${encodeURIComponent(query)}&limit=5`)
          .then(res => res.json())
          .then(stations => {
            if (stations.length === 0) {
              addEntry('system', 'No stations found for that search');
            } else {
              let result = `📻 Found ${stations.length} stations:\\n\\n`;
              stations.forEach((station: any, index: number) => {
                result += `${index + 1}. ${station.title}\\n`;
                result += `   📍 ${station.place}, ${station.country}\\n`;
                if (index < stations.length - 1) result += '\\n';
              });
              result += '\\n💡 Use "radio play" to open the radio interface and select a station';
              addEntry('system', result);
            }
          })
          .catch(() => {
            addEntry('error', 'Radio Garden search failed');
          });
        return;
      }
      
      if (subCmd === 'random') {
        addEntry('system', '🎲 Getting random station from Radio Garden...');
        
        fetch('/api/radio/random')
          .then(res => res.json())
          .then(station => {
            const result = `📻 Random Station Found:\\n\\n🎵 ${station.title}\\n📍 ${station.place.title}, ${station.place.country}\\n\\n💡 Use "radio play" to open the radio interface`;
            addEntry('system', result);
          })
          .catch(() => {
            addEntry('error', 'Failed to get random station');
          });
        return;
      }
      
      if (subCmd.startsWith('volume ')) {
        const volumeStr = subCmd.substring(7).trim();
        const volumeNum = parseFloat(volumeStr);
        
        if (isNaN(volumeNum) || volumeNum < 0 || volumeNum > 100) {
          addEntry('error', 'Usage: radio volume <0-100>');
          return;
        }
        
        const radioElement = document.querySelector('audio') as HTMLAudioElement;
        if (radioElement) {
          // Apply 30% reduction to the requested volume
          const reducedVolume = (volumeNum * 0.7) / 100;
          radioElement.volume = reducedVolume;
          addEntry('system', `🔊 Volume set to ${volumeNum}% (reduced by 30% = ${Math.round(reducedVolume * 100)}%)`);
        } else {
          addEntry('error', 'Radio is not currently active');
        }
        return;
      }
      
      if (subCmd === 'status') {
        const radioElement = document.querySelector('audio') as HTMLAudioElement;
        if (radioElement && radioElement.src) {
          const isPlaying = !radioElement.paused;
          const volume = Math.round(radioElement.volume * 100);
          const status = `📻 Radio Garden Status: ${isPlaying ? 'Streaming 🎵' : 'Stopped ⏹️'}\\nVolume: ${volume}%\\nConnection: ${radioElement.readyState >= 2 ? 'Ready' : 'Loading...'}\\n\\n💡 Use the radio interface to see current station details`;
          addEntry('system', status);
        } else {
          addEntry('system', `📻 Radio Garden Status: Inactive\\n\\n💡 Use "radio play" to access thousands of global stations`);
        }
        return;
      }
      
      if (subCmd === 'countries') {
        addEntry('system', '🌍 Getting countries with radio stations...');
        
        fetch('/api/radio/countries')
          .then(res => res.json())
          .then(countries => {
            let result = '🌍 Top countries with radio stations:\\n\\n';
            countries.slice(0, 10).forEach((country: any, index: number) => {
              result += `${index + 1}. ${country.country} (${country.count} stations)\\n`;
            });
            result += '\\n💡 Use "radio search <country>" to find stations';
            addEntry('system', result);
          })
          .catch(() => {
            addEntry('error', 'Failed to get country list');
          });
        return;
      }
      
      // Help command
      if (subCmd === '' || subCmd === 'help') {
        const helpText = `📻 Radio Garden Commands:\\n\\n` +
          `radio play        - Open radio interface\\n` +
          `radio stop        - Stop current stream\\n` +
          `radio search <q>  - Search for stations\\n` +
          `radio random      - Get random station\\n` +
          `radio countries   - List countries\\n` +
          `radio volume <n>  - Set volume (0-100)\\n` +
          `radio status      - Check status\\n\\n` +
          `💡 Radio Garden provides access to thousands of live stations worldwide`;
        addEntry('system', helpText);
        return;
      }
      
      addEntry('error', 'Unknown radio command. Use "radio help" for available commands');
      return;
    }
    
    // Handle OSINT commands
    if (cmd.startsWith('whois ')) {
      const domain = cmd.substring(6).trim();
      if (!domain) {
        addEntry('error', 'Usage: whois <domain>');
        return;
      }
      
      addEntry('system', `🔍 Performing WHOIS lookup for ${domain}...`);
      
      fetch(`/api/osint/whois/${domain}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'WHOIS lookup failed');
        });
      return;
    }
    
    if (cmd.startsWith('dns ')) {
      const domain = cmd.substring(4).trim();
      if (!domain) {
        addEntry('error', 'Usage: dns <domain>');
        return;
      }
      
      addEntry('system', `🌐 Querying DNS records for ${domain}...`);
      
      fetch(`/api/osint/dns/${domain}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'DNS lookup failed');
        });
      return;
    }
    
    if (cmd.startsWith('geoip ')) {
      const ip = cmd.substring(6).trim();
      if (!ip) {
        addEntry('error', 'Usage: geoip <ip_address>');
        return;
      }
      
      addEntry('system', `🌍 Geolocating IP address ${ip}...`);
      
      fetch(`/api/osint/geoip/${ip}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'IP geolocation failed');
        });
      return;
    }
    
    if (cmd.startsWith('headers ')) {
      const url = cmd.substring(8).trim();
      if (!url) {
        addEntry('error', 'Usage: headers <url>');
        return;
      }
      
      addEntry('system', `🔍 Analyzing HTTP headers for ${url}...`);
      
      fetch(`/api/osint/headers?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'Header analysis failed');
        });
      return;
    }
    
    if (cmd.startsWith('wayback ')) {
      const url = cmd.substring(8).trim();
      if (!url) {
        addEntry('error', 'Usage: wayback <url>');
        return;
      }
      
      addEntry('system', `📚 Searching Wayback Machine for ${url}...`);
      
      fetch(`/api/osint/wayback?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'Wayback Machine search failed');
        });
      return;
    }
    
    if (cmd.startsWith('username ')) {
      const username = cmd.substring(9).trim();
      if (!username) {
        addEntry('error', 'Usage: username <username>');
        return;
      }
      
      addEntry('system', `👤 Checking username availability for ${username}...`);
      
      fetch(`/api/osint/username/${username}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'Username check failed');
        });
      return;
    }
    
    if (cmd.startsWith('traceroute ')) {
      const target = cmd.substring(11).trim();
      if (!target) {
        addEntry('error', 'Usage: traceroute <ip_or_domain>');
        return;
      }
      
      addEntry('system', `🛤️ Tracing network path to ${target}...`);
      
      fetch(`/api/osint/traceroute/${target}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'Traceroute failed');
        });
      return;
    }
    
    if (cmd.startsWith('subdomains ')) {
      const domain = cmd.substring(11).trim();
      if (!domain) {
        addEntry('error', 'Usage: subdomains <domain>');
        return;
      }
      
      addEntry('system', `🌐 Enumerating subdomains for ${domain}...`);
      
      fetch(`/api/osint/subdomains/${domain}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'Subdomain enumeration failed');
        });
      return;
    }
    
    if (cmd.startsWith('ssl ')) {
      const domain = cmd.substring(4).trim();
      if (!domain) {
        addEntry('error', 'Usage: ssl <domain>');
        return;
      }
      
      addEntry('system', `🔒 Analyzing SSL certificate for ${domain}...`);
      
      fetch(`/api/osint/ssl/${domain}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'SSL analysis failed');
        });
      return;
    }
    
    if (cmd.startsWith('tech ')) {
      const domain = cmd.substring(5).trim();
      if (!domain) {
        addEntry('error', 'Usage: tech <domain>');
        return;
      }
      
      addEntry('system', `⚙️ Detecting technology stack for ${domain}...`);
      
      fetch(`/api/osint/tech/${domain}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'Technology detection failed');
        });
      return;
    }
    
    if (cmd.startsWith('reverse-ip ')) {
      const ip = cmd.substring(11).trim();
      if (!ip) {
        addEntry('error', 'Usage: reverse-ip <ip_address>');
        return;
      }
      
      addEntry('system', `🔄 Performing reverse IP lookup for ${ip}...`);
      
      fetch(`/api/osint/reverse-ip/${ip}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'Reverse IP lookup failed');
        });
      return;
    }
    
    if (cmd.startsWith('portscan ')) {
      const target = cmd.substring(9).trim();
      if (!target) {
        addEntry('error', 'Usage: portscan <ip_or_domain>');
        return;
      }
      
      addEntry('system', `🛡️ Scanning ports on ${target}...`);
      
      fetch(`/api/osint/portscan/${target}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'Port scan failed');
        });
      return;
    }
    
    if (cmd.startsWith('osint-report ')) {
      const target = cmd.substring(13).trim();
      if (!target) {
        addEntry('error', 'Usage: osint-report <domain_or_ip>');
        return;
      }
      
      addEntry('system', `📋 Generating comprehensive OSINT report for ${target}...`);
      addEntry('system', 'This may take a moment as we gather intelligence from multiple sources...');
      
      fetch(`/api/osint/report/${target}`)
        .then(res => res.json())
        .then(data => {
          addEntry('response', data.formatted);
        })
        .catch(() => {
          addEntry('error', 'OSINT report generation failed');
        });
      return;
    }

    if (cmd.startsWith('threat-actors')) {
      if (cmd === 'threat-actors') {
        addEntry('system', '🎯 Fetching MISP Galaxy threat actor intelligence...');
        addEntry('system', 'This may take a moment as we retrieve current threat data...');
        
        fetch('/api/osint/threat-actors')
          .then(res => res.json())
          .then(data => {
            addEntry('response', data.formatted);
          })
          .catch(() => {
            addEntry('error', 'Failed to fetch threat actor intelligence');
          });
        return;
      }
      
      const actorName = cmd.substring(13).trim();
      if (!actorName) {
        addEntry('error', 'Usage: threat-actors <name> or just threat-actors for all actors');
        return;
      }
      
      addEntry('system', `🎯 Looking up threat actor: ${actorName}...`);
      addEntry('system', 'Searching MISP Galaxy intelligence database...');
      
      fetch(`/api/osint/threat-actors/${encodeURIComponent(actorName)}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            addEntry('error', data.error);
            if (data.suggestion) {
              addEntry('system', `💡 ${data.suggestion}`);
            }
          } else {
            addEntry('response', data.formatted);
          }
        })
        .catch(() => {
          addEntry('error', 'Failed to lookup threat actor');
        });
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
    previewCode,
    setPreviewCode,
  };
}
