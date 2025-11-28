
import { useEffect, useRef, useState } from 'react';

interface MilkdropBackgroundProps {
  isActive: boolean;
}

export function MilkdropBackground({ isActive }: MilkdropBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const butterchurnRef = useRef<any>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const presetChangeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Initialize Butterchurn
    const initButterchurn = async () => {
      try {
        const butterchurn = await import('butterchurn');
        const butterchurnPresets = await import('butterchurn-presets');
        
        // Get all presets
        const presetPack = butterchurnPresets.default || butterchurnPresets;
        const presetArray = Object.keys(presetPack).map(name => ({
          name,
          preset: presetPack[name]
        }));
        
        setPresets(presetArray);
        
        // Create visualizer
        const visualizer = butterchurn.default.createVisualizer(
          audioContextRef.current!,
          canvas,
          {
            width: canvas.width,
            height: canvas.height,
            pixelRatio: window.devicePixelRatio || 1,
            textureRatio: 1
          }
        );
        
        butterchurnRef.current = visualizer;
        
        // Load first preset
        if (presetArray.length > 0) {
          visualizer.loadPreset(presetArray[0].preset, 2.0); // 2 second blend
        }
        
      } catch (error) {
        console.log('Butterchurn not available, using fallback visualizer');
        useFallbackVisualizer();
      }
    };

    // Fallback visualizer (your current implementation)
    const useFallbackVisualizer = () => {
      let time = 0;
      const dataArray = new Uint8Array(analyserRef.current?.frequencyBinCount || 256);

      const animate = () => {
        if (!ctx || !canvas) return;

        time += 0.015;

        // Get audio data if available
        let averageVolume = 0;
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          averageVolume = sum / dataArray.length / 255;
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

        // Draw frequency bars
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

      animate();
    };

    // Initialize audio context and analyser
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;
        analyserRef.current.smoothingTimeConstant = 0.8;

        // Try to connect to existing audio elements (like Webamp)
        try {
          // Find all audio/video elements on the page
          const audioElements = document.querySelectorAll('audio, video');
          
          if (audioElements.length > 0) {
            // Connect to the first audio element found (typically Webamp)
            const audioElement = audioElements[0] as HTMLMediaElement;
            const source = audioContextRef.current.createMediaElementSource(audioElement);
            
            // Create a splitter so audio continues to play normally
            const destination = audioContextRef.current.destination;
            source.connect(analyserRef.current);
            analyserRef.current.connect(destination);
            
            console.log('Connected to system audio element for visualization');
          } else {
            console.log('No audio elements found, using visual-only mode');
          }
        } catch (error) {
          console.log('Could not connect to system audio, using visual-only mode:', error);
        }
      } catch (error) {
        console.log('Audio context initialization failed');
      }
    };

    // Resize canvas
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      if (butterchurnRef.current) {
        butterchurnRef.current.setRendererSize(canvas.width, canvas.height);
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initAudio();
    initButterchurn();

    // Butterchurn render loop
    const renderButterchurn = () => {
      if (butterchurnRef.current) {
        butterchurnRef.current.render();
        animationFrameRef.current = requestAnimationFrame(renderButterchurn);
      }
    };

    // Auto-change presets every 15 seconds
    presetChangeIntervalRef.current = setInterval(() => {
      if (butterchurnRef.current && presets.length > 0) {
        const nextIndex = (currentPresetIndex + 1) % presets.length;
        setCurrentPresetIndex(nextIndex);
        butterchurnRef.current.loadPreset(presets[nextIndex].preset, 2.7); // 2.7 second blend
        console.log(`Transitioning to preset: ${presets[nextIndex].name}`);
      }
    }, 15000);

    // Start render loop if using Butterchurn
    if (butterchurnRef.current) {
      renderButterchurn();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (presetChangeIntervalRef.current) {
        clearInterval(presetChangeIntervalRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      // Butterchurn cleanup - just null the reference
      butterchurnRef.current = null;
    };
  }, [isActive, presets, currentPresetIndex]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.65, mixBlendMode: 'screen' }}
    />
  );
}
