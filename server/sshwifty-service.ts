import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SshwiftyService - A simple web-based SSH/Telnet client service
 * 
 * This service provides a web interface for SSH and Telnet connections
 * using xterm.js and node-pty for terminal emulation.
 */
export class SshwiftyService {
  private io: SocketIOServer | null = null;

  constructor(httpServer: any) {
    this.initialize(httpServer);
  }

  private initialize(httpServer: any) {
    // Setup Socket.IO for terminal connections
    this.io = new SocketIOServer(httpServer, {
      path: '/socket.io/sshwifty',
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
      console.log('Sshwifty terminal connection established');
      let terminalProcess: any = null;

      socket.on('create-terminal', (data: any) => {
        try {
          const { type, host, port, user } = data;
          
          if (type === 'telnet') {
            // Spawn telnet process
            terminalProcess = spawn('telnet', [host, port.toString()], {
              env: process.env
            });
          } else if (type === 'ssh') {
            // Spawn SSH process
            const sshArgs = ['-p', port.toString()];
            if (user) {
              sshArgs.push(`${user}@${host}`);
            } else {
              sshArgs.push(host);
            }
            terminalProcess = spawn('ssh', sshArgs, {
              env: process.env
            });
          }

          if (terminalProcess) {
            // Send terminal output to client
            terminalProcess.stdout.on('data', (data: Buffer) => {
              socket.emit('terminal-output', data.toString());
            });

            terminalProcess.stderr.on('data', (data: Buffer) => {
              socket.emit('terminal-output', data.toString());
            });

            terminalProcess.on('exit', (code: number) => {
              socket.emit('terminal-exit', { code });
              terminalProcess = null;
            });

            socket.emit('terminal-ready');
          }
        } catch (error) {
          console.error('Error creating terminal:', error);
          socket.emit('terminal-error', { message: 'Failed to create terminal' });
        }
      });

      socket.on('terminal-input', (data: string) => {
        if (terminalProcess && terminalProcess.stdin) {
          terminalProcess.stdin.write(data);
        }
      });

      socket.on('terminal-resize', (data: any) => {
        // Handle terminal resize if needed
        console.log('Terminal resize:', data);
      });

      socket.on('disconnect', () => {
        console.log('Sshwifty terminal disconnected');
        if (terminalProcess) {
          terminalProcess.kill();
          terminalProcess = null;
        }
      });
    });
  }

