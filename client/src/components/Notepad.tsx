
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Save, Trash2, X, Eye, Minus, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface NotepadProps {
  notepadId: string;
  onClose: () => void;
}

export function Notepad({ notepadId, onClose }: NotepadProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Untitled Note');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previewRef = useRef<HTMLDivElement>(null);

  // Drag state with staggered initial position based on notepad count
  const notepadIndex = parseInt(notepadId.split('-')[1]) || 0;
  const offsetX = (notepadIndex % 3) * 30;
  const offsetY = (notepadIndex % 3) * 30;
  const [position, setPosition] = useState({ x: window.innerWidth - 370 - offsetX, y: 20 + offsetY });
  const [size, setSize] = useState({ width: 350, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved content and title from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem(`notepad-content-${notepadId}`);
    const savedTitle = localStorage.getItem(`notepad-title-${notepadId}`);
    if (savedContent) {
      setContent(savedContent);
    }
    if (savedTitle) {
      setTitle(savedTitle);
    }
  }, [notepadId]);

  // Dragging handlers
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

    const maxX = window.innerWidth - 350;
    const maxY = window.innerHeight - 100;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  }, [size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;

    let newWidth = size.width;
    let newHeight = size.height;
    let newX = position.x;
    let newY = position.y;

    if (resizeDirection.includes('e')) {
      newWidth = Math.max(300, resizeStart.width + deltaX);
    }
    if (resizeDirection.includes('w')) {
      newWidth = Math.max(300, resizeStart.width - deltaX);
      newX = position.x + (resizeStart.width - newWidth);
    }
    if (resizeDirection.includes('s')) {
      newHeight = Math.max(200, resizeStart.height + deltaY);
    }
    if (resizeDirection.includes('n')) {
      newHeight = Math.max(200, resizeStart.height - deltaY);
      newY = position.y + (resizeStart.height - newHeight);
    }

    setSize({ width: newWidth, height: newHeight });
    if (newX !== position.x || newY !== position.y) {
      setPosition({ x: newX, y: newY });
    }
  }, [isResizing, resizeDirection, resizeStart, size, position]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection('');
  }, []);

  // Setup drag and resize event listeners
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

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Auto-save content to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`notepad-content-${notepadId}`, content);
  }, [content, notepadId]);

  // Auto-save title to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`notepad-title-${notepadId}`, title);
  }, [title, notepadId]);

  // Trigger MathJax rendering when preview mode changes or content updates
  useEffect(() => {
    if (isPreviewMode && previewRef.current && window.MathJax) {
      (window.MathJax.typesetPromise as (elements?: Element[]) => Promise<void>)([previewRef.current]).catch((err: any) => {
        console.error('MathJax typesetting error in notepad:', err);
      });
    }
  }, [isPreviewMode, content]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save note');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Note Saved",
        description: `"${title}" has been saved to your knowledge base. Use 'docs' or 'read ${title}' to access it.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      localStorage.removeItem(`notepad-content-${notepadId}`);
      localStorage.removeItem(`notepad-title-${notepadId}`);
      setContent('');
      setTitle('Untitled Note');
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!content.trim()) {
      toast({
        title: "Empty Note",
        description: "Please add some content before saving.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  const handleClear = () => {
    if (confirm('Clear all content?')) {
      setContent('');
      setTitle('Untitled Note');
      localStorage.removeItem(`notepad-content-${notepadId}`);
      localStorage.removeItem(`notepad-title-${notepadId}`);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(content).then(() => {
      toast({
        title: "Copied!",
        description: "Text copied to clipboard",
      });
    }).catch(() => {
      toast({
        title: "Copy Failed",
        description: "Could not copy text to clipboard",
        variant: "destructive",
      });
    });
  };

  return (
    <div 
      ref={containerRef}
      className="fixed z-50 flex flex-col border-2 rounded-lg shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
        backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.85)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        borderColor: 'var(--terminal-highlight)',
        boxShadow: `0 0 20px rgba(var(--terminal-subtle-rgb), 0.3), 0 8px 32px rgba(0, 0, 0, 0.4)`,
        willChange: 'transform',
        transform: 'translateZ(0)',
        isolation: 'isolate',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      data-testid="notepad-panel"
    >
      {/* Resize Handles */}
      {!isMinimized && (
        <>
          <div onMouseDown={(e) => handleResizeStart(e, 'n')} className="absolute top-0 left-0 right-0 h-1 cursor-n-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 's')} className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'w')} className="absolute top-0 bottom-0 left-0 w-1 cursor-w-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'e')} className="absolute top-0 bottom-0 right-0 w-1 cursor-e-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'ne')} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" />
        </>
      )}
      {/* Header with Minimize and Close Buttons */}
      <div 
        className="flex items-center justify-between p-2 border-b cursor-move select-none"
        style={{ borderColor: 'var(--terminal-subtle)' }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--terminal-highlight)' }} />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            className="font-bold font-mono text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
            style={{ color: 'var(--terminal-text)' }}
            placeholder="Note title..."
          />
          <div className="text-terminal-subtle text-xs opacity-50 ml-1" title="Drag to move">
            ⋮⋮
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            onClick={() => setIsMinimized(!isMinimized)}
            onMouseDown={(e) => e.stopPropagation()}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            style={{ color: 'var(--terminal-text)' }}
            title={isMinimized ? "Restore" : "Minimize"}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            style={{ color: 'var(--terminal-text)' }}
            data-testid="button-close-notepad"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      {!isMinimized && (
        <div 
          className="flex items-center gap-1.5 p-2 border-b flex-wrap"
          style={{ borderColor: 'var(--terminal-subtle)' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Button
            onClick={handleSave}
            size="sm"
            className="font-mono text-xs h-7 px-2.5"
            style={{ 
              backgroundColor: 'var(--terminal-highlight)', 
              color: 'var(--terminal-bg)',
              fontWeight: 500
            }}
            disabled={saveMutation.isPending}
          >
            <Save className="w-3 h-3 mr-1" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button
            onClick={handleCopyText}
            size="sm"
            variant="outline"
            className="font-mono text-xs h-7 px-2.5 hover:opacity-80"
            style={{ 
              backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.15)',
              borderColor: 'rgba(var(--terminal-subtle-rgb), 0.4)', 
              color: 'var(--terminal-text)' 
            }}
            disabled={!content.trim()}
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy
          </Button>
          <Button
            onClick={handleClear}
            size="sm"
            variant="outline"
            className="font-mono text-xs h-7 px-2.5 hover:opacity-80"
            style={{ 
              backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.15)',
              borderColor: 'rgba(var(--terminal-subtle-rgb), 0.4)', 
              color: 'var(--terminal-text)' 
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
          <Button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            size="sm"
            variant="outline"
            className="font-mono text-xs h-7 px-2.5 hover:opacity-80"
            style={{ 
              backgroundColor: isPreviewMode ? 'rgba(var(--terminal-highlight-rgb), 0.2)' : 'rgba(var(--terminal-subtle-rgb), 0.15)',
              borderColor: isPreviewMode ? 'var(--terminal-highlight)' : 'rgba(var(--terminal-subtle-rgb), 0.4)', 
              color: 'var(--terminal-text)' 
            }}
          >
            <Eye className="w-3 h-3 mr-1" />
            Preview
          </Button>
          <div className="ml-auto text-xs font-mono" style={{ color: 'var(--terminal-text)', opacity: 0.7 }}>
            {content.length}
          </div>
        </div>
      )}

      {/* Text Area / Preview */}
      {!isMinimized && (isPreviewMode ? (
        <div
          ref={previewRef}
          className="flex-1 p-3 overflow-auto"
          style={{ 
            color: 'var(--terminal-text)',
            backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.1)'
          }}
          onMouseDown={(e) => e.stopPropagation()}
          data-testid="notepad-preview"
        >
          {content ? (
            <div 
              className="notepad-preview-content text-xs leading-relaxed"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="text-xs opacity-50">No content to preview</div>
          )}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex-1 p-3 bg-transparent border-none outline-none resize-none font-mono text-xs"
          style={{ 
            color: 'var(--terminal-text)',
            caretColor: 'var(--terminal-highlight)'
          }}
          placeholder="Start typing or paste your notes here... (Wolfram Alpha results will render in Preview mode)"
          autoFocus
          data-no-terminal-autofocus
          data-testid="notepad-textarea"
        />
      ))}
    </div>
  );
}
