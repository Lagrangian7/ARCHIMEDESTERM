import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, Terminal as TerminalIcon, Radio, Book, TrendingUp, Wifi, Gamepad2, Upload, Mic, MessageSquare } from 'lucide-react';

interface HelpMenuItem {
  id: string;
  category: string;
  title: string;
  description: string;
  command?: string;
  example?: string;
  icon: React.ReactNode;
}

interface HelpMenuProps {
  onClose: () => void;
  onSelectCommand: (command: string) => void;
}

const helpMenuItems: HelpMenuItem[] = [
  // Basic Commands
  {
    id: 'help',
    category: 'Basic Commands',
    title: 'Show Help',
    description: 'Display all available commands and system information',
    command: 'help',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'clear',
    category: 'Basic Commands',
    title: 'Clear Terminal',
    description: 'Clear all output from the terminal screen',
    command: 'clear',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'status',
    category: 'Basic Commands',
    title: 'System Status',
    description: 'Show current system status and configuration',
    command: 'status',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'mode',
    category: 'Basic Commands',
    title: 'Switch AI Mode',
    description: 'Switch between natural chat and technical protocol modes',
    command: 'mode',
    example: 'mode natural  or  mode technical',
    icon: <TerminalIcon size={16} />
  },

  // Network & BBS
  {
    id: 'telnet',
    category: 'Network & BBS',
    title: 'Telnet Connection',
    description: 'Connect to remote telnet servers and BBS systems',
    command: 'telnet',
    example: 'telnet telehack.com 23',
    icon: <Wifi size={16} />
  },
  {
    id: 'ping',
    category: 'Network & BBS',
    title: 'Ping Host',
    description: 'Test network connectivity to remote hosts',
    command: 'ping',
    example: 'ping google.com',
    icon: <Wifi size={16} />
  },
  {
    id: 'bbs-list',
    category: 'Network & BBS',
    title: 'BBS Directory',
    description: 'Browse available bulletin board systems',
    command: 'bbs-list',
    icon: <Wifi size={16} />
  },
  {
    id: 'bbs-search',
    category: 'Network & BBS',
    title: 'Search BBS',
    description: 'Search for BBS systems by name or location',
    command: 'bbs-search',
    example: 'bbs-search retro',
    icon: <Wifi size={16} />
  },

  // Stock Market
  {
    id: 'stock-quote',
    category: 'Stock Market',
    title: 'Stock Quote',
    description: 'Get current stock price and basic information',
    command: 'stock quote',
    example: 'stock quote AAPL',
    icon: <TrendingUp size={16} />
  },
  {
    id: 'stock-quotes',
    category: 'Stock Market',
    title: 'Multiple Quotes',
    description: 'Get quotes for multiple stocks at once',
    command: 'stock quotes',
    example: 'stock quotes AAPL,MSFT,GOOGL',
    icon: <TrendingUp size={16} />
  },
  {
    id: 'stock-info',
    category: 'Stock Market',
    title: 'Company Info',
    description: 'Get detailed company information and metrics',
    command: 'stock info',
    example: 'stock info AAPL',
    icon: <TrendingUp size={16} />
  },
  {
    id: 'stock-search',
    category: 'Stock Market',
    title: 'Search Stocks',
    description: 'Search for stocks by company name or symbol',
    command: 'stock search',
    example: 'stock search apple',
    icon: <TrendingUp size={16} />
  },

  // Books & Literature
  {
    id: 'books-popular',
    category: 'Books & Literature',
    title: 'Popular Books',
    description: 'Browse most downloaded books from Project Gutenberg',
    command: 'books popular',
    example: 'books popular 20',
    icon: <Book size={16} />
  },
  {
    id: 'books-search',
    category: 'Books & Literature',
    title: 'Search Books',
    description: 'Search for books by title, author, or content',
    command: 'books search',
    example: 'books search pride prejudice',
    icon: <Book size={16} />
  },
  {
    id: 'books-author',
    category: 'Books & Literature',
    title: 'Books by Author',
    description: 'Find all books by a specific author',
    command: 'books author',
    example: 'books author "Mark Twain"',
    icon: <Book size={16} />
  },
  {
    id: 'books-topic',
    category: 'Books & Literature',
    title: 'Books by Topic',
    description: 'Find books by subject or topic category',
    command: 'books topic',
    example: 'books topic science',
    icon: <Book size={16} />
  },

  // Audio & Radio
  {
    id: 'radio-play',
    category: 'Audio & Radio',
    title: 'Start Radio',
    description: 'Start streaming radio with animated character',
    command: 'radio play',
    icon: <Radio size={16} />
  },
  {
    id: 'radio-stop',
    category: 'Audio & Radio',
    title: 'Stop Radio',
    description: 'Stop radio streaming and hide character',
    command: 'radio stop',
    icon: <Radio size={16} />
  },
  {
    id: 'dtmf',
    category: 'Audio & Radio',
    title: 'DTMF Decoder',
    description: 'Decode touch-tone phone signals from audio input',
    command: 'dtmf',
    icon: <Mic size={16} />
  },
  {
    id: 'weather',
    category: 'System Information',
    title: 'Weather Data',
    description: 'Get current weather conditions for your location or specified city',
    command: 'weather',
    example: 'weather  or  weather London',
    icon: <TerminalIcon size={16} />
  },

  // Games & Entertainment

  // Knowledge Base
  {
    id: 'upload',
    category: 'Knowledge Base',
    title: 'Upload Documents',
    description: 'Upload documents to your personal knowledge base',
    command: 'upload',
    icon: <Upload size={16} />
  },
  {
    id: 'docs',
    category: 'Knowledge Base',
    title: 'List Documents',
    description: 'View all documents in your knowledge base',
    command: 'docs',
    icon: <Upload size={16} />
  },
  {
    id: 'search',
    category: 'Knowledge Base',
    title: 'Search Knowledge',
    description: 'Search through your uploaded documents',
    command: 'search',
    example: 'search artificial intelligence',
    icon: <Upload size={16} />
  },
  {
    id: 'knowledge-stats',
    category: 'Knowledge Base',
    title: 'Knowledge Stats',
    description: 'View statistics about your knowledge base',
    command: 'knowledge stats',
    icon: <Upload size={16} />
  },
  {
    id: 'stop',
    category: 'Basic Commands',
    title: 'Stop Speech',
    description: 'Stop speech synthesis immediately and await next command',
    command: 'stop',
    icon: <Mic size={16} />
  },
  {
    id: 'privacy',
    category: 'Basic Commands',
    title: 'Privacy Screen',
    description: 'Activate matrix rain privacy screen (type "QWERTY" to unlock)',
    command: 'privacy',
    icon: <TerminalIcon size={16} />
  },

  // OSINT Commands
  {
    id: 'whois',
    category: 'OSINT (Intelligence)',
    title: 'WHOIS Lookup',
    description: 'Domain registration information and ownership details',
    command: 'whois',
    example: 'whois google.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'dns',
    category: 'OSINT (Intelligence)',
    title: 'DNS Records',
    description: 'Comprehensive DNS record analysis (A, AAAA, MX, NS, TXT)',
    command: 'dns',
    example: 'dns example.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'geoip',
    category: 'OSINT (Intelligence)',
    title: 'IP Geolocation',
    description: 'Geographic location and ISP information for IP addresses',
    command: 'geoip',
    example: 'geoip 8.8.8.8',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'headers',
    category: 'OSINT (Intelligence)',
    title: 'HTTP Headers',
    description: 'Analyze HTTP response headers and security configurations',
    command: 'headers',
    example: 'headers https://example.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'wayback',
    category: 'OSINT (Intelligence)',
    title: 'Wayback Machine',
    description: 'Historical snapshots and archived versions of websites',
    command: 'wayback',
    example: 'wayback example.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'username',
    category: 'OSINT (Intelligence)',
    title: 'Username Check',
    description: 'Check username availability across multiple platforms',
    command: 'username',
    example: 'username johndoe',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'traceroute',
    category: 'OSINT (Intelligence)',
    title: 'Network Traceroute',
    description: 'Trace network path and routing information to target',
    command: 'traceroute',
    example: 'traceroute google.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'subdomains',
    category: 'OSINT (Intelligence)',
    title: 'Subdomain Discovery',
    description: 'Enumerate and discover subdomains for a target domain',
    command: 'subdomains',
    example: 'subdomains example.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'ssl',
    category: 'OSINT (Intelligence)',
    title: 'SSL Certificate',
    description: 'Analyze SSL/TLS certificates and security configurations',
    command: 'ssl',
    example: 'ssl example.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'tech',
    category: 'OSINT (Intelligence)',
    title: 'Technology Stack',
    description: 'Detect technologies, frameworks, and libraries used by a website',
    command: 'tech',
    example: 'tech github.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'reverse-ip',
    category: 'OSINT (Intelligence)',
    title: 'Reverse IP Lookup',
    description: 'Find other domains hosted on the same IP address',
    command: 'reverse-ip',
    example: 'reverse-ip 192.168.1.1',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'portscan',
    category: 'OSINT (Intelligence)',
    title: 'Port Scanner',
    description: 'Scan common network ports for open services',
    command: 'portscan',
    example: 'portscan example.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'osint-report',
    category: 'OSINT (Intelligence)',
    title: 'OSINT Report',
    description: 'Generate comprehensive intelligence report combining multiple sources',
    command: 'osint-report',
    example: 'osint-report example.com',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'threat-actors',
    category: 'OSINT (Intelligence)',
    title: 'Threat Actors',
    description: 'Display current threat actors from MISP Galaxy intelligence database',
    command: 'threat-actors',
    example: 'threat-actors',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'theharvester',
    category: 'OSINT (Intelligence)',
    title: 'theHarvester',
    description: 'Launch comprehensive OSINT reconnaissance tool for gathering emails, subdomains, and intelligence',
    command: 'theharvester',
    example: 'theharvester  or  harvester',
    icon: <TerminalIcon size={16} />
  },

  // Games
  {
    id: 'zork',
    category: 'Games',
    title: 'ZORK Adventure',
    description: 'Play the classic text adventure game: ZORK - The Great Underground Empire',
    command: 'zork',
    icon: <Gamepad2 size={16} />
  },
  {
    id: 'invaders',
    category: 'Games',
    title: 'SPACEWAR',
    description: 'Launch enhanced SPACEWAR game in new browser window featuring Nyan Cat, UFOs, and multiple invasion patterns',
    command: 'spacewars',
    icon: <Gamepad2 size={16} />
  },

  // Research & Academic
  {
    id: 'research',
    category: 'Research & Academic',
    title: 'Web Research',
    description: 'Search the web using Brave API for current information',
    command: 'research',
    example: 'research quantum computing news',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'scholar-search',
    category: 'Research & Academic',
    title: 'Scholar Search',
    description: 'Search 200M+ academic papers via Semantic Scholar',
    command: 'scholar search',
    example: 'scholar search machine learning',
    icon: <Book size={16} />
  },
  {
    id: 'scholar-details',
    category: 'Research & Academic',
    title: 'Paper Details',
    description: 'Get full details and abstract for an academic paper',
    command: 'scholar details',
    example: 'scholar details abc123xyz',
    icon: <Book size={16} />
  },

  // Wolfram Alpha
  {
    id: 'query',
    category: 'Computational Knowledge',
    title: 'Wolfram Alpha Query',
    description: 'Query Wolfram Alpha for computational answers, math, science, and data',
    command: 'query',
    example: 'query solve x^2 + 5x + 6 = 0',
    icon: <TerminalIcon size={16} />
  },

  // Session & Productivity
  {
    id: 'session',
    category: 'Session & Productivity',
    title: 'Session Analytics',
    description: 'View current session statistics (time, words, commands)',
    command: 'session',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'copy',
    category: 'Session & Productivity',
    title: 'Copy Response',
    description: 'Copy the last AI response to clipboard',
    command: 'copy',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'bookmark',
    category: 'Session & Productivity',
    title: 'Bookmark Command',
    description: 'Save a command as a bookmark for quick access',
    command: 'bookmark',
    example: 'bookmark weather Tokyo',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'bookmarks',
    category: 'Session & Productivity',
    title: 'View Bookmarks',
    description: 'List all bookmarked commands',
    command: 'bookmarks',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'bookmark-delete',
    category: 'Session & Productivity',
    title: 'Delete Bookmark',
    description: 'Remove a bookmarked command by number',
    command: 'bookmark-delete',
    example: 'bookmark-delete 3',
    icon: <TerminalIcon size={16} />
  },

  // Code Execution
  {
    id: 'preview',
    category: 'Code Execution',
    title: 'Preview Code',
    description: 'Execute and preview HTML/CSS/JS code from last AI response or paste your own',
    command: 'preview',
    example: 'preview <your code here>',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'run',
    category: 'Code Execution',
    title: 'Run Code',
    description: 'Alias for preview - execute and preview code',
    command: 'run',
    icon: <TerminalIcon size={16} />
  },

  // Media & Entertainment
  {
    id: 'webamp',
    category: 'Media & Entertainment',
    title: 'Webamp Player',
    description: 'Launch Webamp music player with Milkdrop visualizer',
    command: 'webamp',
    icon: <Radio size={16} />
  },
  {
    id: 'play-our-song',
    category: 'Media & Entertainment',
    title: 'Play Our Song',
    description: 'Launch Webamp and play Lagrangian 25',
    command: 'play our song',
    icon: <Radio size={16} />
  },
  {
    id: 'aj',
    category: 'Media & Entertainment',
    title: 'AJ Video Player',
    description: 'Launch AJ video player interface',
    command: 'aj',
    icon: <Radio size={16} />
  },

  // Network Tools
  {
    id: 'ssh',
    category: 'Network & BBS',
    title: 'SSH Connection',
    description: 'Connect to remote SSH servers via web-based client',
    command: 'ssh',
    example: 'ssh user@host.com 22',
    icon: <Wifi size={16} />
  },
  {
    id: 'ssh-client',
    category: 'Network & BBS',
    title: 'SSH/Telnet Client',
    description: 'Open web-based SSH/Telnet client interface',
    command: 'ssh-client',
    icon: <Wifi size={16} />
  },
  {
    id: 'sshwifty',
    category: 'Network & BBS',
    title: 'Sshwifty Interface',
    description: 'Open Sshwifty terminal client interface',
    command: 'sshwifty',
    icon: <Wifi size={16} />
  },
  {
    id: 'bbs-popular',
    category: 'Network & BBS',
    title: 'Popular BBS',
    description: 'Show most popular BBS systems by connections',
    command: 'bbs-popular',
    icon: <Wifi size={16} />
  },
  {
    id: 'bbs-favorites',
    category: 'Network & BBS',
    title: 'Favorite BBS',
    description: 'Show your favorite BBS systems (requires login)',
    command: 'bbs-favorites',
    icon: <Wifi size={16} />
  },

  // Radio Garden
  {
    id: 'radio-search',
    category: 'Audio & Radio',
    title: 'Search Radio',
    description: 'Search Radio Garden for stations worldwide',
    command: 'radio search',
    example: 'radio search jazz',
    icon: <Radio size={16} />
  },
  {
    id: 'radio-random',
    category: 'Audio & Radio',
    title: 'Random Station',
    description: 'Get a random radio station from Radio Garden',
    command: 'radio random',
    icon: <Radio size={16} />
  },
  {
    id: 'radio-countries',
    category: 'Audio & Radio',
    title: 'Radio Countries',
    description: 'List countries with available radio stations',
    command: 'radio countries',
    icon: <Radio size={16} />
  },
  {
    id: 'radio-volume',
    category: 'Audio & Radio',
    title: 'Radio Volume',
    description: 'Set radio volume level (0-100)',
    command: 'radio volume',
    example: 'radio volume 70',
    icon: <Radio size={16} />
  },
  {
    id: 'radio-status',
    category: 'Audio & Radio',
    title: 'Radio Status',
    description: 'Check current radio streaming status',
    command: 'radio status',
    icon: <Radio size={16} />
  },
  

  // Additional Games
  {
    id: 'mud',
    category: 'Games',
    title: 'MUD Client',
    description: 'Launch MUD (Multi-User Dungeon) client for text-based adventures',
    command: 'mud',
    icon: <Gamepad2 size={16} />
  },

  // Knowledge Base
  {
    id: 'read',
    category: 'Knowledge Base',
    title: 'Read Document',
    description: 'Read a specific document from your knowledge base',
    command: 'read',
    example: 'read document.txt',
    icon: <Upload size={16} />
  },
  {
    id: 'save',
    category: 'Knowledge Base',
    title: 'Save Response',
    description: 'Save the last AI response to your knowledge base',
    command: 'save',
    example: 'save my-notes (auto-adds .txt)',
    icon: <TerminalIcon size={16} />
  },

  // Chat
  {
    id: 'chat',
    category: 'Communication',
    title: 'User Chat',
    description: 'Open chat interface to connect with other online users',
    command: 'chat',
    icon: <MessageSquare size={16} />
  },

  // System
  {
    id: 'xx',
    category: 'Basic Commands',
    title: 'Screensaver',
    description: 'Manually activate puzzle screensaver',
    command: 'xx',
    icon: <TerminalIcon size={16} />
  },
  {
    id: 'history',
    category: 'Basic Commands',
    title: 'Command History',
    description: 'Show recent command history',
    command: 'history',
    icon: <TerminalIcon size={16} />
  }
];

