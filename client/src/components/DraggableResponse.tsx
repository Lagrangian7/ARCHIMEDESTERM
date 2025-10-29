import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Save } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DraggableResponseProps {
  children: ReactNode;
  isTyping: boolean;
  entryId: string;
}

export const DraggableResponse = memo(function DraggableResponse({ children, isTyping, entryId }: DraggableResponseProps) {
  const { toast } = useToast();

  // Drag state management
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null); // Null until calculated
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showFloating, setShowFloating] = useState(isTyping); // Start visible if already typing
  const responseElementRef = useRef<HTMLDivElement>(null);

  // Extract text content from ReactNode
  const extractTextContent = (node: ReactNode): string => {
    if (typeof node === 'string') {
      // If it's HTML string, create a temporary div to extract text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = node;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      return textContent.trim();
    }
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractTextContent).join('');
    if (node && typeof node === 'object' && 'props' in node) {
      // Handle dangerouslySetInnerHTML case
      if (node.props && node.props.dangerouslySetInnerHTML && node.props.dangerouslySetInnerHTML.__html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = node.props.dangerouslySetInnerHTML.__html;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        return textContent.trim();
      }
      return extractTextContent(node.props.children);
    }
    return '';
  };

  // Save to knowledge base mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Try to extract text content
      let textContent = extractTextContent(children);

      // If extraction failed, try to get it directly from the rendered DOM element
      if (!textContent || !textContent.trim()) {
        const floatingDiv = document.querySelector(`[data-testid="draggable-response-${entryId}"]`);
        if (floatingDiv) {
          const contentDiv = floatingDiv.querySelector('[data-no-drag]')?.parentElement?.querySelector('div');
          if (contentDiv) {
            textContent = contentDiv.textContent || contentDiv.innerText || '';
          }
        }
      }

      // Final validation
      if (!textContent || !textContent.trim()) {
        console.error('Failed to extract content from children:', children);
        throw new Error('Unable to extract text content from response. Please try again.');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `archimedes-response-${timestamp}.txt`;

      const response = await apiRequest('POST', '/api/documents/save-text', {
        content: textContent.trim(),
        filename: filename,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Saved to Knowledge Base',
        description: `Response saved as ${data.document.originalName}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      // Dismiss the bubble after successful save
      setShowFloating(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save to knowledge base',
        variant: 'destructive',
      });
    },
  });

  // Calculate initial position centered in the viewport over background
  useEffect(() => {
    if (!position) {
      // Center horizontally in viewport
      const bubbleWidth = 384; // max-w-md is roughly 384px
      const centerX = (window.innerWidth - bubbleWidth) / 2;
      
      // Position in center of viewport (slightly above center)
      const centerY = (window.innerHeight / 2) - 150;
      
      setPosition({
        x: Math.max(centerX, 20), // Center horizontally with padding
        y: Math.max(centerY, 50) // Center vertically with padding
      });
    }
  }, [position]);

  // Always show floating version for responses, keep visible until saved
  useEffect(() => {
    setShowFloating(true);
  }, []);

  // Double-click handler to save and dismiss the bubble
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't allow double-click if already saving
    if (saveMutation.isPending) return;

    // Save to knowledge base (the mutation will auto-dismiss on success)
    saveMutation.mutate();
  }, [saveMutation]);

  // Drag functionality - similar to RadioCharacter
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start dragging if clicking on a button or in the action buttons area
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' || 
      target.closest('button') ||
      target.closest('[data-no-drag]')
    ) {
      return;
    }

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

    // Calculate position relative to viewport (fixed positioning)
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Allow unlimited movement - no boundaries
    setPosition({
      x: newX,
      y: newY
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

  // Always render both: original (hidden) + floating draggable version
  return (
    <>
      {/* Original response in place (always hidden to avoid duplication) */}
      <div 
        ref={responseElementRef}
        className="opacity-0 pointer-events-none h-0 overflow-hidden"
      >
        {children}
      </div>

      {/* Floating draggable version - always visible */}
      {position && (
        <div 
          className="fixed z-50 cursor-move"
          style={{
            left: position.x,
            top: position.y,
            transition: isDragging ? 'none' : 'all 0.2s ease-out'
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          data-testid={`draggable-response-${entryId}`}
        >
          <div className={`relative transition-all duration-300 ease-out ${
            showFloating ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          } ${isDragging ? 'scale-105' : ''}`}>
            {/* Response Container with terminal styling */}
            <div className={`relative max-w-md p-4 rounded-lg border-2 border-terminal-highlight/30 bg-terminal-bg/95 backdrop-blur-md transition-all duration-200 ${
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

              {/* Action buttons */}
              <div className="absolute top-2 right-2 flex items-center gap-2" data-no-drag>
                {/* Save button */}
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!saveMutation.isPending) {
                      saveMutation.mutate();
                    }
                  }}
                  disabled={saveMutation.isPending}
                  className="text-terminal-highlight hover:text-terminal-bright-green transition-colors disabled:opacity-50 cursor-pointer p-1 z-10"
                  title="Save to knowledge base"
                  data-testid={`save-response-${entryId}`}
                >
                  <Save className="w-6 h-6" />
                </button>

                {/* Drag indicator */}
                <div className="text-terminal-subtle text-xs opacity-50 cursor-move" title="Drag to move, double-click to save">
                  ⋮⋮
                </div>
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
});

export default DraggableResponse;