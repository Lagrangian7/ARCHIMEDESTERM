import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Terminal as TerminalIcon, Gamepad2, Settings, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import '@xterm/xterm/css/xterm.css';

interface MudProfile {
  id: string;
  userId: string;
  name: string;
  host: string;
  port: number;
  description?: string;
  aliases?: string[];
  triggers?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface MudSession {
  id: string;
  userId: string;
  profileId?: string;
  sessionId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  connectTime?: Date;
  disconnectTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MudClientProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MudClient({ isOpen, onClose }: MudClientProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showProfileForm, setShowProfileForm] = useState(false);
  
  const queryClient = useQueryClient();

  // Query for MUD profiles
  const { data: profiles = [] } = useQuery<MudProfile[]>({
    queryKey: ['/api/mud/profiles'],
    enabled: isOpen
  });

  // Query for current user sessions
  const { data: sessions = [] } = useQuery<MudSession[]>({
    queryKey: ['/api/mud/sessions'],
    enabled: isOpen
  });

  // Create new MUD session mutation
  const createSessionMutation = useMutation({
    mutationFn: (sessionData: { profileId?: string; sessionId: string; status: string }) =>
      apiRequest('POST', '/api/mud/sessions', sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mud/sessions'] });
    }
  });

  // Initialize terminal
  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;

    if (!terminalInstance.current) {
      // Get CSS variable values for theme
      const style = getComputedStyle(document.documentElement);
      const terminalBg = style.getPropertyValue('--terminal-bg').trim() || '#0D1117';
      const terminalText = style.getPropertyValue('--terminal-text').trim() || '#00FF41';
      const terminalHighlight = style.getPropertyValue('--terminal-highlight').trim() || '#00FF41';
      
      // Create terminal with cyberpunk theme
      const terminal = new Terminal({
        theme: {
          background: terminalBg,
          foreground: terminalText,
          cursor: terminalHighlight,
          cursorAccent: terminalBg,
          selectionBackground: 'rgba(0, 255, 65, 0.3)',
          black: terminalBg,
          red: '#FF6B6B',
          green: terminalHighlight,
          yellow: '#FFD93D',
          blue: '#4DABF7',
          magenta: '#FF8CC8',
          cyan: '#4ECDC4',
          white: '#F8F9FA',
          brightBlack: '#495057',
          brightRed: '#FF8A80',
          brightGreen: '#69F0AE',
          brightYellow: '#FFE57F',
          brightBlue: '#82B1FF',
          brightMagenta: '#F8BBD9',
          brightCyan: '#84FFFF',
          brightWhite: '#FFFFFF'
        },
        fontFamily: 'JetBrains Mono, Courier New, monospace',
        fontSize: 14,
        rows: 30,
        cols: 100,
        cursorBlink: true,
        allowTransparency: true
      });

      fitAddon.current = new FitAddon();
      terminal.loadAddon(fitAddon.current);
      
      terminal.open(terminalRef.current);
      fitAddon.current.fit();

      // Handle terminal input
      terminal.onData((data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'send',
            sessionId: currentSessionId,
            data: data
          }));
        }
      });

      terminalInstance.current = terminal;

      // Welcome message
      terminal.writeln('\x1b[1;32m╔══════════════════════════════════════════════════════════════════════════════╗\x1b[0m');
      terminal.writeln('\x1b[1;32m║                          ARCHIMEDES MUD CLIENT v7                           ║\x1b[0m');
      terminal.writeln('\x1b[1;32m╚══════════════════════════════════════════════════════════════════════════════╝\x1b[0m');
      terminal.writeln('');
      terminal.writeln('\x1b[1;36mSelect a profile or enter custom connection details to connect to a MUD.\x1b[0m');
      terminal.writeln('');
    }

    return () => {
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
        terminalInstance.current = null;
      }
    };
  }, [isOpen]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current && terminalInstance.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Connect to MUD
  const connectToMud = async (host: string, port: number, profileId?: string) => {
    if (!terminalInstance.current) return;

    setConnectionStatus('connecting');
    const sessionId = `mud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentSessionId(sessionId);

    try {
      // Create session record
      await createSessionMutation.mutateAsync({
        profileId,
        sessionId,
        status: 'connecting'
      });

      // Create WebSocket connection
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/mud`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        terminalInstance.current?.writeln(`\x1b[1;33mConnecting to ${host}:${port}...\x1b[0m`);
        
        // Send connect message
        wsRef.current?.send(JSON.stringify({
          type: 'connect',
          host,
          port,
          sessionId,
          profileId
        }));
      };

      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'connected':
            setConnectionStatus('connected');
            terminalInstance.current?.writeln(`\x1b[1;32mConnected to ${host}:${port}\x1b[0m`);
            break;
            
          case 'data':
            terminalInstance.current?.write(message.data);
            break;
            
          case 'disconnected':
            setConnectionStatus('disconnected');
            terminalInstance.current?.writeln(`\x1b[1;31mDisconnected from ${host}:${port}\x1b[0m`);
            break;
            
          case 'error':
            setConnectionStatus('error');
            terminalInstance.current?.writeln(`\x1b[1;31mError: ${message.message}\x1b[0m`);
            break;
        }
      };

      wsRef.current.onclose = () => {
        setConnectionStatus('disconnected');
        terminalInstance.current?.writeln('\x1b[1;31mConnection closed.\x1b[0m');
      };

      wsRef.current.onerror = () => {
        setConnectionStatus('error');
        terminalInstance.current?.writeln('\x1b[1;31mWebSocket connection error.\x1b[0m');
      };

    } catch (error) {
      setConnectionStatus('error');
      terminalInstance.current?.writeln(`\x1b[1;31mFailed to connect: ${error}\x1b[0m`);
    }
  };

  // Disconnect from MUD
  const disconnectFromMud = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'disconnect',
        sessionId: currentSessionId
      }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
    setCurrentSessionId('');
  };

  // Handle profile selection
  const handleProfileConnect = () => {
    const profile = profiles.find(p => p.id === selectedProfile);
    if (profile) {
      connectToMud(profile.host, profile.port, profile.id);
    }
  };

  // Handle custom connection
  const handleCustomConnect = () => {
    if (customHost && customPort) {
      connectToMud(customHost, parseInt(customPort));
    }
  };

  // Connection status indicator
  const getStatusStyle = () => {
    switch (connectionStatus) {
      case 'connected': return { color: 'var(--terminal-text)' };
      case 'connecting': return { color: '#FFD93D' };
      case 'error': return { color: '#FF6B6B' };
      default: return { color: 'var(--terminal-text)', opacity: 0.6 };
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Error';
      default: return 'Disconnected';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[80vh] bg-terminal-bg border-2 border-terminal-highlight p-0">
        <DialogHeader className="border-b border-terminal-subtle p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Gamepad2 className="w-6 h-6 text-terminal-highlight" />
              <DialogTitle className="text-terminal-text text-xl font-bold">
                MUD Client
              </DialogTitle>
              <div className="text-sm font-medium" style={getStatusStyle()}>
                [{getStatusText()}]
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setShowProfileForm(true)}
                variant="outline"
                size="sm"
                className="border-terminal-subtle hover:bg-terminal-subtle"
              >
                <Settings className="w-4 h-4 mr-1" />
                Profiles
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                size="sm"
                className="border-terminal-subtle hover:bg-terminal-subtle"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Connection Panel */}
          <div className="w-80 border-r border-terminal-subtle p-4 bg-terminal-bg/50 overflow-y-auto">
            <div className="space-y-6">
              {/* Profile Connection */}
              <div>
                <Label className="text-terminal-text text-sm font-medium mb-2 block">
                  Saved Profiles
                </Label>
                <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                  <SelectTrigger className="bg-terminal-bg border-terminal-subtle text-terminal-text">
                    <SelectValue placeholder="Select a profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div>
                          <div className="font-medium">{profile.name}</div>
                          <div className="text-xs" style={{ color: 'var(--terminal-text)', opacity: 0.6 }}>
                            {profile.host}:{profile.port}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleProfileConnect}
                  disabled={!selectedProfile || connectionStatus === 'connecting'}
                  className="w-full mt-2 bg-terminal-highlight text-black hover:bg-terminal-highlight/80"
                >
                  Connect to Profile
                </Button>
              </div>

              {/* Custom Connection */}
              <div>
                <Label className="text-terminal-text text-sm font-medium mb-2 block">
                  Custom Connection
                </Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Host (e.g., aardmud.org)"
                    value={customHost}
                    onChange={(e) => setCustomHost(e.target.value)}
                    className="bg-terminal-bg border-terminal-subtle text-terminal-text"
                  />
                  <Input
                    placeholder="Port (e.g., 4000)"
                    value={customPort}
                    onChange={(e) => setCustomPort(e.target.value)}
                    className="bg-terminal-bg border-terminal-subtle text-terminal-text"
                  />
                  <Button
                    onClick={handleCustomConnect}
                    disabled={!customHost || !customPort || connectionStatus === 'connecting'}
                    className="w-full bg-terminal-highlight text-black hover:bg-terminal-highlight/80"
                  >
                    Connect
                  </Button>
                </div>
              </div>

              {/* Quick Connect Options */}
              <div>
                <Label className="text-terminal-text text-sm font-medium mb-2 block">
                  Quick Connect
                </Label>
                <div className="space-y-2">
                  <Button
                    onClick={() => connectToMud('aardmud.org', 4000)}
                    variant="outline"
                    className="w-full justify-start border-terminal-subtle hover:bg-terminal-subtle text-xs"
                    disabled={connectionStatus === 'connecting'}
                  >
                    <TerminalIcon className="w-4 h-4 mr-2" />
                    Aardwolf MUD
                  </Button>
                  <Button
                    onClick={() => connectToMud('3scapes.org', 3200)}
                    variant="outline"
                    className="w-full justify-start border-terminal-subtle hover:bg-terminal-subtle text-xs"
                    disabled={connectionStatus === 'connecting'}
                  >
                    <TerminalIcon className="w-4 h-4 mr-2" />
                    3-Scapes
                  </Button>
                  <Button
                    onClick={() => connectToMud('carrionfields.net', 4449)}
                    variant="outline"
                    className="w-full justify-start border-terminal-subtle hover:bg-terminal-subtle text-xs"
                    disabled={connectionStatus === 'connecting'}
                  >
                    <TerminalIcon className="w-4 h-4 mr-2" />
                    Carrion Fields
                  </Button>
                </div>
              </div>

              {/* Connection Actions */}
              {connectionStatus === 'connected' && (
                <div>
                  <Button
                    onClick={disconnectFromMud}
                    variant="outline"
                    className="w-full border-red-500 text-red-400 hover:bg-red-500/20"
                  >
                    Disconnect
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 flex flex-col bg-terminal-bg">
            <div 
              ref={terminalRef}
              className="flex-1 p-2"
              data-testid="mud-terminal"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}