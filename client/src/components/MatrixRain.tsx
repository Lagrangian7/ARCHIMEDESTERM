import { useEffect, useRef } from 'react';

export function MatrixRain() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    // Mix all character sets, excluding any that might have color
    const binaryChars = '01';
    const highAsciiChars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ日月火水木金土年月日時分秒░▒▓█▄▌▐▀■□▪▫◆◇';
    const hamburgSymbols = '☉☽☿♀♁♂♃♄♅♆♇☆★☾※‡†‰←→↑↓↔↕⇐⇒⇑⇓⇔⇕∑∏∫∆∇∞±≤≥≠≈♪♫◊●○◉◎▲△▼▽◄►▶◀';
    
    // Space Invaders font characters - use basic ASCII and symbols that should be in the font
    const spaceInvaderChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()+-=[]{}|;:,.<>?/~`';
    
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
    
    const numTrails = 20 + Math.floor(Math.random() * 15); // 20-34 trails
    
    for (let trail = 0; trail < numTrails; trail++) {
      const trailDroplets: HTMLDivElement[] = [];
      const trailLength = 15 + Math.floor(Math.random() * 15); // 15-29 droplets per trail
      
      // Randomly decide if this trail should use only space invaders font (50% chance)
      const useSpaceInvadersOnly = Math.random() < 0.5;
      
      for (let i = 0; i < trailLength; i++) {
        const droplet = document.createElement('div');
        droplet.className = 'absolute text-terminal-highlight text-lg';
        
        if (useSpaceInvadersOnly) {
          // Use only the space invaders font
          droplet.style.fontFamily = "'Invaders from Space', monospace";
        } else {
          // Use the mixed font fallback
          droplet.style.fontFamily = "'Invaders from Space', 'Hamburg Symbols', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace";
        }
        
        droplet.style.opacity = '0';
        droplet.style.pointerEvents = 'none';
        container.appendChild(droplet);
        trailDroplets.push(droplet);
      }
      
      allTrails.push({
        droplets: trailDroplets,
        position: { x: Math.random() * 95, y: -30 - Math.random() * 50 },
        speed: 0.4 + Math.random() * 1.0,
        chars: useSpaceInvadersOnly ? spaceInvaderChars : mixedChars,
        active: Math.random() > 0.5, // Some start immediately
        lastCharChange: 0
      });
    }

    let animationId: number;
    let startTime = Date.now();

    function animate() {
      const currentTime = Date.now();
      
      allTrails.forEach((trail, trailIndex) => {
        // Randomly activate inactive trails
        if (!trail.active && Math.random() < 0.001) {
          trail.active = true;
          trail.position.y = -30 - Math.random() * 20;
          trail.position.x = Math.random() * 95;
          trail.lastCharChange = currentTime;
        }
        
        if (!trail.active) return;
        
        // Move trail down
        trail.position.y += trail.speed;
        
        // Update each droplet in the trail
        trail.droplets.forEach((droplet, index) => {
          const dropletY = trail.position.y - (index * 3.5);
          droplet.style.left = `${trail.position.x}vw`;
          droplet.style.top = `${dropletY}vh`;
          
          // Calculate opacity based on position in trail and screen fade
          const trailOpacity = 1 - (index * 0.08);
          const screenFade = dropletY > 100 ? Math.max(0, 1 - (dropletY - 100) / 30) : 1;
          const finalOpacity = Math.max(0, trailOpacity * screenFade * 0.8);
          droplet.style.opacity = String(finalOpacity);
          
          // Randomly change character content
          if (currentTime - trail.lastCharChange > 150 && Math.random() < 0.15) {
            droplet.textContent = trail.chars[Math.floor(Math.random() * trail.chars.length)];
            if (index === 0) trail.lastCharChange = currentTime;
          }
        });
        
        // Reset trail when it goes off screen
        if (trail.position.y > 140) {
          trail.active = false;
          trail.droplets.forEach(droplet => droplet.style.opacity = '0');
        }
      });
      
      animationId = requestAnimationFrame(animate);
    }

    // Start the animation
    animationId = requestAnimationFrame(animate);

    // Cleanup function
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      // Clean up all droplet elements
      allTrails.forEach(trail => {
        trail.droplets.forEach(droplet => {
          if (droplet.parentNode) {
            droplet.parentNode.removeChild(droplet);
          }
        });
      });
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[0] overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 terminal-grid" />
      
      {/* Droplet container */}
      <div ref={containerRef} className="absolute" />
    </div>
  );
}

export default MatrixRain;