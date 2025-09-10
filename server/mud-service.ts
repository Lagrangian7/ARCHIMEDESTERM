import { WebSocket } from 'ws';
import { Socket } from 'net';
import { EventEmitter } from 'events';
import { promises as dns } from 'dns';

interface MudConnection {
  websocket: WebSocket;
  tcpSocket: Socket | null;
  host: string;
  port: number;
  sessionId: string;
  isConnected: boolean;
  bytesReceived: number;
  bytesSent: number;
  lastActivity: Date;
}

export class MudService extends EventEmitter {
  private connections: Map<string, MudConnection> = new Map();
  private connectionTimeout = 30000; // 30 seconds
  private idleTimeout = 300000; // 5 minutes

  constructor() {
    super();
    // Clean up idle connections periodically
    setInterval(() => this.cleanupIdleConnections(), 60000); // Check every minute
  }

  // Create a new MUD connection via WebSocket proxy
  async createConnection(
    websocket: WebSocket, 
    host: string, 
    port: number, 
    sessionId: string
  ): Promise<void> {
    // Security: Validate host and port
    const hostValidation = await this.isValidHost(host);
    if (!hostValidation.valid || !this.isValidPort(port)) {
      websocket.close(1002, 'Invalid host or port');
      return;
    }

    const connection: MudConnection = {
      websocket,
      tcpSocket: null,
      host,
      port,
      sessionId,
      isConnected: false,
      bytesReceived: 0,
      bytesSent: 0,
      lastActivity: new Date()
    };

    this.connections.set(sessionId, connection);

    try {
      // Create TCP connection to MUD server
      const tcpSocket = new Socket();
      connection.tcpSocket = tcpSocket;

      // Set up connection timeout
      const timeout = setTimeout(() => {
        if (!connection.isConnected) {
          this.closeConnection(sessionId, 'Connection timeout');
        }
      }, this.connectionTimeout);

      // TCP socket event handlers
      tcpSocket.on('connect', () => {
        clearTimeout(timeout);
        connection.isConnected = true;
        connection.lastActivity = new Date();
        
        // Send connection success message to WebSocket
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({
            type: 'connected',
            host,
            port,
            sessionId
          }));
        }

        this.emit('connected', { sessionId, host, port });
      });

