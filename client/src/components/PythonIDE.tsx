
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, X, BookOpen, Code, Loader2 } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface PythonIDEProps {
  onClose: () => void;
}

// Example programs for learning
const EXAMPLES = {
  hello: {
    title: "Hello World",
    description: "Your first Python program",
    code: `# Hello World - Your first Python program
print("Hello, World!")
print("Welcome to Python learning!")

# Try changing the message above and run it!`
  },
  variables: {
    title: "Variables & Data Types",
    description: "Learn about variables and basic data types",
    code: `# Variables and Data Types
name = "Alice"
age = 25
height = 5.6
is_student = True

print("Name:", name)
print("Age:", age)
print("Height:", height)
print("Student status:", is_student)

# Try creating your own variables!`
  },
  math: {
    title: "Math Operations",
    description: "Basic arithmetic and calculations",
    code: `# Math Operations
a = 10
b = 3

print("Addition:", a + b)
print("Subtraction:", a - b)
print("Multiplication:", a * b)
print("Division:", a / b)
print("Floor Division:", a // b)
print("Modulo:", a % b)
print("Power:", a ** b)

# Try different numbers!`
  },
  strings: {
    title: "Working with Strings",
    description: "String manipulation and formatting",
    code: `# String Operations
text = "Python"
message = "Hello, World!"

print("Length:", len(text))
print("Uppercase:", text.upper())
print("Lowercase:", message.lower())
print("Replace:", message.replace("World", "Python"))
print("Split:", message.split(","))

# String formatting
name = "Alice"
age = 25
print(f"My name is {name} and I am {age} years old")

# Try your own string operations!`
  },
  conditions: {
    title: "If-Else Statements",
    description: "Making decisions in your code",
    code: `# Conditional Statements
age = 18

if age >= 18:
    print("You are an adult")
else:
    print("You are a minor")

# Multiple conditions
score = 85

if score >= 90:
    print("Grade: A")
elif score >= 80:
    print("Grade: B")
elif score >= 70:
    print("Grade: C")
else:
    print("Grade: F")

# Try changing the values!`
  },
  loops: {
    title: "For and While Loops",
    description: "Repeating code with loops",
    code: `# For Loop
print("Counting from 1 to 5:")
for i in range(1, 6):
    print(i)

print("\\nEven numbers from 0 to 10:")
for i in range(0, 11, 2):
    print(i)

# While Loop
print("\\nCountdown:")
count = 5
while count > 0:
    print(count)
    count -= 1
print("Blast off!")

# Try modifying the range and conditions!`
  },
  lists: {
    title: "Lists and Arrays",
    description: "Working with collections of data",
    code: `# Lists
fruits = ["apple", "banana", "cherry", "date"]

print("All fruits:", fruits)
print("First fruit:", fruits[0])
print("Last fruit:", fruits[-1])
print("Number of fruits:", len(fruits))

# List operations
fruits.append("elderberry")
print("After adding:", fruits)

fruits.remove("banana")
print("After removing:", fruits)

# Loop through list
print("\\nAll fruits:")
for fruit in fruits:
    print("-", fruit)

# Try creating your own list!`
  },
  functions: {
    title: "Functions",
    description: "Creating reusable code blocks",
    code: `# Functions
def greet(name):
    """Greet someone by name"""
    print(f"Hello, {name}!")

def add_numbers(a, b):
    """Add two numbers and return the result"""
    return a + b

def calculate_area(length, width):
    """Calculate rectangle area"""
    area = length * width
    return area

# Using functions
greet("Alice")
greet("Bob")

result = add_numbers(5, 3)
print(f"5 + 3 = {result}")

area = calculate_area(10, 5)
print(f"Area: {area}")

# Try creating your own function!`
  },
  dictionaries: {
    title: "Dictionaries",
    description: "Key-value pairs for organizing data",
    code: `# Dictionaries
student = {
    "name": "Alice",
    "age": 20,
    "grade": "A",
    "courses": ["Math", "Science", "English"]
}

print("Student name:", student["name"])
print("Student age:", student["age"])
print("Courses:", student["courses"])

# Adding new key-value pair
student["email"] = "alice@example.com"
print("Updated student:", student)

# Loop through dictionary
print("\\nAll student info:")
for key, value in student.items():
    print(f"{key}: {value}")

# Try creating your own dictionary!`
  }
};

