
import { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
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
  const { voicesLoaded, isEnabled, speak } = speechSynthesis;
  const hasAnnouncedRef = useRef(false);

  useEffect(() => {
    // Only announce once when speech is ready - use ref to prevent re-announcement
    const hasAnnounced = sessionStorage.getItem('archimedes_announced');
    if (voicesLoaded && isEnabled && !hasAnnounced && !hasAnnouncedRef.current) {
      hasAnnouncedRef.current = true;
      sessionStorage.setItem('archimedes_announced', 'true');
      // Small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        speak("Archimedes v7 online");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [voicesLoaded, isEnabled, speak]);
  
  return (
    <SpeechContext.Provider value={speechSynthesis}>
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
