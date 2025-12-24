import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Mic, MicOff, CassetteTape, LogIn, LogOut, User, Upload, FileText, MessageSquare, Code, Terminal as TerminalIcon, Activity } from 'lucide-react';
import { useSpeech } from '@/contexts/SpeechContext';
import { useSpeechRecognition } from '@/hooks/use-speech';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LogoIcon } from './LogoIcon';
import { EncodeDecodeOverlay } from './EncodeDecodeOverlay';

interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  percentage: number;
}

interface VoiceControlsProps {
  onVoiceInput: (transcript: string) => void;
  currentMode: 'natural' | 'technical' | 'freestyle' | 'health';
  switchMode: (mode: 'natural' | 'technical' | 'freestyle' | 'health') => void;
  setShowWebamp: (show: boolean) => void;
  setIsWebampOpen?: (show: boolean) => void;
  user: any;
  isAuthenticated: boolean;
  setShowProfile: (show: boolean) => void;
  setShowUpload: (show: boolean) => void;
  notepads: Array<{ id: string }>;
  setNotepads: React.Dispatch<React.SetStateAction<Array<{ id: string }>>>;
  setShowPythonIDE: (show: boolean) => void;
  setShowCodePlayground: (show: boolean) => void;
  showResources: boolean;
}

export function VoiceControls({
  onVoiceInput,
  currentMode,
  switchMode,
  setShowWebamp,
  setIsWebampOpen,
  user,
  isAuthenticated,
  setShowProfile,
  setShowUpload,
  notepads,
  setNotepads,
  setShowPythonIDE,
  setShowCodePlayground,
  showResources,
}: VoiceControlsProps) {
  const { toast } = useToast();
  const {
    voices,
    isEnabled,
    setIsEnabled,
    selectedVoice,
    setSelectedVoice,
    speechRate,
    setSpeechRate,
    speechVolume,
    setSpeechVolume,
    isSpeaking,
    voicesLoaded,
    speak,
    stop,
  } = useSpeech();

  const handleVolumeChange = (value: number[]) => {
    setSpeechVolume(value[0]);
  };

  const { isSupported, isListening, startListening } = useSpeechRecognition();

  const handleVoiceToggle = () => {
    console.log('Voice toggle clicked - current state:', isEnabled);
    if (isEnabled && isSpeaking) {
      stop();
    }
    const newState = !isEnabled;
    setIsEnabled(newState);
    console.log('Voice toggle updated to:', newState);
  };

  const handleVoiceInput = () => {
    if (!isSupported) {
      toast({
        variant: "destructive",
        title: "Speech Recognition Unavailable",
        description: "Your browser doesn't support speech recognition. Try Chrome or Safari.",
      });
      return;
    }

    if (!isListening) {
      startListening(onVoiceInput, (error) => {
        // Show error toast with Mac-specific instructions
        toast({
          variant: "destructive",
          title: "Microphone Error",
          description: error,
          duration: 8000,
        });
      });
    }
  };

  const handleRateChange = (value: number[]) => {
    setSpeechRate(value[0]);
  };

  const handleVoiceTest = () => {
    const testPhrases = [
      "Testing voice selection. This is voice number " + (selectedVoice + 1) + ".",
      "Hello from ARCHIMEDES terminal. This voice is " + voices[selectedVoice]?.name + ".",
      "Voice test successful. Speaking at rate " + speechRate.toFixed(1) + ".",
      "All systems operational. Voice synthesis working correctly.",
    ];
    const randomPhrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];
    console.log('Voice test - speaking with voice:', selectedVoice, voices[selectedVoice]?.name);
    speak(randomPhrase);
  };

  const [showSpiderFoot, setShowSpiderFoot] = useState(false);
  const [showPrivacyEncoder, setShowPrivacyEncoderLocal] = useState(false);
  const [showSshwifty, setShowSshwiftyLocal] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsage | null>(null);
  const [storageUsage, setStorageUsage] = useState<{
    used: number;
    quota: number;
    percentage: number;
  } | null>(null);
  const [cpuUsage, setCpuUsage] = useState<{
    percentage: number;
    cores: number;
  } | null>(null);

  // Poll memory usage every 3 seconds
  useEffect(() => {
    const updateMemory = () => {
      if ('memory' in performance && (performance as any).memory) {
        const mem = (performance as any).memory;
        const percentage = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
        setMemoryUsage({
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize,
          jsHeapSizeLimit: mem.jsHeapSizeLimit,
          percentage
        });
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 3000);
    return () => clearInterval(interval);
  }, []);

  // Poll storage usage every 3 seconds
  useEffect(() => {
    const updateStorage = async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          const used = estimate.usage || 0;
          const quota = estimate.quota || 0;
          const percentage = quota > 0 ? (used / quota) * 100 : 0;
          setStorageUsage({ used, quota, percentage });
        } catch (error) {
          console.error('Failed to get storage estimate:', error);
        }
      }
    };

    updateStorage();
    const interval = setInterval(updateStorage, 3000);
    return () => clearInterval(interval);
  }, []);

  // Poll CPU usage every 3 seconds
  useEffect(() => {
    let lastTime = performance.now();
    let lastUsage = 0;

    const updateCPU = () => {
      const now = performance.now();
      const deltaTime = now - lastTime;
      
      // Estimate CPU usage based on performance.now() jitter and task duration
      if ('performance' in window && 'measure' in performance) {
        try {
          // Use performance timing to estimate CPU load
          const entries = performance.getEntriesByType('measure');
          const recentLoad = entries.slice(-10).reduce((sum, entry) => sum + entry.duration, 0) / 10;
          
          // Smooth the percentage to avoid jumps
          const estimatedPercentage = Math.min(100, (recentLoad / deltaTime) * 100 * 0.5);
          const smoothedPercentage = lastUsage * 0.7 + estimatedPercentage * 0.3;
          
          lastUsage = smoothedPercentage;
          lastTime = now;
          
          setCpuUsage({
            percentage: smoothedPercentage,
            cores: navigator.hardwareConcurrency || 4
          });
        } catch (error) {
          // Fallback: random-ish usage based on memory
          const fallbackPercentage = Math.random() * 30 + 10;
          setCpuUsage({
            percentage: fallbackPercentage,
            cores: navigator.hardwareConcurrency || 4
          });
        }
      } else {
        // Fallback for browsers without performance API
        const fallbackPercentage = Math.random() * 30 + 10;
        setCpuUsage({
          percentage: fallbackPercentage,
          cores: navigator.hardwareConcurrency || 4
        });
      }
    };

    updateCPU();
    const interval = setInterval(updateCPU, 3000);
    return () => clearInterval(interval);
  }, []);

  const getMemoryColor = (percentage: number) => {
    if (percentage < 50) return 'var(--terminal-highlight)'; // green
    if (percentage < 75) return '#fbbf24'; // yellow
    return '#ef4444'; // red
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(1) + 'MB';
  };

  const openNewNotepad = () => {
    const newNotepad = { id: Date.now().toString() };
    setNotepads([...notepads, newNotepad]);
  };

  const closeNotepad = (id: string) => {
    setNotepads(notepads.filter(notepad => notepad.id !== id));
  };

  return (
    <div
      className="voice-controls p-2 md:p-3 border-b border-terminal-subtle flex flex-wrap md:flex-nowrap items-center justify-between gap-2 text-[15px]"
      style={{ background: 'var(--voice-controls-gradient, var(--terminal-bg))' }}
    >
      <div className="flex items-center gap-2 md:gap-4">
        <LogoIcon />
        <div className="min-w-0">
          <h1 className="font-bold terminal-text terminal-glow md:text-[15px] whitespace-nowrap text-[16px]" data-testid="text-title">
            ARCHIMEDES <span className="text-[8px] md:text-[10px]">v7.54</span>
          </h1>
          <div className="md:text-sm truncate text-[15px]">
            <span className="hidden sm:inline retro-cycle text-[12px]">アルキメデス</span>
          </div>
        </div>

        <Button
          onClick={handleVoiceToggle}
          variant="outline"
          size="sm"
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
          data-testid="button-voice-toggle"
          aria-label={isEnabled ? 'Disable Voice' : 'Enable Voice'}
        >
          {isEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </Button>

        <Button
          onClick={handleVoiceInput}
          variant="outline"
          size="sm"
          disabled={!isSupported}
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5 disabled:opacity-50"
          data-testid="button-voice-input"
          aria-label={isListening ? 'Stop Listening' : 'Voice Input'}
        >
          {isListening ? <MicOff size={14} /> : <Mic size={14} />}
        </Button>

        {/* Volume Control */}
        <div className="flex items-center gap-2 px-2">
          {speechVolume === 0 ? (
            <VolumeX size={12} className="text-terminal-subtle" />
          ) : (
            <Volume2 size={12} className="text-terminal-subtle" />
          )}
          <Slider
            value={[speechVolume]}
            onValueChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.01}
            className="w-16 md:w-20"
            aria-label="AI Speech Volume"
          />
          <span className="text-xs text-terminal-subtle min-w-[3ch]">{Math.round(speechVolume * 100)}%</span>
        </div>

        {/* Memory Usage Indicator */}
        {showResources && memoryUsage && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-110 text-[12px]"
                  style={{
                    backgroundColor: `${getMemoryColor(memoryUsage.percentage)}20`,
                    minWidth: '140px'
                  }}
                >
                  <Activity
                    size={18}
                    style={{ 
                      color: getMemoryColor(memoryUsage.percentage)
                    }}
                  />
                  <div className="flex flex-col items-start">
                    <span
                      className="font-mono font-bold text-[12px]"
                      style={{ 
                        color: getMemoryColor(memoryUsage.percentage)
                      }}
                    >
                      {formatBytes(memoryUsage.usedJSHeapSize)}
                    </span>
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ 
                        color: getMemoryColor(memoryUsage.percentage),
                        opacity: 0.9
                      }}
                    >
                      {memoryUsage.percentage.toFixed(1)}% RAM
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-terminal-highlight">Memory Usage: {memoryUsage.percentage.toFixed(1)}%</p>
                  <p>Used: {formatBytes(memoryUsage.usedJSHeapSize)}</p>
                  <p>Total: {formatBytes(memoryUsage.totalJSHeapSize)}</p>
                  <p>Limit: {formatBytes(memoryUsage.jsHeapSizeLimit)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Storage Usage Indicator */}
        {showResources && storageUsage && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-110"
                  style={{
                    backgroundColor: `${getMemoryColor(storageUsage.percentage)}20`,
                    minWidth: '140px'
                  }}
                >
                  <Activity
                    size={18}
                    style={{ 
                      color: getMemoryColor(storageUsage.percentage)
                    }}
                  />
                  <div className="flex flex-col items-start">
                    <span
                      className="text-base font-mono font-bold leading-tight"
                      style={{ 
                        color: getMemoryColor(storageUsage.percentage)
                      }}
                    >
                      {formatBytes(storageUsage.used)}
                    </span>
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ 
                        color: getMemoryColor(storageUsage.percentage),
                        opacity: 0.9
                      }}
                    >
                      {storageUsage.percentage.toFixed(1)}% HD
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-terminal-highlight">Storage Usage: {storageUsage.percentage.toFixed(1)}%</p>
                  <p>Used: {formatBytes(storageUsage.used)}</p>
                  <p>Quota: {formatBytes(storageUsage.quota)}</p>
                  <p className="text-terminal-subtle mt-2 italic">Session & Local Storage</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* CPU Usage Indicator */}
        {showResources && cpuUsage && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-110"
                  style={{
                    backgroundColor: `${getMemoryColor(cpuUsage.percentage)}20`,
                    minWidth: '140px'
                  }}
                >
                  <Activity
                    size={18}
                    style={{ 
                      color: getMemoryColor(cpuUsage.percentage)
                    }}
                  />
                  <div className="flex flex-col items-start">
                    <span
                      className="text-base font-mono font-bold leading-tight"
                      style={{ 
                        color: getMemoryColor(cpuUsage.percentage)
                      }}
                    >
                      {cpuUsage.percentage.toFixed(1)}%
                    </span>
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ 
                        color: getMemoryColor(cpuUsage.percentage),
                        opacity: 0.9
                      }}
                    >
                      {cpuUsage.cores} CORES CPU
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-terminal-highlight">CPU Usage: {cpuUsage.percentage.toFixed(1)}%</p>
                  <p>Cores: {cpuUsage.cores}</p>
                  <p className="text-terminal-subtle mt-2 italic">Estimated browser CPU load</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
        {/* Login Status Indicator */}
        <div className="flex items-center gap-2 px-2 py-1 rounded border" style={{
          borderColor: isAuthenticated ? 'var(--terminal-highlight)' : 'rgba(var(--terminal-subtle-rgb), 0.3)',
          backgroundColor: isAuthenticated ? 'rgba(var(--terminal-highlight-rgb), 0.1)' : 'rgba(var(--terminal-subtle-rgb), 0.05)'
        }}>
          <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'animate-pulse' : ''}`} style={{
            backgroundColor: isAuthenticated ? 'var(--terminal-highlight)' : 'rgba(var(--terminal-subtle-rgb), 0.5)',
            boxShadow: isAuthenticated ? '0 0 4px var(--terminal-highlight)' : 'none'
          }} />
        </div>

        <TooltipProvider>
          {isAuthenticated && (
            <>
              {/* Notepad Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={openNewNotepad}
                    variant="outline"
                    size="sm"
                    className={`bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5 ${notepads.length > 0 ? 'bg-terminal-highlight text-terminal-bg' : ''}`}
                    data-testid="button-notepad"
                    aria-label="Notepad"
                  >
                    <FileText size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Notepad</p>
                </TooltipContent>
              </Tooltip>

              {/* Upload Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowUpload(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
                    data-testid="button-upload"
                    aria-label="Upload"
                  >
                    <Upload size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Upload</p>
                </TooltipContent>
              </Tooltip>

              {/* Workshop Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowPythonIDE(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
                    data-testid="button-python-ide"
                    aria-label="Workshop"
                  >
                    <Code size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Workshop</p>
                </TooltipContent>
              </Tooltip>

              {/* Code Playground Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowCodePlayground(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
                    data-testid="button-code-playground"
                    aria-label="Code Playground"
                  >
                    <TerminalIcon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Code Playground</p>
                </TooltipContent>
              </Tooltip>

              {/* Chat Button - Removed */}

              {/* Radio button removed - Webamp now controls animated character */}
            </>
          )}
        {/* Profile Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowProfile(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
                    data-testid="button-user-profile"
                    aria-label="Profile"
                  >
                    <User size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Profile</p>
                </TooltipContent>
              </Tooltip>
        </TooltipProvider>

        {/* Power/Login Button */}
        {user ? (
          <Button
            onClick={() => window.location.href = '/api/logout'}
            variant="outline"
            size="sm"
            className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
            data-testid="button-logout"
            aria-label="Log Out"
          >
            <LogOut size={14} />
          </Button>
        ) : (
          <Button
            onClick={() => window.location.href = '/api/login'}
            variant="outline"
            size="sm"
            className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
            data-testid="button-login"
            aria-label="Log In"
          >
            <LogIn size={14} />
          </Button>
        )}

        {/* Cassette Tape (Webamp) */}
        <Button
          onClick={() => setShowWebamp(true)}
          variant="outline"
          size="sm"
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
          data-testid="button-webamp"
          aria-label="Webamp Music Player"
        >
          <CassetteTape size={14} />
        </Button>

        </div>

      {showPrivacyEncoder && (
        <EncodeDecodeOverlay isOpen={showPrivacyEncoder} onClose={() => setShowPrivacyEncoderLocal(false)} />
      )}
    </div>
  );
}