export function HelpMenu({ onClose, onSelectCommand }: HelpMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Sort all commands alphabetically by title
  const sortedItems = [...helpMenuItems].sort((a, b) => a.title.localeCompare(b.title));

  // Scroll selected item into view
  const scrollToSelected = useCallback(() => {
    if (selectedItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const item = selectedItemRef.current;

      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      const isItemVisible =
        itemRect.top >= containerRect.top &&
        itemRect.bottom <= containerRect.bottom;

      if (!isItemVisible) {
        const scrollOffset = itemRect.top - containerRect.top - container.scrollTop;
        const targetScrollTop = container.scrollTop + scrollOffset - 100; // 100px padding from top

        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : sortedItems.length - 1;
          setTimeout(scrollToSelected, 10);
          return newIndex;
        });
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev < sortedItems.length - 1 ? prev + 1 : 0;
          setTimeout(scrollToSelected, 10);
          return newIndex;
        });
        break;
      case 'PageUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = Math.max(0, prev - 10);
          setTimeout(scrollToSelected, 10);
          return newIndex;
        });
        break;
      case 'PageDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = Math.min(sortedItems.length - 1, prev + 10);
          setTimeout(scrollToSelected, 10);
          return newIndex;
        });
        break;
      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        setTimeout(scrollToSelected, 10);
        break;
      case 'End':
        e.preventDefault();
        setSelectedIndex(sortedItems.length - 1);
        setTimeout(scrollToSelected, 10);
        break;
      case 'Enter':
        e.preventDefault();
        const selectedItem = sortedItems[selectedIndex];
        if (selectedItem?.command) {
          onSelectCommand(selectedItem.command);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [selectedIndex, sortedItems, onSelectCommand, onClose, scrollToSelected]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll to selected item when component mounts
  useEffect(() => {
    setTimeout(scrollToSelected, 100);
  }, [scrollToSelected]);

  const handleItemSelect = (item: HelpMenuItem) => {
    if (item.command) {
      onSelectCommand(item.command);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-terminal-bg border-2 border-terminal-highlight rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-terminal-subtle">
          <div className="flex items-center gap-3">
            <TerminalIcon className="w-6 h-6 text-terminal-highlight" />
            <h2 className="text-xl font-bold text-terminal-highlight">
              📋 INTERACTIVE HELP MENU
            </h2>
          </div>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="border-terminal-subtle text-terminal-text hover:bg-terminal-subtle"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Instructions */}
        <div className="px-4 py-2 bg-terminal-bg/50 border-b border-terminal-subtle/50">
          <div className="text-sm text-terminal-text/80 font-mono">
            ⌨️ <span className="text-terminal-highlight">↑↓</span> navigate •
            <span className="text-terminal-highlight">PgUp/PgDn</span> jump •
            <span className="text-terminal-highlight">Home/End</span> first/last •
            <span className="text-terminal-highlight">Enter</span> select •
            <span className="text-terminal-highlight">Esc</span> close
          </div>
        </div>

        {/* Commands List */}
        <div className="h-[500px] flex flex-col">
          <div className="p-3 border-b border-terminal-subtle/50 flex-shrink-0">
            <h3 className="text-sm font-semibold text-terminal-highlight">
              ALL COMMANDS (A-Z) - {sortedItems.length} total
            </h3>
          </div>
          <div
            ref={scrollContainerRef}
            className="overflow-y-auto flex-1 scrollbar-thin scrollbar-track-terminal-bg scrollbar-thumb-terminal-highlight/50"
          >
            {sortedItems.map((item, index) => (
                <div
                  key={item.id}
                  ref={index === selectedIndex ? selectedItemRef : null}
                  onClick={() => handleItemSelect(item)}
                  className={`p-4 cursor-pointer border-b border-terminal-subtle/20 transition-all duration-150 ${
                    index === selectedIndex
                      ? 'bg-terminal-highlight text-terminal-bg'
                      : 'text-terminal-text hover:bg-terminal-subtle/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 ${index === selectedIndex ? 'text-terminal-bg' : 'text-terminal-highlight'}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{item.title}</h4>
                        {item.command && (
                          <code className={`text-xs px-2 py-1 rounded font-mono ${
                            index === selectedIndex
                              ? 'bg-terminal-bg/20 text-terminal-bg/80'
                              : 'bg-terminal-subtle/30 text-terminal-highlight'
                          }`}>
                            {item.command}
                          </code>
                        )}
                      </div>
                      <p className={`text-xs mb-2 ${
                        index === selectedIndex ? 'text-terminal-bg/80' : 'text-terminal-text/70'
                      }`}>
                        {item.description}
                      </p>
                      {item.example && (
                        <div className={`text-xs font-mono ${
                          index === selectedIndex ? 'text-terminal-bg/70' : 'text-terminal-text/60'
                        }`}>
                          💡 Example: <span className="italic">{item.example}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        {/* Footer */}
        <div className="p-3 border-t border-terminal-subtle bg-terminal-bg/50 flex-shrink-0">
          <div className="text-xs text-terminal-text/60 font-mono text-center">
            ARCHIMEDES v7 Interactive Help System •
            Item {selectedIndex + 1} of {sortedItems.length}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpMenu;