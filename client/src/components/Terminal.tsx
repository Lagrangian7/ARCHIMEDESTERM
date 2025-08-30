import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { VoiceControls } from './VoiceControls';
import { CommandHistory } from './CommandHistory';
import { useTerminal } from '@/hooks/use-terminal';
import { useSpeechSynthesis } from '@/hooks/use-speech';
import { History } from 'lucide-react';
import skullWatermark from '@assets/wally_1756523512970.jpg';

// Brain Circuit SVG Component
const BrainIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" className="text-terminal-orange fill-current brain-icon">
    <path d="M16 2C8.3 2 2 8.3 2 16s6.3 14 14 14 14-6.3 14-14S23.7 2 16 2zm0 25c-6.1 0-11-4.9-11-11S9.9 5 16 5s11 4.9 11 11-4.9 11-11 11z"/>
    <circle cx="8" cy="12" r="1.5" className="fill-current"/>
    <circle cx="16" cy="8" r="1.5" className="fill-current"/>
    <circle cx="24" cy="12" r="1.5" className="fill-current"/>
    <circle cx="12" cy="20" r="1.5" className="fill-current"/>
    <circle cx="20" cy="20" r="1.5" className="fill-current"/>
    <path d="M8 12h4M12 8h4M16 8v4M16 12h4M20 12v4M16 12v4M12 16h4" stroke="currentColor" strokeWidth="1" fill="none"/>
  </svg>
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
  } = useTerminal();
  
  const { speak } = useSpeechSynthesis();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
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
        
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-terminal-subtle bg-opacity-90 relative z-10">
          <div className="flex items-center space-x-4">
            <BrainIcon />
            <div>
              <h1 className="text-xl font-bold terminal-text terminal-glow" data-testid="text-title">
                ARCHIMEDES v7
              </h1>
              <div className="text-xs text-terminal-highlight">AI Terminal Interface</div>
            </div>
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
        </header>

        {/* Voice Controls */}
        <VoiceControls onVoiceInput={handleVoiceInput} />

        {/* Terminal Output */}
        <div className="flex-1 relative">
          <ScrollArea className="h-full">
            <div 
              ref={outputRef}
              className="terminal-output p-4 font-mono text-sm leading-relaxed relative z-10 min-h-full"
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

        {/* Command Input */}
        <div className="p-4 border-t border-terminal-subtle relative z-10">
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
    </div>
  );
}
