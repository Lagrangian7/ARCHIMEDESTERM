
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Save, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface NotepadProps {
  notepadId: string;
  onClose: () => void;
}

export function Notepad({ notepadId, onClose }: NotepadProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Untitled Note');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Drag state with staggered initial position based on notepad count
  const notepadIndex = parseInt(notepadId.split('-')[1]) || 0;
  const offsetX = (notepadIndex % 3) * 30;
  const offsetY = (notepadIndex % 3) * 30;
  const [position, setPosition] = useState({ x: window.innerWidth - 370 - offsetX, y: 20 + offsetY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
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

  // Auto-save content to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`notepad-content-${notepadId}`, content);
  }, [content, notepadId]);

  // Auto-save title to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`notepad-title-${notepadId}`, title);
  }, [title, notepadId]);

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

  return (
    <div 
      ref={containerRef}
      className="fixed z-50 w-[350px] h-[600px] flex flex-col border-2 rounded-lg shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
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
      {/* Header with Close Button */}
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

      {/* Toolbar */}
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
            backgroundColor: '#24252f', 
            color: 'var(--terminal-bg)',
            fontWeight: 500
          }}
          disabled={saveMutation.isPending}
        >
          <Save className="w-3 h-3 mr-1" />
          {saveMutation.isPending ? 'Saving...' : 'Save'}
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
        <div className="ml-auto text-xs font-mono" style={{ color: 'var(--terminal-text)', opacity: 0.7 }}>
          {content.length}
        </div>
      </div>

      {/* Text Area */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex-1 p-3 bg-transparent border-none outline-none resize-none font-mono text-xs"
        style={{ 
          color: 'var(--terminal-text)',
          caretColor: 'var(--terminal-highlight)'
        }}
        placeholder="Start typing or paste your notes here..."
        autoFocus
        data-no-terminal-autofocus
        data-testid="notepad-textarea"
      />
    </div>
  );
}
