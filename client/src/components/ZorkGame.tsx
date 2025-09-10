import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface ZorkGameProps {
  onClose: () => void;
}

// Game state interface
interface GameState {
  currentRoom: string;
  inventory: string[];
  score: number;
  moves: number;
  roomObjects: Record<string, string[]>;
  objectStates: Record<string, {
    open?: boolean;
    lit?: boolean;
    moved?: boolean;
    location?: string;
  }>;
}

// Room definitions based on original Zork
const ROOMS = {
  'west-of-house': {
    name: 'West of House',
    description: 'You are standing in an open field west of a white house, with a boarded front door. There is a small mailbox here.',
    exits: {
      north: 'north-of-house',
      south: 'south-of-house',
      east: 'behind-house',
      west: 'forest-west'
    },
    objects: ['mailbox']
  },
  'north-of-house': {
    name: 'North of House',
    description: 'You are facing the north side of a white house. There is no door here, and all the windows are boarded up. To the north a narrow path winds through the trees.',
    exits: {
      south: 'west-of-house',
      east: 'behind-house',
      west: 'forest-west',
      north: 'forest-path'
    },
    objects: []
  },
  'behind-house': {
    name: 'Behind House',
    description: 'You are behind the white house. A path leads into the forest to the east. In one corner of the house there is a small window which is slightly ajar.',
    exits: {
      west: 'west-of-house',
      north: 'north-of-house',
      south: 'south-of-house',
      east: 'forest-east',
      'in': 'kitchen'
    },
    objects: ['window']
  },
  'south-of-house': {
    name: 'South of House',
    description: 'You are facing the south side of a white house. There is no door here, and all the windows are boarded.',
    exits: {
      north: 'west-of-house',
      east: 'behind-house',
      west: 'forest-west'
    },
    objects: []
  },
  'kitchen': {
    name: 'Kitchen',
    description: 'You are in the kitchen of the white house. A table seems to have been used recently for the preparation of food. A passage leads to the west and a dark staircase can be seen leading upward. A dark chimney leads down and to the east is a small window which is open.',
    exits: {
      west: 'living-room',
      up: 'attic',
      down: 'cellar',
      out: 'behind-house'
    },
    objects: ['sack', 'bottle']
  },
  'living-room': {
    name: 'Living Room',
    description: 'You are in the living room. There is a doorway to the east, a wooden door with strange gothic lettering to the west, which appears to be nailed shut, a trophy case, and a large oriental rug in the center of the room.',
    exits: {
      east: 'kitchen',
      up: 'attic'
    },
    objects: ['trophy-case', 'rug', 'lamp']
  },
  'attic': {
    name: 'Attic',
    description: 'This is the attic. The only exit is a stairway leading down.',
    exits: {
      down: 'living-room'
    },
    objects: ['rope']
  },
  'cellar': {
    name: 'Cellar',
    description: 'You are in a dark and damp cellar with a narrow passageway leading north, and a crawlway to the south. To the west is the bottom of a chimney with a rope hanging down.',
    exits: {
      north: 'north-corridor',
      south: 'south-corridor',
      up: 'kitchen'
    },
    objects: []
  },
  'forest-west': {
    name: 'Forest',
    description: 'This is a forest, with trees in all directions. To the east, there appears to be sunlight.',
    exits: {
      east: 'west-of-house',
      north: 'forest-west',
      south: 'forest-west',
      west: 'forest-west'
    },
    objects: []
  },
  'forest-east': {
    name: 'Forest',
    description: 'This is a dimly lit forest, with large trees all around.',
    exits: {
      west: 'behind-house',
      north: 'forest-east',
      south: 'forest-east',
      east: 'forest-east'
    },
    objects: []
  },
  'forest-path': {
    name: 'Forest Path',
    description: 'This is a path winding through a dimly lit forest. The path heads north-south here.',
    exits: {
      south: 'north-of-house',
      north: 'clearing'
    },
    objects: []
  },
  'clearing': {
    name: 'Clearing',
    description: 'You are in a clearing, with a forest surrounding you on all sides. A path leads south.',
    exits: {
      south: 'forest-path'
    },
    objects: ['leaves']
  }
} as const;

