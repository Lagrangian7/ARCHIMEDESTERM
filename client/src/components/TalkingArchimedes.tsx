
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

  // Optimize video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (shouldShow) {
      if (!isVisible) setIsVisible(true);
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
      setIsVisible(false);
    }
  }, [shouldShow, isVisible]);

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
      <div className="relative w-32 h-32 rounded-full overflow-hidden border border-terminal-highlight/20 bg-terminal-bg">
        <video
          ref={videoRef}
          src={archimedesVideo2}
          loop
          muted
          playsInline
          preload="none"
          className="w-full h-full object-cover pointer-events-none"
        />

        <div className="absolute top-1 right-1 text-terminal-subtle text-xs opacity-50 pointer-events-none select-none" title="Drag to move">
          ⋮⋮
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.isTyping === nextProps.isTyping && 
         prevProps.isSpeaking === nextProps.isSpeaking;
});

export default TalkingArchimedes;
