import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface ZorkGameProps {
  onClose: () => void;
}

// Game data structures based on original Zork
interface ZorkRoom {
  id: string;
  name: string;
  description: string;
  exits: Record<string, string>;
  objects: string[];
}

interface ZorkObject {
  id: string;
  name: string;
  description: string;
  takeable: boolean;
  visible: boolean;
  location: string | null; // room id or 'inventory'
}

interface GameState {
  currentRoom: string;
  inventory: string[];
  score: number;
  moves: number;
  gameStarted: boolean;
}

// Classic Zork rooms (simplified but authentic)
const ROOMS: Record<string, ZorkRoom> = {
  'west-house': {
    id: 'west-house',
    name: 'West of House',
    description: 'You are standing in an open field west of a white house, with a boarded front door.',
    exits: { 
      'north': 'north-house', 
      'south': 'south-house', 
      'east': 'front-door',
      'west': 'forest'
    },
    objects: ['mailbox']
  },
  'north-house': {
    id: 'north-house', 
    name: 'North of House',
    description: 'You are facing the north side of a white house. There is no door here, and all the windows are boarded.',
    exits: { 
      'south': 'west-house', 
      'east': 'behind-house',
      'west': 'forest'
    },
    objects: []
  },
  'south-house': {
    id: 'south-house',
    name: 'South of House', 
    description: 'You are facing the south side of a white house. There is no door here, and all the windows are boarded.',
    exits: { 
      'north': 'west-house', 
      'east': 'behind-house',
      'west': 'forest'
    },
    objects: []
  },
  'behind-house': {
    id: 'behind-house',
    name: 'Behind House',
    description: 'You are behind the white house. A path leads into the forest to the east. In one corner of the house there is a small window which is slightly ajar.',
    exits: { 
      'north': 'north-house', 
      'south': 'south-house', 
      'west': 'west-house',
      'east': 'forest',
      'enter': 'kitchen'
    },
    objects: ['window']
  },
  'kitchen': {
    id: 'kitchen',
    name: 'Kitchen',
    description: 'You are in the kitchen of the white house. A table seems to have been used recently for the preparation of food. A passage leads to the west and a dark staircase can be seen leading upward. A dark chimney leads down and to the north is a small window which is open.',
    exits: { 
      'west': 'living-room', 
      'up': 'attic',
      'north': 'behind-house'
    },
    objects: ['bottle', 'bag']
  },
  'living-room': {
    id: 'living-room',
    name: 'Living Room',
    description: 'You are in the living room. There is a doorway to the east, a wooden door with strange gothic lettering to the west, which appears to be nailed shut, a trophy case, and a large oriental rug in the center of the room.',
    exits: { 
      'east': 'kitchen'
    },
    objects: ['lamp', 'rug', 'trophy-case', 'sword']
  },
  'attic': {
    id: 'attic',
    name: 'Attic', 
    description: 'You are in the attic. The only exit is a stairway leading down.',
    exits: { 
      'down': 'kitchen'
    },
    objects: ['rope', 'knife']
  },
  'forest': {
    id: 'forest',
    name: 'Forest',
    description: 'You are in a forest, with trees in all directions. To the east, there appears to be sunlight.',
    exits: { 
      'east': 'west-house',
      'north': 'forest',
      'south': 'forest', 
      'west': 'forest'
    },
    objects: ['tree', 'leaves']
  },
  'front-door': {
    id: 'front-door',
    name: 'Front Door',
    description: 'The door is boarded and you cannot enter.',
    exits: { 
      'west': 'west-house'
    },
    objects: []
  }
};

