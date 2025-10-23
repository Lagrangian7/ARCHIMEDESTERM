import { Volume2, VolumeX, Mic, MicOff, CassetteTape, LogIn, LogOut, User, Upload, MessageSquare, Radio, Terminal as TerminalIcon, Shield } from 'lucide-react';
import { useSpeech } from '@/contexts/SpeechContext';
import { useSpeechRecognition } from '@/hooks/use-speech';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import cubesIcon from '@assets/cubes_1758504853239.png';
import { LogoIcon } from '@/components/Terminal';

interface VoiceControlsProps {
  onVoiceInput: (transcript: string) => void;
  currentMode: 'natural' | 'technical';
  switchMode: (mode: 'natural' | 'technical') => void;
  switchTheme: () => void;
  setShowWebamp: (show: boolean) => void;
  user: any;
  isAuthenticated: boolean;
  setShowProfile: (show: boolean) => void;
  setShowUpload: (show: boolean) => void;
  setShowChat: (show: boolean) => void;
  toggleRadio: () => void;
  isRadioPlaying: boolean;
  setShowSshwifty: (show: boolean) => void;
  setShowPrivacyEncoder: (show: boolean) => void;
  unreadCount: number;
}

export function VoiceControls({ 
  onVoiceInput, 
  currentMode, 
  switchMode, 
  switchTheme, 
  setShowWebamp, 
  user, 
  isAuthenticated,
  setShowProfile,
  setShowUpload,
  setShowChat,
  toggleRadio,
  isRadioPlaying,
  setShowSshwifty,
  setShowPrivacyEncoder,
  unreadCount
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
    isSpeaking,
    voicesLoaded,
    speak,
    stop,
  } = useSpeech();
  
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

  return (
    <div className="voice-controls p-2 md:p-3 border-b border-terminal-subtle flex flex-wrap md:flex-nowrap items-center justify-between gap-2 text-sm relative z-10">
      <div className="flex items-center gap-2 md:gap-4">
        <LogoIcon />
        <div className="min-w-0">
          <h1 className="font-bold terminal-text terminal-glow text-xs md:text-[15px] whitespace-nowrap" data-testid="text-title">
            ARCHIMEDES <span className="text-[8px] md:text-[10px]">v7</span>
          </h1>
          <div className="text-xs md:text-sm text-white truncate">
            <span className="hidden sm:inline">アルキメデス</span>
            {user && (
              <span className="ml-1 md:ml-2 text-green-300">
                | {user.firstName || user.email?.split('@')[0] || 'User'}
              </span>
            )}
          </div>
        </div>
        
        <Button
          onClick={handleVoiceToggle}
          variant="outline"
          size="sm"
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2"
          data-testid="button-voice-toggle"
          aria-label={isEnabled ? 'Disable Voice' : 'Enable Voice'}
        >
          {isEnabled ? <Volume2 size={14} className="md:w-4 md:h-4" /> : <VolumeX size={14} className="md:w-4 md:h-4" />}
        </Button>
        
        <Button
          onClick={handleVoiceInput}
          variant="outline"
          size="sm"
          disabled={!isSupported}
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2 disabled:opacity-50"
          data-testid="button-voice-input"
          aria-label={isListening ? 'Stop Listening' : 'Voice Input'}
        >
          {isListening ? <MicOff size={14} className="md:w-4 md:h-4" /> : <Mic size={14} className="md:w-4 md:h-4" />}
        </Button>
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
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
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2"
                    data-testid="button-user-profile"
                    aria-label="Profile"
                  >
                    <User size={14} className="md:w-4 md:h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Profile</p>
                </TooltipContent>
              </Tooltip>

              {/* Upload Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowUpload(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2"
                    data-testid="button-upload"
                    aria-label="Upload"
                  >
                    <Upload size={14} className="md:w-4 md:h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Upload</p>
                </TooltipContent>
              </Tooltip>

              {/* Chat Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowChat(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2 relative"
                    data-testid="button-chat"
                    aria-label="Chat"
                  >
                    <MessageSquare size={14} className="md:w-4 md:h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] md:text-xs rounded-full w-3.5 h-3.5 md:w-4 md:h-4 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Chat</p>
                </TooltipContent>
              </Tooltip>

              {/* Radio Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={toggleRadio}
                    variant="outline"
                    size="sm"
                    className={`transition-colors h-auto p-1.5 md:p-2 ${
                      isRadioPlaying 
                        ? 'bg-terminal-highlight border-terminal-highlight text-terminal-bg' 
                        : 'bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg'
                    }`}
                    data-testid="button-radio"
                    aria-label={isRadioPlaying ? 'Stop Radio' : 'Radio'}
                  >
                    <Radio size={14} className="md:w-4 md:h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>{isRadioPlaying ? 'Stop Radio' : 'Radio'}</p>
                </TooltipContent>
              </Tooltip>

              {/* SSH/Telnet Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowSshwifty(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2"
                    data-testid="button-sshwifty"
                    aria-label="SSH/Telnet"
                  >
                    <TerminalIcon size={14} className="md:w-4 md:h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>SSH/Telnet</p>
                </TooltipContent>
              </Tooltip>

              {/* Privacy Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowPrivacyEncoder(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2"
                    data-testid="button-privacy"
                    aria-label="Privacy"
                  >
                    <Shield size={14} className="md:w-4 md:h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-terminal-bg border-terminal-highlight text-terminal-text">
                  <p>Privacy</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </TooltipProvider>

        {/* Power/Login Button */}
        {user ? (
          <Button
            onClick={() => window.location.href = '/api/logout'}
            variant="outline"
            size="sm"
            className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2"
            data-testid="button-logout"
            aria-label="Log Out"
          >
            <LogOut size={14} className="md:w-4 md:h-4" />
          </Button>
        ) : (
          <Button
            onClick={() => window.location.href = '/api/login'}
            variant="outline"
            size="sm"
            className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2"
            data-testid="button-login"
            aria-label="Log In"
          >
            <LogIn size={14} className="md:w-4 md:h-4" />
          </Button>
        )}

        {/* Cassette Tape (Webamp) */}
        <Button
          onClick={() => setShowWebamp(true)}
          variant="outline"
          size="sm"
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-1.5 md:p-2"
          data-testid="button-webamp"
          aria-label="Webamp Music Player"
        >
          <CassetteTape size={14} className="md:w-4 md:h-4" />
        </Button>

        {/* Mode Switcher */}
        <div className="hidden md:flex items-center gap-2 px-2 md:px-3 py-1 border border-terminal-subtle rounded">
          <span className="text-[10px] md:text-xs">MODE:</span>
          <Button
            onClick={() => switchMode(currentMode === 'natural' ? 'technical' : 'natural')}
            variant="ghost"
            size="sm"
            className="text-terminal-highlight hover:text-terminal-text transition-colors font-semibold h-auto p-0 text-[10px] md:text-xs whitespace-nowrap"
            data-testid="button-mode-toggle"
          >
            {currentMode === 'natural' ? 'NATURAL' : 'TECHNICAL'}
          </Button>
        </div>

        {/* RGB Theme Switcher */}
        <div 
          onClick={switchTheme}
          className="cursor-pointer p-1.5 md:p-2 rounded transition-all duration-300 hover:scale-110"
          data-testid="button-theme-toggle"
        >
          <img 
            src={cubesIcon}
            alt="Theme Switcher"
            width="18"
            height="18"
            className="rgb-theme-icon md:w-6 md:h-6"
          />
        </div>
      </div>
    </div>
  );
}