// Object definitions based on original Zork
const OBJECTS = {
  'mailbox': {
    name: 'small mailbox',
    description: 'The small mailbox is closed.',
    takeable: false,
    openable: true,
    open: false,
    contains: ['leaflet']
  },
  'leaflet': {
    name: 'leaflet',
    description: 'The leaflet reads: "WELCOME TO ZORK! ZORK is a game of adventure, danger, and low cunning. In it you will explore some of the most amazing territory ever seen by mortal man. Hardened adventurers have run screaming from the terrors contained within. In ZORK, the intrepid explorer delves into the forgotten secrets of a lost labyrinth deep in the bowels of the earth, searching for vast treasures long hidden from prying eyes, treasures guarded by fearsome monsters and diabolical traps! No DECsystem should be without one! ZORK was created at the Programming Technology Division of the MIT Laboratory for Computer Science by Tim Anderson, Marc Blank, Bruce Daniels, and Dave Lebling. It was inspired by the Adventure game of Crowther and Woods, and the Dungeons and Dragons game of Gygax and Arneson."',
    takeable: true
  },
  'window': {
    name: 'window',
    description: 'The window is slightly ajar, but not enough to allow entry.',
    takeable: false,
    openable: true,
    open: false
  },
  'sack': {
    name: 'brown sack',
    description: 'A brown sack, smelling of hot peppers.',
    takeable: true,
    openable: true,
    open: false,
    contains: ['lunch', 'garlic']
  },
  'bottle': {
    name: 'glass bottle',
    description: 'The glass bottle contains water.',
    takeable: true,
    contains: ['water']
  },
  'water': {
    name: 'water',
    description: 'The water looks clean and refreshing.',
    takeable: false
  },
  'lunch': {
    name: 'lunch',
    description: 'A delicious lunch.',
    takeable: true
  },
  'garlic': {
    name: 'clove of garlic',
    description: 'It\'s a clove of garlic.',
    takeable: true
  },
  'trophy-case': {
    name: 'trophy case',
    description: 'The trophy case is empty.',
    takeable: false,
    openable: true,
    open: false
  },
  'rug': {
    name: 'large rug',
    description: 'It\'s a large oriental rug with a dragon motif.',
    takeable: false,
    moveable: true
  },
  'lamp': {
    name: 'brass lantern',
    description: 'A brass lantern is here.',
    takeable: true,
    lightable: true,
    lit: false
  },
  'rope': {
    name: 'coil of rope',
    description: 'A coil of rope.',
    takeable: true
  },
  'leaves': {
    name: 'pile of leaves',
    description: 'The pile of leaves is rather large.',
    takeable: false,
    moveable: true
  }
} as const;

// Verb mappings based on original Zork parser
// Multi-word verb patterns
const MULTI_WORD_VERBS: Record<string, string> = {
  'pick up': 'take',
  'put down': 'drop',
  'turn on': 'light',
  'turn off': 'extinguish',
  'look at': 'examine',
  'go north': 'north',
  'go south': 'south',
  'go east': 'east',
  'go west': 'west',
  'go up': 'up',
  'go down': 'down',
  'go in': 'in',
  'go out': 'out'
};

const VERB_MAPPINGS: Record<string, string> = {
  // Movement
  'n': 'north', 'north': 'north',
  's': 'south', 'south': 'south',
  'e': 'east', 'east': 'east',
  'w': 'west', 'west': 'west',
  'u': 'up', 'up': 'up',
  'd': 'down', 'down': 'down',
  'ne': 'northeast', 'northeast': 'northeast',
  'nw': 'northwest', 'northwest': 'northwest',
  'se': 'southeast', 'southeast': 'southeast',
  'sw': 'southwest', 'southwest': 'southwest',
  'in': 'in', 'enter': 'in',
  'out': 'out', 'exit': 'out',
  
  // Actions
  'l': 'look', 'look': 'look', 'examine': 'examine', 'x': 'examine',
  'take': 'take', 'get': 'get',
  'drop': 'drop',
  'open': 'open', 'close': 'close', 'shut': 'close',
  'read': 'read', 'light': 'light',
  'extinguish': 'extinguish',
  'move': 'move', 'push': 'push', 'pull': 'pull',
  'inventory': 'inventory', 'i': 'inventory',
  'score': 'score', 'quit': 'quit', 'q': 'quit',
  'help': 'help'
};

