import { useState, useEffect } from 'react';
import skullWatermark from '@assets/wally_1756523512970.jpg';

interface TalkingArchimedesProps {
  isTyping: boolean;
  currentMessage?: string;
}

export function TalkingArchimedes({ isTyping, currentMessage }: TalkingArchimedesProps) {
  const [showCharacter, setShowCharacter] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'talking' | 'thinking'>('idle');

  useEffect(() => {
    if (isTyping) {
      setShowCharacter(true);
      setAnimationPhase('thinking');
      
      // After a brief thinking animation, start talking
      const thinkingTimer = setTimeout(() => {
        setAnimationPhase('talking');
      }, 800);

      return () => clearTimeout(thinkingTimer);
    } else {
      // Fade out after response is complete
      const fadeTimer = setTimeout(() => {
        setAnimationPhase('idle');
        setShowCharacter(false);
      }, 2000);

      return () => clearTimeout(fadeTimer);
    }
  }, [isTyping]);

  if (!showCharacter) return null;

  return (
    <div className="fixed top-4 right-4 z-40 pointer-events-none">
      <div className={`relative transition-all duration-500 ${
        showCharacter ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}>
        {/* Archimedes Character Container */}
        <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-terminal-highlight/50 bg-terminal-bg/90 backdrop-blur-sm">
          {/* Background Image */}
          <img 
            src={skullWatermark} 
            alt="Archimedes"
            className={`w-full h-full object-cover transition-all duration-300 ${
              animationPhase === 'talking' ? 'animate-pulse scale-105' : 
              animationPhase === 'thinking' ? 'animate-bounce' : ''
            }`}
          />
          
          {/* Overlay Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-terminal-highlight/10 to-transparent" />
          
          {/* Talking Animation Overlay */}
          {animationPhase === 'talking' && (
            <div className="absolute inset-0">
              {/* Animated mouth/speaking indicator */}
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                <div className="relative">
                  {/* Sound waves */}
                  <div className="absolute -left-8 top-1/2 transform -translate-y-1/2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="absolute w-1 bg-terminal-highlight rounded-full animate-pulse"
                        style={{
                          left: `${i * 6}px`,
                          height: '12px',
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.6s',
                        }}
                      />
                    ))}
                  </div>
                  <div className="absolute -right-8 top-1/2 transform -translate-y-1/2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="absolute w-1 bg-terminal-highlight rounded-full animate-pulse"
                        style={{
                          right: `${i * 6}px`,
                          height: '12px',
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.6s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Thinking Animation Overlay */}
          {animationPhase === 'thinking' && (
            <div className="absolute top-2 right-2">
              <div className="flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-terminal-highlight rounded-full animate-bounce"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: '0.8s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status Text */}
        <div className="mt-2 text-center">
          <div className="text-xs text-terminal-highlight font-mono bg-terminal-bg/80 rounded px-2 py-1 border border-terminal-subtle">
            {animationPhase === 'thinking' && 'PROCESSING...'}
            {animationPhase === 'talking' && 'RESPONDING...'}
            {animationPhase === 'idle' && 'ARCHIMEDES v7'}
          </div>
        </div>

        {/* Glowing Ring Effect */}
        <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${
          animationPhase === 'talking' ? 'ring-4 ring-terminal-highlight/30 animate-ping' :
          animationPhase === 'thinking' ? 'ring-2 ring-terminal-highlight/20' : ''
        }`} />
      </div>
    </div>
  );
}

export default TalkingArchimedes;