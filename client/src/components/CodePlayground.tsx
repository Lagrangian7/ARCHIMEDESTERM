import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  X, Download, Play, FileCode, Copy, Check, Plus, Trash2, 
  FileText, Terminal as TerminalIcon, Info, ChevronDown, ChevronUp, Table2, Bot, 
  Maximize, Minimize, Eye, GitBranch, FolderOpen, RefreshCw
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import playIcon from '../../../attached_assets/play icon.png';

// Project Templates
const PROJECT_TEMPLATES: Record<string, { name: string; icon: string; description: string; files: { name: string; language: string; content: string }[] }> = {
  'flask-api': {
    name: 'Flask API',
    icon: '🌶️',
    description: 'Python Flask REST API starter',
    files: [
      { name: 'app.py', language: 'python', content: `from flask import Flask, jsonify, request

app = Flask(__name__)

# Sample data store
items = []

@app.route('/api/items', methods=['GET'])
def get_items():
    return jsonify(items)

@app.route('/api/items', methods=['POST'])
def add_item():
    data = request.get_json()
    items.append(data)
    return jsonify(data), 201

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    if 0 <= item_id < len(items):
        deleted = items.pop(item_id)
        return jsonify(deleted)
    return jsonify({'error': 'Not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)
` },
      { name: 'requirements.txt', language: 'text', content: `flask>=2.0.0
python-dotenv>=0.19.0
` }
    ]
  },
  'react-app': {
    name: 'React App',
    icon: '⚛️',
    description: 'React component with hooks',
    files: [
      { name: 'App.tsx', language: 'typescript', content: `import { useState, useEffect } from 'react';

interface Item {
  id: number;
  name: string;
  completed: boolean;
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems([...items, { id: Date.now(), name: newItem, completed: false }]);
    setNewItem('');
  };

  const toggleItem = (id: number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Todo List</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add new item..."
          style={{ padding: '8px', flex: 1 }}
        />
        <button onClick={addItem}>Add</button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map(item => (
          <li 
            key={item.id}
            onClick={() => toggleItem(item.id)}
            style={{ 
              padding: '10px', 
              cursor: 'pointer',
              textDecoration: item.completed ? 'line-through' : 'none',
              opacity: item.completed ? 0.6 : 1
            }}
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
` }
    ]
  },
  'express-api': {
    name: 'Express API',
    icon: '🚀',
    description: 'Node.js Express REST API',
    files: [
      { name: 'server.js', language: 'javascript', content: `const express = require('express');
const app = express();

app.use(express.json());

// In-memory store
let items = [];
let nextId = 1;

// Get all items
app.get('/api/items', (req, res) => {
  res.json(items);
});

// Create item
app.post('/api/items', (req, res) => {
  const item = { id: nextId++, ...req.body };
  items.push(item);
  res.status(201).json(item);
});

// Update item
app.put('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  items[index] = { ...items[index], ...req.body };
  res.json(items[index]);
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  items = items.filter(i => i.id !== id);
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
` }
    ]
  },
  'html-page': {
    name: 'HTML Page',
    icon: '🌐',
    description: 'Responsive HTML/CSS/JS page',
    files: [
      { name: 'index.html', language: 'html', content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Web Page</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: system-ui, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 500px;
      width: 90%;
    }
    h1 { color: #333; margin-bottom: 1rem; }
    p { color: #666; line-height: 1.6; }
    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 1rem;
      font-size: 1rem;
    }
    button:hover { background: #5a6fd6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome!</h1>
    <p>This is a responsive HTML page template with modern CSS styling.</p>
    <button onclick="showAlert()">Click Me</button>
  </div>
  <script>
    function showAlert() {
      alert('Hello from JavaScript!');
    }
  </script>
</body>
</html>
` }
    ]
  },
  'python-script': {
    name: 'Python Script',
    icon: '🐍',
    description: 'Python utility script',
    files: [
      { name: 'main.py', language: 'python', content: `#!/usr/bin/env python3
"""
A simple Python script template with common patterns.
"""

import json
import os
from datetime import datetime
from typing import List, Dict, Any

def load_config(filepath: str = 'config.json') -> Dict[str, Any]:
    """Load configuration from a JSON file."""
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    return {}

def process_data(items: List[str]) -> List[str]:
    """Process a list of items and return results."""
    return [item.strip().upper() for item in items if item.strip()]

def main():
    """Main entry point."""
    print(f"Script started at {datetime.now().isoformat()}")
    
    # Example usage
    sample_data = ["hello", "  world  ", "", "python"]
    result = process_data(sample_data)
    
    print(f"Processed {len(result)} items:")
    for item in result:
        print(f"  - {item}")
    
    print("\\nScript completed successfully!")

if __name__ == '__main__':
    main()
` }
    ]
  },
  'vue-component': {
    name: 'Vue Component',
    icon: '💚',
    description: 'Vue 3 component with Composition API',
    files: [
      { name: 'App.vue', language: 'html', content: `<template>
  <div class="app">
    <h1>{{ title }}</h1>
    <div class="controls">
      <input v-model="newTodo" @keyup.enter="addTodo" placeholder="Add todo..." />
      <button @click="addTodo">Add</button>
    </div>
    <ul class="todo-list">
      <li v-for="todo in todos" :key="todo.id" 
          :class="{ completed: todo.done }"
          @click="toggleTodo(todo.id)">
        {{ todo.text }}
      </li>
    </ul>
    <p class="stats">{{ completedCount }} / {{ todos.length }} completed</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const title = ref('Vue Todo App')
const newTodo = ref('')
const todos = ref([
  { id: 1, text: 'Learn Vue 3', done: true },
  { id: 2, text: 'Build something awesome', done: false }
])

const completedCount = computed(() => 
  todos.value.filter(t => t.done).length
)

function addTodo() {
  if (!newTodo.value.trim()) return
  todos.value.push({
    id: Date.now(),
    text: newTodo.value,
    done: false
  })
  newTodo.value = ''
}

function toggleTodo(id) {
  const todo = todos.value.find(t => t.id === id)
  if (todo) todo.done = !todo.done
}
</script>

<style scoped>
.app { padding: 20px; font-family: sans-serif; }
.controls { display: flex; gap: 10px; margin: 20px 0; }
input { flex: 1; padding: 8px; }
.todo-list { list-style: none; padding: 0; }
.todo-list li { padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; }
.todo-list li.completed { text-decoration: line-through; opacity: 0.6; }
.stats { color: #666; margin-top: 20px; }
</style>
` }
    ]
  }
};

type MonacoAIMode = 'natural' | 'technical' | 'freestyle' | 'health';

const MONACO_AI_MODE_KEY = 'monaco-ai-mode';

const AI_MODE_CONFIG: Record<MonacoAIMode, { label: string; icon: string; description: string }> = {
  natural: { label: 'Natural', icon: '💬', description: 'Conversational coding help' },
  technical: { label: 'Technical', icon: '🔧', description: 'Step-by-step technical guides' },
  freestyle: { label: 'Freestyle', icon: '🎨', description: 'Creative code generation' },
  health: { label: 'Health', icon: '🌿', description: 'Wellness-focused assistance' },
};

interface CodePlaygroundProps {
  onClose: () => void;
  initialCode?: string;
  initialLanguage?: string;
  currentTheme?: string;
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

export function cleanCodeFormatting(code: string): string {
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

export function extractCodeBlocksFromText(text: string): CodeFile[] {
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

export type { CodeFile };

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

export function CodePlayground({ onClose, initialCode, initialLanguage, currentTheme = 'green' }: CodePlaygroundProps) {
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
  const lastInitialCodeRef = useRef<string | null>(null);

  // Window management state
  const [isMaximized, setIsMaximized] = useState(false); // Start in regular size by default
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ width: 0, height: 0, mouseX: 0, mouseY: 0 });

  const [monacoAIMode, setMonacoAIMode] = useState<MonacoAIMode>(() => {
    const saved = localStorage.getItem(MONACO_AI_MODE_KEY);
    return (saved === 'natural' || saved === 'technical' || saved === 'freestyle' || saved === 'health') 
      ? saved : 'freestyle';
  });

  const [showOutput, setShowOutput] = useState(true);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [gitCommits, setGitCommits] = useState<Array<{ hash: string; message: string; date: string; author: string }>>([]);
  const [gitLoading, setGitLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(MONACO_AI_MODE_KEY, monacoAIMode);
  }, [monacoAIMode]);

  // Live preview content - combines HTML, CSS, JS files and auto-updates on changes
  const livePreviewContent = useMemo(() => {
    const htmlFile = files.find(f => f.language === 'html');
    const cssFile = files.find(f => f.language === 'css');
    const jsFile = files.find(f => f.language === 'javascript');
    
    if (htmlFile) {
      let content = htmlFile.content;
      // Inject CSS if separate file exists
      if (cssFile && !content.includes(cssFile.content)) {
        content = content.replace('</head>', `<style>${cssFile.content}</style></head>`);
      }
      // Inject JS if separate file exists  
      if (jsFile && !content.includes(jsFile.content)) {
        content = content.replace('</body>', `<script>${jsFile.content}</script></body>`);
      }
      return content;
    }
    return '';
  }, [files]);
  
  // Generate unique key for iframe to force refresh on content changes
  const livePreviewKey = useMemo(() => {
    return `preview-${Date.now()}-${livePreviewContent.length}`;
  }, [livePreviewContent]);

  // Load template
  const loadTemplate = (templateId: string) => {
    const template = PROJECT_TEMPLATES[templateId];
    if (!template) return;
    
    const newFiles: CodeFile[] = template.files.map((f, i) => ({
      id: `template-${Date.now()}-${i}`,
      name: f.name,
      language: f.language,
      content: f.content
    }));
    
    setFiles(newFiles);
    if (newFiles.length > 0) {
      setActiveFileId(newFiles[0].id);
    }
    setShowTemplates(false);
    toast({ title: `Loaded ${template.name} template`, description: `${newFiles.length} file(s) created` });
  };

  // Fetch git status
  const fetchGitInfo = async () => {
    setGitLoading(true);
    try {
      const response = await fetch('/api/git/log');
      if (response.ok) {
        const data = await response.json();
        setGitCommits(data.commits || []);
      }
    } catch (e) {
      console.error('Failed to fetch git info:', e);
    }
    setGitLoading(false);
  };

  // Initialize with regular size positioned at top-right
  useEffect(() => {
    const terminalAreaTop = 60;
    const width = 900;
    const height = 600;
    const rightX = Math.max(0, window.innerWidth - width - 20);
    const topY = terminalAreaTop + 20;
    
    setDimensions({ width, height });
    setPosition({ x: rightX, y: topY });
  }, []);

  // Handle maximize toggle (matching Workshop behavior)
  const toggleMaximize = useCallback(() => {
    const terminalAreaTop = 60;
    const terminalAreaBottom = 60;

    if (isMaximized) {
      const width = 900;
      const height = 700;
      setDimensions({ width, height });
      const rightX = window.innerWidth - width - 20;
      const topY = 50;
      setPosition({ x: Math.max(0, rightX), y: Math.max(terminalAreaTop, topY) });
      setIsMaximized(false);
    } else {
      setIsMaximized(true);
      setDimensions({ width: window.innerWidth, height: window.innerHeight - terminalAreaTop - terminalAreaBottom });
      setPosition({ x: 0, y: terminalAreaTop });
    }
  }, [isMaximized]);

  // Mouse move handler for dragging (matching Workshop behavior)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const terminalAreaTop = 60;

    if (isDragging) {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setPosition(prev => ({
        x: Math.max(0, Math.min(window.innerWidth - 300, prev.x + deltaX)),
        y: Math.max(terminalAreaTop, Math.min(window.innerHeight - 200, prev.y + deltaY))
      }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (isResizing) {
      const deltaWidth = e.clientX - resizeStartRef.current.mouseX;
      const deltaHeight = e.clientY - resizeStartRef.current.mouseY;
      setDimensions(prev => ({
        width: Math.max(300, Math.min(window.innerWidth - position.x, prev.width + deltaWidth)),
        height: Math.max(300, Math.min(window.innerHeight - position.y - 60, prev.height + deltaHeight))
      }));
      resizeStartRef.current.mouseX = e.clientX;
      resizeStartRef.current.mouseY = e.clientY;
    }
  }, [isDragging, isResizing, position.x, position.y]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // Attach mouse event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Prevent Terminal component from stealing focus
  useEffect(() => {
    const playground = document.querySelector('[data-testid="code-playground"]');
    if (playground) {
      playground.setAttribute('data-no-terminal-autofocus', 'true');
    }
    return () => {
      if (playground) {
        playground.removeAttribute('data-no-terminal-autofocus');
      }
    };
  }, []);

  useEffect(() => {
    // ALWAYS clear old saved session on mount to prevent stale code
    localStorage.removeItem(STORAGE_KEY);

    if (initialCode) {
      // Use the provided initialCode
      lastInitialCodeRef.current = initialCode;

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
      // Start with empty editor - no saved session
      const defaultFile: CodeFile = {
        id: `file-${Date.now()}`,
        name: 'main.py',
        language: 'python',
        content: '# Write your code here\n'
      };
      setFiles([defaultFile]);
      setActiveFileId(defaultFile.id);
    }
  }, [initialCode, initialLanguage]);

  // Note: We no longer auto-save to localStorage to prevent stale code issues
  // Users can manually save/download their code instead

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

    // Listen for all content changes including AI-generated suggestions
    const model = editor.getModel();
    if (model) {
      model.onDidChangeContent(() => {
        const currentContent = editor.getValue();
        updateFileContent(currentContent);
      });
    }

    // Ensure editor gets and maintains focus
    setTimeout(() => {
      editor.focus();
      // Prevent focus loss by stopping event propagation on editor interactions
      const domNode = editor.getDomNode();
      if (domNode) {
        domNode.addEventListener('mousedown', (e: MouseEvent) => e.stopPropagation());
        domNode.addEventListener('click', (e: MouseEvent) => e.stopPropagation());
      }
    }, 100);

    // Get theme colors from CSS variables and convert HSL to hex
    const computedStyle = getComputedStyle(document.documentElement);
    const terminalBg = computedStyle.getPropertyValue('--terminal-bg').trim() || '#0D1117';
    const terminalText = computedStyle.getPropertyValue('--terminal-text').trim() || '#00FF41';
    const terminalHighlight = computedStyle.getPropertyValue('--terminal-highlight').trim() || '#00FF41';
    const terminalSubtle = computedStyle.getPropertyValue('--terminal-subtle').trim() || '#1a2332';

    // Convert HSL to hex
    const hslToHex = (hslString: string): string => {
      if (hslString.startsWith('#')) return hslString.replace('#', '');
      
      const hslMatch = hslString.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
      if (!hslMatch) return '00FF41'; // fallback
      
      const h = parseInt(hslMatch[1]);
      const s = parseInt(hslMatch[2]) / 100;
      const l = parseInt(hslMatch[3]) / 100;
      
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = l - c / 2;
      
      let r = 0, g = 0, b = 0;
      if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
      else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
      else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
      else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
      else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
      else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }
      
      const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return toHex(r) + toHex(g) + toHex(b);
    };

    const getHexColor = (color: string) => hslToHex(color);

    monaco.editor.defineTheme('archimedes-dynamic', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: getHexColor(terminalHighlight) },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'type', foreground: '4EC9B0' },
      ],
      colors: {
        'editor.background': terminalBg.startsWith('#') ? terminalBg : '#0D1117',
        'editor.foreground': terminalText.startsWith('#') ? terminalText : '#00FF41',
        'editor.lineHighlightBackground': terminalSubtle.startsWith('#') ? terminalSubtle : '#1a2332',
        'editorCursor.foreground': terminalHighlight.startsWith('#') ? terminalHighlight : '#00FF41',
        'editor.selectionBackground': (terminalHighlight.startsWith('#') ? terminalHighlight : '#00FF41') + '33',
        'editorLineNumber.foreground': (terminalHighlight.startsWith('#') ? terminalHighlight : '#00FF41') + '66',
        'editorLineNumber.activeForeground': terminalHighlight.startsWith('#') ? terminalHighlight : '#00FF41',
      }
    });
    monaco.editor.setTheme('archimedes-dynamic');
  };

  return (
    <div 
      className={`theme-${currentTheme} flex flex-col border-2 rounded-lg shadow-2xl overflow-hidden`}
      style={{
        position: 'fixed',
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        zIndex: 40,
        backgroundColor: 'var(--terminal-bg)',
        borderColor: 'var(--terminal-highlight)',
      }}
      data-testid="code-playground"
    >
      {/* Header with drag handle */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-move"
        style={{
          backgroundColor: 'var(--terminal-bg)',
          borderBottom: '1px solid var(--terminal-subtle)',
        }}
        onMouseDown={(e) => {
          if (!isMaximized && e.button === 0) {
            setIsDragging(true);
            dragStartRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onDoubleClick={toggleMaximize}
      >
        <div className="flex items-center gap-3">
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleMaximize}
            variant="ghost"
            size="sm"
            className="text-xs px-2"
            style={{
              color: 'var(--terminal-highlight)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--terminal-subtle-rgb), 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? '🗗' : '🗖'}
          </Button>
          {/* Monaco AI Mode Selector */}
          <div className="flex items-center gap-2 px-2 py-1 bg-black/40 rounded border border-[#00FF41]/20">
            <Bot className="w-4 h-4 text-[#00FF41]" />
            <Select value={monacoAIMode} onValueChange={(v: MonacoAIMode) => setMonacoAIMode(v)}>
              <SelectTrigger className="w-32 h-7 bg-transparent border-none text-[#00FF41] text-xs font-mono focus:ring-0" data-testid="select-monaco-ai-mode">
                <SelectValue>
                  {AI_MODE_CONFIG[monacoAIMode].icon} {AI_MODE_CONFIG[monacoAIMode].label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#0D1117] border-[#00FF41]/30">
                {(Object.keys(AI_MODE_CONFIG) as MonacoAIMode[]).map((mode) => (
                  <SelectItem 
                    key={mode} 
                    value={mode}
                    className="text-[#00FF41] hover:bg-[#00FF41]/20 focus:bg-[#00FF41]/20 font-mono text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span>{AI_MODE_CONFIG[mode].icon}</span>
                      <span>{AI_MODE_CONFIG[mode].label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Templates Button */}
          <Button
            onClick={() => setShowTemplates(!showTemplates)}
            variant="ghost"
            size="sm"
            className={`text-xs ${showTemplates ? 'bg-[#00FF41]/20' : ''}`}
            style={{ color: 'var(--terminal-highlight)' }}
            data-testid="button-templates"
            title="Project Templates"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            Templates
          </Button>
          {/* Live Preview Button (only for HTML files) */}
          {files.some(f => f.language === 'html') && (
            <Button
              onClick={() => setShowLivePreview(!showLivePreview)}
              variant="ghost"
              size="sm"
              className={`text-xs ${showLivePreview ? 'bg-[#00FF41]/20' : ''}`}
              style={{ color: 'var(--terminal-highlight)' }}
              data-testid="button-live-preview"
              title="Live Preview"
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
          )}
          {/* Git Panel Button */}
          <Button
            onClick={() => {
              setShowGitPanel(!showGitPanel);
              if (!showGitPanel) fetchGitInfo();
            }}
            variant="ghost"
            size="sm"
            className={`text-xs ${showGitPanel ? 'bg-[#00FF41]/20' : ''}`}
            style={{ color: 'var(--terminal-highlight)' }}
            data-testid="button-git-panel"
            title="Git History"
          >
            <GitBranch className="w-4 h-4 mr-1" />
            Git
          </Button>
          <Button
            onClick={() => setShowOutput(!showOutput)}
            variant="ghost"
            size="sm"
            className="text-[#00FF41] hover:bg-[#00FF41]/20 text-xs"
            data-testid="button-expand-workspace"
            title={showOutput ? 'Expand Workspace' : 'Show Output'}
          >
            {showOutput ? <Maximize className="w-4 h-4 mr-1" /> : <Minimize className="w-4 h-4 mr-1" />}
            {showOutput ? 'Expand' : 'Restore'}
          </Button>
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

      {/* Templates Panel (dropdown) */}
      {showTemplates && (
        <div className="px-4 py-3 bg-black/40 border-b border-[#00FF41]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#00FF41] font-mono text-sm">📁 Project Templates</span>
            <Button
              onClick={() => setShowTemplates(false)}
              variant="ghost"
              size="sm"
              className="text-[#00FF41]/60 hover:bg-[#00FF41]/20 h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PROJECT_TEMPLATES).map(([id, template]) => (
              <button
                key={id}
                onClick={() => loadTemplate(id)}
                className="flex items-center gap-2 px-3 py-2 rounded border border-[#00FF41]/20 hover:bg-[#00FF41]/10 hover:border-[#00FF41]/40 transition-colors text-left"
                data-testid={`template-${id}`}
              >
                <span className="text-xl">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[#00FF41] text-xs font-mono truncate">{template.name}</div>
                  <div className="text-[#00FF41]/50 text-[10px] truncate">{template.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Git Panel (dropdown) */}
      {showGitPanel && (
        <div className="px-4 py-3 bg-black/40 border-b border-[#00FF41]/20 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#00FF41] font-mono text-sm">
              <GitBranch className="w-4 h-4 inline mr-2" />
              Recent Commits
            </span>
            <div className="flex items-center gap-2">
              <Button
                onClick={fetchGitInfo}
                variant="ghost"
                size="sm"
                className="text-[#00FF41]/60 hover:bg-[#00FF41]/20 h-6 px-2"
                disabled={gitLoading}
              >
                <RefreshCw className={`w-3 h-3 ${gitLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={() => setShowGitPanel(false)}
                variant="ghost"
                size="sm"
                className="text-[#00FF41]/60 hover:bg-[#00FF41]/20 h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {gitLoading ? (
            <div className="text-[#00FF41]/50 text-xs font-mono py-2">Loading commits...</div>
          ) : gitCommits.length > 0 ? (
            <div className="space-y-1">
              {gitCommits.slice(0, 10).map((commit, i) => (
                <div 
                  key={commit.hash}
                  className="flex items-start gap-2 px-2 py-1 rounded hover:bg-[#00FF41]/5 border-l-2 border-[#00FF41]/20"
                >
                  <code className="text-[#00FF41]/40 text-[10px] font-mono shrink-0">{commit.hash.slice(0, 7)}</code>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#00FF41]/80 text-xs font-mono truncate">{commit.message}</div>
                    <div className="text-[#00FF41]/40 text-[10px]">{commit.author} • {commit.date}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[#00FF41]/50 text-xs font-mono py-2">No commits found or git not initialized</div>
          )}
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
                    onClick={() => copyToClipboard(activeFile)}
                    variant="ghost"
                    size="sm"
                    className="text-[#00FF41] hover:bg-[#00FF41]/20 text-xs"
                    data-testid="button-copy-editor-code"
                    title="Copy code to clipboard"
                  >
                    {copiedId === activeFile.id ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Code
                      </>
                    )}
                  </Button>
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
                    suggest: {
                      showIcons: true,
                      showInlineDetails: true,
                    },
                    autoClosingBrackets: 'always',
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                  key={`${activeFile.id}-${activeFile.language}`}
                />
              </div>
            </>
          )}
        </div>

        {/* Live Preview Panel */}
        {showLivePreview && livePreviewContent && (
          <div className="w-96 bg-white border-l border-[#00FF41]/20 flex flex-col">
            <div className="px-4 py-2 bg-black/30 border-b border-[#00FF41]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#00FF41]" />
                <span className="text-[#00FF41] font-mono text-sm">Live Preview</span>
              </div>
              <Button
                onClick={() => setShowLivePreview(false)}
                variant="ghost"
                size="sm"
                className="text-[#00FF41]/60 hover:bg-[#00FF41]/20 h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 bg-white">
              <iframe
                key={livePreviewKey}
                srcDoc={livePreviewContent}
                className="w-full h-full border-0"
                sandbox="allow-scripts"
                title="Live Preview"
                data-testid="live-preview-iframe"
              />
            </div>
          </div>
        )}

        {/* Output Panel - conditionally rendered */}
        {showOutput && (
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
                  className={`rounded overflow-hidden matplotlib-output ${
                    guiOutput.includes('data:image/gif') ? 'matplotlib-animation-container' : ''
                  }`}
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
        )}
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

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-[#00FF41]/20 hover:bg-[#00FF41]/40"
          style={{
            borderRight: '2px solid #00FF41',
            borderBottom: '2px solid #00FF41',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizing(true);
            resizeStartRef.current = {
              width: dimensions.width,
              height: dimensions.height,
              mouseX: e.clientX,
              mouseY: e.clientY
            };
          }}
        />
      )}
    </div>
  );
}

export const MemoizedCodePlayground = CodePlayground;