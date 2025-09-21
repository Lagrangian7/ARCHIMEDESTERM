import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface PuzzleScreensaverProps {
  isActive: boolean;
  onExit: () => void;
}

interface PuzzlePiece {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  currentX: number;
  currentY: number;
  rotation: number;
  zIndex: number;
  isMoving: boolean;
}

export function PuzzleScreensaver({ isActive, onExit }: PuzzleScreensaverProps) {
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [draggedPiece, setDraggedPiece] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLCanvasElement>(null);

  // Grid configuration
  const GRID_COLS = 8;
  const GRID_ROWS = 6;
  const TOTAL_PIECES = GRID_COLS * GRID_ROWS;

  // Capture screen content when screensaver activates
  const captureScreen = useCallback(async () => {
    if (!containerRef.current || !screenshotRef.current) return;

    try {
      // Find the terminal container
      const terminalElement = document.querySelector('.terminal-container') || 
                            document.querySelector('[data-testid="terminal-output"]') ||
                            document.querySelector('.scroll-area') ||
                            document.body;

      if (!terminalElement) return;

      // Use html2canvas-like approach with DOM to Canvas
      const canvas = screenshotRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = terminalElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Create a more sophisticated screenshot using getComputedStyle
      const createDOMImage = (element: Element): Promise<HTMLCanvasElement> => {
        return new Promise((resolve) => {
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) {
            resolve(tempCanvas);
            return;
          }

          const rect = element.getBoundingClientRect();
          tempCanvas.width = rect.width;
          tempCanvas.height = rect.height;

          // Fill with terminal background
          const computedStyle = getComputedStyle(element);
          tempCtx.fillStyle = computedStyle.backgroundColor || '#0D1117';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

          // Add terminal text content
          const textElements = element.querySelectorAll('*');
          tempCtx.font = '14px "SF Mono", Consolas, monospace';
          tempCtx.fillStyle = '#00FF41';

          let yOffset = 20;
          textElements.forEach((el) => {
            const text = el.textContent?.trim();
            if (text && text.length > 0 && text.length < 200) {
              tempCtx.fillText(text.substring(0, 80), 10, yOffset);
              yOffset += 18;
              if (yOffset > tempCanvas.height - 20) return;
            }
          });

          // Add some terminal-like decorative elements
          tempCtx.strokeStyle = '#00FF41';
          tempCtx.lineWidth = 1;
          tempCtx.strokeRect(5, 5, tempCanvas.width - 10, tempCanvas.height - 10);

          // Add grid lines for more visual interest
          tempCtx.strokeStyle = '#00FF41';
          tempCtx.globalAlpha = 0.1;
          for (let i = 0; i < tempCanvas.width; i += 50) {
            tempCtx.beginPath();
            tempCtx.moveTo(i, 0);
            tempCtx.lineTo(i, tempCanvas.height);
            tempCtx.stroke();
          }
          for (let i = 0; i < tempCanvas.height; i += 50) {
            tempCtx.beginPath();
            tempCtx.moveTo(0, i);
            tempCtx.lineTo(tempCanvas.width, i);
            tempCtx.stroke();
          }
          tempCtx.globalAlpha = 1;

          resolve(tempCanvas);
        });
      };

      const domImage = await createDOMImage(terminalElement);
      ctx.drawImage(domImage, 0, 0);

    } catch (error) {
      console.error('Error capturing screen:', error);
      // Fallback to a simple terminal-style pattern
      const canvas = screenshotRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Create terminal pattern
      ctx.fillStyle = '#0D1117';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00FF41';
      
      // Space Invaders font characters - use basic ASCII and symbols that should be in the font
      const spaceInvaderChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()+-=[]{}|;:,.<>?/~`';
      const regularChars = String.fromCharCode(...Array.from({length: 93}, (_, i) => i + 33)); // ASCII 33-125
      
      // Add matrix-like pattern with 50/50 font distribution
      for (let y = 0; y < canvas.height; y += 25) {
        for (let x = 0; x < canvas.width; x += 15) {
          if (Math.random() > 0.7) {
            // 50% chance to use space invaders font
            const useSpaceInvaders = Math.random() < 0.5;
            
            if (useSpaceInvaders) {
              ctx.font = '16px "Invaders from Space", monospace';
              const char = spaceInvaderChars[Math.floor(Math.random() * spaceInvaderChars.length)];
              ctx.globalAlpha = Math.random() * 0.8 + 0.2;
              ctx.fillText(char, x, y);
            } else {
              ctx.font = '16px "Invaders from Space", "Hamburg Symbols", "SF Mono", Consolas, monospace';
              const char = regularChars[Math.floor(Math.random() * regularChars.length)];
              ctx.globalAlpha = Math.random() * 0.8 + 0.2;
              ctx.fillText(char, x, y);
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }, []);

  // Initialize puzzle pieces
  const initializePuzzle = useCallback(() => {
    if (!screenshotRef.current) return;

    const canvas = screenshotRef.current;
    const pieceWidth = canvas.width / GRID_COLS;
    const pieceHeight = canvas.height / GRID_ROWS;

    const newPieces: PuzzlePiece[] = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const id = row * GRID_COLS + col;
        const originalX = col * pieceWidth;
        const originalY = row * pieceHeight;

        // Scatter pieces randomly around the screen
        const maxScatter = 200;
        const scatterX = (Math.random() - 0.5) * maxScatter;
        const scatterY = (Math.random() - 0.5) * maxScatter;

        newPieces.push({
          id,
          x: originalX,
          y: originalY,
          width: pieceWidth,
          height: pieceHeight,
          currentX: originalX + scatterX,
          currentY: originalY + scatterY,
          rotation: (Math.random() - 0.5) * 30, // Random rotation up to 15 degrees
          zIndex: 1,
          isMoving: false
        });
      }
    }

    setPieces(newPieces);
    setIsInitialized(true);
  }, []);

  // Handle piece dragging
  const handleMouseDown = (e: React.MouseEvent, pieceId: number) => {
    e.preventDefault();
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return;

    setDraggedPiece(pieceId);
    setDragOffset({
      x: e.clientX - piece.currentX,
      y: e.clientY - piece.currentY
    });

    // Bring piece to front
    setPieces(prev => prev.map(p => 
      p.id === pieceId 
        ? { ...p, zIndex: 1000, isMoving: true }
        : { ...p, zIndex: p.zIndex > 1 ? p.zIndex - 1 : 1 }
    ));
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggedPiece === null) return;

    setPieces(prev => prev.map(piece =>
      piece.id === draggedPiece
        ? {
            ...piece,
            currentX: e.clientX - dragOffset.x,
            currentY: e.clientY - dragOffset.y
          }
        : piece
    ));
  }, [draggedPiece, dragOffset]);

  const handleMouseUp = useCallback(() => {
    if (draggedPiece !== null) {
      setPieces(prev => prev.map(piece =>
        piece.id === draggedPiece
          ? { ...piece, isMoving: false }
          : piece
      ));
      setDraggedPiece(null);
    }
  }, [draggedPiece]);

  // Auto-move pieces randomly
  useEffect(() => {
    if (!isActive || !isInitialized) return;

    const interval = setInterval(() => {
      setPieces(prev => prev.map(piece => {
        if (piece.isMoving || draggedPiece === piece.id) return piece;

        // Small chance to move a piece randomly
        if (Math.random() < 0.1) {
          const maxMove = 30;
          return {
            ...piece,
            currentX: piece.currentX + (Math.random() - 0.5) * maxMove,
            currentY: piece.currentY + (Math.random() - 0.5) * maxMove,
            rotation: piece.rotation + (Math.random() - 0.5) * 10
          };
        }
        return piece;
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive, isInitialized, draggedPiece]);

  // Setup event listeners for dragging
  useEffect(() => {
    if (draggedPiece !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedPiece, handleMouseMove, handleMouseUp]);

  // Initialize when screensaver becomes active
  useEffect(() => {
    if (isActive && !isInitialized) {
      const initializeAsync = async () => {
        await captureScreen();
        setTimeout(() => {
          initializePuzzle();
        }, 100);
      };
      initializeAsync();
    }
  }, [isActive, isInitialized, captureScreen, initializePuzzle]);

  // Exit on any click or key press
  useEffect(() => {
    const handleExit = (e: KeyboardEvent | MouseEvent) => {
      if (isActive) {
        onExit();
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handleExit);
      // Don't exit on piece dragging
      document.addEventListener('click', (e) => {
        if (!e.target || !(e.target as Element).closest('.puzzle-piece')) {
          handleExit(e);
        }
      });
    }

    return () => {
      document.removeEventListener('keydown', handleExit);
      document.removeEventListener('click', handleExit);
    };
  }, [isActive, onExit]);

  if (!isActive) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm"
    >
      {/* Hidden canvas for screenshot */}
      <canvas 
        ref={screenshotRef}
        className="hidden"
      />

      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-4 right-4 z-[10000] p-2 bg-terminal-bg/80 rounded-lg border border-terminal-highlight/30 text-terminal-highlight hover:bg-terminal-highlight/10 transition-colors"
        data-testid="screensaver-exit"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Screensaver title */}
      <div className="absolute top-4 left-4 z-[10000] text-terminal-highlight font-mono">
        <div className="text-lg font-bold">ARCHIMEDES PUZZLE SCREENSAVER</div>
        <div className="text-sm text-terminal-text/70">Drag pieces to rearrange • Click anywhere to exit</div>
      </div>

      {/* Puzzle pieces */}
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute cursor-move puzzle-piece transition-all duration-300 hover:scale-105"
          style={{
            left: piece.currentX,
            top: piece.currentY,
            width: piece.width,
            height: piece.height,
            transform: `rotate(${piece.rotation}deg)`,
            zIndex: piece.zIndex,
            transition: piece.isMoving ? 'none' : 'all 0.3s ease-out'
          }}
          onMouseDown={(e) => handleMouseDown(e, piece.id)}
          data-testid={`puzzle-piece-${piece.id}`}
        >
          <div 
            className="w-full h-full border-2 border-terminal-highlight/30 rounded-lg overflow-hidden bg-terminal-bg/80 backdrop-blur-sm shadow-lg"
            style={{
              backgroundImage: screenshotRef.current ? `url(${screenshotRef.current.toDataURL()})` : 'none',
              backgroundPosition: `-${piece.x}px -${piece.y}px`,
              backgroundSize: `${screenshotRef.current?.width || 0}px ${screenshotRef.current?.height || 0}px`,
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Puzzle piece number for debugging */}
            <div className="absolute bottom-1 right-1 text-xs text-terminal-highlight/50 font-mono bg-terminal-bg/60 px-1 rounded">
              {piece.id + 1}
            </div>
          </div>
        </div>
      ))}

      {/* Floating particles for ambiance */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-terminal-highlight/20 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>
    </div>
  );
}