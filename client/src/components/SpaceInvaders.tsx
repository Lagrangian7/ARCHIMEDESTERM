import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SpaceInvadersProps {
  onClose: () => void;
}

declare global {
  interface Window {
    p5?: any;
    createCanvas?: any;
    windowWidth?: any;
    windowHeight?: any;
    background?: any;
    fill?: any;
    noStroke?: any;
    rect?: any;
    ellipse?: any;
    arc?: any;
    push?: any;
    pop?: any;
    translate?: any;
    rotate?: any;
    rectMode?: any;
    CENTER?: any;
    PI?: any;
    TWO_PI?: any;
    cos?: any;
    sin?: any;
    sqrt?: any;
    pow?: any;
    map?: any;
    noise?: any;
    random?: any;
    frameCount?: any;
    mouseX?: any;
    mouseY?: any;
    width?: any;
    height?: any;
    color?: any;
  }
}

export function SpaceInvaders({ onClose }: SpaceInvadersProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Load p5.js if not already loaded
    const loadP5 = async () => {
      if (!window.p5) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.2/p5.min.js';
        script.onload = initializeGame;
        document.head.appendChild(script);
      } else {
        initializeGame();
      }
    };

    const initializeGame = () => {
      // Space Invaders game logic
      let invaders: any[] = [];
      let particles: any[] = [];
      let stars: any[] = [];
      let ufo: any = null;
      let ufoLasers: any[] = [];
      let planetAngle = 0;
      let glowPulseAngle = 0;
      let level = 1;
      let pattern = 'wheel';
      let score = 0;
      let limbAnimationSpeed: number;
      let limbAnimationAmplitude = 2;
      const baseNumInvaders = 5;
      const numStars = 100;
      const baseWheelRadius = 150;
      const baseRectWidth = 200;
      const baseRectHeight = 100;
      const baseFigure8Width = 150;
      const baseFigure8Height = 100;
      const combinedScale = 0.5;
      const baseSpeed = 0.02;
      const jitterAmplitude = 20;
      const avoidanceRadius = 150;
      const avoidanceStrength = 0.1;
      const maxAvoidanceSpeed = 2;
      const planetRadius = 50;
      const planetRotationSpeed = 0.01;
      const planetZ = 800;
      const glowRadius = 60;
      const glowPulseSpeed = 0.05;
      const ufoSpawnInterval = 20 * 60;
      const ufoSpeed = 5;
      const ufoPoints = 50;
      const ufoLaserSpeed = 5;
      const ufoFireProbability = 0.05;
      const pointsPerHit = 10;
      const blinkInterval = 30;
      const ufoHaloSize = 60;
      const multiplyProbability = 0.3;

      const sketch = (p: any) => {
        p.setup = () => {
          const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
          canvas.parent(canvasRef.current);
          limbAnimationSpeed = p.TWO_PI / 20;
          spawnInvaders();
          
          // Initialize starfield
          for (let i = 0; i < numStars; i++) {
            stars.push({
              x: p.random(-p.width, p.width),
              y: p.random(-p.height, p.height),
              z: p.random(100, 1000)
            });
          }
        };

        const spawnInvaders = () => {
          invaders = [];
          const { spread } = getLevelModifiers();
          const numInvaders = Math.ceil(baseNumInvaders * Math.pow(1.05, level - 1));

          if (pattern === 'wheel') {
            for (let i = 0; i < numInvaders; i++) {
              let angle = (p.TWO_PI / numInvaders) * i;
              invaders.push({
                angle: angle,
                color: p.color(0, p.random(100, 200), 0),
                type: i % 3,
                pattern: 'wheel',
                noiseSeedX: p.random(10000),
                noiseSeedY: p.random(10000),
                noiseT: 0
              });
            }
          }
          // Add other patterns...
        };

        const spawnUfo = () => {
          let startLeft = p.random() > 0.5;
          let y = p.random(-p.height / 4, p.height / 4);
          ufo = {
            x: startLeft ? -p.width / 2 : p.width / 2,
            y: y,
            speed: startLeft ? ufoSpeed : -ufoSpeed,
            active: true
          };
        };

        const getLevelModifiers = () => {
          if (level <= 4) return { speed: baseSpeed, spread: 1 };
          else if (level <= 8) return { speed: baseSpeed * 1.2, spread: 1.2 };
          else if (level <= 12) return { speed: baseSpeed * 1.44, spread: 1.44 };
          else return { speed: baseSpeed * 1.728, spread: 1.728 };
        };

        const getWheelPosition = (t: number, spread: number) => {
          let x = p.cos(t * p.TWO_PI) * (baseWheelRadius * spread);
          let y = p.sin(t * p.TWO_PI) * (baseWheelRadius * spread);
          return { x, y };
        };

        p.draw = () => {
          p.background(0);
          
          // Spawn UFO every 20 seconds
          if (p.frameCount % ufoSpawnInterval === 0) {
            spawnUfo();
          }

          // Draw starfield
          p.translate(p.width / 2, p.height / 2);
          for (let star of stars) {
            star.z -= 5;
            if (star.z <= 0) {
              star.x = p.random(-p.width, p.width);
              star.y = p.random(-p.height, p.height);
              star.z = 1000;
            }
            let sx = (star.x / star.z) * 200;
            let sy = (star.y / star.z) * 200;
            let size = p.map(star.z, 1000, 0, 1, 4);
            p.fill(255, 255, 255, 100);
            p.noStroke();
            p.rect(sx, sy, size, size);
          }

          // Draw rotating planet with glow effect
          p.push();
          let planetX = p.width / 4;
          let planetY = -p.height / 4;
          let planetScreenX = (planetX / planetZ) * 200;
          let planetScreenY = (planetY / planetZ) * 200;
          let planetScreenRadius = (planetRadius / planetZ) * 200;
          let glowScreenRadius = (glowRadius / planetZ) * 200;
          p.translate(planetScreenX, planetScreenY);
          p.rotate(planetAngle);
          
          // Draw glow
          let glowAlpha = p.map(p.sin(glowPulseAngle), -1, 1, 50, 100);
          p.fill(0, 255, 0, glowAlpha);
          p.noStroke();
          p.ellipse(0, 0, glowScreenRadius * 2);
          
          // Draw planet
          p.fill(0, 100, 0, 150);
          p.ellipse(0, 0, planetScreenRadius * 2);
          p.fill(0, 50, 0, 150);
          p.ellipse(-planetScreenRadius * 0.5, -planetScreenRadius * 0.3, planetScreenRadius * 0.4);
          p.ellipse(planetScreenRadius * 0.3, planetScreenRadius * 0.4, planetScreenRadius * 0.3);
          p.ellipse(0, -planetScreenRadius * 0.6, planetScreenRadius * 0.2);
          p.pop();
          
          planetAngle += planetRotationSpeed;
          glowPulseAngle += glowPulseSpeed;

          // Update and draw UFO
          if (ufo && ufo.active) {
            ufo.x += ufo.speed;
            if (ufo.x < -p.width / 2 - 50 || ufo.x > p.width / 2 + 50) {
              ufo = null;
            } else {
              if (p.random() < ufoFireProbability) {
                let angle = p.random(p.TWO_PI);
                ufoLasers.push({
                  x: ufo.x,
                  y: ufo.y + 10,
                  vx: p.cos(angle) * ufoLaserSpeed,
                  vy: p.sin(angle) * ufoLaserSpeed
                });
              }
              
              // Draw UFO
              p.push();
              p.translate(ufo.x, ufo.y);
              p.fill(255, 0, 0, glowAlpha);
              p.noStroke();
              p.ellipse(0, 0, ufoHaloSize);
              p.fill(0, 150, 0);
              p.ellipse(0, 0, 40, 15);
              p.fill(0, 100, 0);
              p.arc(0, 0, 20, 20, p.PI, p.TWO_PI);
              p.fill(0, 255, 0);
              p.ellipse(-15, 5, 5, 5);
              p.ellipse(0, 5, 5, 5);
              p.ellipse(15, 5, 5, 5);
              p.pop();
            }
          }

          // Draw and update each invader
          const { speed, spread } = getLevelModifiers();
          const limbOffset = p.sin(p.frameCount * limbAnimationSpeed) * limbAnimationAmplitude;
          
          for (let i = invaders.length - 1; i >= 0; i--) {
            let invader = invaders[i];
            let x = 0;
            let y = 0;
            
            if (invader.pattern === 'wheel') {
              x = p.cos(invader.angle) * (baseWheelRadius * spread);
              y = p.sin(invader.angle) * (baseWheelRadius * spread);
              invader.angle += speed;
            }
            
            // Add random jitter
            invader.noiseT += 0.01;
            let jitterX = p.noise(invader.noiseSeedX + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
            let jitterY = p.noise(invader.noiseSeedY + invader.noiseT) * jitterAmplitude * 2 - jitterAmplitude;
            x += jitterX;
            y += jitterY;

            // Add avoidance behavior
            let mouseXWorld = p.mouseX - p.width / 2;
            let mouseYWorld = p.mouseY - p.height / 2;
            let dx = x - mouseXWorld;
            let dy = y - mouseYWorld;
            let distance = p.sqrt(dx * dx + dy * dy);
            if (distance < avoidanceRadius && distance > 0) {
              let avoidX = (dx / distance) * avoidanceStrength;
              let avoidY = (dy / distance) * avoidanceStrength;
              let avoidMag = p.sqrt(avoidX * avoidX + avoidY * avoidY);
              if (avoidMag > maxAvoidanceSpeed) {
                avoidX = (avoidX / avoidMag) * maxAvoidanceSpeed;
                avoidY = (avoidY / avoidMag) * maxAvoidanceSpeed;
              }
              x += avoidX;
              y += avoidY;
            }
            
            // Draw invader
            p.push();
            p.translate(x, y);
            p.fill(0, 255, 0, glowAlpha);
            p.noStroke();
            let glowSize = invader.type === 0 ? 30 : invader.type === 1 ? 37.5 : 30;
            p.ellipse(0, 0, glowSize);
            
            p.fill(invader.color);
            p.noStroke();
            p.rectMode(p.CENTER);
            
            if (invader.type === 0) {
              p.rect(0, 0, 20, 15);
              p.rect(-10, -10 + limbOffset, 5, 5);
              p.rect(10, -10 + limbOffset, 5, 5);
              p.rect(-5, 10 + limbOffset, 5, 5);
              p.rect(5, 10 + limbOffset, 5, 5);
              
              if (p.frameCount % (2 * blinkInterval) < blinkInterval) {
                p.fill(0, 255, 0);
                p.rect(-5, -2, 3, 3);
                p.rect(5, -2, 3, 3);
              }
            } else if (invader.type === 1) {
              p.rect(0, 0, 25, 15);
              p.rect(-15 + limbOffset, 0, 5, 5);
              p.rect(15 - limbOffset, 0, 5, 5);
              p.rect(-10, 10 + limbOffset, 5, 5);
              p.rect(10, 10 + limbOffset, 5, 5);
              
              if (p.frameCount % (2 * blinkInterval) < blinkInterval) {
                p.fill(0, 255, 0);
                p.rect(-5, 0, 3, 3);
                p.rect(5, 0, 3, 3);
              }
            } else {
              p.rect(0, 0, 20, 20);
              p.rect(-10, 10 + limbOffset, 5, 5);
              p.rect(10, 10 + limbOffset, 5, 5);
              p.fill(0);
              p.rect(-5, -2, 4, 4);
              p.rect(5, -2, 4, 4);
              
              if (p.frameCount % (2 * blinkInterval) < blinkInterval) {
                p.fill(0, 255, 0);
                p.rect(0, 5, 3, 3);
              }
            }
            p.pop();
          }

          // Update and draw particles
          for (let i = particles.length - 1; i >= 0; i--) {
            let particle = particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.lifetime--;
            
            p.fill(0, 255, 0, particle.lifetime * 10);
            p.noStroke();
            p.rect(particle.x, particle.y, 3, 3);
            
            if (particle.lifetime <= 0) {
              particles.splice(i, 1);
            }
          }

          // Draw UI
          p.fill(0, 255, 0);
          p.textSize(20);
          p.text(`Score: ${score}`, -p.width / 2 + 20, -p.height / 2 + 40);
          p.text(`Level: ${level}`, -p.width / 2 + 20, -p.height / 2 + 70);
          p.text(`Invaders: ${invaders.length}`, -p.width / 2 + 20, -p.height / 2 + 100);
          
          // ESC to exit
          p.fill(0, 255, 0, 150);
          p.textSize(16);
          p.text("Press ESC to exit", p.width / 2 - 150, -p.height / 2 + 40);
        };

        p.keyPressed = () => {
          if (p.key === 'Escape') {
            onClose();
          }
        };

        p.windowResized = () => {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
        };
      };

      gameInstanceRef.current = new window.p5(sketch);
    };

    loadP5();

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.remove();
      }
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black z-50" data-testid="space-invaders-modal">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-60 p-2 bg-terminal-bg border border-terminal-highlight rounded hover:bg-terminal-subtle/20 transition-colors"
        data-testid="button-close-invaders"
      >
        <X className="w-6 h-6 text-terminal-text" />
      </button>
      <div ref={canvasRef} className="w-full h-full" />
    </div>
  );
}