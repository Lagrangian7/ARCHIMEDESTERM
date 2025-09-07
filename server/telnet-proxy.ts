import WebSocket from 'ws';
import { createConnection, Socket } from 'net';
import { IncomingMessage } from 'http';

interface TelnetConnection {
  id: string;
  socket: Socket;
  websocket: WebSocket;
  host: string;
  port: number;
  startTime: Date;
}

export class TelnetProxyService {
  private connections = new Map<string, TelnetConnection>();
  private connectionCounter = 0;

  constructor(private wss: WebSocket.Server) {
    this.wss.on('connection', this.handleWebSocketConnection.bind(this));
  }

  private handleWebSocketConnection(ws: WebSocket, req: IncomingMessage) {
    console.log('New WebSocket connection for telnet proxy');
    
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        this.handleWebSocketMessage(ws, message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format' 
        }));
      }
    });

    ws.on('close', () => {
      this.closeConnectionsForWebSocket(ws);
    });
  }

  private handleWebSocketMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'connect':
        this.handleConnect(ws, message.host, message.port);
        break;
      case 'data':
        this.handleData(message.connectionId, message.data);
        break;
      case 'disconnect':
        this.handleDisconnect(message.connectionId);
        break;
      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Unknown message type' 
        }));
    }
  }

  private async handleConnect(ws: WebSocket, host: string, port: number) {
    const connectionId = `telnet_${++this.connectionCounter}`;
    
    console.log(`Attempting telnet connection to ${host}:${port}`);

    try {
      // Validate host and port
      if (!this.isValidHost(host) || !this.isValidPort(port)) {
        throw new Error('Invalid host or port');
      }

      // Create TCP connection
      const socket = createConnection({
        host,
        port,
        timeout: 10000 // 10 second timeout
      });

      const connection: TelnetConnection = {
        id: connectionId,
        socket,
        websocket: ws,
        host,
        port,
        startTime: new Date()
      };

      this.connections.set(connectionId, connection);

      socket.on('connect', () => {
        console.log(`Connected to ${host}:${port}`);
        ws.send(JSON.stringify({
          type: 'connected',
          connectionId,
          host,
          port,
          message: `Connected to ${host}:${port}`
        }));
      });

      socket.on('data', (data: Buffer) => {
        // Send raw telnet data to WebSocket
        ws.send(JSON.stringify({
          type: 'data',
          connectionId,
          data: data.toString('utf8')
        }));
      });

      socket.on('error', (error: Error) => {
        console.error(`Telnet connection error: ${error.message}`);
        ws.send(JSON.stringify({
          type: 'error',
          connectionId,
          message: `Connection error: ${error.message}`
        }));
        this.connections.delete(connectionId);
      });

      socket.on('close', () => {
        console.log(`Telnet connection closed: ${host}:${port}`);
        ws.send(JSON.stringify({
          type: 'disconnected',
          connectionId,
          message: `Disconnected from ${host}:${port}`
        }));
        this.connections.delete(connectionId);
      });

    } catch (error: any) {
      console.error('Failed to create telnet connection:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to connect to ${host}:${port}: ${error.message}`
      }));
    }
  }

  private handleData(connectionId: string, data: string) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.socket.writable) {
      // Send data to telnet server
      connection.socket.write(data);
    }
  }

  private handleDisconnect(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.socket.destroy();
      this.connections.delete(connectionId);
      console.log(`Manually disconnected from ${connection.host}:${connection.port}`);
    }
  }

  private closeConnectionsForWebSocket(ws: WebSocket) {
    // Close all telnet connections for this WebSocket
    for (const [connectionId, connection] of this.connections) {
      if (connection.websocket === ws) {
        connection.socket.destroy();
        this.connections.delete(connectionId);
      }
    }
  }

  private isValidHost(host: string): boolean {
    // Basic host validation
    if (!host || typeof host !== 'string' || host.length > 255) {
      return false;
    }
    
    // Allow hostnames and IP addresses
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    return hostnameRegex.test(host) || ipRegex.test(host);
  }

  private isValidPort(port: number): boolean {
    return Number.isInteger(port) && port > 0 && port <= 65535;
  }

  getConnectionStats() {
    return {
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        host: conn.host,
        port: conn.port,
        startTime: conn.startTime,
        duration: Date.now() - conn.startTime.getTime()
      }))
    };
  }
}