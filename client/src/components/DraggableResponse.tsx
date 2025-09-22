import { useState, useEffect, useCallback, ReactNode } from 'react';

interface DraggableResponseProps {
  children: ReactNode;
  isTyping: boolean;
  entryId: string;
}

export function DraggableResponse({ children, isTyping, entryId }: DraggableResponseProps) {
  // Drag state management
  const [position, setPosition] = useState({ x: 100, y: 100 }); // Default position
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showFloating, setShowFloating] = useState(false);

  // Show floating version when typing starts
  useEffect(() => {
    if (isTyping) {
      setShowFloating(true);
    } else {
      // Hide floating version when typing ends
      const hideTimer = setTimeout(() => {
        setShowFloating(false);
      }, 500); // Short delay to allow animation completion
      
      return () => clearTimeout(hideTimer);
    }
  }, [isTyping]);

  // Drag functionality - similar to RadioCharacter
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

    // Boundary constraints to keep response on screen
    const maxX = window.innerWidth - 400; // Assuming max width of 400px for response
    const maxY = window.innerHeight - 200; // Assuming max height of 200px for response
    
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

  // If not typing and not showing floating version, render normally in place
  if (!isTyping && !showFloating) {
    return <>{children}</>;
  }

  // When typing or showing floating, render both: original (hidden) + floating draggable version
  return (
    <>
      {/* Original response in place (hidden when typing to avoid duplication) */}
      <div className={`${isTyping ? 'opacity-0 pointer-events-none' : ''}`}>
        {children}
      </div>
      
      {/* Floating draggable version when typing */}
      {showFloating && (
        <div 
          className="fixed z-50 cursor-move"
          style={{
            left: position.x,
            top: position.y,
            transition: isDragging ? 'none' : 'all 0.2s ease-out'
          }}
          onMouseDown={handleMouseDown}
          data-testid={`draggable-response-${entryId}`}
        >
          <div className={`relative transition-all duration-300 ease-out ${
            showFloating ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          } ${isDragging ? 'scale-105' : ''}`}>
            {/* Response Container with terminal styling */}
            <div className={`relative max-w-md p-4 rounded-lg border-2 border-terminal-highlight/30 bg-terminal-bg/90 backdrop-blur-sm transition-all duration-200 ${
              isDragging ? 'shadow-2xl shadow-terminal-highlight/20 border-terminal-highlight/50' : ''
            }`}>
              {/* Header */}
              <div className="text-terminal-highlight mb-2 text-sm font-mono">
                ARCHIMEDES v7 Response:
              </div>
              
              {/* Response Content */}
              <div className="text-terminal-text font-mono text-sm leading-relaxed">
                {children}
              </div>
              
              {/* Drag indicator */}
              <div className="absolute top-2 right-2 text-terminal-subtle text-xs opacity-50">
                ⋮⋮
              </div>
              
              {/* Glowing border effect */}
              <div className="absolute inset-0 rounded-lg ring-1 ring-terminal-highlight/20 animate-pulse" 
                   style={{ animationDuration: '2s' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DraggableResponse;