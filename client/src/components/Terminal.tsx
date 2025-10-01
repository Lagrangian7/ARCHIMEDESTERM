import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { VoiceControls } from './VoiceControls';
import { CommandHistory } from './CommandHistory';
import { UserProfile } from './UserProfile';
import { ConversationHistory } from './ConversationHistory';
import { DocumentUpload } from './DocumentUpload';
import { DocumentsList } from './DocumentsList';
import ZorkGame from './ZorkGame';
import { DTMFDecoder } from './DTMFDecoder';
import { HelpMenu } from './HelpMenu';
import { TalkingArchimedes } from './TalkingArchimedes';
import { ThinkingAnimation } from './ThinkingAnimation';
import { MatrixRain } from './MatrixRain';
import { RadioCharacter } from './RadioCharacter';
import { DraggableResponse } from './DraggableResponse';
import { ChatInterface } from './ChatInterface';
import { PuzzleScreensaver } from './PuzzleScreensaver';
import { SshwiftyInterface } from './SshwiftyInterface';
import { MudClient } from './MudClient';
import { TheHarvester } from './TheHarvester';
import { EncodeDecodeOverlay } from './EncodeDecodeOverlay';
import { useTerminal } from '@/hooks/use-terminal';
import { useSpeech } from '@/contexts/SpeechContext';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useActivityTracker } from '@/hooks/use-activity-tracker';
import { History, User, LogIn, Upload, Terminal as TerminalIcon, Radio, MessageSquare, Shield, Gamepad2 } from 'lucide-react';
import logoImage from '@assets/5721242-200_1756549869080.png';
import terminalWatermark from '@assets/wally new_1757883178780.jpeg';
import cubesIcon from '@assets/cubes_1758505065526.png';
import invadersIcon from '@assets/invaders_1758659503566.png';

