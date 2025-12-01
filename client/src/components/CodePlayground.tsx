import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, Download, Play, FileCode, Copy, Check, Plus, Trash2, 
  FileText, Terminal as TerminalIcon, Info, ChevronDown, ChevronUp, Table2 
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CodePlaygroundProps {
  onClose: () => void;
  initialCode?: string;
  initialLanguage?: string;
}

interface CodeFile {
  id: string;
  name: string;
  language: string;
  content: string;
}

const LANGUAGE_CONFIG: Record<string, {
  extension: string;
  monacoLang: string;
  displayName: string;
  runCommand: string;
  icon: string;
}> = {
  python: { extension: '.py', monacoLang: 'python', displayName: 'Python', runCommand: 'python3', icon: '🐍' },
  javascript: { extension: '.js', monacoLang: 'javascript', displayName: 'JavaScript', runCommand: 'node', icon: '🟨' },
  typescript: { extension: '.ts', monacoLang: 'typescript', displayName: 'TypeScript', runCommand: 'npx ts-node', icon: '🔷' },
  html: { extension: '.html', monacoLang: 'html', displayName: 'HTML', runCommand: 'open in browser', icon: '🌐' },
  css: { extension: '.css', monacoLang: 'css', displayName: 'CSS', runCommand: 'link in HTML', icon: '🎨' },
  java: { extension: '.java', monacoLang: 'java', displayName: 'Java', runCommand: 'javac && java', icon: '☕' },
  cpp: { extension: '.cpp', monacoLang: 'cpp', displayName: 'C++', runCommand: 'g++ -o output && ./output', icon: '⚙️' },
  c: { extension: '.c', monacoLang: 'c', displayName: 'C', runCommand: 'gcc -o output && ./output', icon: '🔧' },
  bash: { extension: '.sh', monacoLang: 'shell', displayName: 'Bash', runCommand: 'bash', icon: '💻' },
  sql: { extension: '.sql', monacoLang: 'sql', displayName: 'SQL', runCommand: 'sql client', icon: '🗄️' },
  json: { extension: '.json', monacoLang: 'json', displayName: 'JSON', runCommand: 'N/A', icon: '📋' },
  yaml: { extension: '.yaml', monacoLang: 'yaml', displayName: 'YAML', runCommand: 'N/A', icon: '📝' },
  markdown: { extension: '.md', monacoLang: 'markdown', displayName: 'Markdown', runCommand: 'preview', icon: '📄' },
  rust: { extension: '.rs', monacoLang: 'rust', displayName: 'Rust', runCommand: 'cargo run', icon: '🦀' },
  go: { extension: '.go', monacoLang: 'go', displayName: 'Go', runCommand: 'go run', icon: '🐹' },
  php: { extension: '.php', monacoLang: 'php', displayName: 'PHP', runCommand: 'php', icon: '🐘' },
  ruby: { extension: '.rb', monacoLang: 'ruby', displayName: 'Ruby', runCommand: 'ruby', icon: '💎' },
  swift: { extension: '.swift', monacoLang: 'swift', displayName: 'Swift', runCommand: 'swift', icon: '🍎' },
  kotlin: { extension: '.kt', monacoLang: 'kotlin', displayName: 'Kotlin', runCommand: 'kotlinc && kotlin', icon: '🟣' },
};

