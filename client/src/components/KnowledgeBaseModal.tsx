
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentsList } from '@/components/DocumentsList';
import { DocumentUpload } from '@/components/DocumentUpload';

interface KnowledgeBaseModalProps {
  onClose: () => void;
}

export function KnowledgeBaseModal({ onClose }: KnowledgeBaseModalProps) {
  // Resizable window state - start with default size
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ width: 0, height: 0, mouseX: 0, mouseY: 0 });

  // Center window within terminal area on mount
  useEffect(() => {
    const terminalAreaTop = 60; // Voice controls height
    const terminalAreaBottom = 60; // Command input height
    const centerX = (window.innerWidth - dimensions.width) / 2;
    const centerY = terminalAreaTop + ((window.innerHeight - terminalAreaTop - terminalAreaBottom - dimensions.height) / 2);
    setPosition({ x: Math.max(0, centerX), y: Math.max(terminalAreaTop, centerY) });
  }, []);

  // Handle window dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const terminalAreaTop = 60;
      const terminalAreaBottom = 60;
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      setPosition(prev => ({
        x: Math.max(0, Math.min(window.innerWidth - dimensions.width, prev.x + deltaX)),
        y: Math.max(terminalAreaTop, Math.min(window.innerHeight - terminalAreaBottom - dimensions.height, prev.y + deltaY))
      }));

      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dimensions]);

  // Handle window resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const terminalAreaTop = 60;
      const terminalAreaBottom = 60;
      const deltaX = e.clientX - resizeStartRef.current.mouseX;
      const deltaY = e.clientY - resizeStartRef.current.mouseY;

      setDimensions({
        width: Math.max(400, Math.min(window.innerWidth - position.x, resizeStartRef.current.width + deltaX)),
        height: Math.max(300, Math.min(window.innerHeight - terminalAreaBottom - position.y, resizeStartRef.current.height + deltaY))
      });
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, position]);

  const toggleMaximize = () => {
    const terminalAreaTop = 60;
    const terminalAreaBottom = 60;
    
    if (isMaximized) {
      // Restore previous size and center position
      setDimensions({ width: 600, height: 600 });
      const centerX = (window.innerWidth - 600) / 2;
      const centerY = terminalAreaTop + ((window.innerHeight - terminalAreaTop - terminalAreaBottom - 600) / 2);
      setPosition({ x: Math.max(0, centerX), y: Math.max(terminalAreaTop, centerY) });
      setIsMaximized(false);
    } else {
      // Maximize to terminal area
      setIsMaximized(true);
    }
  };

  // Calculate terminal area boundaries
  const terminalAreaTop = 60;
  const terminalAreaBottom = 60;
  const terminalAreaHeight = window.innerHeight - terminalAreaTop - terminalAreaBottom;

  return (
    <div 
      className="fixed z-50 overflow-hidden shadow-2xl flex flex-col"
      style={{
        width: isMaximized ? '100vw' : `${dimensions.width}px`,
        height: isMaximized ? `${terminalAreaHeight}px` : `${dimensions.height}px`,
        left: isMaximized ? '0' : `${position.x}px`,
        top: isMaximized ? `${terminalAreaTop}px` : `${position.y}px`,
        backgroundColor: 'var(--terminal-bg)',
        border: `2px solid var(--terminal-highlight)`,
        boxShadow: `0 0 20px rgba(var(--terminal-highlight-rgb), 0.4)`,
        borderRadius: '8px',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        willChange: 'transform',
        transform: 'translateZ(0)',
        isolation: 'isolate'
      }}
      data-testid="knowledge-base-panel"
      data-no-terminal-autofocus
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 cursor-move"
        style={{
          backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.8)',
          borderBottom: `1px solid var(--terminal-highlight)`,
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
        }}
        onMouseDown={(e) => {
          if (!isMaximized && e.target === e.currentTarget) {
            setIsDragging(true);
            dragStartRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
      >
        <h2 className="text-xs md:text-sm font-bold font-mono" style={{ color: 'var(--terminal-text)' }}>
          📚 Knowledge Base
        </h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleMaximize}
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            style={{
              backgroundColor: 'var(--terminal-bg)',
              color: 'var(--terminal-highlight)',
              borderColor: 'var(--terminal-border)',
            }}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-xl md:text-2xl hover:bg-terminal-highlight hover:text-terminal-bg transition-colors"
            style={{ color: 'var(--terminal-text)' }}
            data-testid="close-upload-modal"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col p-2 gap-2">
        <div className="flex-shrink-0" style={{ maxHeight: '180px' }}>
          <DocumentUpload />
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          <DocumentsList onClose={onClose} />
        </div>
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          style={{
            borderRight: `2px solid var(--terminal-highlight)`,
            borderBottom: `2px solid var(--terminal-highlight)`,
            borderBottomRightRadius: '6px',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
            resizeStartRef.current = {
              width: dimensions.width,
              height: dimensions.height,
              mouseX: e.clientX,
              mouseY: e.clientY
            };
          }}
        />
      )}
    </div>
  );
}
