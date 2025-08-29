import { useState, useEffect, useCallback } from 'react';

interface Voice {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<number>(0);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        
        // Create a custom robot voice option
        const customVoices: Voice[] = [
          { name: 'System Default', lang: 'en-US', voiceURI: 'default', localService: true },
          { name: 'Robot Voice', lang: 'en-US', voiceURI: 'robot', localService: true },
        ];
        
        // Add available system voices
        availableVoices.forEach((voice, index) => {
          customVoices.push({
            name: voice.name,
            lang: voice.lang,
            voiceURI: voice.voiceURI,
            localService: voice.localService,
          });
        });
        
        setVoices(customVoices);
      };

      loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!isEnabled || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;
    
    // Handle robot voice simulation
    if (selectedVoice === 1) {
      utterance.pitch = 0.3;
      utterance.rate = Math.max(0.7, speechRate * 0.8);
    }
    
    // Use selected system voice if available
    const systemVoices = window.speechSynthesis.getVoices();
    if (selectedVoice >= 2 && systemVoices[selectedVoice - 2]) {
      utterance.voice = systemVoices[selectedVoice - 2];
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isEnabled, selectedVoice, speechRate]);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    voices,
    isEnabled,
    setIsEnabled,
    selectedVoice,
    setSelectedVoice,
    speechRate,
    setSpeechRate,
    isSpeaking,
    speak,
    stop,
  };
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }, []);

  const startListening = useCallback((onResult: (transcript: string) => void) => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  }, [isSupported]);

  return {
    isSupported,
    isListening,
    startListening,
  };
}
