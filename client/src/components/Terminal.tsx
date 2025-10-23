import { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { LinkifiedText } from '@/lib/linkify';
import { SshwiftyInterface } from './SshwiftyInterface';
import { MudClient } from './MudClient';
import { TheHarvester } from './TheHarvester';
import { EncodeDecodeOverlay } from './EncodeDecodeOverlay';
import { CodePreview } from './CodePreview';
import WebampPlayer from './WebampPlayer';
import { useTerminal } from '@/hooks/use-terminal';
import { useSpeech } from '@/contexts/SpeechContext';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useActivityTracker } from '@/hooks/use-activity-tracker';
import { History, User, LogIn, Upload, Terminal as TerminalIcon, Radio, MessageSquare, Shield, Gamepad2, CassetteTape } from 'lucide-react';
import logoImage from '@assets/5721242-200_1756549869080.png';
import cubesIcon from '@assets/cubes_1758505065526.png';
import invadersIcon from '@assets/invaders_1758659503566.png';
import archyLogo from '@assets/archy111_1760233943010.jpeg';
import watermarkImage from '@assets/archi watermark_1761255886679.png';

// Logo Component
export const LogoIcon = () => (
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
    previewCode,
    setPreviewCode,
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
    (window as any).openWebamp = () => setShowWebamp(true);
  }, []);
  
  const { speak, isSpeaking } = useSpeech();
  const { user, isAuthenticated, preferences } = useAuth();
  const { unreadCount } = useChat({ enableWebSocket: false });
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
  const [showWebamp, setShowWebamp] = useState(false);
  
  // Theme management
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('terminal-theme') || 'blue';
  });

  // Switch theme function
  const switchTheme = () => {
    const themes = ['green', 'blue', 'orange', 'red', 'blackwhite', 'greyscale', 'patriot', 'solarized'];
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
    <div className={`h-screen flex flex-col bg-terminal-bg text-terminal-text font-mono theme-${currentTheme}`}>
      <div className={`terminal-container flex flex-col h-full relative z-0`}>
        {/* Matrix Rain Background Effect */}
        <MatrixRain />

        {/* Voice Controls - Fixed at top */}
        <div className="flex-shrink-0">
          <VoiceControls 
            onVoiceInput={handleVoiceInput}
            currentMode={currentMode}
            switchMode={switchMode}
            switchTheme={switchTheme}
            setShowWebamp={setShowWebamp}
            user={user}
            isAuthenticated={isAuthenticated}
            setShowProfile={setShowProfile}
            setShowUpload={setShowUpload}
            setShowChat={setShowChat}
            toggleRadio={toggleRadio}
            isRadioPlaying={isRadioPlaying}
            setShowSshwifty={setShowSshwifty}
            setShowPrivacyEncoder={setShowPrivacyEncoder}
            unreadCount={unreadCount}
          />
        </div>

        {/* Terminal Output - Scrollable middle section */}
        <div className="flex-1 min-h-0 relative">
          {/* Watermark Background */}
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
            style={{
              backgroundImage: `url(${watermarkImage})`,
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: 'contain',
              opacity: 0.08,
              maxWidth: '600px',
              margin: '0 auto',
            }}
          />
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
                      <div className="text-terminal-highlight">
                        ARCHIMEDES v7 {entry.mode === 'technical' ? '(Technical Mode)' : '(Natural Chat Mode)'}:
                      </div>
                      <DraggableResponse 
                        isTyping={typingEntries.has(entry.id)} 
                        entryId={entry.id}
                      >
                        <div 
                          className={`ml-4 mt-1 ${
                            typingEntries.has(entry.id) ? 'typing' : 'whitespace-pre-wrap'
                          }`}
                          style={typingEntries.has(entry.id) ? {
                            '--steps': entry.content.length,
                            '--type-dur': `${Math.min(3000, Math.max(800, entry.content.length * 30))}ms`
                          } as React.CSSProperties : undefined}
                        >
                          <LinkifiedText>{entry.content}</LinkifiedText>
                        </div>
                      </DraggableResponse>
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
        <div className="flex-shrink-0 p-2 md:p-4 border-t border-terminal-subtle bg-terminal-bg relative z-10">
          <div className="flex items-center gap-1 md:gap-2 relative">
            <span className="text-terminal-highlight font-semibold text-[10px] md:text-sm hidden sm:inline">archimedes@terminal:~$</span>
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
            
            <Button
              onClick={() => setShowHistory(!showHistory)}
              variant="outline"
              size="sm"
              className="px-2 border-terminal-subtle hover:bg-terminal-subtle text-xs bg-transparent text-terminal-text min-h-[44px] flex items-center gap-1"
              data-testid="button-history-toggle"
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">HISTORY</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Modal Overlays */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4">
          <UserProfile onClose={() => setShowProfile(false)} />
        </div>
      )}
      
      {showConversationHistory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4">
          <ConversationHistory 
            onClose={() => setShowConversationHistory(false)}
            onLoadConversation={loadConversation}
          />
        </div>
      )}

      {showUpload && isAuthenticated && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="border rounded-lg p-3 md:p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto" style={{
            backgroundColor: 'var(--terminal-bg)',
            borderColor: 'rgba(var(--terminal-subtle-rgb), 0.2)'
          }}>
            <div className="flex justify-between items-center mb-3 md:mb-6">
              <h2 className="text-sm md:text-xl font-bold font-mono" style={{ color: 'var(--terminal-text)' }}>
                Knowledge Base Manager
              </h2>
              <Button
                onClick={() => setShowUpload(false)}
                variant="ghost"
                size="sm"
                className="text-xl md:text-2xl"
                style={{ color: 'var(--terminal-text)' }}
                data-testid="close-upload-modal"
              >
                ×
              </Button>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex gap-1 md:gap-2 mb-3 md:mb-6 border-b" style={{ borderColor: 'rgba(var(--terminal-subtle-rgb), 0.2)' }}>
              <Button
                onClick={() => setUploadTab('list')}
                variant={uploadTab === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="text-xs md:text-sm"
                style={uploadTab === 'list' 
                  ? { 
                      backgroundColor: 'var(--terminal-highlight)', 
                      color: 'var(--terminal-bg)', 
                      borderBottom: '2px solid var(--terminal-highlight)', 
                      borderRadius: '0.375rem 0.375rem 0 0' 
                    } 
                  : { 
                      color: 'var(--terminal-text)', 
                      borderBottom: '2px solid transparent' 
                    }
                }
                data-testid="tab-documents-list"
              >
                <span className="hidden sm:inline">📂 My Documents</span>
                <span className="sm:hidden">📂 Docs</span>
              </Button>
              <Button
                onClick={() => setUploadTab('upload')}
                variant={uploadTab === 'upload' ? 'default' : 'ghost'}
                size="sm"
                className="text-xs md:text-sm"
                style={uploadTab === 'upload' 
                  ? { 
                      backgroundColor: 'var(--terminal-highlight)', 
                      color: 'var(--terminal-bg)', 
                      borderBottom: '2px solid var(--terminal-highlight)', 
                      borderRadius: '0.375rem 0.375rem 0 0' 
                    } 
                  : { 
                      color: 'var(--terminal-text)', 
                      borderBottom: '2px solid transparent' 
                    }
                }
                data-testid="tab-upload-documents"
              >
                <span className="hidden sm:inline">⬆️ Upload New</span>
                <span className="sm:hidden">⬆️ Upload</span>
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
      {isAuthenticated && showChat && (
        <ChatInterface 
          isOpen={true}
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

      {/* Code Preview */}
      {previewCode && (
        <CodePreview 
          code={previewCode}
          onClose={() => setPreviewCode(null)}
        />
      )}

      {/* Webamp Music Player */}
      <WebampPlayer 
        isOpen={showWebamp}
        onClose={() => setShowWebamp(false)}
      />
    </div>
  );
}
