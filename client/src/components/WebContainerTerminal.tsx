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

  

  const bootWebContainer = useCallback(async () => {
    if (webcontainerInstance.current) {
      return webcontainerInstance.current;
    }

    setStatus('booting');
    setError(null);
    writeToTerminal('\x1b[33m⏳ Booting WebContainer...\x1b[0m\r\n');
    
    // Check COI status immediately
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    const isCrossOriginIsolated = window.crossOriginIsolated === true;
    
    writeToTerminal('\x1b[36mℹ️ Cross-Origin Isolation: ' + (isCrossOriginIsolated ? 'Enabled ✓' : 'Disabled ✗') + '\x1b[0m\r\n');
    writeToTerminal('\x1b[36mℹ️ SharedArrayBuffer: ' + (hasSharedArrayBuffer ? 'Available ✓' : 'Unavailable ✗') + '\x1b[0m\r\n');

    if (!isCrossOriginIsolated || !hasSharedArrayBuffer) {
      writeToTerminal('\x1b[31m\r\n❌ WebContainer cannot start without Cross-Origin Isolation.\x1b[0m\r\n');
      writeToTerminal('\x1b[33m\r\n📋 How to enable COI on Replit:\x1b[0m\r\n');
      writeToTerminal('\x1b[36m   1. The app needs proper COOP/COEP headers set by the server\x1b[0m\r\n');
      writeToTerminal('\x1b[36m   2. Current workaround: Use Code Playground instead\x1b[0m\r\n');
      writeToTerminal('\x1b[36m   3. Alternative: Run Node.js code in Python IDE (uses server-side execution)\x1b[0m\r\n');
      writeToTerminal('\x1b[33m\r\n💡 Note: WebContainer needs browser-level security features that\x1b[0m\r\n');
      writeToTerminal('\x1b[33m   may not work in all Replit deployment configurations.\x1b[0m\r\n');
      
      setError('Cross-Origin Isolation not available - WebContainer requires COOP/COEP headers');
      setStatus('error');
      return null;
    }

    // Wait a bit for service worker to activate
    await new Promise(resolve => setTimeout(resolve, 500));

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
      writeToTerminal('\x1b[33m\r\n💡 Try using Code Playground for JavaScript/TypeScript instead.\x1b[0m\r\n');
      
      setError(errorMsg);
      setStatus('error');
      return null;
    }
  }, [writeToTerminal, onPreviewUrl]);

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
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    const isCrossOriginIsolated = window.crossOriginIsolated === true;
    
    if (isCrossOriginIsolated && hasSharedArrayBuffer) {
      terminal.writeln('\x1b[32m✓ Cross-Origin Isolation: ENABLED\x1b[0m');
      terminal.writeln('\x1b[32m✓ SharedArrayBuffer: AVAILABLE\x1b[0m');
      terminal.writeln('');
      terminal.writeln('Click "Boot" to start the in-browser Node.js environment.');
    } else {
      terminal.writeln('\x1b[33m⚠ Cross-Origin Isolation: ' + (isCrossOriginIsolated ? 'ENABLED' : 'DISABLED') + '\x1b[0m');
      terminal.writeln('\x1b[33m⚠ SharedArrayBuffer: ' + (hasSharedArrayBuffer ? 'AVAILABLE' : 'UNAVAILABLE') + '\x1b[0m');
      terminal.writeln('');
      terminal.writeln('\x1b[36mWebContainer requires both COI and SharedArrayBuffer.\x1b[0m');
      terminal.writeln('');
      terminal.writeln('\x1b[33m💡 Alternative options on Replit:\x1b[0m');
      terminal.writeln('  • Use Code Playground (supports 15+ languages)');
      terminal.writeln('  • Use Workshop IDE for Python/JavaScript execution');
      terminal.writeln('  • Both support real-time execution without COI');
      terminal.writeln('');
      terminal.writeln('\x1b[90mNote: WebContainer may not work on all Replit deployments');
      terminal.writeln('due to required COOP/COEP security headers.\x1b[0m');
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

export function createNodeProjectFiles(code: string, packageJson?: object): Record<string, any> {
  const defaultPackageJson = {
    name: 'webcontainer-project',
    type: 'module',
    scripts: {
      dev: 'node index.js',
    },
    dependencies: {},
  };

  return {
    'index.js': {
      file: {
        contents: code,
      },
    },
    'package.json': {
      file: {
        contents: JSON.stringify(packageJson || defaultPackageJson, null, 2),
      },
    },
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
