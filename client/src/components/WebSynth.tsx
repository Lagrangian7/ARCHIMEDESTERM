
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Volume2, VolumeX, Play, Square, Triangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';

interface WebSynthProps {
  onClose: () => void;
}

type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export function WebSynth({ onClose }: WebSynthProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveType, setWaveType] = useState<WaveType>('sine');
  const [frequency, setFrequency] = useState(440);
  const [volume, setVolume] = useState(0.3);
  const [attack, setAttack] = useState(0.1);
  const [decay, setDecay] = useState(0.1);
  const [sustain, setSustain] = useState(0.7);
  const [release, setRelease] = useState(0.3);
  const [filterFreq, setFilterFreq] = useState(2000);
  const [filterQ, setFilterQ] = useState(1);
  const [filterType, setFilterType] = useState<BiquadFilterType>('lowpass');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();

  // Piano keys mapping
  const keyNotes: { [key: string]: number } = {
    'a': 261.63, // C4
    'w': 277.18, // C#4
    's': 293.66, // D4
    'e': 311.13, // D#4
    'd': 329.63, // E4
    'f': 349.23, // F4
    't': 369.99, // F#4
    'g': 392.00, // G4
    'y': 415.30, // G#4
    'h': 440.00, // A4
    'u': 466.16, // A#4
    'j': 493.88, // B4
    'k': 523.25, // C5
  };

  useEffect(() => {
    // Initialize audio context
    audioContextRef.current = new AudioContext();
    
    // Create analyzer for visualization
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;
    analyserRef.current.connect(audioContextRef.current.destination);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const visualize = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyserRef.current!.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = '#000000';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = '#00ff00';
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();
  }, []);

  const playNote = useCallback((freq: number) => {
    if (!audioContextRef.current || !analyserRef.current) return;

    // Stop any existing note
    stopNote();

    const audioContext = audioContextRef.current;
    const currentTime = audioContext.currentTime;

    // Create oscillator
    oscillatorRef.current = audioContext.createOscillator();
    oscillatorRef.current.type = waveType;
    oscillatorRef.current.frequency.setValueAtTime(freq, currentTime);

    // Create gain node for envelope
    gainNodeRef.current = audioContext.createGain();
    gainNodeRef.current.gain.setValueAtTime(0, currentTime);

    // Create filter
    filterNodeRef.current = audioContext.createBiquadFilter();
    filterNodeRef.current.type = filterType;
    filterNodeRef.current.frequency.setValueAtTime(filterFreq, currentTime);
    filterNodeRef.current.Q.setValueAtTime(filterQ, currentTime);

    // Connect nodes
    oscillatorRef.current.connect(filterNodeRef.current);
    filterNodeRef.current.connect(gainNodeRef.current);
    gainNodeRef.current.connect(analyserRef.current);

    // ADSR Envelope
    const attackTime = currentTime + attack;
    const decayTime = attackTime + decay;
    
    gainNodeRef.current.gain.linearRampToValueAtTime(volume, attackTime);
    gainNodeRef.current.gain.linearRampToValueAtTime(volume * sustain, decayTime);

    oscillatorRef.current.start(currentTime);
    setIsPlaying(true);

    if (!animationFrameRef.current) {
      visualize();
    }
  }, [waveType, volume, attack, decay, sustain, filterFreq, filterQ, filterType, visualize]);

  const stopNote = useCallback(() => {
    if (!gainNodeRef.current || !oscillatorRef.current || !audioContextRef.current) return;

    const currentTime = audioContextRef.current.currentTime;
    
    // Apply release
    gainNodeRef.current.gain.cancelScheduledValues(currentTime);
    gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, currentTime);
    gainNodeRef.current.gain.linearRampToValueAtTime(0, currentTime + release);

    oscillatorRef.current.stop(currentTime + release);
    setIsPlaying(false);

    // Cleanup
    setTimeout(() => {
      oscillatorRef.current = null;
      gainNodeRef.current = null;
      filterNodeRef.current = null;
    }, (release + 0.1) * 1000);
  }, [release]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const freq = keyNotes[e.key.toLowerCase()];
    if (freq) {
      playNote(freq);
    }
  }, [keyNotes, playNote]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const freq = keyNotes[e.key.toLowerCase()];
    if (freq) {
      stopNote();
    }
  }, [keyNotes, stopNote]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const waveIcons = {
    sine: <Zap className="w-4 h-4" />,
    square: <Square className="w-4 h-4" />,
    sawtooth: <Triangle className="w-4 h-4" />,
    triangle: <Play className="w-4 h-4" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <Card className="w-full max-w-4xl bg-black border-2 border-green-500 text-green-500 font-mono shadow-[0_0_30px_rgba(0,255,0,0.5)]">
        <div className="flex items-center justify-between p-4 border-b-2 border-green-500">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Volume2 className="w-6 h-6" />
            ARCHIMEDES WEB SYNTHESIZER v1.0
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-green-500 hover:text-green-400 hover:bg-green-500/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Oscilloscope */}
          <div className="border-2 border-green-500 p-2">
            <canvas
              ref={canvasRef}
              width={800}
              height={150}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Oscillator Controls */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-green-500 pb-2">OSCILLATOR</h3>
              
              <div>
                <label className="text-sm mb-2 block">WAVEFORM</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['sine', 'square', 'sawtooth', 'triangle'] as WaveType[]).map((type) => (
                    <Button
                      key={type}
                      onClick={() => setWaveType(type)}
                      variant={waveType === type ? 'default' : 'outline'}
                      className={`${
                        waveType === type
                          ? 'bg-green-500 text-black'
                          : 'border-green-500 text-green-500 hover:bg-green-500/20'
                      }`}
                    >
                      {waveIcons[type]}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm mb-2 block">FREQUENCY: {frequency.toFixed(2)} Hz</label>
                <Slider
                  value={[frequency]}
                  onValueChange={([val]) => setFrequency(val)}
                  min={20}
                  max={2000}
                  step={1}
                  className="[&_.bg-green-500]:bg-green-500"
                />
              </div>

              <div>
                <label className="text-sm mb-2 block">VOLUME: {(volume * 100).toFixed(0)}%</label>
                <Slider
                  value={[volume * 100]}
                  onValueChange={([val]) => setVolume(val / 100)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>

            {/* ADSR Envelope */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-green-500 pb-2">ENVELOPE (ADSR)</h3>
              
              <div>
                <label className="text-sm mb-2 block">ATTACK: {attack.toFixed(2)}s</label>
                <Slider
                  value={[attack * 100]}
                  onValueChange={([val]) => setAttack(val / 100)}
                  min={1}
                  max={200}
                  step={1}
                />
              </div>

              <div>
                <label className="text-sm mb-2 block">DECAY: {decay.toFixed(2)}s</label>
                <Slider
                  value={[decay * 100]}
                  onValueChange={([val]) => setDecay(val / 100)}
                  min={1}
                  max={200}
                  step={1}
                />
              </div>

              <div>
                <label className="text-sm mb-2 block">SUSTAIN: {(sustain * 100).toFixed(0)}%</label>
                <Slider
                  value={[sustain * 100]}
                  onValueChange={([val]) => setSustain(val / 100)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>

              <div>
                <label className="text-sm mb-2 block">RELEASE: {release.toFixed(2)}s</label>
                <Slider
                  value={[release * 100]}
                  onValueChange={([val]) => setRelease(val / 100)}
                  min={1}
                  max={200}
                  step={1}
                />
              </div>
            </div>

            {/* Filter Controls */}
            <div className="space-y-4 col-span-2">
              <h3 className="text-lg font-bold border-b border-green-500 pb-2">FILTER</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm mb-2 block">TYPE</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as BiquadFilterType)}
                    className="w-full bg-black border-2 border-green-500 text-green-500 p-2 rounded"
                  >
                    <option value="lowpass">Low Pass</option>
                    <option value="highpass">High Pass</option>
                    <option value="bandpass">Band Pass</option>
                    <option value="notch">Notch</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm mb-2 block">CUTOFF: {filterFreq.toFixed(0)} Hz</label>
                  <Slider
                    value={[filterFreq]}
                    onValueChange={([val]) => setFilterFreq(val)}
                    min={20}
                    max={20000}
                    step={10}
                  />
                </div>

                <div>
                  <label className="text-sm mb-2 block">RESONANCE: {filterQ.toFixed(1)}</label>
                  <Slider
                    value={[filterQ]}
                    onValueChange={([val]) => setFilterQ(val)}
                    min={0.1}
                    max={30}
                    step={0.1}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Keyboard */}
          <div className="border-2 border-green-500 p-4">
            <h3 className="text-sm font-bold mb-2">KEYBOARD (Use keys: A W S E D F T G Y H U J K)</h3>
            <div className="flex gap-1 justify-center">
              {Object.entries(keyNotes).map(([key, freq]) => {
                const isBlackKey = key.length === 1 && ['w', 'e', 't', 'y', 'u'].includes(key);
                return (
                  <button
                    key={key}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      playNote(freq);
                    }}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      stopNote();
                    }}
                    onMouseLeave={stopNote}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`px-4 py-8 border-2 border-green-500 ${
                      isBlackKey
                        ? 'bg-green-500 text-black'
                        : 'bg-black text-green-500'
                    } hover:bg-green-400 transition-colors font-mono text-xs select-none`}
                  >
                    {key.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-center text-xs text-green-500/70">
            Click piano keys or use keyboard • ADSR controls note envelope • Filter shapes the sound
          </div>
        </div>
      </Card>
    </div>
  );
}
