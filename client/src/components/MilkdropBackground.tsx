
import { useEffect, useRef } from 'react';

interface MilkdropBackgroundProps {
  isActive: boolean;
}

export function MilkdropBackground({ isActive }: MilkdropBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize audio context and analyser
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;

        // Try to capture system audio or use microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
      } catch (error) {
        console.log('Audio access not available, using visual-only mode');
      }
    };

    initAudio();

    // Resize canvas to match container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Visualization parameters
    let time = 0;
    const dataArray = new Uint8Array(analyserRef.current?.frequencyBinCount || 128);

    const animate = () => {
      if (!ctx || !canvas) return;

      time += 0.01;

      // Get audio data if available
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      // Create psychedelic background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw visualization
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Draw rotating spirals
      for (let i = 0; i < 3; i++) {
        const offset = i * Math.PI * 2 / 3;
        const radius = 50 + Math.sin(time + offset) * 20;
        
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 4; angle += 0.1) {
          const r = radius + angle * 10;
          const x = centerX + Math.cos(angle + time + offset) * r;
          const y = centerY + Math.sin(angle + time + offset) * r;
          
          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        const hue = (time * 50 + i * 120) % 360;
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.3)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw frequency bars if audio is available
      if (analyserRef.current && dataArray.some(v => v > 0)) {
        const barWidth = canvas.width / dataArray.length;
        for (let i = 0; i < dataArray.length; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.5;
          const x = i * barWidth;
          const hue = (i / dataArray.length) * 360;
          
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.2)`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.3, mixBlendMode: 'screen' }}
    />
  );
}
