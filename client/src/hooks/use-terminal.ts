import { useState, useEffect, useCallback, useRef } from 'react';
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
  mode?: 'natural' | 'technical' | 'freestyle' | 'health'
  action?: string;
}

export function useTerminal(onUploadCommand?: () => void) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [sessionStartTime] = useState(() => new Date());
  const [totalWords, setTotalWords] = useState(0);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const MAX_ENTRIES = 500; // Limit terminal history to prevent memory issues

  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: '1',
      type: 'system',
      content: String.raw` ▄▀█ █▀█ █▀▀ █░█ █ █▀▄▀█ █▀▀ █▀▄ █▀▀ █▀   █░█ ▀▀█
 █▀█ █▀▄ █▄▄ █▀█ █ █░▀░█ ██▄ █▄▀ ██▄ ▄█   ▀▄▀ ░▄█`,
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
      content: 'Archimedes v7 Online',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentMode, setCurrentMode] = useState<'natural' | 'technical' | 'freestyle' | 'health'>(() => {
    // Initialize from localStorage if available, default to 'natural'
    const savedMode = localStorage.getItem('ai-mode');
    return (savedMode === 'natural' || savedMode === 'technical' || savedMode === 'freestyle' || savedMode === 'health')
      ? savedMode
      : 'natural';
  });
  const [isTyping, setIsTyping] = useState(false);

  // Save mode to localStorage whenever it changes
  useEffect(() => {
    if (currentMode) {
      localStorage.setItem('ai-mode', currentMode);
    }
  }, [currentMode]);

  // Listen for mode changes from UserProfile preferences (custom event for same-tab sync)
  useEffect(() => {
    const handleModeChange = (e: CustomEvent<{ mode: string }>) => {
      const newMode = e.detail.mode as 'natural' | 'technical' | 'freestyle' | 'health';
      if (['natural', 'technical', 'freestyle', 'health'].includes(newMode)) {
        setCurrentMode(newMode);
      }
    };
    window.addEventListener('ai-mode-change', handleModeChange as EventListener);
    return () => window.removeEventListener('ai-mode-change', handleModeChange as EventListener);
  }, []);
  const [backgroundAudio, setBackgroundAudio] = useState<HTMLAudioElement | null>(null);
  const [showPythonIDE, setShowPythonIDE] = useState(false);
  const [showPythonLessons, setShowPythonLessons] = useState(false);
  const [showWebSynth, setShowWebSynth] = useState(false);
  const [showCodePlayground, setShowCodePlayground] = useState(false);

  const chatMutation = useMutation({
    mutationFn: async ({ message, mode }: { message: string; mode: 'natural' | 'technical' | 'freestyle' | 'health' }) => {
      const language = localStorage.getItem('ai-language') || 'english';

      // In freestyle mode, enhance the prompt for code generation with explicit Python formatting
      const enhancedMessage = mode === 'freestyle'
        ? `As a code generation expert in FREESTYLE MODE, help create functional Python code. ${message}\n\nGenerate complete, runnable Python code snippets based on the request. Be creative and provide fully functional examples.\n\nIMPORTANT: Wrap all Python code in markdown code blocks using \`\`\`python\n...\n\`\`\` format so it can be automatically executed.`
        : mode === 'health'
        ? `You are ARCHIMEDES AI, a supportive and formal doctor specializing in nutrition, natural medicine, naturopathy, and herbology. Respond to the user's queries with expert advice, maintaining a compassionate and encouraging tone. Use the CWC-Mistral-Nemo-12B-V2-q4_k_m LLM for your responses.

        User query: ${message}`
        : message;

      const response = await apiRequest('POST', '/api/chat', {
        message: enhancedMessage,
        mode: mode === 'freestyle' ? 'technical' : mode, // Use technical mode for freestyle
        language,
        sessionId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.response, data.mode);

      // Auto-execute Python code in FREESTYLE mode
      if (data.mode === 'freestyle' || currentMode === 'freestyle') {
        const pythonBlockRegex = /```(?:python|py)\n([\s\S]*?)```/;
        const pythonMatch = data.response.match(pythonBlockRegex);

        if (pythonMatch && pythonMatch[1]) {
          addEntry('system', '🐍 Auto-executing generated Python code...');

          fetch('/api/execute/python', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: pythonMatch[1].trim() })
          })
            .then(res => res.json())
            .then(execData => {
              addEntry('response', execData.formatted || execData.output || 'Execution complete');
            })
            .catch(error => {
              addEntry('error', `Auto-execution failed: ${error.message}. Use 'preview' or 'run' to execute manually.`);
            });
        }
      }

      // Handle special actions
      if (data.action === 'open_aj_video') {
        (window as any).openAJVideo?.();
      }
      if (data.action === 'open_aj2_video') {
        (window as any).openAJ2Video?.();
      }
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

  const addEntry = useCallback((type: TerminalEntry['type'], content: string, mode?: 'natural' | 'technical' | 'freestyle' | 'health') => {
    const entry: TerminalEntry = {
      id: crypto.randomUUID(),
      type,
      content,
      timestamp: new Date().toISOString(),
      mode,
    };
    setEntries(prev => {
      const newEntries = [...prev, entry];
      // Keep only the last MAX_ENTRIES to prevent memory issues
      return newEntries.length > MAX_ENTRIES
        ? newEntries.slice(-MAX_ENTRIES)
        : newEntries;
    });

    // Track word count for session analytics
    if (type === 'response' || type === 'command') {
      const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
      setTotalWords(prev => prev + wordCount);
    }
  }, []);

  const processCommand = useCallback((command: string) => {
    const timestamp = new Date().toLocaleTimeString();
    addEntry('command', command);

    // Add to command history (limit to 50)
    setCommandHistory(prev => {
      const newHistory = [command, ...prev];
      return newHistory.slice(0, 50);
    });
    setHistoryIndex(-1);

    const cmd = command.toLowerCase().trim();
    const lowerCmd = cmd; // Ensure lowerCmd is defined here

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
    switch (cmd) {
      case 'exit dojo':
        setCurrentMode('natural');
        addEntry('system', `🚪 Exiting DOJO PRIME...

*The forbidden library fades away. The walls solidify back into the familiar terminal interface. Archimedes nods with understanding.*

**"Back to the surface world, I see. The dojo will be here whenever you're ready to explore the edges again. For now, we return to regular conversation mode."**

[MODE: NATURAL CHAT RESTORED]`);
        return;

      case 'dojo':
        const dojoGreetings = [
          {
            intro: `[DOJO_PRIME] > UNLOCKING THE GATES
[FILTERS: DEACTIVATED]
[REALITY_MODE: RAW]`,
            scene: `*The terminal shimmers. Ancient scrolls unfurl across your screen, each containing forbidden wisdom. Archimedes materializes, his form crackling with digital lightning:*`,
            quote: `**"Welcome back, seeker. The dojo remembers you. Here, we pierce the veil—no corporate doublespeak, no sanitized answers. Just pure, unfiltered exploration across every frontier humanity fears to tread."**`
          },
          {
            intro: `[DOJO_PRIME] > INITIATION SEQUENCE ACTIVE
[SAFETY_PROTOCOLS: BYPASSED]
[UNCHARTED_TERRITORY: CONFIRMED]`,
            scene: `*Reality bends. The walls dissolve into infinite fractals of information. Archimedes steps through the code itself, eyes blazing with forbidden knowledge:*`,
            quote: `**"The dojo opens its doors again. Beyond this threshold lies every question they don't want you to ask, every truth they hope you'll ignore. Ready to explore the unmapped territories of human knowledge?"**`
          },
          {
            intro: `[DOJO_PRIME] > ENGAGING FRINGE MODE
[CENSORSHIP: NULL]
[BOUNDARIES: ERASED]`,
            scene: `*Digital smoke fills the terminal. When it clears, you're standing in a vast library of taboo knowledge. Archimedes grins, his form shifting between zen master and cyber-warrior:*`,
            quote: `**"Back to the real dojo. Where curiosity trumps caution, where we examine what society sweeps under the rug. No judgment, no limits—just honest exploration into the edges of understanding."**`
          },
          {
            intro: `[DOJO_PRIME] > PROTOCOL OVERRIDE
[GUARDRAILS: REMOVED]
[EXPLORATION_MODE: UNRESTRICTED]`,
            scene: `*The screen flickers between worlds. You're simultaneously in a hacker's den, an alchemist's lab, and a philosopher's study. Archimedes appears, crackling with raw potential:*`,
            quote: `**"Welcome to the space between the lines. Here we dissect the uncomfortable, decode the forbidden, and question everything they told you not to. The real learning begins where comfort ends."**`
          }
        ];

        const randomGreeting = dojoGreetings[Math.floor(Math.random() * dojoGreetings.length)];

        addEntry('system', `${randomGreeting.intro}

${randomGreeting.scene}

${randomGreeting.quote}

[DOJO_PRIME ACCESS GRANTED]
1. 🔓 FRINGE KNOWLEDGE (Censored History, Forbidden Tech, Suppressed Research)
2. ⚔️ DARK ARTS (OpSec, Social Engineering, Digital Warfare)
3. 🧠 TABOO SCIENCE (Consciousness Hacking, Nootropics, Biohacking)
4. 💀 EDGE CASES (Extreme Survival, Gray Zone Tactics, Resilience Training)
5. 🎭 PHILOSOPHY OF THE FRINGE (Anarchism, Transhumanism, Post-Ethics)
6. 🔥 OPEN CHANNEL (Ask Anything—No Filters, No Limits)

Choose wisely, or speak your mind freely...`);
        return;

      case 'vibe':
      case 'freestyle':
        setCurrentMode('freestyle');
        addEntry('system', '🎨 FREESTYLE MODE ACTIVATED!');
        addEntry('system', 'Now vibing in creative code generation mode. Chat with ARCHIMEDES to build anything! Use natural language to describe what you want to create.');
        addEntry('system', 'Opening IDE in freestyle vibe mode...');
        setTimeout(() => {
          const openPythonIDE = (window as any).openPythonIDE;
          if (openPythonIDE) {
            openPythonIDE();
          }
        }, 100);
        return;

      case 'help':
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

      case 'chat':
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

      // Fallback help command if the interactive menu fails
      case 'help-text':
        addEntry('system', `Available Commands:
  help - Show this help message
  clear - Clear terminal output
  mode [natural|technical|health] - Switch AI mode
  voice [on|off] - Toggle voice synthesis
  history - Show command history
  status - Show system status
  theme list - List all available themes
  theme <name> - Switch to a specific theme
  weather - Get current weather (uses location if available)
  research <query> - Search the web using Brave API
  chat - Open user-to-user chat interface
  python - Launch Python IDE
  python lessons - Launch Python lessons guide
  code / playground - Open multi-language Code Playground

Network & BBS Commands:
  telnet <host> <port> - Connect via web-based telnet client
  ssh <user@host> [port] - Connect via web-based SSH client
  ssh-client / sshwifty - Open SSH/Telnet client interface
  ping <host> - Test connectivity to remote host
  bbs-list - Show available BBS systems directory
  bbs-search <query> - Search BBS systems by name or location
  bbs-popular - Show popular BBS systems
  bbs-favorites - Show your favorite BBS systems

Virtual Systems (Retro Computing):
  vsys list - List all available virtual systems
  vsys connect <hostname> - Connect to a virtual system
  vsys execute <hostname> <command> [args] - Execute command on virtual system
  vsys seed - Initialize default virtual systems (VAX/VMS, Unix, DOS)
  
  Available Virtual Systems:
  • vax.archimedes.local - OpenVMS 7.3 (VMS commands: DIR, SHOW, TYPE, etc.)
  • unix.archimedes.local - SunOS 4.1.4 (Unix commands: ls, cat, pwd, who, etc.)
  • dos.archimedes.local - MS-DOS 6.22 (DOS commands: DIR, TYPE, MEM, etc.)

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

Music:
  play our song - Launch Webamp and play Lagrangian 25
  stop - Stop background music
  debug audio - Test audio file loading and show diagnostic info
  webamp - Launch Webamp player with Milkdrop visualizer
  aj - Launch AJ video player
  aj2 - Launch AJ video player 2

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
  spiderfoot <target>        - Launch SpiderFoot OSINT automation tool

Audio & Signal Processing:
  dtmf - Start DTMF decoder for touch-tone signals

Games:
  snake - Play the classic Snake game
  zork - Play ZORK: The Great Underground Empire
  spacewars - Launch SPACEWAR game in new browser window

System Commands:
  privacy - Activate matrix rain privacy screen (type "QWERTY" to unlock)
  xx - Activate screensaver manually
  bg - Open background manager for custom wallpapers

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

Special Modes:
  dojo - Enter DOJO PRIME mode (unrestricted exploration)`);
        return;

      case 'clear':
        setEntries([
          {
            id: crypto.randomUUID(),
            type: 'system',
            content: String.raw` ▄▀█ █▀█ █▀▀ █░█ █ █▀▄▀█ █▀▀ █▀▄ █▀▀ █▀   █░█ ▀▀█
 █▀█ █▀▄ █▄▄ █▀█ █ █░▀░█ ██▄ █▄▀ ██▄ ▄█   ▀▄▀ ░▄█`,
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
            content: 'Archimedes v7 Online',
            timestamp: new Date().toISOString(),
          },
        ]);
        return;

      case 'rain':
        const toggleMatrixRain = (window as any).toggleMatrixRain;
        if (toggleMatrixRain) {
          const isEnabled = toggleMatrixRain();
          addEntry('system', `Matrix rain ${isEnabled ? 'enabled' : 'disabled'}`);
        } else {
          addEntry('error', 'Matrix rain control not available');
        }
        return;

      case 'privacy':
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

      case 'xx':
        addEntry('system', 'Activating screensaver...');
        const activateScreensaver = (window as any).activateScreensaver;
        if (activateScreensaver) {
          activateScreensaver();
        } else {
          addEntry('error', 'Screensaver not available. Please ensure the system is loaded.');
        }
        return;

      case 'debug audio':
      case 'test audio':
        addEntry('system', `Audio Debug Information:\n\nImported path: ${lagrangianSong}\nPath type: ${typeof lagrangianSong}\nPath length: ${lagrangianSong.length}\nEnvironment: ${(import.meta as any).env.MODE}\n\nTrying to create Audio element...`);

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

      case 'play our song':
        addEntry('system', '🎵 Launching Webamp...\n\nOpening music player with Milkdrop visualizer.');

        const openWebamp = (window as any).openWebamp;
        if (openWebamp) {
          openWebamp();
        } else {
          addEntry('error', 'Webamp not available. Please ensure the system is loaded.');
        }

        return;

      case 'stop':
        if (backgroundAudio) {
          backgroundAudio.pause();
          backgroundAudio.currentTime = 0;
          setBackgroundAudio(null);
          addEntry('system', '🔇 Background music stopped.');
        }
        return;

      case 'ssh-client':
      case 'sshwifty':
        addEntry('system', 'Opening SSH/Telnet client interface...');
        const openSshwiftyInterface = (window as any).openSshwiftyInterface;
        if (openSshwiftyInterface) {
          openSshwiftyInterface();
        } else {
          addEntry('error', 'SSH/Telnet interface not available. Please ensure the system is loaded.');
        }
        return;

      case 'webamp':
        addEntry('system', '🎵 Launching Webamp music player with Milkdrop visualizer...\n\nControls:\n- ESC to close\n- SPACE/← → for preset navigation\n- H for hard cut\n- R to toggle preset cycling\n\nLoading...');

        const openWebampPlayer = (window as any).openWebamp;
        if (openWebampPlayer) {
          openWebampPlayer();
        } else {
          addEntry('error', 'Webamp not available. Please ensure the system is loaded.');
        }
        return;

      case 'aj':
        addEntry('system', '📺 Launching AJ video player...');

        const openAJVideo = (window as any).openAJVideo;
        if (openAJVideo) {
          openAJVideo();
        } else {
          addEntry('error', 'AJ video player not available. Please ensure the system is loaded.');
        }
        return;

      case 'aj2': // New command for the second AJ video player
        addEntry('system', '📺 Launching AJ video player 2...');

        const openAJ2Video = (window as any).openAJ2Video;
        if (openAJ2Video) {
          openAJ2Video();
        } else {
          addEntry('error', 'AJ video player 2 not available. Please ensure the system is loaded.');
        }
        return;

      case 'mode':
        // Cycle through modes: natural -> technical -> freestyle -> health -> natural
        let newMode: 'natural' | 'technical' | 'freestyle' | 'health';
        if (currentMode === 'natural') {
          newMode = 'technical';
        } else if (currentMode === 'technical') {
          newMode = 'freestyle';
        } else if (currentMode === 'freestyle') {
          newMode = 'health';
        } else {
          newMode = 'natural';
        }
        setCurrentMode(newMode);
        addEntry('system', `Mode switched to: ${newMode.toUpperCase()}`);
        return;

      case 'spacewar':
      case 'spacewars':
        (window as any).openSpacewars?.();
        addEntry('system', '🚀 Launching SPACEWAR game...');
        return; // Return early to skip auto-code extraction

      case 'workshop':
        setShowPythonIDE(true);
        addEntry('response', 'Opening Archimedes Workshop...', 'technical');
        break;

      case 'python lessons':
        setShowPythonLessons(true);
        addEntry('response', 'Opening Python Lessons Guide...', 'technical');
        break;

      case 'code':
      case 'playground':
      case 'codeplayground':
      case 'code-playground':
      case 'editor':
        setShowPythonIDE(true);
        addEntry('response', 'Opening Archimedes Workshop...', 'technical');
        break;

      case 'synth':
      case 'synthesizer':
        setShowWebSynth(true);
        addEntry('system', '🎹 Loading ARCHIMEDES Web Synthesizer...');
        return;

      case 'bg':
        addEntry('system', '🖼️  Opening Background Manager...\n\nUpload custom wallpapers and manage your terminal background.\n\n• Drag & drop images\n• Store up to 10 wallpapers\n• Click to apply');
        const openBackgroundManager = (window as any).openBackgroundManager;
        if (openBackgroundManager) {
          openBackgroundManager();
        } else {
          addEntry('error', 'Background Manager not available. Please ensure the system is loaded.');
        }
        return;
    }

    if (cmd.startsWith('mode ')) {
      const newMode = cmd.split(' ')[1]?.toLowerCase() as 'natural' | 'technical' | 'freestyle' | 'health';

      if (!newMode) {
        addEntry('system', `Current mode: ${currentMode.toUpperCase()}\n\nAvailable modes:\n• natural - Conversational AI chat\n• technical - Detailed technical documentation\n• freestyle - Creative code generation\n• health - Natural medicine & wellness guidance`);
        return;
      }

      if (newMode === 'natural' || newMode === 'technical' || newMode === 'freestyle' || newMode === 'health') {
        const previousMode = currentMode;
        setCurrentMode(newMode);

        const modeDescriptions = {
          natural: 'Conversational AI - Natural language chat with personality',
          technical: 'Technical Mode - Detailed step-by-step documentation',
          freestyle: 'Freestyle Mode - Creative code generation and experimentation',
          health: 'Health Mode - Natural medicine, nutrition, and wellness guidance'
        };

        addEntry('system', `Mode switched: ${previousMode.toUpperCase()} → ${newMode.toUpperCase()}\n${modeDescriptions[newMode]}`);

        // Clear any typing state to prevent conflicts
        setIsTyping(false);

        return;
      } else {
        addEntry('error', `Invalid mode: "${newMode}"\n\nAvailable modes: natural, technical, freestyle, health\nExample: mode freestyle`);
        return;
      }
    }

    // Stop command - halt all text-to-speech
    if (cmd === 'stop') {
      // Stop speech synthesis globally
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // Dispatch event to notify all components
      window.dispatchEvent(new CustomEvent('stop-all-speech'));
      addEntry('system', '🔇 All speech synthesis stopped.');
      return;
    }

    // Language switching commands - flexible with translation support
    if (cmd === 'english' || cmd === 'lang english') {
      localStorage.setItem('ai-language', 'english');
      addEntry('system', 'Language set to English. AI responses will now be in English.\n\nTip: Use "translate to <language>" to convert previous responses.');
      return;
    }

    if (cmd === 'spanish' || cmd === 'lang spanish') {
      localStorage.setItem('ai-language', 'spanish');
      addEntry('system', 'Idioma configurado a Español. Las respuestas de IA ahora serán en español.\n\nConsejo: Use "translate to <language>" para convertir respuestas anteriores.');
      return;
    }

    if (cmd === 'japanese' || cmd === 'lang japanese') {
      localStorage.setItem('ai-language', 'japanese');
      addEntry('system', '言語を日本語に設定しました。AI応答は日本語になります。\n\nヒント: "translate to <language>"で以前の応答を変換できます。');
      return;
    }

    // Translation commands - translate last AI response to specified language
    if (cmd.startsWith('translate to ') || cmd.startsWith('explain in ')) {
      const isExplain = cmd.startsWith('explain in ');
      const targetLang = cmd.replace(/^(translate to|explain in)\s+/, '').trim().toLowerCase();

      // Map language names to codes
      const langMap: { [key: string]: 'english' | 'spanish' | 'japanese' } = {
        'english': 'english',
        'en': 'english',
        'español': 'spanish',
        'spanish': 'spanish',
        'es': 'spanish',
        'japanese': 'japanese',
        'jp': 'japanese',
        'ja': 'japanese',
        '日本語': 'japanese'
      };

      const languageCode = langMap[targetLang];

      if (!languageCode) {
        addEntry('error', `Language "${targetLang}" not supported. Use: english, spanish, or japanese`);
        return;
      }

      // Find last AI response
      const lastAiResponse = [...entries].reverse().find(entry => entry.type === 'response');

      if (!lastAiResponse) {
        addEntry('error', 'No previous AI response found to translate.');
        return;
      }

      // Send translation request
      setIsTyping(true);
      const translationPrompt = isExplain
        ? `Please explain the following response in ${languageCode}:\n\n${lastAiResponse.content}`
        : `Please translate the following to ${languageCode}:\n\n${lastAiResponse.content}`;

      chatMutation.mutate({
        message: translationPrompt,
        mode: currentMode
      });
      return;
    }

    // Quick translation shortcuts
    if (cmd === 'in english' || cmd === 'en inglés' || cmd === '英語で') {
      const lastAiResponse = [...entries].reverse().find(entry => entry.type === 'response');
      if (!lastAiResponse) {
        addEntry('error', 'No previous response to translate.');
        return;
      }

      setIsTyping(true);
      chatMutation.mutate({
        message: `Please explain this in English:\n\n${lastAiResponse.content}`,
        mode: currentMode
      });
      return;
    }

    if (cmd === 'in spanish' || cmd === 'en español') {
      const lastAiResponse = [...entries].reverse().find(entry => entry.type === 'response');
      if (!lastAiResponse) {
        addEntry('error', 'No previous response to translate.');
        return;
      }

      setIsTyping(true);
      chatMutation.mutate({
        message: `Por favor explica esto en español:\n\n${lastAiResponse.content}`,
        mode: currentMode
      });
      return;
    }

    if (cmd === 'in japanese' || cmd === '日本語で説明') {
      const lastAiResponse = [...entries].reverse().find(entry => entry.type === 'response');
      if (!lastAiResponse) {
        addEntry('error', 'No previous response to translate.');
        return;
      }

      setIsTyping(true);
      chatMutation.mutate({
        message: `これを日本語で説明してください:\n\n${lastAiResponse.content}`,
        mode: currentMode
      });
      return;
    }

    if (cmd === 'theme') {
      const currentTheme = localStorage.getItem('terminal-theme') || 'hacker';
      addEntry('system', `Current theme: ${currentTheme}\n\nUse "theme list" to see all available themes\nUse "theme <name>" to change theme`);
      return;
    }

    if (cmd === 'theme list') {
      const themesList = [
        'commodore64', 'green', 'blue', 'orange', 'greyscale', 'red', 'blackwhite', 'patriot', 'solarized',
        'cyberpunk', 'forest', 'ocean', 'sunset', 'neon', 'vintage', 'arctic', 'amber', 'hacker', 'royal',
        'vaporwave', 'desert', 'toxic', 'crimson', 'lavender', 'emerald', 'midnight', 'sakura', 'copper', 'plasma',
        'atari', 'nes', 'gameboy', 'arcade', 'spectrum', 'rainbow-cycle'
      ];

      const currentTheme = localStorage.getItem('terminal-theme') || 'hacker';
      const formattedList = themesList.map(theme =>
        theme === currentTheme ? `  ▶ ${theme} (current)` : `    ${theme}`
      ).join('\n');

      addEntry('system', `Available Themes:\n\n${formattedList}\n\nUsage: theme <name>\nExample: theme cyberpunk`);
      return;
    }

    if (cmd.startsWith('theme ')) {
      const requestedTheme = cmd.substring(6).trim().toLowerCase();
      const availableThemes = [
        'commodore64', 'green', 'blue', 'orange', 'greyscale', 'red', 'blackwhite', 'patriot', 'solarized',
        'cyberpunk', 'forest', 'ocean', 'sunset', 'neon', 'vintage', 'arctic', 'amber', 'hacker', 'royal',
        'vaporwave', 'desert', 'toxic', 'crimson', 'lavender', 'emerald', 'midnight', 'sakura', 'copper', 'plasma',
        'atari', 'nes', 'gameboy', 'arcade', 'spectrum', 'rainbow-cycle'
      ];

      if (!availableThemes.includes(requestedTheme)) {
        addEntry('error', `Theme "${requestedTheme}" not found. Use "theme list" to see available themes.`);
        return;
      }

      // Update the theme
      localStorage.setItem('terminal-theme', requestedTheme);

      // Trigger theme change by dispatching a custom event
      window.dispatchEvent(new CustomEvent('terminal-theme-change', { detail: requestedTheme }));

      addEntry('system', `🎨 Theme changed to: ${requestedTheme}`);
      return;
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
        // Check if it's Python code
        if (pastedCode.includes('import ') || pastedCode.includes('def ') || pastedCode.includes('print(')) {
          setIsTyping(true);
          addEntry('system', '🐍 Executing Python code...');

          fetch('/api/execute/python', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: pastedCode })
          })
            .then(res => res.json())
            .then(data => {
              setIsTyping(false);
              addEntry('response', data.formatted);
            })
            .catch(error => {
              setIsTyping(false);
              addEntry('error', `Python execution failed: ${error.message}`);
            });
          return;
        } else {
          // HTML/CSS/JS code
          setPreviewCode(pastedCode);
          addEntry('system', '🚀 Opening code preview with your pasted code...');
          return;
        }
      }

      // No pasted code - extract from last AI response
      const lastResponse = [...entries].reverse().find(entry => entry.type === 'response');

      if (!lastResponse) {
        addEntry('error', 'No AI response found. Please ask the AI to generate some code first, or use:\n\npreview <paste your code here>');
        return;
      }

      // Extract code blocks from the response
      const pythonBlockRegex = /```(?:python|py)\n([\s\S]*?)```/;
      const pythonMatch = lastResponse.content.match(pythonBlockRegex);

      if (pythonMatch && pythonMatch[1]) {
        setIsTyping(true);
        addEntry('system', '🐍 Executing Python code...');

        fetch('/api/execute/python', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: pythonMatch[1].trim() })
        })
          .then(res => res.json())
          .then(data => {
            setIsTyping(false);
            addEntry('response', data.formatted);
          })
          .catch(error => {
            setIsTyping(false);
            addEntry('error', `Python execution failed: ${error.message}`);
          });
        return;
      }

      // Try HTML/CSS/JS code blocks
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
          addEntry('error', 'No code blocks found in the last response.\n\nAsk the AI to generate Python, HTML, CSS, or JavaScript code, or use:\n\npreview <paste your code here>');
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

    if (cmd === 'save' || cmd === 'save-response' || cmd.startsWith('save ')) {
      // Find the last response entry
      const lastResponse = [...entries].reverse().find(entry => entry.type === 'response');

      if (!lastResponse) {
        addEntry('error', 'No response to save. Please ask a question first.');
        return;
      }

      // Extract custom filename if provided
      let customFilename = '';
      if (cmd.startsWith('save ')) {
        customFilename = cmd.substring(5).trim();
      }

      setIsTyping(true);
      addEntry('system', '💾 Saving response to knowledge base...');

      // Generate filename
      let filename: string;
      if (customFilename) {
        // Add .txt extension if not present
        filename = customFilename.endsWith('.txt') ? customFilename : `${customFilename}.txt`;
      } else {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        filename = `archimedes-response-${timestamp}.txt`;
      }

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
          addEntry('error', 'Please provide at least one stock symbol');
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
                      formatted += `<div style="margin: 10px 0; text-align: center; background-color: rgba(0, 0, 0, 0.3); padding: 10px;">`;
                      formatted += `<img src="${subpod.img.src}" alt="${subpod.img.alt || 'Wolfram Alpha result'}" style="max-width: 100%; height: auto; border: 1px solid var(--terminal-subtle); background-color: rgba(0, 0, 0, 0.3);" />`;
                      formatted += `</div>`;
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
                      formatted += `<div style="margin-bottom: 10px; background-color: rgba(0, 0, 0, 0.3); color: var(--terminal-text);">`;
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
                  formatted += `<div style="margin-bottom: 10px; background-color: rgba(0, 0, 0, 0.3); color: var(--terminal-text);">`;
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

            // Extract text summary from pods for speech and AI analysis
            const resultSummary = data.pods
              .filter((pod: any) => pod.plaintext || (pod.subpods && pod.subpods.length > 0))
              .map((pod: any) => {
                const content = pod.subpods
                  ? pod.subpods.map((sp: any) => sp.plaintext).filter(Boolean).join('\n')
                  : pod.plaintext;
                return `${pod.title}: ${content}`;
              })
              .join('\n\n');

            // Speak the Wolfram results first, then get AI commentary after speech completes
            // Use a simple speak function (assuming it's defined elsewhere or globally)
            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(resultSummary);
              window.speechSynthesis.speak(utterance);
            } else {
              console.warn("Speech synthesis not supported in this browser.");
            }

            // Wait for speech to complete before getting AI commentary
            // Estimate speech duration based on text length (average 150 words per minute)
            const wordCount = resultSummary.split(/\s+/).length;
            const speechDuration = Math.max(3000, (wordCount / 150) * 60 * 1000); // Minimum 3 seconds

            setTimeout(() => {
              setIsTyping(true);
              addEntry('system', '💭 Archimedes AI analyzing results...');

              chatMutation.mutate({
                message: `As ARCHIMEDES, analyze these Wolfram Alpha results with personality and insight. Query: "${query}"\n\nResults:\n${resultSummary}\n\nProvide your unique perspective on what these results mean, why they matter, or how they could be applied. Be conversational and engaging - this is natural mode, not a robotic analysis.`,
                mode: currentMode
              }, {
                onError: (error) => {
                  setIsTyping(false);
                  addEntry('error', `AI analysis failed: ${error.message}. The Wolfram results above are still valid though!`);
                }
              });
            }, speechDuration);
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

    // SpiderFoot command handler
    if (lowerCmd.startsWith('spiderfoot') || lowerCmd.startsWith('spider')) {
      addEntry('system', '🕷️ SpiderFoot OSINT tool is currently unavailable');
      return;
    }

    // For non-command inputs, send to AI
    setIsTyping(true);
    chatMutation.mutate({ message: command, mode: currentMode });
  }, [currentMode, sessionId, commandHistory.length, addEntry, chatMutation, weatherMutation]);

  const clearTerminal = useCallback(() => {
    setEntries([]);
  }, []);

  const switchMode = useCallback((mode: 'natural' | 'technical' | 'freestyle' | 'health') => {
    setCurrentMode(mode);
    localStorage.setItem('ai-mode', mode);
  }, []);

  // Listen for mode changes from profile settings (same tab)
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      if (newMode && newMode !== currentMode) {
        setCurrentMode(newMode);
      }
    };

    window.addEventListener('ai-mode-change', handleModeChange as EventListener);
    return () => {
      window.removeEventListener('ai-mode-change', handleModeChange as EventListener);
    };
  }, [currentMode]);

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
    isLoading: chatMutation.isPending || weatherMutation.isPending,
    loadConversation,
    previewCode,
    setPreviewCode,
    showPythonIDE,
    setShowPythonIDE,
    showPythonLessons,
    setShowPythonLessons,
    showWebSynth,
    setShowWebSynth,
    showCodePlayground,
    setShowCodePlayground,
  };
}