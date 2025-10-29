
import { memo } from 'react';
import { DraggableResponse } from './DraggableResponse';

interface TerminalEntryProps {
  entry: {
    id: string;
    type: string;
    content: string;
    timestamp: string;
    mode?: string;
  };
  isTyping: boolean;
  formatTimestamp: (timestamp: string) => string;
  getEntryClassName: (type: string, mode?: string) => string;
}

export const TerminalEntry = memo(function TerminalEntry({ 
  entry, 
  isTyping, 
  formatTimestamp, 
  getEntryClassName 
}: TerminalEntryProps) {
  return (
    <div
      key={entry.id}
      className={`mb-2 ${getEntryClassName(entry.type, entry.mode)}`}
      data-testid={`terminal-entry-${entry.type}`}
    >
      {entry.type === 'command' && (
        <div>
          <span className="text-terminal-highlight">[{formatTimestamp(entry.timestamp)}]</span>
          <span className="text-terminal-subtle"> $ </span>
          {entry.content}
        </div>
      )}
      {entry.type === 'response' && (
        <div className="mt-2">
          <div className="text-terminal-highlight">
            ARCHIMEDES v7 {entry.mode === 'technical' ? '(Technical Mode)' : '(Natural Chat Mode)'}:
          </div>
          <DraggableResponse 
            isTyping={isTyping} 
            entryId={entry.id}
          >
            <div 
              className={`ml-4 mt-1 ${
                isTyping ? 'typing' : 'whitespace-pre-wrap'
              }`}
              style={isTyping ? {
                '--steps': entry.content.length,
                '--type-dur': `${Math.min(3000, Math.max(800, entry.content.length * 30))}ms`
              } as React.CSSProperties : undefined}
              dangerouslySetInnerHTML={{ __html: entry.content }}
            />
          </DraggableResponse>
        </div>
      )}
      {(entry.type === 'system' || entry.type === 'error') && (
        <div className="whitespace-pre-wrap">{entry.content}</div>
      )}
    </div>
  );
});
