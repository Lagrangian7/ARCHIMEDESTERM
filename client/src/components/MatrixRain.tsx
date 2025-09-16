import { useEffect, useRef } from 'react';

export function MatrixRain() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    const chars = '01';
    const container = containerRef.current;
    if (!container) return;

    // Create droplet elements
    const droplets: HTMLDivElement[] = [];
    for (let i = 0; i < 11; i++) {
      const droplet = document.createElement('div');
      droplet.className = 'absolute text-terminal-highlight font-mono text-lg';
      droplet.id = `droplet-${i}`;
      container.appendChild(droplet);
      droplets.push(droplet);
    }

    const trailLength = droplets.length;
    let animationId: number;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function createDroplet() {
      const startX = Math.random() * 100; // Random horizontal position (0-100vw)
      const startY = Math.random() * 30; // Random vertical start (0-30vh)
      if (container) {
        container.style.left = `${startX}vw`;
      }
      
      droplets.forEach((droplet, index) => {
        droplet.textContent = chars[Math.floor(Math.random() * chars.length)];
        droplet.style.top = `${startY - (index * 3.5)}vh`; // Apply trail offset from startY
        droplet.style.opacity = String(1 - (index * 0.09));
      });
      
      let posY = startY;
      const speed = 0.5 + Math.random() * 1;
      const fadeSpeed = 0.01;
      const trailSpacing = 3.5;
      let frameCount = 0;
      
      function fall() {
        posY += speed;
        frameCount++;
        
        if (frameCount % 5 === 0) {
          droplets.forEach(droplet => {
            droplet.textContent = chars[Math.floor(Math.random() * chars.length)];
          });
        }
        
        droplets.forEach((droplet, index) => {
          const trailOffset = index * trailSpacing;
          droplet.style.top = `${posY - trailOffset}vh`;
          droplet.style.opacity = String(Math.max(0, 1 - (index * 0.09) - ((posY - startY) * fadeSpeed)));
        });
        
        if (posY < 100 && parseFloat(droplets[0].style.opacity) > 0) {
          animationId = requestAnimationFrame(fall);
        } else {
          droplets.forEach(droplet => droplet.style.opacity = '0');
          timeoutId = setTimeout(createDroplet, Math.random() * 2000);
        }
      }
      
      animationId = requestAnimationFrame(fall);
    }

    // Start the effect
    createDroplet();

    // Cleanup function
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Clean up droplet elements
      droplets.forEach(droplet => {
        if (droplet.parentNode) {
          droplet.parentNode.removeChild(droplet);
        }
      });
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[0] overflow-hidden">
      {/* Grid background */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 255, 65, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 255, 65, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}
      />
      
      {/* Droplet container */}
      <div ref={containerRef} className="absolute" />
    </div>
  );
}

export default MatrixRain;