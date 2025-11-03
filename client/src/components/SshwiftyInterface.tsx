
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Terminal, Wifi, X } from 'lucide-react';

interface SshwiftyInterfaceProps {
  onClose?: () => void;
}

export function SshwiftyInterface({ onClose }: SshwiftyInterfaceProps) {
  const [connectionType, setConnectionType] = useState<'telnet' | 'ssh'>('ssh');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const handleConnect = () => {
    if (!host || !port) {
      alert('Please enter both host and port');
      return;
    }

    let sshwiftyUrl = '';
    
    if (connectionType === 'telnet') {
      sshwiftyUrl = `/sshwifty?type=telnet&host=${encodeURIComponent(host)}&port=${port}`;
    } else {
      if (!user) {
        alert('Please enter username for SSH connection');
        return;
      }
      sshwiftyUrl = `/sshwifty?type=ssh&host=${encodeURIComponent(host)}&port=${port}&user=${encodeURIComponent(user)}`;
    }

    setIframeUrl(sshwiftyUrl);
  };

  const handleQuickConnect = (quickHost: string, quickPort: string, type: 'telnet' | 'ssh' = 'telnet', quickUser?: string) => {
    setConnectionType(type);
    setHost(quickHost);
    setPort(quickPort);
    if (quickUser) setUser(quickUser);
    
    let sshwiftyUrl = '';
    if (type === 'telnet') {
      sshwiftyUrl = `/sshwifty?type=telnet&host=${encodeURIComponent(quickHost)}&port=${quickPort}`;
    } else {
      const useUser = quickUser || user || 'user';
      sshwiftyUrl = `/sshwifty?type=ssh&host=${encodeURIComponent(quickHost)}&port=${quickPort}&user=${encodeURIComponent(useUser)}`;
    }
    
    setIframeUrl(sshwiftyUrl);
  };

  const handleCloseIframe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIframeUrl(null);
  };

  // If iframe is open, show full-screen iframe view
  if (iframeUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-terminal-bg flex flex-col">
        {/* Iframe Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-terminal-highlight/30">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-terminal-highlight" />
            <h3 className="text-terminal-text text-lg font-bold">
              {connectionType.toUpperCase()} - {host}:{port}
            </h3>
          </div>
          <Button
            onClick={handleCloseIframe}
            variant="ghost"
            size="sm"
            className="text-terminal-highlight hover:bg-terminal-highlight/10"
            type="button"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Iframe */}
        <iframe
          src={iframeUrl}
          className="flex-1 w-full border-none"
          title={`${connectionType} connection to ${host}:${port}`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-terminal-bg border-2 border-terminal-highlight p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Terminal className="w-6 h-6 text-terminal-highlight" />
          <h2 className="text-terminal-text text-xl font-bold">SSH & Telnet Client</h2>
        </div>
        {onClose && (
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="border-terminal-subtle hover:bg-terminal-subtle"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Connection Form */}
      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="connection-type" className="text-terminal-text">Connection Type</Label>
          <Select value={connectionType} onValueChange={(value: 'telnet' | 'ssh') => setConnectionType(value)}>
            <SelectTrigger className="bg-terminal-bg border-terminal-subtle text-terminal-text">
              <SelectValue placeholder="Select connection type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ssh">SSH</SelectItem>
              <SelectItem value="telnet">Telnet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="host" className="text-terminal-text">Host</Label>
            <Input
              id="host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com"
              className="bg-terminal-bg border-terminal-subtle text-terminal-text"
            />
          </div>
          <div>
            <Label htmlFor="port" className="text-terminal-text">Port</Label>
            <Input
              id="port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder={connectionType === 'ssh' ? '22' : '23'}
              className="bg-terminal-bg border-terminal-subtle text-terminal-text"
            />
          </div>
        </div>

        {connectionType === 'ssh' && (
          <div>
            <Label htmlFor="user" className="text-terminal-text">Username</Label>
            <Input
              id="user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="username"
              className="bg-terminal-bg border-terminal-subtle text-terminal-text"
            />
          </div>
        )}

        <Button
          onClick={handleConnect}
          className="w-full bg-terminal-highlight text-black hover:bg-terminal-highlight/80"
          disabled={!host || !port || (connectionType === 'ssh' && !user)}
        >
          <Terminal className="w-4 h-4 mr-2" />
          Connect
        </Button>
      </div>

      {/* Quick Connect Options */}
      <div className="border-t border-terminal-subtle pt-6">
        <h3 className="text-terminal-text text-lg font-semibold mb-4">Quick Connect</h3>
        <div className="grid grid-cols-1 gap-2">
          <Button
            onClick={() => handleQuickConnect('towel.blinkenlights.nl', '23', 'telnet')}
            variant="outline"
            className="justify-start border-terminal-subtle hover:bg-terminal-subtle"
          >
            <Wifi className="w-4 h-4 mr-2" />
            Star Wars ASCII Animation (Telnet)
          </Button>
          <Button
            onClick={() => handleQuickConnect('telehack.com', '23', 'telnet')}
            variant="outline"
            className="justify-start border-terminal-subtle hover:bg-terminal-subtle"
          >
            <Terminal className="w-4 h-4 mr-2" />
            Telehack BBS (Telnet)
          </Button>
          <Button
            onClick={() => handleQuickConnect('freechess.org', '5000', 'telnet')}
            variant="outline"
            className="justify-start border-terminal-subtle hover:bg-terminal-subtle"
          >
            <Terminal className="w-4 h-4 mr-2" />
            Free Internet Chess Server (Telnet)
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-terminal-bg/50 border border-terminal-subtle rounded">
        <p className="text-terminal-subtle text-sm">
          Web-based SSH and Telnet client with xterm.js terminal emulation. 
          Connections open in a new window with full terminal functionality.
          Use standard terminal commands and shortcuts within the interface.
        </p>
      </div>
    </div>
  );
}