      tcpSocket.on('data', (data: Buffer) => {
        connection.bytesReceived += data.length;
        connection.lastActivity = new Date();

        // Process telnet IAC commands if needed
        const processedData = this.processTelnetIAC(data);

        // Forward data to WebSocket client
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(processedData);
        }

        this.emit('data', { sessionId, data: processedData });
      });

      tcpSocket.on('error', (error) => {
        console.error(`TCP socket error for ${sessionId}:`, error);
        this.closeConnection(sessionId, `TCP error: ${error.message}`);
      });

      tcpSocket.on('close', () => {
        console.log(`TCP connection closed for ${sessionId}`);
        this.closeConnection(sessionId, 'Server disconnected');
      });

      // WebSocket event handlers
      websocket.on('message', (data: Buffer) => {
        if (tcpSocket && connection.isConnected) {
          connection.bytesSent += data.length;
          connection.lastActivity = new Date();
          
          // Send data to MUD server
          tcpSocket.write(data);
          
          this.emit('command', { sessionId, data: data.toString() });
        }
      });

      websocket.on('close', () => {
        console.log(`WebSocket closed for ${sessionId}`);
        this.closeConnection(sessionId, 'Client disconnected');
      });

      websocket.on('error', (error) => {
        console.error(`WebSocket error for ${sessionId}:`, error);
        this.closeConnection(sessionId, `WebSocket error: ${error.message}`);
      });

      // Attempt TCP connection using resolved IP to prevent TOCTOU
      const connectTarget = hostValidation.resolvedIp || host;
      tcpSocket.connect(port, connectTarget);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to create connection for ${sessionId}:`, error);
      this.closeConnection(sessionId, `Connection failed: ${errorMessage}`);
    }
  }

  // Close a specific connection
  closeConnection(sessionId: string, reason?: string): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    // Close TCP socket
    if (connection.tcpSocket) {
      connection.tcpSocket.destroy();
    }

    // Close WebSocket with reason
    if (connection.websocket.readyState === WebSocket.OPEN) {
      connection.websocket.close(1000, reason || 'Connection closed');
    }

    // Remove from connections map
    this.connections.delete(sessionId);

    this.emit('disconnected', { 
      sessionId, 
      reason,
      bytesReceived: connection.bytesReceived,
      bytesSent: connection.bytesSent
    });
  }

  // Get connection statistics
  getConnectionStats(sessionId: string): MudConnection | null {
    return this.connections.get(sessionId) || null;
  }

  // Get all active connections
  getActiveConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  // Basic telnet IAC (Interpret As Command) processing
  private processTelnetIAC(data: Buffer): Buffer {
    // This is a simplified IAC processor
    // In a full implementation, you'd handle WILL/WONT/DO/DONT negotiations
    
    const result: number[] = [];
    let i = 0;

    while (i < data.length) {
      if (data[i] === 255) { // IAC byte
        if (i + 1 < data.length) {
          const command = data[i + 1];
          
          if (command >= 251 && command <= 254) { // WILL, WONT, DO, DONT
            if (i + 2 < data.length) {
              // Skip the 3-byte IAC sequence
              i += 3;
              continue;
            }
          } else if (command === 255) { // Escaped IAC
            result.push(255);
            i += 2;
            continue;
          }
        }
        
        // For other IAC commands, skip them for now
        i += 2;
      } else {
        result.push(data[i]);
        i++;
      }
    }

    return Buffer.from(result);
  }

  // Security: Validate host and resolve DNS to prevent SSRF attacks
  private async isValidHost(host: string): Promise<{ valid: boolean; resolvedIp?: string }> {
    try {
      // First check hostname patterns
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./, // Link-local
        /^::1$/, // IPv6 localhost
        /^fc00:/, // IPv6 private
        /^fd00:/, // IPv6 private
      ];

      if (blockedPatterns.some(pattern => pattern.test(host))) {
        return { valid: false };
      }

      // Resolve DNS to get IP addresses
      const lookupResult = await dns.lookup(host, { all: true });
      const addresses = Array.isArray(lookupResult) ? lookupResult : [lookupResult];

      // Check each resolved IP address
      for (const addr of addresses) {
        const ip = addr.address;
        
        // Check IPv4 private ranges
        if (this.isPrivateIPv4(ip)) {
          return { valid: false };
        }
        
        // Check IPv6 private ranges
        if (this.isPrivateIPv6(ip)) {
          return { valid: false };
        }
      }

      // Return the first valid IP for connection
      return { valid: true, resolvedIp: addresses[0].address };
    } catch (error) {
      console.error(`DNS lookup failed for ${host}:`, error);
      return { valid: false };
    }
  }

  private isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => p < 0 || p > 255)) {
      return false; // Invalid IPv4
    }

    // Check private ranges
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 127) return true; // 127.0.0.0/8 (loopback)
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (link-local)
    
    return false;
  }

  private isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    
    // IPv6 private/link-local ranges
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fc00:')) return true; // unique local
    if (lower.startsWith('fd00:')) return true; // unique local
    if (lower.startsWith('fe80:')) return true; // link-local
    if (lower.startsWith('ff00:')) return true; // multicast
    
    return false;
  }

  // Security: Validate port range
  private isValidPort(port: number): boolean {
    // Allow only standard MUD ports and some common alternatives
    const allowedPorts = [
      23,    // Standard telnet
      4000,  // Common MUD port
      4001,  // Common MUD port
      4002,  // Common MUD port
      4003,  // Common MUD port
      4004,  // Common MUD port
      4005,  // Common MUD port
      6000,  // Common MUD port
      6001,  // Common MUD port
      6666,  // Common MUD port
      7777,  // Common MUD port
      8080,  // Alternative HTTP port used by some MUDs
      8888,  // Alternative port
      9999,  // Alternative port
    ];

    return allowedPorts.includes(port);
  }

  // Clean up connections that have been idle too long
  private cleanupIdleConnections(): void {
    const now = new Date();
    
    this.connections.forEach((connection, sessionId) => {
      const idleTime = now.getTime() - connection.lastActivity.getTime();
      
      if (idleTime > this.idleTimeout) {
        console.log(`Closing idle connection ${sessionId} after ${idleTime}ms`);
        this.closeConnection(sessionId, 'Idle timeout');
      }
    });
  }

  // Graceful shutdown
  shutdown(): void {
    console.log('Shutting down MUD service...');
    
    // Close all active connections
    Array.from(this.connections.keys()).forEach(sessionId => {
      this.closeConnection(sessionId, 'Service shutdown');
    });
    
    this.removeAllListeners();
  }
}

// Export singleton instance
export const mudService = new MudService();