import { useState, useEffect, useCallback } from 'react';
import radioVideo from '@assets/radio_1757886813861.mp4';

interface RadioCharacterProps {
  isRadioPlaying: boolean;
}

export function RadioCharacter({ isRadioPlaying }: RadioCharacterProps) {
  const [showCharacter, setShowCharacter] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchIntensity, setGlitchIntensity] = useState(1);

  // Drag state management
  const [position, setPosition] = useState({ x: window.innerWidth - 220, y: 16 }); // Default top-right position
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isRadioPlaying) {
      setShowCharacter(true);
    } else {
      // Fade out when radio stops
      const fadeTimer = setTimeout(() => {
        // Small delay before hiding to allow fade out animation
        setTimeout(() => {
          setShowCharacter(false);
        }, 500);
      }, 500);

      return () => clearTimeout(fadeTimer);
    }
  }, [isRadioPlaying]);

  // Random glitch effects for radio aesthetic
  useEffect(() => {
    if (!showCharacter) return;

    const glitchInterval = setInterval(() => {
      // Random chance for glitch effect (25% chance every 3-5 seconds)
      if (Math.random() < 0.25) {
        setGlitchActive(true);
        setGlitchIntensity(Math.random() * 2 + 1); // Intensity between 1-3

        // Glitch duration between 150-600ms
        const glitchDuration = Math.random() * 450 + 150;
        setTimeout(() => {
          setGlitchActive(false);
        }, glitchDuration);
      }
    }, Math.random() * 2000 + 3000); // Every 3-5 seconds

    return () => clearInterval(glitchInterval);
  }, [showCharacter]);

  // Drag functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Boundary constraints to keep character on screen
    const maxX = window.innerWidth - 192; // 192px is w-48 (12rem * 16px)
    const maxY = window.innerHeight - 192;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
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

  if (!showCharacter) return null;

  return (
    <div 
      className="fixed z-40 cursor-move"
      style={{
        left: position.x,
        top: position.y,
        transition: isDragging ? 'none' : 'all 0.2s ease-out'
      }}
      onMouseDown={handleMouseDown}
      data-testid="radio-character-draggable"
    >
      <div className={`relative transition-all duration-700 ease-out ${
        showCharacter ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
      } ${isDragging ? 'scale-105' : ''}`}>
        {/* Radio Character Container */}
        <div className={`relative w-48 h-48 rounded-full overflow-hidden border-2 border-terminal-highlight/30 bg-terminal-bg/80 backdrop-blur-sm transition-all duration-75 ${
          glitchActive ? 'animate-pulse' : ''
        } ${isDragging ? 'shadow-2xl shadow-terminal-highlight/20' : ''}`}
        style={{
          filter: glitchActive ? `hue-rotate(${Math.random() * 360}deg) contrast(${1 + glitchIntensity * 0.4}) brightness(${1 + glitchIntensity * 0.2})` : 'none',
          transform: glitchActive ? `skew(${(Math.random() - 0.5) * glitchIntensity * 1.5}deg, ${(Math.random() - 0.5) * glitchIntensity * 0.8}deg) scale(${1 + (Math.random() - 0.5) * 0.03})` : 'none'
        }}>
          {/* Background Radio Video Animation */}
          <video 
            src={radioVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover transition-all duration-300 animate-pulse scale-105"
          />

          {/* Digital Glitch Overlay for Radio */}
          {glitchActive && (
            <div className="absolute inset-0">
              {/* Radio frequency scanlines */}
              <div 
                className="absolute inset-0 opacity-30"
                style={{
                  background: `repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 3px,
                    rgba(0, 255, 65, 0.15) 3px,
                    rgba(0, 255, 65, 0.15) 6px
                  )`
                }}
              />

              {/* Radio static bars */}
              <div 
                className="absolute w-full opacity-50"
                style={{
                  height: `${Math.random() * 15 + 3}px`,
                  top: `${Math.random() * 70 + 15}%`,
                  background: 'rgba(255, 165, 0, 0.4)',
                  transform: `translateX(${(Math.random() - 0.5) * 8}px)`
                }}
              />
            </div>
          )}

          {/* Radio Wave Animation Overlay */}
          <div className="absolute inset-0">
            {/* Animated radio waves */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <div className="relative">
                {/* Radio signal waves */}
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="absolute w-1 bg-orange-400/70 rounded-full animate-pulse"
                    style={{
                      left: `${i * 8 - 12}px`,
                      height: `${8 + i * 3}px`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '1.2s',
                      top: '-6px'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Broadcasting indicator */}
            <div className="absolute bottom-4 right-4">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <div className="text-xs text-red-400 font-mono">LIVE</div>
              </div>
            </div>
          </div>

          {/* Overlay Effects */}
          <div className={`absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent transition-all duration-200 ${
            glitchActive ? 'bg-gradient-to-br from-red-500/15 via-orange-500/10 to-yellow-500/5' : ''
          }`} />
        </div>


        {/* Glowing Ring Effect for Radio */}
        <div className="absolute inset-0 rounded-full ring-2 ring-orange-400/20 animate-ping transition-all duration-1000" />

        {/* Additional radio frequency rings */}
        <div className="absolute inset-0 rounded-full">
          <div className="absolute inset-2 rounded-full ring-1 ring-orange-300/10 animate-pulse" 
               style={{ animationDuration: '2s' }} />
          <div className="absolute inset-4 rounded-full ring-1 ring-red-400/15 animate-pulse" 
               style={{ animationDuration: '3s', animationDelay: '1s' }} />
        </div>
      </div>
    </div>
  );
}

export default RadioCharacter;