
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
  const animationFrameRef = useRef<number | null>(null);
  const { isSpeaking } = useSpeech();
  const [isActive, setIsActive] = useState(false);
  const barHeightsRef = useRef<number[]>([]);
  const barVelocitiesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isSpeaking) {
      setIsActive(false);
      return;
    }

    setIsActive(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize bar heights and velocities
    if (barHeightsRef.current.length === 0) {
      barHeightsRef.current = Array(barCount).fill(0).map(() => Math.random() * 0.3);
      barVelocitiesRef.current = Array(barCount).fill(0).map(() => (Math.random() - 0.5) * 0.02);
    }

    let frameCount = 0;

    const draw = () => {
      if (!isSpeaking) {
        // Fade out effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Gradually reduce bar heights
        barHeightsRef.current = barHeightsRef.current.map(h => Math.max(0, h * 0.95));
        
        // Check if all bars are nearly zero
        const allZero = barHeightsRef.current.every(h => h < 0.01);
        if (allZero && animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
          barHeightsRef.current = [];
          barVelocitiesRef.current = [];
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
      frameCount++;

      // Clear canvas with slight fade
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / barCount;
      const barSpacing = 1;

      for (let i = 0; i < barCount; i++) {
        // Simulate frequency response - lower frequencies (left) are more prominent in speech
        const baseIntensity = 0.4 + Math.cos(frameCount * 0.05 + i * 0.3) * 0.3;
        const frequencyBias = 1 - (i / barCount) * 0.5; // Lower bars are taller
        
        // Add some randomness and wave motion
        const waveMotion = Math.sin(frameCount * 0.08 + i * 0.5) * 0.2;
        const randomNoise = Math.random() * 0.15;
        
        // Calculate target height
        const targetHeight = (baseIntensity * frequencyBias + waveMotion + randomNoise) * 0.8;
        
        // Smooth transition to target
        const currentHeight = barHeightsRef.current[i] || 0;
        const diff = targetHeight - currentHeight;
        barHeightsRef.current[i] = currentHeight + diff * 0.15;
        
        // Add slight bounce
        barVelocitiesRef.current[i] = (barVelocitiesRef.current[i] || 0) * 0.9 + diff * 0.05;
        barHeightsRef.current[i] += barVelocitiesRef.current[i];
        
        // Clamp values
        barHeightsRef.current[i] = Math.max(0, Math.min(1, barHeightsRef.current[i]));
        
        const normalizedHeight = barHeightsRef.current[i];
        const barHeight = normalizedHeight * canvas.height * 0.9;

        // Calculate color based on bar height (green -> yellow -> red)
        const value = normalizedHeight * 255;
        const hue = 120 - (normalizedHeight * 120); // 120 = green, 0 = red
        const brightness = 50 + (normalizedHeight * 10);
        
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
        if (normalizedHeight > 0.75) {
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
