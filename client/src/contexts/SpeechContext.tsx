import { createContext, useContext, ReactNode } from 'react';
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
