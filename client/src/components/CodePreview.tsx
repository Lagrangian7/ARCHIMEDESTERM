import { X } from 'lucide-react';

interface CodePreviewProps {
  code: string;
  onClose: () => void;
}

export function CodePreview({ code, onClose }: CodePreviewProps) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      data-testid="code-preview-overlay"
    >
      <div className="relative w-full max-w-6xl h-[80vh] mx-4 bg-[#0D1117] border-2 border-[#00FF41] rounded-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-[#00FF41]/30">
          <h3 className="text-[#00FF41] font-mono text-sm flex items-center gap-2">
            <span className="animate-pulse">▶</span>
            CODE PREVIEW - LIVE EXECUTION
          </h3>
          <button
            onClick={onClose}
            className="text-[#00FF41] hover:text-white transition-colors p-1"
            data-testid="button-close-preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Code Display */}
        <div className="absolute top-14 left-0 w-1/3 h-[calc(100%-3.5rem)] p-4 bg-black/30 border-r border-[#00FF41]/30 overflow-auto">
          <pre className="text-[#00FF41] font-mono text-xs whitespace-pre-wrap break-words">
            <code>{code}</code>
          </pre>
        </div>

        {/* Preview Frame */}
        <div className="absolute top-14 left-[33.333%] w-2/3 h-[calc(100%-3.5rem)] bg-white">
          <iframe
            srcDoc={code}
            sandbox="allow-scripts"
            className="w-full h-full border-none"
            title="Code Preview"
            data-testid="preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}
