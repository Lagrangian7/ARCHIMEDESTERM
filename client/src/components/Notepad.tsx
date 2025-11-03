
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Save, Trash2, X } from 'lucide-react';

interface NotepadProps {
  onClose: () => void;
}

export function Notepad({ onClose }: NotepadProps) {
  const [content, setContent] = useState('');

  // Load saved content from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('notepad-content');
    if (saved) {
      setContent(saved);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('notepad-content', content);
    alert('Note saved!');
  };

  const handleClear = () => {
    if (confirm('Clear all content?')) {
      setContent('');
      localStorage.removeItem('notepad-content');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div 
        className="w-full max-w-3xl h-[80vh] flex flex-col border rounded-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--terminal-bg)',
          borderColor: 'var(--terminal-subtle)'
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-3 border-b"
          style={{ borderColor: 'var(--terminal-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: 'var(--terminal-highlight)' }} />
            <h2 className="text-lg font-bold font-mono" style={{ color: 'var(--terminal-text)' }}>
              NOTEPAD
            </h2>
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
          >
            <Save className="w-4 h-4 mr-2" />
            Save
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
    </div>
  );
}
