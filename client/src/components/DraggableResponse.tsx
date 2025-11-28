import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Save, Copy } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface DraggableResponseProps {
  children: ReactNode;
  isTyping: boolean;
  entryId: string;
  onBubbleRendered?: () => void;
}

export function DraggableResponse({ children, isTyping, entryId, onBubbleRendered }: DraggableResponseProps) {
  const { toast } = useToast();

  // State to track if the response has been saved
  const [isSaved, setIsSaved] = useState(false);

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

      // If extraction failed or content is too short, use a fallback
      if (!textContent || textContent.length < 10) {
        // Try to get the raw string representation
        if (typeof children === 'string') {
          textContent = children;
        } else {
          // Last resort - stringify the content
          textContent = JSON.stringify(children);
        }
      }

      // Ensure content is valid
      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No valid content to save');
      }

      console.log('Saving to knowledge base:', textContent.substring(0, 100));

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: `AI Response - ${new Date().toLocaleString()}`,
          content: textContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Save failed:', response.status, errorData);
        throw new Error(errorData.error || `Save failed: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Saved to Knowledge Base",
        description: "Response has been saved successfully",
      });
      setIsSaved(true);
    },
    onError: (error: Error) => {
      console.error('Save mutation error:', error);
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Track mouse position for bubble placement
  const mousePositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Track scroll offset to make bubbles follow scroll
  const [scrollOffset, setScrollOffset] = useState(0);
  const initialScrollOffsetRef = useRef<number | null>(null);

  // Calculate initial position near TalkingArchimedes modal in viewable area
  useEffect(() => {
    if (!position) {
      const bubbleWidth = 384; // max-w-md is roughly 384px
      const bubbleHeight = 200; // estimated height
      
      // Get the terminal scroll area viewport
      const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
      const currentScrollTop = viewport?.scrollTop || 0;
      
      // Store the initial scroll position
      initialScrollOffsetRef.current = currentScrollTop;
      
      // Get voice controls and command input to calculate viewable area
      const voiceControls = document.querySelector('.voice-controls');
      const voiceControlsHeight = voiceControls?.getBoundingClientRect().height || 60;
      
      const commandInput = document.querySelector('[data-testid="input-command"]')?.closest('.flex-shrink-0');
      const commandInputHeight = commandInput?.getBoundingClientRect().height || 80;
      
      // Calculate viewable area bounds
      const topBound = voiceControlsHeight + 20;
      const bottomBound = window.innerHeight - commandInputHeight - bubbleHeight - 20;
      
      // Try to find the TalkingArchimedes modal
      const archimedesModal = document.querySelector('[data-testid="talking-archimedes-draggable"]');
      
      let x, y;
      
      if (archimedesModal) {
        // Position bubble to the left of Archimedes modal
        const rect = archimedesModal.getBoundingClientRect();
        x = rect.left - bubbleWidth - 20; // 20px gap from Archimedes
        y = rect.top;
        
        // If bubble would go off left edge, position to the right instead
        if (x < 20) {
          x = rect.right + 20; // 20px gap on right side
        }
        
        // Ensure y is within viewable area bounds
        if (y < topBound) {
          y = topBound;
        } else if (y > bottomBound) {
          y = bottomBound - 100;
        }
        
        // Ensure x stays within viewport
        const maxX = window.innerWidth - bubbleWidth - 20;
        x = Math.max(20, Math.min(x, maxX));
      } else {
        // Fallback: position in visible terminal area
        const rightBound = window.innerWidth - bubbleWidth - 20;
        
        x = Math.min(rightBound - 100, window.innerWidth - bubbleWidth - 40);
        y = topBound + (bottomBound - topBound) / 3;
        
        x = Math.max(20, Math.min(x, rightBound));
        y = Math.max(topBound, Math.min(y, bottomBound));
      }

      setPosition({ x, y });

      // Notify parent that bubble is positioned and ready
      onBubbleRendered?.();
    }
  }, [position, onBubbleRendered]);

  // Follow scroll position
  useEffect(() => {
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport || initialScrollOffsetRef.current === null) return;

    const handleScroll = () => {
      const currentScrollTop = viewport.scrollTop;
      const scrollDelta = currentScrollTop - initialScrollOffsetRef.current;
      setScrollOffset(scrollDelta);
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  // Always show floating version for responses, keep visible until saved
  useEffect(() => {
    setShowFloating(true);

    // Auto-dismiss after 3 minutes to prevent screen clutter
    const dismissTimer = setTimeout(() => {
      setShowFloating(false);
    }, 180000); // 3 minutes

    return () => clearTimeout(dismissTimer);
  }, []);

  // Copy handler to copy text to clipboard
  const handleCopy = useCallback(() => {
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

    if (!textContent || !textContent.trim()) {
      toast({
        title: 'Copy Failed',
        description: 'Unable to extract text content from response',
        variant: 'destructive',
      });
      return;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(textContent.trim())
      .then(() => {
        toast({
          title: 'Copied!',
          description: 'Response copied to clipboard',
        });
      })
      .catch((error) => {
        toast({
          title: 'Copy Failed',
          description: error.message || 'Failed to copy to clipboard',
          variant: 'destructive',
        });
      });
  }, [children, entryId, toast]); // Removed extractTextContent from dependency array as it's defined in scope

  // Double-click handler to save and dismiss the bubble
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't allow double-click if already saving or already saved
    if (saveMutation.isPending || isSaved) return;

    // Save to knowledge base (the mutation will auto-dismiss on success)
    saveMutation.mutate();
  }, [saveMutation, isSaved]); // Added isSaved to dependency array

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

  // Calculate initial position when bubble should appear (after typing animation)
  useEffect(() => {
    if (!isTyping && !position && responseElementRef.current) {
      const rect = responseElementRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Position bubble near the response, offset to the right and down
      const bubbleWidth = 400; // Approximate max-width
      const bubbleHeight = 200; // Approximate height

      let x = rect.right + 20; // 20px to the right
      let y = rect.top;

      // Keep bubble within viewport bounds
      if (x + bubbleWidth > viewportWidth) {
        x = rect.left - bubbleWidth - 20; // Position to the left instead
      }
      if (y + bubbleHeight > viewportHeight) {
        y = viewportHeight - bubbleHeight - 20;
      }

      // Ensure minimum margins
      x = Math.max(20, Math.min(x, viewportWidth - bubbleWidth - 20));
      y = Math.max(20, Math.min(y, viewportHeight - bubbleHeight - 20));

      setPosition({ x, y });
      setShowFloating(true);

      // Notify parent that bubble has been rendered
      if (onBubbleRendered) {
        onBubbleRendered();
      }

      // Emit event to scroll terminal to this response
      setTimeout(() => {
        const event = new CustomEvent('scroll-to-response', {
          detail: { entryId, elementRect: rect }
        });
        window.dispatchEvent(event);
      }, 100);
    }
  }, [isTyping, position, onBubbleRendered, entryId]);

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

      {/* Floating draggable version - always visible and follows scroll */}
      {position && (
        <div
          className="fixed z-50 cursor-move"
          style={{
            left: position.x,
            top: isDragging ? position.y : position.y - scrollOffset,
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
                {/* Copy button */}
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopy();
                  }}
                  className="text-terminal-highlight hover:text-terminal-bright-green transition-colors cursor-pointer p-1 z-10"
                  title="Copy to clipboard"
                  data-testid={`copy-response-${entryId}`}
                >
                  <Copy className="w-6 h-6" />
                </button>

                {/* Save button */}
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!saveMutation.isPending && !isSaved) { // Prevent saving if already saved
                      saveMutation.mutate();
                    }
                  }}
                  disabled={saveMutation.isPending || isSaved} // Disable if pending or already saved
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
}

export default DraggableResponse;