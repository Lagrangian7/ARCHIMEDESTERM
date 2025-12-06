
import { useState, useEffect, useRef } from 'react';
import { X, Play, FolderTree, Terminal as TerminalIcon, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Editor from '@monaco-editor/react';

interface WebContainerIDEProps {
  onClose: () => void;
}

export function WebContainerIDE({ onClose }: WebContainerIDEProps) {
  const [isBooting, setIsBooting] = useState(true);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState('src/main.tsx');
  const [fileContent, setFileContent] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  
  const webcontainerRef = useRef<any>(null);
  const terminalRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Starter project files
  const starterFiles = {
    'package.json': {
      file: {
        contents: JSON.stringify({
          name: 'vite-react-starter',
          private: true,
          version: '0.0.0',
          type: 'module',
          scripts: {
            dev: 'vite --host 0.0.0.0',
            build: 'vite build',
            preview: 'vite preview'
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          devDependencies: {
            '@types/react': '^18.2.43',
            '@types/react-dom': '^18.2.17',
            '@vitejs/plugin-react': '^4.2.1',
            vite: '^5.0.8'
          }
        }, null, 2)
      }
    },
    'vite.config.js': {
      file: {
        contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})`
      }
    },
    'index.html': {
      file: {
        contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
      }
    },
    'src': {
      directory: {
        'main.tsx': {
          file: {
            contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
          }
        },
        'App.tsx': {
          file: {
            contents: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>WebContainer IDE</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to see live updates!
        </p>
      </div>
    </div>
  )
}

export default App`
          }
        },
        'App.css': {
          file: {
            contents: `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.card {
  padding: 2em;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}`
          }
        },
        'index.css': {
          file: {
            contents: `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}`
          }
        }
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initWebContainer() {
      try {
        // Load WebContainer API from CDN
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@webcontainer/api@1.1.9/dist/index.js';
        script.type = 'module';
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });

        // Wait for WebContainer to be available
        await new Promise(resolve => setTimeout(resolve, 500));

        // @ts-ignore
        const { WebContainer } = window;
        
        if (!WebContainer) {
          throw new Error('WebContainer not loaded');
        }

        // Boot WebContainer
        const webcontainerInstance = await WebContainer.boot();
        webcontainerRef.current = webcontainerInstance;

        // Mount files
        await webcontainerInstance.mount(starterFiles);

        // Get file list
        const fileList = await getFileList(webcontainerInstance, '');
        if (mounted) setFiles(fileList);

        // Load initial file
        const initialContent = await webcontainerInstance.fs.readFile('src/main.tsx', 'utf-8');
        if (mounted) setFileContent(initialContent);

        // Setup terminal
        if (terminalRef.current) {
          // Load xterm from CDN
          const xtermScript = document.createElement('script');
          xtermScript.src = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js';
          document.head.appendChild(xtermScript);

          const xtermCSS = document.createElement('link');
          xtermCSS.rel = 'stylesheet';
          xtermCSS.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
          document.head.appendChild(xtermCSS);

          await new Promise(resolve => {
            xtermScript.onload = resolve;
          });

          // @ts-ignore
          const { Terminal } = window;
          const terminal = new Terminal({
            convertEol: true,
            theme: {
              background: '#1e1e1e',
              foreground: '#00ff41'
            }
          });
          
          terminal.open(terminalRef.current);
          
          // Run npm install
          const installProcess = await webcontainerInstance.spawn('npm', ['install']);
          installProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                terminal.write(data);
              }
            })
          );

          const installExit = await installProcess.exit;
          
          if (installExit === 0) {
            terminal.writeln('\r\n✓ Dependencies installed successfully\r\n');
            
            // Start dev server
            const devProcess = await webcontainerInstance.spawn('npm', ['run', 'dev']);
            
            devProcess.output.pipeTo(
              new WritableStream({
                write(data) {
                  terminal.write(data);
                }
              })
            );

            // Wait for server ready
            webcontainerInstance.on('server-ready', (port: number, url: string) => {
              if (mounted) {
                setServerUrl(url);
                terminal.writeln(`\r\n✓ Server ready at ${url}\r\n`);
              }
            });
          }
        }

        if (mounted) setIsBooting(false);

      } catch (error) {
        console.error('WebContainer initialization error:', error);
        if (mounted) setIsBooting(false);
      }
    }

    initWebContainer();

    return () => {
      mounted = false;
      if (webcontainerRef.current) {
        webcontainerRef.current.teardown?.();
      }
    };
  }, []);

  async function getFileList(wc: any, dir: string): Promise<string[]> {
    const entries = await wc.fs.readdir(dir || '.', { withFileTypes: true });
    const files: string[] = [];
    
    for (const entry of entries) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        const subFiles = await getFileList(wc, path);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
    
    return files;
  }

  async function loadFile(path: string) {
    if (!webcontainerRef.current) return;
    
    try {
      const content = await webcontainerRef.current.fs.readFile(path, 'utf-8');
      setFileContent(content);
      setCurrentFile(path);
    } catch (error) {
      console.error('Error loading file:', error);
    }
  }

  async function saveFile(path: string, content: string) {
    if (!webcontainerRef.current) return;
    
    try {
      await webcontainerRef.current.fs.writeFile(path, content);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  function handleEditorChange(value: string | undefined) {
    if (value !== undefined) {
      setFileContent(value);
      saveFile(currentFile, value);
    }
  }

  async function restartDevServer() {
    if (!webcontainerRef.current || !terminalRef.current) return;

    // @ts-ignore
    const { Terminal } = window;
    const terminal = new Terminal({
      convertEol: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#00ff41'
      }
    });
    
    terminalRef.current.innerHTML = '';
    terminal.open(terminalRef.current);
    terminal.writeln('Restarting dev server...\r\n');

    const devProcess = await webcontainerRef.current.spawn('npm', ['run', 'dev']);
    
    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        }
      })
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ 
      background: 'var(--terminal-bg)',
      color: 'var(--terminal-text)'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ 
        borderColor: 'var(--terminal-subtle)' 
      }}>
        <div className="flex items-center gap-2">
          <Globe size={20} style={{ color: 'var(--terminal-highlight)' }} />
          <h2 className="text-lg font-bold">WebContainer IDE</h2>
          <span className="text-xs opacity-60">Browser-Based Development Environment</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={restartDevServer}
            disabled={isBooting}
            size="sm"
            style={{ 
              background: 'var(--terminal-subtle)',
              color: 'var(--terminal-text)'
            }}
          >
            <Play size={16} className="mr-1" />
            Restart Server
          </Button>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X size={20} />
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      {isBooting ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ 
              borderColor: 'var(--terminal-highlight)' 
            }}></div>
            <p>Booting WebContainer...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: File Tree + Editor + Terminal */}
          <div className="flex-1 flex flex-col" style={{ 
            borderRight: '1px solid',
            borderColor: 'var(--terminal-subtle)'
          }}>
            {/* File Tree */}
            <div className="h-48 overflow-auto border-b" style={{ 
              borderColor: 'var(--terminal-subtle)',
              background: 'rgba(0,0,0,0.3)'
            }}>
              <div className="p-2">
                <div className="flex items-center gap-1 mb-2 text-sm font-semibold">
                  <FolderTree size={14} />
                  <span>Files</span>
                </div>
                {files.map(file => (
                  <div
                    key={file}
                    onClick={() => loadFile(file)}
                    className="px-2 py-1 text-xs cursor-pointer hover:bg-opacity-20"
                    style={{
                      background: currentFile === file ? 'rgba(0, 255, 65, 0.1)' : 'transparent',
                      color: currentFile === file ? 'var(--terminal-highlight)' : 'inherit'
                    }}
                  >
                    {file}
                  </div>
                ))}
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                defaultLanguage="typescript"
                language={currentFile.endsWith('.tsx') || currentFile.endsWith('.ts') ? 'typescript' : 
                         currentFile.endsWith('.css') ? 'css' : 
                         currentFile.endsWith('.html') ? 'html' : 'javascript'}
                value={fileContent}
                onChange={handleEditorChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2
                }}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
              />
            </div>

            {/* Terminal */}
            <div 
              ref={terminalRef}
              className="h-48 border-t"
              style={{ 
                borderColor: 'var(--terminal-subtle)',
                background: '#1e1e1e'
              }}
            />
          </div>

          {/* Right Panel: Live Preview */}
          <div className="w-1/2 flex flex-col">
            <div className="p-2 border-b flex items-center gap-2" style={{ 
              borderColor: 'var(--terminal-subtle)',
              background: 'rgba(0,0,0,0.3)'
            }}>
              <Globe size={14} />
              <span className="text-sm">Live Preview</span>
              {serverUrl && (
                <a 
                  href={serverUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs ml-auto hover:underline"
                  style={{ color: 'var(--terminal-highlight)' }}
                >
                  Open in new tab ↗
                </a>
              )}
            </div>
            <div className="flex-1">
              {serverUrl ? (
                <iframe
                  ref={iframeRef}
                  src={serverUrl}
                  className="w-full h-full border-0"
                  title="Live Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm opacity-60">Waiting for dev server...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