// Classic Zork objects
const OBJECTS: Record<string, ZorkObject> = {
  'mailbox': {
    id: 'mailbox',
    name: 'small mailbox',
    description: 'There is a small mailbox here.',
    takeable: false,
    visible: true,
    location: 'west-house'
  },
  'window': {
    id: 'window', 
    name: 'window',
    description: 'The window is slightly ajar, but not enough to allow entry.',
    takeable: false,
    visible: true,
    location: 'behind-house'
  },
  'lamp': {
    id: 'lamp',
    name: 'brass lantern',
    description: 'A battery-powered brass lantern is on the trophy case.',
    takeable: true,
    visible: true,
    location: 'living-room'
  },
  'sword': {
    id: 'sword',
    name: 'elvish sword',
    description: 'Above the trophy case hangs an elvish sword of great antiquity.',
    takeable: true,
    visible: true,
    location: 'living-room'
  },
  'bottle': {
    id: 'bottle',
    name: 'glass bottle',
    description: 'A bottle is sitting on the table. The bottle contains: A quantity of water.',
    takeable: true,
    visible: true,
    location: 'kitchen'
  },
  'bag': {
    id: 'bag',
    name: 'brown bag',
    description: 'A brown bag is sitting on the table.',
    takeable: true,
    visible: true,
    location: 'kitchen'
  },
  'rug': {
    id: 'rug',
    name: 'large rug',
    description: 'There is an oriental rug spread out on the floor.',
    takeable: false,
    visible: true,
    location: 'living-room'
  },
  'trophy-case': {
    id: 'trophy-case',
    name: 'trophy case',
    description: 'The trophy case appears to be empty.',
    takeable: false,
    visible: true,
    location: 'living-room'
  },
  'rope': {
    id: 'rope',
    name: 'coil of rope',
    description: 'A large coil of rope is lying in the corner.',
    takeable: true,
    visible: true,
    location: 'attic'
  },
  'knife': {
    id: 'knife',
    name: 'rusty knife',
    description: 'A rusty knife is lying here.',
    takeable: true,
    visible: true,
    location: 'attic'
  },
  'tree': {
    id: 'tree',
    name: 'tree',
    description: 'The trees of the forest are too large to climb.',
    takeable: false,
    visible: true,
    location: 'forest'
  },
  'leaves': {
    id: 'leaves',
    name: 'pile of leaves',
    description: 'A pile of leaves has been left here by the wind.',
    takeable: false,
    visible: true,
    location: 'forest'
  }
};

const HELP_TEXT = `
ZORK - THE GREAT UNDERGROUND EMPIRE

Available commands:
- Movement: NORTH, SOUTH, EAST, WEST, UP, DOWN, ENTER
- Actions: TAKE <object>, DROP <object>, EXAMINE <object> 
- Other: LOOK, INVENTORY, SCORE, HELP, QUIT

Examples:
- go north
- take lamp
- examine mailbox
- look around

Navigate by typing directions or "go <direction>".
Good luck, adventurer!
`;

