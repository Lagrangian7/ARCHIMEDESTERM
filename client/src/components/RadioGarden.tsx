
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface RadioGardenProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RadioGarden({ isOpen, onClose }: RadioGardenProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-4xl h-[600px] bg-terminal-bg border-2 border-terminal-highlight rounded-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-3 border-b border-terminal-highlight bg-terminal-bg">
          <h2 className="text-terminal-text font-mono text-lg">
            🌍 Radio Garden - Live Radio Worldwide
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-terminal-highlight hover:bg-terminal-highlight hover:text-terminal-bg"
            data-testid="close-radio-garden"
          >
            <X size={20} />
          </Button>
        </div>
        <iframe
          src="https://radio.garden"
          className="w-full h-[calc(100%-52px)] border-none"
          title="Radio Garden"
          allow="autoplay"
          data-testid="radio-garden-iframe"
        />
      </div>
    </div>
  );
}
