
import { useEffect, useRef } from 'react';

interface MilkdropBackgroundProps {
  isActive: boolean;
}

export function MilkdropBackground({ isActive }: MilkdropBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize audio context and analyser
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;
        analyserRef.current.smoothingTimeConstant = 0.75;
        
        console.log('Audio context initialized for spectrum analyzer');
        
        // Try to connect to audio elements
        setTimeout(() => tryConnectToAudio(), 1000);
        const interval = setInterval(() => tryConnectToAudio(), 3000);
        
        return () => clearInterval(interval);
      } catch (error) {
        console.log('Audio context initialization failed:', error);
      }
    };

    const tryConnectToAudio = () => {
      if (!audioContextRef.current || !analyserRef.current || audioSourceRef.current) return;
      
      const audioElements = document.querySelectorAll('audio');
      
      for (const element of audioElements) {
        const mediaElement = element as HTMLMediaElement;
        
        if (mediaElement.paused || (mediaElement as any)._visualizerAttempted) continue;
        
        try {
          (mediaElement as any)._visualizerAttempted = true;
          const source = audioContextRef.current!.createMediaElementSource(mediaElement);
          source.connect(analyserRef.current!);
          analyserRef.current!.connect(audioContextRef.current!.destination);
          audioSourceRef.current = source;
          console.log('✅ Connected to audio for spectrum analysis');
          return;
        } catch (error) {
          // Already connected, expected with Webamp
        }
      }
    };

    initAudio();

    // Spectrum analyzer visualization
    const dataArray = new Uint8Array(analyserRef.current?.frequencyBinCount || 256);

    const animate = () => {
      if (!ctx || !canvas) return;

      // Get frequency data
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      // Clear with slight fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw frequency bars
      const barCount = Math.min(64, dataArray.length);
      const barWidth = canvas.width / barCount;
      const barSpacing = 2;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] || 0;
        const barHeight = (value / 255) * canvas.height * 0.8;
        const x = i * barWidth;
        const y = canvas.height - barHeight;

        // Color gradient based on frequency (low = red, mid = green, high = blue)
        const hue = (i / barCount) * 120; // 0-120 (red to green)
        const saturation = 80;
        const lightness = 50 + (value / 255) * 20; // Brighter when louder

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(x + barSpacing / 2, y, barWidth - barSpacing, barHeight);

        // Add a subtle top glow
        const gradient = ctx.createLinearGradient(x, y, x, y + 20);
        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness + 20}%, 0.8)`);
        gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x + barSpacing / 2, y, barWidth - barSpacing, 20);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioSourceRef.current = null;
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6, mixBlendMode: 'screen' }}
    />
  );
}