export function ZorkGame({ onClose }: ZorkGameProps) {
  const [gameState, setGameState] = useState<GameState>({
    currentRoom: 'west-house',
    inventory: [],
    score: 0,
    moves: 0,
    gameStarted: true
  });
  
  const [output, setOutput] = useState<string[]>([
    'ZORK I: The Great Underground Empire',
    'Copyright (c) 1981, 1982, 1983 Infocom, Inc. All rights reserved.',
    'ZORK is a registered trademark of Infocom, Inc.',
    '',
    'West of House',
    'You are standing in an open field west of a white house, with a boarded front door.',
    'There is a small mailbox here.',
    ''
  ]);
  const [input, setInput] = useState('');
  const [showPrompt, setShowPrompt] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };
    
    // Immediate scroll
    scrollToBottom();
    
    // Also scroll after a short delay to handle any rendering delays
    const timer = setTimeout(scrollToBottom, 10);
    
    return () => clearTimeout(timer);
  }, [output]);

  // Focus input on mount and whenever needed
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    
    // Initial focus with a slight delay to ensure modal is rendered
    const timer = setTimeout(focusInput, 100);
    
    // Also focus immediately
    focusInput();
    
    return () => clearTimeout(timer);
  }, []);

  // Re-focus input when container is clicked
  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const addOutput = useCallback((text: string | string[]) => {
    setOutput(prev => [...prev, ...(Array.isArray(text) ? text : [text])]);
  }, []);

  const parseCommand = useCallback((command: string): { verb: string; object?: string; direction?: string } => {
    const words = command.toLowerCase().trim().split(/\s+/);
    const verb = words[0];
    
    // Handle movement commands
    const directions = ['north', 'south', 'east', 'west', 'up', 'down', 'enter'];
    if (directions.includes(verb)) {
      return { verb: 'go', direction: verb };
    }
    if (verb === 'go' && words[1] && directions.includes(words[1])) {
      return { verb: 'go', direction: words[1] };
    }
    
    // Handle object commands
    const object = words.slice(1).join(' ');
    return { verb, object: object || undefined };
  }, []);

  const getCurrentRoom = useCallback(() => {
    return ROOMS[gameState.currentRoom];
  }, [gameState.currentRoom]);

  const getVisibleObjects = useCallback((roomId: string) => {
    return Object.values(OBJECTS).filter(obj => 
      obj.location === roomId && obj.visible
    );
  }, []);

  const findObject = useCallback((name: string, location?: string) => {
    const searchLocation = location || gameState.currentRoom;
    return Object.values(OBJECTS).find(obj => 
      (obj.location === searchLocation || obj.location === 'inventory') &&
      (obj.name.toLowerCase().includes(name.toLowerCase()) || 
       obj.id.toLowerCase().includes(name.toLowerCase()))
    );
  }, [gameState.currentRoom]);

  const executeCommand = useCallback((command: string) => {
    if (!command.trim()) return;
    
    setShowPrompt(false);
    addOutput(`> ${command}`);
    
    const { verb, object, direction } = parseCommand(command);
    
    setGameState(prev => ({ ...prev, moves: prev.moves + 1 }));

    switch (verb) {
      case 'go':
        if (direction) {
          const currentRoom = getCurrentRoom();
          const nextRoomId = currentRoom.exits[direction];
          
          if (nextRoomId && ROOMS[nextRoomId]) {
            if (nextRoomId === 'front-door') {
              addOutput('The door is locked, and there is evidently no key.');
              return;
            }
            
            setGameState(prev => ({ ...prev, currentRoom: nextRoomId }));
            const nextRoom = ROOMS[nextRoomId];
            addOutput(['', nextRoom.name, nextRoom.description]);
            
            const visibleObjects = getVisibleObjects(nextRoomId);
            if (visibleObjects.length > 0) {
              visibleObjects.forEach(obj => {
                addOutput(obj.description);
              });
            }
          } else {
            addOutput("You can't go that way.");
          }
        } else {
          addOutput('Go where?');
        }
        break;

      case 'look':
      case 'l':
        const room = getCurrentRoom();
        addOutput(['', room.name, room.description]);
        const objects = getVisibleObjects(gameState.currentRoom);
        if (objects.length > 0) {
          objects.forEach(obj => {
            addOutput(obj.description);
          });
        }
        break;

      case 'take':
      case 'get':
        if (!object) {
          addOutput('Take what?');
          return;
        }
        const takeObj = findObject(object);
        if (!takeObj) {
          addOutput("I don't see that here.");
        } else if (!takeObj.takeable) {
          addOutput("You can't take that.");
        } else if (takeObj.location === 'inventory') {
          addOutput("You already have that.");
        } else {
          setGameState(prev => ({
            ...prev,
            inventory: [...prev.inventory, takeObj.id]
          }));
          // Update object location
          OBJECTS[takeObj.id].location = 'inventory';
          addOutput('Taken.');
        }
        break;

      case 'drop':
        if (!object) {
          addOutput('Drop what?');
          return;
        }
        const dropObj = gameState.inventory.find(id => 
          OBJECTS[id].name.toLowerCase().includes(object.toLowerCase()) ||
          id.toLowerCase().includes(object.toLowerCase())
        );
        if (!dropObj) {
          addOutput("You don't have that.");
        } else {
          setGameState(prev => ({
            ...prev,
            inventory: prev.inventory.filter(id => id !== dropObj)
          }));
          const objToUpdate = OBJECTS[dropObj];
          if (objToUpdate) {
            objToUpdate.location = gameState.currentRoom;
          }
          addOutput('Dropped.');
        }
        break;

      case 'examine':
      case 'x':
        if (!object) {
          addOutput('Examine what?');
          return;
        }
        const examObjId = findObject(object)?.id || 
          gameState.inventory.find(id => 
            OBJECTS[id].name.toLowerCase().includes(object.toLowerCase())
          );
        if (examObjId) {
          const obj = OBJECTS[examObjId];
          addOutput(obj.description);
        } else {
          addOutput("I don't see that here.");
        }
        break;

      case 'inventory':
      case 'i':
        if (gameState.inventory.length === 0) {
          addOutput('You are empty-handed.');
        } else {
          addOutput('You are carrying:');
          gameState.inventory.forEach(id => {
            addOutput(`  ${OBJECTS[id].name}`);
          });
        }
        break;

      case 'score':
        addOutput(`Your score is ${gameState.score} (total of 350 points), in ${gameState.moves} moves.`);
        break;

      case 'help':
        addOutput(HELP_TEXT.split('\n'));
        break;

      case 'quit':
      case 'q':
        addOutput(['', 'Do you really want to quit? (Type QUIT again to confirm)']);
        break;

      default:
        addOutput("I don't understand that command. Type HELP for assistance.");
        break;
    }
    
    // Show prompt again after command execution
    setTimeout(() => {
      setShowPrompt(true);
      // Ensure we scroll after command execution
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 10);
    }, 100);
  }, [gameState, addOutput, parseCommand, getCurrentRoom, getVisibleObjects, findObject]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && showPrompt) {
      executeCommand(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter' && input.trim() && showPrompt) {
      e.preventDefault();
      executeCommand(input);
      setInput('');
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-black text-green-400 font-mono"
      onClick={handleContainerClick}
    >
      {/* Integrated Game Display */}
      <div className="flex-1 border border-terminal-highlight bg-black overflow-hidden">
        <div 
          ref={scrollRef}
          className="h-full overflow-y-auto p-4 space-y-1"
          onClick={(e) => {
            e.stopPropagation();
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }}
        >
          {/* Game title header */}
          <div className="text-center mb-4 text-terminal-highlight">
            <div className="text-lg font-bold">▓▓▓ ZORK I: The Great Underground Empire ▓▓▓</div>
            <div className="text-xs mt-1">Score: {gameState.score} | Moves: {gameState.moves}</div>
          </div>
          
          {/* Game output */}
          {output.map((line, index) => (
            <div key={index} className="text-sm leading-relaxed">
              {line || '\u00A0'}
            </div>
          ))}
          
          {/* Command prompt line */}
          {showPrompt && (
            <div className="flex items-center mt-2">
              <span className="text-terminal-highlight mr-1">{'>'}</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  setTimeout(() => {
                    if (inputRef.current && document.activeElement !== inputRef.current) {
                      inputRef.current.focus();
                    }
                  }, 100);
                }}
                className="flex-1 bg-transparent border-none outline-none text-terminal-text font-mono caret-terminal-highlight"
                placeholder=""
                data-testid="input-command"
                autoFocus
                style={{ caretColor: '#00FF41' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Minimal controls */}
      <div className="flex justify-between items-center text-xs p-2 border-t border-terminal-subtle bg-black">
        <div className="text-terminal-subtle">
          ESC to exit • Type HELP for commands
        </div>
        <Button
          onClick={onClose}
          variant="ghost" 
          className="text-xs text-terminal-subtle hover:text-terminal-highlight"
          data-testid="button-close"
        >
          [QUIT]
        </Button>
      </div>
    </div>
  );
}

export default ZorkGame;