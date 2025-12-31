import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VoiceControls } from './VoiceControls';
import { CommandHistory } from './CommandHistory';
import { UserProfile } from './UserProfile';
import { ConversationHistory } from './ConversationHistory';
import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentsList } from '@/components/DocumentsList';
import { KnowledgeBaseModal } from '@/components/KnowledgeBaseModal';
import ZorkGame from './ZorkGame';
import { DTMFDecoder } from './DTMFDecoder';
import { HelpMenu } from './HelpMenu';
import { TalkingArchimedes } from './TalkingArchimedes';
import { ThinkingAnimation } from './ThinkingAnimation';
import { MatrixRain } from './MatrixRain';
import { DraggableResponse } from './DraggableResponse';
import { extractCodeBlocksFromText } from './CodePlayground';
import { LinkifiedText } from '@/lib/linkify';
import { EncodeDecodeOverlay } from './EncodeDecodeOverlay';
import { PythonIDE } from './PythonIDE';
import { CodePreview } from './CodePreview';
import { CodePlayground } from './CodePlayground';
import { BackgroundManager } from './BackgroundManager';
import WebampPlayer from './WebampPlayer';
import AJVideoPopup from './AJVideoPopup';
import AJ2VideoPopup from './AJ2VideoPopup';
import { MusicUpload } from './MusicUpload'; // Import the new MusicUpload component
import { Notepad } from './Notepad';
import { useTerminal } from '@/hooks/use-terminal';
import { useSpeech } from '@/contexts/SpeechContext';
import { useAuth } from '@/hooks/useAuth';
import { useActivityTracker } from '@/hooks/use-activity-tracker';
import { useQuery } from '@tanstack/react-query';
import type { Wallpaper } from '@shared/schema';
import { History, User, LogIn, Upload, Terminal as TerminalIcon, Radio, MessageSquare, Shield, Gamepad2, CassetteTape, Clock, X } from 'lucide-react';
import logoImage from '@assets/5721242-200_1756549869080.png';
import cubesIcon from '@assets/cubes_1758505065526.png';
import invadersIcon from '@assets/invaders_1758659503566.png';
import archyLogo from '@assets/archy111_1760233943010.jpeg';

// Import LogoIcon from its own file to break circular dependency
import { LogoIcon } from './LogoIcon';
import { WebSynth } from './WebSynth'; // Import the WebSynth component

// CST Clock Component
const CSTClock = memo(() => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      const hours = cstTime.getHours().toString().padStart(2, '0');
      const minutes = cstTime.getMinutes().toString().padStart(2, '0');
      const seconds = cstTime.getSeconds().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1 px-2 text-terminal-highlight text-xs font-mono border border-terminal-subtle rounded bg-terminal-bg/50 min-h-[44px]">
      <Clock className="w-3 h-3" />
      <span className="hidden sm:inline">CST</span>
      <span>{time}</span>
    </div>
  );
});

