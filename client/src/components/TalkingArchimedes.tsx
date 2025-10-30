import { useState, useEffect, useRef, useCallback, memo } from 'react';
import archimedesVideo2 from '@assets/wally talking_1757885507158.mp4';

interface TalkingArchimedesProps {
  isTyping: boolean;
  isSpeaking: boolean;
  currentMessage?: string;
  onClose?: () => void; // Added onClose prop
}

export const TalkingArchimedes = memo(function TalkingArchimedes({ isTyping, isSpeaking, onClose }: TalkingArchimedesProps) {
  const shouldShow = isTyping || isSpeaking;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Drag state management - use refs to avoid re-renders during drag
  const positionRef = useRef({ x: window.innerWidth - 250, y: 16 });
  const [position, setPosition] = useState(positionRef.current);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Pause video when not visible to save resources
  useEffect(() => {
    if (videoRef.current) {
      if (shouldShow) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [shouldShow]);

  // Handle mouse down to start dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    };
  }, []);

  // Handle touch start for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: touch.clientX - positionRef.current.x,
      y: touch.clientY - positionRef.current.y
    };
  }, []);

  // Handle mouse move - throttled updates
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingRef.current) {
      const newPos = {
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y
      };
      positionRef.current = newPos;
      requestAnimationFrame(() => setPosition(newPos));
    }
  }, []);

  // Handle touch move for mobile
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDraggingRef.current) {
      const touch = e.touches[0];
      const newPos = {
        x: touch.clientX - dragOffsetRef.current.x,
        y: touch.clientY - dragOffsetRef.current.y
      };
      positionRef.current = newPos;
      requestAnimationFrame(() => setPosition(newPos));
    }
  }, []);

  // Handle mouse up to stop dragging
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Setup drag event listeners only once
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove]);

  if (!shouldShow) return null;

  return (
    <div
      className="fixed z-40 cursor-move"
      style={{
        left: position.x,
        top: position.y,
        willChange: 'transform',
        transition: isDraggingRef.current ? 'none' : 'opacity 0.2s ease-out'
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

        {/* Drag indicator */}
        <div className="absolute top-1 right-1 text-terminal-subtle text-xs opacity-50 pointer-events-none" title="Drag to move">
          ⋮⋮
        </div>
      </div>
    </div>
  );
});

export default TalkingArchimedes;