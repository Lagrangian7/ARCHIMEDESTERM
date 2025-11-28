import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Copy, Shield, Globe, Mail, Server, Key, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface TheHarvesterProps {
  onClose: () => void;
}

interface HarvestResult {
  emails: string[];
  subdomains: string[];
  ips: string[];
  urls: string[];
  certificates: string[];
  metadata: {
    domain: string;
    source: string;
    timestamp: string;
    total_results: number;
  };
}

const OSINT_SOURCES = [
  { value: 'all', label: 'All Sources', description: 'Search across all available sources' },
  { value: 'crtsh', label: 'Certificate Transparency', description: 'SSL/TLS certificates from crt.sh' },
  { value: 'dnsdumpster', label: 'DNS Dumpster', description: 'DNS records and subdomains' },
  { value: 'sublist3r', label: 'Sublist3r', description: 'Subdomain enumeration' },
  { value: 'shodan', label: 'Shodan', description: 'Internet-connected devices' },
  { value: 'google', label: 'Google Search', description: 'Google dorking results' },
  { value: 'bing', label: 'Bing Search', description: 'Bing search results' },
  { value: 'linkedin', label: 'LinkedIn', description: 'Employee information' },
  { value: 'twitter', label: 'Twitter/X', description: 'Social media mentions' },
  { value: 'threatintel', label: 'Threat Intelligence', description: 'Security threat data' }
];

type TabType = 'emails' | 'subdomains' | 'ips' | 'urls' | 'certificates';

