
import { useEffect, useRef, useState } from 'react';

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
    let mounted = true;

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
        analyserRef.current.fftSize = 512; // Lower for performance
        analyserRef.current.smoothingTimeConstant = 0.8;
        
        console.log('Audio context initialized for spectrum analyzer');

        // Try to connect to audio
        setTimeout(() => tryConnectToAudio(), 1000);
        const interval = setInterval(() => tryConnectToAudio(), 3000);

        // Start render loop
        const render = () => {
          if (!mounted || !analyserRef.current || !canvasRef.current) return;
          
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyserRef.current.getByteFrequencyData(dataArray);

          // Clear canvas with slight trail effect
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw spectrum bars
          const barWidth = (canvas.width / bufferLength) * 2.5;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height * 0.7;
            
            // Gradient from green to yellow to red based on intensity
            const hue = 120 - (dataArray[i] / 255) * 60; // 120 = green, 60 = yellow, 0 = red
            const brightness = 40 + (dataArray[i] / 255) * 20; // Brighter bars
            ctx.fillStyle = `hsl(${hue}, 100%, ${brightness}%)`;
            
            // Add glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
            
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
          }
          
          ctx.shadowBlur = 0;

          animationFrameRef.current = requestAnimationFrame(render);
        };
        render();

        return () => clearInterval(interval);
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    };

    const tryConnectToAudio = () => {
      if (!audioContextRef.current || !analyserRef.current || audioSourceRef.current) return;
      
      const audioElements = document.querySelectorAll('audio');
      
      for (const element of Array.from(audioElements)) {
        const mediaElement = element as HTMLMediaElement;
        
        if (mediaElement.paused || (mediaElement as any)._spectrumConnected) continue;
        
        try {
          (mediaElement as any)._spectrumConnected = true;
          const source = audioContextRef.current!.createMediaElementSource(mediaElement);
          source.connect(analyserRef.current!);
          analyserRef.current!.connect(audioContextRef.current!.destination);
          audioSourceRef.current = source;
          
          console.log('✅ Connected spectrum analyzer to audio');
          return;
        } catch (error) {
          // Already connected, expected with Webamp
        }
      }
    };

    initAudio();

    return () => {
      mounted = false;
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
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ 
          opacity: 0.9,
          display: 'block',
          backgroundColor: 'rgba(0, 0, 0, 0.3)'
        }}
      />
      <div className="absolute bottom-2 right-2 text-xs text-terminal-highlight opacity-90 pointer-events-none font-mono">
        🎵 SPECTRUM ANALYZER
      </div>
    </div>
  );
}
