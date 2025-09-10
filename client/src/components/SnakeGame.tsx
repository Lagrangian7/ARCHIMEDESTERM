import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface SnakeGameProps {
  onClose: () => void;
  onGameOver: (score: number) => void;
}

const BOARD_SIZE = 22;
const CELL_SIZE = 18;
const INITIAL_SNAKE = [{ x: 11, y: 11 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };
const GAME_STEP_MS = 120; // Fixed timestep for consistent speed

type Direction = { x: number; y: number };
type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';

export function SnakeGame({ onClose, onGameOver }: SnakeGameProps) {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [nextDirection, setNextDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [food, setFood] = useState<Position>({ x: 16, y: 16 });
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('playing');
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);
  
  // Refs for authoritative state to avoid stale closures in multi-step updates
  const foodRef = useRef<Position>(food);
  const scoreRef = useRef<number>(score);
  const nextDirRef = useRef<Direction>(nextDirection);

  // Generate random food position avoiding snake
  const generateFood = useCallback((snakeBody: Position[]) => {
    let newFood: Position;
    let attempts = 0;
    do {
      newFood = {
        x: Math.floor(Math.random() * BOARD_SIZE),
        y: Math.floor(Math.random() * BOARD_SIZE),
      };
      attempts++;
    } while (snakeBody.some(segment => segment.x === newFood.x && segment.y === newFood.y) && attempts < 100);
    return newFood;
  }, []);

  // Check collision
  const checkCollision = useCallback((head: Position, snakeBody: Position[]) => {
    // Wall collision
    if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
      return true;
    }
    // Self collision (exclude current head position)
    return snakeBody.slice(1).some(segment => segment.x === head.x && segment.y === head.y);
  }, []);

  // Game update logic with refs to avoid stale closures
  const updateGame = useCallback(() => {
    setSnake(prevSnake => {
      const head = { 
        x: prevSnake[0].x + nextDirRef.current.x, 
        y: prevSnake[0].y + nextDirRef.current.y 
      };
      
      // Check wall collision
      if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
        const finalScore = scoreRef.current;
        setGameState('gameOver');
        onGameOver(finalScore);
        return prevSnake;
      }
      
      const willGrow = head.x === foodRef.current.x && head.y === foodRef.current.y;
      
      // Check self collision - only against body (excluding head)
      const bodyToCheckForCollision = prevSnake.slice(1); // Always exclude the head for self-collision
      if (bodyToCheckForCollision.some(segment => segment.x === head.x && segment.y === head.y)) {
        const finalScore = scoreRef.current;
        setGameState('gameOver');
        onGameOver(finalScore);
        return prevSnake;
      }
      
      const nextSnake = [head, ...prevSnake];
      
      if (willGrow) {
        const newFood = generateFood(nextSnake);
        foodRef.current = newFood;
        setFood(newFood);
        const newScore = scoreRef.current + 10;
        scoreRef.current = newScore;
        setScore(newScore);
      } else {
        nextSnake.pop(); // Remove tail
      }
      
      return nextSnake;
    });
    
    // Update direction for next frame
    setDirection(nextDirRef.current);
  }, [generateFood, onGameOver]);

  // Main game loop with fixed timestep
  const gameLoopRef = useRef<(currentTime: number) => void>();
  
  gameLoopRef.current = (currentTime: number) => {
    // Check game state directly without dependency issues
    if (gameState !== 'playing') {
      animationFrameRef.current = null;
      return;
    }

    const deltaTime = currentTime - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = currentTime;
    accumulatedTimeRef.current += deltaTime;

    // Fixed timestep updates
    while (accumulatedTimeRef.current >= GAME_STEP_MS) {
      updateGame();
      accumulatedTimeRef.current -= GAME_STEP_MS;
    }

    animationFrameRef.current = requestAnimationFrame((time) => gameLoopRef.current?.(time));
  };
  
  const gameLoop = useCallback((currentTime: number) => {
    gameLoopRef.current?.(currentTime);
  }, []);

  // Handle direction change with 180° prevention
  const changeDirection = useCallback((newDirection: Direction) => {
    if (gameState !== 'playing') return;
    
    // Prevent 180° reversals
    if (direction.x === -newDirection.x && direction.y === -newDirection.y) {
      return;
    }
    
    setNextDirection(newDirection);
  }, [gameState, direction]);

  // Start/restart game  
  const startGame = useCallback(() => {
    const initialSnake = [{ x: 11, y: 11 }];
    setSnake(initialSnake);
    setDirection({ x: 1, y: 0 });
    setNextDirection({ x: 1, y: 0 });
    setFood(generateFood(initialSnake));
    setScore(0);
    setGameState('playing');
    accumulatedTimeRef.current = 0;
    lastUpdateTimeRef.current = performance.now();
  }, [generateFood]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        changeDirection({ x: 0, y: -1 });
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        changeDirection({ x: 0, y: 1 });
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        changeDirection({ x: -1, y: 0 });
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        changeDirection({ x: 1, y: 0 });
        break;
      case ' ':
        e.preventDefault();
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Enter':
        e.preventDefault();
        if (gameState === 'menu' || gameState === 'gameOver') {
          startGame();
        }
        break;
    }
  }, [gameState, changeDirection, onClose, startGame]);

  // Auto-start game on mount (like old version)
  useEffect(() => {
    startGame();
  }, [startGame]);

  // Pause/unpause game
  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
      lastUpdateTimeRef.current = performance.now();
    }
  }, [gameState]);

  // Setup game loop
  useEffect(() => {
    if (gameState === 'playing') {
      lastUpdateTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, gameLoop]);

  // Keep refs in sync with state
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { nextDirRef.current = nextDirection; }, [nextDirection]);

  // Setup keyboard listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Focus game area on mount
  useEffect(() => {
    if (gameAreaRef.current) {
      gameAreaRef.current.focus();
    }
  }, []);

  // Prevent scrolling only in game area
  const handlePreventScroll = useCallback((e: React.WheelEvent | React.TouchEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-terminal-bg text-terminal-text p-2 select-none">
      {/* Header */}
      <div className="text-center mb-3">
        <h2 className="text-xl sm:text-2xl font-bold text-terminal-highlight font-mono mb-2">
          ▓▓▓ SNAKE v2.0 ▓▓▓
        </h2>
        <div className="flex items-center justify-center gap-4 text-terminal-text font-mono text-sm">
          <div>SCORE: <span className="text-terminal-highlight">{score.toString().padStart(4, '0')}</span></div>
          {gameState === 'paused' && <div className="text-yellow-400 animate-pulse">PAUSED</div>}
        </div>
      </div>

      {/* Game Board */}
      <div 
        ref={gameAreaRef}
        tabIndex={0}
        className="relative border-2 border-terminal-highlight bg-black focus:outline-none mb-3"
        style={{
          width: BOARD_SIZE * CELL_SIZE,
          height: BOARD_SIZE * CELL_SIZE,
        }}
        onWheel={handlePreventScroll}
        onTouchMove={handlePreventScroll}
        data-testid="game-board"
      >
        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={`snake-${index}`}
            className={`absolute transition-all duration-75 ${
              index === 0 
                ? 'bg-[#00FF41] border border-[#00CC33] shadow-sm shadow-[#00FF41]' // Head - bright green with glow
                : 'bg-[#00CC33] border border-[#009922]'  // Body - darker green
            }`}
            style={{
              left: segment.x * CELL_SIZE,
              top: segment.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              boxSizing: 'border-box',
            }}
            data-testid={index === 0 ? 'snake-head' : `snake-body-${index}`}
          />
        ))}

        {/* Food */}
        <div
          className="absolute bg-[#66FF66] border border-[#44DD44] animate-pulse shadow-sm shadow-[#66FF66]"
          style={{
            left: food.x * CELL_SIZE,
            top: food.y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
            boxSizing: 'border-box',
          }}
          data-testid="food"
        />

        {/* Game Over Overlay */}
        {gameState === 'gameOver' && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center" data-testid="game-over-overlay">
            <div className="text-center text-terminal-highlight font-mono">
              <div className="text-xl sm:text-2xl mb-2">GAME OVER</div>
              <div className="text-lg mb-4">FINAL SCORE: {score}</div>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={startGame}
                  className="bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black font-mono"
                  data-testid="button-restart"
                >
                  <RotateCcw size={16} className="mr-2" />
                  PLAY AGAIN
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Start Screen (only shows on manual restart) */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center" data-testid="start-screen">
            <div className="text-center text-terminal-highlight font-mono">
              <div className="text-lg sm:text-xl mb-4">PRESS START TO PLAY</div>
              <Button
                onClick={startGame}
                className="bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black font-mono mb-4"
                data-testid="button-start"
              >
                <Play size={16} className="mr-2" />
                START GAME
              </Button>
              <div className="text-sm text-terminal-subtle">Use WASD or arrows to move • SPACE to pause • ESC to exit</div>
            </div>
          </div>
        )}

        {/* Pause Overlay */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center" data-testid="pause-overlay">
            <div className="text-center text-terminal-highlight font-mono">
              <div className="text-xl mb-4">PAUSED</div>
              <Button
                onClick={togglePause}
                className="bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black font-mono"
                data-testid="button-resume"
              >
                <Play size={16} className="mr-2" />
                RESUME
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="flex flex-col items-center gap-3 sm:hidden">
        <div className="flex flex-col items-center">
          <Button
            onTouchStart={() => changeDirection({ x: 0, y: -1 })}
            className="w-12 h-12 bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black mb-2"
            data-testid="button-up"
          >
            <ChevronUp size={20} />
          </Button>
          <div className="flex gap-2">
            <Button
              onTouchStart={() => changeDirection({ x: -1, y: 0 })}
              className="w-12 h-12 bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black"
              data-testid="button-left"
            >
              <ChevronLeft size={20} />
            </Button>
            <Button
              onTouchStart={() => changeDirection({ x: 1, y: 0 })}
              className="w-12 h-12 bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black"
              data-testid="button-right"
            >
              <ChevronRight size={20} />
            </Button>
          </div>
          <Button
            onTouchStart={() => changeDirection({ x: 0, y: 1 })}
            className="w-12 h-12 bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black mt-2"
            data-testid="button-down"
          >
            <ChevronDown size={20} />
          </Button>
        </div>
      </div>

      {/* Desktop Controls Info & Game Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
        <div className="hidden sm:block text-center text-terminal-text font-mono text-xs">
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <div>↑ W - UP</div>
            <div>↓ S - DOWN</div>
            <div>← A - LEFT</div>
            <div>→ D - RIGHT</div>
          </div>
          <div className="mt-1 text-terminal-subtle">SPACE: pause • ESC: exit</div>
        </div>
        
        {/* Game Control Buttons */}
        <div className="flex gap-2">
          {gameState === 'playing' && (
            <Button
              onClick={togglePause}
              variant="outline"
              className="bg-transparent border-terminal-subtle hover:bg-terminal-subtle font-mono text-xs"
              data-testid="button-pause"
            >
              <Pause size={14} className="mr-1" />
              PAUSE
            </Button>
          )}
          <Button
            onClick={onClose}
            variant="outline"
            className="bg-transparent border-terminal-subtle hover:bg-terminal-subtle font-mono text-xs"
            data-testid="button-close"
          >
            CLOSE
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SnakeGame;