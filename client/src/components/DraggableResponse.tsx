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
  
  // State for matplotlib rendering
  const [matplotOutput, setMatplotOutput] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Drag state management
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null); // Null until calculated
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showFloating, setShowFloating] = useState(isTyping); // Start visible if already typing
  const responseElementRef = useRef<HTMLDivElement>(null);
  
  // Resize and shade state
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: 384, height: 250 }); // Default size
  const [isShaded, setIsShaded] = useState(false); // Dimmed/reduced opacity state
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

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
      const bubbleHeight = 250; // estimated height (increased for accuracy)

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

      // Calculate viewable area bounds with better margins
      const topBound = voiceControlsHeight + 30;
      const bottomBound = window.innerHeight - commandInputHeight - bubbleHeight - 30;

      // Check for existing bubbles to avoid overlap
      const existingBubbles = document.querySelectorAll('[data-testid^="draggable-response-"]');

      // Try to find the TalkingArchimedes modal
      const archimedesModal = document.querySelector('[data-testid="talking-archimedes-draggable"]');

      let x, y;

      if (archimedesModal) {
        const rect = archimedesModal.getBoundingClientRect();

        // Default: position to the left of Archimedes with better spacing
        x = rect.left - bubbleWidth - 30;
        y = rect.top + 10; // Slight offset down for better visual alignment

        // If bubble would go off left edge, try right side
        if (x < 30) {
          x = rect.right + 30;
        }

        // If still off screen, position in center-left area
        if (x < 30 || x + bubbleWidth > window.innerWidth - 30) {
          x = 40; // Left margin
        }

        // Adjust for existing bubbles to prevent overlap
        let adjustedY = y;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          let hasOverlap = false;

          for (const bubble of Array.from(existingBubbles)) {
            const bubbleRect = bubble.getBoundingClientRect();
            // Check if positions overlap (with margin)
            if (
              Math.abs(bubbleRect.left - x) < bubbleWidth + 20 &&
              Math.abs(bubbleRect.top - adjustedY) < bubbleHeight + 20
            ) {
              hasOverlap = true;
              adjustedY = bubbleRect.bottom + 20; // Stack below existing bubble
              break;
            }
          }

          if (!hasOverlap) break;
          attempts++;
        }

        y = adjustedY;

        // Ensure y is within viewable area bounds
        if (y < topBound) {
          y = topBound;
        } else if (y > bottomBound) {
          y = topBound; // Wrap to top if too far down
        }

        // Ensure x stays within viewport
        const maxX = window.innerWidth - bubbleWidth - 30;
        x = Math.max(30, Math.min(x, maxX));
      } else {
        // Fallback: position in visible terminal area (left side)
        x = 40; // Consistent left margin
        y = topBound + 20;

        // Stack below existing bubbles if any
        if (existingBubbles.length > 0) {
          const lastBubble = existingBubbles[existingBubbles.length - 1];
          const lastRect = lastBubble.getBoundingClientRect();
          y = Math.max(y, lastRect.bottom + 20);

          // Wrap to top if too far down
          if (y > bottomBound) {
            y = topBound + 20;
          }
        }
      }

      setPosition({ x, y });

      // Notify parent that bubble is positioned and ready
      onBubbleRendered?.();
    }
  }, [position, onBubbleRendered]);

  // Follow scroll position with smooth tracking
  useEffect(() => {
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport || initialScrollOffsetRef.current === null) return;

    let rafId: number;

    const handleScroll = () => {
      // Use requestAnimationFrame for smoother updates
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const currentScrollTop = viewport.scrollTop;
        const scrollDelta = currentScrollTop - (initialScrollOffsetRef.current ?? 0);
        setScrollOffset(scrollDelta);
      });
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Auto-detect and execute matplotlib code (including animations)
  useEffect(() => {
    const extractPythonCode = (content: string): string | null => {
      const codeMatch = content.match(/```python\n([\s\S]*?)\n```/);
      return codeMatch ? codeMatch[1] : null;
    };

    const childContent = typeof children === 'string' ? children : 
      (children as any)?.props?.dangerouslySetInnerHTML?.__html || '';
    
    const pythonCode = extractPythonCode(childContent);
    
    // Check for matplotlib or animation
    const hasMatplotlib = pythonCode && /matplotlib|pyplot/.test(pythonCode);
    const hasAnimation = pythonCode && /FuncAnimation|matplotlib\.animation/.test(pythonCode);
    
    if ((hasMatplotlib || hasAnimation) && !isExecuting && !matplotOutput) {
      setIsExecuting(true);
      
      fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pythonCode, language: 'python' })
      })
        .then(res => res.json())
        .then(data => {
          if (data.guiOutput) {
            setMatplotOutput(data.guiOutput);
          }
          setIsExecuting(false);
        })
        .catch(err => {
          console.error('Auto-execute matplotlib/animation failed:', err);
          setIsExecuting(false);
        });
    }
  }, [children, isExecuting, matplotOutput]);

  // State for controlling wavy border animation
  const [showWavyBorder, setShowWavyBorder] = useState(true);

  // Always show floating version for responses, keep visible until saved
  useEffect(() => {
    setShowFloating(true);

    // Stop wavy border animation after 30 seconds
    const wavyBorderTimer = setTimeout(() => {
      setShowWavyBorder(false);
    }, 30000); // 30 seconds

    // Auto-dismiss after 5 minutes to prevent screen clutter (increased for better UX)
    const dismissTimer = setTimeout(() => {
      setShowFloating(false);
    }, 300000); // 5 minutes

    return () => {
      clearTimeout(wavyBorderTimer);
      clearTimeout(dismissTimer);
    };
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

  // Double-click handler to dismiss the bubble
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Dismiss this bubble immediately
    setShowFloating(false);
  }, []); // No dependencies needed for simple dismiss

  // Drag functionality - similar to RadioCharacter
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent dragging if clicking on a button or other interactive element
    const target = e.target as HTMLElement;
    
    // Check if we're clicking on a button or within the button area
    // Check the target itself and all parents up to the current element
    if (
      target.closest('button') ||
      target.closest('[data-no-drag]') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'svg' ||
      target.tagName === 'SVG' ||
      target.tagName === 'path' ||
      target.tagName === 'PATH' ||
      target.getAttribute('data-no-drag') !== null
    ) {
      // Don't start dragging, let the button handle the click
      // Do NOT stopPropagation - let the event reach the button
      return;
    }

    // Only start dragging if not clicking on interactive elements
    e.preventDefault();
    setIsDragging(true);
    if (position) {
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
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
    setIsResizing(false);
  }, []);

  // Resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  }, [size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;

    const newWidth = Math.max(250, Math.min(800, resizeStartRef.current.width + deltaX));
    const newHeight = Math.max(150, Math.min(600, resizeStartRef.current.height + deltaY));

    setSize({ width: newWidth, height: newHeight });
  }, [isResizing]);

  const handleToggleShade = useCallback(() => {
    setIsShaded(prev => !prev);
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
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleResizeMove, handleMouseUp]);

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
      {position && showFloating && (
        <div
          className="fixed z-50 cursor-move group"
          style={{
            left: position.x,
            top: position.y - scrollOffset,
            width: size.width,
            transition: isDragging || isResizing ? 'none' : 'top 0.15s ease-out, left 0.15s ease-out, width 0.2s ease-out, height 0.2s ease-out',
            pointerEvents: 'auto',
            opacity: isShaded ? 0.4 : 1,
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          data-testid={`draggable-response-${entryId}`}
        >
          <div className={`relative transition-all duration-200 ease-out ${
            isDragging ? 'scale-105 rotate-1' : 'scale-100 hover:scale-[1.02]'
          }`}>
            {/* Response Container with terminal styling */}
            <div 
              className={`relative p-4 rounded-lg border-2 border-terminal-highlight/30 bg-terminal-bg/98 backdrop-blur-lg transition-all duration-200 ${
                isDragging ? 'shadow-2xl shadow-terminal-highlight/30 border-terminal-highlight/60 ring-2 ring-terminal-highlight/20' : 'shadow-lg hover:shadow-xl hover:border-terminal-highlight/40'
              } ${isTyping ? 'bubble-glow-effect' : ''}`}
              style={{
                height: size.height,
                maxHeight: size.height,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div className="text-terminal-highlight mb-2 text-sm font-mono">
                ARCHIMEDES v7 Response:
              </div>

              {/* Response Content - scrollable */}
              <div className={`text-terminal-text font-mono text-sm leading-relaxed overflow-y-auto flex-1 pr-2 ${showWavyBorder ? 'wavy-text-effect' : ''}`} style={{ maxHeight: size.height - 100 }}>
                {children}
              </div>

              {/* Matplotlib Auto-Render (including animations) */}
              {isExecuting && (
                <div className="mt-3 p-2 bg-terminal-highlight/10 rounded text-terminal-highlight text-xs">
                  🎨 Rendering matplotlib visualization...
                </div>
              )}
              {matplotOutput && (
                <div className="mt-3 border-t border-terminal-highlight/20 pt-3">
                  <div className="text-terminal-highlight text-xs mb-2">
                    {matplotOutput.includes('iframe') || matplotOutput.includes('image/gif') 
                      ? '🎬 Auto-generated animation:' 
                      : '📊 Auto-generated visualization:'}
                  </div>
                  <div 
                    dangerouslySetInnerHTML={{ __html: matplotOutput }} 
                    className="matplotlib-output"
                  />
                </div>
              )}

              {/* Action buttons - z-10 to be above the glow effect */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity z-10" data-no-drag="true">
                {/* Shade toggle */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleShade();
                  }}
                  className="text-terminal-highlight hover:text-terminal-bright-green hover:bg-terminal-highlight/10 rounded transition-all cursor-pointer p-1.5"
                  title={isShaded ? "Unshade (increase opacity)" : "Shade (reduce opacity)"}
                  data-testid={`shade-response-${entryId}`}
                  data-no-drag="true"
                  type="button"
                >
                  <span className="text-xs font-bold pointer-events-none">{isShaded ? '☀️' : '🌙'}</span>
                </button>

                {/* Copy button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopy();
                  }}
                  className="text-terminal-highlight hover:text-terminal-bright-green hover:bg-terminal-highlight/10 rounded transition-all cursor-pointer p-1.5"
                  title="Copy to clipboard"
                  data-testid={`copy-response-${entryId}`}
                  data-no-drag="true"
                  type="button"
                >
                  <Copy className="w-4 h-4 pointer-events-none" />
                </button>

                {/* Save button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!saveMutation.isPending && !isSaved) {
                      saveMutation.mutate();
                    }
                  }}
                  disabled={saveMutation.isPending || isSaved}
                  className="text-terminal-highlight hover:text-terminal-bright-green hover:bg-terminal-highlight/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer p-1.5"
                  title={isSaved ? "Already saved" : "Save to knowledge base"}
                  data-testid={`save-response-${entryId}`}
                  data-no-drag="true"
                  type="button"
                >
                  <Save className="w-4 h-4 pointer-events-none" />
                </button>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowFloating(false);
                  }}
                  className="text-terminal-subtle hover:text-red-400 hover:bg-red-400/10 rounded transition-all cursor-pointer p-1.5"
                  title="Close (or double-click anywhere)"
                  data-testid={`close-response-${entryId}`}
                  data-no-drag="true"
                  type="button"
                >
                  <span className="text-xs font-bold pointer-events-none">✕</span>
                </button>

                {/* Drag indicator */}
                <div className="text-terminal-subtle text-xs opacity-40 cursor-move px-1" title="Drag to move">
                  ⋮⋮
                </div>
              </div>

              {/* Resize handle */}
              <div
                className="absolute bottom-1 right-1 w-4 h-4 cursor-nwse-resize opacity-40 hover:opacity-100 transition-opacity z-10"
                style={{
                  borderRight: '3px solid var(--terminal-highlight)',
                  borderBottom: '3px solid var(--terminal-highlight)',
                }}
                onMouseDown={handleResizeStart}
                data-no-drag="true"
                title="Drag to resize"
              />

              {/* Glowing border effect - pointer-events-none so buttons work */}
              <div className="absolute inset-0 rounded-lg ring-1 ring-terminal-highlight/20 animate-pulse pointer-events-none"
                   style={{ animationDuration: '2s' }} />
              
              {/* Green wavy animated border effect - visible for 30 seconds */}
              {showWavyBorder && (
                <div 
                  className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden"
                  style={{
                    boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)',
                    opacity: 1,
                  }}
                >
                  <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id={`wave-gradient-${entryId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(0, 255, 0, 0.6)" />
                        <stop offset="50%" stopColor="rgba(0, 255, 100, 0.8)" />
                        <stop offset="100%" stopColor="rgba(0, 255, 0, 0.6)" />
                      </linearGradient>
                    </defs>
                    <rect 
                      x="0" 
                      y="0" 
                      width="100%" 
                      height="100%" 
                      fill="none" 
                      stroke={`url(#wave-gradient-${entryId})`}
                      strokeWidth="2"
                      rx="8"
                      style={{
                        filter: 'drop-shadow(0 0 8px rgba(0, 255, 0, 0.6))',
                        strokeDasharray: '10 5',
                        animation: 'wave-flow 3s linear infinite, glow-pulse 2s ease-in-out infinite',
                        willChange: 'stroke-dashoffset, opacity'
                      }}
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DraggableResponse;