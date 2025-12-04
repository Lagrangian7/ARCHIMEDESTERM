import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

interface Snippet {
  name: string;
  language: string;
  code: string;
  description: string;
}

const SNIPPETS: Record<string, Snippet[]> = {
  python: [
    {
      name: 'Flask App',
      language: 'python',
      description: 'Basic Flask web server',
      code: `from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "Hello, World!"})

@app.route('/api/data')
def get_data():
    return jsonify({"data": [1, 2, 3, 4, 5]})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)`
    },
    {
      name: 'Data Processing',
      language: 'python',
      description: 'Common data operations',
      code: `import pandas as pd
import numpy as np

# Load data
df = pd.read_csv('data.csv')

# Basic analysis
print(df.describe())
print(df.head())

# Filter and transform
filtered = df[df['value'] > 10]
df['new_column'] = df['value'] * 2

# Export
df.to_csv('output.csv', index=False)`
    },
    {
      name: 'API Request',
      language: 'python',
      description: 'Fetch data from API',
      code: `import requests
import json

def fetch_data(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

# Example usage
data = fetch_data('https://api.example.com/data')
if data:
    print(json.dumps(data, indent=2))`
    }
  ],
  javascript: [
    {
      name: 'Express Server',
      language: 'javascript',
      description: 'Basic Express.js server',
      code: `const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(5000, '0.0.0.0', () => {
  console.log('Server running on port 5000');
});`
    },
    {
      name: 'Async/Await',
      language: 'javascript',
      description: 'Modern async pattern',
      code: `async function fetchData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Usage
fetchData('https://api.example.com/data')
  .then(data => console.log(data))
  .catch(err => console.error(err));`
    }
  ]
};

interface CodeSnippetsProps {
  language: string;
  onInsert: (code: string) => void;
  theme: any;
}

export function CodeSnippets({ language, onInsert, theme }: CodeSnippetsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const snippets = SNIPPETS[language] || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [aiGeneratedSnippets, setAiGeneratedSnippets] = useState<Array<{
    name: string;
    description: string;
    code: string;
    language: string;
    category: string;
  }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateSnippetMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: `Generate a code snippet for: ${query}. Respond with just the code in a markdown block.`,
          mode: 'freestyle',
        }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.response) {
        const codeMatch = data.response.match(/```(\w+)?\n([\s\S]*?)```/);
        if (codeMatch) {
          const newSnippet = {
            name: `AI: ${searchQuery}`,
            description: 'AI-generated snippet',
            code: codeMatch[2].trim(),
            language: codeMatch[1] || 'python',
            category: 'ai-generated'
          };
          setAiGeneratedSnippets(prev => [newSnippet, ...prev]);
        }
      }
      setIsGenerating(false);
    },
    onError: () => setIsGenerating(false),
  });

  const handleAiGenerate = () => {
    if (searchQuery.trim() && !isGenerating) {
      setIsGenerating(true);
      generateSnippetMutation.mutate(searchQuery);
    }
  };

  const allSnippets = [
    ...aiGeneratedSnippets.map(s => ({ ...s, category: 'ai-generated' })),
    ...Object.entries(SNIPPETS)
      .flatMap(([category, snippets]) =>
        snippets.map(snippet => ({ ...snippet, category }))
      )
  ];

  const filteredSnippets = allSnippets
    .filter(snippet => {
      const matchesSearch = snippet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           snippet.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || snippet.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });


  const handleCopy = (code: string, index: number) => {
    onInsert(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (snippets.length === 0 && aiGeneratedSnippets.length === 0) {
    return (
      <div className="p-4 text-center" style={{ color: theme.text }}>
        <p className="text-sm opacity-70">No snippets available for {language}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="Search snippets or AI prompt..."
            className="flex-1 px-2 py-1 rounded border"
            style={{ backgroundColor: theme.subtle, borderColor: theme.border, color: theme.text }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button onClick={handleAiGenerate} disabled={isGenerating} style={{ backgroundColor: theme.highlight }}>
            {isGenerating ? 'Generating...' : 'AI Generate'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {['all', 'python', 'javascript', 'ai-generated'].map(category => (
            <Button
              key={category}
              variant="outline"
              size="sm"
              onClick={() => setSelectedCategory(category)}
              style={{
                backgroundColor: selectedCategory === category ? theme.highlight : theme.bg,
                borderColor: theme.border,
                color: selectedCategory === category ? theme.text : theme.text,
                opacity: selectedCategory === category ? 1 : 0.7
              }}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Button>
          ))}
        </div>
        {filteredSnippets.map((snippet, index) => (
          <div
            key={index}
            className="p-3 rounded border"
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.border
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-mono text-sm font-bold" style={{ color: theme.highlight }}>
                  {snippet.name}
                </h4>
                <p className="text-xs mt-1" style={{ color: theme.text, opacity: 0.7 }}>
                  {snippet.description}
                </p>
              </div>
              <Button
                onClick={() => handleCopy(snippet.code, index)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                style={{ color: theme.highlight }}
              >
                {copiedIndex === index ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <pre
              className="text-xs font-mono overflow-x-auto p-2 rounded"
              style={{
                backgroundColor: theme.subtle,
                color: theme.text
              }}
            >
              {snippet.code}
            </pre>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}