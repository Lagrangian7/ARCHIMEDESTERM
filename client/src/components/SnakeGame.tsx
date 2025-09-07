import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface Position {
  x: number;
  y: number;
}

interface SnakeGameProps {
  onClose: () => void;
  onGameOver: (score: number) => void;
}

const BOARD_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };
const GAME_SPEED = 150;

export function SnakeGame({ onClose, onGameOver }: SnakeGameProps) {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [direction, setDirection] = useState<Position>(INITIAL_DIRECTION);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [score, setScore] = useState(0);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  // Generate random food position
  const generateFood = useCallback((snakeBody: Position[]) => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * BOARD_SIZE),
        y: Math.floor(Math.random() * BOARD_SIZE),
      };
    } while (snakeBody.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  // Check collision
  const checkCollision = useCallback((head: Position, snakeBody: Position[]) => {
    // Wall collision
    if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
      return true;
    }
    // Self collision
    return snakeBody.some(segment => segment.x === head.x && segment.y === head.y);
  }, []);

  // Game loop
  const moveSnake = useCallback(() => {
    if (!gameRunning || gameOver) return;

    setSnake(prevSnake => {
      const newSnake = [...prevSnake];
      const head = { ...newSnake[0] };
      head.x += direction.x;
      head.y += direction.y;

      // Check collision
      if (checkCollision(head, newSnake)) {
        setGameOver(true);
        setGameRunning(false);
        onGameOver(score);
        return prevSnake;
      }

      newSnake.unshift(head);

      // Check if food is eaten
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop(); // Remove tail if no food eaten
      }

      return newSnake;
    });
  }, [direction, food, gameRunning, gameOver, score, checkCollision, generateFood, onGameOver]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!gameRunning && !gameOver) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        if (direction.y === 0) setDirection({ x: 0, y: -1 });
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (direction.y === 0) setDirection({ x: 0, y: 1 });
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (direction.x === 0) setDirection({ x: -1, y: 0 });
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (direction.x === 0) setDirection({ x: 1, y: 0 });
        break;
      case 'Escape':
        onClose();
        break;
    }
    e.preventDefault();
  }, [direction, gameRunning, gameOver, onClose]);

  // Start game
  const startGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setFood(generateFood(INITIAL_SNAKE));
    setScore(0);
    setGameRunning(true);
    setGameOver(false);
  };

  // Setup game loop
  useEffect(() => {
    if (gameRunning && !gameOver) {
      gameLoopRef.current = setInterval(moveSnake, GAME_SPEED);
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameRunning, gameOver, moveSnake]);

  // Setup keyboard listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Focus game area for keyboard input
  useEffect(() => {
    if (gameAreaRef.current) {
      gameAreaRef.current.focus();
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-terminal-bg text-terminal-text p-4">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-terminal-highlight font-mono mb-2">
          ▓▓▓ SNAKE GAME ▓▓▓
        </h2>
        <div className="text-terminal-text font-mono">
          SCORE: <span className="text-terminal-highlight">{score.toString().padStart(4, '0')}</span>
        </div>
      </div>

      {/* Game Board */}
      <div 
        ref={gameAreaRef}
        tabIndex={0}
        className="relative border-2 border-terminal-highlight bg-black focus:outline-none"
        style={{
          width: BOARD_SIZE * CELL_SIZE,
          height: BOARD_SIZE * CELL_SIZE,
        }}
      >
        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={index}
            className={`absolute ${
              index === 0 
                ? 'bg-[#00FF41] border border-[#00CC33]' // Head - bright green
                : 'bg-[#00CC33] border border-[#009922]'  // Body - darker green
            }`}
            style={{
              left: segment.x * CELL_SIZE,
              top: segment.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              boxSizing: 'border-box',
            }}
          />
        ))}

        {/* Food */}
        <div
          className="absolute bg-[#66FF66] border border-[#44DD44] animate-pulse"
          style={{
            left: food.x * CELL_SIZE,
            top: food.y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
            boxSizing: 'border-box',
          }}
        />

        {/* Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center text-terminal-highlight font-mono">
              <div className="text-2xl mb-2">GAME OVER</div>
              <div className="text-lg mb-4">FINAL SCORE: {score}</div>
              <Button
                onClick={startGame}
                className="bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black font-mono"
              >
                PLAY AGAIN
              </Button>
            </div>
          </div>
        )}

        {/* Start Screen */}
        {!gameRunning && !gameOver && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
            <div className="text-center text-terminal-highlight font-mono">
              <div className="text-xl mb-4">PRESS START TO PLAY</div>
              <Button
                onClick={startGame}
                className="bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black font-mono mb-4"
              >
                START GAME
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 text-center text-terminal-text font-mono text-sm">
        <div className="mb-2">CONTROLS:</div>
        <div className="grid grid-cols-2 gap-2 max-w-md">
          <div>↑ W - UP</div>
          <div>↓ S - DOWN</div>
          <div>← A - LEFT</div>
          <div>→ D - RIGHT</div>
        </div>
        <div className="mt-2 text-terminal-subtle">ESC to exit</div>
      </div>

      {/* Close Button */}
      <div className="mt-4">
        <Button
          onClick={onClose}
          variant="outline"
          className="bg-transparent border-terminal-subtle hover:bg-terminal-subtle font-mono"
        >
          CLOSE GAME
        </Button>
      </div>
    </div>
  );
}

export default SnakeGame;