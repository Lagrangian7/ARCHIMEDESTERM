
import { useEffect, useRef, useState } from 'react';
import { useSpeech } from '@/contexts/SpeechContext';

interface VoiceEqualizerProps {
  barCount?: number;
  height?: number;
  className?: string;
}

export function VoiceEqualizer({ 
  barCount = 32, 
  height = 80,
  className = '' 
}: VoiceEqualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { isSpeaking } = useSpeech();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isSpeaking) {
      setIsActive(false);
      return;
    }

    setIsActive(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize audio context and analyser
    const initAudio = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }

        // Connect to Web Speech API audio destination
        const destination = audioContextRef.current.destination;
        const source = audioContextRef.current.createMediaStreamDestination();
        
        // Try to capture system audio (this works with TTS)
        analyserRef.current.connect(destination);

        // Start visualization
        visualize();
      } catch (error) {
        console.error('Failed to initialize audio analyzer:', error);
      }
    };

    const visualize = () => {
      if (!analyserRef.current || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!isSpeaking) {
          // Fade out effect
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          return;
        }

        animationFrameRef.current = requestAnimationFrame(draw);

        analyserRef.current!.getByteFrequencyData(dataArray);

        // Clear canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw EQ bars
        const barWidth = canvas.width / barCount;
        const barSpacing = 1;
        
        for (let i = 0; i < barCount; i++) {
          // Sample frequency data
          const index = Math.floor((i / barCount) * bufferLength);
          const value = dataArray[index] || 0;
          const barHeight = (value / 255) * canvas.height * 0.9;

          // Calculate color based on bar height (green -> yellow -> red)
          const hue = 120 - (value / 255) * 120; // 120 = green, 0 = red
          const brightness = 50 + (value / 255) * 10;
          
          // Draw bar with gradient effect
          const x = i * barWidth;
          const y = canvas.height - barHeight;

          // Glow effect
          ctx.shadowBlur = 8;
          ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
          
          // Main bar
          ctx.fillStyle = `hsl(${hue}, 100%, ${brightness}%)`;
          ctx.fillRect(
            x + barSpacing / 2,
            y,
            barWidth - barSpacing,
            barHeight
          );

          // Peak indicator
          if (value > 200) {
            ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
            ctx.fillRect(
              x + barSpacing / 2,
              y - 3,
              barWidth - barSpacing,
              2
            );
          }
        }

        ctx.shadowBlur = 0;
      };

      draw();
    };

    initAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpeaking, barCount]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div 
      className={`relative ${className}`}
      style={{ height: `${height}px` }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          opacity: isActive ? 1 : 0.3,
          transition: 'opacity 0.3s ease'
        }}
      />
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center text-terminal-subtle text-xs">
          EQ inactive
        </div>
      )}
    </div>
  );
}
