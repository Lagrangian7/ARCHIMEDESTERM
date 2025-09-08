import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Terminal, Wifi, ExternalLink } from 'lucide-react';

interface JuttyInterfaceProps {
  onClose?: () => void;
}

export function JuttyInterface({ onClose }: JuttyInterfaceProps) {
  const [connectionType, setConnectionType] = useState<'telnet' | 'ssh'>('telnet');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('');

  const handleConnect = () => {
    if (!host || !port) {
      alert('Please enter both host and port');
      return;
    }

    let juttyUrl = '';
    
    if (connectionType === 'telnet') {
      juttyUrl = `/jutty?type=telnet&host=${encodeURIComponent(host)}&port=${port}`;
    } else {
      if (!user) {
        alert('Please enter username for SSH connection');
        return;
      }
      juttyUrl = `/jutty?type=ssh&host=${encodeURIComponent(host)}&port=${port}&user=${encodeURIComponent(user)}`;
    }

    // Open Jutty in a new window
    window.open(juttyUrl, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
  };

  const handleQuickConnect = (quickHost: string, quickPort: string, type: 'telnet' | 'ssh' = 'telnet') => {
    setConnectionType(type);
    setHost(quickHost);
    setPort(quickPort);
    
    let juttyUrl = '';
    if (type === 'telnet') {
      juttyUrl = `/jutty?type=telnet&host=${encodeURIComponent(quickHost)}&port=${quickPort}`;
    } else {
      juttyUrl = `/jutty?type=ssh&host=${encodeURIComponent(quickHost)}&port=${quickPort}&user=${encodeURIComponent(user || 'user')}`;
    }
    
    window.open(juttyUrl, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
  };

  return (
    <div className="flex flex-col h-full bg-terminal-bg border-2 border-terminal-highlight p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Terminal className="w-6 h-6 text-terminal-highlight" />
          <h2 className="text-terminal-text text-xl font-bold">Jutty Terminal Client</h2>
        </div>
        {onClose && (
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="border-terminal-subtle hover:bg-terminal-subtle"
          >
            Close
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
              <SelectItem value="telnet">Telnet</SelectItem>
              <SelectItem value="ssh">SSH</SelectItem>
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
          <ExternalLink className="w-4 h-4 mr-2" />
          Connect with Jutty
        </Button>
      </div>

      {/* Quick Connect Options */}
      <div className="border-t border-terminal-subtle pt-6">
        <h3 className="text-terminal-text text-lg font-semibold mb-4">Quick Connect</h3>
        <div className="grid grid-cols-1 gap-2">
          <Button
            onClick={() => handleQuickConnect('towel.blinkenlights.nl', '23')}
            variant="outline"
            className="justify-start border-terminal-subtle hover:bg-terminal-subtle"
          >
            <Wifi className="w-4 h-4 mr-2" />
            Star Wars ASCII Animation (Telnet)
          </Button>
          <Button
            onClick={() => handleQuickConnect('telehack.com', '23')}
            variant="outline"
            className="justify-start border-terminal-subtle hover:bg-terminal-subtle"
          >
            <Terminal className="w-4 h-4 mr-2" />
            Telehack BBS (Telnet)
          </Button>
          <Button
            onClick={() => handleQuickConnect('freechess.org', '5000')}
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
          Jutty provides web-based SSH and Telnet access. Connections open in a new window with a full terminal interface.
          Use standard terminal commands and shortcuts within the Jutty interface.
        </p>
      </div>
    </div>
  );
}