export function PythonIDE({ onClose }: PythonIDEProps) {
  const [code, setCode] = useState(EXAMPLES.hello.code);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedExample, setSelectedExample] = useState<keyof typeof EXAMPLES>('hello');
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Running...\n');

    try {
      const response = await fetch('/api/execute/python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await response.json();

      if (data.success) {
        setOutput(data.output || '(No output)');
      } else {
        setOutput(`Error:\n${data.error || 'Unknown error occurred'}`);
      }
    } catch (error) {
      setOutput(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const loadExample = (exampleKey: keyof typeof EXAMPLES) => {
    setSelectedExample(exampleKey);
    setCode(EXAMPLES[exampleKey].code);
    setOutput('');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      data-no-terminal-autofocus
    >
      <div className="w-full h-full max-w-7xl max-h-[90vh] bg-[#0D1117] border-2 border-[#00FF41] rounded-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-[#00FF41]/30">
          <div className="flex items-center gap-3">
            <Code className="w-5 h-5 text-[#00FF41]" />
            <h3 className="text-[#00FF41] font-mono text-sm font-bold">
              PYTHON LEARNING IDE
            </h3>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-[#00FF41] hover:text-white hover:bg-[#00FF41]/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Examples */}
          <div className="w-64 border-r border-[#00FF41]/30 bg-black/30 overflow-y-auto">
            <div className="p-3 border-b border-[#00FF41]/20">
              <div className="flex items-center gap-2 text-[#00FF41] font-mono text-xs">
                <BookOpen className="w-4 h-4" />
                <span>EXAMPLES</span>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {Object.entries(EXAMPLES).map(([key, example]) => (
                <button
                  key={key}
                  onClick={() => loadExample(key as keyof typeof EXAMPLES)}
                  className={`w-full text-left px-3 py-2 rounded font-mono text-xs transition-colors ${
                    selectedExample === key
                      ? 'bg-[#00FF41]/20 text-[#00FF41] border border-[#00FF41]/50'
                      : 'text-[#00FF41]/70 hover:bg-[#00FF41]/10 hover:text-[#00FF41]'
                  }`}
                >
                  <div className="font-bold">{example.title}</div>
                  <div className="text-[10px] opacity-70 mt-1">{example.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Editor and Output Split */}
          <div className="flex-1 flex flex-col">
            {/* Editor */}
            <div className="flex-1 border-b border-[#00FF41]/30">
              <div className="h-full">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  onMount={handleEditorDidMount}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on',
                    padding: { top: 10, bottom: 10 }
                  }}
                />
              </div>
            </div>

            {/* Run Button */}
            <div className="px-4 py-2 bg-black/30 border-b border-[#00FF41]/30 flex items-center justify-between">
              <Button
                onClick={runCode}
                disabled={isRunning}
                className="bg-[#00FF41] text-black hover:bg-[#00FF41]/80 font-mono text-sm"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Code (Ctrl+Enter)
                  </>
                )}
              </Button>
              <div className="text-[#00FF41]/70 font-mono text-xs">
                Output below ↓
              </div>
            </div>

            {/* Output */}
            <div className="flex-1 bg-black/50">
              <ScrollArea className="h-full">
                <pre className="p-4 font-mono text-xs text-[#00FF41] whitespace-pre-wrap">
                  {output || '// Click "Run Code" to see output here...'}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-black/50 border-t border-[#00FF41]/30 flex items-center justify-between">
          <div className="text-[#00FF41]/70 font-mono text-xs">
            💡 Tip: Modify the examples and experiment!
          </div>
          <div className="text-[#00FF41]/50 font-mono text-xs">
            Press Ctrl+Enter to run code
          </div>
        </div>
      </div>
    </div>
  );
}
