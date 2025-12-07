import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AJVideoPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AJVideoPopup({ isOpen, onClose }: AJVideoPopupProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 300, height: 169 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [savedState, setSavedState] = useState({ x: 100, y: 100, width: 300, height: 169 });
  const containerRef = useRef<HTMLDivElement>(null);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position, isMaximized]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    } else if (isResizing) {
      const newWidth = Math.max(200, e.clientX - position.x);
      const newHeight = Math.max(150, e.clientY - position.y);
      
      setSize({
        width: Math.min(newWidth, window.innerWidth - position.x),
        height: Math.min(newHeight, window.innerHeight - position.y)
      });
    }
  }, [isDragging, isResizing, dragOffset, position, size]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // Setup drag/resize event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Toggle maximize
  const toggleMaximize = () => {
    if (isMaximized) {
      setPosition(savedState);
      setSize({ width: savedState.width, height: savedState.height });
      setIsMaximized(false);
    } else {
      setSavedState({ ...position, ...size });
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setIsMaximized(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-black border-2 shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        borderColor: 'var(--terminal-text)',
        boxShadow: `0 0 20px var(--terminal-text)`,
      }}
      data-testid="aj-video-popup"
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-move select-none"
        style={{
          backgroundColor: 'var(--terminal-bg)',
          borderBottom: `1px solid var(--terminal-text)`,
        }}
        onMouseDown={handleMouseDown}
        data-testid="aj-video-titlebar"
      >
        <span className="font-mono text-sm" style={{ color: 'var(--terminal-text)' }}>
          AJ VIDEO PLAYER
        </span>
        <div className="flex items-center gap-1">
          <Button
            onClick={toggleMaximize}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            style={{ color: 'var(--terminal-text)' }}
            data-testid="button-maximize-aj"
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            style={{ color: 'var(--terminal-text)' }}
            data-testid="button-close-aj"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Video iframe */}
      <div className="relative w-full" style={{ height: 'calc(100% - 40px)' }}>
        <iframe
          src="https://rumble.com/embed/v6zsq34/?pub=4"
          className="w-full h-full"
          frameBorder="0"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="Video"
          data-testid="iframe-aj-video"
        />
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          style={{
            borderRight: `2px solid var(--terminal-text)`,
            borderBottom: `2px solid var(--terminal-text)`,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          data-testid="resize-handle-aj"
        />
      )}
    </div>
  );
}
