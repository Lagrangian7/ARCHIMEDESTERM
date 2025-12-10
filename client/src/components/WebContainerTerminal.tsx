import { useEffect, useRef, useState, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Play, Square, RefreshCw, Terminal as TerminalIcon, Globe, Loader2 } from 'lucide-react';

interface WebContainerTerminalProps {
  files: Record<string, { file: { contents: string } } | { directory: Record<string, any> }>;
  onPreviewUrl?: (url: string) => void;
  className?: string;
}

type ContainerStatus = 'idle' | 'booting' | 'ready' | 'running' | 'error';

export function WebContainerTerminal({ files, onPreviewUrl, className = '' }: WebContainerTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const webcontainerInstance = useRef<WebContainer | null>(null);
  const shellProcess = useRef<any>(null);

  const [status, setStatus] = useState<ContainerStatus>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const writeToTerminal = useCallback((text: string) => {
    if (terminalInstance.current) {
      terminalInstance.current.write(text);
    }
  }, []);

  const waitForCrossOriginIsolation = useCallback(async (maxWaitMs: number = 5000): Promise<boolean> => {
    if (window.crossOriginIsolated) {
      return true;
    }

    writeToTerminal('\x1b[33m⏳ Waiting for Cross-Origin Isolation...\x1b[0m\r\n');

    const startTime = Date.now();
    const pollInterval = 200;
    const swTimeout = 1500; // Max time to wait for service worker

    // Wait for service worker with timeout
    if ('serviceWorker' in navigator) {
      try {
        const swReady = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Service worker timeout')), swTimeout)
        );
        await Promise.race([swReady, timeoutPromise]);
        writeToTerminal('\x1b[36mℹ️ Service worker ready\x1b[0m\r\n');
      } catch (e) {
        writeToTerminal('\x1b[33m⚠ Service worker not available (continuing)\x1b[0m\r\n');
      }
    }

    // Poll for crossOriginIsolated to become true
    return new Promise((resolve) => {
      const poll = () => {
        if (window.crossOriginIsolated) {
          writeToTerminal('\x1b[32m✓ Cross-Origin Isolation enabled!\x1b[0m\r\n');
          resolve(true);
          return;
        }

        if (Date.now() - startTime >= maxWaitMs) {
          writeToTerminal('\x1b[33m⚠ Cross-Origin Isolation timeout - proceeding anyway\x1b[0m\r\n');
          resolve(false);
          return;
        }

        setTimeout(poll, pollInterval);
      };
      poll();
    });
  }, [writeToTerminal]);

  const bootWebContainer = useCallback(async () => {
    if (webcontainerInstance.current) {
      return webcontainerInstance.current;
    }

    setStatus('booting');
    setError(null);
    writeToTerminal('\x1b[33m⏳ Booting WebContainer...\x1b[0m\r\n');

    // Wait for COI to be established (via service worker or headers)
    const isIsolated = await waitForCrossOriginIsolation(3000);

    writeToTerminal('\x1b[36mℹ️ Cross-Origin Isolation: ' + (window.crossOriginIsolated ? 'Enabled ✓' : 'Disabled ✗') + '\x1b[0m\r\n');

    if (!isIsolated && !window.crossOriginIsolated) {
      writeToTerminal('\x1b[33m⚠ Warning: Cross-Origin Isolation not available.\x1b[0m\r\n');
      writeToTerminal('\x1b[33m  WebContainer requires SharedArrayBuffer which needs COI.\x1b[0m\r\n');
      writeToTerminal('\x1b[33m💡 Tip: Try opening the app in a new browser tab and hard refresh\x1b[0m\r\n');
      console.warn('WebContainer may not work without crossOriginIsolated:', {
        crossOriginIsolated: window.crossOriginIsolated,
        SharedArrayBuffer: typeof SharedArrayBuffer
      });
    }

    try {
      const instance = await WebContainer.boot();
      webcontainerInstance.current = instance;

      instance.on('server-ready', (port, url) => {
        writeToTerminal(`\x1b[32m🌐 Server ready at ${url}\x1b[0m\r\n`);
        setPreviewUrl(url);
        onPreviewUrl?.(url);
      });

      instance.on('error', (err) => {
        writeToTerminal(`\x1b[31m❌ Error: ${err.message}\x1b[0m\r\n`);
        setError(err.message);
      });

      writeToTerminal('\x1b[32m✅ WebContainer ready!\x1b[0m\r\n');
      setStatus('ready');
      return instance;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to boot WebContainer';
      writeToTerminal(`\x1b[31m❌ ${errorMsg}\x1b[0m\r\n`);

      // Check if this is likely a COI issue
      if (!window.crossOriginIsolated && (errorMsg.includes('SharedArrayBuffer') || errorMsg.includes('cross-origin'))) {
        writeToTerminal('\x1b[33m\r\n💡 This error is likely due to missing Cross-Origin Isolation.\x1b[0m\r\n');
        writeToTerminal('\x1b[33m   Try opening the app in a new browser tab and hard refreshing.\x1b[0m\r\n');
      }

      setError(errorMsg);
      setStatus('error');
      return null;
    }
  }, [writeToTerminal, onPreviewUrl, waitForCrossOriginIsolation]);

  const mountFiles = useCallback(async () => {
    const instance = webcontainerInstance.current;
    if (!instance) return;

    writeToTerminal('\x1b[33m📁 Mounting files...\x1b[0m\r\n');
    await instance.mount(files);
    writeToTerminal('\x1b[32m✅ Files mounted!\x1b[0m\r\n');
  }, [files, writeToTerminal]);

  const startShell = useCallback(async () => {
    const instance = webcontainerInstance.current;
    if (!instance || !terminalInstance.current) return;

    const shell = await instance.spawn('jsh', {
      terminal: {
        cols: terminalInstance.current.cols,
        rows: terminalInstance.current.rows,
      },
    });

    shellProcess.current = shell;

    shell.output.pipeTo(
      new WritableStream({
        write(data) {
          terminalInstance.current?.write(data);
        },
      })
    );

    const input = shell.input.getWriter();
    terminalInstance.current.onData((data) => {
      input.write(data);
    });

    return shell;
  }, []);

  const runCommand = useCallback(async (command: string, args: string[] = []) => {
    const instance = webcontainerInstance.current;
    if (!instance) {
      writeToTerminal('\x1b[31m❌ WebContainer not ready\x1b[0m\r\n');
      return;
    }

    setStatus('running');
    writeToTerminal(`\x1b[36m$ ${command} ${args.join(' ')}\x1b[0m\r\n`);

    try {
      const process = await instance.spawn(command, args);

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            terminalInstance.current?.write(data);
          },
        })
      );

      const exitCode = await process.exit;

      if (exitCode !== 0) {
        writeToTerminal(`\x1b[31mProcess exited with code ${exitCode}\x1b[0m\r\n`);
      }

      setStatus('ready');
      return exitCode;
    } catch (err: any) {
      writeToTerminal(`\x1b[31m❌ ${err.message}\x1b[0m\r\n`);
      setStatus('ready');
      throw err;
    }
  }, [writeToTerminal]);

  const installDependencies = useCallback(async () => {
    await runCommand('npm', ['install']);
  }, [runCommand]);

  const runDevServer = useCallback(async () => {
    await runCommand('npm', ['run', 'dev']);
  }, [runCommand]);

  const initialize = useCallback(async () => {
    try {
      await bootWebContainer();
      await mountFiles();
      await startShell();
    } catch (err) {
      console.error('WebContainer initialization failed:', err);
    }
  }, [bootWebContainer, mountFiles, startShell]);

  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
      theme: {
        background: '#0d1117',
        foreground: '#00ff41',
        cursor: '#00ff41',
        cursorAccent: '#0d1117',
        black: '#0d1117',
        red: '#ff5555',
        green: '#00ff41',
        yellow: '#ffb86c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#44475a',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
    });

    const fit = new FitAddon();
    fitAddon.current = fit;
    terminal.loadAddon(fit);
    terminal.open(terminalRef.current);
    fit.fit();

    terminalInstance.current = terminal;

    terminal.writeln('\x1b[32m╔══════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[32m║   WebContainer Terminal (Node.js)    ║\x1b[0m');
    terminal.writeln('\x1b[32m╚══════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');

    // Check cross-origin isolation status
    if (window.crossOriginIsolated) {
      terminal.writeln('\x1b[32m✓ Cross-Origin Isolation: ENABLED\x1b[0m');
      terminal.writeln('Click "Boot" to start the in-browser Node.js environment.');
    } else {
      terminal.writeln('\x1b[33m⚠ Cross-Origin Isolation: DISABLED\x1b[0m');
      terminal.writeln('');
      terminal.writeln('\x1b[36mWebContainer requires SharedArrayBuffer which needs');
      terminal.writeln('Cross-Origin Isolation headers (COOP/COEP).\x1b[0m');
      terminal.writeln('');
      terminal.writeln('\x1b[33mTo enable, try:\x1b[0m');
      terminal.writeln('  1. Hard refresh: Ctrl+Shift+R (Win) or Cmd+Shift+R (Mac)');
      terminal.writeln('  2. Open the app in a new browser tab directly');
      terminal.writeln('  3. Use Chrome/Edge for best compatibility');
      terminal.writeln('');
      terminal.writeln('\x1b[90mNote: Some hosting environments may not support');
      terminal.writeln('the required security headers for WebContainer.\x1b[0m');
    }
    terminal.writeln('');

    const handleResize = () => {
      fit.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      terminalInstance.current = null;

      // Cleanup WebContainer resources (fire and forget with error handling)
      const cleanup = async () => {
        try {
          if (shellProcess.current?.kill) {
            await shellProcess.current.kill();
          }
        } catch (e) {
          console.warn('Error killing shell process:', e);
        } finally {
          shellProcess.current = null;
        }

        try {
          if (webcontainerInstance.current?.teardown) {
            await webcontainerInstance.current.teardown();
          }
        } catch (e) {
          console.warn('Error tearing down WebContainer:', e);
        } finally {
          webcontainerInstance.current = null;
        }
      };
      cleanup().catch(console.warn);
    };
  }, []);

  useEffect(() => {
    if (Object.keys(files).length > 0 && webcontainerInstance.current) {
      mountFiles();
    }
  }, [files, mountFiles]);

  const handleBoot = async () => {
    await initialize();
  };

  const handleStop = async () => {
    try {
      if (shellProcess.current?.kill) {
        await shellProcess.current.kill();
      }
    } catch (e) {
      console.warn('Error stopping process:', e);
    } finally {
      shellProcess.current = null;
    }
    setStatus('ready');
    writeToTerminal('\r\n\x1b[33m⏹ Process stopped\x1b[0m\r\n');
  };

  const handleRestart = async () => {
    await handleStop();
    await mountFiles();
    await installDependencies();
    await runDevServer();
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center gap-2 p-2 bg-[#161b22] border-b border-[#30363d]">
        <TerminalIcon className="w-4 h-4 text-[#00ff41]" />
        <span className="text-sm text-[#00ff41] font-mono">WebContainer</span>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          {(status === 'idle' || status === 'error') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBoot}
                className="h-7 text-xs border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41]/10"
              >
                <Play className="w-3 h-3 mr-1" />
                Boot
              </Button>
              <span className={`text-xs font-mono ${window.crossOriginIsolated ? 'text-green-400' : 'text-yellow-400'}`}>
                {window.crossOriginIsolated ? '✓ Isolated' : '⚠ Not Isolated'}
              </span>
            </>
          )}

          {status === 'booting' && (
            <Button size="sm" variant="outline" disabled className="h-7 text-xs">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Booting...
            </Button>
          )}

          {(status === 'ready' || status === 'running') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={installDependencies}
                disabled={status === 'running'}
                className="h-7 text-xs border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41]/10"
              >
                npm install
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={runDevServer}
                disabled={status === 'running'}
                className="h-7 text-xs border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41]/10"
              >
                <Play className="w-3 h-3 mr-1" />
                Run
              </Button>
              {status === 'running' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStop}
                  className="h-7 text-xs border-red-500 text-red-500 hover:bg-red-500/10"
                >
                  <Square className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRestart}
                disabled={status === 'running'}
                className="h-7 text-xs border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41]/10"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </>
          )}

          {previewUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(previewUrl, '_blank')}
              className="h-7 text-xs border-blue-500 text-blue-500 hover:bg-blue-500/10"
            >
              <Globe className="w-3 h-3 mr-1" />
              Preview
            </Button>
          )}
        </div>
      </div>

      <div 
        ref={terminalRef} 
        className="flex-1 bg-[#0d1117] p-2 overflow-hidden"
        style={{ minHeight: '200px' }}
      />

      {error && (
        <div className="p-2 bg-red-900/20 border-t border-red-500/50 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

export function createNodeProjectFiles(indexContent: string): Record<string, any> {
  // Enhanced React project detection
  const isReactProject = indexContent.includes('import React') || 
                         indexContent.includes('from "react"') || 
                         indexContent.includes("from 'react'") ||
                         indexContent.includes('useState') ||
                         indexContent.includes('useEffect') ||
                         indexContent.includes('ReactDOM') ||
                         indexContent.includes('JSX') ||
                         /<[A-Z][a-zA-Z]*/.test(indexContent); // Detect JSX components

  // Detect TypeScript usage
  const isTypeScript = indexContent.includes(': React.') ||
                       indexContent.includes('interface ') ||
                       indexContent.includes('type ') ||
                       /\w+:\s*(string|number|boolean|any)/.test(indexContent);

  if (isReactProject) {
    const fileExt = isTypeScript ? 'tsx' : 'jsx';
    const mainExt = isTypeScript ? 'tsx' : 'jsx';
    
    // Create a complete Vite + React setup with proper structure
    return {
      'package.json': {
        file: {
          contents: `{
  "name": "react-webcontainer-app",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 3000",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0 --port 3000"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"${isTypeScript ? ',\n    "typescript": "^5.2.2"' : ''}
  }
}`
        }
      },
      'vite.config.js': {
        file: {
          contents: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  }
});`
        }
      },
      'index.html': {
        file: {
          contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App - WebContainer</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      #root {
        min-height: 100vh;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${mainExt}"></script>
  </body>
</html>`
        }
      },
      'src': {
        directory: {
          [`main.${mainExt}`]: {
            file: {
              contents: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')${isTypeScript ? '!' : ''}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
            }
          },
          [`App.${fileExt}`]: {
            file: {
              contents: indexContent.trim() || `import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>
        🚀 React in WebContainer
      </h1>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '2rem',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
          Count: {count}
        </p>
        <button
          onClick={() => setCount(count + 1)}
          style={{
            padding: '1rem 2rem',
            fontSize: '1rem',
            background: '#00ff41',
            color: '#000',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Increment
        </button>
      </div>
      <p style={{ marginTop: '2rem', opacity: 0.8 }}>
        Running React ${isTypeScript ? '+ TypeScript ' : ''}in your browser with WebContainer
      </p>
    </div>
  );
}

export default App;`
            }
          },
          'index.css': {
            file: {
              contents: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
}`
            }
          }
        }
      }
    };
  }

  // Enhanced Node.js/Express detection
  const isExpressProject = indexContent.includes('express') ||
                          indexContent.includes('app.listen') ||
                          indexContent.includes('http.createServer');

  if (isExpressProject) {
    return {
      'package.json': {
        file: {
          contents: `{
  "name": "express-webcontainer-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}`
        }
      },
      'index.js': {
        file: {
          contents: indexContent
        }
      }
    };
  }

  // Default Node.js project with better starter template
  return {
    'package.json': {
      file: {
        contents: `{
  "name": "node-webcontainer-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {}
}`
      }
    },
    'index.js': {
      file: {
        contents: indexContent || `// Node.js application running in WebContainer
console.log('✓ Node.js application started');
console.log('✓ Version:', process.version);
console.log('✓ Platform:', process.platform);

// Example: Create a simple HTTP server
import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Hello from WebContainer!</h1>');
});

server.listen(3000, '0.0.0.0', () => {
  console.log('✓ Server listening on http://localhost:3000');
});`
      }
    }
  };
}

export function createViteProjectFiles(htmlCode: string, jsCode: string, cssCode?: string): Record<string, any> {
  return {
    'index.html': {
      file: {
        contents: htmlCode || `<!DOCTYPE html>
<html>
<head>
  <title>WebContainer App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="main.js"></script>
</body>
</html>`,
      },
    },
    'main.js': {
      file: {
        contents: jsCode || `document.getElementById('app').innerHTML = '<h1>Hello WebContainer!</h1>';`,
      },
    },
    'style.css': {
      file: {
        contents: cssCode || `body { font-family: sans-serif; padding: 20px; }`,
      },
    },
    'package.json': {
      file: {
        contents: JSON.stringify({
          name: 'vite-project',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
          },
          devDependencies: {
            vite: '^5.0.0',
          },
        }, null, 2),
      },
    },
  };
}