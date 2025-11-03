
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
  const announcementTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear any existing timer
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
    }

    // Only announce once when speech is ready - use both ref AND sessionStorage
    const hasAnnounced = sessionStorage.getItem('archimedes_announced');
    if (voicesLoaded && isEnabled && !hasAnnounced && !hasAnnouncedRef.current) {
      hasAnnouncedRef.current = true;
      sessionStorage.setItem('archimedes_announced', 'true');
      
      // Small delay to ensure everything is loaded
      announcementTimerRef.current = setTimeout(() => {
        speak("Archimedes v7 online");
        announcementTimerRef.current = undefined;
      }, 500);
    }

    return () => {
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
        announcementTimerRef.current = undefined;
      }
    };
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
