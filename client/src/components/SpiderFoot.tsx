import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';

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
  };
}

const SCAN_TYPES = [
  { value: 'footprint', label: 'Footprint' },
  { value: 'investigate', label: 'Investigate' },
  { value: 'passive', label: 'Passive' },
  { value: 'all', label: 'All Modules' }
];

export function SpiderFoot({ onClose }: SpiderFootProps) {
  const [target, setTarget] = useState((window as any).spiderFootTarget || '');
  const [scanType, setScanType] = useState((window as any).spiderFootScanType || 'footprint');
  const [results, setResults] = useState<SpiderFootResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setResults(null);
    setError('');
    setTarget('');
    onClose();
  };

  const handleScan = async () => {
    if (!target.trim()) {
      setError('Please enter a target');
      return;
    }

    setIsScanning(true);
    setError('');
    setResults(null);

    try {
      // Replaced apiRequest with fetch for simplicity as per edited snippet
      const response = await fetch('/api/spiderfoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), scanType })
      });

      if (!response.ok) {
        throw new Error(`Scan failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-terminal-bg border-2 border-terminal-highlight rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-terminal-highlight/30">
          <h2 className="text-xl font-bold text-terminal-highlight font-mono">
            🕷️ SpiderFoot OSINT
          </h2>
          <button
            onClick={handleClose}
            className="text-terminal-highlight hover:bg-terminal-highlight/10 p-2 rounded transition-colors cursor-pointer"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Form */}
        <div className="p-4 border-b border-terminal-highlight/30">
          <div className="flex gap-3 mb-3">
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Enter target (domain, IP, email...)"
              className="flex-1 bg-black border-terminal-highlight/30 text-terminal-text"
              onKeyPress={(e) => e.key === 'Enter' && handleScan()}
            />
            <Select value={scanType} onValueChange={setScanType}>
              <SelectTrigger className="w-40 bg-black border-terminal-highlight/30 text-terminal-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-terminal-bg border-terminal-highlight/30">
                {SCAN_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-terminal-text">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleScan}
              disabled={isScanning || !target.trim()}
              className="bg-terminal-highlight text-black hover:bg-terminal-highlight/80"
            >
              <Search className="w-4 h-4 mr-2" />
              {isScanning ? 'Scanning...' : 'Scan'}
            </Button>
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {!results && !isScanning && (
              <div className="text-center py-12 text-terminal-subtle">
                <p className="text-lg mb-2">Enter a target to begin OSINT scan</p>
                <p className="text-sm">Supports: domains, IPs, emails, and more</p>
              </div>
            )}

            {isScanning && (
              <div className="text-center py-12 text-terminal-highlight">
                <div className="animate-pulse mb-4">🔍 Scanning {target}...</div>
                <div className="text-sm text-terminal-subtle">Gathering intelligence from multiple sources</div>
              </div>
            )}

            {results && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-black/40 border border-terminal-highlight/20 rounded p-4">
                  <h3 className="text-terminal-highlight font-bold mb-2">
                    Scan Summary: {results.metadata.target}
                  </h3>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-terminal-subtle">Total</div>
                      <div className="text-terminal-text font-bold">{results.summary.total_findings}</div>
                    </div>
                    <div>
                      <div className="text-terminal-subtle">High</div>
                      <div className="text-green-400 font-bold">{results.summary.high_confidence}</div>
                    </div>
                    <div>
                      <div className="text-terminal-subtle">Medium</div>
                      <div className="text-yellow-400 font-bold">{results.summary.medium_confidence}</div>
                    </div>
                    <div>
                      <div className="text-terminal-subtle">Low</div>
                      <div className="text-red-400 font-bold">{results.summary.low_confidence}</div>
                    </div>
                  </div>
                </div>

                {/* Findings by Module */}
                {Object.entries(results.modules).map(([moduleName, moduleData]) => (
                  <div key={moduleName} className="bg-black/20 border border-terminal-highlight/20 rounded p-4">
                    <h4 className="text-terminal-highlight font-bold mb-3 flex items-center">
                      <span className="mr-2">📊</span>
                      {moduleName} ({moduleData.findings.length})
                    </h4>
                    <div className="space-y-2">
                      {moduleData.findings.map((finding, idx) => (
                        <div key={idx} className="text-sm bg-black/30 rounded p-2 border-l-2 border-terminal-highlight/30">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="text-terminal-text font-mono break-all">{finding.data}</div>
                              <div className="text-terminal-subtle text-xs mt-1">
                                {finding.type} • {finding.source}
                              </div>
                            </div>
                            <div className={`text-xs font-bold ${getConfidenceColor(finding.confidence)}`}>
                              {finding.confidence.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

export default SpiderFoot;