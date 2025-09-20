import { useState, useEffect, useRef } from 'react';

interface EncodeDecodeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EncodeDecodeOverlay({ isOpen, onClose }: EncodeDecodeOverlayProps) {
  const [keyBuffer, setKeyBuffer] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for "QWERTY" to be typed to unlock
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isOpen) {
        // Add the typed character to buffer
        const newBuffer = (keyBuffer + e.key.toUpperCase()).slice(-6); // Keep only last 6 characters
        setKeyBuffer(newBuffer);
        
        // Check if "QWERTY" was typed
        if (newBuffer === 'QWERTY') {
          onClose();
          setKeyBuffer('');
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isOpen, keyBuffer, onClose]);

  // Matrix rain animation
  useEffect(() => {
    if (!isOpen) return;
    
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    
    // Mix all character sets
    const binaryChars = '01';
    const highAsciiChars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ日月火水木金土年月日時分秒░▒▓█▄▌▐▀■□▪▫◆◇';
    const hamburgSymbols = '☉☽☿♀♁♂♃♄♅♆♇☆★☾※‡†‰←→↑↓↔↕⇐⇒⇑⇓⇔⇕∑∏∫∆∇∞±≤≥≠≈♪♫◊●○◉◎▲△▼▽◄►▶◀';
    
    // Combine all character sets for mixed drops
    const mixedChars = binaryChars + highAsciiChars + hamburgSymbols;
    const container = containerRef.current;
    if (!container) return;

    // Create multiple independent droplet trails
    const allTrails: {
      droplets: HTMLDivElement[];
      position: { x: number; y: number };
      speed: number;
      chars: string;
      active: boolean;
      lastCharChange: number;
    }[] = [];
    
    const numTrails = 30 + Math.floor(Math.random() * 20); // More trails for full screen
    
    for (let trail = 0; trail < numTrails; trail++) {
      const trailDroplets: HTMLDivElement[] = [];
      const trailLength = 12 + Math.floor(Math.random() * 8); // Longer trails
      
      for (let i = 0; i < trailLength; i++) {
        const droplet = document.createElement('div');
        droplet.className = 'absolute text-terminal-highlight text-lg';
        droplet.style.fontFamily = "'Hamburg Symbols', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace";
        droplet.style.opacity = '0';
        droplet.style.pointerEvents = 'none';
        container.appendChild(droplet);
        trailDroplets.push(droplet);
      }
      
      allTrails.push({
        droplets: trailDroplets,
        position: { x: Math.random() * 95, y: -30 - Math.random() * 50 },
        speed: 0.5 + Math.random() * 1.2,
        chars: mixedChars,
        active: Math.random() > 0.3,
        lastCharChange: 0
      });
    }

    let animationId: number;

    function animate() {
      const currentTime = Date.now();
      
      allTrails.forEach((trail) => {
        // Randomly activate inactive trails
        if (!trail.active && Math.random() < 0.002) {
          trail.active = true;
          trail.position.y = -30 - Math.random() * 20;
          trail.position.x = Math.random() * 95;
          trail.lastCharChange = currentTime;
        }
        
        if (!trail.active) return;
        
        // Move trail down
        trail.position.y += trail.speed;
        
        // Change characters periodically
        if (currentTime - trail.lastCharChange > 100 + Math.random() * 200) {
          trail.lastCharChange = currentTime;
        }
        
        // Update droplet positions and visibility
        trail.droplets.forEach((droplet, index) => {
          const dropletY = trail.position.y - (index * 25);
          
          if (dropletY > -20 && dropletY < window.innerHeight + 20) {
            droplet.style.left = `${trail.position.x}%`;
            droplet.style.top = `${dropletY}px`;
            
            // Fade effect - brightest at head, dimmer towards tail
            const opacity = Math.max(0, 1 - (index * 0.15));
            droplet.style.opacity = opacity.toString();
            
            // Change character occasionally
            if (currentTime - trail.lastCharChange < 50) {
              droplet.textContent = trail.chars[Math.floor(Math.random() * trail.chars.length)];
            }
          } else {
            droplet.style.opacity = '0';
          }
        });
        
        // Reset trail when it goes off screen
        if (trail.position.y > window.innerHeight + 100) {
          trail.active = false;
          trail.position.y = -30 - Math.random() * 50;
          trail.position.x = Math.random() * 95;
        }
      });
      
      animationId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      // Clean up droplets
      allTrails.forEach(trail => {
        trail.droplets.forEach(droplet => {
          if (droplet.parentNode) {
            droplet.parentNode.removeChild(droplet);
          }
        });
      });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 overflow-hidden"
      style={{ cursor: 'none' }}
    >
      {/* Unlock hint - fade in after a few seconds */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-terminal-highlight/50 text-center font-mono text-sm animate-pulse">
        Type QWERTY to unlock
      </div>
    </div>
  );
}