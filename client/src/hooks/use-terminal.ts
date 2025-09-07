import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Message } from '@shared/schema';

interface TerminalEntry {
  id: string;
  type: 'command' | 'response' | 'system' | 'error';
  content: string;
  timestamp: string;
  mode?: 'natural' | 'technical';
}

export function useTerminal() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: '1',
      type: 'system',
      content: 'ARCHIMEDES AI Terminal v7.0 - Initialized',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      type: 'system',
      content: 'System Status: ONLINE | Voice Synthesis: READY | Mode: NATURAL CHAT',
      timestamp: new Date().toISOString(),
    },
    {
      id: '3',
      type: 'system',
      content: "Welcome to ARCHIMEDES v7. Type 'help' for available commands or start chatting naturally.",
      timestamp: new Date().toISOString(),
    },
  ]);
  
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentMode, setCurrentMode] = useState<'natural' | 'technical'>('natural');
  const [isTyping, setIsTyping] = useState(false);

  const chatMutation = useMutation({
    mutationFn: async ({ message, mode }: { message: string; mode: 'natural' | 'technical' }) => {
      const response = await apiRequest('POST', '/api/chat', {
        message,
        mode,
        sessionId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.response, data.mode);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Error: ${error.message}`);
    },
  });

  const weatherMutation = useMutation({
    mutationFn: async ({ location, type, coordinates }: { 
      location?: string; 
      type: 'current' | 'forecast'; 
      coordinates?: { lat: number; lon: number } 
    }) => {
      let endpoint;
      
      if (coordinates) {
        endpoint = type === 'current' 
          ? `/api/weather/coordinates?lat=${coordinates.lat}&lon=${coordinates.lon}`
          : `/api/weather/forecast/coordinates?lat=${coordinates.lat}&lon=${coordinates.lon}`;
      } else if (location) {
        endpoint = type === 'current' 
          ? `/api/weather/current/${encodeURIComponent(location)}`
          : `/api/weather/forecast/${encodeURIComponent(location)}`;
      } else {
        throw new Error('Either location or coordinates must be provided');
      }
      
      const response = await apiRequest('GET', endpoint);
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addEntry('response', data.formatted);
    },
    onError: (error) => {
      setIsTyping(false);
      addEntry('error', `Weather Error: ${error.message}`);
    },
  });

  const addEntry = useCallback((type: TerminalEntry['type'], content: string, mode?: 'natural' | 'technical') => {
    const entry: TerminalEntry = {
      id: crypto.randomUUID(),
      type,
      content,
      timestamp: new Date().toISOString(),
      mode,
    };
    setEntries(prev => [...prev, entry]);
  }, []);

  const processCommand = useCallback((command: string) => {
    const timestamp = new Date().toLocaleTimeString();
    addEntry('command', command);
    
    // Add to command history
    setCommandHistory(prev => [command, ...prev.slice(0, 49)]); // Keep last 50 commands
    setHistoryIndex(-1);
    
    const cmd = command.toLowerCase().trim();
    
    // Handle built-in terminal commands
    if (cmd === 'help') {
      addEntry('system', `Available Commands:
  help - Show this help message
  clear - Clear terminal output
  mode [natural|technical] - Switch AI mode
  voice [on|off] - Toggle voice synthesis
  history - Show command history
  status - Show system status
  weather [location] - Get weather (current location if no location specified)
  forecast [location] - Get 5-day forecast (current location if no location specified)
  
You can also chat naturally or ask technical questions.`);
      return;
    }
    
    if (cmd === 'clear') {
      setEntries([]);
      return;
    }
    
    if (cmd.startsWith('mode ')) {
      const newMode = cmd.split(' ')[1] as 'natural' | 'technical';
      if (newMode === 'natural' || newMode === 'technical') {
        setCurrentMode(newMode);
        addEntry('system', `Mode switched to: ${newMode.toUpperCase()}`);
        return;
      } else {
        addEntry('error', 'Invalid mode. Use "natural" or "technical"');
        return;
      }
    }
    
    if (cmd === 'status') {
      addEntry('system', `ARCHIMEDES v7 System Status:
  Mode: ${currentMode.toUpperCase()}
  Session ID: ${sessionId}
  Commands Executed: ${commandHistory.length}
  System: ONLINE`);
      return;
    }
    
    if (cmd === 'history') {
      const historyText = commandHistory.length > 0 
        ? commandHistory.slice(0, 10).map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')
        : 'No command history available.';
      addEntry('system', `Recent Commands:\n${historyText}`);
      return;
    }

    // Handle weather commands
    if (cmd === 'weather' || cmd.startsWith('weather ')) {
      const location = cmd === 'weather' ? '' : command.slice(8).trim();
      
      if (!location) {
        // Use geolocation for current location
        setIsTyping(true);
        addEntry('system', 'Getting your current location...');
        
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coordinates = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
              };
              weatherMutation.mutate({ type: 'current', coordinates });
            },
            (error) => {
              setIsTyping(false);
              addEntry('error', 'Unable to get your location. Please specify a location: weather [city]');
            },
            { timeout: 10000, enableHighAccuracy: true }
          );
        } else {
          setIsTyping(false);
          addEntry('error', 'Geolocation not supported. Please specify a location: weather [city]');
        }
        return;
      }
      
      setIsTyping(true);
      weatherMutation.mutate({ location, type: 'current' });
      return;
    }

    if (cmd === 'forecast' || cmd.startsWith('forecast ')) {
      const location = cmd === 'forecast' ? '' : command.slice(9).trim();
      
      if (!location) {
        // Use geolocation for current location
        setIsTyping(true);
        addEntry('system', 'Getting your current location for forecast...');
        
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coordinates = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
              };
              weatherMutation.mutate({ type: 'forecast', coordinates });
            },
            (error) => {
              setIsTyping(false);
              addEntry('error', 'Unable to get your location. Please specify a location: forecast [city]');
            },
            { timeout: 10000, enableHighAccuracy: true }
          );
        } else {
          setIsTyping(false);
          addEntry('error', 'Geolocation not supported. Please specify a location: forecast [city]');
        }
        return;
      }
      
      setIsTyping(true);
      weatherMutation.mutate({ location, type: 'forecast' });
      return;
    }
    
    // For non-command inputs, send to AI
    setIsTyping(true);
    chatMutation.mutate({ message: command, mode: currentMode });
  }, [currentMode, sessionId, commandHistory.length, addEntry, chatMutation, weatherMutation]);

  const clearTerminal = useCallback(() => {
    setEntries([]);
  }, []);

  const switchMode = useCallback((mode: 'natural' | 'technical') => {
    setCurrentMode(mode);
    addEntry('system', `Mode switched to: ${mode.toUpperCase()}`);
  }, [addEntry]);

  const getHistoryCommand = useCallback((direction: 'up' | 'down') => {
    if (direction === 'up' && historyIndex < commandHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      return commandHistory[newIndex];
    } else if (direction === 'down' && historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      return commandHistory[newIndex];
    } else if (direction === 'down' && historyIndex === 0) {
      setHistoryIndex(-1);
      return '';
    }
    return null;
  }, [commandHistory, historyIndex]);

  const loadConversation = useCallback(async (targetSessionId: string) => {
    try {
      const response = await apiRequest('GET', `/api/conversation/${targetSessionId}`);
      const conversation = await response.json();
      
      if (conversation && Array.isArray(conversation.messages)) {
        // Clear current entries and load conversation
        setEntries([
          {
            id: crypto.randomUUID(),
            type: 'system',
            content: `Loaded conversation: ${conversation.title || 'Untitled'}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        
        // Add all messages from the conversation
        conversation.messages.forEach((msg: Message, index: number) => {
          setEntries(prev => [...prev, {
            id: crypto.randomUUID(),
            type: msg.role === 'user' ? 'command' : 'response',
            content: msg.content,
            timestamp: msg.timestamp,
            mode: msg.mode,
          }]);
        });
        
        // Update current mode to match the conversation
        if (conversation.mode) {
          setCurrentMode(conversation.mode);
        }
      }
    } catch (error) {
      addEntry('error', 'Failed to load conversation history');
    }
  }, [addEntry]);

  return {
    entries,
    commandHistory,
    currentMode,
    isTyping,
    processCommand,
    clearTerminal,
    switchMode,
    getHistoryCommand,
    loadConversation,
    isLoading: chatMutation.isPending,
  };
}
