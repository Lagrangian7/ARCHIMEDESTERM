import { useState, useEffect } from 'react';
import skullWatermark from '@assets/wally_1756523512970.jpg';
import archimedesVideo1 from '@assets/1131_1757266999585.mp4';
import archimedesVideo2 from '@assets/wally talking_1757885507158.mp4';

interface TalkingArchimedesProps {
  isTyping: boolean;
  isSpeaking: boolean;
  currentMessage?: string;
}

export function TalkingArchimedes({ isTyping, isSpeaking, currentMessage }: TalkingArchimedesProps) {
  const [showCharacter, setShowCharacter] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'talking' | 'thinking'>('idle');
  const [useVideo, setUseVideo] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(archimedesVideo1);
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchIntensity, setGlitchIntensity] = useState(1);
  
  // Array of available videos
  const videoOptions = [archimedesVideo1, archimedesVideo2];

  useEffect(() => {
    if (isTyping || isSpeaking) {
      setShowCharacter(true);
      // Always use video animations - randomly select which video to show
      setUseVideo(true);
      setSelectedVideo(videoOptions[Math.floor(Math.random() * videoOptions.length)]);
      
      if (isTyping) {
        setAnimationPhase('thinking');
        
        // After a brief thinking animation, start talking
        const thinkingTimer = setTimeout(() => {
          setAnimationPhase('talking');
        }, 800);

        return () => clearTimeout(thinkingTimer);
      } else if (isSpeaking) {
        setAnimationPhase('talking');
      }
    } else {
      // Only fade out when both typing and speaking are complete
      const fadeTimer = setTimeout(() => {
        setAnimationPhase('idle');
        // Small delay before hiding to allow fade out animation
        setTimeout(() => {
          setShowCharacter(false);
        }, 500);
      }, 500);

      return () => clearTimeout(fadeTimer);
    }
  }, [isTyping, isSpeaking]);

  // Random glitch effects
  useEffect(() => {
    if (!showCharacter) return;
    
    const glitchInterval = setInterval(() => {
      // Random chance for glitch effect (30% chance every 2-4 seconds)
      if (Math.random() < 0.3) {
        setGlitchActive(true);
        setGlitchIntensity(Math.random() * 3 + 1); // Intensity between 1-4
        
        // Glitch duration between 100-800ms
        const glitchDuration = Math.random() * 700 + 100;
        setTimeout(() => {
          setGlitchActive(false);
        }, glitchDuration);
      }
    }, Math.random() * 2000 + 2000); // Every 2-4 seconds
    
    return () => clearInterval(glitchInterval);
  }, [showCharacter]);

  if (!showCharacter) return null;

  return (
    <div className="fixed top-4 right-4 z-40 pointer-events-none">
      <div className={`relative transition-all duration-700 ease-out ${
        showCharacter ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
      }`}>
        {/* Archimedes Character Container */}
        <div className={`relative w-48 h-48 rounded-full overflow-hidden border-2 border-terminal-highlight/20 bg-terminal-bg/70 backdrop-blur-sm transition-all duration-75 ${
          glitchActive ? 'animate-pulse' : ''
        }`}
        style={{
          filter: glitchActive ? `hue-rotate(${Math.random() * 360}deg) contrast(${1 + glitchIntensity * 0.5}) brightness(${1 + glitchIntensity * 0.3})` : 'none',
          transform: glitchActive ? `skew(${(Math.random() - 0.5) * glitchIntensity * 2}deg, ${(Math.random() - 0.5) * glitchIntensity}deg) scale(${1 + (Math.random() - 0.5) * 0.05})` : 'none'
        }}>
          {/* Background Video Animation */}
          <video 
            src={selectedVideo}
            autoPlay
            loop
            muted
            playsInline
            className={`w-full h-full object-cover transition-all duration-300 ${
              animationPhase === 'talking' ? 'animate-pulse scale-105' : 
              animationPhase === 'thinking' ? 'animate-bounce' : ''
            } ${
              glitchActive ? 'brightness-125 contrast-150' : ''
            }`}
            style={{
              filter: glitchActive ? `saturate(${1 + glitchIntensity}) blur(${glitchIntensity * 0.5}px)` : 'none'
            }}
          />
          
          {/* Digital Glitch Overlay */}
          {glitchActive && (
            <div className="absolute inset-0">
              {/* Scanlines */}
              <div 
                className="absolute inset-0 opacity-40"
                style={{
                  background: `repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 255, 65, 0.1) 2px,
                    rgba(0, 255, 65, 0.1) 4px
                  )`
                }}
              />
              
              {/* Color channel shift bars */}
              <div 
                className="absolute w-full opacity-60"
                style={{
                  height: `${Math.random() * 20 + 5}px`,
                  top: `${Math.random() * 80 + 10}%`,
                  background: 'rgba(255, 0, 0, 0.3)',
                  transform: `translateX(${(Math.random() - 0.5) * 10}px)`
                }}
              />
              <div 
                className="absolute w-full opacity-40"
                style={{
                  height: `${Math.random() * 15 + 3}px`,
                  top: `${Math.random() * 80 + 10}%`,
                  background: 'rgba(0, 255, 255, 0.4)',
                  transform: `translateX(${(Math.random() - 0.5) * 8}px)`
                }}
              />
              
              {/* Static noise */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${0.8 + Math.random() * 0.4}' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.8'/%3E%3C/svg%3E")`,
                  animation: 'pulse 0.1s infinite alternate'
                }}
              />
            </div>
          )}
          
          {/* Overlay Effects */}
          <div className={`absolute inset-0 bg-gradient-to-br from-terminal-highlight/5 to-transparent transition-all duration-200 ${
            glitchActive ? 'bg-gradient-to-br from-red-500/10 via-terminal-highlight/10 to-cyan-500/5' : ''
          }`} />
          
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
                        className="absolute w-1 bg-terminal-highlight/60 rounded-full animate-pulse"
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
                        className="absolute w-1 bg-terminal-highlight/60 rounded-full animate-pulse"
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
                    className="w-2 h-2 bg-terminal-highlight/50 rounded-full animate-bounce"
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
          <div className="text-xs text-terminal-highlight/70 font-mono bg-terminal-bg/60 rounded px-2 py-1 border border-terminal-subtle/50">
            {animationPhase === 'thinking' && 'PROCESSING...'}
            {animationPhase === 'talking' && 'RESPONDING...'}
            {animationPhase === 'idle' && 'ARCHIMEDES v7'}
          </div>
        </div>

        {/* Glowing Ring Effect */}
        <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${
          animationPhase === 'talking' ? 'ring-2 ring-terminal-highlight/15 animate-ping' :
          animationPhase === 'thinking' ? 'ring-1 ring-terminal-highlight/10' : ''
        }`} />
      </div>
    </div>
  );
}

export default TalkingArchimedes;