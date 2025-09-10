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
const INITIAL_FOOD = { x: 15, y: 15 };
const GAME_SPEED = 200;

export function SnakeGame({ onClose, onGameOver }: SnakeGameProps) {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>(INITIAL_FOOD);
  const [direction, setDirection] = useState<Position>({ x: 1, y: 0 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

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

  // Game logic
  const moveSnake = useCallback(() => {
    if (!gameStarted || gameOver) return;

    setSnake(currentSnake => {
      const head = currentSnake[0];
      const newHead = {
        x: head.x + direction.x,
        y: head.y + direction.y
      };

      // Check wall collision
      if (newHead.x < 0 || newHead.x >= BOARD_SIZE || newHead.y < 0 || newHead.y >= BOARD_SIZE) {
        setGameOver(true);
        onGameOver(score);
        return currentSnake;
      }

      // Check self collision
      if (currentSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        onGameOver(score);
        return currentSnake;
      }

      const newSnake = [newHead, ...currentSnake];

      // Check food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood(newSnake));
        return newSnake; // Don't remove tail (grow)
      }

      // Remove tail (normal move)
      newSnake.pop();
      return newSnake;
    });
  }, [direction, food, gameOver, gameStarted, onGameOver, score, generateFood]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (gameOver) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        if (direction.y === 0) setDirection({ x: 0, y: -1 });
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        if (direction.y === 0) setDirection({ x: 0, y: 1 });
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        if (direction.x === 0) setDirection({ x: -1, y: 0 });
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        if (direction.x === 0) setDirection({ x: 1, y: 0 });
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [direction, gameOver, onClose]);

  // Start game
  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setSnake(INITIAL_SNAKE);
    setFood(INITIAL_FOOD);
    setDirection({ x: 1, y: 0 });
    setScore(0);
  };

  // Game loop
  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = setInterval(moveSnake, GAME_SPEED);
      return () => {
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      };
    }
  }, [gameStarted, gameOver, moveSnake]);

  // Keyboard events
  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Auto-start on mount
  useEffect(() => {
    startGame();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-terminal-bg text-terminal-text p-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-terminal-highlight font-mono mb-2">
          🐍 SNAKE GAME
        </h2>
        <div className="text-terminal-text font-mono">
          SCORE: <span className="text-terminal-highlight">{score}</span>
        </div>
      </div>

      {/* Game Board */}
      <div 
        className="relative border-2 border-terminal-highlight bg-black mb-4"
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
              index === 0 ? 'bg-terminal-highlight' : 'bg-green-400'
            }`}
            style={{
              left: segment.x * CELL_SIZE,
              top: segment.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
            }}
          />
        ))}

        {/* Food */}
        <div
          className="absolute bg-red-400"
          style={{
            left: food.x * CELL_SIZE,
            top: food.y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
          }}
        />

        {/* Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
            <div className="text-center text-terminal-highlight font-mono">
              <div className="text-xl mb-2">GAME OVER!</div>
              <div className="text-lg mb-4">Final Score: {score}</div>
              <div className="flex gap-2">
                <Button
                  onClick={startGame}
                  className="bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black font-mono"
                >
                  PLAY AGAIN
                </Button>
                <Button
                  onClick={onClose}
                  className="bg-black border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-black font-mono"
                >
                  CLOSE
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="text-center text-terminal-text font-mono text-sm">
        <div>Use WASD or Arrow Keys to move</div>
        <div>Press ESC to close</div>
      </div>
    </div>
  );
}

export default SnakeGame;