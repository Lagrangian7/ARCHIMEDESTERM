import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripHorizontal } from 'lucide-react';

interface CommandHistoryProps {
  history: string[];
  isVisible: boolean;
  onSelectCommand: (command: string) => void;
  onClose: () => void;
}

export function CommandHistory({ history, isVisible, onSelectCommand, onClose }: CommandHistoryProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      setIsDragging(true);
    }
  };

  if (!isVisible) return null;

  const style = position.x !== 0 || position.y !== 0
    ? { left: position.x, top: position.y, right: 'auto' }
    : {};

  return (
    <div 
      ref={popupRef}
      className="command-history absolute top-20 right-4 w-80 max-h-60 rounded z-20"
      style={style}
      data-testid="command-history-popup"
    >
      <div className="p-3">
        <div 
          className="flex justify-between items-center mb-2 cursor-move select-none"
          onMouseDown={handleMouseDown}
          data-testid="history-drag-handle"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal size={14} className="text-terminal-subtle" />
            <span className="text-terminal-highlight text-xs font-semibold">COMMAND HISTORY</span>
          </div>
          <button
            onClick={onClose}
            className="text-terminal-subtle hover:text-terminal-text text-xs"
            data-testid="button-close-history"
          >
            ✕
          </button>
        </div>
        
        <ScrollArea className="h-48">
          <div className="space-y-1">
            {history.length === 0 ? (
              <div className="text-terminal-subtle text-xs italic">No commands in history</div>
            ) : (
              history.map((command, index) => (
                <div
                  key={index}
                  className="text-terminal-text text-xs cursor-pointer hover:text-terminal-highlight hover:bg-terminal-subtle/30 p-1 rounded transition-colors"
                  onClick={() => {
                    onSelectCommand(command);
                    onClose();
                  }}
                  data-testid={`history-command-${index}`}
                >
                  <span className="text-terminal-subtle mr-2">{index + 1}.</span>
                  {command}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
