import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Mic, MicOff, CassetteTape, LogIn, LogOut, User, Upload, FileText } from 'lucide-react';
import { useSpeech } from '@/contexts/SpeechContext';
import { useSpeechRecognition } from '@/hooks/use-speech';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import cubesIcon from '@assets/cubes_1758504853239.png';
import { LogoIcon } from '@/components/Terminal';
import { EncodeDecodeOverlay } from './EncodeDecodeOverlay';

interface VoiceControlsProps {
  onVoiceInput: (transcript: string) => void;
  currentMode: 'natural' | 'technical';
  switchMode: (mode: 'natural' | 'technical') => void;
  switchTheme: () => void;
  setShowWebamp: (show: boolean) => void;
  setIsWebampOpen?: (show: boolean) => void;
  user: any;
  isAuthenticated: boolean;
  setShowProfile: (show: boolean) => void;
  setShowUpload: (show: boolean) => void;
  setShowChat: (show: boolean) => void;
  unreadCount: number;
  setShowNotepad: (show: boolean) => void;
}

const THEMES = [
  { name: 'Green', class: 'theme-green', colors: ['#000000', '#00FF41', '#00FF80'] },
  { name: 'Blue', class: 'theme-blue', colors: ['#000000', '#33A8FF', '#5CC8FF'] },
  { name: 'Orange', class: 'theme-orange', colors: ['#000000', '#FF9933', '#FFAD5C'] },
  { name: 'Greyscale', class: 'theme-greyscale', colors: ['#000000', '#BFBFBF', '#E5E5E5'] },
  { name: 'Red', class: 'theme-red', colors: ['#000000', '#FF3333', '#FF5C5C'] },
  { name: 'Black & White', class: 'theme-blackwhite', colors: ['#000000', '#FFFFFF', '#CCCCCC'] },
  { name: 'White', class: 'theme-white', colors: ['#FFFFFF', '#000000', '#333333'] },
  { name: 'Patriot', class: 'theme-patriot', colors: ['#000000', '#E63946', '#5C7CFF'] },
  { name: 'Solarized', class: 'theme-solarized', colors: ['#002B36', '#93A1A1', '#B58900'] },
  { name: 'Commodore 64', class: 'theme-commodore64', colors: ['#2A388F', '#7FDBFF', '#7FDBFF'] },
  { name: 'Cyberpunk', class: 'theme-cyberpunk', colors: ['#0D0D0D', '#FF33FF', '#00FFFF'] },
  { name: 'Forest', class: 'theme-forest', colors: ['#1A3329', '#7ACC5D', '#A6E68A'] },
  { name: 'Ocean', class: 'theme-ocean', colors: ['#0A1529', '#5CC8FF', '#70E5C4'] },
  { name: 'Sunset', class: 'theme-sunset', colors: ['#261A14', '#FF8533', '#FF5470'] },
  { name: 'Neon', class: 'theme-neon', colors: ['#000000', '#CC33FF', '#00FF80'] },
  { name: 'Vintage', class: 'theme-vintage', colors: ['#2B251A', '#CCA866', '#D9906B'] },
  { name: 'Arctic', class: 'theme-arctic', colors: ['#142832', '#99E0FF', '#C2F5FF'] },
  { name: 'Amber', class: 'theme-amber', colors: ['#141414', '#FFB833', '#FFC252'] },
  { name: 'Hacker', class: 'theme-hacker', colors: ['#000000', '#00CC00', '#00FF00'] },
  { name: 'Royal', class: 'theme-royal', colors: ['#1A0D29', '#CC99FF', '#FFD633'] },
  { name: 'Vaporwave', class: 'theme-vaporwave', colors: ['#140A1A', '#FF4DFF', '#33FFFF'] },
  { name: 'Desert', class: 'theme-desert', colors: ['#1F1814', '#E5B34D', '#FF8F52'] },
  { name: 'Toxic', class: 'theme-toxic', colors: ['#0D0D0D', '#80FF00', '#A6FF00'] },
  { name: 'Crimson', class: 'theme-crimson', colors: ['#141414', '#FF3366', '#FF6B52'] },
  { name: 'Lavender', class: 'theme-lavender', colors: ['#1A0D26', '#E699FF', '#FF85CC'] },
  { name: 'Emerald', class: 'theme-emerald', colors: ['#0A1A17', '#52CC99', '#70E5AD'] },
  { name: 'Midnight', class: 'theme-midnight', colors: ['#0A0F2D', '#527FE5', '#5CB8FF'] },
  { name: 'Sakura', class: 'theme-sakura', colors: ['#1F1419', '#E699CC', '#FF6B85'] },
  { name: 'Copper', class: 'theme-copper', colors: ['#1A1014', '#CC9952', '#E5AD70'] },
  { name: 'Plasma', class: 'theme-plasma', colors: ['#080808', '#E633FF', '#FF5285'] },
  { name: 'Atari', class: 'theme-atari', colors: ['#29190D', '#FFD633', '#FF6B33'] },
  { name: 'NES', class: 'theme-nes', colors: ['#1F2457', '#FF5270', '#5CB8FF'] },
  { name: 'Game Boy', class: 'theme-gameboy', colors: ['#242D1F', '#99CC85', '#B3E599'] },
  { name: 'Arcade', class: 'theme-arcade', colors: ['#000000', '#33CCFF', '#FF52E5'] },
  { name: 'Spectrum', class: 'theme-spectrum', colors: ['#000000', '#FF3366', '#5C5CFF'] },
  { name: 'Rainbow Cycle', class: 'theme-rainbow-cycle', colors: ['#000000', '#00FF41', '#FF1493'] },
] as const;

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
  setShowNotepad
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

  const [showSpiderFoot, setShowSpiderFoot] = useState(false);
  const [showPrivacyEncoder, setShowPrivacyEncoderLocal] = useState(false);
  const [showSshwifty, setShowSshwiftyLocal] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const handleThemeSelect = (themeClass: string) => {
    // Find the theme and apply it
    const currentThemeClasses = THEMES.map(t => t.class);
    document.documentElement.classList.remove(...currentThemeClasses);
    document.documentElement.classList.add(themeClass);
    setShowThemeMenu(false);
  };

  return (
    <div className="voice-controls p-2 md:p-3 border-b border-terminal-subtle flex flex-wrap md:flex-nowrap items-center justify-between gap-2 text-sm relative z-10">
      <div className="flex items-center gap-2 md:gap-4">
        <LogoIcon />
        <div className="min-w-0">
          <h1 className="font-bold terminal-text terminal-glow text-xs md:text-[15px] whitespace-nowrap" data-testid="text-title">
            ARCHIMEDES <span className="text-[8px] md:text-[10px]">v7</span>
          </h1>
          <div className="text-xs md:text-sm truncate">
            <span className="hidden sm:inline retro-cycle">アルキメデス</span>
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
          <span className="text-xs font-mono" style={{ color: 'var(--terminal-text)' }}>
            {isAuthenticated ? (user?.email || 'Logged In') : 'Guest'}
          </span>
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
                    onClick={() => setShowNotepad(true)}
                    variant="outline"
                    size="sm"
                    className="bg-terminal-bg border-terminal-highlight text-terminal-text hover:bg-terminal-highlight hover:text-terminal-bg transition-colors min-h-[44px] min-w-[44px] p-2"
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

        {/* Theme Selector */}
        <Popover open={showThemeMenu} onOpenChange={setShowThemeMenu}>
          <PopoverTrigger asChild>
            <button
              className="cursor-pointer p-2 rounded transition-all duration-300 hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center bg-transparent border-none"
              data-testid="button-theme-toggle"
              aria-label="Select Theme"
            >
              <img
                src={cubesIcon}
                alt="Theme Selector"
                width="24"
                height="24"
                className="rgb-theme-icon"
              />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-80 max-h-96 overflow-y-auto bg-terminal-bg border-terminal-highlight p-4"
            align="end"
          >
            <div className="space-y-2">
              <h3 className="text-terminal-text font-bold text-sm mb-3">Select Theme</h3>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.class}
                    onClick={() => handleThemeSelect(theme.class)}
                    className="flex items-center gap-2 p-2 rounded border border-terminal-subtle hover:border-terminal-highlight hover:bg-terminal-highlight/10 transition-colors text-left"
                  >
                    <div className="flex gap-1">
                      {theme.colors.map((color, idx) => (
                        <div
                          key={idx}
                          className="w-4 h-4 rounded-sm border border-terminal-subtle"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="text-terminal-text text-xs flex-1">{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {showPrivacyEncoder && (
        <EncodeDecodeOverlay isOpen={showPrivacyEncoder} onClose={() => setShowPrivacyEncoderLocal(false)} />
      )}
    </div>
  );
}