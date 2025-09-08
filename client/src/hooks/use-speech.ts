import { useState, useEffect, useCallback } from 'react';

// Type declarations for Speech Recognition API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface Voice {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<number>(1); // Default to HAL 9000 voice
  const [speechRate, setSpeechRate] = useState(1.0); // Normal speaking speed
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        
        // Create a custom HAL voice option
        const customVoices: Voice[] = [
          { name: 'System Default', lang: 'en-US', voiceURI: 'default', localService: true },
          { name: 'HAL 9000 (2001 AI)', lang: 'en-US', voiceURI: 'hal', localService: true },
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
    
    // Clean text for speech synthesis
    let cleanText = text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\*/g, '') // Remove asterisks
      .replace(/(?<!\d\s?)>\s*(?!\d)/g, '') // Remove > unless it's between numbers (like "5 > 3")
      // Remove high ASCII/Unicode box-drawing and visual formatting characters
      .replace(/[╭╮╯╰├┤┬┴┼│─┌┐└┘]/g, '') // Remove box-drawing characters
      .replace(/[◆◇▲△▼▽●○■□▪▫]/g, '') // Remove geometric symbols
      .replace(/[░▒▓█]/g, '') // Remove block characters
      .replace(/[€£¥¢§¶†‡•…‰′″‴]/g, '') // Remove currency and special symbols
      // Preserve mathematical operators in formulas - check if surrounded by alphanumeric
      .replace(/([a-zA-Z0-9]\s*)([\+\-×÷=<>≤≥≠∞∑∏∫])(\s*[a-zA-Z0-9])/g, (match, before, op, after) => {
        const operatorWords: { [key: string]: string } = {
          '+': ' plus ',
          '-': ' minus ',
          '×': ' times ',
          '÷': ' divided by ',
          '=': ' equals ',
          '<': ' less than ',
          '>': ' greater than ',
          '≤': ' less than or equal to ',
          '≥': ' greater than or equal to ',
          '≠': ' not equal to ',
          '∞': ' infinity ',
          '∑': ' sum ',
          '∏': ' product ',
          '∫': ' integral '
        };
        return before + (operatorWords[op] || op) + after;
      })
      // Replace punctuation that creates natural pauses
      .replace(/[.!?]+/g, '.') // Normalize sentence endings to single period for pause
      .replace(/[,;:]/g, ',') // Normalize pause punctuation to comma
      // Remove punctuation that would be pronounced
      .replace(/['""`''""]/g, '') // Remove all quotation marks
      .replace(/[\[\](){}]/g, '') // Remove brackets and parentheses
      .replace(/[#$%&@]/g, '') // Remove symbols
      .replace(/[*_~`]/g, '') // Remove formatting characters
      .replace(/-{2,}/g, ' ') // Replace multiple dashes with space
      .replace(/\|/g, ' ') // Replace pipes with space
      .replace(/\+/g, ' plus ') // Replace remaining + with word
      .replace(/=/g, ' equals ') // Replace remaining = with word
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate;
    
    // Handle HAL 9000 voice simulation (2001 AI)
    if (selectedVoice === 1) {
      utterance.pitch = 0.8; // Higher pitch than JOSHUA, more human-like but still artificial
      utterance.rate = speechRate; // Normal speed for HAL voice
      utterance.volume = 0.95; // Clear, confident volume
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
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
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