  // Serve Sshwifty static files and interface
  static setupStaticRoutes(app: express.Application) {
    // Serve a basic terminal interface
    app.get('/sshwifty', (req, res) => {
      const { host, port, user, type } = req.query;
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sshwifty Terminal - ${type || 'SSH/Telnet'} Client</title>
    <link rel="stylesheet" href="https://unpkg.com/@xterm/xterm@5.5.0/css/xterm.css" />
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            color: #00FF41;
            font-family: 'Courier New', monospace;
            overflow: hidden;
        }
        
        .header {
            background: #1a1a1a;
            color: #00FF41;
            padding: 10px 20px;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .connection-info {
            font-size: 14px;
        }
        
        .controls {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            background: #333;
            border: 1px solid #00FF41;
            color: #00FF41;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .btn:hover {
            background: #00FF41;
            color: #000;
        }
        
        #terminal-container {
            height: calc(100vh - 60px);
            padding: 10px;
        }
        
        #terminal {
            width: 100%;
            height: 100%;
        }
        
        .status {
            position: absolute;
            top: 70px;
            left: 20px;
            right: 20px;
            background: #1a1a1a;
            border: 1px solid #333;
            padding: 10px;
            border-radius: 4px;
            z-index: 1000;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="connection-info">
            <strong>Sshwifty Terminal</strong> - 
            ${type === 'ssh' ? 'SSH' : 'Telnet'} connection to 
            ${user ? user + '@' : ''}${host || 'localhost'}:${port || (type === 'ssh' ? '22' : '23')}
        </div>
        <div class="controls">
            <button class="btn" onclick="connect()">Connect</button>
            <button class="btn" onclick="disconnect()">Disconnect</button>
            <button class="btn" onclick="window.close()">Close</button>
        </div>
    </div>
    
    <div id="status" class="status">
        <div>Ready to connect. Click "Connect" to establish connection.</div>
    </div>
    
    <div id="terminal-container">
        <div id="terminal"></div>
    </div>

    <script src="https://unpkg.com/@xterm/xterm@5.5.0/lib/xterm.js"></script>
    <script src="https://unpkg.com/@xterm/addon-fit@0.10.0/lib/addon-fit.js"></script>
    <script src="https://unpkg.com/socket.io-client@4/dist/socket.io.js"></script>
    
    <script>
        let terminal;
        let socket;
        let connected = false;
        
        const urlParams = new URLSearchParams(window.location.search);
        const connectionConfig = {
            type: urlParams.get('type') || 'ssh',
            host: urlParams.get('host') || 'localhost',
            port: parseInt(urlParams.get('port')) || (urlParams.get('type') === 'telnet' ? 23 : 22),
            user: urlParams.get('user') || ''
        };
        
        function initializeTerminal() {
            terminal = new Terminal({
                theme: {
                    background: '#000000',
                    foreground: '#00FF41',
                    cursor: '#00FF41',
                    cursorAccent: '#000000',
                    selection: '#333333'
                },
                fontFamily: 'Courier New, monospace',
                fontSize: 14,
                cursorBlink: true
            });
            
            const fitAddon = new FitAddon.FitAddon();
            terminal.loadAddon(fitAddon);
            
            terminal.open(document.getElementById('terminal'));
            fitAddon.fit();
            
            window.addEventListener('resize', () => {
                fitAddon.fit();
            });
            
            terminal.onData((data) => {
                if (connected && socket) {
                    socket.emit('terminal-input', data);
                }
            });
            
            return fitAddon;
        }
        
        function showStatus(message, isError = false) {
            const status = document.getElementById('status');
            status.innerHTML = '<div>' + message + '</div>';
            status.classList.remove('hidden');
            
            if (!isError) {
                setTimeout(() => {
                    status.classList.add('hidden');
                }, 3000);
            }
        }
        
        function connect() {
            if (connected) {
                showStatus('Already connected', true);
                return;
            }
            
            showStatus('Connecting to ' + connectionConfig.host + ':' + connectionConfig.port + '...');
            
            socket = io(window.location.origin, {
                path: '/socket.io/sshwifty'
            });
            
            socket.on('connect', () => {
                socket.emit('create-terminal', connectionConfig);
            });
            
            socket.on('terminal-ready', () => {
                connected = true;
                showStatus('Connected successfully!');
                terminal.focus();
            });
            
            socket.on('terminal-output', (data) => {
                terminal.write(data);
            });
            
            socket.on('terminal-exit', (data) => {
                connected = false;
                showStatus('Connection closed (exit code: ' + data.code + ')', true);
            });
            
            socket.on('terminal-error', (data) => {
                showStatus('Error: ' + data.message, true);
            });
            
            socket.on('disconnect', () => {
                connected = false;
                showStatus('Disconnected from server', true);
            });
        }
        
        function disconnect() {
            if (socket) {
                socket.disconnect();
                connected = false;
                showStatus('Disconnected');
            }
        }
        
        // Initialize terminal on page load
        window.addEventListener('load', () => {
            const fitAddon = initializeTerminal();
            
            // Auto-connect if parameters are provided
            if (connectionConfig.host && connectionConfig.port) {
                setTimeout(connect, 500);
            }
        });
    </script>
</body>
</html>`;
      
      res.send(html);
    });

    console.log('Sshwifty terminal interface configured at /sshwifty');
  }

  // Helper methods for creating connections
  connectTelnet(host: string, port: number) {
    return {
      host,
      port,
      url: `/sshwifty?type=telnet&host=${encodeURIComponent(host)}&port=${port}`
    };
  }

  connectSSH(host: string, port: number, user?: string) {
    const userParam = user ? `&user=${encodeURIComponent(user)}` : '';
    return {
      host,
      port,
      user,
      url: `/sshwifty?type=ssh&host=${encodeURIComponent(host)}&port=${port}${userParam}`
    };
  }
}