const HELP_TEXT = `Welcome to ZORK I: The Great Underground Empire

Movement commands:
  north, south, east, west (or n, s, e, w)
  up, down (or u, d)
  northeast, northwest, southeast, southwest (or ne, nw, se, sw)
  in, out, enter, exit

Object manipulation:
  take <object> or get <object>
  drop <object>
  open <object>
  close <object>
  examine <object> or x <object>
  read <object>
  move <object>
  light <object>

Other commands:
  look (or l) - look around
  inventory (or i) - see what you're carrying
  score - see your score
  quit (or q) - quit the game
  help - this message

You can also try other verbs and see what happens!`;

function ZorkGame({ onClose }: ZorkGameProps) {
  const [gameState, setGameState] = useState<GameState>({
    currentRoom: 'west-of-house',
    inventory: [],
    score: 0,
    moves: 0,
    roomObjects: {
      'west-of-house': ['mailbox'],
      'north-of-house': [],
      'behind-house': ['window'],
      'south-of-house': [],
      'kitchen': ['sack', 'bottle'],
      'living-room': ['trophy-case', 'rug', 'lamp'],
      'attic': ['rope'],
      'cellar': [],
      'forest-west': [],
      'forest-east': [],
      'forest-path': [],
      'clearing': ['leaves']
    },
    objectStates: {
      'mailbox': { open: false, location: 'west-of-house' },
      'leaflet': { location: 'mailbox' },
      'window': { open: false, location: 'behind-house' },
      'sack': { open: false, location: 'kitchen' },
      'lunch': { location: 'sack' },
      'garlic': { location: 'sack' },
      'bottle': { location: 'kitchen' },
      'water': { location: 'bottle' },
      'trophy-case': { open: false, location: 'living-room' },
      'rug': { moved: false, location: 'living-room' },
      'lamp': { lit: false, location: 'living-room' },
      'rope': { location: 'attic' },
      'leaves': { moved: false, location: 'clearing' }
    }
  });

  const [output, setOutput] = useState<string[]>([
    'ZORK I: The Great Underground Empire',
    'Copyright (c) 1981, 1982, 1983 Infocom, Inc. All rights reserved.',
    'ZORK is a registered trademark of Infocom, Inc.',
    'Revision 88 / Serial number 840726',
    '',
    'West of House',
    'You are standing in an open field west of a white house, with a boarded front door.',
    'There is a small mailbox here.',
    ''
  ]);
  
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const addOutput = useCallback((lines: string | string[]) => {
    const newLines = Array.isArray(lines) ? lines : [lines];
    setOutput(prev => [...prev, ...newLines]);
  }, []);

  const parseCommand = useCallback((input: string) => {
    const cleanInput = input.toLowerCase().trim();
    const words = cleanInput.split(/\s+/);
    
    // Try multi-word verbs first
    for (const [phrase, verb] of Object.entries(MULTI_WORD_VERBS)) {
      if (cleanInput.startsWith(phrase)) {
        const remainingText = cleanInput.slice(phrase.length).trim();
        const objects = remainingText ? remainingText.split(/\s+/) : [];
        return { verb, objects, fullInput: cleanInput };
      }
    }
    
    // Try single-word verbs
    const firstWord = words[0];
    const verb = VERB_MAPPINGS[firstWord] || firstWord;
    
    // Filter out common prepositions from objects
    const prepositions = ['at', 'in', 'into', 'on', 'with', 'to', 'from'];
    const objects = words.slice(1).filter(word => !prepositions.includes(word));
    
    return {
      verb,
      objects,
      fullInput: cleanInput
    };
  }, []);

  const getCurrentRoom = useCallback(() => {
    return ROOMS[gameState.currentRoom as keyof typeof ROOMS];
  }, [gameState.currentRoom]);

  const isObjectPresent = useCallback((objectId: string): boolean => {
    // Check if object is in inventory
    if (gameState.inventory.includes(objectId)) return true;
    
    // Check if object is in current room
    const roomObjects = gameState.roomObjects[gameState.currentRoom] || [];
    if (roomObjects.includes(objectId)) return true;
    
    // Check if object is inside another object that's present and open
    const objectState = gameState.objectStates[objectId];
    if (objectState?.location) {
      const containerState = gameState.objectStates[objectState.location];
      if (containerState?.open && isObjectPresent(objectState.location)) {
        return true;
      }
    }
    
    return false;
  }, [gameState]);

  const findObject = useCallback((name: string) => {
    const objectIds = Object.keys(OBJECTS);
    return objectIds.find(id => {
      const obj = OBJECTS[id as keyof typeof OBJECTS];
      return (obj.name.toLowerCase().includes(name.toLowerCase()) || 
              id.toLowerCase().includes(name.toLowerCase())) && 
             isObjectPresent(id);
    });
  }, [isObjectPresent]);

  const look = useCallback(() => {
    const room = getCurrentRoom();
    addOutput(['', room.name, room.description]);
    
    // Show visible objects in room
    const roomObjects = gameState.roomObjects[gameState.currentRoom] || [];
    const visibleObjects: string[] = [];
    
    roomObjects.forEach(objId => {
      if (objId in OBJECTS) {
        const obj = OBJECTS[objId as keyof typeof OBJECTS];
        const objectState = gameState.objectStates[objId];
        let description = obj.description;
        
        // Dynamic descriptions based on state
        if (objId === 'mailbox') {
          description = objectState?.open ? 'The small mailbox is open.' : 'The small mailbox is closed.';
          if (objectState?.open) {
            // Show contents if open
            Object.entries(gameState.objectStates).forEach(([id, state]) => {
              if (state.location === 'mailbox' && id in OBJECTS) {
                const contentObj = OBJECTS[id as keyof typeof OBJECTS];
                visibleObjects.push(`  ${contentObj.name}`);
              }
            });
          }
        } else if (objId === 'window') {
          description = objectState?.open ? 'The window is open.' : 'The window is slightly ajar, but not enough to allow entry.';
        } else if (objId === 'lamp') {
          description = objectState?.lit ? 'A brass lantern (providing light)' : 'A brass lantern';
        }
        
        visibleObjects.push(description);
      }
    });
    
    if (visibleObjects.length > 0) {
      addOutput(visibleObjects);
    }
  }, [gameState, getCurrentRoom, addOutput]);

  const executeCommand = useCallback((command: string) => {
    if (!command.trim()) return;
    
    addOutput(`> ${command}`);
    
    const { verb, objects } = parseCommand(command);
    
    setGameState(prev => ({ ...prev, moves: prev.moves + 1 }));

    switch (verb) {
      case 'north':
      case 'south':
      case 'east':
      case 'west':
      case 'up':
      case 'down':
      case 'northeast':
      case 'northwest':
      case 'southeast':
      case 'southwest':
      case 'in':
      case 'out':
        const room = getCurrentRoom();
        const nextRoom = room.exits[verb as keyof typeof room.exits];
        
        if (nextRoom && nextRoom in ROOMS) {
          if (verb === 'in' && gameState.currentRoom === 'behind-house') {
            const windowState = gameState.objectStates['window'];
            if (!windowState?.open) {
              addOutput('The window is not open.');
              break;
            }
          }
          
          setGameState(prev => ({ ...prev, currentRoom: nextRoom }));
          setTimeout(() => look(), 100);
        } else {
          addOutput("You can't go that way.");
        }
        break;

      case 'look':
      case 'l':
        look();
        break;

      case 'examine':
      case 'x':
        if (objects.length === 0) {
          look();
        } else {
          const objectId = findObject(objects.join(' '));
          if (objectId && objectId in OBJECTS) {
            const obj = OBJECTS[objectId as keyof typeof OBJECTS];
            addOutput(obj.description);
          } else {
            addOutput("I don't see that here.");
          }
        }
        break;

      case 'take':
      case 'get':
        if (objects.length === 0) {
          addOutput('Take what?');
        } else {
          const objectId = findObject(objects.join(' '));
          if (!objectId) {
            addOutput("I don't see that here.");
          } else {
            const obj = OBJECTS[objectId as keyof typeof OBJECTS];
            if (!obj.takeable) {
              addOutput("You can't take that.");
            } else if (gameState.inventory.includes(objectId)) {
              addOutput("You already have that.");
            } else {
              setGameState(prev => {
                const newState = { ...prev };
                
                // Add to inventory
                newState.inventory = [...prev.inventory, objectId];
                
                // Remove from room or container
                const objectState = prev.objectStates[objectId];
                if (objectState?.location) {
                  if (prev.roomObjects[objectState.location]) {
                    newState.roomObjects[objectState.location] = prev.roomObjects[objectState.location].filter(id => id !== objectId);
                  }
                }
                
                // Update object state
                newState.objectStates = {
                  ...prev.objectStates,
                  [objectId]: { ...objectState, location: 'inventory' }
                };
                
                return newState;
              });
              addOutput('Taken.');
            }
          }
        }
        break;

      case 'drop':
        if (objects.length === 0) {
          addOutput('Drop what?');
        } else {
          const objectId = findObject(objects.join(' '));
          if (!objectId || !gameState.inventory.includes(objectId)) {
            addOutput("You don't have that.");
          } else {
            setGameState(prev => {
              const newState = { ...prev };
              
              // Remove from inventory
              newState.inventory = prev.inventory.filter(id => id !== objectId);
              
              // Add to current room
              if (!newState.roomObjects[prev.currentRoom]) {
                newState.roomObjects[prev.currentRoom] = [];
              }
              newState.roomObjects[prev.currentRoom] = [...newState.roomObjects[prev.currentRoom], objectId];
              
              // Update object state
              newState.objectStates = {
                ...prev.objectStates,
                [objectId]: { ...prev.objectStates[objectId], location: prev.currentRoom }
              };
              
              return newState;
            });
            addOutput('Dropped.');
          }
        }
        break;

      case 'open':
        if (objects.length === 0) {
          addOutput('Open what?');
        } else {
          const objectId = findObject(objects.join(' '));
          if (!objectId) {
            addOutput("I don't see that here.");
          } else {
            const obj = OBJECTS[objectId as keyof typeof OBJECTS];
            const objectState = gameState.objectStates[objectId];
            
            if (!('openable' in obj) || !obj.openable) {
              addOutput("You can't open that.");
            } else if (objectState?.open) {
              addOutput("It's already open.");
            } else {
              setGameState(prev => ({
                ...prev,
                objectStates: {
                  ...prev.objectStates,
                  [objectId]: { ...prev.objectStates[objectId], open: true }
                }
              }));
              
              if (objectId === 'mailbox') {
                addOutput('Opening the small mailbox reveals a leaflet.');
              } else if (objectId === 'window') {
                addOutput('With great effort, you open the window far enough to allow entry.');
              } else if (objectId === 'sack') {
                addOutput('Opening the brown sack reveals a lunch and a clove of garlic.');
              } else {
                addOutput('Opened.');
              }
            }
          }
        }
        break;

      case 'read':
        if (objects.length === 0) {
          addOutput('Read what?');
        } else {
          const objectId = findObject(objects.join(' '));
          if (!objectId) {
            addOutput("I don't see that here.");
          } else if (objectId === 'leaflet') {
            const obj = OBJECTS.leaflet;
            addOutput(obj.description);
          } else {
            addOutput("You can't read that.");
          }
        }
        break;

      case 'inventory':
      case 'i':
        if (gameState.inventory.length === 0) {
          addOutput('You are empty-handed.');
        } else {
          addOutput('You are carrying:');
          gameState.inventory.forEach(id => {
            const obj = OBJECTS[id as keyof typeof OBJECTS];
            addOutput(`  ${obj.name}`);
          });
        }
        break;

      case 'score':
        addOutput(`Your score is ${gameState.score} (total of 350 points), in ${gameState.moves} moves.`);
        addOutput('This gives you the rank of Beginner.');
        break;

      case 'light':
        if (objects.length === 0) {
          addOutput('Light what?');
        } else {
          const objectId = findObject(objects.join(' '));
          if (!objectId) {
            addOutput("I don't see that here.");
          } else {
            const obj = OBJECTS[objectId as keyof typeof OBJECTS];
            const objectState = gameState.objectStates[objectId];
            
            if (!('lightable' in obj) || !obj.lightable) {
              addOutput("You can't light that.");
            } else if (objectState?.lit) {
              addOutput("It's already lit.");
            } else {
              setGameState(prev => ({
                ...prev,
                objectStates: {
                  ...prev.objectStates,
                  [objectId]: { ...prev.objectStates[objectId], lit: true }
                }
              }));
              addOutput('The brass lantern is now on.');
            }
          }
        }
        break;

      case 'extinguish':
        if (objects.length === 0) {
          addOutput('Extinguish what?');
        } else {
          const objectId = findObject(objects.join(' '));
          if (!objectId) {
            addOutput("I don't see that here.");
          } else {
            const objectState = gameState.objectStates[objectId];
            
            if (!objectState?.lit) {
              addOutput("It's not lit.");
            } else {
              setGameState(prev => ({
                ...prev,
                objectStates: {
                  ...prev.objectStates,
                  [objectId]: { ...prev.objectStates[objectId], lit: false }
                }
              }));
              addOutput('The brass lantern is now off.');
            }
          }
        }
        break;

      case 'close':
        if (objects.length === 0) {
          addOutput('Close what?');
        } else {
          const objectId = findObject(objects.join(' '));
          if (!objectId) {
            addOutput("I don't see that here.");
          } else {
            const obj = OBJECTS[objectId as keyof typeof OBJECTS];
            const objectState = gameState.objectStates[objectId];
            
            if (!('openable' in obj) || !obj.openable) {
              addOutput("You can't close that.");
            } else if (!objectState?.open) {
              addOutput("It's already closed.");
            } else {
              setGameState(prev => ({
                ...prev,
                objectStates: {
                  ...prev.objectStates,
                  [objectId]: { ...prev.objectStates[objectId], open: false }
                }
              }));
              addOutput('Closed.');
            }
          }
        }
        break;

      case 'move':
      case 'push':
      case 'pull':
        if (objects.length === 0) {
          addOutput(`${verb.charAt(0).toUpperCase() + verb.slice(1)} what?`);
        } else {
          const objectId = findObject(objects.join(' '));
          if (!objectId) {
            addOutput("I don't see that here.");
          } else if (objectId === 'rug') {
            setGameState(prev => ({
              ...prev,
              objectStates: {
                ...prev.objectStates,
                rug: { ...prev.objectStates.rug, moved: true }
              }
            }));
            addOutput('With a great effort, the rug is moved to one side of the room. Underneath the rug is a closed trap door!');
          } else {
            addOutput("Moving that doesn't seem to accomplish anything.");
          }
        }
        break;

      case 'help':
        addOutput(HELP_TEXT.split('\n'));
        break;

      case 'quit':
      case 'q':
        addOutput(['', 'Do you really want to quit?']);
        addOutput('Press ESC or click QUIT to exit the game.');
        break;

      default:
        // Try some common responses for unrecognized commands
        if (command.toLowerCase().includes('hello') || command.toLowerCase().includes('hi')) {
          addOutput('Hello there! Type HELP for assistance.');
        } else {
          addOutput("I don't understand that.");
        }
        break;
    }
    
    addOutput('');
  }, [gameState, parseCommand, getCurrentRoom, findObject, addOutput, look]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      executeCommand(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
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