import { useState, useEffect, useCallback } from 'react';
import archimedesVideo2 from '@assets/wally talking_1757885507158.mp4';

interface TalkingArchimedesProps {
  isTyping: boolean;
  isSpeaking: boolean;
  currentMessage?: string;
}

export function TalkingArchimedes({ isTyping, isSpeaking, currentMessage }: TalkingArchimedesProps) {
  // Drag state management
  const [position, setPosition] = useState({ x: window.innerWidth - 220, y: 16 }); // Default top-right position
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  if (!isTyping && !isSpeaking) return null;

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
    const maxX = window.innerWidth - 192; // 192px is w-48 (12rem * 16px)
    const maxY = window.innerHeight - 192;
    
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
      data-testid="talking-archimedes-draggable"
    >
      <div className={`relative w-48 h-48 rounded-full overflow-hidden border-2 border-terminal-highlight/20 bg-terminal-bg/70 backdrop-blur-sm transition-all duration-200 ${
        isDragging ? 'scale-105 shadow-2xl shadow-terminal-highlight/20 border-terminal-highlight/50' : ''
      }`}>
        <video 
          src={archimedesVideo2}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Drag indicator */}
        <div className="absolute top-2 right-2 text-terminal-highlight/50 text-xs opacity-50">
          ⋮⋮
        </div>
      </div>
    </div>
  );
}

export default TalkingArchimedes;