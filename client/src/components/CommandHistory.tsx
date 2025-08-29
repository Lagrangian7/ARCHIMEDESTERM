import { ScrollArea } from '@/components/ui/scroll-area';

interface CommandHistoryProps {
  history: string[];
  isVisible: boolean;
  onSelectCommand: (command: string) => void;
  onClose: () => void;
}

export function CommandHistory({ history, isVisible, onSelectCommand, onClose }: CommandHistoryProps) {
  if (!isVisible) return null;

  return (
    <div 
      className="command-history absolute top-20 right-4 w-80 max-h-60 rounded z-20"
      data-testid="command-history-popup"
    >
      <div className="p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-terminal-highlight text-xs font-semibold">COMMAND HISTORY</span>
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
