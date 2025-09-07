import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, Volume2 } from 'lucide-react';

interface DTMFDecoderProps {
  onClose: () => void;
}

// DTMF frequency mapping
const DTMF_FREQUENCIES = {
  low: [697, 770, 852, 941],
  high: [1209, 1336, 1477, 1633]
};

const DTMF_MAP: { [key: string]: string } = {
  '697,1209': '1', '697,1336': '2', '697,1477': '3', '697,1633': 'A',
  '770,1209': '4', '770,1336': '5', '770,1477': '6', '770,1633': 'B',
  '852,1209': '7', '852,1336': '8', '852,1477': '9', '852,1633': 'C',
  '941,1209': '*', '941,1336': '0', '941,1477': '#', '941,1633': 'D'
};

export function DTMFDecoder({ onClose }: DTMFDecoderProps) {
  const [isListening, setIsListening] = useState(false);
  const [detectedDigits, setDetectedDigits] = useState<string[]>([]);
  const [currentTones, setCurrentTones] = useState<{low: number, high: number} | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [lastDetectedTime, setLastDetectedTime] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Float32Array | null>(null);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioContext = audioContextRef.current;
      
      microphoneRef.current = audioContext.createMediaStreamSource(stream);
      analyserRef.current = audioContext.createAnalyser();
      
      // Configure analyzer for DTMF detection
      analyserRef.current.fftSize = 8192; // Higher resolution for better frequency detection
      analyserRef.current.smoothingTimeConstant = 0.1; // Less smoothing for faster response
      
      microphoneRef.current.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Float32Array(bufferLength);
      
      setIsListening(true);
      analyzeAudio();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please ensure microphone permissions are granted.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    audioContextRef.current = null;
    analyserRef.current = null;
    microphoneRef.current = null;
    streamRef.current = null;
    dataArrayRef.current = null;
    
    setIsListening(false);
    setCurrentTones(null);
    setVolumeLevel(0);
  }, []);

  const getFrequencyMagnitude = (frequency: number, sampleRate: number, dataArray: Float32Array): number => {
    const nyquist = sampleRate / 2;
    const index = Math.round((frequency / nyquist) * dataArray.length);
    return dataArray[index] || 0;
  };

  const detectDTMF = (dataArray: Float32Array, sampleRate: number): string | null => {
    const threshold = -30; // dB threshold for tone detection
    
    let bestLowFreq = 0;
    let bestHighFreq = 0;
    let maxLowMagnitude = -Infinity;
    let maxHighMagnitude = -Infinity;
    
    // Check low frequencies
    for (const freq of DTMF_FREQUENCIES.low) {
      const magnitude = getFrequencyMagnitude(freq, sampleRate, dataArray);
      if (magnitude > maxLowMagnitude && magnitude > threshold) {
        maxLowMagnitude = magnitude;
        bestLowFreq = freq;
      }
    }
    
    // Check high frequencies
    for (const freq of DTMF_FREQUENCIES.high) {
      const magnitude = getFrequencyMagnitude(freq, sampleRate, dataArray);
      if (magnitude > maxHighMagnitude && magnitude > threshold) {
        maxHighMagnitude = magnitude;
        bestHighFreq = freq;
      }
    }
    
    // Both low and high frequencies must be detected
    if (bestLowFreq > 0 && bestHighFreq > 0) {
      const key = `${bestLowFreq},${bestHighFreq}`;
      setCurrentTones({ low: bestLowFreq, high: bestHighFreq });
      return DTMF_MAP[key] || null;
    }
    
    setCurrentTones(null);
    return null;
  };

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !audioContextRef.current) return;
    
    analyserRef.current.getFloatFrequencyData(dataArrayRef.current);
    
    // Calculate volume level for visual feedback
    const sum = dataArrayRef.current.reduce((acc, val) => acc + Math.pow(10, val / 10), 0);
    const average = sum / dataArrayRef.current.length;
    const volume = Math.min(100, Math.max(0, 20 * Math.log10(average) + 140));
    setVolumeLevel(volume);
    
    // Detect DTMF tones
    const detectedDigit = detectDTMF(dataArrayRef.current, audioContextRef.current.sampleRate);
    
    if (detectedDigit) {
      const now = Date.now();
      // Prevent duplicate detections (minimum 300ms between same digit)
      if (now - lastDetectedTime > 300) {
        setDetectedDigits(prev => [...prev, detectedDigit]);
        setLastDetectedTime(now);
      }
    }
    
    animationRef.current = requestAnimationFrame(analyzeAudio);
  }, [lastDetectedTime]);

  const clearDigits = () => {
    setDetectedDigits([]);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-terminal-bg border-2 border-terminal-highlight rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-terminal-highlight mb-2">
            📞 DTMF DECODER
          </h2>
          <p className="text-terminal-text text-sm">
            Detects touch-tone phone signals from audio input
          </p>
        </div>

        {/* Control buttons */}
        <div className="flex justify-center gap-4 mb-6">
          <Button
            onClick={isListening ? stopListening : startListening}
            className={`flex items-center gap-2 ${
              isListening 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-terminal-highlight hover:bg-terminal-highlight/80 text-terminal-bg'
            }`}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Button>
        </div>

        {/* Volume indicator */}
        {isListening && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 size={16} className="text-terminal-highlight" />
              <span className="text-terminal-text text-sm">Audio Level</span>
            </div>
            <div className="w-full bg-terminal-bg border border-terminal-subtle rounded">
              <div 
                className="h-2 bg-terminal-highlight rounded transition-all duration-75"
                style={{ width: `${volumeLevel}%` }}
              />
            </div>
          </div>
        )}

        {/* Current tones display */}
        {currentTones && (
          <div className="mb-4 p-3 bg-terminal-bg/50 border border-terminal-subtle rounded">
            <div className="text-terminal-highlight text-sm font-mono">
              Detecting: {currentTones.low}Hz + {currentTones.high}Hz
            </div>
          </div>
        )}

        {/* Detected digits display */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-terminal-text text-sm">Detected Digits:</span>
            <Button
              onClick={clearDigits}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Clear
            </Button>
          </div>
          <div className="min-h-[60px] p-4 bg-terminal-bg border border-terminal-subtle rounded font-mono text-lg">
            {detectedDigits.length > 0 ? (
              <span className="text-terminal-highlight">
                {detectedDigits.join(' ')}
              </span>
            ) : (
              <span className="text-terminal-text/50">
                {isListening ? 'Listening for DTMF tones...' : 'Click "Start Listening" to begin'}
              </span>
            )}
          </div>
        </div>

        {/* DTMF reference chart */}
        <div className="mb-6">
          <h3 className="text-terminal-highlight text-sm mb-2">DTMF Keypad Reference:</h3>
          <div className="grid grid-cols-4 gap-1 text-xs font-mono">
            {['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'].map((digit) => (
              <div 
                key={digit} 
                className={`p-2 text-center border border-terminal-subtle rounded ${
                  detectedDigits[detectedDigits.length - 1] === digit 
                    ? 'bg-terminal-highlight text-terminal-bg' 
                    : 'bg-terminal-bg/30 text-terminal-text'
                }`}
              >
                {digit}
              </div>
            ))}
          </div>
        </div>

        {/* Close button */}
        <div className="flex justify-center">
          <Button
            onClick={() => {
              stopListening();
              onClose();
            }}
            variant="outline"
            className="border-terminal-subtle text-terminal-text hover:bg-terminal-subtle"
          >
            Close Decoder
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DTMFDecoder;