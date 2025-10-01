import { Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { useSpeechSynthesis, useSpeechRecognition } from '@/hooks/use-speech';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface VoiceControlsProps {
  onVoiceInput: (transcript: string) => void;
}

export function VoiceControls({ onVoiceInput }: VoiceControlsProps) {
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
  } = useSpeechSynthesis();
  
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
    if (isSupported && !isListening) {
      startListening(onVoiceInput);
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
        <div className="flex items-center space-x-2">
          <span className="text-terminal-highlight">VOICE:</span>
          <Select 
            value={selectedVoice.toString()} 
            onValueChange={(value) => {
              const newVoice = parseInt(value);
              console.log('Voice selector changed:', { from: selectedVoice, to: newVoice, voiceName: voices[newVoice]?.name });
              setSelectedVoice(newVoice);
            }}
            disabled={!voicesLoaded}
          >
            <SelectTrigger 
              className="w-40 bg-terminal-bg border-terminal-subtle text-terminal-text text-xs h-7 disabled:opacity-50"
              data-testid="voice-select"
            >
              <SelectValue placeholder={voicesLoaded ? "Select voice..." : "Loading voices..."} />
            </SelectTrigger>
            <SelectContent className="bg-terminal-bg border-terminal-subtle text-terminal-text">
              {voices.map((voice, index) => (
                <SelectItem 
                  key={index} 
                  value={index.toString()}
                  className="text-terminal-text hover:bg-terminal-subtle"
                >
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!voicesLoaded && (
            <span className="text-xs text-terminal-subtle">Loading...</span>
          )}
          <Button
            onClick={handleVoiceTest}
            variant="outline"
            size="sm"
            disabled={!voicesLoaded || !isEnabled}
            className="px-2 py-1 border-terminal-subtle hover:bg-terminal-subtle text-xs h-7 bg-transparent text-terminal-text disabled:opacity-50"
            data-testid="button-voice-test"
          >
            TEST
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-terminal-highlight">SPEED:</span>
          <Slider
            value={[speechRate]}
            onValueChange={handleRateChange}
            min={0.5}
            max={2}
            step={0.1}
            className="w-16"
            data-testid="speech-rate-slider"
          />
          <span className="text-xs w-8 text-center text-terminal-text">
            {speechRate.toFixed(1)}
          </span>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          onClick={handleVoiceToggle}
          variant="outline"
          size="sm"
          className="px-3 py-1 border-terminal-subtle hover:bg-terminal-subtle text-xs h-7 bg-transparent text-terminal-text"
          data-testid="button-voice-toggle"
        >
          {isEnabled ? <Volume2 className="w-3 h-3 mr-1" /> : <VolumeX className="w-3 h-3 mr-1" />}
          {isEnabled ? 'ON' : 'OFF'}
        </Button>
        
        <Button
          onClick={handleVoiceInput}
          variant="outline"
          size="sm"
          disabled={!isSupported}
          className="px-3 py-1 border-terminal-subtle hover:bg-terminal-subtle text-xs h-7 bg-transparent text-terminal-text disabled:opacity-50"
          data-testid="button-voice-input"
        >
          {isListening ? <MicOff className="w-3 h-3 mr-1" /> : <Mic className="w-3 h-3 mr-1" />}
          {isListening ? 'LISTENING...' : 'LISTEN'}
        </Button>
      </div>
    </div>
  );
}
