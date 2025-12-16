
import { useState, useEffect } from 'react';
import { Activity, Clock, Zap, Code } from 'lucide-react';

interface CodeMetricsProps {
  executionTime?: number;
  linesOfCode?: number;
  complexity?: number;
  theme: any;
}

export function CodeMetrics({ executionTime, linesOfCode, complexity, theme }: CodeMetricsProps) {
  return (
    <div 
      className="flex items-center gap-4 px-4 py-2 border-t text-xs font-mono"
      style={{
        backgroundColor: theme.bg,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      <div className="flex items-center gap-1">
        <Clock className="w-3 h-3" style={{ color: theme.highlight }} />
        <span>{executionTime ? `${executionTime}ms` : '--'}</span>
      </div>
      
      <div className="flex items-center gap-1">
        <Code className="w-3 h-3" style={{ color: theme.highlight }} />
        <span>{linesOfCode || '--'} lines</span>
      </div>
      
      <div className="flex items-center gap-1">
        <Activity className="w-3 h-3" style={{ color: theme.highlight }} />
        <span>Complexity: {complexity || '--'}</span>
      </div>
      
      <div className="flex-1" />
      
      <div className="flex items-center gap-1" style={{ opacity: 0.6 }}>
        <Zap className="w-3 h-3" />
        <span>Ready</span>
      </div>
    </div>
  );
}
