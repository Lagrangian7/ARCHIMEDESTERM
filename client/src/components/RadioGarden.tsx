
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RadioGardenProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RadioGarden({ isOpen, onClose }: RadioGardenProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 896, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [savedState, setSavedState] = useState({ x: 100, y: 100, width: 896, height: 600 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && !isMaximized) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }

    if (isResizing && !isMaximized) {
      const newWidth = Math.max(400, e.clientX - position.x);
      const newHeight = Math.max(300, e.clientY - position.y);
      setSize({ width: newWidth, height: newHeight });
    }
  }, [isDragging, isResizing, dragOffset, position, isMaximized]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

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
      data-testid="radio-garden-window"
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-move select-none"
        style={{
          backgroundColor: 'var(--terminal-bg)',
          borderBottom: `1px solid var(--terminal-text)`,
        }}
        onMouseDown={handleMouseDown}
        data-testid="radio-garden-titlebar"
      >
        <span className="font-mono text-sm" style={{ color: 'var(--terminal-text)' }}>
          🌍 RADIO GARDEN - LIVE RADIO WORLDWIDE
        </span>
        <div className="flex items-center gap-1">
          <Button
            onClick={toggleMaximize}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            style={{ color: 'var(--terminal-text)' }}
            data-testid="button-maximize-radio-garden"
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            style={{ color: 'var(--terminal-text)' }}
            data-testid="button-close-radio-garden"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Radio Garden iframe */}
      <div className="relative w-full" style={{ height: 'calc(100% - 40px)' }}>
        <iframe
          src="https://radio.garden"
          className="w-full h-full"
          frameBorder="0"
          allowFullScreen
          title="Radio Garden"
          allow="autoplay"
          data-testid="radio-garden-iframe"
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
          data-testid="resize-handle-radio-garden"
        />
      )}
    </div>
  );
}
