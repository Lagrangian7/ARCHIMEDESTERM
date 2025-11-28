
import { useEffect, useRef, useState } from 'react';

interface MilkdropBackgroundProps {
  isActive: boolean;
}

export function MilkdropBackground({ isActive }: MilkdropBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaElementSourcesRef = useRef<Set<MediaElementAudioSourceNode>>(new Set());

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
        
        // Connect analyser to destination so we can capture all system audio
        analyserRef.current.connect(audioContextRef.current.destination);
        
        console.log('Audio context initialized for visualizer');
        
        // Try to connect to existing audio elements
        connectToAudioElements();
        
        // Watch for new audio elements being added
        const observer = new MutationObserver(() => {
          connectToAudioElements();
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        return () => observer.disconnect();
      } catch (error) {
        console.log('Audio context initialization failed:', error);
      }
    };

    const connectToAudioElements = () => {
      if (!audioContextRef.current || !analyserRef.current) return;
      
      // Find all audio/video elements
      const audioElements = document.querySelectorAll('audio, video');
      
      audioElements.forEach((element) => {
        const mediaElement = element as HTMLMediaElement;
        
        // Skip if already connected
        if ((mediaElement as any)._visualizerConnected) return;
        
        try {
          // Create source from media element
          const source = audioContextRef.current!.createMediaElementSource(mediaElement);
          
          // Connect through analyser to destination
          source.connect(analyserRef.current!);
          
          // Mark as connected
          (mediaElement as any)._visualizerConnected = true;
          mediaElementSourcesRef.current.add(source);
          
          console.log('Connected visualizer to audio element:', element.tagName);
        } catch (error) {
          // Element may already be connected to another context, ignore
        }
      });
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
      // Clear media element sources
      mediaElementSourcesRef.current.clear();
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
