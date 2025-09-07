import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, Wifi, WifiOff, X } from 'lucide-react';

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
}

export function TelnetClient({ onConnectionUpdate }: TelnetClientProps) {
  const [connections, setConnections] = useState<TelnetConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Basic ANSI code processing
  const processAnsiCodes = (text: string): string => {
    // Remove basic ANSI escape sequences for now
    // In a full implementation, we would convert these to HTML/CSS
    return text
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove color codes
      .replace(/\x1b\[[ABCD]/g, '') // Remove cursor movement
      .replace(/\x1b\[2J/g, '') // Remove clear screen
      .replace(/\x1b\[H/g, '') // Remove cursor home
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n');
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
    if (e.key === 'Enter' && input.trim() && activeConnection?.connected) {
      sendData(input + '\r\n');
      setInput('');
    }
  };

  // Auto-scroll to bottom when new data arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [activeConnection?.data]);

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
    <div className="flex flex-col h-full bg-terminal-bg">
      {/* Connection header */}
      <div className="flex items-center justify-between p-2 border-b border-terminal-subtle bg-terminal-bg/50">
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
        
        <Button
          onClick={() => disconnect(activeConnection.id)}
          size="sm"
          variant="outline"
          className="h-6 w-6 p-0 border-terminal-subtle hover:bg-red-900/20"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Terminal output */}
      <ScrollArea className="flex-1">
        <div 
          ref={outputRef}
          className="p-4 font-mono text-sm text-terminal-text whitespace-pre-wrap"
          style={{ lineHeight: '1.2' }}
        >
          {activeConnection.data.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-2 border-t border-terminal-subtle bg-terminal-bg">
        <div className="flex items-center space-x-2">
          <span className="text-terminal-highlight font-mono text-sm">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!activeConnection.connected}
            className="flex-1 bg-transparent border-none outline-none text-terminal-text font-mono text-sm focus:ring-0"
            placeholder={activeConnection.connected ? "Type command and press Enter..." : "Connection not ready"}
            autoComplete="off"
            spellCheck={false}
            data-testid="telnet-input"
          />
          {activeConnection.connected && (
            <span className="text-terminal-subtle text-xs">Press Enter to send</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default TelnetClient;