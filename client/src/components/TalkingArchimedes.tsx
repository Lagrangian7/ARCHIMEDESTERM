import { useState, useEffect } from 'react';
import archimedesVideo2 from '@assets/wally talking_1757885507158.mp4';

interface TalkingArchimedesProps {
  isTyping: boolean;
  isSpeaking: boolean;
  currentMessage?: string;
}

export function TalkingArchimedes({ isTyping, isSpeaking, currentMessage }: TalkingArchimedesProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenShown, setHasBeenShown] = useState(false);

  useEffect(() => {
    if (isTyping || isSpeaking) {
      setIsVisible(true);
      setHasBeenShown(true);
    }
  }, [isTyping, isSpeaking]);

  const handleDoubleClick = () => {
    setIsVisible(false);
  };

  if (!hasBeenShown) return null;

  return (
    <div 
      className={`fixed top-4 right-4 z-40 transition-all duration-300 cursor-pointer ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
      }`}
      onDoubleClick={handleDoubleClick}
      data-testid="narration-bubble"
    >
      <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-terminal-highlight/20 bg-terminal-bg/70 backdrop-blur-sm hover:border-terminal-highlight/40 transition-colors">
        <video 
          src={archimedesVideo2}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

export default TalkingArchimedes;