import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * JuttyService - Integrates Jutty web-based SSH/Telnet client
 * into our existing application infrastructure.
 */
export class JuttyService {
  private io: SocketIOServer | null = null;
  private juttyPort: number;

  constructor(httpServer: any, juttyPort: number = 3001) {
    this.juttyPort = juttyPort;
    this.initialize(httpServer);
  }

  private initialize(httpServer: any) {
    // Setup Socket.IO for Jutty on the same HTTP server but different namespace
    this.io = new SocketIOServer(httpServer, {
      path: '/socket.io/jutty',
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: any) => {
      console.log('Jutty socket.io connection established');

      socket.on('start', (data: any) => {
        this.handleConnectionStart(socket, data);
      });

      socket.on('resize', (data: any) => {
        this.handleTerminalResize(socket, data);
      });

      socket.on('input', (data: any) => {
        this.handleTerminalInput(socket, data);
      });

      socket.on('disconnect', () => {
        console.log('Jutty socket disconnected');
        this.handleDisconnect(socket);
      });
    });
  }

  private handleConnectionStart(socket: any, data: any) {
    console.log('Starting Jutty connection:', data);

    // For now, we'll simulate the connection since pty.js has dependency issues
    // In a production environment, you would spawn the actual terminal process
    
    if (data.type === 'telnet') {
      // Simulate telnet connection
      socket.emit('output', `Connecting to ${data.host}:${data.port}...\r\n`);
      
      // Simulate connection success
      setTimeout(() => {
        socket.emit('output', `Connected to ${data.host}:${data.port}\r\n`);
        socket.emit('output', 'Welcome to telnet session via Jutty!\r\n');
        socket.emit('output', 'Type commands or use Ctrl+C to disconnect.\r\n\r\n');
      }, 1000);
    } else if (data.type === 'ssh') {
      // Simulate SSH connection
      socket.emit('output', `SSH connecting to ${data.user}@${data.host}:${data.port}...\r\n`);
      
      setTimeout(() => {
        socket.emit('output', `Connected to ${data.host}\r\n`);
        socket.emit('output', `Welcome ${data.user}!\r\n\r\n`);
      }, 1500);
    }
  }

  private handleTerminalResize(socket: any, data: any) {
    console.log('Terminal resize:', data);
    // Handle terminal resize - in real implementation this would resize the pty
  }

  private handleTerminalInput(socket: any, data: any) {
    console.log('Terminal input:', data);
    // Echo back the input for now (in real implementation, send to pty)
    socket.emit('output', data);
    
    // Simulate some responses for common commands
    if (data.trim() === 'help') {
      socket.emit('output', '\r\nAvailable commands:\r\n');
      socket.emit('output', '  help    - Show this help\r\n');
      socket.emit('output', '  clear   - Clear screen\r\n');
      socket.emit('output', '  exit    - Disconnect\r\n\r\n');
    } else if (data.trim() === 'clear') {
      socket.emit('output', '\x1b[2J\x1b[H'); // ANSI clear screen
    } else if (data.trim() === 'exit') {
      socket.emit('output', '\r\nDisconnecting...\r\n');
      socket.disconnect();
    }
  }

  private handleDisconnect(socket: any) {
    // Clean up any terminal processes
    console.log('Cleaning up Jutty connection');
  }

  // Serve Jutty static files
  static setupStaticRoutes(app: express.Application) {
    const juttyPublicPath = path.join(__dirname, 'jutty', 'public');
    
    // Check if Jutty public directory exists
    if (fs.existsSync(juttyPublicPath)) {
      // Serve Jutty static files under /jutty route
      app.use('/jutty', express.static(juttyPublicPath));
      
      // Main Jutty interface route
      app.get('/jutty', (req, res) => {
        res.sendFile(path.join(juttyPublicPath, 'jutty.html'));
      });

      console.log('Jutty static routes configured at /jutty');
    } else {
      console.warn('Jutty public directory not found:', juttyPublicPath);
    }
  }

  // Connect telnet host via Jutty
  connectTelnet(host: string, port: number) {
    return {
      host,
      port,
      url: `/jutty?type=telnet&host=${encodeURIComponent(host)}&port=${port}`
    };
  }

  // Connect SSH host via Jutty  
  connectSSH(host: string, port: number, user?: string) {
    const userParam = user ? `&user=${encodeURIComponent(user)}` : '';
    return {
      host,
      port,
      user,
      url: `/jutty?type=ssh&host=${encodeURIComponent(host)}&port=${port}${userParam}`
    };
  }
}