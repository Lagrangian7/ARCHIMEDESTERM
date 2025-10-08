import { useState, useEffect, useCallback, useRef } from 'react';

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
  const [selectedVoice, setSelectedVoice] = useState<number>(1); // Start with HAL 9000
  const [speechRate, setSpeechRate] = useState(1.2); // Faster speaking speed
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  
  // Use refs to store current values for the speech callback
  const selectedVoiceRef = useRef<number>(1); // Start with HAL 9000
  const speechRateRef = useRef<number>(1.2); // Faster speaking speed
  const voicesRef = useRef<Voice[]>([]);
  const isEnabledRef = useRef<boolean>(true);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser');
      return;
    }

    const loadVoices = () => {
      try {
        const availableVoices = window.speechSynthesis.getVoices();
        
        // Create a custom voice options
        const customVoices: Voice[] = [
          { name: 'System Default', lang: 'en-US', voiceURI: 'default', localService: true },
          { name: 'HAL 9000 (2001 AI)', lang: 'en-US', voiceURI: 'hal', localService: true },
        ];
        
        // Known female voice names to filter out
        const femaleVoiceNames = [
          'fiona', 'karen', 'moira', 'samantha', 'tessa', 'veena', 'victoria',
          'zira', 'hazel', 'susan', 'allison', 'ava', 'catherine', 'joanna',
          'kendra', 'kimberly', 'salli', 'nicole', 'emma', 'amelie', 'anna',
          'alice', 'ellen', 'melina', 'nora', 'paulina', 'sara', 'serena',
          'vicki', 'zosia'
        ];
        
        // Add available system voices with better filtering (male voices only)
        availableVoices.forEach((voice) => {
          // Filter for English voices only and exclude female voices
          if (voice.lang.startsWith('en')) {
            const voiceName = voice.name.toLowerCase();
            const isFemale = femaleVoiceNames.some(female => voiceName.includes(female));
            
            if (!isFemale) {
              customVoices.push({
                name: `${voice.name} (${voice.lang})`,
                lang: voice.lang,
                voiceURI: voice.voiceURI,
                localService: voice.localService,
              });
            }
          }
        });
        
        setVoices(customVoices);
        voicesRef.current = customVoices;
        setVoicesLoaded(true);
        
        // If no voices loaded yet and this is our first load, wait a bit for browser to initialize
        if (availableVoices.length === 0 && !voicesLoaded) {
          setTimeout(loadVoices, 100);
        }
      } catch (error) {
        console.error('Error loading voices:', error);
      }
    };

    // Try immediate load first
    loadVoices();
    
    // Also listen for the voiceschanged event for browsers that load voices asynchronously
    const handleVoicesChanged = () => {
      loadVoices();
    };
    
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    
    // Fallback: Force voice reload after a delay for some browsers
    const fallbackTimer = setTimeout(() => {
      if (!voicesLoaded) {
        loadVoices();
      }
    }, 1000);
    
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      clearTimeout(fallbackTimer);
    };
  }, [voicesLoaded]);

  // Wrapped setters that update both state and ref immediately
  const setSelectedVoiceWithRef = useCallback((value: number) => {
    console.log('setSelectedVoiceWithRef called with:', value);
    selectedVoiceRef.current = value;
    setSelectedVoice(value);
    console.log('selectedVoiceRef.current is now:', selectedVoiceRef.current);
  }, []);
  
  const setSpeechRateWithRef = useCallback((value: number) => {
    speechRateRef.current = value;
    setSpeechRate(value);
  }, []);
  
  const setIsEnabledWithRef = useCallback((value: boolean) => {
    isEnabledRef.current = value;
    setIsEnabled(value);
  }, []);
  
  // Keep refs in sync with state as backup
  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
  }, [selectedVoice]);

  useEffect(() => {
    speechRateRef.current = speechRate;
  }, [speechRate]);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  const speak = useCallback((text: string) => {
    if (!isEnabledRef.current || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis disabled or not supported');
      return;
    }

    try {
      // Use ref values to get the current state
      const currentVoice = selectedVoiceRef.current;
      const currentRate = speechRateRef.current;
      const currentVoices = voicesRef.current;
      
      console.log('speak() called with selectedVoice:', currentVoice);
      
      window.speechSynthesis.cancel();
      
      // Clean text for speech synthesis
      let cleanText = text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\*/g, '') // Remove asterisks
        .replace(/(?<!\d\s?)>\s*(?!\d)/g, '') // Remove > unless it's between numbers (like "5 > 3")
        // Remove ALL Unicode box-drawing characters (U+2500-U+257F)
        .replace(/[\u2500-\u257F]/g, '') // Complete box-drawing block
        // Remove additional visual/decorative characters
        .replace(/[╔╗╚╝╠╣╦╩╬═║]/g, '') // Double-line box drawing
        .replace(/[┏┓┗┛┣┫┳┻╋━┃]/g, '') // Heavy box drawing  
        .replace(/[◆◇▲△▼▽●○■□▪▫]/g, '') // Remove geometric symbols
        .replace(/[░▒▓█▀▄▌▐]/g, '') // Remove block characters
        .replace(/[─━│┃┄┅┆┇┈┉┊┋]/g, '') // All line styles
        .replace(/[└┘┌┐├┤┬┴┼]/g, '') // Light box corners/intersections
        .replace(/[€£¥¢§¶†‡•…‰′″‴]/g, '') // Remove currency and special symbols
        .replace(/[⌐⌠⌡°∙·√ⁿ²]/g, '') // Remove mathematical drawing chars
        .replace(/[▬▭▮▯▰▱]/g, '') // Remove horizontal bars
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
      
      if (!cleanText) {
        console.warn('No text to speak after cleaning');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Set base properties
      utterance.rate = currentRate;
      utterance.volume = 0.63;
      utterance.pitch = 0.6;
      
      // Get available system voices
      const systemVoices = window.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en'));
      
      // Debug logging
      console.log('Voice Selection Debug:', {
        selectedVoice: currentVoice,
        selectedVoiceName: currentVoices[currentVoice]?.name || 'Unknown',
        totalVoices: currentVoices.length,
        systemVoicesCount: systemVoices.length,
        voicesLoaded,
        voiceNames: currentVoices.map(v => v.name)
      });
      
      // Voice selection logic
      if (currentVoice === 0) {
        // System Default - use browser default (no voice set)
        console.log('Using system default voice');
      } else if (currentVoice === 1) {
        // HAL 9000 voice simulation - deep, calm voice
        utterance.pitch = 0.6; // Lower pitch for deeper voice
        utterance.rate = currentRate * 0.85; // Slower, more deliberate
        utterance.volume = 0.7;
        console.log('Using HAL 9000 voice simulation');
      } else if (currentVoice >= 2 && currentVoice < currentVoices.length) {
        // System voice selection - map to actual system voice
        const systemVoiceIndex = currentVoice - 2; // Subtract 2 for our custom voices
        console.log(`Attempting to use system voice at index ${systemVoiceIndex}`);
        if (systemVoices[systemVoiceIndex]) {
          utterance.voice = systemVoices[systemVoiceIndex];
          console.log(`Successfully set system voice: ${systemVoices[systemVoiceIndex].name}`);
        } else {
          console.warn(`System voice index ${systemVoiceIndex} not available (only ${systemVoices.length} voices), falling back to default`);
        }
      } else {
        console.warn(`Invalid voice selection: ${currentVoice}, falling back to default`);
      }

      // Event handlers with error handling
      utterance.onstart = () => {
        setIsSpeaking(true);
        console.log('Speech started');
      };
      
      utterance.onend = () => {
        setIsSpeaking(false);
        console.log('Speech ended');
      };
      
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        console.error('Speech synthesis error:', event.error);
      };

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error in speak function:', error);
      setIsSpeaking(false);
    }
  }, []); // Empty deps since we use refs for all dynamic values

  const stop = useCallback(() => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        console.log('Speech stopped');
      }
    } catch (error) {
      console.error('Error stopping speech:', error);
      setIsSpeaking(false);
    }
  }, []);

  return {
    voices,
    isEnabled,
    setIsEnabled: setIsEnabledWithRef,
    selectedVoice,
    setSelectedVoice: setSelectedVoiceWithRef,
    speechRate,
    setSpeechRate: setSpeechRateWithRef,
    isSpeaking,
    voicesLoaded,
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

  const startListening = useCallback((onResult: (transcript: string) => void, onError?: (error: string) => void) => {
    if (!isSupported) {
      console.error('Speech recognition not supported');
      onError?.('Speech recognition is not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('🎤 Speech recognition started successfully');
      setIsListening(true);
    };
    
    recognition.onresult = (event: any) => {
      console.log('📝 Speech recognition result received');
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      setIsListening(false);
      
      // Provide Mac-specific error messages
      let errorMessage = 'Speech recognition error';
      
      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Microphone access denied. On Mac:\n' +
            '1. Check System Settings → Privacy & Security → Microphone\n' +
            '2. Enable microphone access for your browser (Safari/Chrome)\n' +
            '3. In Safari: Click AA in address bar → Settings → Allow Microphone\n' +
            '4. Reload the page and try again';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please speak clearly into your microphone.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found or access blocked.\n' +
            'On Mac: Check System Settings → Privacy & Security → Microphone';
          break;
        case 'network':
          errorMessage = 'Network error. Speech recognition requires internet connection.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition aborted. If using Safari on Mac with Siri enabled, try disabling Siri in System Settings.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      console.error('Error details:', errorMessage);
      onError?.(errorMessage);
    };

    recognition.onend = () => {
      console.log('🛑 Speech recognition ended');
      setIsListening(false);
    };

    try {
      console.log('🎙️ Attempting to start speech recognition...');
      console.log('Browser:', navigator.userAgent.includes('Safari') ? 'Safari' : 
                             navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other');
      recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setIsListening(false);
      onError?.('Failed to start speech recognition. Make sure microphone permissions are granted.');
    }
  }, [isSupported]);

  return {
    isSupported,
    isListening,
    startListening,
  };
}