// Logo Component
const LogoIcon = () => (
  <img 
    src={logoImage} 
    alt="ARCHIMEDES Logo" 
    width="32" 
    height="32" 
    className="logo-icon"
    style={{
      display: 'block',
      visibility: 'visible',
      opacity: 1,
      backgroundColor: 'var(--terminal-logo-green)',
      border: '2px solid var(--terminal-logo-orange)',
      borderRadius: '6px',
      animation: 'logoGlow 1.5s ease-in-out infinite',
      boxShadow: '0 0 8px var(--terminal-logo-green), 0 0 16px var(--terminal-logo-green)'
    }}
  />
);

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
  } = useTerminal(() => {
    if (isAuthenticated) {
      setShowUpload(true);
    }
  });

  // Expose modal openers globally
  useEffect(() => {
    (window as any).openZorkGame = () => setShowZork(true);
    (window as any).openDTMFDecoder = () => setShowDTMF(true);
    (window as any).openHelpMenu = () => setShowHelpMenu(true);
    (window as any).openChatInterface = () => setShowChat(true);
    (window as any).activateScreensaver = () => setScreensaverActive(true);
    (window as any).openSshwiftyInterface = () => setShowSshwifty(true);
    (window as any).openMudClient = () => setShowMud(true);
    (window as any).openTheHarvester = () => setShowTheHarvester(true);
    (window as any).openPrivacyEncoder = () => setShowPrivacyEncoder(true);
  }, []);
  
  const { speak, isSpeaking } = useSpeech();
  const { user, isAuthenticated, preferences } = useAuth();
  const { unreadCount } = useChat();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState<'upload' | 'list'>('list');
  const [typingEntries, setTypingEntries] = useState<Set<string>>(new Set());
  const [showZork, setShowZork] = useState(false);
  const [showDTMF, setShowDTMF] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showSshwifty, setShowSshwifty] = useState(false);
  const [showMud, setShowMud] = useState(false);
  const [showTheHarvester, setShowTheHarvester] = useState(false);
  const [showPrivacyEncoder, setShowPrivacyEncoder] = useState(false);
  
  // Persistent draggable bubbles that survive clear command
  const [persistentBubbles, setPersistentBubbles] = useState<Map<string, { content: string, mode?: string }>>(new Map());
  
  // Theme management
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('terminal-theme') || 'green';
  });

  // Switch theme function
  const switchTheme = () => {
    const themes = ['green', 'blue', 'orange', 'red', 'blackwhite', 'greyscale'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setCurrentTheme(nextTheme);
    localStorage.setItem('terminal-theme', nextTheme);
  };
  
  // Screensaver state
  const [screensaverActive, setScreensaverActive] = useState(false);
  
  // Radio streaming controls - direct playback without modal
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [radioStatus, setRadioStatus] = useState('Radio ready');
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Activity tracker for screensaver (5 minutes = 300,000ms)
  const { forceActive } = useActivityTracker({
    inactivityTimeout: 5 * 60 * 1000, // 5 minutes
    onInactive: () => setScreensaverActive(true),
    onActive: () => setScreensaverActive(false)
  });

  // Set radio volume on mount
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.7; // Set volume to 70% (decreased by 30%)
    }
  }, []);
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
  }, [entries, isTyping, showContinuePrompt, scrollToBottom]);

  // Additional scroll trigger for when responses are being drawn
  useEffect(() => {
    if (isTyping) {
      scrollToBottom();
    }
  }, [isTyping, scrollToBottom]);

  const handleContinue = () => {
    setVisibleEntries(Math.min(visibleEntries + 10, entries.length)); // Show 10 more entries
    setShowContinuePrompt(false);
    
    // Auto-scroll after showing more content
    setTimeout(() => {
      scrollToBottom();
    }, 50);
  };

  const handleShowAll = () => {
    setVisibleEntries(entries.length);
    setShowContinuePrompt(false);
    
    // Auto-scroll after showing all content
    setTimeout(() => {
      scrollToBottom();
    }, 50);
  };

  // Focus input on mount and clicks
  useEffect(() => {
    const handleClick = () => {
      inputRef.current?.focus();
    };
    
    document.addEventListener('click', handleClick);
    inputRef.current?.focus();
    
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Auto-speak responses and system messages
  useEffect(() => {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry && (lastEntry.type === 'response' || lastEntry.type === 'system')) {
      speak(lastEntry.content);
    }
  }, [entries, speak]);

  // Handle typing animation for new response entries
  useEffect(() => {
    const lastEntry = entries[entries.length - 1];
    
    // If the last entry is a response and we're not currently typing (meaning it's a new response)
    if (lastEntry && lastEntry.type === 'response' && !isTyping) {
      // Add the entry to typing animations
      setTypingEntries(prev => new Set(prev).add(lastEntry.id));
      
      // Add to persistent bubbles so it survives clear command
      setPersistentBubbles(prev => {
        const next = new Map(prev);
        next.set(lastEntry.id, { content: lastEntry.content, mode: lastEntry.mode });
        return next;
      });
      
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

  const handleVoiceInput = (transcript: string) => {
    setInput(transcript);
    setTimeout(() => {
      if (transcript.trim()) {
        processCommand(transcript.trim());
        setInput('');
      }
    }, 100);
  };

  // Handler to dismiss persistent bubbles
  const handleDismissBubble = useCallback((bubbleId: string) => {
    setPersistentBubbles(prev => {
      const next = new Map(prev);
      next.delete(bubbleId);
      return next;
    });
  }, []);

  // Direct radio toggle function
  const toggleRadio = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isRadioPlaying) {
      audio.pause();
      setRadioStatus('Radio stopped');
    } else {
      // Use the working SomaFM stream directly
      audio.src = 'https://ice6.somafm.com/live-128-mp3';
      audio.volume = 0.7; // Set volume to 30% (decreased by 30% from 100%)
      setRadioStatus('Connecting to radio...');
      
      try {
        await audio.play();
        setRadioStatus('Radio playing');
      } catch (error) {
        console.error('Radio play failed:', error);
        setRadioStatus('Radio connection failed');
      }
    }
  };

  // Launch SPACEWAR game
  const launchSpacewars = () => {
    try {
      const gameWindow = window.open('/spacewar.html?v=' + Date.now(), '_blank', 'width=1200,height=800,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no');
      if (!gameWindow) {
        // If popup was blocked, show a message
        console.warn('Popup blocked - SPACEWAR game could not open');
      }
    } catch (error) {
      console.error('Error launching SPACEWAR:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEntryClassName = (type: string, mode?: string) => {
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
  };

  return (
    <div className="h-screen flex flex-col bg-terminal-bg text-terminal-text font-mono">
      <div className={`terminal-container theme-${currentTheme} flex flex-col h-full relative z-0`}>
        
        {/* Matrix Rain Background Effect */}
        <MatrixRain />

        {/* Background Watermark - Centered and Large */}
        <div className="absolute inset-0 z-[5] flex items-center justify-center">
          <div 
            className="watermark-background watermark-glitch watermark-glitch-red watermark-glitch-cyan watermark-noise opacity-15"
            style={{
              backgroundImage: `url(${terminalWatermark})`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              width: '400px',
              height: '400px',
            }}
          />
        </div>
        
        {/* Header - Fixed at top */}
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-terminal-subtle bg-terminal-bg relative z-10">
          <div className="flex items-center space-x-4">
            <LogoIcon />
            <div>
              <h1 className="font-bold terminal-text terminal-glow text-[15px]" data-testid="text-title">
                ARCHIMEDES v7
              </h1>
              <div className="text-xs text-terminal-highlight">
            
                {user && (
                  <span className="ml-2 text-green-300">
                    | {user.firstName || user.email?.split('@')[0] || 'User'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* User Controls */}
            <div className="flex items-center space-x-2">
              {isAuthenticated ? (
                <>
                  <Button
                    onClick={() => setShowProfile(true)}
                    variant="outline"
                    size="sm"
                    className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors h-auto px-2 py-1 text-xs"
                    data-testid="button-user-profile"
                  >
                    <User size={14} className="mr-1" />
                    Profile
                  </Button>
                  <Button
                    onClick={() => setShowUpload(true)}
                    variant="outline"
                    size="sm"
                    className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors h-auto px-2 py-1 text-xs"
                    data-testid="button-upload"
                  >
                    <Upload size={14} className="mr-1" />
                    Upload
                  </Button>
                  <Button
                    onClick={() => setShowChat(true)}
                    variant="outline"
                    size="sm"
                    className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors h-auto px-2 py-1 text-xs relative"
                    data-testid="button-chat"
                  >
                    <MessageSquare size={14} className="mr-1" />
                    Chat
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                  <Button
                    onClick={toggleRadio}
                    variant="outline"
                    size="sm"
                    className={`transition-colors h-auto px-2 py-1 text-xs ${
                      isRadioPlaying 
                        ? 'bg-[#00FF41] border-[#00FF41] text-black' 
                        : 'bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black'
                    }`}
                    data-testid="button-radio"
                  >
                    <Radio size={14} className="mr-1" />
                    {isRadioPlaying ? 'Stop' : 'Radio'}
                  </Button>
                  <Button
                    onClick={() => setShowSshwifty(true)}
                    variant="outline"
                    size="sm"
                    className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors h-auto px-2 py-1 text-xs"
                    data-testid="button-sshwifty"
                  >
                    <TerminalIcon size={14} className="mr-1" />
                    SSH/Telnet
                  </Button>
                  <Button
                    onClick={() => setShowPrivacyEncoder(true)}
                    variant="outline"
                    size="sm"
                    className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors h-auto px-2 py-1 text-xs"
                    data-testid="button-privacy"
                  >
                    <Shield size={14} className="mr-1" />
                    Privacy
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => window.location.href = '/api/login'}
                  variant="outline"
                  size="sm"
                  className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors h-auto px-2 py-1 text-xs"
                  data-testid="button-login"
                >
                  <LogIn size={14} className="mr-1" />
                  Log In
                </Button>
              )}
              
              {/* SPACEWAR Game - Available to all users */}
              <Button
                onClick={launchSpacewars}
                variant="outline"
                size="sm"
                className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors h-auto px-2 py-1 text-xs"
                data-testid="button-spacewars"
                title="Launch SPACEWAR Game"
              >
                <img src={invadersIcon} alt="SPACEWAR" className="h-4" />
              </Button>
            </div>
            
            {/* Mode Switcher */}
            <div className="flex items-center space-x-2 px-3 py-1 border border-terminal-subtle rounded">
              <span className="text-xs">MODE:</span>
              <Button
                onClick={() => switchMode(currentMode === 'natural' ? 'technical' : 'natural')}
                variant="ghost"
                size="sm"
                className="text-terminal-highlight hover:text-terminal-text transition-colors font-semibold h-auto p-0 text-xs"
                data-testid="button-mode-toggle"
              >
                {currentMode === 'natural' ? 'NATURAL CHAT' : 'TECHNICAL MODE'}
              </Button>
            </div>
            
            {/* RGB Theme Switcher */}
            <div 
              onClick={switchTheme}
              className="cursor-pointer p-2 rounded transition-all duration-300 hover:scale-110"
              data-testid="button-theme-toggle"
            >
              <img 
                src={cubesIcon}
                alt="Theme Switcher"
                width="24"
                height="24"
                className="rgb-theme-icon"
              />
            </div>
          </div>
        </header>

        {/* Voice Controls - Fixed below header */}
        <div className="flex-shrink-0">
          <VoiceControls onVoiceInput={handleVoiceInput} />
        </div>

        {/* Terminal Output - Scrollable middle section */}
        <div className="flex-1 min-h-0 relative">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div 
              ref={outputRef}
              className="terminal-output p-4 font-mono text-sm leading-relaxed relative z-10"
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
                      <div className="text-terminal-highlight">
                        ARCHIMEDES v7 {entry.mode === 'technical' ? '(Technical Mode)' : '(Natural Chat Mode)'}:
                      </div>
                      <div 
                        className={`ml-4 mt-1 ${
                          typingEntries.has(entry.id) ? 'typing' : 'whitespace-pre-wrap'
                        }`}
                        style={typingEntries.has(entry.id) ? {
                          '--steps': entry.content.length,
                          '--type-dur': `${Math.min(3000, Math.max(800, entry.content.length * 30))}ms`
                        } as React.CSSProperties : undefined}
                      >
                        {entry.content}
                      </div>
                    </div>
                  )}
                  {(entry.type === 'system' || entry.type === 'error') && (
                    <div className="whitespace-pre-wrap">{entry.content}</div>
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
                <div className="continue-prompt mt-4 p-3 border border-terminal-highlight rounded bg-terminal-bg/50">
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

        {/* Command Input - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-terminal-subtle bg-terminal-bg relative z-10">
          <div className="flex items-center space-x-2 relative">
            <span className="text-terminal-highlight font-semibold">archimedes@terminal:~$</span>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-none outline-none text-terminal-text font-mono"
                placeholder="Enter command or message..."
                autoComplete="off"
                spellCheck={false}
                disabled={isLoading}
                data-testid="input-command"
              />
              <span className="cursor-blink absolute text-terminal-text pointer-events-none">
                ▋
              </span>
            </div>
            
            <Button
              onClick={() => setShowHistory(!showHistory)}
              variant="outline"
              size="sm"
              className="px-2 py-1 border-terminal-subtle hover:bg-terminal-subtle text-xs h-7 bg-transparent text-terminal-text"
              data-testid="button-history-toggle"
            >
              <History className="w-3 h-3 mr-1" />
              HISTORY
            </Button>
          </div>
        </div>
      </div>
      
      {/* Modal Overlays */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <UserProfile onClose={() => setShowProfile(false)} />
        </div>
      )}
      
      {showConversationHistory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <ConversationHistory 
            onClose={() => setShowConversationHistory(false)}
            onLoadConversation={loadConversation}
          />
        </div>
      )}

      {showUpload && isAuthenticated && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0D1117] border border-[#00FF41]/20 rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#00FF41] font-mono">
                Knowledge Base Manager
              </h2>
              <Button
                onClick={() => setShowUpload(false)}
                variant="ghost"
                size="sm"
                className="text-terminal-text hover:text-[#00FF41]"
                data-testid="close-upload-modal"
              >
                ×
              </Button>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex space-x-2 mb-6 border-b border-[#00FF41]/20">
              <Button
                onClick={() => setUploadTab('list')}
                variant={uploadTab === 'list' ? 'default' : 'ghost'}
                size="sm"
                className={uploadTab === 'list' 
                  ? 'bg-[#00FF41] text-black border-b-2 border-[#00FF41] rounded-b-none' 
                  : 'text-[#00FF41] hover:text-black hover:bg-[#00FF41]/20 border-b-2 border-transparent'
                }
                data-testid="tab-documents-list"
              >
                📂 My Documents
              </Button>
              <Button
                onClick={() => setUploadTab('upload')}
                variant={uploadTab === 'upload' ? 'default' : 'ghost'}
                size="sm"
                className={uploadTab === 'upload' 
                  ? 'bg-[#00FF41] text-black border-b-2 border-[#00FF41] rounded-b-none' 
                  : 'text-[#00FF41] hover:text-black hover:bg-[#00FF41]/20 border-b-2 border-transparent'
                }
                data-testid="tab-upload-documents"
              >
                ⬆️ Upload New
              </Button>
            </div>
            
            {/* Tab Content */}
            {uploadTab === 'list' ? (
              <DocumentsList onClose={() => setShowUpload(false)} />
            ) : (
              <DocumentUpload 
                onUploadComplete={(document) => {
                  // Switch to documents list to show the uploaded file
                  setUploadTab('list');
                  // Add success entry to terminal
                  processCommand(`Echo: Document "${document.originalName}" uploaded successfully! Switching to documents view.`);
                }}
              />
            )}
          </div>
        </div>
      )}



      {showZork && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
          <div className="w-full h-full max-w-4xl max-h-full">
            <ZorkGame 
              onClose={() => setShowZork(false)}
            />
          </div>
        </div>
      )}


      {showDTMF && (
        <DTMFDecoder onClose={() => setShowDTMF(false)} />
      )}

      {showHelpMenu && (
        <HelpMenu 
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
      {/* Hidden radio audio element */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="metadata"
        onPlay={() => setIsRadioPlaying(true)}
        onPause={() => setIsRadioPlaying(false)}
        onError={() => {
          setIsRadioPlaying(false);
          setRadioStatus('Radio connection failed');
        }}
        onLoadStart={() => setRadioStatus('Connecting to radio...')}
        onCanPlay={() => setRadioStatus('Radio connected')}
      />

      {/* Talking Archimedes Character */}
      <TalkingArchimedes 
        isTyping={isTyping}
        isSpeaking={isSpeaking}
        currentMessage={entries.length > 0 ? entries[entries.length - 1]?.content : undefined}
      />

      {/* Thinking Animation - shows during AI processing, before typing starts */}
      <ThinkingAnimation isThinking={isLoading && !isTyping && !isSpeaking} />

      {/* Radio Character - appears when radio is playing */}
      <RadioCharacter 
        isRadioPlaying={isRadioPlaying}
      />

      {/* Chat Interface */}
      {isAuthenticated && (
        <ChatInterface 
          isOpen={showChat}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Sshwifty Interface */}
      {showSshwifty && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="w-[90vw] h-[80vh] bg-terminal-bg border border-terminal-highlight rounded-lg overflow-hidden">
            <SshwiftyInterface onClose={() => setShowSshwifty(false)} />
          </div>
        </div>
      )}

      {/* MUD Client */}
      <MudClient 
        isOpen={showMud}
        onClose={() => setShowMud(false)}
      />

      {/* theHarvester OSINT Tool */}
      {showTheHarvester && (
        <TheHarvester onClose={() => setShowTheHarvester(false)} />
      )}

      {/* Privacy Encoder */}
      <EncodeDecodeOverlay 
        isOpen={showPrivacyEncoder}
        onClose={() => setShowPrivacyEncoder(false)}
      />

      {/* Puzzle Screensaver */}
      <PuzzleScreensaver 
        isActive={screensaverActive}
        onExit={() => {
          setScreensaverActive(false);
          forceActive();
        }}
      />

      {/* Persistent Draggable Bubbles - survive clear command */}
      {Array.from(persistentBubbles.entries()).map(([bubbleId, bubble]) => (
        <DraggableResponse
          key={bubbleId}
          isTyping={typingEntries.has(bubbleId)}
          entryId={bubbleId}
          onDismiss={() => handleDismissBubble(bubbleId)}
          alwaysFloating={true}
        >
          <div className="text-terminal-text font-mono text-sm leading-relaxed">
            {bubble.content}
          </div>
        </DraggableResponse>
      ))}
    </div>
  );
}
