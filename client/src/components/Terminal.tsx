import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { VoiceControls } from './VoiceControls';
import { CommandHistory } from './CommandHistory';
import { UserProfile } from './UserProfile';
import { ConversationHistory } from './ConversationHistory';
import { DocumentUpload } from './DocumentUpload';
import { useTerminal } from '@/hooks/use-terminal';
import { useSpeechSynthesis } from '@/hooks/use-speech';
import { useAuth } from '@/hooks/useAuth';
import { History, User, LogIn, Upload } from 'lucide-react';
import skullWatermark from '@assets/wally_1756523512970.jpg';
import logoImage from '@assets/5721242-200_1756549869080.png';

// Logo Component
const LogoIcon = () => (
  <img 
    src={logoImage} 
    alt="ARCHIMEDES Logo" 
    width="32" 
    height="32" 
    className="logo-icon filter brightness-150 contrast-125 hue-rotate-12 drop-shadow-lg"
    style={{
      filter: 'brightness(1.3) contrast(1.2) hue-rotate(25deg) drop-shadow(0 0 8px var(--terminal-orange))'
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
  
  const { speak } = useSpeechSynthesis();
  const { user, isAuthenticated, preferences } = useAuth();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [entries, isTyping]);

  // Focus input on mount and clicks
  useEffect(() => {
    const handleClick = () => {
      inputRef.current?.focus();
    };
    
    document.addEventListener('click', handleClick);
    inputRef.current?.focus();
    
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Auto-speak responses
  useEffect(() => {
    const lastEntry = entries[entries.length - 1];
    if (lastEntry && lastEntry.type === 'response') {
      speak(lastEntry.content);
    }
  }, [entries, speak]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        processCommand(input.trim());
        setInput('');
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
      <div className="terminal-container flex flex-col h-full relative z-0">
        
        {/* Background Watermark */}
        <div 
          className="watermark-background absolute inset-0 z-0 opacity-20"
          style={{
            backgroundImage: `url(${skullWatermark})`,
            backgroundSize: '60%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        
        {/* Header - Fixed at top */}
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-terminal-subtle bg-terminal-bg relative z-10">
          <div className="flex items-center space-x-4">
            <LogoIcon />
            <div>
              <h1 className="text-xl font-bold terminal-text terminal-glow" data-testid="text-title">
                ARCHIMEDES v7
              </h1>
              <div className="text-xs text-terminal-highlight">
                AI Terminal Interface
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
                    onClick={() => setShowConversationHistory(true)}
                    variant="outline"
                    size="sm"
                    className="bg-black border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors h-auto px-2 py-1 text-xs"
                    data-testid="button-conversation-history"
                  >
                    <History size={14} className="mr-1" />
                    History
                  </Button>
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
          </div>
        </header>

        {/* Voice Controls - Fixed below header */}
        <div className="flex-shrink-0">
          <VoiceControls onVoiceInput={handleVoiceInput} />
        </div>

        {/* Terminal Output - Scrollable middle section */}
        <div className="flex-1 min-h-0 relative">
          <ScrollArea className="h-full">
            <div 
              ref={outputRef}
              className="terminal-output p-4 font-mono text-sm leading-relaxed relative z-10"
              data-testid="terminal-output"
            >
              {entries.map((entry) => (
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
                      <div className="ml-4 mt-1 whitespace-pre-wrap">{entry.content}</div>
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
          <div className="bg-[#0D1117] border border-[#00FF41]/20 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#00FF41] font-mono">
                Knowledge Base Upload
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
            
            <DocumentUpload 
              onUploadComplete={(document) => {
                // Close modal after successful upload
                setShowUpload(false);
                // Add success entry to terminal
                processCommand(`Echo: Document "${document.originalName}" uploaded successfully!`);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
