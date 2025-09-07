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
    mutationFn: async ({ location, coordinates }: { 
      location?: string;
      coordinates?: { lat: number; lon: number } 
    }) => {
      let endpoint = '/api/weather';
      const params = new URLSearchParams();
      
      if (coordinates) {
        params.append('lat', coordinates.lat.toString());
        params.append('lon', coordinates.lon.toString());
      } else if (location) {
        params.append('location', location);
      }
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
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
  weather - Get current weather (uses location if available)
  
Knowledge Base Commands:
  docs - List your uploaded documents
  upload - Open document upload interface
  search [query] - Search your knowledge base
  knowledge stats - Show knowledge base statistics
  
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

    // Handle weather command
    if (cmd === 'weather') {
      setIsTyping(true);
      addEntry('system', 'Getting weather information...');
      
      // Try to get user's location
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coordinates = {
              lat: position.coords.latitude,
              lon: position.coords.longitude
            };
            weatherMutation.mutate({ coordinates });
          },
          (error) => {
            // If geolocation fails, get default weather
            weatherMutation.mutate({});
          },
          { timeout: 5000, enableHighAccuracy: false }
        );
      } else {
        // If geolocation not supported, get default weather
        weatherMutation.mutate({});
      }
      return;
    }

    // Knowledge base commands
    if (cmd === 'docs') {
      setIsTyping(true);
      addEntry('system', 'Retrieving your document library...');
      
      // Fetch user documents
      fetch('/api/documents', { credentials: 'include' })
        .then(async (res) => {
          setIsTyping(false);
          if (res.status === 401) {
            addEntry('error', 'Authentication required. Please log in to access your documents.');
            return;
          }
          if (!res.ok) throw new Error('Failed to fetch documents');
          
          const documents = await res.json();
          if (documents.length === 0) {
            addEntry('system', 'No documents found. Use "upload" to add documents to your knowledge base.');
          } else {
            const docList = documents
              .map((doc: any, index: number) => 
                `${index + 1}. ${doc.originalName} (${doc.fileSize} bytes) - ${doc.summary || 'No summary'}`
              )
              .join('\n');
            addEntry('system', `Your Documents (${documents.length} total):\n${docList}\n\nUse "search [query]" to find specific information.`);
          }
        })
        .catch((error) => {
          setIsTyping(false);
          addEntry('error', `Error fetching documents: ${error.message}`);
        });
      return;
    }

    if (cmd === 'upload') {
      addEntry('system', 'Opening document upload interface...\nNote: Upload interface will be available in the main terminal when logged in.');
      // The actual upload UI will be shown in the Terminal component when user is authenticated
      return;
    }

    if (cmd.startsWith('search ')) {
      const query = command.substring(7).trim();
      if (!query) {
        addEntry('error', 'Please provide a search query. Usage: search [your query]');
        return;
      }

      setIsTyping(true);
      addEntry('system', `Searching knowledge base for: "${query}"`);
      
      fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}`, { 
        credentials: 'include' 
      })
        .then(async (res) => {
          setIsTyping(false);
          if (res.status === 401) {
            addEntry('error', 'Authentication required. Please log in to search your knowledge base.');
            return;
          }
          if (!res.ok) throw new Error('Search failed');
          
          const results = await res.json();
          const { documents, chunks, relevantContent } = results;
          
          if (relevantContent.length === 0) {
            addEntry('system', `No results found for "${query}". Try different keywords or upload more documents.`);
          } else {
            const resultText = `Search Results for "${query}":
Found ${relevantContent.length} relevant passages from ${documents.length} documents:

${relevantContent.map((content: string, i: number) => `${i + 1}. ${content}`).join('\n\n')}

Documents: ${documents.map((doc: any) => doc.originalName).join(', ')}`;
            addEntry('system', resultText);
          }
        })
        .catch((error) => {
          setIsTyping(false);
          addEntry('error', `Search error: ${error.message}`);
        });
      return;
    }

    if (cmd === 'knowledge stats' || cmd === 'kb stats') {
      setIsTyping(true);
      addEntry('system', 'Retrieving knowledge base statistics...');
      
      fetch('/api/knowledge/stats', { credentials: 'include' })
        .then(async (res) => {
          setIsTyping(false);
          if (res.status === 401) {
            addEntry('error', 'Authentication required. Please log in to view statistics.');
            return;
          }
          if (!res.ok) throw new Error('Failed to fetch stats');
          
          const stats = await res.json();
          const sizeInMB = (stats.totalSizeBytes / (1024 * 1024)).toFixed(2);
          
          const statsText = `Knowledge Base Statistics:
  Total Documents: ${stats.totalDocuments}
  Total Size: ${sizeInMB} MB
  Total Chunks: ${stats.totalChunks}
  
Recent Documents:
${stats.recentDocuments.length > 0 
  ? stats.recentDocuments.map((doc: any, i: number) => 
      `  ${i + 1}. ${doc.originalName} (uploaded ${new Date(doc.uploadedAt).toLocaleDateString()})`)
    .join('\n')
  : '  No documents yet'
}

Use "upload" to add more documents or "docs" to list all documents.`;
          addEntry('system', statsText);
        })
        .catch((error) => {
          setIsTyping(false);
          addEntry('error', `Error fetching stats: ${error.message}`);
        });
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
