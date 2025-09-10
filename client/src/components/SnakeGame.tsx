import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface SnakeGameProps {
  onClose: () => void;
  onGameOver: (score: number) => void;
}

const BOARD_WIDTH = 40;
const BOARD_HEIGHT = 20;
const INITIAL_SNAKE = [{ x: 5, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };
const GAME_SPEED = 150;

export function SnakeGame({ onClose, onGameOver }: SnakeGameProps) {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Position>(INITIAL_DIRECTION);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate food at random position
  const generateFood = useCallback((snakeBody: Position[]) => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * BOARD_WIDTH),
        y: Math.floor(Math.random() * BOARD_HEIGHT),
      };
    } while (snakeBody.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  // Game logic
  const moveSnake = useCallback(() => {
    if (gameOver || paused) return;

    setSnake(currentSnake => {
      const head = currentSnake[0];
      const newHead = {
        x: head.x + direction.x,
        y: head.y + direction.y
      };

      // Wall collision
      if (newHead.x < 0 || newHead.x >= BOARD_WIDTH || newHead.y < 0 || newHead.y >= BOARD_HEIGHT) {
        setGameOver(true);
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
        onGameOver(score);
        return currentSnake;
      }

      // Self collision
      if (currentSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
        onGameOver(score);
        return currentSnake;
      }

      const newSnake = [newHead, ...currentSnake];

      // Food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood(newSnake));
        return newSnake; // Don't remove tail (grow)
      }

      // Normal move - remove tail
      newSnake.pop();
      return newSnake;
    });
  }, [direction, food, gameOver, paused, onGameOver, score, generateFood]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    e.preventDefault();

    switch (e.key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        if (direction.y === 0) setDirection({ x: 0, y: -1 });
        break;
      case 'arrowdown':
      case 's':
        if (direction.y === 0) setDirection({ x: 0, y: 1 });
        break;
      case 'arrowleft':
      case 'a':
        if (direction.x === 0) setDirection({ x: -1, y: 0 });
        break;
      case 'arrowright':
      case 'd':
        if (direction.x === 0) setDirection({ x: 1, y: 0 });
        break;
      case 'p':
        if (!gameOver) setPaused(prev => !prev);
        break;
      case 'h':
        if (!gameOver) setShowHelp(prev => !prev);
        break;
      case 'q':
      case 'escape':
        onClose();
        break;
      case 'r':
        if (gameOver) restartGame();
        break;
    }
  }, [direction, gameOver, onClose]);

  // Restart game
  const restartGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood({ x: 15, y: 10 });
    setDirection(INITIAL_DIRECTION);
    setScore(0);
    setGameOver(false);
    setPaused(false);
    setShowHelp(false);
  }, []);

  // Game loop
  useEffect(() => {
    if (!gameOver && !paused) {
      gameLoopRef.current = setInterval(moveSnake, GAME_SPEED);
      return () => {
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      };
    }
  }, [moveSnake, gameOver, paused]);

  // Keyboard events
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Create game board
  const renderBoard = () => {
    const board: string[][] = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(' '));
    
    // Add border
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[0][x] = '─';
      board[BOARD_HEIGHT - 1][x] = '─';
    }
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      board[y][0] = '│';
      board[y][BOARD_WIDTH - 1] = '│';
    }
    board[0][0] = '┌';
    board[0][BOARD_WIDTH - 1] = '┐';
    board[BOARD_HEIGHT - 1][0] = '└';
    board[BOARD_HEIGHT - 1][BOARD_WIDTH - 1] = '┘';

    // Add snake
    snake.forEach((segment, index) => {
      if (segment.x >= 0 && segment.x < BOARD_WIDTH && segment.y >= 0 && segment.y < BOARD_HEIGHT) {
        board[segment.y][segment.x] = index === 0 ? '●' : '○';
      }
    });

    // Add food
    if (food.x >= 0 && food.x < BOARD_WIDTH && food.y >= 0 && food.y < BOARD_HEIGHT) {
      board[food.y][food.x] = '*';
    }

    return board.map((row, y) => (
      <div key={y} className="font-mono text-terminal-highlight leading-none">
        {row.join('')}
      </div>
    ));
  };

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="fixed inset-0 bg-terminal-bg text-terminal-text flex flex-col items-center justify-center p-4 focus:outline-none"
      style={{ fontFamily: 'monospace' }}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-terminal-highlight font-mono text-lg">
          ╔══════════════════════════════════════╗
        </div>
        <div className="text-terminal-highlight font-mono text-lg">
          ║                nSnake                ║
        </div>
        <div className="text-terminal-highlight font-mono text-lg">
          ╠══════════════════════════════════════╣
        </div>
        <div className="text-terminal-highlight font-mono text-lg">
          ║ Score: {score.toString().padStart(6, ' ')}                   ║
        </div>
        <div className="text-terminal-highlight font-mono text-lg">
          ╚══════════════════════════════════════╝
        </div>
      </div>

      {/* Game Board */}
      <div className="bg-black border border-terminal-highlight p-2 mb-4">
        {renderBoard()}
      </div>

      {/* Status Messages */}
      <div className="text-center text-terminal-text font-mono text-sm">
        {gameOver && (
          <div className="text-red-400 mb-2">
            ═══ GAME OVER ═══<br/>
            Final Score: {score}<br/>
            Press 'R' to restart or 'Q' to quit
          </div>
        )}
        {paused && !gameOver && (
          <div className="text-yellow-400 mb-2">
            ═══ PAUSED ═══<br/>
            Press 'P' to continue
          </div>
        )}
        {showHelp && !gameOver && (
          <div className="text-terminal-highlight mb-2 border border-terminal-highlight p-2">
            <div>╔════════ HELP ════════╗</div>
            <div>║ Arrow Keys: Move     ║</div>
            <div>║ WASD: Move           ║</div>
            <div>║ P: Pause/Unpause     ║</div>
            <div>║ H: Toggle Help       ║</div>
            <div>║ Q/ESC: Quit          ║</div>
            <div>╚══════════════════════╝</div>
          </div>
        )}
        {!gameOver && !paused && !showHelp && (
          <div className="text-terminal-subtle">
            Use Arrow Keys or WASD to move • P to pause • H for help • Q to quit
          </div>
        )}
      </div>
    </div>
  );
}

export default SnakeGame;