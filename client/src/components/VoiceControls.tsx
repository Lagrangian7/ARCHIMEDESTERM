import { Volume2, VolumeX, Mic, MicOff, CassetteTape, LogIn, LogOut } from 'lucide-react';
import { useSpeech } from '@/contexts/SpeechContext';
import { useSpeechRecognition } from '@/hooks/use-speech';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
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
}

export function VoiceControls({ onVoiceInput, currentMode, switchMode, switchTheme, setShowWebamp, user, isAuthenticated }: VoiceControlsProps) {
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
    <div className="voice-controls p-3 border-b border-terminal-subtle flex items-center justify-between text-sm relative z-10">
      <div className="flex items-center space-x-4">
        <LogoIcon />
        <div>
          <h1 className="font-bold terminal-text terminal-glow text-[15px]" data-testid="text-title">
            ARCHIMEDES <span className="text-[10px]">v7</span>
          </h1>
          <div className="text-sm text-white">
            アルキメデス
            {user && (
              <span className="ml-2 text-green-300">
                | {user.firstName || user.email?.split('@')[0] || 'User'}
              </span>
            )}
          </div>
        </div>
        
        <Button
          onClick={handleVoiceInput}
          variant="outline"
          size="sm"
          disabled={!isSupported}
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-2 disabled:opacity-50"
          data-testid="button-voice-input"
          aria-label={isListening ? 'Stop Listening' : 'Voice Input'}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </Button>
      </div>

      <div className="flex items-center space-x-3">
        {/* Power/Login Button */}
        {user ? (
          <Button
            onClick={() => window.location.href = '/api/logout'}
            variant="outline"
            size="sm"
            className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-2"
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
            className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-2"
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
          className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors h-auto p-2"
          data-testid="button-webamp"
          aria-label="Webamp Music Player"
        >
          <CassetteTape size={16} />
        </Button>

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
    </div>
  );
}
