
import { useState, useEffect, useRef, useCallback } from 'react';
import archimedesVideo2 from '@assets/wally talking_1757885507158.mp4';

interface TalkingArchimedesProps {
  isTyping: boolean;
  isSpeaking: boolean;
  currentMessage?: string;
}

export function TalkingArchimedes({ isTyping, isSpeaking, currentMessage }: TalkingArchimedesProps) {
  const shouldShow = isTyping || isSpeaking;
  
  // Drag state management
  const [position, setPosition] = useState({ x: window.innerWidth - 250, y: 16 }); // Start at top-right
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Handle mouse down to start dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  // Handle touch start for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragOffset({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  }, [position]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  // Handle touch move for mobile
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragOffset.x,
        y: touch.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  // Handle mouse up to stop dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle touch end for mobile
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Setup drag event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  if (!shouldShow) return null;

  return (
    <div 
      className="fixed z-40 cursor-move"
      style={{
        left: position.x,
        top: position.y,
        transition: isDragging ? 'none' : 'all 0.2s ease-out'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      data-testid="talking-archimedes-draggable"
    >
      <div className={`relative ${shouldShow ? 'opacity-100' : 'opacity-0'}`}>
        <div className="relative w-32 h-32 rounded-full overflow-hidden border border-terminal-highlight/20 bg-terminal-bg">
          <video 
            src={archimedesVideo2}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover pointer-events-none"
          />
          
          {/* Drag indicator */}
          <div className="absolute top-1 right-1 text-terminal-subtle text-xs opacity-50 pointer-events-none" title="Drag to move">
            ⋮⋮
          </div>
        </div>
      </div>
    </div>
  );
}

export default TalkingArchimedes;
