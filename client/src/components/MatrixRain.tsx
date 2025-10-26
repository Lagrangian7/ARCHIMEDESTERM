import { useEffect, useRef, useState } from 'react';

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Expose toggle function globally
    (window as any).toggleMatrixRain = () => {
      setIsEnabled(prev => !prev);
      return !isEnabled;
    };

    return () => {
      delete (window as any).toggleMatrixRain;
    };
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Set canvas dimensions
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Character sets
    const binaryChars = '01';
    const highAsciiChars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ日月火水木金土年月日時分秒░▒▓█▄▌▐▀■□▪▫◆◇';
    const hamburgSymbols = '☉☽☿♀♁♂♃♄♅♆♇☆★☾※‡†‰←→↑↓↔↕⇐⇒⇑⇓⇔⇕∑∏∫∆∇∞±≤≥≠≈♪♫◊●○◉◎▲△▼▽◄►▶◀';
    const spaceInvaderChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()+-=[]{}|;:,.<>?/~`';

    const mixedChars = binaryChars + highAsciiChars + hamburgSymbols;
    const allCharSets = [mixedChars, spaceInvaderChars];

    const fontSize = 18;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: {
      col: number;
      row: number;
      chars: string;
      charIndex: number;
      active: boolean;
      speed: number;
      color: string;
    }[] = [];

    // Initialize drops
    for (let i = 0; i < columns; i++) {
      const colIndex = i;
      const useSpaceInvaders = Math.random() < 0.5;
      const charSet = useSpaceInvaders ? spaceInvaderChars : mixedChars;
      const color = useSpaceInvaders ? '#00FF00' : '#00ffaa'; // Green for Space Invaders, Teal for others

      drops.push({
        col: colIndex,
        row: Math.floor(Math.random() * -500), // Start above screen
        chars: charSet,
        charIndex: Math.floor(Math.random() * charSet.length),
        active: Math.random() > 0.3, // Start some active immediately
        speed: 0.5 + Math.random() * 1.5,
        color: color,
      });
    }

    let lastFrameTime = 0;
    const frameDelay = 1000 / 30; // Target 30 FPS

    function animate(currentTime: number) {
      if (currentTime - lastFrameTime < frameDelay) {
        animationFrameId.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = currentTime;

      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Fading effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px 'Invaders from Space', monospace`; // Set font

      drops.forEach(drop => {
        if (!drop.active) {
          // Randomly activate inactive drops
          if (Math.random() < 0.002) {
            drop.active = true;
            drop.row = Math.floor(Math.random() * -200);
            drop.charIndex = Math.floor(Math.random() * drop.chars.length);
            drop.speed = 0.5 + Math.random() * 1.5;
          } else {
            return;
          }
        }

        // Draw character
        ctx.fillStyle = drop.color;
        const char = drop.chars[drop.charIndex];
        ctx.fillText(char, drop.col * fontSize, drop.row * fontSize);

        // Move drop down
        drop.row += drop.speed;

        // Change character randomly
        if (Math.random() < 0.03) {
          drop.charIndex = Math.floor(Math.random() * drop.chars.length);
        }

        // Reset drop if it goes off screen
        if (drop.row * fontSize > canvas.height) {
          drop.active = false;
          drop.row = Math.floor(Math.random() * -200); // Reset to above screen
        }
      });

      animationFrameId.current = requestAnimationFrame(animate);
    }

    // Start animation
    animationFrameId.current = requestAnimationFrame(animate);

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Recalculate columns based on new width
      const newColumns = Math.floor(canvas.width / fontSize);
      // Adjust drops array if necessary
      while (drops.length < newColumns) {
        const colIndex = drops.length;
        const useSpaceInvaders = Math.random() < 0.5;
        const charSet = useSpaceInvaders ? spaceInvaderChars : mixedChars;
        const color = useSpaceInvaders ? '#00FF00' : '#00ffaa';
        drops.push({
          col: colIndex,
          row: Math.floor(Math.random() * -500),
          chars: charSet,
          charIndex: Math.floor(Math.random() * charSet.length),
          active: Math.random() > 0.3,
          speed: 0.5 + Math.random() * 1.5,
          color: color,
        });
      }
      // Potentially trim drops if new width is smaller, though not strictly necessary for visual continuity
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener('resize', handleResize);
      // Clear canvas on cleanup
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [isEnabled]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 terminal-grid" />

      {/* Canvas for Matrix Rain */}
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

export default MatrixRain;