
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Play, Download, Share2, Zap, BookOpen, Code2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuickActionsProps {
  onSave?: () => void;
  onRun?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  theme: any;
}

export function QuickActions({ onSave, onRun, onDownload, onShare, theme }: QuickActionsProps) {
  const { toast } = useToast();
  const [showTooltips, setShowTooltips] = useState(true);

  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 border-b"
      style={{ 
        backgroundColor: theme.subtle,
        borderColor: theme.border,
      }}
    >
      <Button
        onClick={onSave}
        variant="ghost"
        size="sm"
        className="text-xs"
        style={{ color: theme.highlight }}
        title="Save (Ctrl+S)"
      >
        <Save className="w-4 h-4 mr-1" />
        Save
      </Button>
      
      <Button
        onClick={onRun}
        variant="ghost"
        size="sm"
        className="text-xs"
        style={{ color: theme.highlight }}
        title="Run (Ctrl+Enter)"
      >
        <Play className="w-4 h-4 mr-1" />
        Run
      </Button>
      
      <Button
        onClick={onDownload}
        variant="ghost"
        size="sm"
        className="text-xs"
        style={{ color: theme.highlight }}
        title="Download"
      >
        <Download className="w-4 h-4 mr-1" />
        Export
      </Button>
      
      <Button
        onClick={onShare}
        variant="ghost"
        size="sm"
        className="text-xs"
        style={{ color: theme.highlight }}
        title="Share code"
      >
        <Share2 className="w-4 h-4 mr-1" />
        Share
      </Button>
      
      <div className="flex-1" />
      
      <Button
        onClick={() => toast({ title: "Quick Actions", description: "Use Ctrl+K for command palette" })}
        variant="ghost"
        size="sm"
        className="text-xs"
        style={{ color: theme.text, opacity: 0.6 }}
      >
        <Zap className="w-4 h-4 mr-1" />
        Shortcuts
      </Button>
    </div>
  );
}