export function TheHarvester({ onClose }: TheHarvesterProps) {
  const [domain, setDomain] = useState('');
  const [source, setSource] = useState('all');
  const [limit, setLimit] = useState('100');
  const [results, setResults] = useState<HarvestResult | null>(null);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [progress, setProgress] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('emails');
  const [viewedTabs, setViewedTabs] = useState<Set<TabType>>(() => new Set<TabType>(['emails']));
  const [previousResults, setPreviousResults] = useState<HarvestResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    setViewedTabs(prev => {
      const newSet = new Set<TabType>(prev);
      newSet.add(tab);
      return newSet;
    });
  };

  const hasNewContent = (tab: TabType): boolean => {
    if (!results || viewedTabs.has(tab)) return false;
    const count = results[tab]?.length || 0;
    const prevCount = previousResults?.[tab]?.length || 0;
    return count > prevCount || (count > 0 && !previousResults);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        handleHarvest();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onClose, domain, source, limit]);

  const handleHarvest = async () => {
    if (!domain.trim()) {
      setProgress('Error: Please enter a domain name');
      return;
    }

    setIsHarvesting(true);
    setProgress('Initializing theHarvester...');
    setResults(null);

    try {
      // Simulate progressive search across multiple sources
      const sources = source === 'all' ? OSINT_SOURCES.slice(1) : [OSINT_SOURCES.find(s => s.value === source)!];
      
      setProgress(`Harvesting data for ${domain} using ${sources.length} source(s)...`);
      
      for (let i = 0; i < sources.length; i++) {
        setProgress(`[${i + 1}/${sources.length}] Querying ${sources[i].label}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }

      setProgress('Processing and deduplicating results...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Call backend API
      const response = await apiRequest('POST', '/api/theharvester', {
        domain,
        source,
        limit: parseInt(limit)
      });

      const data = await response.json();
      setPreviousResults(results);
      setResults(data);
      setViewedTabs(new Set<TabType>([activeTab]));
      setProgress(`Harvest complete! Found ${data.metadata.total_results} total results.`);
      
      // Auto-scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      setProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsHarvesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportResults = () => {
    if (!results) return;
    
    const exportData = {
      ...results,
      exported_at: new Date().toISOString(),
      tool: 'theHarvester (ARCHIMEDES v7)'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theharvester-${domain}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'emails': return <Mail className="w-4 h-4" />;
      case 'subdomains': return <Globe className="w-4 h-4" />;
      case 'ips': return <Server className="w-4 h-4" />;
      case 'urls': return <Search className="w-4 h-4" />;
      case 'certificates': return <Key className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getTabCount = (tab: string) => {
    if (!results) return 0;
    switch (tab) {
      case 'emails': return results.emails.length;
      case 'subdomains': return results.subdomains.length;
      case 'ips': return results.ips.length;
      case 'urls': return results.urls.length;
      case 'certificates': return results.certificates.length;
      default: return 0;
    }
  };

  const renderDataList = (data: string[], type: string) => (
    <div className="space-y-2">
      {data.length === 0 ? (
        <div className="text-center py-8 text-terminal-subtle">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No {type} found for this domain</p>
        </div>
      ) : (
        data.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 bg-black/20 border border-terminal-highlight/20 rounded font-mono text-sm group hover:border-terminal-highlight/40 transition-colors"
          >
            <span className="text-terminal-text break-all flex-1">{item}</span>
            <Button
              onClick={() => copyToClipboard(item)}
              size="sm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-terminal-highlight hover:bg-terminal-highlight/10"
              data-testid={`button-copy-${type}-${index}`}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-terminal-bg text-terminal-text flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-terminal-highlight/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-terminal-highlight" />
            <div>
              <h2 className="text-xl font-bold text-terminal-highlight font-mono">theHarvester</h2>
              <p className="text-sm text-terminal-subtle">OSINT Information Gathering Tool</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-terminal-highlight hover:bg-terminal-highlight/10"
            data-testid="button-close"
          >
            ✕
          </Button>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-terminal-text mb-1">Target Domain</label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="bg-black border-terminal-highlight/30 text-terminal-text placeholder:text-terminal-subtle focus:border-terminal-highlight"
              data-testid="input-domain"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-terminal-text mb-1">Source</label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="bg-black border-terminal-highlight/30 text-terminal-text" data-testid="select-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-terminal-bg border-terminal-highlight/30">
                {OSINT_SOURCES.map((src) => (
                  <SelectItem key={src.value} value={src.value} className="text-terminal-text hover:bg-terminal-highlight/10">
                    <div>
                      <div className="font-medium">{src.label}</div>
                      <div className="text-xs text-terminal-subtle">{src.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-terminal-text mb-1">Limit</label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="bg-black border-terminal-highlight/30 text-terminal-text" data-testid="select-limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-terminal-bg border-terminal-highlight/30">
                <SelectItem value="50" className="text-terminal-text">50 results</SelectItem>
                <SelectItem value="100" className="text-terminal-text">100 results</SelectItem>
                <SelectItem value="250" className="text-terminal-text">250 results</SelectItem>
                <SelectItem value="500" className="text-terminal-text">500 results</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleHarvest}
            disabled={isHarvesting || !domain.trim()}
            className="bg-terminal-highlight text-black hover:bg-terminal-highlight/80 font-mono"
            data-testid="button-harvest"
          >
            <Search className="w-4 h-4 mr-2" />
            {isHarvesting ? 'Harvesting...' : 'Start Harvest'}
          </Button>
          
          {results && (
            <Button
              onClick={exportResults}
              variant="outline"
              className="border-terminal-highlight text-terminal-highlight hover:bg-terminal-highlight/10 font-mono"
              data-testid="button-export"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          )}
          
          <div className="text-xs text-terminal-subtle self-center ml-4">
            Ctrl+Enter to harvest • ESC to close
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="mt-3 p-2 bg-black/40 border border-terminal-highlight/20 rounded">
            <div className="text-sm font-mono text-terminal-text" data-testid="text-progress">{progress}</div>
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div ref={resultsRef} className="flex-1 flex flex-col overflow-hidden">
          {/* Results Header */}
          <div className="flex-shrink-0 border-b border-terminal-highlight/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-terminal-highlight font-mono">
                Results for {results.metadata.domain}
              </h3>
              <Badge variant="outline" className="border-terminal-highlight text-terminal-highlight">
                {results.metadata.total_results} total results
              </Badge>
            </div>
            <div className="text-sm text-terminal-subtle">
              Source: {results.metadata.source} • Generated: {new Date(results.metadata.timestamp).toLocaleString()}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-shrink-0 border-b border-terminal-highlight/30">
            <div className="flex px-4">
              {(['emails', 'subdomains', 'ips', 'urls', 'certificates'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`relative flex items-center gap-2 px-4 py-3 border-b-2 transition-colors font-mono text-sm ${
                    activeTab === tab
                      ? 'border-terminal-highlight text-terminal-highlight'
                      : 'border-transparent text-terminal-subtle hover:text-terminal-text'
                  }`}
                  data-testid={`tab-${tab}`}
                >
                  {getTabIcon(tab)}
                  <span className="capitalize">{tab}</span>
                  <Badge variant="secondary" className="ml-1 bg-terminal-highlight/20 text-terminal-highlight">
                    {getTabCount(tab)}
                  </Badge>
                  {hasNewContent(tab) && (
                    <span 
                      className="absolute -top-1 -right-1 flex h-3 w-3"
                      data-testid={`tab-notification-${tab}`}
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-highlight opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-terminal-highlight"></span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
              {activeTab === 'emails' && renderDataList(results.emails, 'emails')}
              {activeTab === 'subdomains' && renderDataList(results.subdomains, 'subdomains')}
              {activeTab === 'ips' && renderDataList(results.ips, 'IP addresses')}
              {activeTab === 'urls' && renderDataList(results.urls, 'URLs')}
              {activeTab === 'certificates' && renderDataList(results.certificates, 'certificates')}
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Welcome Message */}
      {!results && !isHarvesting && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <Shield className="w-16 h-16 mx-auto mb-4 text-terminal-highlight opacity-50" />
            <h3 className="text-xl font-bold text-terminal-highlight mb-2 font-mono">
              Welcome to theHarvester
            </h3>
            <p className="text-terminal-subtle mb-6">
              An OSINT tool for gathering emails, subdomains, IPs, URLs, and certificates from public sources.
              Perfect for reconnaissance during security assessments.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left text-sm">
              <div className="border border-terminal-highlight/20 rounded p-4 bg-black/20">
                <h4 className="font-medium text-terminal-text mb-2">🎯 Reconnaissance</h4>
                <p className="text-terminal-subtle">Discover external assets and attack surface for security testing</p>
              </div>
              <div className="border border-terminal-highlight/20 rounded p-4 bg-black/20">
                <h4 className="font-medium text-terminal-text mb-2">📧 Email Discovery</h4>
                <p className="text-terminal-subtle">Find employee email addresses for social engineering assessments</p>
              </div>
              <div className="border border-terminal-highlight/20 rounded p-4 bg-black/20">
                <h4 className="font-medium text-terminal-text mb-2">🌐 Subdomain Enumeration</h4>
                <p className="text-terminal-subtle">Identify subdomains and expand your target scope</p>
              </div>
              <div className="border border-terminal-highlight/20 rounded p-4 bg-black/20">
                <h4 className="font-medium text-terminal-text mb-2">🔒 Certificate Intelligence</h4>
                <p className="text-terminal-subtle">Analyze SSL certificates for additional domains and infrastructure</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TheHarvester;