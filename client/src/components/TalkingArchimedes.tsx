
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import archimedesVideo2 from '@assets/wally talking_1757885507158.mp4';

interface TalkingArchimedesProps {
  isTyping: boolean;
  isSpeaking: boolean;
  currentMessage?: string;
  onClose?: () => void;
}

export const TalkingArchimedes = memo(function TalkingArchimedes({ isTyping, isSpeaking }: TalkingArchimedesProps) {
  const [shouldKeepVisible, setShouldKeepVisible] = useState(false);
  const shouldShow = isTyping || isSpeaking || shouldKeepVisible;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const speechEndTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate initial position in visible terminal area
  const getInitialPosition = () => {
    // Get voice controls height (top bar)
    const voiceControls = document.querySelector('.voice-controls');
    const voiceControlsHeight = voiceControls?.getBoundingClientRect().height || 60;
    
    // Position in top-right of visible area, below voice controls
    const x = window.innerWidth - 180; // 180px from right edge
    const y = voiceControlsHeight + 20; // 20px below voice controls
    
    return { x, y };
  };

  // Use refs for all drag-related state to avoid re-renders
  const positionRef = useRef(getInitialPosition());
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Only update position when dragging stops, not during drag
  const [isVisible, setIsVisible] = useState(false);

  // Show animation immediately when typing or speaking starts, keep looping until both end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (shouldShow) {
      setIsVisible(true);
      // Recalculate position when showing to ensure it's in visible area
      positionRef.current = getInitialPosition();
      if (containerRef.current) {
        const { x, y } = positionRef.current;
        containerRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      // Ensure video is looping and playing continuously
      video.loop = true;
      video.muted = true; // Ensure video sound doesn't interfere with TTS
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Auto-play was prevented, try again
          setTimeout(() => video.play().catch(() => {}), 100);
        });
      }
    } else {
      // Only hide after both typing AND speaking are completely done
      video.pause();
      video.currentTime = 0;
      setIsVisible(false);
    }
  }, [shouldShow]);

  // Additional effect to ensure video keeps playing during speech
  useEffect(() => {
    if (!isSpeaking || !videoRef.current) return;

    const video = videoRef.current;
    const ensureVideoPlaying = setInterval(() => {
      if (video.paused && isSpeaking) {
        video.play().catch(() => {});
      }
    }, 500); // Check every 500ms to ensure video is playing

    return () => clearInterval(ensureVideoPlaying);
  }, [isSpeaking]);

  // Monitor speech synthesis to keep animation visible until TTS truly ends
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const checkSpeechStatus = () => {
      const stillSpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
      
      if (stillSpeaking) {
        setShouldKeepVisible(true);
        // Clear any pending timeout
        if (speechEndTimeoutRef.current) {
          clearTimeout(speechEndTimeoutRef.current);
        }
      } else if (shouldKeepVisible && !isSpeaking) {
        // Only hide if both props are false AND synthesis is done
        // Add a small delay before hiding to ensure speech has truly ended
        speechEndTimeoutRef.current = setTimeout(() => {
          setShouldKeepVisible(false);
        }, 800); // Slightly longer delay for clean transition
      }
    };

    // Check speech status frequently while potentially speaking
    const intervalId = setInterval(checkSpeechStatus, 200); // Check more frequently

    return () => {
      clearInterval(intervalId);
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
      }
    };
  }, [shouldKeepVisible, isSpeaking]);

  // Listen for speech end events
  useEffect(() => {
    const handleSpeechEnd = () => {
      // Wait a bit before hiding to ensure clean transition
      speechEndTimeoutRef.current = setTimeout(() => {
        setShouldKeepVisible(false);
      }, 300);
    };

    const handleSpeechStart = () => {
      setShouldKeepVisible(true);
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
      }
    };

    // Listen for custom events or speech synthesis events
    window.addEventListener('speechend', handleSpeechEnd);
    window.addEventListener('speechstart', handleSpeechStart);

    return () => {
      window.removeEventListener('speechend', handleSpeechEnd);
      window.removeEventListener('speechstart', handleSpeechStart);
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
      }
    };
  }, []);

  // Optimized drag handlers using direct DOM manipulation
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Stop any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Stop video and hide animation
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    setShouldKeepVisible(false);
    setIsVisible(false);
  }, []);

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
      className="fixed z-[9999] cursor-move"
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
      onDoubleClick={handleDoubleClick}
      data-testid="talking-archimedes-draggable"
      title="Double-click to stop speech"
    >
      <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-terminal-highlight/40 bg-terminal-bg shadow-lg shadow-terminal-highlight/20 archimedes-glitch-container">
        {/* Video with chromatic aberration effect */}
        <video
          ref={videoRef}
          src={archimedesVideo2}
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover pointer-events-none archimedes-video-glitch"
          style={{
            filter: 'contrast(1.15) brightness(0.9) saturate(1.2)',
          }}
        />

        {/* Combined chromatic aberration layer - OPTIMIZED */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, rgba(255,0,0,0.35) 0%, transparent 30%, transparent 70%, rgba(0,100,255,0.35) 100%)',
            animation: 'archimedesChannelShift 0.2s steps(2) infinite',
            willChange: 'opacity',
          }}
        />

        {/* Scanlines + sweep combined - OPTIMIZED */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.2) 0px, transparent 1px, transparent 2px, rgba(0, 0, 0, 0.2) 3px),
              linear-gradient(180deg, transparent 0%, rgba(0, 255, 65, 0.2) 50%, transparent 100%)
            `,
            backgroundSize: '100% 100%, 100% 20px',
            animation: 'archimedesScanSweep 2s linear infinite',
            willChange: 'background-position',
          }}
        />

        {/* VHS tracking bar - single optimized */}
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ animation: 'archimedesTrackingGlitch 3s steps(1) infinite' }}
        >
          <div 
            className="absolute w-full h-2 bg-terminal-highlight/50"
            style={{ animation: 'archimedesGlitchBar 0.3s steps(2) infinite', top: '40%' }}
          />
        </div>

        {/* Pulsing border glow */}
        <div 
          className="absolute inset-0 rounded-full ring-3 ring-terminal-highlight/70 pointer-events-none"
          style={{ animation: 'archimedesGlow 1.5s ease-in-out infinite', willChange: 'box-shadow' }} 
        />

        {/* Drag indicator */}
        <div className="absolute top-1 right-1 text-terminal-highlight text-xs opacity-70 pointer-events-none select-none" title="Drag to move">
          ⋮⋮
        </div>

        {/* Flash glitch - optimized timing */}
        <div 
          className="absolute inset-0 bg-terminal-highlight pointer-events-none rounded-full"
          style={{ animation: 'archimedesFlash 3s steps(1) infinite', willChange: 'opacity' }}
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
