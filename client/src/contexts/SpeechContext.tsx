import { createContext, useContext, ReactNode, useCallback, useEffect, useRef } from 'react';
import { useSpeechSynthesis } from '@/hooks/use-speech';

interface SpeechContextType {
  voices: Array<{ name: string; lang: string; voiceURI: string; localService: boolean }>;
  isEnabled: boolean;
  setIsEnabled: (value: boolean) => void;
  selectedVoice: number;
  setSelectedVoice: (value: number) => void;
  speechRate: number;
  setSpeechRate: (value: number) => void;
  isSpeaking: boolean;
  voicesLoaded: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

const SpeechContext = createContext<SpeechContextType | undefined>(undefined);

export function SpeechProvider({ children }: { children: ReactNode }) {
  const speechSynthesis = useSpeechSynthesis();
  const lastSpokenRef = useRef<string>('');
  const speechTimeoutRef = useRef<NodeJS.Timeout>();

  const speak = useCallback((text: string, interruptCurrent = false) => {
    if (!text.trim()) return;

    // Prevent duplicate speech within 500ms
    if (lastSpokenRef.current === text && speechTimeoutRef.current) {
      return;
    }

    lastSpokenRef.current = text;
    clearTimeout(speechTimeoutRef.current);
    speechTimeoutRef.current = setTimeout(() => {
      lastSpokenRef.current = '';
    }, 500);

    if (speechSynthesis.isSpeaking && !interruptCurrent) {
      // Add to queue if not interrupting
      // For simplicity, this example doesn't implement a full queue,
      // but a more robust solution would manage a queue here.
      // For now, we just prevent immediate duplicates and let the next call handle it.
    } else {
      speechSynthesis.speak(text);
    }
  }, [speechSynthesis, interruptCurrent]); // Added interruptCurrent to dependencies

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      clearTimeout(speechTimeoutRef.current);
    };
  }, []);

  // Merge custom speak and stop with the ones from useSpeechSynthesis
  const contextValue = {
    ...speechSynthesis,
    speak,
    stop: () => {
      speechSynthesis.stop();
      lastSpokenRef.current = ''; // Clear last spoken on stop
      clearTimeout(speechTimeoutRef.current);
    },
  };

  return (
    <SpeechContext.Provider value={contextValue}>
      {children}
    </SpeechContext.Provider>
  );
}

export function useSpeech() {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error('useSpeech must be used within a SpeechProvider');
  }
  return context;
}