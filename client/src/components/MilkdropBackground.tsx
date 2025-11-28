
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
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Resize canvas
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
        analyserRef.current.smoothingTimeConstant = 0.8;
        
        console.log('Audio context initialized for visualizer');
        
        // Try to connect to audio elements after a short delay (wait for Webamp to load)
        setTimeout(() => {
          tryConnectToAudio();
        }, 1000);
        
        // Keep trying to connect periodically
        const interval = setInterval(() => {
          tryConnectToAudio();
        }, 3000);
        
        return () => clearInterval(interval);
      } catch (error) {
        console.log('Audio context initialization failed:', error);
      }
    };

    const tryConnectToAudio = () => {
      if (!audioContextRef.current || !analyserRef.current || audioSourceRef.current) return;
      
      // Find audio elements
      const audioElements = document.querySelectorAll('audio');
      
      for (const element of audioElements) {
        const mediaElement = element as HTMLMediaElement;
        
        // Skip if paused or already processed
        if (mediaElement.paused || (mediaElement as any)._visualizerAttempted) continue;
        
        try {
          // Mark as attempted
          (mediaElement as any)._visualizerAttempted = true;
          
          // Try to create source
          const source = audioContextRef.current!.createMediaElementSource(mediaElement);
          
          // Connect: source -> analyser -> destination
          source.connect(analyserRef.current!);
          analyserRef.current!.connect(audioContextRef.current!.destination);
          
          audioSourceRef.current = source;
          
          console.log('✅ Successfully connected to audio element for visualization');
          return;
        } catch (error) {
          // Already connected to another context, this is expected
          console.log('Audio element already in use (expected with Webamp)');
        }
      }
    };

    // Visualizer animation
    const dataArray = new Uint8Array(analyserRef.current?.frequencyBinCount || 256);
    let time = 0;

    const animate = () => {
      if (!ctx || !canvas) return;

      time += 0.015;

      // Get audio data if available
      let averageVolume = 0;
      if (analyserRef.current) {
        try {
          analyserRef.current.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          averageVolume = sum / dataArray.length / 255;
        } catch (e) {
          // Silent fail
        }
      }

      // Create darker background with trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Draw multiple rotating spirals with audio reactivity
      for (let i = 0; i < 5; i++) {
        const offset = i * Math.PI * 2 / 5;
        const baseRadius = 40 + averageVolume * 60;
        const radius = baseRadius + Math.sin(time + offset) * 30;
        
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 6; angle += 0.08) {
          const r = radius + angle * 12;
          const waveOffset = Math.sin(angle * 2 + time) * 15 * (1 + averageVolume);
          const x = centerX + Math.cos(angle + time + offset) * (r + waveOffset);
          const y = centerY + Math.sin(angle + time + offset) * (r + waveOffset);
          
          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        const hue = (time * 60 + i * 72) % 360;
        const brightness = 50 + averageVolume * 30;
        ctx.strokeStyle = `hsla(${hue}, 90%, ${brightness}%, 0.6)`;
        ctx.lineWidth = 2 + averageVolume * 2;
        ctx.stroke();
      }

      // Draw circular waves
      for (let i = 0; i < 4; i++) {
        const waveRadius = 100 + i * 80 + Math.sin(time * 2 + i) * 40;
        const pulseScale = 1 + averageVolume * 0.3;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, waveRadius * pulseScale, 0, Math.PI * 2);
        const hue = (time * 70 + i * 90) % 360;
        ctx.strokeStyle = `hsla(${hue}, 85%, 55%, 0.4)`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw frequency bars (only if we have audio data)
      if (analyserRef.current && dataArray.some(v => v > 0)) {
        const barCount = Math.min(dataArray.length, 128);
        const barWidth = canvas.width / barCount;
        
        for (let i = 0; i < barCount; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.6;
          const x = i * barWidth;
          const hue = (i / barCount) * 360 + time * 30;
          
          ctx.fillStyle = `hsla(${hue}, 85%, 60%, 0.35)`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
          
          ctx.fillStyle = `hsla(${hue}, 85%, 60%, 0.2)`;
          ctx.fillRect(x, 0, barWidth - 2, barHeight * 0.5);
        }
      }

      // Draw rotating particles
      const particleCount = 30 + Math.floor(averageVolume * 20);
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + time;
        const distance = 150 + Math.sin(time * 2 + i) * 100 + averageVolume * 80;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        
        ctx.beginPath();
        ctx.arc(x, y, 2 + averageVolume * 3, 0, Math.PI * 2);
        const hue = (angle * 180 / Math.PI + time * 50) % 360;
        ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.7)`;
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    initAudio();
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
      style={{ opacity: 0.65, mixBlendMode: 'screen' }}
    />
  );
}
