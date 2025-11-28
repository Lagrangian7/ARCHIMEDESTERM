
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import archimedesVideo2 from '@assets/wally talking_1757885507158.mp4';

interface TalkingArchimedesProps {
  isTyping: boolean;
  isSpeaking: boolean;
  currentMessage?: string;
  onClose?: () => void;
}

export const TalkingArchimedes = memo(function TalkingArchimedes({ isTyping, isSpeaking }: TalkingArchimedesProps) {
  const shouldShow = isTyping || isSpeaking;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs for all drag-related state to avoid re-renders
  const positionRef = useRef({ x: window.innerWidth - 250, y: 16 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Only update position when dragging stops, not during drag
  const [isVisible, setIsVisible] = useState(false);

  // Show animation immediately when typing or speaking starts
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (shouldShow) {
      setIsVisible(true);
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
      setIsVisible(false);
    }
  }, [shouldShow]);

  // Optimized drag handlers using direct DOM manipulation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    e.stopPropagation();
    
    isDraggingRef.current = true;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    
    document.body.style.userSelect = 'none';
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    
    isDraggingRef.current = true;
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      
      const newX = clientX - dragOffsetRef.current.x;
      const newY = clientY - dragOffsetRef.current.y;
      
      positionRef.current = { x: newX, y: newY };
      
      // Direct DOM manipulation for smooth dragging without re-renders
      containerRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, []);

  if (!shouldShow && !isVisible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-40 cursor-move"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${positionRef.current.x}px, ${positionRef.current.y}px)`,
        willChange: 'transform',
        opacity: shouldShow ? 1 : 0,
        transition: isDraggingRef.current ? 'none' : 'opacity 0.2s ease-out',
        pointerEvents: shouldShow ? 'auto' : 'none'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      data-testid="talking-archimedes-draggable"
    >
      <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-terminal-highlight/40 bg-terminal-bg shadow-lg shadow-terminal-highlight/20 archimedes-glitch-container">
        {/* Video with chromatic aberration effect */}
        <video
          ref={videoRef}
          src={archimedesVideo2}
          loop
          muted
          playsInline
          preload="none"
          className="w-full h-full object-cover pointer-events-none archimedes-video-glitch"
          style={{
            filter: 'contrast(1.15) brightness(0.9) saturate(1.2)',
          }}
        />

        {/* Red channel shift (chromatic aberration) - MORE VISIBLE */}
        <div 
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            background: 'linear-gradient(90deg, rgba(255,0,0,0.4) 0%, transparent 50%, rgba(255,0,0,0.3) 100%)',
            animation: 'archimedesChannelShift 0.1s steps(2) infinite',
            transform: 'translateX(-3px)',
          }}
        />

        {/* Blue channel shift - MORE VISIBLE */}
        <div 
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            background: 'linear-gradient(90deg, rgba(0,100,255,0.3) 0%, transparent 50%, rgba(0,100,255,0.4) 100%)',
            animation: 'archimedesChannelShift 0.1s steps(2) infinite reverse',
            transform: 'translateX(3px)',
          }}
        />

        {/* Heavy scanlines - DARKER */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0px, transparent 1px, transparent 2px, rgba(0, 0, 0, 0.25) 3px)',
          }}
        />

        {/* Animated scanline sweep - BRIGHTER */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(0, 255, 65, 0.25) 50%, transparent 100%)',
            backgroundSize: '100% 15px',
            animation: 'archimedesScanSweep 1.5s linear infinite',
          }}
        />

        {/* VHS tracking glitch bars - MORE VISIBLE */}
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            animation: 'archimedesTrackingGlitch 2s steps(1) infinite',
          }}
        >
          <div 
            className="absolute w-full h-3 bg-terminal-highlight/60"
            style={{
              animation: 'archimedesGlitchBar 0.2s steps(3) infinite',
              top: '25%',
            }}
          />
          <div 
            className="absolute w-full h-2 bg-white/40"
            style={{
              animation: 'archimedesGlitchBar 0.15s steps(2) infinite reverse',
              top: '55%',
            }}
          />
          <div 
            className="absolute w-full h-2 bg-red-500/30"
            style={{
              animation: 'archimedesGlitchBar 0.25s steps(2) infinite',
              top: '75%',
            }}
          />
        </div>

        {/* Noise grain overlay - MORE VISIBLE */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
            animation: 'archimedesNoise 0.03s steps(5) infinite',
          }}
        />

        {/* Horizontal displacement glitch - FASTER */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            animation: 'archimedesHorizontalGlitch 1.5s ease-in-out infinite',
          }}
        />

        {/* Pulsing border glow - STRONGER */}
        <div className="absolute inset-0 rounded-full ring-4 ring-terminal-highlight/80 pointer-events-none"
             style={{ animation: 'archimedesGlow 0.8s ease-in-out infinite' }} />

        {/* Drag indicator */}
        <div className="absolute top-1 right-1 text-terminal-highlight text-xs opacity-70 pointer-events-none select-none drop-shadow-[0_0_3px_rgba(0,255,65,0.5)]" title="Drag to move">
          ⋮⋮
        </div>

        {/* Random bright flash glitch - FASTER */}
        <div 
          className="absolute inset-0 bg-terminal-highlight pointer-events-none rounded-full"
          style={{
            animation: 'archimedesFlash 1.5s steps(1) infinite',
          }}
        />

        {/* Glitch slice effect - FASTER */}
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            clipPath: 'inset(0 0 0 0)',
            animation: 'archimedesSlice 1.5s steps(1) infinite',
          }}
        />

        {/* Extra video distortion layer */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            animation: 'archimedesVideoGlitch 0.1s steps(3) infinite',
            background: 'linear-gradient(transparent 40%, rgba(0,255,65,0.1) 50%, transparent 60%)',
          }}
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.isTyping === nextProps.isTyping && 
         prevProps.isSpeaking === nextProps.isSpeaking;
});

export default TalkingArchimedes;
