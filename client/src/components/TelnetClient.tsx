import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Wifi, WifiOff, X, LogOut } from 'lucide-react';

interface TelnetConnection {
  id: string;
  host: string;
  port: number;
  connected: boolean;
  data: string[];
  error?: string;
}

interface TelnetClientProps {
  onConnectionUpdate?: (connections: TelnetConnection[]) => void;
  onClose?: () => void;
}

export function TelnetClient({ onConnectionUpdate, onClose }: TelnetClientProps) {
  const [connections, setConnections] = useState<TelnetConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const activeConnection = connections.find(c => c.id === activeConnectionId);

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/telnet`);

    ws.onopen = () => {
      console.log('Telnet WebSocket connected');
      setWebsocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('TelnetClient received message:', message);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error, 'Raw data:', event.data);
      }
    };

    ws.onclose = () => {
      console.log('Telnet WebSocket disconnected');
      setWebsocket(null);
    };

    ws.onerror = (error) => {
      console.error('Telnet WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleWebSocketMessage = useCallback((message: any) => {
    console.log('Received message from server:', message);
    setConnections(prev => {
      const updated = [...prev];
      const connectionIndex = updated.findIndex(c => c.id === message.connectionId);
      
      switch (message.type) {
        case 'connected':
          if (connectionIndex >= 0) {
            updated[connectionIndex] = {
              ...updated[connectionIndex],
              connected: true,
              data: [...updated[connectionIndex].data, `Connected to ${message.host}:${message.port}`]
            };
          } else {
            console.warn('Received connected message for unknown connection:', message.connectionId);
            // Create the connection if it doesn't exist
            const newConnection: TelnetConnection = {
              id: message.connectionId,
              host: message.host,
              port: message.port,
              connected: true,
              data: [`Connected to ${message.host}:${message.port}`]
            };
            updated.push(newConnection);
            setActiveConnectionId(message.connectionId);
          }
          break;
          
        case 'data':
          if (connectionIndex >= 0) {
            const ansiProcessed = processAnsiCodes(message.data);
            updated[connectionIndex] = {
              ...updated[connectionIndex],
              data: [...updated[connectionIndex].data, ansiProcessed]
            };
          } else {
            console.warn('Received data for unknown connection:', message.connectionId);
          }
          break;
          
        case 'disconnected':
          if (connectionIndex >= 0) {
            updated[connectionIndex] = {
              ...updated[connectionIndex],
              connected: false,
              data: [...updated[connectionIndex].data, `Disconnected from ${updated[connectionIndex].host}`]
            };
          }
          break;
          
        case 'error':
          if (connectionIndex >= 0) {
            updated[connectionIndex] = {
              ...updated[connectionIndex],
              connected: false,
              error: message.message,
              data: [...updated[connectionIndex].data, `Error: ${message.message}`]
            };
          } else {
            console.warn('Received error for unknown connection:', message.connectionId, message.message);
            // Create connection to show the error
            const newConnection: TelnetConnection = {
              id: message.connectionId,
              host: 'unknown',
              port: 0,
              connected: false,
              error: message.message,
              data: [`Error: ${message.message}`]
            };
            updated.push(newConnection);
            setActiveConnectionId(message.connectionId);
          }
          break;
      }
      
      onConnectionUpdate?.(updated);
      return updated;
    });
  }, [onConnectionUpdate]);

  // ANSI color and formatting codes
  const ANSI_COLORS = {
    30: 'ansi-black', 31: 'ansi-red', 32: 'ansi-green', 33: 'ansi-yellow',
    34: 'ansi-blue', 35: 'ansi-magenta', 36: 'ansi-cyan', 37: 'ansi-white',
    90: 'ansi-bright-black', 91: 'ansi-bright-red', 92: 'ansi-bright-green', 93: 'ansi-bright-yellow',
    94: 'ansi-bright-blue', 95: 'ansi-bright-magenta', 96: 'ansi-bright-cyan', 97: 'ansi-bright-white',
    40: 'ansi-bg-black', 41: 'ansi-bg-red', 42: 'ansi-bg-green', 43: 'ansi-bg-yellow',
    44: 'ansi-bg-blue', 45: 'ansi-bg-magenta', 46: 'ansi-bg-cyan', 47: 'ansi-bg-white'
  };

  // Proper ANSI code processing with HTML conversion
  const processAnsiCodes = (text: string): string => {
    let result = text;
    let openTags: string[] = [];
    
    // Process ANSI escape sequences
    result = result.replace(/\x1b\[([0-9;]*)m/g, (match, codes) => {
      if (!codes) codes = '0';
      const codeList = codes.split(';').map((code: string) => parseInt(code) || 0);
      let html = '';
      
      for (const code of codeList) {
        if (code === 0) {
          // Reset all formatting
          html += openTags.reverse().map(() => '</span>').join('');
          openTags = [];
        } else if (code === 1) {
          // Bold
          html += '<span class="ansi-bold">';
          openTags.push('bold');
        } else if (code === 3) {
          // Italic
          html += '<span class="ansi-italic">';
          openTags.push('italic');
        } else if (code === 4) {
          // Underline
          html += '<span class="ansi-underline">';
          openTags.push('underline');
        } else if (ANSI_COLORS[code as keyof typeof ANSI_COLORS]) {
          // Color codes
          const colorClass = ANSI_COLORS[code as keyof typeof ANSI_COLORS];
          html += `<span class="${colorClass}">`;
          openTags.push('color');
        }
      }
      return html;
    });
    
    // Handle basic cursor movements and screen control (simplified)
    result = result
      .replace(/\x1b\[2J/g, '') // Clear screen (ignore for now)
      .replace(/\x1b\[H/g, '') // Cursor home (ignore for now)
      .replace(/\x1b\[[ABCD]/g, '') // Cursor movement (ignore for now)
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n');
    
    // Close any remaining open tags
    result += openTags.reverse().map(() => '</span>').join('');
    
    return result;
  };

  const connectToHost = useCallback((host: string, port: number) => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not ready. State:', websocket?.readyState);
      return null;
    }

    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newConnection: TelnetConnection = {
      id: connectionId,
      host,
      port,
      connected: false,
      data: [`Connecting to ${host}:${port}...`]
    };

    setConnections(prev => [...prev, newConnection]);
    setActiveConnectionId(connectionId);

    console.log('Sending telnet connect message:', { type: 'connect', host, port });
    websocket.send(JSON.stringify({
      type: 'connect',
      host,
      port
    }));

    return connectionId;
  }, [websocket]);

  const sendData = useCallback((data: string) => {
    if (!websocket || !activeConnectionId) return;

    websocket.send(JSON.stringify({
      type: 'data',
      connectionId: activeConnectionId,
      data
    }));
  }, [websocket, activeConnectionId]);

  const sendBreak = useCallback(() => {
    if (!websocket || !activeConnectionId) return;

    websocket.send(JSON.stringify({
      type: 'break',
      connectionId: activeConnectionId
    }));
  }, [websocket, activeConnectionId]);

  const disconnect = useCallback((connectionId: string) => {
    if (!websocket) return;

    websocket.send(JSON.stringify({
      type: 'disconnect',
      connectionId
    }));

    setConnections(prev => prev.filter(c => c.id !== connectionId));
    
    if (activeConnectionId === connectionId) {
      setActiveConnectionId(null);
    }
  }, [websocket, activeConnectionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Ctrl-C for BREAK command
    if (e.ctrlKey && e.key === 'c' && activeConnection?.connected) {
      e.preventDefault();
      sendBreak();
      setConnections(prev => prev.map(conn => 
        conn.id === activeConnectionId 
          ? { ...conn, data: [...conn.data, '^C (BREAK sent)'] }
          : conn
      ));
      setInput(''); // Clear current input
      return;
    }

    if (e.key === 'Enter' && input.trim() && activeConnection?.connected) {
      sendData(input + '\r\n');
      setInput('');
    }
  };

  // Auto-scroll to bottom when new data arrives
  useEffect(() => {
    if (outputRef.current && activeConnection?.data) {
      // Force scroll to bottom
      const scrollElement = outputRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
      
      // Also try scrolling the parent scroll area
      const scrollArea = scrollElement.closest('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [activeConnection?.data]);

  // Additional scroll trigger for any data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (outputRef.current && activeConnection?.data) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [activeConnection?.data?.length]);

  // Focus input when connection becomes active or modal opens
  useEffect(() => {
    if (activeConnection && inputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [activeConnection]);

  // Auto-focus when component mounts
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, []);

  // Expose connection method to parent components and handle pending connections
  useEffect(() => {
    // Make connectToHost available globally for terminal commands
    (window as any).telnetConnect = connectToHost;
    
    // Check for pending connection from terminal command
    const pendingConnection = (window as any).pendingTelnetConnection;
    if (pendingConnection && websocket && websocket.readyState === WebSocket.OPEN) {
      console.log('Connecting to pending telnet connection:', pendingConnection);
      connectToHost(pendingConnection.host, pendingConnection.port);
      (window as any).pendingTelnetConnection = null; // Clear pending connection
    }
  }, [connectToHost, websocket]);

  if (!activeConnection) {
    return (
      <div className="flex items-center justify-center h-full text-terminal-subtle">
        <div className="text-center">
          <Terminal className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No active telnet connection</p>
          <p className="text-sm mt-2">Use 'telnet &lt;host&gt; &lt;port&gt;' to connect</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-terminal-bg border-2 border-terminal-highlight">
      {/* Connection header */}
      <div className="flex items-center justify-between p-4 border-b border-terminal-subtle bg-terminal-bg/50 relative z-20">
        <div className="flex items-center space-x-2">
          {activeConnection.connected ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="text-terminal-text text-sm font-mono">
            {activeConnection.host}:{activeConnection.port}
          </span>
          {activeConnection.connected ? (
            <span className="text-green-400 text-xs">CONNECTED</span>
          ) : (
            <span className="text-red-400 text-xs">DISCONNECTED</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => disconnect(activeConnection.id)}
            size="sm"
            variant="outline"
            className="h-6 px-2 border-terminal-subtle hover:bg-red-900/20 text-xs"
            title="Disconnect from host"
          >
            <X className="w-3 h-3 mr-1" />
            Disconnect
          </Button>
          
          {onClose && (
            <Button
              onClick={onClose}
              size="sm"
              variant="outline"  
              className="h-6 px-2 border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight hover:text-terminal-bg text-xs"
              title="Exit telnet terminal"
            >
              <LogOut className="w-3 h-3 mr-1" />
              Exit
            </Button>
          )}
        </div>
      </div>

      {/* Terminal output */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div 
          ref={outputRef}
          className="p-6 font-mono text-base text-terminal-text whitespace-pre-wrap min-h-full relative z-10"
          style={{ lineHeight: '1.4' }}
        >
          {activeConnection.data.map((line, index) => (
            <div 
              key={`${activeConnection.id}-${index}`} 
              className="break-words"
              dangerouslySetInnerHTML={{ __html: line }}
            />
          ))}
          {/* Scroll anchor */}
          <div id="scroll-anchor" />
        </div>
      </ScrollArea>

      {/* Input area - ALWAYS VISIBLE */}
      <div 
        className="flex-shrink-0 min-h-[80px] p-6 border-t-4 border-terminal-highlight bg-green-900/20 shadow-2xl"
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0, 20, 0, 0.95)',
          borderTop: '4px solid #00FF41'
        }}
      >
        <div className="flex items-center space-x-4 bg-black/50 rounded-lg p-4 border-2 border-terminal-highlight">
          <span 
            className="text-terminal-highlight font-mono font-bold text-2xl animate-pulse" 
            style={{
              textShadow: '0 0 20px #00FF41, 0 0 40px #00FF41',
              fontSize: '2rem',
              lineHeight: '1'
            }}
          >
            $
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!activeConnection.connected}
            className="flex-1 bg-black border-2 border-terminal-highlight rounded-lg px-4 py-2 outline-none text-terminal-highlight font-mono text-lg focus:shadow-lg focus:shadow-green-500/50"
            style={{
              backgroundColor: '#000',
              color: '#00FF41',
              textShadow: '0 0 5px #00FF41'
            }}
            placeholder={activeConnection.connected ? ">>> TYPE COMMAND HERE <<<" : "CONNECTION NOT READY"}
            autoComplete="off"
            spellCheck={false}
            data-testid="telnet-input"
          />
          {activeConnection.connected && (
            <span className="text-terminal-highlight text-sm font-bold animate-pulse">
              READY
            </span>
          )}
        </div>
        <div className="text-center text-terminal-highlight text-xs mt-2 font-bold">
          TELNET COMMAND PROMPT - Enter: SEND | Ctrl-C: BREAK
        </div>
      </div>
    </div>
  );
}

export default TelnetClient;