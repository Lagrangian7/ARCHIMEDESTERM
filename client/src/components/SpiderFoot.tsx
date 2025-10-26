
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Copy, Shield, Globe, AlertTriangle, Database } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SpiderFootProps {
  onClose: () => void;
}

interface SpiderFootResult {
  modules: {
    [key: string]: {
      findings: Array<{
        type: string;
        data: string;
        source: string;
        confidence: string;
      }>;
    };
  };
  summary: {
    total_findings: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
  };
  metadata: {
    target: string;
    scan_type: string;
    timestamp: string;
    modules_used: string[];
  };
}

const SCAN_TYPES = [
  { value: 'footprint', label: 'Footprint', description: 'Basic reconnaissance scan' },
  { value: 'investigate', label: 'Investigate', description: 'Detailed investigation scan' },
  { value: 'passive', label: 'Passive Only', description: 'Passive intelligence gathering' },
  { value: 'all', label: 'All Modules', description: 'Comprehensive scan with all modules' }
];

const MODULE_CATEGORIES = [
  'DNS', 'WHOIS', 'SSL/TLS', 'Email', 'Social Media', 
  'Breach Data', 'Vulnerabilities', 'Subdomains', 'IP Intelligence'
];

export function SpiderFoot({ onClose }: SpiderFootProps) {
  const [target, setTarget] = useState('');
  const [scanType, setScanType] = useState('footprint');
  const [results, setResults] = useState<SpiderFootResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('DNS');
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        handleScan();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onClose, target, scanType]);

  const handleScan = async () => {
    if (!target.trim()) {
      setProgress('Error: Please enter a target');
      return;
    }

    setIsScanning(true);
    setProgress('Initializing SpiderFoot scan...');
    setResults(null);

    try {
      setProgress(`Scanning ${target} using ${scanType} scan type...`);
      
      // Simulate module execution
      const modules = SCAN_TYPES.find(st => st.value === scanType)?.label || 'Standard';
      setProgress(`Running ${modules} modules on target...`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await apiRequest('POST', '/api/spiderfoot', {
        target,
        scanType
      });

      const data = await response.json();
      setResults(data);
      setProgress(`Scan complete! Found ${data.summary.total_findings} total findings.`);
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      setProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsScanning(false);
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
      tool: 'SpiderFoot (ARCHIMEDES v7)'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spiderfoot-${target}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryFindings = (category: string) => {
    if (!results) return [];
    
    const findings: Array<{ type: string; data: string; source: string; confidence: string }> = [];
    Object.entries(results.modules).forEach(([moduleName, moduleData]) => {
      if (moduleName.toLowerCase().includes(category.toLowerCase())) {
        findings.push(...moduleData.findings);
      }
    });
    
    return findings;
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'high': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-terminal-bg text-terminal-text flex flex-col overflow-hidden z-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-terminal-highlight/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-terminal-highlight" />
            <div>
              <h2 className="text-xl font-bold text-terminal-highlight font-mono">SpiderFoot</h2>
              <p className="text-sm text-terminal-subtle">Open Source Intelligence Automation</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-terminal-text mb-1">Target (Domain, IP, Email, etc.)</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="example.com or 8.8.8.8 or user@domain.com"
              className="bg-black border-terminal-highlight/30 text-terminal-text placeholder:text-terminal-subtle focus:border-terminal-highlight"
              data-testid="input-target"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-terminal-text mb-1">Scan Type</label>
            <Select value={scanType} onValueChange={setScanType}>
              <SelectTrigger className="bg-black border-terminal-highlight/30 text-terminal-text" data-testid="select-scan-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-terminal-bg border-terminal-highlight/30">
                {SCAN_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-terminal-text hover:bg-terminal-highlight/10">
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-terminal-subtle">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleScan}
            disabled={isScanning || !target.trim()}
            className="bg-terminal-highlight text-black hover:bg-terminal-highlight/80 font-mono"
            data-testid="button-scan"
          >
            <Search className="w-4 h-4 mr-2" />
            {isScanning ? 'Scanning...' : 'Start Scan'}
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
            Ctrl+Enter to scan • ESC to close
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
                Results for {results.metadata.target}
              </h3>
              <div className="flex gap-2">
                <Badge variant="outline" className="border-green-500 text-green-400">
                  High: {results.summary.high_confidence}
                </Badge>
                <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                  Medium: {results.summary.medium_confidence}
                </Badge>
                <Badge variant="outline" className="border-red-500 text-red-400">
                  Low: {results.summary.low_confidence}
                </Badge>
              </div>
            </div>
            <div className="text-sm text-terminal-subtle">
              Scan Type: {results.metadata.scan_type} • Generated: {new Date(results.metadata.timestamp).toLocaleString()}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex-shrink-0 border-b border-terminal-highlight/30">
            <div className="flex px-4 overflow-x-auto">
              {MODULE_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-3 border-b-2 transition-colors font-mono text-sm whitespace-nowrap ${
                    activeCategory === category
                      ? 'border-terminal-highlight text-terminal-highlight'
                      : 'border-transparent text-terminal-subtle hover:text-terminal-text'
                  }`}
                  data-testid={`tab-${category}`}
                >
                  {category}
                  <Badge variant="secondary" className="ml-2 bg-terminal-highlight/20 text-terminal-highlight">
                    {getCategoryFindings(category).length}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
              <div className="space-y-2">
                {getCategoryFindings(activeCategory).length === 0 ? (
                  <div className="text-center py-8 text-terminal-subtle">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No findings in this category</p>
                  </div>
                ) : (
                  getCategoryFindings(activeCategory).map((finding, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-3 bg-black/20 border border-terminal-highlight/20 rounded font-mono text-sm group hover:border-terminal-highlight/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Globe className="w-3 h-3 text-terminal-highlight flex-shrink-0" />
                          <span className="font-medium text-terminal-highlight">{finding.type}</span>
                          <Badge className={getConfidenceBadgeColor(finding.confidence)}>
                            {finding.confidence}
                          </Badge>
                        </div>
                        <div className="text-terminal-text break-all mb-1">{finding.data}</div>
                        <div className="text-xs text-terminal-subtle">Source: {finding.source}</div>
                      </div>
                      <Button
                        onClick={() => copyToClipboard(finding.data)}
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-terminal-highlight hover:bg-terminal-highlight/10 flex-shrink-0"
                        data-testid={`button-copy-${index}`}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Welcome Message */}
      {!results && !isScanning && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <Database className="w-16 h-16 mx-auto mb-4 text-terminal-highlight opacity-50" />
            <h3 className="text-xl font-bold text-terminal-highlight mb-2 font-mono">
              Welcome to SpiderFoot
            </h3>
            <p className="text-terminal-subtle mb-6">
              Automated OSINT reconnaissance tool with 200+ modules for gathering intelligence on targets
              including domains, IPs, email addresses, and more.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left text-sm">
              <div className="border border-terminal-highlight/20 rounded p-4 bg-black/20">
                <h4 className="font-medium text-terminal-text mb-2">🔍 Multi-Source Intelligence</h4>
                <p className="text-terminal-subtle">Aggregate data from DNS, WHOIS, social media, breach databases, and more</p>
              </div>
              <div className="border border-terminal-highlight/20 rounded p-4 bg-black/20">
                <h4 className="font-medium text-terminal-text mb-2">🎯 Target Profiling</h4>
                <p className="text-terminal-subtle">Build comprehensive profiles of domains, IPs, and individuals</p>
              </div>
              <div className="border border-terminal-highlight/20 rounded p-4 bg-black/20">
                <h4 className="font-medium text-terminal-text mb-2">⚡ Automated Correlation</h4>
                <p className="text-terminal-subtle">Automatically correlate findings across multiple data sources</p>
              </div>
              <div className="border border-terminal-highlight/20 rounded p-4 bg-black/20">
                <h4 className="font-medium text-terminal-text mb-2">🛡️ Security Assessment</h4>
                <p className="text-terminal-subtle">Identify vulnerabilities, exposed data, and security risks</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpiderFoot;
