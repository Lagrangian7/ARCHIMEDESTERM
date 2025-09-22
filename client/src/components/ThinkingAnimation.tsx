import { useState, useEffect, useCallback } from 'react';
import thinkingVideo from '@assets/thinking_1757974879665.mp4';

interface ThinkingAnimationProps {
  isThinking: boolean;
}

export function ThinkingAnimation({ isThinking }: ThinkingAnimationProps) {
  // Drag state management
  const [position, setPosition] = useState({ x: 16, y: 16 }); // Default top-left position
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  if (!isThinking) return null;

  // Drag functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Boundary constraints to keep character on screen
    const maxX = window.innerWidth - 48; // 48px is w-12 (3rem * 16px)
    const maxY = window.innerHeight - 48;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Setup drag event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div 
      className="fixed z-40 cursor-move"
      style={{
        left: position.x,
        top: position.y,
        transition: isDragging ? 'none' : 'all 0.2s ease-out'
      }}
      onMouseDown={handleMouseDown}
      data-testid="thinking-animation-draggable"
    >
      <div className={`relative w-12 h-12 rounded-full overflow-hidden border border-terminal-highlight/20 bg-terminal-bg/70 backdrop-blur-sm transition-all duration-200 ${
        isDragging ? 'scale-110 shadow-xl shadow-terminal-highlight/20 border-terminal-highlight/50' : ''
      }`}>
        <video 
          src={thinkingVideo}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          data-testid="thinking-animation"
        />
        
        {/* Drag indicator */}
        <div className="absolute top-0 right-0 text-terminal-highlight/50 text-xs opacity-50" style={{ fontSize: '6px' }}>
          ⋮⋮
        </div>
      </div>
    </div>
  );
}

export default ThinkingAnimation;