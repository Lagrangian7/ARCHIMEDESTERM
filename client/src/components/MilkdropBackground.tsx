
import { useEffect, useRef, useState } from 'react';

interface MilkdropBackgroundProps {
  isActive: boolean;
}

export function MilkdropBackground({ isActive }: MilkdropBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const butterchurnRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const presetChangeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let mounted = true;

    // Resize canvas to match container
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

    // Initialize Butterchurn
    const initButterchurn = async () => {
      try {
        // Import Butterchurn
        const butterchurn = await import('butterchurn');
        const butterchurnPresets = await import('butterchurn-presets');
        
        if (!mounted) return;

        // Get presets
        const presetPack = butterchurnPresets.default || butterchurnPresets;
        const presetKeys = Object.keys(presetPack);
        const loadedPresets = presetKeys.map(name => ({
          name,
          preset: presetPack[name]
        }));
        
        setPresets(loadedPresets);
        console.log(`Loaded ${loadedPresets.length} Butterchurn presets`);

        // Initialize audio context and analyser
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        
        // Create Butterchurn visualizer
        const visualizer = butterchurn.default.createVisualizer(
          audioContextRef.current,
          canvas,
          {
            width: canvas.width,
            height: canvas.height,
            pixelRatio: window.devicePixelRatio || 1,
            textureRatio: 1
          }
        );

        butterchurnRef.current = visualizer;

        // Load initial preset
        if (loadedPresets.length > 0) {
          visualizer.loadPreset(loadedPresets[0].preset, 2.0); // 2 second blend time
        }

        // Try to connect to audio
        setTimeout(() => tryConnectToAudio(), 1000);
        const interval = setInterval(() => tryConnectToAudio(), 3000);

        // Auto-cycle presets every 30 seconds
        presetChangeIntervalRef.current = setInterval(() => {
          setCurrentPresetIndex(prev => {
            const nextIndex = (prev + 1) % loadedPresets.length;
            if (butterchurnRef.current && loadedPresets[nextIndex]) {
              butterchurnRef.current.loadPreset(loadedPresets[nextIndex].preset, 2.7);
              console.log(`Switched to preset: ${loadedPresets[nextIndex].name}`);
            }
            return nextIndex;
          });
        }, 30000);

        // Render loop
        const render = () => {
          if (butterchurnRef.current && mounted) {
            butterchurnRef.current.render();
            animationFrameRef.current = requestAnimationFrame(render);
          }
        };
        render();

        return () => clearInterval(interval);
      } catch (error) {
        console.error('Failed to initialize Butterchurn:', error);
      }
    };

    const tryConnectToAudio = () => {
      if (!audioContextRef.current || !analyserRef.current || audioSourceRef.current) return;
      
      const audioElements = document.querySelectorAll('audio');
      
      for (const element of audioElements) {
        const mediaElement = element as HTMLMediaElement;
        
        if (mediaElement.paused || (mediaElement as any)._butterchurnConnected) continue;
        
        try {
          (mediaElement as any)._butterchurnConnected = true;
          const source = audioContextRef.current!.createMediaElementSource(mediaElement);
          source.connect(analyserRef.current!);
          analyserRef.current!.connect(audioContextRef.current!.destination);
          audioSourceRef.current = source;
          
          // Connect to Butterchurn
          if (butterchurnRef.current) {
            butterchurnRef.current.connectAudio(analyserRef.current!);
          }
          
          console.log('✅ Connected Butterchurn to audio');
          return;
        } catch (error) {
          // Already connected, expected with Webamp
        }
      }
    };

    initButterchurn();

    return () => {
      mounted = false;
      window.removeEventListener('resize', resizeCanvas);
      
      if (presetChangeIntervalRef.current) {
        clearInterval(presetChangeIntervalRef.current);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      audioSourceRef.current = null;
      butterchurnRef.current = null;
    };
  }, [isActive]);

  // Keyboard controls for presets
  useEffect(() => {
    if (!isActive || presets.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle keys when visualizer is active and not typing in inputs
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch(e.key) {
        case 'ArrowRight':
        case 'n':
          // Next preset
          setCurrentPresetIndex(prev => {
            const nextIndex = (prev + 1) % presets.length;
            if (butterchurnRef.current && presets[nextIndex]) {
              butterchurnRef.current.loadPreset(presets[nextIndex].preset, 2.7);
              console.log(`Next preset: ${presets[nextIndex].name}`);
            }
            return nextIndex;
          });
          break;
        
        case 'ArrowLeft':
        case 'p':
          // Previous preset
          setCurrentPresetIndex(prev => {
            const nextIndex = (prev - 1 + presets.length) % presets.length;
            if (butterchurnRef.current && presets[nextIndex]) {
              butterchurnRef.current.loadPreset(presets[nextIndex].preset, 2.7);
              console.log(`Previous preset: ${presets[nextIndex].name}`);
            }
            return nextIndex;
          });
          break;
        
        case 'r':
          // Random preset
          const randomIndex = Math.floor(Math.random() * presets.length);
          setCurrentPresetIndex(randomIndex);
          if (butterchurnRef.current && presets[randomIndex]) {
            butterchurnRef.current.loadPreset(presets[randomIndex].preset, 2.7);
            console.log(`Random preset: ${presets[randomIndex].name}`);
          }
          break;
        
        case 'h':
          // Hard cut (instant transition)
          const hardCutIndex = (currentPresetIndex + 1) % presets.length;
          setCurrentPresetIndex(hardCutIndex);
          if (butterchurnRef.current && presets[hardCutIndex]) {
            butterchurnRef.current.loadPreset(presets[hardCutIndex].preset, 0.0);
            console.log(`Hard cut to: ${presets[hardCutIndex].name}`);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActive, presets, currentPresetIndex]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ opacity: 0.95, mixBlendMode: 'screen' }}
      />
      {presets.length > 0 && (
        <div className="absolute bottom-2 left-2 text-xs text-terminal-highlight opacity-70 pointer-events-none">
          {presets[currentPresetIndex]?.name} ({currentPresetIndex + 1}/{presets.length})
          <div className="text-[10px] mt-1">
            ← → : Change Preset | R: Random | H: Hard Cut
          </div>
        </div>
      )}
    </div>
  );
}
