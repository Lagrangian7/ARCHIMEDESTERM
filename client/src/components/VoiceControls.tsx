import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Mic, MicOff, CassetteTape, LogIn, LogOut, User, BookOpen, FileText, MessageSquare, Code, Terminal as TerminalIcon, Activity } from 'lucide-react';
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
  const [cpuUsage, setCpuUsage] = useState<{
    percentage: number;
    cores: number;
  } | null>(null);
  const [kbStats, setKbStats] = useState<{
    totalDocs: number;
    totalSizeBytes: number;
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


  // Measure real CPU usage using main thread blocking detection
  useEffect(() => {
    let rafId: number;
    let lastFrameTime = performance.now();
    let frameTimes: number[] = [];
    let longTaskCount = 0;
    let smoothedPercentage = 0;
    
    // Use Long Tasks API if available for accurate blocking detection
    let longTaskObserver: PerformanceObserver | null = null;
    if ('PerformanceObserver' in window) {
      try {
        longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Long task = >50ms blocking
              longTaskCount++;
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // longtask not supported in all browsers
      }
    }
    
    // Measure frame timing to detect main thread load
    const measureFrame = () => {
      const now = performance.now();
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;
      
      // Track frame times (ideal is ~16.67ms for 60fps)
      frameTimes.push(frameTime);
      if (frameTimes.length > 30) frameTimes.shift(); // Keep last 30 frames (~0.5s)
      
      rafId = requestAnimationFrame(measureFrame);
    };
    
    rafId = requestAnimationFrame(measureFrame);
    
    // Update CPU display every 2 seconds
    const updateInterval = setInterval(() => {
      if (frameTimes.length === 0) return;
      
      // Calculate average frame time and jank ratio
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const idealFrameTime = 16.67; // 60fps target
      
      // Count janky frames (>50ms = dropped frames)
      const jankyFrames = frameTimes.filter(t => t > 50).length;
      const jankRatio = jankyFrames / frameTimes.length;
      
      // Calculate CPU usage based on:
      // 1. Frame time deviation from ideal (higher = more load)
      // 2. Jank ratio (more janky frames = higher load)
      // 3. Long task count (blocking tasks)
      const frameDeviation = Math.max(0, (avgFrameTime - idealFrameTime) / idealFrameTime);
      const frameLoadPercent = Math.min(frameDeviation * 50, 60); // Max 60% from frame timing
      const jankPercent = jankRatio * 30; // Max 30% from jank
      const longTaskPercent = Math.min(longTaskCount * 5, 20); // Max 20% from long tasks
      
      const rawPercentage = Math.min(100, frameLoadPercent + jankPercent + longTaskPercent + 5); // Base 5%
      
      // Smooth the value to avoid jumps
      smoothedPercentage = smoothedPercentage * 0.6 + rawPercentage * 0.4;
      
      setCpuUsage({
        percentage: smoothedPercentage,
        cores: navigator.hardwareConcurrency || 4
      });
      
      // Reset long task count for next interval
      longTaskCount = 0;
    }, 2000);
    
    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(updateInterval);
      longTaskObserver?.disconnect();
    };
  }, []);

  // Fetch knowledge base stats for authenticated users
  useEffect(() => {
    if (!isAuthenticated || !showResources) {
      setKbStats(null);
      return;
    }

    const fetchKbStats = async () => {
      try {
        const response = await fetch('/api/knowledge/stats', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setKbStats({
            totalDocs: data.totalDocuments || 0,
            totalSizeBytes: data.totalSizeBytes || 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch KB stats:', error);
      }
    };

    fetchKbStats();
    const interval = setInterval(fetchKbStats, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, showResources]);

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

        {/* Knowledge Base Storage Indicator */}
        {showResources && isAuthenticated && kbStats && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-110"
                  style={{
                    backgroundColor: 'rgba(var(--terminal-highlight-rgb), 0.1)',
                    minWidth: '140px'
                  }}
                >
                  <BookOpen
                    size={18}
                    style={{ 
                      color: 'var(--terminal-highlight)'
                    }}
                  />
                  <div className="flex flex-col items-start">
                    <span
                      className="font-mono font-bold text-[12px]"
                      style={{ 
                        color: 'var(--terminal-highlight)'
                      }}
                    >
                      {formatBytes(kbStats.totalSizeBytes)}
                    </span>
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ 
                        color: 'var(--terminal-highlight)',
                        opacity: 0.9
                      }}
                    >
                      {kbStats.totalDocs} docs KB
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-terminal-highlight">Knowledge Base Storage</p>
                  <p>Documents: {kbStats.totalDocs}</p>
                  <p>Used: {formatBytes(kbStats.totalSizeBytes)}</p>
                  <p className="text-terminal-subtle mt-2 italic">Your personal knowledge base</p>
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
                      className="font-mono font-bold text-[12px]"
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

              {/* Knowledge Base Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowUpload(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[32px] min-w-[32px] p-1.5"
                    data-testid="button-knowledge-base"
                    aria-label="Knowledge Base"
                  >
                    <BookOpen size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Knowledge Base</p>
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