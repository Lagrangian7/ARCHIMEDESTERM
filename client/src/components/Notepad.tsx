
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Save, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface NotepadProps {
  onClose: () => void;
}

export function Notepad({ onClose }: NotepadProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('Untitled Note');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load saved content and title from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem('notepad-content');
    const savedTitle = localStorage.getItem('notepad-title');
    if (savedContent) {
      setContent(savedContent);
    }
    if (savedTitle) {
      setTitle(savedTitle);
    }
  }, []);

  // Auto-save content to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('notepad-content', content);
  }, [content]);

  // Auto-save title to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('notepad-title', title);
  }, [title]);

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
      localStorage.removeItem('notepad-content');
      localStorage.removeItem('notepad-title');
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
      localStorage.removeItem('notepad-content');
      localStorage.removeItem('notepad-title');
    }
  };

  return (
    <div className="fixed top-0 right-0 h-full w-[400px] max-w-[90vw] z-50 shadow-2xl flex flex-col border-l"
      style={{
        backgroundColor: 'var(--terminal-bg)',
        borderColor: 'var(--terminal-highlight)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 border-b"
        style={{ borderColor: 'var(--terminal-subtle)' }}
      >
        <div className="flex items-center gap-2 flex-1">
          <FileText className="w-5 h-5" style={{ color: 'var(--terminal-highlight)' }} />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-bold font-mono text-lg border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ color: 'var(--terminal-text)' }}
            placeholder="Note title..."
          />
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="text-xl"
          style={{ color: 'var(--terminal-text)' }}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Toolbar */}
      <div 
        className="flex items-center gap-2 p-2 border-b"
        style={{ borderColor: 'var(--terminal-subtle)' }}
      >
        <Button
          onClick={handleSave}
          size="sm"
          className="font-mono"
          style={{ backgroundColor: 'var(--terminal-highlight)', color: 'var(--terminal-bg)' }}
          disabled={saveMutation.isPending}
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save to Knowledge Base'}
        </Button>
        <Button
          onClick={handleClear}
          size="sm"
          variant="outline"
          className="font-mono"
          style={{ borderColor: 'var(--terminal-subtle)', color: 'var(--terminal-text)' }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear
        </Button>
        <div className="ml-auto text-xs font-mono" style={{ color: 'var(--terminal-text)', opacity: 0.7 }}>
          {content.length} characters
        </div>
      </div>

      {/* Text Area */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 p-4 bg-transparent border-none outline-none resize-none font-mono text-sm"
        style={{ 
          color: 'var(--terminal-text)',
          caretColor: 'var(--terminal-highlight)'
        }}
        placeholder="Start typing or paste your notes here..."
        autoFocus
        data-no-terminal-autofocus
      />
    </div>
  );
}
