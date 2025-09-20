import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, ShieldOff, Eye, EyeOff, Lock, Unlock } from 'lucide-react';

interface EncodeDecodeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EncodeDecodeOverlay({ isOpen, onClose }: EncodeDecodeOverlayProps) {
  const [isEncoded, setIsEncoded] = useState(false);
  const [decodeKey, setDecodeKey] = useState('');
  const [customKey, setCustomKey] = useState('PRIVACY');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Function to encode text by shifting to high ASCII (offset by 128)
  const encodeText = useCallback((text: string) => {
    return text
      .split('')
      .map(char => {
        const code = char.charCodeAt(0);
        return String.fromCharCode((code + 128) % 256);
      })
      .join('');
  }, []);

  // Function to decode text by reversing the shift
  const decodeText = useCallback((text: string) => {
    return text
      .split('')
      .map(char => {
        const code = char.charCodeAt(0);
        return String.fromCharCode((code - 128 + 256) % 256);
      })
      .join('');
  }, []);

  // Handle encoding all terminal text content
  const handleEncode = useCallback(() => {
    if (!isEncoded) {
      // Target terminal output content specifically
      const terminalElements = document.querySelectorAll(
        '[data-testid="terminal-output"] .terminal-entry .terminal-content, ' +
        '.terminal-entry .terminal-content, ' +
        '.scroll-area .terminal-entry, ' +
        '.terminal-response, ' +
        '.terminal-command'
      );
      
      terminalElements.forEach(el => {
        const textNode = el.childNodes[0];
        if (textNode && textNode.nodeType === 3) {
          textNode.textContent = encodeText(textNode.textContent || '');
        } else if (el.textContent) {
          el.textContent = encodeText(el.textContent);
        }
      });
      
      setIsEncoded(true);
      setShowKeyInput(true);
    }
  }, [isEncoded, encodeText]);

  // Handle decode key input
  const handleDecodeKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDecodeKey(value);
    
    if (value.toUpperCase() === customKey.toUpperCase() && isEncoded) {
      // Decode all terminal text content
      const terminalElements = document.querySelectorAll(
        '[data-testid="terminal-output"] .terminal-entry .terminal-content, ' +
        '.terminal-entry .terminal-content, ' +
        '.scroll-area .terminal-entry, ' +
        '.terminal-response, ' +
        '.terminal-command'
      );
      
      terminalElements.forEach(el => {
        const textNode = el.childNodes[0];
        if (textNode && textNode.nodeType === 3) {
          textNode.textContent = decodeText(textNode.textContent || '');
        } else if (el.textContent) {
          el.textContent = decodeText(el.textContent);
        }
      });
      
      setIsEncoded(false);
      setDecodeKey('');
      setShowKeyInput(false);
    }
  }, [customKey, isEncoded, decodeText]);

  // Handle manual decode (for demonstration/testing)
  const handleManualDecode = useCallback(() => {
    if (isEncoded) {
      const terminalElements = document.querySelectorAll(
        '[data-testid="terminal-output"] .terminal-entry .terminal-content, ' +
        '.terminal-entry .terminal-content, ' +
        '.scroll-area .terminal-entry, ' +
        '.terminal-response, ' +
        '.terminal-command'
      );
      
      terminalElements.forEach(el => {
        const textNode = el.childNodes[0];
        if (textNode && textNode.nodeType === 3) {
          textNode.textContent = decodeText(textNode.textContent || '');
        } else if (el.textContent) {
          el.textContent = decodeText(el.textContent);
        }
      });
      
      setIsEncoded(false);
      setDecodeKey('');
      setShowKeyInput(false);
    }
  }, [isEncoded, decodeText]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && e.ctrlKey && !isEncoded) {
        handleEncode();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isOpen, isEncoded, handleEncode, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
      <div className="bg-terminal-bg border-2 border-terminal-highlight p-6 rounded-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-terminal-highlight" />
            <h2 className="text-terminal-highlight text-xl font-bold font-mono">
              PRIVACY ENCODER
            </h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-terminal-subtle hover:text-terminal-highlight"
            data-testid="button-close-privacy"
          >
            ✕
          </Button>
        </div>

        {/* Status Display */}
        <div className="mb-6 p-3 border border-terminal-subtle rounded bg-terminal-bg/50">
          <div className="flex items-center space-x-2 mb-2">
            {isEncoded ? (
              <>
                <Lock className="w-4 h-4 text-terminal-orange" />
                <span className="text-terminal-orange font-mono">PRIVACY MODE: ACTIVE</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 text-terminal-text" />
                <span className="text-terminal-text font-mono">PRIVACY MODE: INACTIVE</span>
              </>
            )}
          </div>
          <div className="text-xs text-terminal-subtle font-mono">
            {isEncoded 
              ? 'Terminal content is encoded. Enter key to decode.' 
              : 'Terminal content is visible. Click encode to protect.'
            }
          </div>
        </div>

        {/* Custom Key Configuration */}
        {!isEncoded && (
          <div className="mb-4">
            <Label htmlFor="custom-key" className="text-terminal-text font-mono text-sm">
              Decode Key:
            </Label>
            <Input
              id="custom-key"
              type="text"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="mt-1 bg-terminal-bg border-terminal-subtle text-terminal-text font-mono"
              placeholder="Enter your decode key"
              data-testid="input-custom-key"
            />
            <div className="text-xs text-terminal-subtle mt-1 font-mono">
              This key will be required to decode the content
            </div>
          </div>
        )}

        {/* Main Action Button */}
        <div className="mb-4">
          <Button
            onClick={handleEncode}
            disabled={isEncoded}
            className={`w-full font-mono ${
              isEncoded 
                ? 'bg-terminal-subtle text-terminal-text cursor-not-allowed' 
                : 'bg-terminal-highlight text-terminal-bg hover:bg-terminal-text'
            }`}
            data-testid="button-encode"
          >
            <div className="flex items-center justify-center space-x-2">
              {isEncoded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{isEncoded ? 'CONTENT ENCODED' : 'ENCODE TERMINAL'}</span>
            </div>
          </Button>
        </div>

        {/* Decode Input (shown when encoded) */}
        {showKeyInput && isEncoded && (
          <div className="mb-4">
            <Label htmlFor="decode-key" className="text-terminal-text font-mono text-sm">
              Enter Decode Key:
            </Label>
            <Input
              id="decode-key"
              type="password"
              value={decodeKey}
              onChange={handleDecodeKeyChange}
              className="mt-1 bg-terminal-bg border-terminal-subtle text-terminal-text font-mono"
              placeholder="Enter key to decode"
              autoFocus
              data-testid="input-decode-key"
            />
            <div className="text-xs text-terminal-subtle mt-1 font-mono">
              Type the correct key to restore terminal content
            </div>
          </div>
        )}

        {/* Manual Decode Button (for testing) */}
        {isEncoded && (
          <div className="mb-4">
            <Button
              onClick={handleManualDecode}
              variant="outline"
              className="w-full font-mono border-terminal-subtle text-terminal-text hover:bg-terminal-subtle"
              data-testid="button-manual-decode"
            >
              <div className="flex items-center justify-center space-x-2">
                <Unlock className="w-4 h-4" />
                <span>FORCE DECODE</span>
              </div>
            </Button>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-terminal-subtle font-mono border-t border-terminal-subtle pt-3">
          <div className="space-y-1">
            <div>• Ctrl+Enter: Quick encode</div>
            <div>• ESC: Close privacy encoder</div>
            <div>• Enter key: Auto-decode when correct</div>
          </div>
        </div>
      </div>
    </div>
  );
}