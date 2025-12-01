import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Mic, MicOff, CassetteTape, LogIn, LogOut, User, Upload, FileText, MessageSquare, Code, X } from 'lucide-react';
import { useSpeech } from '@/contexts/SpeechContext';
import { useSpeechRecognition } from '@/hooks/use-speech';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import cubesIcon from '@assets/cubes_1758504853239.png';
import { LogoIcon } from './LogoIcon';
import { EncodeDecodeOverlay } from './EncodeDecodeOverlay';

interface VoiceControlsProps {
  onVoiceInput: (transcript: string) => void;
  currentMode: 'natural' | 'technical' | 'freestyle';
  switchMode: (mode: 'natural' | 'technical' | 'freestyle') => void;
  switchTheme: () => void;
  setShowWebamp: (show: boolean) => void;
  setIsWebampOpen?: (show: boolean) => void;
  user: any;
  isAuthenticated: boolean;
  setShowProfile: (show: boolean) => void;
  setShowUpload: (show: boolean) => void;
  setShowChat: (show: boolean) => void;
  unreadCount: number;
  notepads: Array<{ id: string }>;
  setNotepads: React.Dispatch<React.SetStateAction<Array<{ id: string }>>>;
  setShowPythonIDE: (show: boolean) => void;
  openPythonLessons?: () => void;
}

export function VoiceControls({
  onVoiceInput,
  currentMode,
  switchMode,
  switchTheme,
  setShowWebamp,
  setIsWebampOpen,
  user,
  isAuthenticated,
  setShowProfile,
  setShowUpload,
  setShowChat,
  unreadCount,
  notepads,
  setNotepads,
  setShowPythonIDE,
  openPythonLessons,
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

  const openNewNotepad = () => {
    const newNotepad = { id: Date.now().toString() };
    setNotepads([...notepads, newNotepad]);
  };

  const closeNotepad = (id: string) => {
    setNotepads(notepads.filter(notepad => notepad.id !== id));
  };

  return (
    <div
      className="voice-controls p-2 md:p-3 border-b border-terminal-subtle flex flex-wrap md:flex-nowrap items-center justify-between gap-2 text-sm"
      style={{ background: 'var(--voice-controls-gradient, var(--terminal-bg))' }}
    >
      <div className="flex items-center gap-2 md:gap-4">
        <LogoIcon />
        <div className="min-w-0">
          <h1 className="font-bold terminal-text terminal-glow text-xs md:text-[15px] whitespace-nowrap" data-testid="text-title">
            ARCHIMEDES <span className="text-[8px] md:text-[10px]">v7</span>
          </h1>
          <div className="text-xs md:text-sm truncate">
            <span className="hidden sm:inline retro-cycle text-[15px]">アルキメデス</span>
          </div>
        </div>

        <Button
          onClick={handleVoiceToggle}
          variant="outline"
          size="sm"
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2"
          data-testid="button-voice-toggle"
          aria-label={isEnabled ? 'Disable Voice' : 'Enable Voice'}
        >
          {isEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </Button>

        <Button
          onClick={handleVoiceInput}
          variant="outline"
          size="sm"
          disabled={!isSupported}
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2 disabled:opacity-50"
          data-testid="button-voice-input"
          aria-label={isListening ? 'Stop Listening' : 'Voice Input'}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </Button>

        {/* Volume Control */}
        <div className="flex items-center gap-2 px-2">
          <Volume2 size={14} className="text-terminal-subtle" />
          <Slider
            value={[speechVolume]}
            onValueChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.1}
            className="w-16 md:w-20"
            aria-label="AI Speech Volume"
          />
          <span className="text-xs text-terminal-subtle min-w-[2ch]">{Math.round(speechVolume * 100)}%</span>
        </div>
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
              {/* Profile Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowProfile(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2"
                    data-testid="button-user-profile"
                    aria-label="Profile"
                  >
                    <User size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Profile</p>
                </TooltipContent>
              </Tooltip>

              {/* Notepad Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={openNewNotepad}
                    variant="outline"
                    size="sm"
                    className={`bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2 ${notepads.length > 0 ? 'bg-terminal-highlight text-terminal-bg' : ''}`}
                    data-testid="button-notepad"
                    aria-label="Notepad"
                  >
                    <FileText size={16} />
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
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2"
                    data-testid="button-upload"
                    aria-label="Upload"
                  >
                    <Upload size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Upload</p>
                </TooltipContent>
              </Tooltip>

              {/* Python IDE Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowPythonIDE(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2"
                    data-testid="button-python-ide"
                    aria-label="Workshop"
                  >
                    <Code size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Workshop</p>
                </TooltipContent>
              </Tooltip>

              {/* Chat Button - Removed */}

              {/* Radio button removed - Webamp now controls animated character */}
            </>
          )}
        </TooltipProvider>

        {/* Power/Login Button */}
        {user ? (
          <Button
            onClick={() => window.location.href = '/api/logout'}
            variant="outline"
            size="sm"
            className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2"
            data-testid="button-logout"
            aria-label="Log Out"
          >
            <LogOut size={16} />
          </Button>
        ) : (
          <Button
            onClick={() => window.location.href = '/api/login'}
            variant="outline"
            size="sm"
            className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2"
            data-testid="button-login"
            aria-label="Log In"
          >
            <LogIn size={16} />
          </Button>
        )}

        {/* Cassette Tape (Webamp) */}
        <Button
          onClick={() => setShowWebamp(true)}
          variant="outline"
          size="sm"
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2"
          data-testid="button-webamp"
          aria-label="Webamp Music Player"
        >
          <CassetteTape size={16} />
        </Button>

        {/* RGB Theme Switcher */}
        <button
          onClick={switchTheme}
          className="cursor-pointer p-2 rounded transition-all duration-300 hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center bg-transparent border-none"
          data-testid="button-theme-toggle"
          aria-label="Switch Theme"
        >
          <img
            src={cubesIcon}
            alt="Theme Switcher"
            width="24"
            height="24"
            className="rgb-theme-icon"
          />
        </button>
      </div>

      {showPrivacyEncoder && (
        <EncodeDecodeOverlay isOpen={showPrivacyEncoder} onClose={() => setShowPrivacyEncoderLocal(false)} />
      )}
    </div>
  );
}