function detectLanguage(code: string, filename?: string): string {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
      if (config.extension === `.${ext}`) return lang;
    }
  }
  
  const patterns: [RegExp, string][] = [
    [/^#!.*python|import\s+(os|sys|json|re|typing)|def\s+\w+\(.*\):|from\s+\w+\s+import|if\s+__name__\s*==\s*['"]__main__['"]/m, 'python'],
    [/^#!.*node|const\s+\w+\s*=\s*require|module\.exports|console\.log|\.forEach\(|\.map\(|=>\s*\{|async\s+function/m, 'javascript'],
    [/interface\s+\w+\s*\{|type\s+\w+\s*=|:\s*(string|number|boolean|any)\b|<T>|import\s+.*from\s*['"]|export\s+(default\s+)?(class|function|const|interface)/m, 'typescript'],
    [/<!DOCTYPE\s+html|<html|<head|<body|<div|<script|<style|<link\s+rel/im, 'html'],
    [/^\s*\.([\w-]+)\s*\{|@media|@keyframes|^\s*#[\w-]+\s*\{|color:|background:|margin:|padding:|display:/m, 'css'],
    [/public\s+class\s+\w+|public\s+static\s+void\s+main|System\.out\.print|import\s+java\./m, 'java'],
    [/#include\s*<.*>|std::|cout\s*<<|cin\s*>>|using\s+namespace\s+std|int\s+main\s*\(/m, 'cpp'],
    [/#include\s*<stdio\.h>|printf\s*\(|scanf\s*\(|int\s+main\s*\(\s*void\s*\)/m, 'c'],
    [/^#!.*bash|^#!.*sh|\$\(.*\)|\$\{.*\}|echo\s+|if\s+\[\[|\bgrep\b|\bsed\b|\bawk\b/m, 'bash'],
    [/SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+.*\s+SET|CREATE\s+TABLE|DROP\s+TABLE|ALTER\s+TABLE/im, 'sql'],
    [/^\s*\{[\s\n]*".*":/m, 'json'],
    [/^---\n|^\w+:\s*\n?\s+/m, 'yaml'],
    [/^#+\s+|^\*\*.*\*\*$|^\[.*\]\(.*\)/m, 'markdown'],
    [/fn\s+main\s*\(\)|let\s+mut\s+|impl\s+\w+|use\s+std::|println!\(/m, 'rust'],
    [/package\s+main|func\s+main\s*\(\)|import\s*\(|fmt\.Print/m, 'go'],
    [/<\?php|\$_GET|\$_POST|echo\s+|function\s+\w+\s*\(/m, 'php'],
    [/def\s+\w+\s*\n|puts\s+|require\s+['"]|class\s+\w+\s*<\s*\w+/m, 'ruby'],
  ];
  
  for (const [pattern, lang] of patterns) {
    if (pattern.test(code)) return lang;
  }
  
  return 'javascript';
}

function cleanCodeFormatting(code: string): string {
  // Split into lines and remove empty lines from start/end
  let lines = code.split(/\r?\n/);
  
  // Remove leading and trailing empty lines
  while (lines.length > 0 && !lines[0].trim()) {
    lines.shift();
  }
  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  
  if (lines.length === 0) return '';
  
  // Find minimum common indentation (excluding empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length > 0) {
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      minIndent = Math.min(minIndent, indent);
    }
  }
  
  // Remove common indentation and trailing whitespace
  if (minIndent > 0 && minIndent !== Infinity) {
    lines = lines.map(line => line.length > minIndent ? line.slice(minIndent) : line.trimEnd());
  } else {
    lines = lines.map(line => line.trimEnd());
  }
  
  // Join back together
  return lines.join('\n');
}

function extractCodeBlocksFromText(text: string): CodeFile[] {
  // Handle multiple markdown formats: ```lang code ```, ~~~lang code ~~~, indented code blocks
  const codeBlockRegex = /```(\w+)?\s*(?:\n|\r\n)?([\s\S]*?)```|~~~(\w+)?\s*(?:\n|\r\n)?([\s\S]*?)~~~/g;
  const files: CodeFile[] = [];
  let match;
  let index = 0;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Handle both ``` and ~~~ formats
    const specifiedLang = (match[1] || match[3] || '').toLowerCase();
    const content = cleanCodeFormatting(match[2] || match[4] || '');
    
    if (content.length < 5) continue;
    
    let language = specifiedLang;
    if (!language || !LANGUAGE_CONFIG[language]) {
      language = detectLanguage(content);
    }
    
    const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.javascript;
    const baseName = getDefaultFilename(language, index);
    
    files.push({
      id: `file-${Date.now()}-${index}`,
      name: baseName,
      language,
      content
    });
    index++;
  }
  
  return files;
}

function getDefaultFilename(language: string, index: number): string {
  const config = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.javascript;
  const names: Record<string, string[]> = {
    python: ['main.py', 'app.py', 'script.py', 'utils.py'],
    javascript: ['index.js', 'app.js', 'script.js', 'utils.js'],
    typescript: ['index.ts', 'app.ts', 'main.ts', 'types.ts'],
    html: ['index.html', 'page.html', 'template.html'],
    css: ['styles.css', 'main.css', 'app.css'],
    java: ['Main.java', 'App.java', 'Program.java'],
    cpp: ['main.cpp', 'app.cpp', 'program.cpp'],
    bash: ['script.sh', 'run.sh', 'setup.sh'],
  };
  
  const langNames = names[language] || [`file${config.extension}`];
  return langNames[index % langNames.length] || `file${index}${config.extension}`;
}

function generateLocalInstructions(files: CodeFile[]): string {
  const languages = Array.from(new Set(files.map(f => f.language)));
  let instructions = '## Local Setup Instructions\n\n';
  
  instructions += '### Step 1: Save the Files\n';
  instructions += 'Create a new folder and save each file with the exact filename shown.\n\n';
  
  instructions += '### Step 2: Install Dependencies\n\n';
  
  for (const lang of languages) {
    const config = LANGUAGE_CONFIG[lang];
    if (!config) continue;
    
    switch (lang) {
      case 'python':
        instructions += `**Python:**\n- Install Python 3.x from python.org\n- Run: \`pip install -r requirements.txt\` (if needed)\n\n`;
        break;
      case 'javascript':
        instructions += `**JavaScript (Node.js):**\n- Install Node.js from nodejs.org\n- Run: \`npm init -y && npm install\` (if needed)\n\n`;
        break;
      case 'typescript':
        instructions += `**TypeScript:**\n- Install Node.js from nodejs.org\n- Run: \`npm install -g typescript ts-node\`\n- Or: \`npx ts-node yourfile.ts\`\n\n`;
        break;
      case 'java':
        instructions += `**Java:**\n- Install JDK from adoptium.net\n- Compile: \`javac FileName.java\`\n- Run: \`java FileName\`\n\n`;
        break;
      case 'cpp':
        instructions += `**C++:**\n- Install g++ (MinGW on Windows, Xcode on Mac, build-essential on Linux)\n- Compile: \`g++ -o program main.cpp\`\n- Run: \`./program\`\n\n`;
        break;
      case 'html':
        instructions += `**HTML/CSS:**\n- Simply open the .html file in any web browser\n- Or use VS Code Live Server extension\n\n`;
        break;
      case 'bash':
        instructions += `**Bash:**\n- Make executable: \`chmod +x script.sh\`\n- Run: \`./script.sh\` or \`bash script.sh\`\n\n`;
        break;
      case 'rust':
        instructions += `**Rust:**\n- Install Rust from rustup.rs\n- Run: \`cargo run\` (in cargo project) or \`rustc main.rs && ./main\`\n\n`;
        break;
      case 'go':
        instructions += `**Go:**\n- Install Go from go.dev\n- Run: \`go run main.go\`\n\n`;
        break;
    }
  }
  
  instructions += '### Step 3: Run the Code\n';
  for (const file of files) {
    const config = LANGUAGE_CONFIG[file.language];
    if (config) {
      instructions += `- \`${file.name}\`: ${config.runCommand} ${file.name}\n`;
    }
  }
  
  return instructions;
}

const STORAGE_KEY = 'archimedes-code-playground-session';

function loadSavedSession(): { files: CodeFile[]; activeFileId: string } | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load code playground session:', e);
  }
  return null;
}

function saveSession(files: CodeFile[], activeFileId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, activeFileId }));
  } catch (e) {
    console.error('Failed to save code playground session:', e);
  }
}

const EXECUTABLE_LANGUAGES = ['python', 'javascript', 'typescript', 'bash', 'cpp', 'c', 'go', 'rust', 'ruby', 'php', 'html'];

function renderOutputSpecial(output: string): { type: 'json' | 'csv' | 'svg' | 'xml' | 'text'; data: any } {
  const trimmed = output.trim();
  
  // Try JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return { type: 'json', data: JSON.parse(trimmed) };
    } catch { }
  }
  
  // Try SVG
  if (trimmed.startsWith('<svg')) {
    return { type: 'svg', data: trimmed };
  }
  
  // Try XML/HTML (but not our iframe HTML)
  if (trimmed.startsWith('<') && !trimmed.includes('srcdoc')) {
    return { type: 'xml', data: trimmed };
  }
  
  // Try CSV (basic detection: lines with comma-separated values)
  if (trimmed.includes('\n') && trimmed.split('\n').every(line => line.split(',').length > 1)) {
    const lines = trimmed.split('\n').map(l => l.split(',').map(v => v.trim()));
    return { type: 'csv', data: lines };
  }
  
  return { type: 'text', data: output };
}

function JsonViewer({ data }: { data: any }) {
  return (
    <pre className="p-3 bg-black/20 rounded text-[#00FF41] text-xs font-mono overflow-x-auto max-h-96">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function CsvTable({ data }: { data: string[][] }) {
  return (
    <div className="overflow-x-auto max-h-96">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#00FF41]/10 border-b border-[#00FF41]/30">
            {data[0]?.map((cell, i) => (
              <th key={i} className="px-3 py-2 text-[#00FF41] font-mono text-left border-r border-[#00FF41]/20">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(1).map((row, ri) => (
            <tr key={ri} className="border-b border-[#00FF41]/10 hover:bg-[#00FF41]/5">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-[#00FF41]/80 font-mono border-r border-[#00FF41]/10">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SvgViewer({ data }: { data: string }) {
  return (
    <div className="p-3 bg-black/20 rounded overflow-x-auto max-h-96">
      <div dangerouslySetInnerHTML={{ __html: data }} />
    </div>
  );
}

export function CodePlayground({ onClose, initialCode, initialLanguage }: CodePlaygroundProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [guiOutput, setGuiOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stdinInput, setStdinInput] = useState<string>('');
  const [outputType, setOutputType] = useState<'json' | 'csv' | 'svg' | 'xml' | 'text'>('text');
  const [parsedData, setParsedData] = useState<any>(null);
  const editorRef = useRef<any>(null);
  const isInitialized = useRef(false);
  
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    if (initialCode) {
      const extractedFiles = extractCodeBlocksFromText(initialCode);
      if (extractedFiles.length > 0) {
        setFiles(extractedFiles);
        setActiveFileId(extractedFiles[0].id);
      } else {
        const lang = initialLanguage || detectLanguage(initialCode);
        const newFile: CodeFile = {
          id: `file-${Date.now()}`,
          name: getDefaultFilename(lang, 0),
          language: lang,
          content: initialCode
        };
        setFiles([newFile]);
        setActiveFileId(newFile.id);
      }
    } else {
      const savedSession = loadSavedSession();
      if (savedSession) {
        setFiles(savedSession.files);
        setActiveFileId(savedSession.activeFileId);
      } else {
        const defaultFile: CodeFile = {
          id: `file-${Date.now()}`,
          name: 'main.py',
          language: 'python',
          content: '# Start coding here\nprint("Hello, World!")'
        };
        setFiles([defaultFile]);
        setActiveFileId(defaultFile.id);
      }
    }
  }, [initialCode, initialLanguage]);
  
  useEffect(() => {
    if (files.length > 0 && activeFileId) {
      saveSession(files, activeFileId);
    }
  }, [files, activeFileId]);
  
  const activeFile = files.find(f => f.id === activeFileId);
  
  const updateFileContent = useCallback((content: string) => {
    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, content } : f
    ));
  }, [activeFileId]);
  
  const updateFileName = useCallback((id: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    let newLang = files.find(f => f.id === id)?.language || 'javascript';
    
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
      if (config.extension === `.${ext}`) {
        newLang = lang;
        break;
      }
    }
    
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, name, language: newLang } : f
    ));
  }, [files]);
  
  const addNewFile = useCallback(() => {
    const newFile: CodeFile = {
      id: `file-${Date.now()}`,
      name: `file${files.length + 1}.js`,
      language: 'javascript',
      content: '// New file\n'
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  }, [files.length]);
  
  const deleteFile = useCallback((id: string) => {
    if (files.length <= 1) {
      toast({ title: "Cannot delete", description: "Must have at least one file.", variant: "destructive" });
      return;
    }
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      if (activeFileId === id && newFiles.length > 0) {
        setActiveFileId(newFiles[0].id);
      }
      return newFiles;
    });
  }, [files.length, activeFileId, toast]);
  
  const downloadFile = useCallback((file: CodeFile) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `${file.name} saved to your computer.` });
  }, [toast]);
  
  const downloadAllFiles = useCallback(() => {
    files.forEach(file => {
      setTimeout(() => downloadFile(file), 100);
    });
  }, [files, downloadFile]);
  
  const copyToClipboard = useCallback(async (file: CodeFile) => {
    await navigator.clipboard.writeText(file.content);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: `${file.name} copied to clipboard.` });
  }, [toast]);
  
  // Detect output type when output changes
  useEffect(() => {
    if (output && output !== 'Running...\n') {
      const result = renderOutputSpecial(output);
      setOutputType(result.type);
      setParsedData(result.data);
    }
  }, [output]);

  const runMutation = useMutation({
    mutationFn: async (data: { code: string; language: string; stdin?: string }) => {
      const response = await apiRequest('POST', '/api/execute', data);
      return response.json();
    },
    onSuccess: (data) => {
      const outputText = data.success 
        ? `${data.output || 'Execution complete.'}\n\n✓ Completed in ${data.executionTime || '0'}s`
        : `ERROR:\n${data.error}\n\n${data.output || ''}`;
      setOutput(outputText);
      setGuiOutput(data.guiOutput || null);
      setIsRunning(false);
    },
    onError: (error: any) => {
      setOutput(`Error: ${error.message || 'Execution failed'}`);
      setGuiOutput(null);
      setIsRunning(false);
    }
  });
  
  const runCode = useCallback(() => {
    if (!activeFile) return;
    setIsRunning(true);
    setOutput('Running...\n');
    const stdinLines = stdinInput.split('\n').filter(l => l.trim());
    runMutation.mutate({ 
      code: activeFile.content, 
      language: activeFile.language,
      stdin: stdinLines.length > 0 ? stdinInput : undefined
    });
  }, [activeFile, runMutation, stdinInput]);
  
  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    monaco.editor.defineTheme('archimedes-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00FF41' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'type', foreground: '4EC9B0' },
      ],
      colors: {
        'editor.background': '#0D1117',
        'editor.foreground': '#00FF41',
        'editor.lineHighlightBackground': '#1a2332',
        'editorCursor.foreground': '#00FF41',
        'editor.selectionBackground': '#00FF4133',
        'editorLineNumber.foreground': '#00FF4166',
        'editorLineNumber.activeForeground': '#00FF41',
      }
    });
    monaco.editor.setTheme('archimedes-dark');
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" data-testid="code-playground">
      <div className="w-[95vw] h-[90vh] max-w-7xl bg-[#0D1117] border border-[#00FF41]/30 rounded-lg overflow-hidden flex flex-col shadow-2xl shadow-[#00FF41]/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-[#00FF41]/30">
          <div className="flex items-center gap-3">
            <FileCode className="w-5 h-5 text-[#00FF41]" />
            <h2 className="text-[#00FF41] font-mono font-bold text-lg">CODE PLAYGROUND</h2>
            <span className="text-[#00FF41]/60 text-xs font-mono">Multi-Language Editor</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowInstructions(!showInstructions)}
              variant="ghost"
              size="sm"
              className="text-[#00FF41] hover:bg-[#00FF41]/20 text-xs"
              data-testid="button-toggle-instructions"
            >
              <Info className="w-4 h-4 mr-1" />
              {showInstructions ? 'Hide' : 'Show'} Instructions
            </Button>
            <Button
              onClick={downloadAllFiles}
              variant="ghost"
              size="sm"
              className="text-[#00FF41] hover:bg-[#00FF41]/20 text-xs"
              data-testid="button-download-all"
            >
              <Download className="w-4 h-4 mr-1" />
              Download All ({files.length})
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm" className="text-[#00FF41] hover:bg-[#00FF41]/20">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* Instructions Panel (collapsible) */}
        {showInstructions && (
          <div className="px-4 py-3 bg-black/30 border-b border-[#00FF41]/20 max-h-48 overflow-y-auto">
            <pre className="text-[#00FF41]/80 text-xs font-mono whitespace-pre-wrap">
              {generateLocalInstructions(files)}
            </pre>
          </div>
        )}
        
        <div className="flex-1 flex overflow-hidden">
          {/* File Tabs Sidebar */}
          <div className="w-48 bg-black/40 border-r border-[#00FF41]/20 flex flex-col">
            <div className="p-2 border-b border-[#00FF41]/20">
              <Button
                onClick={addNewFile}
                variant="ghost"
                size="sm"
                className="w-full text-[#00FF41] hover:bg-[#00FF41]/20 text-xs justify-start"
                data-testid="button-add-file"
              >
                <Plus className="w-4 h-4 mr-2" />
                New File
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {files.map(file => {
                  const config = LANGUAGE_CONFIG[file.language];
                  return (
                    <div
                      key={file.id}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                        activeFileId === file.id 
                          ? 'bg-[#00FF41]/20 border border-[#00FF41]/40' 
                          : 'hover:bg-[#00FF41]/10 border border-transparent'
                      }`}
                      onClick={() => setActiveFileId(file.id)}
                      data-testid={`file-tab-${file.id}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <span className="text-sm">{config?.icon || '📄'}</span>
                        <input
                          type="text"
                          value={file.name}
                          onChange={(e) => updateFileName(file.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent text-[#00FF41] text-xs font-mono w-full outline-none truncate"
                          data-testid={`input-filename-${file.id}`}
                        />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(file); }}
                          className="p-1 hover:bg-[#00FF41]/20 rounded"
                          data-testid={`button-copy-${file.id}`}
                        >
                          {copiedId === file.id ? <Check className="w-3 h-3 text-[#00FF41]" /> : <Copy className="w-3 h-3 text-[#00FF41]/60" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                          className="p-1 hover:bg-[#00FF41]/20 rounded"
                          data-testid={`button-download-${file.id}`}
                        >
                          <Download className="w-3 h-3 text-[#00FF41]/60" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                          className="p-1 hover:bg-red-500/20 rounded"
                          data-testid={`button-delete-${file.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-red-400/60" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          
          {/* Editor Panel */}
          <div className="flex-1 flex flex-col">
            {activeFile && (
              <>
                {/* Editor Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-black/30 border-b border-[#00FF41]/20">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{LANGUAGE_CONFIG[activeFile.language]?.icon || '📄'}</span>
                    <span className="text-[#00FF41] font-mono text-sm">{activeFile.name}</span>
                    <span className="text-[#00FF41]/50 text-xs font-mono">
                      {LANGUAGE_CONFIG[activeFile.language]?.displayName || activeFile.language}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={runCode}
                      disabled={isRunning || !EXECUTABLE_LANGUAGES.includes(activeFile.language)}
                      size="sm"
                      className="bg-[#00FF41] text-black hover:bg-[#00FF41]/80 font-mono text-xs"
                      data-testid="button-run-code"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      {isRunning ? 'Running...' : 'Run'}
                    </Button>
                  </div>
                </div>
                
                {/* Monaco Editor */}
                <div className="flex-1">
                  <Editor
                    height="100%"
                    language={LANGUAGE_CONFIG[activeFile.language]?.monacoLang || 'plaintext'}
                    value={activeFile.content}
                    onChange={(value) => updateFileContent(value || '')}
                    onMount={handleEditorMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: 'on',
                      padding: { top: 10 },
                      fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
                      fontLigatures: true,
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                    }}
                  />
                </div>
              </>
            )}
          </div>
          
          {/* Output Panel */}
          <div className="w-96 bg-black/40 border-l border-[#00FF41]/20 flex flex-col">
            <div className="px-4 py-2 bg-black/30 border-b border-[#00FF41]/20 flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-[#00FF41]" />
              <span className="text-[#00FF41] font-mono text-sm">Output</span>
            </div>
            
            {/* Stdin input field */}
            <div className="px-3 py-2 border-b border-[#00FF41]/20 bg-black/20">
              <label className="text-[#00FF41] text-xs font-mono mb-1 block">Stdin (lines):</label>
              <textarea
                value={stdinInput}
                onChange={(e) => setStdinInput(e.target.value)}
                placeholder="Enter input for programs needing stdin..."
                className="w-full bg-black/40 text-[#00FF41] text-xs font-mono p-2 rounded border border-[#00FF41]/20 focus:border-[#00FF41]/50 outline-none resize-none h-16"
                data-testid="input-stdin"
              />
            </div>
            
            <ScrollArea className="flex-1">
              {guiOutput && (
                <div className="p-4 border-b border-[#00FF41]/20">
                  <div 
                    className="rounded overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: guiOutput }} 
                  />
                </div>
              )}
              
              {/* Rendered output viewers */}
              {output && output !== 'Running...\n' && (
                <div className="p-4">
                  {outputType === 'json' && parsedData && <JsonViewer data={parsedData} />}
                  {outputType === 'csv' && parsedData && <CsvTable data={parsedData} />}
                  {outputType === 'svg' && parsedData && <SvgViewer data={parsedData} />}
                  {outputType === 'xml' && parsedData && (
                    <pre className="p-3 bg-black/20 rounded text-[#00FF41] text-xs font-mono overflow-x-auto max-h-96">
                      {parsedData}
                    </pre>
                  )}
                  {outputType === 'text' && (
                    <pre className="text-[#00FF41]/80 font-mono text-xs whitespace-pre-wrap">
                      {output}
                    </pre>
                  )}
                </div>
              )}
              
              {(!output || output === 'Running...\n') && (
                <pre className="p-4 text-[#00FF41]/80 font-mono text-xs whitespace-pre-wrap">
                  {output || `Run code to see output...

✨ Features:
• Interactive stdin input ↑
• Auto-detect: JSON, CSV, SVG
• GUI preview (matplotlib, tkinter)
• Multi-file support
• HTML preview + sandbox

Supported languages:
• Python (with GUI)
• JavaScript/TypeScript
• Bash/Shell • C/C++
• Go • Rust • Ruby • PHP`}
                </pre>
              )}
            </ScrollArea>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-2 bg-black/50 border-t border-[#00FF41]/30 flex items-center justify-between">
          <div className="text-[#00FF41]/50 font-mono text-xs">
            {files.length} file{files.length !== 1 ? 's' : ''} • 
            Languages: {Array.from(new Set(files.map(f => LANGUAGE_CONFIG[f.language]?.displayName || f.language))).join(', ')}
          </div>
          <div className="text-[#00FF41]/50 font-mono text-xs">
            Auto-detect language • Click file to rename • Download for local use
          </div>
        </div>
      </div>
    </div>
  );
}

export const MemoizedCodePlayground = CodePlayground;