export function Terminal() {
  const {
    entries,
    commandHistory,
    currentMode,
    isTyping,
    processCommand,
    clearTerminal,
    switchMode,
    getHistoryCommand,
    isLoading,
    loadConversation,
    previewCode,
    setPreviewCode,
    showWebSynth,
    setShowWebSynth,
    showCodePlayground,
    setShowCodePlayground,
    showPythonIDE,
    setShowPythonIDE,
  } = useTerminal(() => {
    if (isAuthenticated) {
      setShowUpload(true);
    }
  });

  // Update system message when mode changes
  useEffect(() => {
    if (currentMode === 'freestyle') {
      // Optional: could add a visual indicator or message
    }
  }, [currentMode]);

  // Expose modal openers globally
  useEffect(() => {
    (window as any).openZorkGame = () => setShowZork(true);
    (window as any).openDTMFDecoder = () => setShowDTMF(true);
    (window as any).openHelpMenu = () => setShowHelpMenu(true);
    (window as any).openPrivacyEncoder = () => setShowPrivacyEncoder(true);
    (window as any).openWebamp = () => setShowWebamp(true);
    (window as any).openAJVideo = () => setShowAJVideo(true);
    (window as any).openAJ2Video = () => setShowAJ2Video(true);
    (window as any).openPythonIDE = () => setShowPythonIDE(true);
    (window as any).openBackgroundManager = () => setShowBackgroundManager(true);
    (window as any).openWebSynth = () => setShowWebSynth(true);
    (window as any).toggleResources = () => {
      setShowResources(prev => {
        const newValue = !prev;
        console.log('Resources visibility toggled:', newValue);
        return newValue;
      });
    };

    // Listen for background change events
    const handleBackgroundChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const newUrl = customEvent.detail;
      console.log('Background change event received:', newUrl);
      console.log('Previous background URL:', customBackgroundUrl);

      // Force state update - ensure React sees this as a new value
      setCustomBackgroundUrl(prev => {
        if (prev === newUrl) {
          // Force update even if same value by temporarily setting to empty
          setCustomBackgroundUrl('');
          setTimeout(() => setCustomBackgroundUrl(newUrl), 0);
          return prev;
        }
        return newUrl;
      });
    };

    window.addEventListener('terminal-background-change', handleBackgroundChange);

    return () => {
      window.removeEventListener('terminal-background-change', handleBackgroundChange);
    };
  }, []);

  const { speak, isSpeaking } = useSpeech();
  const { user, isAuthenticated, preferences } = useAuth();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState<'upload' | 'list' | 'music'>('list'); // Added 'music' tab
  const [typingEntries, setTypingEntries] = useState<Set<string>>(new Set());
  const [showZork, setShowZork] = useState(false);
  const [showDTMF, setShowDTMF] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showPrivacyEncoder, setShowPrivacyEncoder] = useState(false);
  const [showWebamp, setShowWebamp] = useState(false);
  const [showAJVideo, setShowAJVideo] = useState(false);
  const [showAJ2Video, setShowAJ2Video] = useState(false);
  const [isWebampOpen, setIsWebampOpen] = useState(false); // State to track if Webamp is open
  const [notepads, setNotepads] = useState<Array<{ id: string }>>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showBackgroundManager, setShowBackgroundManager] = useState(false);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string>('/default-wallpaper.png');
  const [hasCustomBackground, setHasCustomBackground] = useState<boolean>(true);
  const [showResources, setShowResources] = useState(true);
  const lastSpokenIdRef = useRef<string>('');
  const [bubbleRendered, setBubbleRendered] = useState(false);

  // State for the Knowledge Base modal
  const [kbModalState, setKbModalState] = useState({
    position: { x: 0, y: 0 },
    size: { width: 0, height: 0 },
    isResizing: false,
    isDragging: false,
    isMaximized: false,
  });

  // Theme management
  const themes = useMemo(() => [
    'commodore64', 'green', 'blue', 'orange', 'greyscale', 'red', 'blackwhite', 'patriot', 'solarized',
    'cyberpunk', 'forest', 'ocean', 'sunset', 'neon', 'vintage', 'arctic', 'amber', 'hacker', 'royal',
    'vaporwave', 'desert', 'toxic', 'crimson', 'lavender', 'emerald', 'midnight', 'sakura', 'copper', 'plasma',
    'atari', 'nes', 'gameboy', 'arcade', 'spectrum', 'rainbow-cycle',
    'nord-dark', 'gruvbox-dark', 'tokyo-night-dark', 'catppuccin-mocha', 'everforest-dark',
    'nord-light', 'gruvbox-light', 'tokyo-night-light', 'catppuccin-latte', 'everforest-light',
    'midnight-gradient', 'twilight-gradient', 'forest-gradient', 'ocean-gradient', 'ember-gradient',
    'executive-dark', 'corporate-blue', 'finance-green', 'professional-grey', 'banking-teal',
    'consulting-navy', 'accounting-beige', 'law-burgundy', 'tech-startup', 'healthcare-white',
    'investment-banking', 'corporate-slate', 'silicon-valley', 'premium-charcoal', 'pharmaceutical-white',
    'real-estate', 'auditing-cream', 'venture-capital', 'insurance-navy', 'logistics-orange'
  ], []);
  const [currentTheme, setCurrentTheme] = useState<string>('hacker');

  // Update theme when preferences change or on mount
  useEffect(() => {
    // Only update if preferences are loaded and have a theme
    if (preferences?.terminalTheme) {
      setCurrentTheme(preferences.terminalTheme);
      localStorage.setItem('terminal-theme', preferences.terminalTheme);
    } else {
      // If no preferences yet, use hacker as default and set it
      setCurrentTheme('hacker');
      localStorage.setItem('terminal-theme', 'hacker');
    }
  }, [preferences?.terminalTheme]);

  // Listen for Code Playground open event from voice controls
  useEffect(() => {
    const handleOpenCodePlayground = () => {
      setShowCodePlayground(true);
    };

    window.addEventListener('open-code-playground', handleOpenCodePlayground);
    return () => {
      window.removeEventListener('open-code-playground', handleOpenCodePlayground);
    };
  }, []);

  // Listen for document-read events from Knowledge Base
  useEffect(() => {
    const handleDocumentRead = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { content } = customEvent.detail;
      
      // Add the document content to terminal output
      if (content) {
        const entryId = `read-${Date.now()}`;
        const newEntry = {
          id: entryId,
          type: 'response' as const,
          content,
          timestamp: new Date().toISOString(),
        };
        
        // Add to terminal entries
        entries.push(newEntry);
        
        // Trigger scroll to bottom
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    };

    window.addEventListener('document-read', handleDocumentRead);
    return () => {
      window.removeEventListener('document-read', handleDocumentRead);
    };
  }, [entries, scrollToBottom]);

  // Switch theme function
  const switchTheme = useCallback(() => {
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setCurrentTheme(nextTheme);
    localStorage.setItem('terminal-theme', nextTheme);
  }, [themes, currentTheme]);

  // Listen for theme change events from commands
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      setCurrentTheme(event.detail);
    };

    window.addEventListener('terminal-theme-change', handleThemeChange as EventListener);
    return () => {
      window.removeEventListener('terminal-theme-change', handleThemeChange as EventListener);
    };
  }, []);

  // Radio character is now controlled by Webamp state
  // No separate radio audio functionality

  const [visibleEntries, setVisibleEntries] = useState(Math.min(entries.length, 15));
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Check if content needs pagination
  useEffect(() => {
    if (entries.length > 0 && !isTyping) {
      const shouldPaginate = entries.length > 15; // Show max 15 entries at a time
      if (shouldPaginate && visibleEntries < entries.length) {
        setShowContinuePrompt(true);
      } else {
        setShowContinuePrompt(false);
      }

      // Update visible entries if we have fewer entries than the limit
      if (entries.length <= 15 && visibleEntries !== entries.length) {
        setVisibleEntries(entries.length);
      }
    }
  }, [entries, isTyping, visibleEntries]);

  // Enhanced auto-scroll terminal output to last line with carriage return
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      // Scroll both the output div and the ScrollArea viewport
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }

      // Also scroll the ScrollArea viewport to ensure proper positioning
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }, []);

  // Auto-scroll when entries change, during typing, or when pagination changes
  useEffect(() => {
    if (!showContinuePrompt) {
      scrollToBottom();
    }

    // Trigger MathJax typesetting for any new mathematical content
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch((err: any) => {
        console.error('MathJax typesetting error:', err);
      });
    }
  }, [entries, isTyping, showContinuePrompt, scrollToBottom]);

  // Additional scroll trigger for when responses are being drawn
  useEffect(() => {
    if (isTyping) {
      scrollToBottom();
    }
  }, [isTyping, scrollToBottom]);

  const handleContinue = useCallback(() => {
    setVisibleEntries(Math.min(visibleEntries + 10, entries.length)); // Show 10 more entries
    setShowContinuePrompt(false);

    // Auto-scroll after showing more content
    setTimeout(() => {
      scrollToBottom();
    }, 50);
  }, [entries.length, visibleEntries, scrollToBottom]);

  const handleShowAll = useCallback(() => {
    setVisibleEntries(entries.length);
    setShowContinuePrompt(false);

    // Auto-scroll after showing all content
    setTimeout(() => {
      scrollToBottom();
    }, 50);
  }, [entries.length, scrollToBottom]);

  // Focus input on mount and clicks
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't steal focus from inputs, textareas, or elements with data-no-terminal-autofocus
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[data-no-terminal-autofocus]')
      ) {
        return;
      }

      inputRef.current?.focus();
    };

    // Global keyboard listener for qwerty shortcut
    const handleGlobalKeyPress = (event: KeyboardEvent) => {
      // Track the last 6 characters typed
      const qwertyBuffer = (window as any).qwertyBuffer || '';
      (window as any).qwertyBuffer = (qwertyBuffer + event.key).slice(-6).toLowerCase();

      if ((window as any).qwertyBuffer === 'qwerty') {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        window.dispatchEvent(new CustomEvent('stop-all-speech'));
        (window as any).qwertyBuffer = ''; // Reset buffer

        // Visual feedback
        console.log('🔇 Speech stopped (qwerty shortcut)');
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keypress', handleGlobalKeyPress);
    inputRef.current?.focus();

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keypress', handleGlobalKeyPress);
    };
  }, []);

  // Auto-scroll to AI response popup when it appears
  useEffect(() => {
    const handleScrollToResponse = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { elementRect } = customEvent.detail;

      if (elementRect && scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          // Calculate the position to scroll to
          const viewportRect = viewport.getBoundingClientRect();
          const relativeTop = elementRect.top - viewportRect.top;
          const targetScroll = viewport.scrollTop + relativeTop - 100; // 100px padding from top

          // Smooth scroll to the response
          viewport.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth'
          });
        }
      }
    };

    window.addEventListener('scroll-to-response', handleScrollToResponse);
    return () => {
      window.removeEventListener('scroll-to-response', handleScrollToResponse);
    };
  }, []);

  // Auto-speak responses and system messages - only speak new entries once
  useEffect(() => {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry &&
        (lastEntry.type === 'response' || lastEntry.type === 'system') &&
        lastEntry.id !== lastSpokenIdRef.current) {
      lastSpokenIdRef.current = lastEntry.id;
      speak(lastEntry.content);
    }
  }, [entries]);

  // Handle typing animation for new response entries
  const typingEntriesSet = useMemo(() => typingEntries, [typingEntries]); // Memoize the set for dependency array
  useEffect(() => {
    const lastEntry = entries[entries.length - 1];

    // If the last entry is a response and we're not currently typing (meaning it's a new response)
    if (lastEntry && lastEntry.type === 'response' && !isTyping) {
      // Reset bubble rendered state for new response
      setBubbleRendered(false);
      // Add the entry to typing animations
      setTypingEntries(prev => new Set(prev).add(lastEntry.id));

      // Calculate animation duration based on content length
      const contentLength = lastEntry.content.length;
      const typingDuration = Math.min(3000, Math.max(800, contentLength * 30)); // Min 800ms, max 3s

      // Remove the typing animation after the calculated duration + buffer
      const timer = setTimeout(() => {
        setTypingEntries(prev => {
          const next = new Set(prev);
          next.delete(lastEntry.id);
          return next;
        });
      }, typingDuration + 500); // Animation duration + 500ms buffer

      return () => clearTimeout(timer);
    }
  }, [entries, isTyping]);

  // Auto-copy code from AI responses into editor
  const lastProcessedResponseRef = useRef<string>('');

  useEffect(() => {
    const lastEntry = entries[entries.length - 1];

    // Check if the last entry is a new response with code blocks
    if (lastEntry && lastEntry.type === 'response' && !isTyping && lastEntry.id !== lastProcessedResponseRef.current) {
      lastProcessedResponseRef.current = lastEntry.id;

      // First try to extract fenced code blocks
      const codeFiles = extractCodeBlocksFromText(lastEntry.content);

      if (codeFiles.length > 0) {
        // Found fenced code blocks - use the first one
        setPreviewCode(codeFiles[0].content);
        setShowCodePlayground(true);
      } else {
        // No fenced blocks - try to detect unfenced code in the response
        const content = lastEntry.content;

        // Check for common code patterns (functions, imports, print statements, etc.)
        const codePatterns = [
          /def\s+\w+\s*\(/m,           // Python function
          /print\s*\(/m,                // print statement
          /import\s+\w+/m,              // import
          /function\s+\w+\s*\(/m,       // JS function
          /const\s+\w+\s*=/m,           // JS const
          /console\.log/m,              // console.log
          /class\s+\w+/m,               // class definition
          /#include\s*</m,              // C/C++ include
          /public\s+static\s+void/m,    // Java main
        ];

        const hasCodePattern = codePatterns.some(pattern => pattern.test(content));

        if (hasCodePattern) {
          // Extract code-like content (lines that look like code)
          const lines = content.split('\n');
          const codeLines = lines.filter(line => {
            const trimmed = line.trim();
            // Skip empty lines, markdown headers, and plain text
            if (!trimmed || trimmed.startsWith('#') && !trimmed.startsWith('#include') && !trimmed.startsWith('#!/')) return false;
            if (trimmed.match(/^[A-Z][a-z]+.*:$/)) return false; // Skip "Here's the code:" type lines
            return true;
          });

          if (codeLines.length > 0) {
            setPreviewCode(codeLines.join('\n'));
            setShowCodePlayground(true);
          }
        }
      }
    }
  }, [entries, isTyping, setPreviewCode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // F1 key opens help menu
    if (e.key === 'F1') {
      e.preventDefault();
      setShowHelpMenu(true);
      return;
    }

    // Ctrl+Shift+P opens privacy encoder
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      setShowPrivacyEncoder(true);
      return;
    }

    // qwerty shortcut stops all speech
    if (input.toLowerCase() === 'qwerty') {
      e.preventDefault();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      window.dispatchEvent(new CustomEvent('stop-all-speech'));
      setInput('');
      return;
    }

    // Handle continue prompt with Space or Enter
    if (showContinuePrompt && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      handleContinue();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        processCommand(input.trim());
        setInput('');
        // Reset pagination when new command is entered
        setVisibleEntries(entries.length + 1); // +1 for the new entry that will be added
        // Immediately scroll to show the command entry
        setTimeout(() => {
          scrollToBottom();
        }, 10);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const historyCommand = getHistoryCommand('up');
      if (historyCommand !== null) {
        setInput(historyCommand);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const historyCommand = getHistoryCommand('down');
      if (historyCommand !== null) {
        setInput(historyCommand);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Auto-complete logic could go here
    }
  }, [input, isLoading, processCommand, getHistoryCommand, showContinuePrompt, handleContinue, entries.length, scrollToBottom]);

  const handleVoiceInput = useCallback((transcript: string) => {
    setInput(transcript);
    setTimeout(() => {
      if (transcript.trim()) {
        processCommand(transcript.trim());
        setInput('');
      }
    }, 100);
  }, [processCommand]);

  const formatTimestamp = useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  }, []);

  const getEntryClassName = useCallback((type: string, mode?: string) => {
    switch (type) {
      case 'command':
        return 'text-terminal-highlight';
      case 'response':
        return mode === 'technical' ? 'text-terminal-text' : 'text-terminal-text';
      case 'system':
        return 'text-terminal-highlight';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-terminal-text';
    }
  }, []);

  // Handle command processing results, including new actions
  useEffect(() => {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry && lastEntry.type === 'response' && lastEntry.action) {
      if (lastEntry.action === 'open_spiderfoot') {
        console.log('SpiderFoot action triggered but feature not implemented');
      }
      // Add other action handlers here as needed
    }
  }, [entries]);

  // Memoize components that don't change often
  const MemoizedUserProfile = useMemo(() => memo(UserProfile), []);
  const MemoizedConversationHistory = useMemo(() => memo(ConversationHistory), []);
  const MemoizedDocumentsList = useMemo(() => memo(DocumentsList), []);
  const MemoizedDocumentUpload = useMemo(() => memo(DocumentUpload), []);
  const MemoizedMusicUpload = useMemo(() => memo(MusicUpload), []);
  const MemoizedZorkGame = useMemo(() => memo(ZorkGame), []);
  const MemoizedDTMFDecoder = useMemo(() => memo(DTMFDecoder), []);
  const MemoizedHelpMenu = useMemo(() => memo(HelpMenu), []);
  const MemoizedEncodeDecodeOverlay = useMemo(() => memo(EncodeDecodeOverlay), []);
  const MemoizedCodePreview = useMemo(() => memo(CodePreview), []);
  const MemoizedWebampPlayer = useMemo(() => memo(WebampPlayer), []);
  const MemoizedAJVideoPopup = useMemo(() => memo(AJVideoPopup), []);
  const MemoizedTalkingArchimedes = useMemo(() => memo(TalkingArchimedes), []);
  const MemoizedThinkingAnimation = useMemo(() => memo(ThinkingAnimation), []);
  const MemoizedMatrixRain = useMemo(() => memo(MatrixRain), []);
  const MemoizedDraggableResponse = useMemo(() => memo(DraggableResponse), []);
  const MemoizedPythonIDE = useMemo(() => memo(PythonIDE), []);

  const gradientThemes = ['midnight-gradient', 'twilight-gradient', 'forest-gradient', 'ocean-gradient', 'ember-gradient'];
  const isGradientTheme = gradientThemes.includes(currentTheme);

  // Check if user has set a custom background (from Background Manager)
  // const hasCustomBackground = customBackgroundUrl && customBackgroundUrl.length > 0; // This line seems redundant with the state variable

  // Query for server-stored wallpapers (authenticated users only)
  const { data: serverWallpapers = [] } = useQuery<Wallpaper[]>({
    queryKey: ['/api/wallpapers'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Initialize background from server (authenticated) or localStorage (anonymous)
  useEffect(() => {
    const defaultWallpaper = '/default-wallpaper.png';

    if (isAuthenticated && serverWallpapers.length > 0) {
      // Check for a selected wallpaper from the server
      const selectedWallpaper = serverWallpapers.find(w => w.isSelected);
      if (selectedWallpaper?.dataUrl) {
        console.log('Loading selected background from server');
        setCustomBackgroundUrl(selectedWallpaper.dataUrl);
        localStorage.setItem('terminal-background-url', selectedWallpaper.dataUrl);
        setHasCustomBackground(true);
        return;
      }
    }

    // Fallback to localStorage
    const savedBg = localStorage.getItem('terminal-background-url');

    if (savedBg && savedBg !== 'null' && savedBg !== '' && savedBg !== 'none') {
      console.log('Loading saved background:', savedBg);
      setCustomBackgroundUrl(savedBg);
    } else {
      console.log('Setting default wallpaper');
      setCustomBackgroundUrl(defaultWallpaper);
      localStorage.setItem('terminal-background-url', defaultWallpaper);
    }
    setHasCustomBackground(true);
  }, [isAuthenticated, serverWallpapers]);

  return (
    <div className={`h-screen flex flex-col bg-terminal-bg text-terminal-text font-mono theme-${currentTheme}`}>
      <div className={`terminal-container flex flex-col h-full relative z-0`} style={
        isGradientTheme
          ? { background: 'var(--terminal-bg)' }
          : { backgroundColor: 'var(--terminal-bg)' }
      }>
        {/* Custom Background Layer - works on ALL themes when user sets a custom background */}
        {hasCustomBackground && (
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage: `url(${customBackgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.85,
              imageRendering: 'auto'
            }}
          />
        )}

        {/* Fireflies for midnight theme */}
        {currentTheme === 'midnight-gradient' && (
          <div className="night" style={{ zIndex: 2 }}>
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} className="firefly" />
            ))}
          </div>
        )}

        {/* Matrix Rain Background Effect - with reduced opacity to show wallpaper */}
        <div style={{
          opacity: hasCustomBackground ? 0.3 : 0.05
        }}>
          <MemoizedMatrixRain />
        </div>

        {/* Voice Controls - Fixed at top */}
        <div className="flex-shrink-0">
          <VoiceControls
            onVoiceInput={handleVoiceInput}
            currentMode={currentMode}
            switchMode={switchMode}
            setShowWebamp={setShowWebamp}
            setIsWebampOpen={setIsWebampOpen} // Pass down the state setter
            user={user}
            isAuthenticated={isAuthenticated}
            setShowProfile={setShowProfile}
            setShowUpload={setShowUpload}
            notepads={notepads}
            setNotepads={setNotepads}
            setShowPythonIDE={setShowPythonIDE}
            setShowCodePlayground={setShowCodePlayground}
            showResources={showResources}
          />
        </div>

        {/* Terminal Output and Notepad - Scrollable middle section */}
        <div className="flex-1 min-h-0 relative flex overflow-hidden">
          {/* Terminal Output */}
          <div className="flex-1 min-w-0 relative transition-all duration-200 ease-out">
            <ScrollArea className="h-full" ref={scrollAreaRef}>
              <div
                ref={outputRef}
                className="terminal-output p-2 md:p-4 font-mono text-xs md:text-sm leading-relaxed relative z-10"
                data-testid="terminal-output"
              >
              {entries.slice(0, visibleEntries).map((entry) => (
                <div
                  key={entry.id}
                  className={`mb-2 ${getEntryClassName(entry.type, entry.mode)}`}
                  data-testid={`terminal-entry-${entry.type}`}
                >
                  {entry.type === 'command' && (
                    <div>
                      <span className="text-terminal-highlight">[{formatTimestamp(entry.timestamp)}]</span>
                      <span className="text-terminal-subtle"> $ </span>
                      {entry.content}
                    </div>
                  )}
                  {entry.type === 'response' && (
                    <div className="mt-2">
                      <div className="text-terminal-highlight flex items-center gap-2">
                        <span>ARCHIMEDES v7 {currentMode === 'technical' ? 'PROTOCOL' : currentMode === 'health' ? 'HEALTH' : 'TERMINAL'}</span>
                        {typingEntriesSet.has(entry.id) && (
                          <span className="ai-processing-glyph text-xs">ANALYZING</span>
                        )}
                      </div>
                      <MemoizedDraggableResponse
                        isTyping={typingEntriesSet.has(entry.id)}
                        entryId={entry.id}
                        onBubbleRendered={() => {
                          // Only set for the latest entry
                          if (entry.id === entries[entries.length - 1]?.id) {
                            setBubbleRendered(true);
                          }
                        }}
                      >
                        <div
                          className={`ml-4 mt-1 transition-all duration-300 ${
                            typingEntriesSet.has(entry.id) ? 'typing ai-processing-line' : 'whitespace-pre-wrap'
                          }`}
                          style={typingEntriesSet.has(entry.id) ? {
                            '--steps': entry.content.length,
                            '--type-dur': `${Math.min(3000, Math.max(800, entry.content.length * 30))}ms`
                          } as React.CSSProperties : undefined}
                          dangerouslySetInnerHTML={{ __html: entry.content }}
                        />
                      </MemoizedDraggableResponse>
                    </div>
                  )}
                  {(entry.type === 'system' || entry.type === 'error') && (
                    <div
                      className="whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: entry.content }}
                    />
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="typing-indicator text-terminal-highlight opacity-70" data-testid="typing-indicator">
                  ARCHIMEDES is processing...
                </div>
              )}

              {/* Continue Prompt */}
              {showContinuePrompt && (
                <div className="continue-prompt mt-4 p-3 border border-terminal-highlight rounded bg-terminal-bg">
                  <div className="text-terminal-highlight mb-2 flex items-center">
                    <span className="mr-2">⏸️</span>
                    <span className="terminal-glow">-- More Content Available --</span>
                  </div>
                  <div className="text-terminal-text text-xs mb-3">
                    Showing {visibleEntries} of {entries.length} entries
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      onClick={handleContinue}
                      size="sm"
                      className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors text-xs px-3 py-1"
                      data-testid="button-continue"
                    >
                      Continue (10 more)
                    </Button>
                    <Button
                      onClick={handleShowAll}
                      size="sm"
                      variant="outline"
                      className="bg-transparent border-terminal-subtle text-terminal-text hover:bg-terminal-subtle transition-colors text-xs px-3 py-1"
                      data-testid="button-show-all"
                    >
                      Show All
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

            {/* Command History Popup */}
            <CommandHistory
              history={commandHistory}
              isVisible={showHistory}
              onSelectCommand={setInput}
              onClose={() => setShowHistory(false)}
            />
          </div>

          {/* Notepad Panels - multiple instances */}
          {notepads.map((notepad) => (
            <Notepad
              key={notepad.id}
              notepadId={notepad.id}
              onClose={() => setNotepads(prev => prev.filter(n => n.id !== notepad.id))}
            />
          ))}
        </div>

        {/* Command Input - Fixed at bottom */}
        <div className="flex-shrink-0 p-2 md:p-4 border-t border-terminal-subtle bg-terminal-bg relative z-10">
          <div className="flex items-center gap-1 md:gap-2 relative">
            <span className="text-terminal-highlight md:text-sm hidden sm:inline text-[16px] font-bold">archimedes@terminal:~$</span>
            <span className="text-terminal-highlight font-semibold text-xs sm:hidden">$</span>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none outline-none text-terminal-text font-mono text-xs md:text-sm"
                placeholder="Enter command..."
                autoComplete="off"
                spellCheck={false}
                disabled={isLoading}
                data-testid="input-command"
              />
              <span className="cursor-blink absolute text-terminal-text pointer-events-none text-xs md:text-sm">
                ▋
              </span>
            </div>

            <CSTClock />

            <Button
              onClick={clearTerminal}
              variant="outline"
              size="sm"
              className="px-2 border-terminal-subtle hover:bg-terminal-subtle text-xs bg-transparent text-terminal-text min-h-[44px] flex items-center gap-1"
              data-testid="button-clear-screen"
              title="Clear screen"
            >
              <X className="w-4 h-4" />
            </Button>

            <Button
              onClick={() => setShowHistory(!showHistory)}
              variant="outline"
              size="sm"
              className="px-2 border-terminal-subtle hover:bg-terminal-subtle text-xs bg-transparent text-terminal-text min-h-[44px] flex items-center gap-1"
              data-testid="button-history-toggle"
            >
              <History className="w-4 h-4" />
            </Button>

            <button
              onClick={switchTheme}
              className="cursor-pointer p-1.5 rounded transition-all duration-300 hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center bg-transparent border-2 border-terminal-subtle hover:border-terminal-highlight"
              data-testid="button-theme-toggle"
              aria-label="Switch Theme"
              title="Switch Theme"
            >
              <img
                src={cubesIcon}
                alt="Theme Switcher"
                width="18"
                height="18"
                className="rgb-theme-icon"
              />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Overlays */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4">
          <MemoizedUserProfile onClose={() => setShowProfile(false)} />
        </div>
      )}

      {showConversationHistory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4">
          <MemoizedConversationHistory
            onClose={() => setShowConversationHistory(false)}
            onLoadConversation={loadConversation}
          />
        </div>
      )}

      {/* Knowledge Base Modal - Modified to be draggable and expandable */}
      {showUpload && isAuthenticated && (
        <KnowledgeBaseModal
          onClose={() => setShowUpload(false)}
          initialPosition={kbModalState.position}
          initialSize={kbModalState.size}
          isMaximized={kbModalState.isMaximized}
          onStateChange={setKbModalState}
          uploadTab={uploadTab}
          setUploadTab={setUploadTab}
        >
          {uploadTab === 'list' ? (
            <MemoizedDocumentsList onClose={() => setShowUpload(false)} />
          ) : uploadTab === 'upload' ? (
            <MemoizedDocumentUpload
              onUploadComplete={(document) => {
                setUploadTab('list');
                processCommand(`Echo: Document "${document.originalName}" uploaded successfully! Switching to documents view.`);
              }}
            />
          ) : (
            <MemoizedMusicUpload />
          )}
        </KnowledgeBaseModal>
      )}

      {showZork && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
          <div className="w-full h-full max-w-4xl max-h-full">
            <MemoizedZorkGame
              onClose={() => setShowZork(false)}
            />
          </div>
        </div>
      )}


      {showDTMF && (
        <MemoizedDTMFDecoder onClose={() => setShowDTMF(false)} />
      )}

      {showHelpMenu && (
        <MemoizedHelpMenu
          onClose={() => setShowHelpMenu(false)}
          onSelectCommand={(command) => {
            setInput(command);
            // Optionally auto-execute the command
            setTimeout(() => {
              processCommand(command);
              setInput('');
            }, 100);
          }}
        />
      )}

      {/* Talking Archimedes Character */}
      <MemoizedTalkingArchimedes
        isTyping={isTyping || isSpeaking}
        isSpeaking={isSpeaking}
        currentMessage={entries.length > 0 ? entries[entries.length - 1]?.content : undefined}
      />

      {/* Thinking Animation - shows during AI processing, before typing starts */}
      <MemoizedThinkingAnimation isThinking={isLoading && !isTyping && !isSpeaking} />

      {/* Chat Interface - commented out - component not found */}
      {/* {isAuthenticated && showChat && (
        <MemoizedChatInterface
          isOpen={true}
          onClose={() => setShowChat(false)}
        />
      )} */}

      {/* Sshwifty Interface - commented out - component not found */}
      {/* {showSshwifty && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-[90vw] h-[80vh] bg-terminal-bg border border-terminal-highlight rounded-lg overflow-hidden">
            <MemoizedSshwiftyInterface onClose={() => setShowSshwifty(false)} />
          </div>
        </div>
      )} */}

      {/* MUD Client - commented out - component not found */}
      {/* <MudClient
        isOpen={showMud}
        onClose={() => setShowMud(false)}
      /> */}

      {/* theHarvester OSINT Tool - Removed */}

      {/* SpiderFoot OSINT Tool - commented out - component not found */}
      {/* {showSpiderFoot && (
        <SpiderFoot onClose={() => setShowSpiderFoot(false)} />
      )} */}

      {/* Privacy Encoder */}
      <EncodeDecodeOverlay
        isOpen={showPrivacyEncoder}
        onClose={() => setShowPrivacyEncoder(false)}
      />

      {/* Code Playground - for running code */}
      {showCodePlayground && (
        <CodePlayground
          onClose={() => {
            setShowCodePlayground(false);
            setPreviewCode(null);
          }}
          initialCode={previewCode || undefined}
          currentTheme={currentTheme}
        />
      )}

      {/* Code Preview - for HTML preview only */}
      {previewCode && !showCodePlayground && (
        <CodePreview
          code={previewCode}
          onClose={() => setPreviewCode(null)}
        />
      )}

      {/* Webamp Music Player */}
      <WebampPlayer
        isOpen={showWebamp}
        onClose={() => {
          setShowWebamp(false);
          setIsWebampOpen(false);
        }}
        onOpen={() => setIsWebampOpen(true)}
      />

      {/* AJ Video Player */}
      <AJVideoPopup
        isOpen={showAJVideo}
        onClose={() => setShowAJVideo(false)}
      />

      {/* AJ2 Video Player */}
      <AJ2VideoPopup
        isOpen={showAJ2Video}
        onClose={() => setShowAJ2Video(false)}
      />

      {/* Python IDE */}
      {showPythonIDE && <MemoizedPythonIDE onClose={() => setShowPythonIDE(false)} />}

      {/* Background Manager */}
      {showBackgroundManager && (
        <BackgroundManager
          onClose={() => setShowBackgroundManager(false)}
          onBackgroundChange={(url) => setCustomBackgroundUrl(url)}
        />
      )}

      {/* WebSynth Overlay */}
      {showWebSynth && (
        <WebSynth onClose={() => setShowWebSynth(false)} />
      )}
    </div>
  );
}