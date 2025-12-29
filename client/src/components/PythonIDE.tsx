import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, X, BookOpen, Code, Loader2, Lightbulb, CheckCircle2, MessageSquare, Send, Maximize2, Minimize2, Eye, EyeOff, Download, Plus, Trash2, FileCode, Info, TestTube, FileText, Bot, Users, Star, AlertCircle, Terminal, Copy, Check } from 'lucide-react';
import { MonacoAITests } from './MonacoAITests';
import Editor from '@monaco-editor/react';
import { useMutation } from '@tanstack/react-query';
import { useSpeech } from '@/contexts/SpeechContext';
import { registerCodeiumProvider } from '@live-codes/monaco-codeium-provider';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useToast } from '@/hooks/use-toast';
import { CodePreview } from './CodePreview';
import { CodePlayground } from './CodePlayground';
import { CodeSnippets } from './CodeSnippets';
import { Notepad } from './Notepad';
import { WebContainerTerminal, createNodeProjectFiles } from './WebContainerTerminal';
import { defineAndApplyMonacoTheme, createThemeChangeListener } from '@/lib/monacoThemeSync';

// Module-level flag to prevent duplicate Codeium registrations across component remounts
let codeiumRegistered = false;

interface PythonIDEProps {
  onClose: () => void;
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

function detectLanguageFromCode(code: string): string {
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
  return 'python';
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
    if (config.extension === `.${ext}`) return lang;
  }
  return 'python';
}

function generateLocalInstructions(language: string): string {
  const config = LANGUAGE_CONFIG[language];
  if (!config) return '';

  const instructions: Record<string, string> = {
    python: `**Python Setup:**
1. Save file as \`filename.py\`
2. Install Python 3.x from python.org
3. Run: \`python3 filename.py\`
4. For packages: \`pip install package-name\``,
    javascript: `**JavaScript (Node.js) Setup:**
1. Save file as \`filename.js\`
2. Install Node.js from nodejs.org
3. Run: \`node filename.js\`
4. For packages: \`npm install package-name\``,
    typescript: `**TypeScript Setup:**
1. Save file as \`filename.ts\`
2. Install: \`npm install -g typescript ts-node\`
3. Run: \`npx ts-node filename.ts\`
4. Or compile: \`tsc filename.ts && node filename.js\``,
    java: `**Java Setup:**
1. Save file as \`ClassName.java\` (match class name)
2. Install JDK from adoptium.net
3. Compile: \`javac ClassName.java\`
4. Run: \`java ClassName\``,
    cpp: `**C++ Setup:**
1. Save file as \`filename.cpp\`
2. Install g++ (MinGW on Windows, build-essential on Linux)
3. Compile: \`g++ -o program filename.cpp\`
4. Run: \`./program\``,
    html: `**HTML Setup:**
1. Save file as \`index.html\`
2. Open directly in any web browser
3. Or use VS Code Live Server extension for auto-reload`,
    bash: `**Bash Setup:**
1. Save file as \`script.sh\`
2. Make executable: \`chmod +x script.sh\`
3. Run: \`./script.sh\` or \`bash script.sh\``,
    rust: `**Rust Setup:**
1. Install Rust from rustup.rs
2. Create project: \`cargo new project_name\`
3. Run: \`cargo run\``,
    go: `**Go Setup:**
1. Install Go from go.dev
2. Save as \`main.go\`
3. Run: \`go run main.go\``,
  };

  return instructions[language] || `**${config.displayName} Setup:**\n1. Save with ${config.extension} extension\n2. Run: \`${config.runCommand}\``;
}

// Comprehensive lesson structure with Archimedes guidance
const LESSONS = {
  basics: {
    title: "Python Basics & Best Practices",
    description: "Learn fundamental Python syntax and coding standards",
    guidance: ``,
    code: `#!/usr/bin/env python3
"""
Python Basics and Best Practices
Author: Your Name
Date: ${new Date().toLocaleDateString()}
"""

# PEP 8: Use descriptive variable names with lowercase and underscores
user_name = "Alice"
user_age = 25
is_student = True

# Best practice: Use constants in UPPERCASE
MAX_RETRY_COUNT = 3
API_TIMEOUT = 30

# Type hints improve code clarity (Python 3.5+)
def greet_user(name: str, age: int) -> str:
    """
    Greet a user with their name and age.

    Args:
        name: The user's name
        age: The user's age

    Returns:
        A formatted greeting string
    """
    return f"Hello, {name}! You are {age} years old."

# Best practice: Use main guard
if __name__ == "__main__":
    greeting = greet_user(user_name, user_age)
    print(greeting)
    print(f"Student status: {is_student}")
    print(f"Max retries allowed: {MAX_RETRY_COUNT}")
`,
    tasks: [
      "Create a function with type hints",
      "Use descriptive variable names",
      "Add a docstring to your function",
      "Follow PEP 8 naming conventions"
    ]
  },

  data_types: {
    title: "Simple & Complex Data Types",
    description: "Master Python's built-in data structures",
    guidance: `ARCHIMEDES: Data types are the foundation of programming. Python has elegant built-in types: immutable (int, float, str, tuple) and mutable (list, dict, set). Choose the right type for the job - lists for ordered collections, sets for uniqueness, dicts for key-value pairs. Understanding mutability prevents subtle bugs.`,
    code: `#!/usr/bin/env python3
"""
Exploring Python Data Types
Demonstrates simple and complex types with appropriate usage
"""

from typing import List, Dict, Set, Tuple
from collections import defaultdict, Counter
from datetime import datetime

# Simple Types
integer_num: int = 42
float_num: float = 3.14159
text: str = "Python"
is_valid: bool = True

# Complex Types - Lists (ordered, mutable)
numbers: List[int] = [1, 2, 3, 4, 5]
mixed_list: List = [1, "two", 3.0, True]  # Can hold different types

# Tuples (ordered, immutable) - use for fixed collections
coordinates: Tuple[float, float] = (40.7128, -74.0060)
rgb_color: Tuple[int, int, int] = (255, 128, 0)

# Sets (unordered, unique values)
unique_numbers: Set[int] = {1, 2, 3, 3, 4, 4}  # Duplicates removed
valid_extensions: Set[str] = {'.py', '.txt', '.json'}

# Dictionaries (key-value pairs)
user_data: Dict[str, any] = {
    'name': 'Alice',
    'age': 25,
    'email': 'alice@example.com',
    'skills': ['Python', 'JavaScript']
}

# Advanced: defaultdict (never raises KeyError)
word_count = defaultdict(int)
for word in ['apple', 'banana', 'apple']:
    word_count[word] += 1

# Advanced: Counter (specialized dict for counting)
letters = Counter("archimedes")

def demonstrate_data_types():
    """Show appropriate usage of each data type."""

    # List operations (mutable)
    numbers.append(6)
    numbers.extend([7, 8])
    print(f"List after append/extend: {numbers}")

    # Tuple unpacking
    latitude, longitude = coordinates
    print(f"Coordinates: ({latitude}, {longitude})")

    # Set operations
    set_a = {1, 2, 3, 4}
    set_b = {3, 4, 5, 6}
    print(f"Union: {set_a | set_b}")
    print(f"Intersection: {set_a & set_b}")
    print(f"Difference: {set_a - set_b}")

    # Dict operations
    user_data['last_login'] = datetime.now().isoformat()
    print(f"User: {user_data.get('name', 'Unknown')}")

    # Advanced collections
    print(f"Word count: {dict(word_count)}")
    print(f"Most common letter: {letters.most_common(1)}")

if __name__ == "__main__":
    demonstrate_data_types()

    # Type checking
    print(f"\\nType of numbers: {type(numbers)}")
    print(f"Type of coordinates: {type(coordinates)}")
    print(f"Type of user_data: {type(user_data)}")
`,
    tasks: [
      "Create a list and perform append/extend operations",
      "Use tuple unpacking for coordinates",
      "Perform set operations (union, intersection)",
      "Access dictionary values safely with .get()"
    ]
  },

  functions: {
    title: "Built-in & Custom Functions",
    description: "Master function creation with parameters and return types",
    guidance: `ARCHIMEDES: Functions are reusable code blocks - the building blocks of clean code. Python has powerful built-ins like map(), filter(), zip(), and enumerate(). Create your own with clear parameters, type hints, and return values. Use *args for variable arguments, **kwargs for keyword arguments. Default parameters make functions flexible.`,
    code: `#!/usr/bin/env python3
"""
Functions: Built-in and Custom
Demonstrates function creation with parameters, type hints, and best practices
"""

from typing import List, Optional, Tuple, Callable, Dict
from functools import reduce
import operator

# Built-in functions demonstration
def demonstrate_builtins():
    """Show powerful built-in functions."""

    numbers = [1, 2, 3, 4, 5]

    # map: apply function to each element
    squared = list(map(lambda x: x**2, numbers))
    print(f"Squared: {squared}")

    # filter: keep elements that match condition
    evens = list(filter(lambda x: x % 2 == 0, numbers))
    print(f"Evens: {evens}")

    # zip: combine iterables
    names = ['Alice', 'Bob', 'Carol']
    ages = [25, 30, 35]
    combined = list(zip(names, ages))
    print(f"Combined: {combined}")

    # enumerate: get index and value
    for i, name in enumerate(names, start=1):
        print(f"{i}. {name}")

    # reduce: accumulate values
    total = reduce(operator.add, numbers)
    print(f"Sum using reduce: {total}")

# Custom function with type hints
def calculate_statistics(numbers: List[float]) -> Dict[str, float]:
    """
    Calculate basic statistics for a list of numbers.

    Args:
        numbers: List of numeric values

    Returns:
        Dictionary with mean, median, min, max
    """
    if not numbers:
        return {}

    sorted_nums = sorted(numbers)
    n = len(sorted_nums)

    return {
        'mean': sum(numbers) / n,
        'median': sorted_nums[n // 2] if n % 2 else 
                  (sorted_nums[n // 2 - 1] + sorted_nums[n // 2]) / 2,
        'min': min(numbers),
        'max': max(numbers),
        'count': n
    }

# Function with default parameters
def greet(name: str, greeting: str = "Hello", punctuation: str = "!") -> str:
    """Create a greeting with customizable parts."""
    return f"{greeting}, {name}{punctuation}"

# Function with *args (variable positional arguments)
def sum_all(*args: float) -> float:
    """Sum any number of arguments."""
    return sum(args)

# Function with **kwargs (variable keyword arguments)
def print_user_info(**kwargs: str) -> None:
    """Print user information from keyword arguments."""
    for key, value in kwargs.items():
        print(f"{key.title()}: {value}")

# Function returning multiple values (tuple unpacking)
def divide_with_remainder(dividend: int, divisor: int) -> Tuple[int, int]:
    """Return quotient and remainder."""
    return dividend // divisor, dividend % divisor

# Higher-order function (accepts function as parameter)
def apply_operation(numbers: List[int], operation: Callable[[int], int]) -> List[int]:
    """Apply an operation to each number."""
    return [operation(num) for num in numbers]

# Lambda functions for simple operations
double = lambda x: x * 2
is_even = lambda x: x % 2 == 0

if __name__ == "__main__":
    # Test built-ins
    print("=== Built-in Functions ===")
    demonstrate_builtins()

    # Test custom functions
    print("\\n=== Custom Functions ===")
    data = [15, 23, 8, 42, 16, 4]
    stats = calculate_statistics(data)
    print(f"Statistics: {stats}")

    # Default parameters
    print(greet("Alice"))
    print(greet("Bob", "Hi"))
    print(greet("Carol", "Hey", "..."))

    # *args and **kwargs
    print(f"Sum: {sum_all(1, 2, 3, 4, 5)}")
    print_user_info(name="Alice", age="25", city="NYC")

    # Tuple unpacking
    q, r = divide_with_remainder(17, 5)
    print(f"17 ÷ 5 = {q} remainder {r}")

    # Higher-order functions
    nums = [1, 2, 3, 4, 5]
    doubled = apply_operation(nums, double)
    print(f"Doubled: {doubled}")
`,
    tasks: [
      "Create a function with type hints",
      "Use default parameters in a function",
      "Write a function using *args or **kwargs",
      "Create a lambda function for a simple operation"
    ]
  },

  pythonic: {
    title: "Pythonic Features: Comprehensions & Iterators",
    description: "Write elegant, efficient Python code",
    guidance: `ARCHIMEDES: Pythonic code is beautiful code. List comprehensions replace verbose loops with concise expressions. Generator expressions save memory for large datasets. Iterators process data lazily - one item at a time. Master these and you'll write code that makes other Python developers nod in approval.`,
    code: `#!/usr/bin/env python3
"""
Pythonic Features: Comprehensions and Iterators
Demonstrates elegant Python patterns for efficient code
"""

from typing import Iterator, List, Dict
import sys

# List Comprehensions - concise and readable
def list_comprehension_examples():
    """Demonstrate various list comprehension patterns."""

    # Basic comprehension
    squares = [x**2 for x in range(10)]
    print(f"Squares: {squares}")

    # With condition
    even_squares = [x**2 for x in range(10) if x % 2 == 0]
    print(f"Even squares: {even_squares}")

    # Nested comprehension (flatten matrix)
    matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    flattened = [num for row in matrix for num in row]
    print(f"Flattened: {flattened}")

    # String manipulation
    words = ["hello", "world", "python"]
    capitalized = [word.upper() for word in words]
    print(f"Capitalized: {capitalized}")

# Dictionary Comprehensions
def dict_comprehension_examples():
    """Demonstrate dictionary comprehension patterns."""

    # Create dict from lists
    keys = ['a', 'b', 'c']
    values = [1, 2, 3]
    mapping = {k: v for k, v in zip(keys, values)}
    print(f"Mapping: {mapping}")

    # Invert dictionary
    inverted = {v: k for k, v in mapping.items()}
    print(f"Inverted: {inverted}")

    # Filter dictionary
    numbers = {'a': 1, 'b': 2, 'c': 3, 'd': 4}
    evens = {k: v for k, v in numbers.items() if v % 2 == 0}
    print(f"Even values: {evens}")

# Set Comprehensions
def set_comprehension_examples():
    """Demonstrate set comprehension patterns."""

    # Unique lengths
    words = ["hello", "world", "hi", "python", "code"]
    lengths = {len(word) for word in words}
    print(f"Unique lengths: {lengths}")

    # Unique squares
    unique_squares = {x**2 for x in [-2, -1, 0, 1, 2]}
    print(f"Unique squares: {unique_squares}")

# Generator function - defined at module level for reuse
def count_from(start: int = 0) -> Iterator[int]:
    """Infinite counter starting from a value."""
    num = start
    while True:
        yield num
        num += 1

# Generator Expressions - memory efficient
def generator_examples():
    """Demonstrate generators for memory-efficient iteration."""

    # Generator expression (uses () instead of [])
    squares_gen = (x**2 for x in range(1000000))
    print(f"Generator object: {squares_gen}")
    print(f"First 5 squares: {[next(squares_gen) for _ in range(5)]}")

    # Generator function with yield
    def fibonacci(n: int) -> Iterator[int]:
        """Generate Fibonacci sequence up to n terms."""
        a, b = 0, 1
        for _ in range(n):
            yield a
            a, b = b, a + b

    fib_gen = fibonacci(10)
    print(f"Fibonacci: {list(fib_gen)}")

    # Use the module-level infinite generator
    counter = count_from(100)
    print(f"First 5 from counter: {[next(counter) for _ in range(5)]}")

# Custom Iterator Class
class Countdown:
    """Iterator that counts down from a number."""

    def __init__(self, start: int):
        self.current = start

    def __iter__(self):
        return self

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        self.current -= 1
        return self.current + 1

# Iterator tools
def iterator_tools_examples():
    """Demonstrate working with iterators."""
    from itertools import islice, cycle, chain, takewhile

    # islice: slice an iterator
    numbers = range(100)
    first_10_evens = list(islice((x for x in numbers if x % 2 == 0), 10))
    print(f"First 10 evens: {first_10_evens}")

    # cycle: repeat infinitely
    colors = cycle(['red', 'green', 'blue'])
    print(f"First 7 colors: {[next(colors) for _ in range(7)]}")

    # chain: combine iterators
    combined = chain([1, 2, 3], [4, 5, 6], [7, 8, 9])
    print(f"Combined: {list(combined)}")

    # takewhile: take while condition is true
    from_one = count_from(1)
    less_than_10 = list(takewhile(lambda x: x < 10, from_one))
    print(f"Less than 10: {less_than_10}")

# Memory comparison
def memory_comparison():
    """Compare memory usage of list vs generator."""

    # List (stores all values in memory)
    list_comp = [x**2 for x in range(100000)]
    list_size = sys.getsizeof(list_comp)

    # Generator (computes on demand)
    gen_exp = (x**2 for x in range(100000))
    gen_size = sys.getsizeof(gen_exp)

    print(f"\\nMemory Usage:")
    print(f"List: {list_size:,} bytes")
    print(f"Generator: {gen_size:,} bytes")
    print(f"Savings: {list_size - gen_size:,} bytes ({100 * (1 - gen_size/list_size):.1f}%)")

if __name__ == "__main__":
    print("=== List Comprehensions ===")
    list_comprehension_examples()

    print("\\n=== Dictionary Comprehensions ===")
    dict_comprehension_examples()

    print("\\n=== Set Comprehensions ===")
    set_comprehension_examples()

    print("\\n=== Generators ===")
    generator_examples()

    print("\\n=== Custom Iterator ===")
    countdown = Countdown(5)
    print(f"Countdown: {list(countdown)}")

    print("\\n=== Iterator Tools ===")
    iterator_tools_examples()

    memory_comparison()
`,
    tasks: [
      "Create a list comprehension with a condition",
      "Write a generator function using yield",
      "Build a dictionary comprehension",
      "Use itertools to process data efficiently"
    ]
  },

  datetime: {
    title: "Dates, Times & Calendars",
    description: "Work with temporal data professionally",
    guidance: `ARCHIMEDES: Time is complex - timezones, DST, leap years... Python's datetime module handles it elegantly. Use datetime for timestamps, date for calendar dates, timedelta for durations. Always work in UTC internally, convert to local for display. The dateutil library adds powerful parsing capabilities.`,
    code: `#!/usr/bin/env python3
"""
Working with Dates, Times, and Calendars
Demonstrates datetime module and best practices
"""

from datetime import datetime, date, time, timedelta, timezone
from calendar import monthrange, isleap, Calendar
from typing import List
import time as time_module

# Current date and time
def current_datetime_examples():
    """Demonstrate getting current date/time."""

    now = datetime.now()
    today = date.today()
    utc_now = datetime.now(timezone.utc)

    print(f"Local now: {now}")
    print(f"Today's date: {today}")
    print(f"UTC now: {utc_now}")
    print(f"Unix timestamp: {now.timestamp()}")

# Creating specific dates and times
def create_datetime_examples():
    """Create specific datetime objects."""

    # Specific date
    birthday = date(1990, 5, 15)
    print(f"Birthday: {birthday}")

    # Specific datetime
    meeting = datetime(2024, 12, 25, 14, 30, 0)
    print(f"Meeting: {meeting}")

    # Specific time
    alarm = time(7, 30, 0)
    print(f"Alarm time: {alarm}")

    # From timestamp
    epoch_time = datetime.fromtimestamp(0, tz=timezone.utc)
    print(f"Unix epoch: {epoch_time}")

# Formatting and parsing
def formatting_examples():
    """Format and parse datetime strings."""

    now = datetime.now()

    # Formatting with strftime
    print(f"ISO format: {now.isoformat()}")
    print(f"Custom: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Readable: {now.strftime('%B %d, %Y at %I:%M %p')}")
    print(f"Date only: {now.strftime('%Y-%m-%d')}")

    # Parsing with strptime
    date_str = "2024-12-25 14:30:00"
    parsed = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
    print(f"Parsed: {parsed}")

# Time arithmetic with timedelta
def timedelta_examples():
    """Perform date/time arithmetic."""

    now = datetime.now()

    # Add/subtract time
    tomorrow = now + timedelta(days=1)
    next_week = now + timedelta(weeks=1)
    two_hours_ago = now - timedelta(hours=2)

    print(f"Tomorrow: {tomorrow.strftime('%Y-%m-%d')}")
    print(f"Next week: {next_week.strftime('%Y-%m-%d')}")
    print(f"2 hours ago: {two_hours_ago.strftime('%H:%M')}")

    # Duration between dates
    birthday = date(1990, 5, 15)
    today = date.today()
    age_days = (today - birthday).days
    age_years = age_days / 365.25

    print(f"Days since birthday: {age_days}")
    print(f"Approximate age: {age_years:.1f} years")

    # Business days calculation
    def add_business_days(start_date: date, days: int) -> date:
        """Add business days (excluding weekends)."""
        current = start_date
        while days > 0:
            current += timedelta(days=1)
            if current.weekday() < 5:  # Monday = 0, Friday = 4
                days -= 1
        return current

    deadline = add_business_days(today, 10)
    print(f"10 business days from now: {deadline}")

# Calendar operations
def calendar_examples():
    """Work with calendars."""

    # Check if leap year
    year = 2024
    print(f"{year} is leap year: {isleap(year)}")

    # Days in month
    month_days = monthrange(2024, 2)  # Returns (weekday, days)
    print(f"February 2024 has {month_days[1]} days")

    # Generate calendar
    cal = Calendar()
    print("\\nFebruary 2024 calendar:")
    print("Mo Tu We Th Fr Sa Su")
    for week in cal.monthdayscalendar(2024, 2):
        print(" ".join(f"{day:2d}" if day else "  " for day in week))

# Timezone-aware operations
def timezone_examples():
    """Work with timezones (basic UTC)."""

    # UTC time
    utc_now = datetime.now(timezone.utc)
    print(f"UTC: {utc_now}")

    # Convert to timestamp and back
    timestamp = utc_now.timestamp()
    restored = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    print(f"Restored from timestamp: {restored}")

    # Time since epoch
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    since_epoch = utc_now - epoch
    print(f"Seconds since Unix epoch: {since_epoch.total_seconds():.0f}")

# Performance timing
def timing_example():
    """Time code execution."""

    def slow_function():
        """Simulate slow operation."""
        total = 0
        for i in range(1000000):
            total += i
        return total

    start = time_module.perf_counter()
    result = slow_function()
    end = time_module.perf_counter()

    duration = end - start
    print(f"\\nFunction took {duration:.4f} seconds")
    print(f"Result: {result}")

# Date utilities
def date_utilities():
    """Useful date utility functions."""

    def is_weekend(check_date: date) -> bool:
        """Check if date is weekend."""
        return check_date.weekday() >= 5

    def days_until(target_date: date) -> int:
        """Days until target date."""
        return (target_date - date.today()).days

    def quarter(check_date: date) -> int:
        """Get fiscal quarter (1-4)."""
        return (check_date.month - 1) // 3 + 1

    today = date.today()
    print(f"\\nToday is weekend: {is_weekend(today)}")
    print(f"Quarter: Q{quarter(today)}")

    new_year = date(today.year + 1, 1, 1)
    print(f"Days until new year: {days_until(new_year)}")

if __name__ == "__main__":
    print("=== Current Date/Time ===")
    current_datetime_examples()

    print("\\n=== Creating Specific Dates ===")
    create_datetime_examples()

    print("\\n=== Formatting & Parsing ===")
    formatting_examples()

    print("\\n=== Time Arithmetic ===")
    timedelta_examples()

    print("\\n=== Calendar Operations ===")
    calendar_examples()

    print("\\n=== Timezone Operations ===")
    timezone_examples()

    timing_example()
    date_utilities()
`,
    tasks: [
      "Format a datetime in multiple formats",
      "Calculate days between two dates",
      "Create a calendar for a specific month",
      "Work with timezones using UTC"
    ]
  },

  files: {
    title: "File I/O: Text & Binary Data",
    description: "Read and write files professionally",
    guidance: `ARCHIMEDES: File operations are fundamental. Use context managers (with statement) for safe file handling - they guarantee cleanup. Text mode for strings, binary mode for bytes. CSV for tabular data, JSON for structured data. Always handle exceptions - files fail in production. Path operations with pathlib are cleaner than os.path.`,
    code: `#!/usr/bin/env python3
"""
File I/O: Reading and Writing Text and Binary Files
Demonstrates safe file handling with context managers
"""

import os
import json
import csv
from pathlib import Path
from typing import List, Dict, Any
import tempfile

# Text file operations
def text_file_examples():
    """Demonstrate reading and writing text files."""

    # Write text file (context manager ensures cleanup)
    with open('example.txt', 'w', encoding='utf-8') as f:
        f.write("Hello, World!\\n")
        f.write("Python file I/O\\n")
        lines = ["Line 1\\n", "Line 2\\n", "Line 3\\n"]
        f.writelines(lines)

    # Read entire file
    with open('example.txt', 'r', encoding='utf-8') as f:
        content = f.read()
        print(f"Full content:\\n{content}")

    # Read line by line (memory efficient)
    with open('example.txt', 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            print(f"Line {line_num}: {line.strip()}")

    # Read all lines into list
    with open('example.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        print(f"Total lines: {len(lines)}")

    # Append to file
    with open('example.txt', 'a', encoding='utf-8') as f:
        f.write("Appended line\\n")

    # Clean up
    os.remove('example.txt')

# Binary file operations
def binary_file_examples():
    """Demonstrate binary file operations."""

    # Write binary data
    data = bytes([0x00, 0x01, 0x02, 0xFF])
    with open('example.bin', 'wb') as f:
        f.write(data)

    # Read binary data
    with open('example.bin', 'rb') as f:
        binary_content = f.read()
        print(f"Binary data: {binary_content.hex()}")
        print(f"As list: {list(binary_content)}")

    # Read chunks (for large files)
    chunk_size = 2
    with open('example.bin', 'rb') as f:
        while chunk := f.read(chunk_size):
            print(f"Chunk: {chunk.hex()}")

    # Clean up
    os.remove('example.bin')

# JSON file operations
def json_file_examples():
    """Work with JSON files."""

    # Create data structure
    data: Dict[str, Any] = {
        'name': 'Alice',
        'age': 25,
        'skills': ['Python', 'JavaScript', 'SQL'],
        'active': True,
        'score': 95.5
    }

    # Write JSON (pretty printed)
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Read JSON
    with open('data.json', 'r', encoding='utf-8') as f:
        loaded_data = json.load(f)
        print(f"Loaded JSON: {loaded_data}")

    # JSON to/from strings
    json_string = json.dumps(data, indent=2)
    parsed = json.loads(json_string)
    print(f"Parsed from string: {parsed['name']}")

    # Clean up
    os.remove('data.json')

# CSV file operations
def csv_file_examples():
    """Work with CSV files."""

    # Write CSV
    headers = ['Name', 'Age', 'City']
    rows = [
        ['Alice', 25, 'NYC'],
        ['Bob', 30, 'LA'],
        ['Carol', 35, 'Chicago']
    ]

    with open('data.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    # Read CSV
    with open('data.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        print("CSV Data:")
        for row in reader:
            print(row)

    # CSV with DictReader/DictWriter
    with open('data.csv', 'r', encoding='utf-8') as f:
        dict_reader = csv.DictReader(f)
        print("\\nAs dictionaries:")
        for row in dict_reader:
            print(f"{row['Name']} is {row['Age']} from {row['City']}")

    # Clean up
    os.remove('data.csv')

# Path operations with pathlib
def pathlib_examples():
    """Use pathlib for modern file operations."""

    # Create Path object
    path = Path('example_dir')

    # Create directory
    path.mkdir(exist_ok=True)

    # Create file in directory
    file_path = path / 'test.txt'
    file_path.write_text("Hello from pathlib!", encoding='utf-8')

    # Read file
    content = file_path.read_text(encoding='utf-8')
    print(f"Content: {content}")

    # File info
    print(f"Exists: {file_path.exists()}")
    print(f"Is file: {file_path.is_file()}")
    print(f"Size: {file_path.stat().st_size} bytes")
    print(f"Suffix: {file_path.suffix}")
    print(f"Name: {file_path.name}")

    # List directory contents
    print(f"\\nDirectory contents:")
    for item in path.iterdir():
        print(f"  {item.name}")

    # Glob patterns
    txt_files = list(path.glob('*.txt'))
    print(f"Text files: {[f.name for f in txt_files]}")

    # Clean up
    file_path.unlink()
    path.rmdir()

# Safe file operations with error handling
def safe_file_operations():
    """Demonstrate error handling with files."""

    def read_file_safely(filename: str) -> str:
        """Read file with proper error handling."""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            print(f"Error: {filename} not found")
            return ""
        except PermissionError:
            print(f"Error: No permission to read {filename}")
            return ""
        except Exception as e:
            print(f"Unexpected error: {e}")
            return ""

    # Try to read non-existent file
    content = read_file_safely('nonexistent.txt')
    print(f"Result: '{content}'")

# Temporary files
def temporary_file_examples():
    """Work with temporary files."""

    # Temporary file (auto-deleted)
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as tmp:
        tmp.write("Temporary data")
        tmp_path = tmp.name
        print(f"Temp file: {tmp_path}")

    # Read temp file
    with open(tmp_path, 'r') as f:
        print(f"Temp content: {f.read()}")

    # Manual cleanup
    os.remove(tmp_path)

    # Temporary directory
    with tempfile.TemporaryDirectory() as tmp_dir:
        print(f"Temp directory: {tmp_dir}")
        # Directory auto-deleted when context exits

# Large file processing
def process_large_file_example():
    """Process large files efficiently."""

    # Create sample large file
    with open('large.txt', 'w') as f:
        for i in range(1000):
            f.write(f"Line {i}\\n")

    # Process line by line (memory efficient)
    line_count = 0
    total_chars = 0

    with open('large.txt', 'r') as f:
        for line in f:
            line_count += 1
            total_chars += len(line)

    print(f"\\nProcessed large file:")
    print(f"Lines: {line_count}")
    print(f"Total characters: {total_chars}")

    # Clean up
    os.remove('large.txt')

if __name__ == "__main__":
    print("=== Text Files ===")
    text_file_examples()

    print("\\n=== Binary Files ===")
    binary_file_examples()

    print("\\n=== JSON Files ===")
    json_file_examples()

    print("\\n=== CSV Files ===")
    csv_file_examples()

    print("\\n=== Pathlib ===")
    pathlib_examples()

    print("\\n=== Safe Operations ===")
    safe_file_operations()

    print("\\n=== Temporary Files ===")
    temporary_file_examples()

    process_large_file_example()
`,
    tasks: [
      "Write and read a text file safely",
      "Work with JSON data",
      "Parse a CSV file",
      "Use pathlib for file operations"
    ]
  },

  stdlib: {
    title: "Standard Library Modules",
    description: "Leverage Python's batteries-included philosophy",
    guidance: `ARCHIMEDES: Python's standard library is vast - 'batteries included' is no joke. Regular expressions (re) for pattern matching, os/pathlib for system operations, collections for specialized containers, itertools for efficient iteration, functools for functional programming. Learn these well; they solve most problems without external dependencies.`,
    code: `#!/usr/bin/env python3
"""
Python Standard Library: Essential Modules
Demonstrates work-saving modules from the standard library
"""

import re
import os
import sys
import math
import random
import string
from collections import defaultdict, Counter, deque, namedtuple
from itertools import chain, combinations, permutations, product
from functools import lru_cache, partial, reduce
from operator import itemgetter, attrgetter
from typing import List, Dict

# Regular expressions (re)
def regex_examples():
    """Pattern matching with regular expressions."""

    text = "Contact: alice@example.com or bob@test.org"

    # Find email addresses
    emails = re.findall(r'\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', text)
    print(f"Emails found: {emails}")

    # Validate pattern
    phone = "555-123-4567"
    if re.match(r'^\\d{3}-\\d{3}-\\d{4}$', phone):
        print(f"Valid phone: {phone}")

    # Search and replace
    sanitized = re.sub(r'\\b\\d+\\b', 'XXX', "My PIN is 1234")
    print(f"Sanitized: {sanitized}")

    # Groups
    match = re.search(r'(\\w+)@(\\w+\\.\\w+)', text)
    if match:
        print(f"Username: {match.group(1)}, Domain: {match.group(2)}")

# Collections module
def collections_examples():
    """Advanced container types."""

    # defaultdict - never raises KeyError
    word_count = defaultdict(int)
    for word in ['apple', 'banana', 'apple', 'cherry']:
        word_count[word] += 1
    print(f"Word count: {dict(word_count)}")

    # Counter - counting hashable objects
    letters = Counter("archimedes")
    print(f"Letter frequency: {letters}")
    print(f"Most common: {letters.most_common(3)}")

    # deque - efficient queue/stack
    queue = deque(['a', 'b', 'c'])
    queue.append('d')  # Add to right
    queue.appendleft('z')  # Add to left
    print(f"Deque: {queue}")
    print(f"Pop right: {queue.pop()}")
    print(f"Pop left: {queue.popleft()}")

    # namedtuple - lightweight class
    Point = namedtuple('Point', ['x', 'y'])
    p = Point(10, 20)
    print(f"Point: x={p.x}, y={p.y}")

# Itertools - iteration tools
def itertools_examples():
    """Efficient iteration patterns."""

    # chain - combine iterables
    combined = list(chain([1, 2], [3, 4], [5, 6]))
    print(f"Chained: {combined}")

    # combinations - r-length combinations
    items = ['A', 'B', 'C']
    combos = list(combinations(items, 2))
    print(f"Combinations: {combos}")

    # permutations - r-length permutations
    perms = list(permutations(items, 2))
    print(f"Permutations: {perms}")

    # product - Cartesian product
    prod = list(product([1, 2], ['a', 'b']))
    print(f"Product: {prod}")

# Functools - functional programming
def functools_examples():
    """Higher-order functions and decorators."""

    # lru_cache - memoization
    @lru_cache(maxsize=128)
    def fibonacci(n: int) -> int:
        if n < 2:
            return n
        return fibonacci(n-1) + fibonacci(n-2)

    print(f"Fibonacci(10): {fibonacci(10)}")
    print(f"Cache info: {fibonacci.cache_info()}")

    # partial - pre-fill arguments
    def power(base: float, exponent: float) -> float:
        return base ** exponent

    square = partial(power, exponent=2)
    cube = partial(power, exponent=3)

    print(f"Square of 5: {square(5)}")
    print(f"Cube of 5: {cube(5)}")

    # reduce - accumulate values
    from operator import mul
    numbers = [1, 2, 3, 4, 5]
    factorial = reduce(mul, numbers)
    print(f"Factorial of 5: {factorial}")

# Operator module
def operator_examples():
    """Efficient operators as functions."""

    # Sort by specific field
    people = [
        {'name': 'Alice', 'age': 25},
        {'name': 'Bob', 'age': 30},
        {'name': 'Carol', 'age': 20}
    ]

    sorted_by_age = sorted(people, key=itemgetter('age'))
    print(f"Sorted by age: {[p['name'] for p in sorted_by_age]}")

    # Sort objects by attribute
    Person = namedtuple('Person', ['name', 'age'])
    persons = [Person('Alice', 25), Person('Bob', 30), Person('Carol', 20)]
    sorted_persons = sorted(persons, key=attrgetter('age'))
    print(f"Sorted persons: {[p.name for p in sorted_persons]}")

# Math module
def math_examples():
    """Mathematical functions."""

    # Constants
    print(f"π: {math.pi:.5f}")
    print(f"e: {math.e:.5f}")

    # Functions
    print(f"sqrt(16): {math.sqrt(16)}")
    print(f"ceil(4.3): {math.ceil(4.3)}")
    print(f"floor(4.9): {math.floor(4.9)}")
    print(f"gcd(48, 18): {math.gcd(48, 18)}")

    # Trigonometry
    angle_rad = math.radians(45)
    print(f"sin(45°): {math.sin(angle_rad):.4f}")

# Random module
def random_examples():
    """Random number generation."""

    # Random integer
    print(f"Random int 1-10: {random.randint(1, 10)}")

    # Random float
    print(f"Random float 0-1: {random.random():.4f}")

    # Random choice
    colors = ['red', 'green', 'blue']
    print(f"Random color: {random.choice(colors)}")

    # Shuffle list
    deck = list(range(1, 11))
    random.shuffle(deck)
    print(f"Shuffled deck: {deck}")

    # Random sample
    sample = random.sample(range(1, 51), 6)
    print(f"Lottery numbers: {sorted(sample)}")

# String module
def string_examples():
    """String constants and utilities."""

    print(f"ASCII letters: {string.ascii_letters}")
    print(f"Digits: {string.digits}")
    print(f"Punctuation: {string.punctuation}")

    # Generate random password
    chars = string.ascii_letters + string.digits + string.punctuation
    password = ''.join(random.choice(chars) for _ in range(12))
    print(f"Random password: {password}")

# OS module
def os_examples():
    """Operating system interface."""

    # Environment variables
    print(f"Python path: {os.environ.get('PYTHONPATH', 'Not set')}")

    # Path operations
    cwd = os.getcwd()
    print(f"Current directory: {cwd}")

    # File existence
    print(f"File exists: {os.path.exists(__file__)}")

    # Path manipulation
    path = os.path.join('folder', 'subfolder', 'file.txt')
    print(f"Joined path: {path}")
    print(f"Directory: {os.path.dirname(path)}")
    print(f"Basename: {os.path.basename(path)}")

# Sys module
def sys_examples():
    """System-specific parameters."""

    print(f"Python version: {sys.version}")
    print(f"Platform: {sys.platform}")
    print(f"Max int: {sys.maxsize}")
    print(f"Command line args: {sys.argv}")

if __name__ == "__main__":
    print("=== Regular Expressions ===")
    regex_examples()

    print("\\n=== Collections ===")
    collections_examples()

    print("\\n=== Itertools ===")
    itertools_examples()

    print("\\n=== Functools ===")
    functools_examples()

    print("\\n=== Operator ===")
    operator_examples()

    print("\\n=== Math ===")
    math_examples()

    print("\\n=== Random ===")
    random_examples()

    print("\\n=== String ===")
    string_examples()

    print("\\n=== OS ===")
    os_examples()

    print("\\n=== Sys ===")
    sys_examples()
`,
    tasks: [
      "Use regex to find patterns in text",
      "Create a Counter for frequency analysis",
      "Implement memoization with lru_cache",
      "Use itertools for combinations"
    ]
  },

  oop: {
    title: "Object-Oriented Programming",
    description: "Master classes, objects, and OOP principles",
    guidance: `ARCHIMEDES: Objects model real-world entities. Classes are blueprints, instances are objects. Use __init__ for initialization, self for instance reference. Properties with @property for controlled access. Inheritance for 'is-a' relationships, composition for 'has-a'. Magic methods (__str__, __repr__, __eq__) make objects Pythonic. Encapsulation protects data.`,
    code: `#!/usr/bin/env python3
"""
Object-Oriented Programming in Python
Demonstrates classes, objects, inheritance, and OOP principles
"""

from typing import List, Optional
from dataclasses import dataclass
from abc import ABC, abstractmethod

# Basic class definition
class Person:
    """Represents a person with name and age."""

    # Class variable (shared by all instances)
    species = "Homo sapiens"

    def __init__(self, name: str, age: int):
        """
        Initialize a Person instance.

        Args:
            name: Person's name
            age: Person's age
        """
        # Instance variables (unique to each instance)
        self.name = name
        self.age = age
        self._email = None  # Protected attribute (convention)

    def greet(self) -> str:
        """Return a greeting."""
        return f"Hello, I'm {self.name} and I'm {self.age} years old."

    def have_birthday(self) -> None:
        """Increment age by one."""
        self.age += 1
        print(f"{self.name} is now {self.age} years old!")

    # String representation
    def __str__(self) -> str:
        """Informal string representation."""
        return f"Person(name={self.name}, age={self.age})"

    def __repr__(self) -> str:
        """Official string representation."""
        return f"Person('{self.name}', {self.age})"

# Properties for controlled access
class BankAccount:
    """Bank account with protected balance."""

    def __init__(self, owner: str, initial_balance: float = 0.0):
        self.owner = owner
        self._balance = initial_balance  # Protected attribute

    @property
    def balance(self) -> float:
        """Get the current balance (read-only)."""
        return self._balance

    def deposit(self, amount: float) -> None:
        """Deposit money into account."""
        if amount > 0:
            self._balance += amount
            print(f"Deposited \${amount:.2f}. New balance: \${self._balance:.2f}")
        else:
            print("Deposit amount must be positive!")

    def withdraw(self, amount: float) -> bool:
        """Withdraw money from account."""
        if amount > self._balance:
            print("Insufficient funds!")
            return False
        if amount > 0:
            self._balance -= amount
            print(f"Withdrew \${amount:.2f}. New balance: \${self._balance:.2f}")
            return True
        return False

    def __str__(self) -> str:
        return f"Account({self.owner}, \${self._balance:.2f})"

# Inheritance - "is-a" relationship
class Student(Person):
    """Student is a Person with additional attributes."""

    def __init__(self, name: str, age: int, student_id: str):
        # Call parent constructor
        super().__init__(name, age)
        self.student_id = student_id
        self.courses: List[str] = []

    def enroll(self, course: str) -> None:
        """Enroll in a course."""
        if course not in self.courses:
            self.courses.append(course)
            print(f"{self.name} enrolled in {course}")

    def greet(self) -> str:
        """Override parent method."""
        return f"Hi, I'm {self.name}, a student (ID: {self.student_id})"

    def __str__(self) -> str:
        return f"Student(name={self.name}, id={self.student_id}, courses={len(self.courses)})"

# Multiple inheritance
class Teacher(Person):
    """Teacher is a Person who teaches courses."""

    def __init__(self, name: str, age: int, subject: str):
        super().__init__(name, age)
        self.subject = subject

    def teach(self, course: str) -> str:
        return f"{self.name} is teaching {course}"

class TeachingAssistant(Student, Teacher):
    """TA is both a Student and a Teacher."""

    def __init__(self, name: str, age: int, student_id: str, subject: str):
        # Initialize all parent attributes
        Person.__init__(self, name, age)
        self.student_id = student_id
        self.courses: List[str] = []
        self.subject = subject

    def greet(self) -> str:
        return f"Hi, I'm {self.name}, a TA for {self.subject}"

# Abstract base class
class Shape(ABC):
    """Abstract base class for shapes."""

    @abstractmethod
    def area(self) -> float:
        """Calculate area (must be implemented by subclasses)."""
        pass

    @abstractmethod
    def perimeter(self) -> float:
        """Calculate perimeter (must be implemented by subclasses)."""
        pass

class Rectangle(Shape):
    """Concrete implementation of Shape."""

    def __init__(self, width: float, height: float):
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height

    def perimeter(self) -> float:
        return 2 * (self.width + self.height)

    def __str__(self) -> str:
        return f"Rectangle({self.width}x{self.height})"

class Circle(Shape):
    """Circle shape."""

    def __init__(self, radius: float):
        self.radius = radius

    def area(self) -> float:
        import math
        return math.pi * self.radius ** 2

    def perimeter(self) -> float:
        import math
        return 2 * math.pi * self.radius

    def __str__(self) -> str:
        return f"Circle(radius={self.radius})"

# Magic methods (dunder methods)
class Vector:
    """2D vector with operator overloading."""

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __add__(self, other: 'Vector') -> 'Vector':
        """Vector addition."""
        return Vector(self.x + other.x, self.y + other.y)

    def __sub__(self, other: 'Vector') -> 'Vector':
        """Vector subtraction."""
        return Vector(self.x - other.x, self.y - other.y)

    def __mul__(self, scalar: float) -> 'Vector':
        """Scalar multiplication."""
        return Vector(self.x * scalar, self.y * scalar)

    def __eq__(self, other: object) -> bool:
        """Equality comparison."""
        if not isinstance(other, Vector):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __str__(self) -> str:
        return f"Vector({self.x}, {self.y})"

    def __repr__(self) -> str:
        return f"Vector({self.x}, {self.y})"

# Dataclass (Python 3.7+) - simplified class creation
@dataclass
class Product:
    """Product with automatic __init__, __repr__, __eq__."""
    name: str
    price: float
    quantity: int = 0

    def total_value(self) -> float:
        """Calculate total value of inventory."""
        return self.price * self.quantity

    def restock(self, amount: int) -> None:
        """Add to inventory."""
        self.quantity += amount

# Composition - "has-a" relationship
class Engine:
    """Car engine."""

    def __init__(self, horsepower: int):
        self.horsepower = horsepower
        self.running = False

    def start(self) -> None:
        self.running = True
        print(f"Engine started ({self.horsepower} HP)")

    def stop(self) -> None:
        self.running = False
        print("Engine stopped")

class Car:
    """Car has an Engine (composition)."""

    def __init__(self, model: str, horsepower: int):
        self.model = model
        self.engine = Engine(horsepower)  # Composition

    def start(self) -> None:
        print(f"Starting {self.model}...")
        self.engine.start()

    def stop(self) -> None:
        print(f"Stopping {self.model}...")
        self.engine.stop()

# Class methods and static methods
class MathUtils:
    """Utility class with class and static methods."""

    pi = 3.14159

    @classmethod
    def circle_area(cls, radius: float) -> float:
        """Calculate circle area using class variable."""
        return cls.pi * radius ** 2

    @staticmethod
    def is_even(num: int) -> bool:
        """Check if number is even (doesn't need class/instance)."""
        return num % 2 == 0

if __name__ == "__main__":
    # Basic class usage
    print("=== Basic Classes ===")
    person = Person("Alice", 25)
    print(person.greet())
    person.have_birthday()
    print(f"String: {str(person)}")
    print(f"Repr: {repr(person)}")

    # Properties
    print("\\n=== Properties ===")
    account = BankAccount("Bob", 100.0)
    print(f"Balance: \${account.balance:.2f}")
    account.deposit(50.0)
    account.withdraw(30.0)

    # Inheritance
    print("\\n=== Inheritance ===")
    student = Student("Carol", 20, "S12345")
    print(student.greet())
    student.enroll("Python Programming")
    student.enroll("Data Structures")
    print(student)

    # Multiple inheritance
    print("\\n=== Multiple Inheritance ===")
    ta = TeachingAssistant("Dave", 23, "T67890", "Computer Science")
    print(ta.greet())

    # Abstract classes
    print("\\n=== Abstract Classes ===")
    rect = Rectangle(5, 3)
    circle = Circle(4)
    shapes = [rect, circle]
    for shape in shapes:
        print(f"{shape}: Area={shape.area():.2f}, Perimeter={shape.perimeter():.2f}")

    # Magic methods
    print("\\n=== Magic Methods ===")
    v1 = Vector(1, 2)
    v2 = Vector(3, 4)
    v3 = v1 + v2
    print(f"{v1} + {v2} = {v3}")
    v4 = v1 * 2
    print(f"{v1} * 2 = {v4}")
    print(f"{v1} == {v2}: {v1 == v2}")

    # Dataclass
    print("\\n=== Dataclass ===")
    product = Product("Laptop", 999.99, 5)
    print(product)
    print(f"Total value: \${product.total_value():.2f}")
    product.restock(3)
    print(f"After restock: {product.quantity} units")

    # Composition
    print("\\n=== Composition ===")
    car = Car("Tesla Model S", 670)
    car.start()
    car.stop()

    # Class/static methods
    print("\\n=== Class & Static Methods ===")
    print(f"Circle area (r=5): {MathUtils.circle_area(5):.2f}")
    print(f"Is 42 even? {MathUtils.is_even(42)}")
`,
    tasks: [
      "Create a class with __init__ and methods",
      "Use @property for controlled access",
      "Implement inheritance with super()",
      "Override magic methods like __str__ or __add__"
    ]
  }
};

// Storage key for session persistence
const PYTHON_SESSION_KEY = 'python-ide-session';
const MULTI_FILE_SESSION_KEY = 'archimedes-workshop-files';

interface PythonSession {
  code: string;
  output: string;
  selectedLesson: keyof typeof LESSONS;
  showGuidance: boolean;
  completedTasks: string[];
  chatHistory: Array<{ role: 'user' | 'assistant', content: string }>;
  showNotepad: boolean; // Add notepad visibility to session
  notepadContent: string; // Add notepad content to session
  notepadTitle: string; // Add notepad title to session
}

interface MultiFileSession {
  files: CodeFile[];
  activeFileId: string;
}

export function PythonIDE({ onClose }: PythonIDEProps) {
  const { toast } = useToast();
  const { speak } = useSpeech();

  // Load session from sessionStorage or use defaults
  const loadSession = (): PythonSession | null => {
    const greeted = sessionStorage.getItem('workshop-greeted');
    const saved = localStorage.getItem(PYTHON_SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure default values for new session properties
        return {
          ...parsed,
          showNotepad: parsed.showNotepad ?? false,
          notepadContent: parsed.notepadContent ?? '',
          notepadTitle: parsed.notepadTitle ?? 'Untitled Note',
          // Override greeted status if it's not set in session storage
          // This ensures the greeting is shown on first load if not already greeted
          ...(greeted !== 'true' && { greeted: false }),
        };
      } catch {
        return null;
      }
    }
    return null;
  };

  const loadMultiFileSession = (): MultiFileSession | null => {
    const saved = localStorage.getItem(MULTI_FILE_SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
          return parsed;
        }
      } catch {
        return null;
      }
    }
    return null;
  };

  const savedSession = loadSession();
  const savedMultiFileSession = loadMultiFileSession();

  const [code, setCode] = useState(savedSession?.code || `# ARCHIMEDES Workshop - Freestyle Mode
# Chat with ARCHIMEDES to generate code, or write your own!

`);
  const [output, setOutput] = useState(savedSession?.output || '');
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState<keyof typeof LESSONS>(savedSession?.selectedLesson || 'basics');
  const [showPreview, setShowPreview] = useState(false);
  const [inputPrompts, setInputPrompts] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<string[]>([]);
  const [needsInput, setNeedsInput] = useState(false);
  const [guiOutput, setGuiOutput] = useState<string | null>(null);
  const [hasGuiElements, setHasGuiElements] = useState(false);
  const [showGuidance, setShowGuidance] = useState(savedSession?.showGuidance ?? false);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set(savedSession?.completedTasks || []));
  const [showChat, setShowChat] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>(
    (savedSession?.chatHistory as Array<{ role: 'user' | 'assistant', content: string }>) || []
  );
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastSpokenChatIdRef = useRef<string | null>(null);

  // Notepad state
  const [showNotepad, setShowNotepad] = useState(savedSession?.showNotepad ?? false);
  const [notepadContent, setNotepadContent] = useState(savedSession?.notepadContent ?? '');
  const [notepadTitle, setNotepadTitle] = useState(savedSession?.notepadTitle ?? 'Untitled Note');

  // Multi-file state for multi-language support
  const [files, setFiles] = useState<CodeFile[]>(() => {
    if (savedMultiFileSession?.files) {
      return savedMultiFileSession.files;
    }
    return [{
      id: 'default-file',
      name: 'main.py',
      language: 'python',
      content: ''
    }];
  });
  const [activeFileId, setActiveFileId] = useState<string>(
    savedMultiFileSession?.activeFileId || 'default-file'
  );
  const [showMultiFileMode, setShowMultiFileMode] = useState(false);
  const [showLocalInstructions, setShowLocalInstructions] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('python');
  const [showAITests, setShowAITests] = useState(false);
  const [isFreestyleMode, setIsFreestyleMode] = useState(true); // Default to Freestyle Mode
  const [pythonTheme, setPythonTheme] = useState('terminal-green'); // Default theme
  const currentPythonTheme = getTheme(pythonTheme);
  const [fontSize, setFontSize] = useState(13);
  const [isFormatting, setIsFormatting] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true); // Default to showing minimap
  const [codeCopied, setCodeCopied] = useState(false); // For copy button feedback
  const htmlPreview = ''; // Dummy variable, actual preview logic handled elsewhere
  const [htmlPreviewState, setHtmlPreview] = useState(''); // State to hold HTML preview content
  const [showCodePlayground, setShowCodePlayground] = useState(false); // State for Code Playground toggle
  const [showWebContainer, setShowWebContainer] = useState(false);
  const [webContainerFiles, setWebContainerFiles] = useState<Record<string, any>>({});
  const [webContainerPreviewUrl, setWebContainerPreviewUrl] = useState<string | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showProjectBuilder, setShowProjectBuilder] = useState(false); // State for Project Builder toggle

  // AI processing visual feedback
  const [aiProcessingLines, setAiProcessingLines] = useState<number[]>([]);
  const decorationsCollectionRef = useRef<any>(null);
  
  // Enhanced code quality features
  const [codeQualityHints, setCodeQualityHints] = useState<Array<{ line: number; message: string; severity: 'warning' | 'error' | 'info' }>>([]);
  const [showCodeMetrics, setShowCodeMetrics] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<Array<{ timestamp: string; code: string; output: string; success: boolean }>>([]);

  // Dragging and resizing state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false); // Start centered, not maximized
  const [position, setPosition] = useState({ x: 0, y: 60 });
  const [dimensions, setDimensions] = useState({ width: 1400, height: 800 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ width: 0, height: 0, mouseX: 0, mouseY: 0 });
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const executionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasGreetedRef = useRef(false); // Track if Archimedes has greeted
  const themeListenerCleanupRef = useRef<(() => void) | null>(null);

  // Cleanup theme listener and editor on unmount
  useEffect(() => {
    return () => {
      if (themeListenerCleanupRef.current) {
        themeListenerCleanupRef.current();
        themeListenerCleanupRef.current = null;
      }
      // Properly dispose Monaco editor to prevent memory leaks
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  // Mutation for saving notepad
  const saveNotepadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: notepadTitle, content: notepadContent }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save note');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Note Saved",
        description: `"${notepadTitle}" has been saved to your knowledge base.`,
      });
      setNotepadContent('');
      setNotepadTitle('Untitled Note');
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for code quality analysis
  const analyzeCodeQualityMutation = useMutation({
    mutationFn: async (codeToAnalyze: string) => {
      const response = await fetch('/api/analyze/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: codeToAnalyze }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Code analysis failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const analysisResult = data.analysis || 'No specific issues found.';
      toast({
        title: "Code Quality Analysis",
        description: analysisResult,
      });
      // Optionally, display this in chat or a dedicated panel
      setChatHistory(prev => [...prev, { role: 'assistant', content: `ARCHIMEDES Analysis:\n\n${analysisResult}` }]);
    },
    onError: (error: Error) => {
      console.error('Code analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Error during code analysis: ${error.message}` }]);
    },
  });

  // Function to trigger code quality analysis
  const analyzeCodeQuality = useCallback(() => {
    const currentActiveFile = files.find(f => f.id === activeFileId);
    const currentCode = showMultiFileMode && currentActiveFile ? currentActiveFile.content : code;
    if (currentCode.trim()) {
      // Basic inline quality checks
      const hints: Array<{ line: number; message: string; severity: 'warning' | 'error' | 'info' }> = [];
      const lines = currentCode.split('\n');
      
      lines.forEach((line, index) => {
        // Check for common issues
        if (line.length > 120) {
          hints.push({ line: index + 1, message: 'Line too long (>120 chars)', severity: 'warning' });
        }
        if (/print\(.*\).*print\(.*\)/.test(line)) {
          hints.push({ line: index + 1, message: 'Multiple print statements on one line', severity: 'info' });
        }
        if (/except:/.test(line) && !/except\s+\w+/.test(line)) {
          hints.push({ line: index + 1, message: 'Bare except clause - specify exception type', severity: 'warning' });
        }
      });
      
      setCodeQualityHints(hints);
      analyzeCodeQualityMutation.mutate(currentCode);
    } else {
      toast({ title: "No code to analyze", description: "Please write some code first." });
    }
  }, [analyzeCodeQualityMutation, code, files, activeFileId, showMultiFileMode, toast]);

  // Collaborative AI Review state
  const [showCollaborativeReview, setShowCollaborativeReview] = useState(false);
  const [collaborativeReviewResult, setCollaborativeReviewResult] = useState<{
    reviews: Array<{ provider: string; model: string; feedback: string; rating: number; status: 'success' | 'error' }>;
    summary: string;
    overallRating: number;
  } | null>(null);

  // Review panel drag/resize state
  const [isReviewDragging, setIsReviewDragging] = useState(false);
  const [isReviewResizing, setIsReviewResizing] = useState(false);
  const [reviewPosition, setReviewPosition] = useState({ x: 0, y: 0 });
  const [reviewDimensions, setReviewDimensions] = useState({ width: 900, height: 700 });
  const reviewDragStartRef = useRef({ x: 0, y: 0 });
  const reviewResizeStartRef = useRef({ width: 0, height: 0, mouseX: 0, mouseY: 0 });

  // Mutation for Collaborative AI Code Review
  const collaborativeReviewMutation = useMutation({
    mutationFn: async ({ codeToReview, language, projectName, filePath, relatedFiles }: { 
      codeToReview: string; 
      language: string; 
      projectName?: string; 
      filePath?: string; 
      relatedFiles?: Array<{ path: string; content: string }>;
    }) => {
      const response = await fetch('/api/code/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          code: codeToReview, 
          language, 
          projectName, 
          filePath, 
          relatedFiles 
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to get collaborative review');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCollaborativeReviewResult(data);
      setShowCollaborativeReview(true);
      toast({ title: "Collaborative Review Complete", description: "Multiple AI models have reviewed your code." });

      // Use the speak function from SpeechContext for consistent voice
      const speakReview = () => {
        // Speak the overall summary first
        const summaryText = `Collaborative AI Review Complete. Overall rating: ${data.overallRating} out of 10. ${data.summary}`;
        speak(summaryText);

        // Speak each individual review after a delay
        if (data.reviews && data.reviews.length > 0) {
          let delay = 3000; // Start after summary completes (estimate)

          data.reviews.forEach((review: { provider: string; model: string; feedback: string; rating: number; status: 'success' | 'error' }, index: number) => {
            if (review.status === 'success') {
              setTimeout(() => {
                const reviewText = `Review ${index + 1}: ${review.provider} using ${review.model}. Rating: ${review.rating} out of 10. ${review.feedback}`;
                speak(reviewText);
              }, delay);
              // Estimate delay based on text length (rough: 150ms per word)
              const wordCount = review.feedback.split(' ').length;
              delay += (wordCount * 150) + 1000; // Add buffer between reviews
            }
          });
        }
      };

      speakReview();
    },
    onError: (error: Error) => {
      const errorMsg = error?.message || "Please check your code and try again.";
      speak(`Collaborative code review failed. ${errorMsg}`);
      toast({ 
        title: "Review Failed", 
        description: errorMsg, 
        variant: "destructive" 
      });
    },
  });

  // Function to trigger collaborative code review
  const startCollaborativeReview = useCallback(() => {
    const currentActiveFile = files.find(f => f.id === activeFileId);
    const currentCode = showMultiFileMode && currentActiveFile ? currentActiveFile.content : code;
    const currentLang = showMultiFileMode && currentActiveFile ? currentActiveFile.language : currentLanguage;

    if (currentCode.trim()) {
      speak("Initiating collaborative code review with satellite AI systems.");

      // Gather related files for context (exclude current file)
      const relatedFiles = showMultiFileMode 
        ? files
            .filter(f => f.id !== activeFileId)
            .map(f => ({ path: f.name, content: f.content }))
        : undefined;

      collaborativeReviewMutation.mutate({ 
        codeToReview: currentCode, 
        language: currentLang,
        projectName: showMultiFileMode && currentActiveFile ? currentActiveFile.name : undefined,
        filePath: showMultiFileMode && currentActiveFile ? currentActiveFile.name : undefined,
        relatedFiles: relatedFiles
      });
    } else {
      toast({ title: "No code to review", description: "Please write some code first." });
    }
  }, [collaborativeReviewMutation, code, files, activeFileId, showMultiFileMode, currentLanguage, speak]);

  const runCodeMutation = useMutation({
    mutationFn: async ({ code, inputs }: { code: string; inputs?: string[] }) => {
      const response = await fetch('/api/execute/python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, inputs }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Execution failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Process results...
    },
    onError: (error: Error) => {
      // Handle errors...
    },
  });

  // Update HTML preview when code changes (for HTML files)
  useEffect(() => {
    const activeFile = files.find(f => f.id === activeFileId);
    if (showMultiFileMode && activeFile && activeFile.language === 'html') {
      setHtmlPreview(activeFile.content);
    } else if (!showMultiFileMode && detectLanguageFromCode(code) === 'html') {
      setHtmlPreview(code);
    }
  }, [code, files, activeFileId, showMultiFileMode]);

  // Auto-detect and auto-open WebContainer for React/TypeScript projects
  useEffect(() => {
    const activeFile = files.find(f => f.id === activeFileId);
    const isReactProject = showMultiFileMode && activeFile && 
      (activeFile.language === 'javascript' || activeFile.language === 'typescript') &&
      (activeFile.content.includes('import React') || 
       activeFile.content.includes('from "react"') || 
       activeFile.content.includes("from 'react'") ||
       activeFile.content.includes('useState') ||
       activeFile.content.includes('useEffect') ||
       activeFile.name.endsWith('.jsx') ||
       activeFile.name.endsWith('.tsx'));

    const isNodeProject = showMultiFileMode && activeFile && 
      (activeFile.language === 'javascript' || activeFile.language === 'typescript') &&
      (activeFile.content.includes('express') ||
       activeFile.content.includes('require(') ||
       activeFile.content.includes('import ') ||
       activeFile.name === 'index.js' ||
       activeFile.name === 'server.js' ||
       activeFile.name === 'app.js');

    const hasPackageJson = files.some(f => f.name === 'package.json');

    if ((isReactProject || isNodeProject || hasPackageJson) && !showWebContainer && showMultiFileMode && activeFile) {
      // Auto-open WebContainer for detected projects
      setShowWebContainer(true);

      // Prepare WebContainer files automatically
      const currentCode = activeFile.content;
      const projectFiles = createNodeProjectFiles(currentCode);
      setWebContainerFiles(projectFiles);

      // Show notification with helpful instructions
      const projectType = isReactProject ? 'React' : isNodeProject ? 'Node.js' : 'JavaScript';
      toast({
        title: `${projectType} Project Detected`,
        description: "WebContainer Terminal is now open. Click 'Boot' to start the in-browser Node.js environment.",
        duration: 7000,
      });

      speak(`${projectType} project detected. Web Container terminal is ready for preview.`);
    }
  }, [files, activeFileId, showMultiFileMode, showWebContainer, speak, toast]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Validate editor and monaco are properly initialized
    if (!editor || !monaco) {
      console.warn('Editor or Monaco not properly initialized');
      return;
    }

    try {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Create decorations collection for AI processing feedback
      decorationsCollectionRef.current = editor.createDecorationsCollection();

      // Focus editor after a short delay
      setTimeout(() => {
        try {
          if (editor && typeof editor.focus === 'function') {
            editor.focus();
          }
        } catch (focusError) {
          console.debug('Editor focus skipped:', focusError);
        }
      }, 100);

      // Setup Codeium AI code completions (FREE, unlimited, no API key needed)
      // Only register once to prevent duplicate providers on component remount
      setTimeout(() => {
        try {
          if (!codeiumRegistered && typeof registerCodeiumProvider === 'function') {
            registerCodeiumProvider(monaco, {
              onAutocomplete: (acceptedText: string) => {
                console.debug('Codeium completion accepted:', acceptedText.substring(0, 50) + '...');
              }
            });
            codeiumRegistered = true;
            console.log('✓ Codeium AI code completions enabled (FREE, unlimited)');
          } else if (codeiumRegistered) {
            console.debug('Codeium already registered, skipping duplicate registration');
          }
        } catch (codeiumError) {
          console.warn('Codeium registration failed:', codeiumError);
        }

        // Archimedes v7 Introduction - Add to chat history ONCE per browser session
        if (!hasGreetedRef.current && sessionStorage.getItem('workshop-greeted') !== 'true') {
          hasGreetedRef.current = true;
          sessionStorage.setItem('workshop-greeted', 'true');

          const introMessage = "Greetings! Archimedes version 7 AI assistant now online with Codeium-powered code completions. I'm your friendly programming mentor and cyberpunk coding companion. Whether you need help with basics or advanced techniques, I'm here to guide you through any programming language. Let's create something amazing together!";

          setChatHistory(prev => [...prev, { 
            role: 'assistant', 
            content: introMessage 
          }]);

          // Speak the introduction
          speak(introMessage);
        }
      }, 1000);

      // Add keyboard shortcuts
      editor.addAction({
        id: 'format-document',
        label: 'Format Document',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
        run: () => formatCode()
      });

      editor.addAction({
        id: 'increase-font-size',
        label: 'Increase Font Size',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal],
        run: () => setFontSize(prev => Math.min(prev + 1, 24))
      });

      editor.addAction({
        id: 'decrease-font-size',
        label: 'Decrease Font Size',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus],
        run: () => setFontSize(prev => Math.max(prev - 1, 8))
      });

      // Apply dynamic theme based on terminal CSS variables
      defineAndApplyMonacoTheme(monaco, 'archimedes-workshop');

      // Register theme change listener (cleanup previous if any)
      if (themeListenerCleanupRef.current) {
        themeListenerCleanupRef.current();
      }
      themeListenerCleanupRef.current = createThemeChangeListener(monaco, 'archimedes-workshop');
    } catch (error) {
      console.error('Editor initialization error:', error);
      console.warn('IDE will work without AI completions');
    }
  };

  const formatCode = useCallback(() => {
    if (!editorRef.current) return;
    setIsFormatting(true);
    editorRef.current.getAction('editor.action.formatDocument')?.run();
    setTimeout(() => setIsFormatting(false), 500);
    toast({ title: "Code Formatted", description: "Document formatted successfully" });
  }, [toast]);

  const increaseFontSize = () => setFontSize(prev => Math.min(prev + 1, 24));
  const decreaseFontSize = () => setFontSize(prev => Math.max(prev - 1, 8));
  const resetFontSize = () => setFontSize(13);

  const extractCodeFromResponse = (content: string): string | null => {
    // Normalize line endings first (handle Windows \r\n and old Mac \r)
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Extract code from markdown code blocks and clean it thoroughly
    // Primary regex: ``` followed by optional language, then newline, then code, then ```
    let codeBlockMatch = normalizedContent.match(/```(\w*)\n([\s\S]*?)```/);
    
    console.log('[IDE] Extracting code from response, length:', content.length);
    console.log('[IDE] Code block found:', !!codeBlockMatch);
    
    // Fallback: try matching with just whitespace separator (no strict newline requirement)
    if (!codeBlockMatch) {
      const fallbackMatch = normalizedContent.match(/```\w*\s+([\s\S]*?)```/);
      if (fallbackMatch) {
        console.log('[IDE] Using fallback regex match');
        // For fallback, code is in group 1 - strip any language prefix from first line
        let code = fallbackMatch[1];
        const firstLineEnd = code.indexOf('\n');
        if (firstLineEnd > 0) {
          const firstLine = code.substring(0, firstLineEnd).trim();
          // Check if first line looks like a language name (no spaces, short)
          if (/^[a-z]+$/i.test(firstLine) && firstLine.length < 15) {
            code = code.substring(firstLineEnd + 1);
          }
        }
        return code.trim();
      }
      return null;
    }
    
    if (codeBlockMatch) {
      // codeBlockMatch[1] is the language, codeBlockMatch[2] is the code
      let code = codeBlockMatch[2];
      console.log('[IDE] Language detected:', codeBlockMatch[1] || 'none');
      console.log('[IDE] Extracted code length:', code.length);
      
      // Comprehensive AI artifact removal
      code = code
        // Remove code fence markers that may have leaked through
        .replace(/^```[\w]*\s*/gm, '')
        .replace(/```\s*$/gm, '')
        .replace(/^~~~[\w]*\s*/gm, '')
        .replace(/~~~\s*$/gm, '')
        
        // Remove file path markers
        .replace(/^\/\/\s*FILE:\s*.*$/gm, '')
        .replace(/^#\s*FILE:\s*.*$/gm, '')
        .replace(/^\/\/\s*Path:\s*.*$/gmi, '')
        .replace(/^#\s*Path:\s*.*$/gmi, '')
        
        // Remove conversational AI text
        .replace(/^Here'?s?\s+(the|a|your)\s+code.*?:?\s*$/gmi, '')
        .replace(/^I'?ve?\s+(created|written|made|generated).*?:?\s*$/gmi, '')
        .replace(/^This\s+(code|script|program|function).*?:?\s*$/gmi, '')
        .replace(/^Let'?s?\s+(create|write|build).*?:?\s*$/gmi, '')
        .replace(/^Now\s+(let'?s?|we'?ll?|I'?ll?).*?:?\s*$/gmi, '')
        
        // Remove explanation markers
        .replace(/^\/\/\s*Explanation:.*$/gmi, '')
        .replace(/^#\s*Explanation:.*$/gmi, '')
        .replace(/^\/\/\s*Note:.*$/gmi, '')
        .replace(/^#\s*Note:.*$/gmi, '')
        
        // Trim whitespace
        .trim();
      
      // Remove leading/trailing empty lines
      const lines = code.split('\n');
      while (lines.length > 0 && !lines[0].trim()) {
        lines.shift();
      }
      while (lines.length > 0 && !lines[lines.length - 1].trim()) {
        lines.pop();
      }
      
      return lines.join('\n');
    }
    return null;
  };

  const insertCodeIntoEditor = (code: string) => {
    console.log('[IDE] insertCodeIntoEditor called with', code.length, 'chars');
    
    // Additional cleaning pass before insertion to catch any remaining artifacts
    let cleanedCode = code
      // Remove any remaining markdown artifacts
      .replace(/^```[\w]*\s*/gm, '')
      .replace(/```\s*$/gm, '')
      
      // Remove common AI response patterns
      .replace(/^Here is the (?:updated |modified |complete )?code:?\s*$/gmi, '')
      .replace(/^I've (?:added|updated|modified|created) the code:?\s*$/gmi, '')
      
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      
      // Trim
      .trim();
    
    console.log('[IDE] Cleaned code length:', cleanedCode.length);
    
    // Insert cleaned code into Monaco editor
    if (showMultiFileMode && activeFile) {
      console.log('[IDE] Inserting into multi-file mode, file:', activeFile.name);
      updateFileContent(activeFile.id, cleanedCode);
    } else {
      console.log('[IDE] Inserting into single-file mode');
      setCode(cleanedCode);
    }
    
    // Force Monaco editor to update its value
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        // Replace entire content with cleaned code
        model.setValue(cleanedCode);
        
        // Format the document after insertion
        editorRef.current.getAction('editor.action.formatDocument')?.run();
        
        // Move cursor to end of document
        const lineCount = model.getLineCount();
        const lastLineLength = model.getLineLength(lineCount);
        editorRef.current.setPosition({ lineNumber: lineCount, column: lastLineLength + 1 });
      }
    }
    
    toast({
      title: "Code Inserted",
      description: "AI-generated code has been inserted into the editor",
    });
    
    // Focus editor after insertion
    setTimeout(() => {
      if (editorRef.current && typeof editorRef.current.focus === 'function') {
        editorRef.current.focus();
      }
    }, 150);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatMutation.isPending) return;

    // Get current programming language from active file or selected language
    const progLang = showMultiFileMode && activeFile ? activeFile.language : currentLanguage;

    setChatHistory(prev => [...prev, { role: 'user', content: chatInput }]);
    chatMutation.mutate({ message: chatInput, language: progLang });
    setChatInput('');
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }

    // Auto-speak new assistant messages
    const lastMessage = chatHistory[chatHistory.length - 1];
    if (lastMessage && 
        lastMessage.role === 'assistant' && 
        lastMessage.content && 
        typeof lastMessage.content === 'string' &&
        lastMessage.content.trim().length > 0) {
      const messageId = `${chatHistory.length}-${lastMessage.content.substring(0, Math.min(20, lastMessage.content.length))}`;
      if (messageId !== lastSpokenChatIdRef.current) {
        lastSpokenChatIdRef.current = messageId;
        speak(lastMessage.content);
      }
    }
  }, [chatHistory, speak]);

  // Detect input() calls in code - single-pass parser maintaining position alignment
  const detectInputs = (code: string): string[] => {
    const prompts: string[] = [];
    let i = 0;
    let inputCount = 0;

    while (i < code.length) {
      // Check for triple-quoted strings first (""" or '')
      if ((code.substring(i, i + 3) === '"""' || code.substring(i, i + 3) === "'''") ||
          (code[i] === 'f' && i + 1 < code.length && (code.substring(i + 1, i + 4) === '"""' || code.substring(i + 1, i + 4) === "'''"))) {
        const hasF = code[i] === 'f';
        if (hasF) i++;
        const tripleQuote = code.substring(i, i + 3);
        i += 3; // Skip opening triple-quote

        // Find closing triple-quote
        while (i < code.length) {
          if (code.substring(i, i + 3) === tripleQuote) {
            i += 3; // Skip closing triple-quote
            break;
          }
          i++;
        }
        continue;
      }

      // Skip single/double quoted string literals
      if (code[i] === '"' || code[i] === "'" || (code[i] === 'f' && i + 1 < code.length && (code[i+1] === '"' || code[i+1] === "'"))) {
        const quote = code[i] === 'f' ? code[i+1] : code[i];
        if (code[i] === 'f') i++;
        i++; // Skip opening quote

        while (i < code.length) {
          if (code[i] === '\\' && i + 1 < code.length) {
            i += 2; // Skip escape sequence
          } else if (code[i] === quote) {
            i++; // Skip closing quote
            break;
          } else {
            i++;
          }
        }
        continue;
      }

      // Skip comments
      if (code[i] === '#') {
        while (i < code.length && code[i] !== '\n') i++;
        continue;
      }

      // Check for input( with word boundary
      if (/^\binput\s*\(/.test(code.substring(i))) {
        inputCount++;

        // Extract the potential prompt argument
        const matchInput = code.substring(i).match(/^input\s*\(/);
        if (matchInput) {
          const inputStart = i;
          i += matchInput[0].length; // Move past "input("

          // Try to find a string literal argument
          while (i < code.length && /\s/.test(code[i])) i++; // Skip whitespace

          if (i < code.length && (code[i] === '"' || code[i] === "'")) {
            const quote = code[i];
            i++; // Skip opening quote
            let promptText = '';

            while (i < code.length) {
              if (code[i] === '\\' && i + 1 < code.length) {
                // Include escaped character as-is
                promptText += code.substring(i, i + 2);
                i += 2;
              } else if (code[i] === quote) {
                // Found the closing quote
                prompts.push(promptText);
                i++; // Skip closing quote
                break;
              } else {
                promptText += code[i];
                i++;
              }
            }

            // If we didn't find a closing quote, use default
            if (prompts.length < inputCount) {
              prompts.push(`Input ${inputCount}`);
            }
          } else {
            // No string literal argument, use default
            prompts.push(`Input ${inputCount}`);
          }

          continue;
        }
      }

      i++;
    }

    return prompts;
  };

  // Transform code to use pre-provided inputs using a custom replacement
  const injectInputs = (code: string, inputs: string[]): string => {
    let inputIndex = 0;
    let result = '';
    let i = 0;

    while (i < code.length) {
      // Check for triple-quoted strings first
      if ((code.substring(i, i + 3) === '"""' || code.substring(i, i + 3) === "'''") ||
          (code[i] === 'f' && i + 1 < code.length && (code.substring(i + 1, i + 4) === '"""' || code.substring(i + 1, i + 4) === "'''"))) {
        const hasF = code[i] === 'f';
        if (hasF) {
          result += code[i];
          i++;
        }
        const tripleQuote = code.substring(i, i + 3);
        result += tripleQuote;
        i += 3;

        // Copy until closing triple-quote
        while (i < code.length) {
          if (code.substring(i, i + 3) === tripleQuote) {
            result += tripleQuote;
            i += 3;
            break;
          }
          result += code[i];
          i++;
        }
        continue;
      }

      // Skip over single/double quoted string literals to avoid replacing inside them
      if (code[i] === '"' || code[i] === "'" || (code[i] === 'f' && (code[i+1] === '"' || code[i+1] === "'"))) {
        const quote = code[i] === 'f' ? code[i+1] : code[i];
        if (code[i] === 'f') {
          result += code[i]; // Add the 'f'
          i++;
        }
        result += quote;
        i++;

        // Copy until closing quote (handling escapes)
        while (i < code.length) {
          if (code[i] === '\\' && i + 1 < code.length) {
            result += code[i] + code[i + 1];
            i += 2;
          } else if (code[i] === quote) {
            result += code[i];
            i++;
            break;
          } else {
            result += code[i];
            i++;
          }
        }
        continue;
      }

      // Skip over comments
      if (code[i] === '#') {
        while (i < code.length && code[i] !== '\n') {
          result += code[i];
          i++;
        }
        continue;
      }

      // Check for input( pattern
      if (code.substring(i).match(/^\binput\s*\(/)) {
        const match = code.substring(i).match(/^\binput\s*\(/);
        if (match) {
          // Find the matching closing parenthesis
          let depth = 0;
          let j = i + match[0].length - 1; // Start at the opening (
          let start = j;

          while (j < code.length) {
            if (code[j] === '(') depth++;
            if (code[j] === ')') {
              depth--;
              if (depth === 0) {
                // Found matching ), replace the whole input(...) expression
                if (inputIndex < inputs.length) {
                  const value = inputs[inputIndex++];
                  // Properly escape the value
                  result += `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
                  i = j + 1;
                } else {
                  // No more inputs, keep original
                  result += code.substring(i, j + 1);
                  i = j + 1;
                }
                break;
              }
            }
            j++;
          }
          continue;
        }
      }

      result += code[i];
      i++;
    }

    return result;
  };

  const prepareCodeExecution = () => {
    // Detect if code needs inputs
    const prompts = detectInputs(code);

    if (prompts.length > 0) {
      // Code needs inputs - show input collection form
      setInputPrompts(prompts);
      setInputValues(new Array(prompts.length).fill(''));
      setNeedsInput(true);
      setOutput('📝 This code requires user input. Please fill in the values in the preview panel and click "Run with Inputs".');

      // Auto-show preview if not already visible
      if (!showPreview) {
        setShowPreview(true);
      }
    } else {
      // No inputs needed - run directly
      executeCode(code);
    }
  };

  const executeCode = async (codeToRun: string) => {
    setIsRunning(true);
    setElapsedTime(0);
    setNeedsInput(false);
    setOutput('⏳ Running...\n');

    // Clear any existing timer before starting a new one
    if (executionTimerRef.current) {
      clearInterval(executionTimerRef.current);
    }

    // Start timer
    const startTime = Date.now();
    executionTimerRef.current = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setElapsedTime(parseFloat(elapsed));
      setOutput(`⏳ Running... (${elapsed}s elapsed)\n`);
    }, 100); // Update every 100ms for smooth animation

    try {
      const response = await fetch('/api/execute/python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToRun })
      });

      const data = await response.json();

      if (executionTimerRef.current) {
        clearInterval(executionTimerRef.current);
        executionTimerRef.current = null;
      }

      if (data.success) {
        const timeInfo = data.executionTime ? ` ✓ Completed in ${data.executionTime}s\n\n` : '\n';
        setOutput(timeInfo + (data.output || '(No output)'));

        // Check if GUI output was generated
        if (data.guiOutput) {
          setGuiOutput(data.guiOutput);
          setHasGuiElements(true);
          setShowPreview(true); // Auto-show preview for GUI apps
        } else {
          setGuiOutput(null);
          setHasGuiElements(false);
        }
      } else {
        const timeInfo = data.executionTime ? `⏱️ Execution time: ${data.executionTime}s\n\n` : '\n';
        setOutput(timeInfo + `Error:\n${data.error || 'Unknown error occurred'}` + (data.output ? `\n\nPartial output:\n${data.output}` : ''));
        setGuiOutput(null);
        setHasGuiElements(false);
      }
    } catch (error) {
      if (executionTimerRef.current) {
        clearInterval(executionTimerRef.current);
        executionTimerRef.current = null;
      }
      setOutput(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (executionTimerRef.current) {
        clearInterval(executionTimerRef.current);
        executionTimerRef.current = null;
      }
      setIsRunning(false);
    }
  };

  const runCode = () => {
    prepareCodeExecution();
  };

  const runWithInputs = () => {
    // Check if all inputs are provided
    const hasEmptyInputs = inputValues.some(val => val.trim() === '');
    if (hasEmptyInputs) {
      setOutput('⚠️ Please fill in all input fields before running.');
      return;
    }

    // Inject inputs into code and execute
    const modifiedCode = injectInputs(code, inputValues);
    executeCode(modifiedCode);
  };

  const loadLesson = (lessonKey: keyof typeof LESSONS) => {
    setIsFreestyleMode(false); // Set to technical mode when loading a lesson
    setSelectedLesson(lessonKey);
    setCode(LESSONS[lessonKey].code);
    setOutput('');
    setShowGuidance(true);
    setShowNotepad(false); // Hide notepad when loading lesson
  };

  const activateFreestyleMode = () => {
    setIsFreestyleMode(true); // Explicitly set to Freestyle Mode
    setSelectedLesson('basics'); // Keep a default lesson selected
    setCode('# FREESTYLE MODE - Chat with ARCHIMEDES to create code\n# Ask for anything you want to build!\n\n');
    setOutput('');
    setShowGuidance(false);
    setShowChat(true);
    setShowNotepad(false); // Hide notepad when activating freestyle
  };

  const toggleTask = (task: string) => {
    const newCompleted = new Set(completedTasks);
    if (newCompleted.has(task)) {
      newCompleted.delete(task);
    } else {
      newCompleted.add(task);
    }
    setCompletedTasks(newCompleted);
  };

  const handleQuit = () => {
    if (window.confirm('Are you sure you want to quit? This will clear your current session.')) {
      localStorage.removeItem(PYTHON_SESSION_KEY);
      localStorage.removeItem(MULTI_FILE_SESSION_KEY); // Clear multi-file session too
      sessionStorage.removeItem('workshop-greeted'); // Clear greeting session state
      onClose();
    }
  };

  const toggleMaximize = useCallback(() => {
    const terminalAreaTop = 60;
    const terminalAreaBottom = 60;

    if (isMaximized) {
      const width = Math.min(1400, window.innerWidth - 40);
      const height = Math.min(800, window.innerHeight - terminalAreaTop - terminalAreaBottom - 40);
      setDimensions({ width, height });

      // Center the window
      const centerX = (window.innerWidth - width) / 2;
      const centerY = terminalAreaTop + ((window.innerHeight - terminalAreaTop - terminalAreaBottom - height) / 2);
      setPosition({ x: Math.max(0, centerX), y: Math.max(terminalAreaTop, centerY) });
      setIsMaximized(false);
    } else {
      setIsMaximized(true);
      setDimensions({ width: window.innerWidth, height: window.innerHeight - terminalAreaTop - terminalAreaBottom });
      setPosition({ x: 0, y: terminalAreaTop });
    }
  }, [isMaximized]);

  // Initialize centered in terminal area on mount
  useEffect(() => {
    const terminalAreaTop = 60;
    const terminalAreaBottom = 60;
    const defaultWidth = Math.min(1400, window.innerWidth - 40);
    const defaultHeight = Math.min(800, window.innerHeight - terminalAreaTop - terminalAreaBottom - 40);

    setDimensions({ width: defaultWidth, height: defaultHeight });

    // Center the window
    const centerX = (window.innerWidth - defaultWidth) / 2;
    const centerY = terminalAreaTop + ((window.innerHeight - terminalAreaTop - terminalAreaBottom - defaultHeight) / 2);
    setPosition({ x: Math.max(0, centerX), y: Math.max(terminalAreaTop, centerY) });

    setIsMaximized(false);

    // Listen for global stop speech events
    const handleStopSpeech = () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };

    window.addEventListener('stop-all-speech', handleStopSpeech);

    return () => {
      window.removeEventListener('stop-all-speech', handleStopSpeech);
    };
  }, []);

  // Mouse move handler for dragging
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

  // Mouse up handler for dragging and resizing
  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
    }
  }, [isDragging, isResizing]);

  // Mouse handlers for review panel
  const handleReviewMouseMove = useCallback((e: MouseEvent) => {
    if (isReviewDragging) {
      const deltaX = e.clientX - reviewDragStartRef.current.x;
      const deltaY = e.clientY - reviewDragStartRef.current.y;
      setReviewPosition(prev => ({
        x: Math.max(0, Math.min(window.innerWidth - 300, prev.x + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 200, prev.y + deltaY))
      }));
      reviewDragStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (isReviewResizing) {
      const deltaWidth = e.clientX - reviewResizeStartRef.current.mouseX;
      const deltaHeight = e.clientY - reviewResizeStartRef.current.mouseY;
      setReviewDimensions(prev => ({
        width: Math.max(400, Math.min(window.innerWidth - reviewPosition.x, prev.width + deltaWidth)),
        height: Math.max(400, Math.min(window.innerHeight - reviewPosition.y, prev.height + deltaHeight))
      }));
      reviewResizeStartRef.current.mouseX = e.clientX;
      reviewResizeStartRef.current.mouseY = e.clientY;
    }
  }, [isReviewDragging, isReviewResizing, reviewPosition.x, reviewPosition.y]);

  const handleReviewMouseUp = useCallback(() => {
    if (isReviewDragging || isReviewResizing) {
      setIsReviewDragging(false);
      setIsReviewResizing(false);
    }
  }, [isReviewDragging, isReviewResizing]);

  // Effect for mouse move and up listeners
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

  // Effect for review panel mouse listeners
  useEffect(() => {
    if (isReviewDragging || isReviewResizing) {
      document.addEventListener('mousemove', handleReviewMouseMove);
      document.addEventListener('mouseup', handleReviewMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleReviewMouseMove);
        document.removeEventListener('mouseup', handleReviewMouseUp);
      };
    }
  }, [isReviewDragging, isReviewResizing, handleReviewMouseMove, handleReviewMouseUp]);

  // Center review panel when it opens
  useEffect(() => {
    if (showCollaborativeReview && collaborativeReviewResult) {
      const centerX = (window.innerWidth - reviewDimensions.width) / 2;
      const centerY = (window.innerHeight - reviewDimensions.height) / 2;
      setReviewPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
    }
  }, [showCollaborativeReview, collaborativeReviewResult]);

  // Calculate terminal area boundaries
  const terminalAreaTop = 60; // Voice controls height
  const terminalAreaBottom = 60; // Command input height
  const terminalAreaHeight = window.innerHeight - terminalAreaTop - terminalAreaBottom;

  // Get current lesson for guidance display
  const currentLesson = LESSONS[selectedLesson];

  // Mutation for chat requests
  const chatMutation = useMutation({
    mutationFn: async ({ message, language }: { message: string; language?: string }) => {
      // Get current programming language from active file or selected language
      const progLang = showMultiFileMode && activeFile ? activeFile.language : currentLanguage;

      // Visual feedback: highlight code being analyzed
      if (editorRef.current && decorationsCollectionRef.current && monacoRef.current) {
        const currentCode = showMultiFileMode && activeFile ? activeFile.content : code;
        const lineCount = currentCode.split('\n').length;
        const lines: number[] = [];

        // Animate through lines to show AI is reading
        for (let i = 1; i <= Math.min(lineCount, 50); i++) {
          lines.push(i);
        }
        setAiProcessingLines(lines);

        // Apply decorations with pulsing effect
        const decorations = lines.map(line => ({
          range: new monacoRef.current.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'ai-processing-line',
            glyphMarginClassName: 'ai-processing-glyph'
          }
        }));

        decorationsCollectionRef.current.set(decorations);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          mode: isFreestyleMode ? 'freestyle' : 'technical',
          language: 'english', // Human language (English/Spanish/Japanese)
          programmingLanguage: language || progLang // Programming language for code generation
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Chat request failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Clear AI processing decorations
      if (decorationsCollectionRef.current) {
        decorationsCollectionRef.current.clear();
      }
      setAiProcessingLines([]);

      setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }]);

      // Auto-insert code if detected in response (works in all modes now)
      console.log('[IDE] AI Response received, checking for code...');
      console.log('[IDE] Response preview:', data.response.substring(0, 200));
      const extractedCode = extractCodeFromResponse(data.response);
      console.log('[IDE] Extracted code:', extractedCode ? `${extractedCode.length} chars` : 'null');
      if (extractedCode) {
        console.log('[IDE] Inserting code into editor...');
        insertCodeIntoEditor(extractedCode);
        toast({
          title: "Code Ready",
          description: "AI-generated code has been inserted into the editor",
        });
      } else {
        console.log('[IDE] No code block detected in response');
      }
    },
    onError: (error) => {
      // Clear AI processing decorations on error
      if (decorationsCollectionRef.current) {
        decorationsCollectionRef.current.clear();
      }
      setAiProcessingLines([]);

      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response. Please try again.'}` 
      }]);
    },
  });

  // Helper functions for multi-file operations
  const activeFile = files.find(f => f.id === activeFileId);

  const updateFileContent = (fileId: string, content: string) => {
    setFiles(prevFiles =>
      prevFiles.map(f => (f.id === fileId ? { ...f, content } : f))
    );
  };

  const updateFileName = (fileId: string, name: string) => {
    setFiles(prevFiles =>
      prevFiles.map(f => (f.id === fileId ? { ...f, name } : f))
    );
  };

  const addNewFile = () => {
    const newFileId = `file-${Date.now()}`;
    const defaultFileName = `new_file_${files.length + 1}.py`;
    const newFile: CodeFile = {
      id: newFileId,
      name: defaultFileName,
      language: currentLanguage,
      content: '',
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFileId);
  };

  const deleteFile = (fileId: string) => {
    if (files.length <= 1) {
      toast({ title: 'Cannot delete', description: 'Must have at least one file.' });
      return;
    }
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (activeFileId === fileId) {
      setActiveFileId(files[0].id); // Select the first file
    }
  };

  const downloadFile = (file: CodeFile) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllFiles = () => {
    files.forEach(downloadFile);
  };

  // Get editor/Monaco language identifier from our language config
  const getMonacoLanguage = (language: string) => {
    return LANGUAGE_CONFIG[language]?.monacoLang || 'python';
  };

  // Dispatch theme change event when Workshop theme changes
  useEffect(() => {
    localStorage.setItem('python-ide-theme', pythonTheme);

    // Notify Code Playground about theme change
    const event = new CustomEvent('workshop-theme-change', { detail: pythonTheme });
    window.dispatchEvent(event);
  }, [pythonTheme]);

  // Handler to insert tests into the editor
  const handleInsertTests = useCallback((testCode: string) => {
    if (showMultiFileMode && activeFile) {
      updateFileContent(activeFile.id, activeFile.content + '\n\n' + testCode);
    } else {
      setCode(prevCode => prevCode + '\n\n' + testCode);
    }
    toast({
      title: "Tests Inserted",
      description: "Unit tests have been added to your code.",
    });
    speak("Unit tests have been added to your code.");
  }, [activeFile, code, showMultiFileMode, speak, toast]);

  return (
    <>
      {showAITests && (
        <MonacoAITests
          code={showMultiFileMode && activeFile ? activeFile.content : code}
          language={showMultiFileMode && activeFile ? activeFile.language : currentLanguage}
          onClose={() => setShowAITests(false)}
          onInsertTests={handleInsertTests}
        />
      )}

      <div 
        className="fixed z-50 overflow-hidden shadow-2xl flex flex-col rounded-lg"
        style={{
          width: isMaximized ? '100vw' : `${dimensions.width}px`,
          height: isMaximized ? `${terminalAreaHeight}px` : `${dimensions.height}px`,
          left: isMaximized ? '0' : `${position.x}px`,
          top: isMaximized ? `${terminalAreaTop}px` : `${position.y}px`,
          background: currentPythonTheme.gradient ? currentPythonTheme.bg : undefined,
          backgroundColor: currentPythonTheme.gradient ? undefined : currentPythonTheme.bg,
          border: `2px solid ${currentPythonTheme.border}`,
          boxShadow: `0 0 20px ${currentPythonTheme.highlight}40`,
        }}
        data-no-terminal-autofocus
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-3 py-2 rounded-t-lg cursor-move flex-shrink-0"
          style={{
            background: currentPythonTheme.gradient 
              ? `linear-gradient(to right, ${currentPythonTheme.subtle}dd, ${currentPythonTheme.subtle}90)`
              : `${currentPythonTheme.subtle}90`,
            borderBottom: `1px solid ${currentPythonTheme.border}`,
          }}
          onMouseDown={(e) => {
            if (!isMaximized && e.target === e.currentTarget) {
              setIsDragging(true);
              dragStartRef.current = { x: e.clientX, y: e.clientY };
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Code className="w-4 h-4 flex-shrink-0" style={{ color: currentPythonTheme.highlight }} />
            <h3 className="font-mono text-xs font-bold truncate" style={{ color: currentPythonTheme.text }}>
              Archimedes Workshop
            </h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {/* Theme Selector */}
            <select
              value={pythonTheme}
              onChange={(e) => setPythonTheme(e.target.value)}
              className="font-mono text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: currentPythonTheme.bg,
                color: currentPythonTheme.text,
                border: `1px solid ${currentPythonTheme.border}`,
              }}
              title="Select editor theme"
            >
              <optgroup label="Light">
                <option value="solarized-light">Solarized Light</option>
                <option value="github-light">GitHub Light</option>
                <option value="sepia">Sepia</option>
                <option value="nord-light">Nord Light</option>
                <option value="gruvbox-light">Gruvbox Light</option>
                <option value="one-light">One Light</option>
              </optgroup>
              <optgroup label="Mid-Level (Eye Friendly)">
                <option value="soft-morning">☀️ Soft Morning</option>
                <option value="warm-sand">🏖️ Warm Sand</option>
                <option value="cool-mist">🌫️ Cool Mist</option>
                <option value="lavender-dream">💜 Lavender Dream</option>
                <option value="sage-comfort">🌿 Sage Comfort</option>
                <option value="sky-blue-soft">☁️ Sky Blue Soft</option>
                <option value="peachy-calm">🍑 Peachy Calm</option>
              </optgroup>
              <optgroup label="Business Professional">
                <option value="executive-dark">💼 Executive Dark</option>
                <option value="corporate-blue">🏢 Corporate Blue</option>
                <option value="finance-green">💰 Finance Green</option>
                <option value="professional-grey">📊 Professional Grey</option>
                <option value="banking-teal">🏦 Banking Teal</option>
                <option value="consulting-navy">📈 Consulting Navy</option>
                <option value="accounting-beige">📋 Accounting Beige</option>
                <option value="law-burgundy">⚖️ Law Burgundy</option>
                <option value="tech-startup">🚀 Tech Startup</option>
                <option value="healthcare-white">🏥 Healthcare White</option>
              </optgroup>
              <optgroup label="Dark">
                <option value="terminal-green">Terminal Green</option>
                <option value="cyberpunk-dark">Cyberpunk Dark</option>
                <option value="forest-dark">Forest Dark</option>
                <option value="ocean-deep">Ocean Deep</option>
                <option value="ember-dark">Ember Dark</option>
                <option value="twilight-dark">Twilight Dark</option>
                <option value="arctic-dark">Arctic Dark</option>
                <option value="royal-dark">Royal Dark</option>
                <option value="nord-dark">Nord Dark</option>
                <option value="dracula">Dracula</option>
                <option value="one-dark">One Dark</option>
                <option value="gruvbox-dark">Gruvbox Dark</option>
                <option value="tokyo-night">Tokyo Night</option>
                <option value="monokai">Monokai</option>
                <option value="night-owl">Night Owl</option>
                <option value="material-dark">Material Dark</option>
                <option value="oceanic-next">Oceanic Next</option>
                <option value="palenight">Palenight</option>
              </optgroup>
            </select>

            {/* Language Selector */}
            <select
              value={activeFile?.language || currentLanguage}
              onChange={(e) => {
                const newLang = e.target.value;
                setCurrentLanguage(newLang);
                if (activeFile) {
                  const langConfig = LANGUAGE_CONFIG[newLang];
                  const currentName = activeFile.name;
                  const baseName = currentName.replace(/\.[^.]+$/, '');
                  const newName = baseName + langConfig.extension;
                  setFiles(prev => prev.map(f => 
                    f.id === activeFile.id 
                      ? { ...f, language: newLang, name: newName }
                      : f
                  ));
                  toast({
                    title: `${langConfig.icon} ${langConfig.displayName}`,
                    description: `Language changed to ${langConfig.displayName}`,
                  });
                }
              }}
              className="font-mono text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: currentPythonTheme.bg,
                color: currentPythonTheme.highlight,
                border: `1px solid ${currentPythonTheme.border}`,
              }}
              title="Programming language"
            >
              {Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => (
                <option key={lang} value={lang}>
                  {config.icon} {config.displayName}
                </option>
              ))}
            </select>

            {/* Font Size Controls */}
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={decreaseFontSize}
                className="text-xs px-1 hover:opacity-70"
                style={{ color: currentPythonTheme.highlight }}
                title="Decrease font size (Ctrl/Cmd + -)"
              >
                A-
              </button>
              <span className="text-xs" style={{ color: currentPythonTheme.text }}>{fontSize}</span>
              <button
                onClick={increaseFontSize}
                className="text-xs px-1 hover:opacity-70"
                style={{ color: currentPythonTheme.highlight }}
                title="Increase font size (Ctrl/Cmd + +)"
              >
                A+
              </button>
              <button
                onClick={resetFontSize}
                className="text-xs px-1 hover:opacity-70"
                style={{ color: currentPythonTheme.text, opacity: 0.6 }}
                title="Reset font size"
              >
                ↺
              </button>
            </div>

            {/* Icon Buttons */}
            <div className="flex items-center gap-1 ml-2" style={{ borderLeft: `1px solid ${currentPythonTheme.border}`, paddingLeft: '8px' }}>
              <Button
                onClick={() => setShowAITests(true)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Test AI Completions"
                style={{ color: currentPythonTheme.highlight }}
              >
                <TestTube className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={analyzeCodeQuality}
                disabled={!code.trim()}
                className="flex items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30"
                title="AI Quality Analysis"
              >
                <Bot className="w-4 h-4" />
                Analyze
              </Button>

              <Button
                onClick={() => setShowMinimap(!showMinimap)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={showMinimap ? 'Hide minimap' : 'Show minimap'}
                style={{
                  backgroundColor: showMinimap ? `${currentPythonTheme.highlight}20` : 'transparent',
                  color: currentPythonTheme.highlight,
                }}
              >
                <Code className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => setShowMultiFileMode(!showMultiFileMode)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid="button-toggle-multifile"
                title={showMultiFileMode ? 'Single file mode' : 'Multi-file mode'}
                style={{
                  backgroundColor: showMultiFileMode ? `${currentPythonTheme.highlight}20` : 'transparent',
                  color: currentPythonTheme.highlight,
                }}
              >
                <FileCode className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => setShowNotepad(!showNotepad)}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-[var(--terminal-highlight)]/30 hover:border-[var(--terminal-highlight)]"
                style={{
                  backgroundColor: showNotepad ? `${currentPythonTheme.highlight}20` : 'transparent',
                  color: currentPythonTheme.highlight,
                }}
                data-testid="button-notepad"
                title="Show Notepad"
              >
                <FileText className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => setShowSnippets(!showSnippets)}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-[var(--terminal-highlight)]/30 hover:border-[var(--terminal-highlight)]"
                style={{
                  backgroundColor: showSnippets ? `${currentPythonTheme.highlight}20` : 'transparent',
                  color: currentPythonTheme.highlight,
                }}
                data-testid="button-snippets"
                title="Show Snippets"
              >
                <Code className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => setShowProjectBuilder(!showProjectBuilder)}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-[var(--terminal-highlight)]/30 hover:border-[var(--terminal-highlight)]"
                style={{
                  backgroundColor: showProjectBuilder ? `${currentPythonTheme.highlight}20` : 'transparent',
                  color: currentPythonTheme.highlight,
                }}
                data-testid="button-project-builder"
                title="Project Builder"
              >
                <Bot className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => setShowWebContainer(!showWebContainer)}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-[var(--terminal-highlight)]/30 hover:border-[var(--terminal-highlight)]"
                style={{
                  backgroundColor: showWebContainer ? `${currentPythonTheme.highlight}20` : 'transparent',
                  color: currentPythonTheme.highlight,
                }}
                data-testid="button-webcontainer"
                title="WebContainer Terminal (Node.js in browser)"
              >
                <Terminal className="w-4 h-4" />
              </Button>

              <Button
                onClick={toggleMaximize}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={isMaximized ? 'Restore size' : 'Maximize'}
                style={{ color: currentPythonTheme.highlight }}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>

              <Button
                onClick={() => setShowPreview(!showPreview)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid="button-toggle-preview"
                title={showPreview ? 'Hide preview' : 'Show preview'}
                style={{
                  backgroundColor: showPreview ? `${currentPythonTheme.highlight}20` : 'transparent',
                  color: currentPythonTheme.highlight,
                }}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>

              <Button
                onClick={() => setShowChat(!showChat)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={showChat ? 'Hide AI assistant' : 'Show AI assistant'}
                style={{
                  backgroundColor: showChat ? `${currentPythonTheme.highlight}20` : 'transparent',
                  color: currentPythonTheme.highlight,
                }}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>

            {/* Close/Quit Buttons */}
            <div className="flex items-center gap-1 ml-2" style={{ borderLeft: `1px solid ${currentPythonTheme.border}`, paddingLeft: '8px' }}>
              <Button
                onClick={() => {
                  // Save current state before closing
                  const sessionData: PythonSession = {
                    code: showMultiFileMode && activeFile ? activeFile.content : code,
                    output: output,
                    selectedLesson: selectedLesson,
                    showGuidance: showGuidance,
                    completedTasks: Array.from(completedTasks),
                    chatHistory: chatHistory,
                    showNotepad: showNotepad, // Save notepad visibility
                    notepadContent: notepadContent, // Save notepad content
                    notepadTitle: notepadTitle, // Save notepad title
                  };
                  localStorage.setItem(PYTHON_SESSION_KEY, JSON.stringify(sessionData));
                  if (showMultiFileMode) {
                    localStorage.setItem(MULTI_FILE_SESSION_KEY, JSON.stringify({ files, activeFileId }));
                  } else {
                    localStorage.removeItem(MULTI_FILE_SESSION_KEY);
                  }
                  onClose();
                }}
                variant="ghost"
                size="sm"
                className="font-mono text-xs px-2 whitespace-nowrap"
                title="Save current state and close"
                style={{ color: currentPythonTheme.text }}
              >
                Save & Close
              </Button>

              <Button
                onClick={handleQuit}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 flex-shrink-0"
                title="Quit and clear session"
                style={{ color: 'hsl(0 70% 50%)' }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Multi-File Tabs Bar */}
        {showMultiFileMode && (
          <div 
            className="flex items-center gap-1 px-2 py-1 overflow-x-auto"
            style={{ 
              backgroundColor: currentPythonTheme.subtle,
              borderBottom: `1px solid ${currentPythonTheme.border}` 
            }}
          >
            {/* File Tabs */}
            {files.map(file => {
              const langConfig = LANGUAGE_CONFIG[file.language] || LANGUAGE_CONFIG.javascript;
              return (
                <div
                  key={file.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded-t text-xs font-mono cursor-pointer group ${
                    activeFileId === file.id ? 'border-b-2' : ''
                  }`}
                  style={{
                    backgroundColor: activeFileId === file.id ? currentPythonTheme.bg : 'transparent',
                    color: activeFileId === file.id ? currentPythonTheme.highlight : currentPythonTheme.text,
                    borderColor: currentPythonTheme.highlight,
                  }}
                  onClick={() => setActiveFileId(file.id)}
                >
                  <span>{langConfig.icon}</span>
                  <input
                    type="text"
                    value={file.name}
                    onChange={(e) => updateFileName(file.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none outline-none w-20 text-xs"
                    style={{ color: 'inherit' }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadFile(file);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/20"
                    title="Download file"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  {files.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFile(file.id);
                      }}
                      className="ml-1 p-0.5 rounded hover:bg-red-500/30 transition-colors"
                      title="Close file"
                    >
                      <X className="w-3 h-3" style={{ color: currentPythonTheme.text, opacity: 0.6 }} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add New File Button */}
            <button
              onClick={addNewFile}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono hover:opacity-70"
              style={{ color: currentPythonTheme.highlight }}
              title="Add new file"
            >
              <Plus className="w-3 h-3" />
            </button>

            {/* Download All Files */}
            <button
              onClick={downloadAllFiles}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono hover:opacity-70 ml-auto"
              style={{ 
                color: currentPythonTheme.highlight,
                border: `1px solid ${currentPythonTheme.border}`,
              }}
              title="Download all files"
            >
              <Download className="w-3 h-3" />
              All ({files.length})
            </button>

            {/* Local Instructions Toggle */}
            <button
              onClick={() => setShowLocalInstructions(!showLocalInstructions)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono hover:opacity-70"
              style={{ 
                color: showLocalInstructions ? currentPythonTheme.bg : currentPythonTheme.highlight,
                backgroundColor: showLocalInstructions ? currentPythonTheme.highlight : 'transparent',
                border: `1px solid ${currentPythonTheme.border}`,
              }}
              title="Show local run instructions"
            >
              <Info className="w-3 h-3" />
              Run Locally
            </button>
          </div>
        )}

        {/* Local Instructions Panel */}
        {showMultiFileMode && showLocalInstructions && activeFile && (
          <div 
            className="px-4 py-2 text-xs font-mono overflow-x-auto"
            style={{ 
              backgroundColor: `${currentPythonTheme.highlight}15`,
              borderBottom: `1px solid ${currentPythonTheme.border}`,
              color: currentPythonTheme.text,
            }}
          >
            <pre className="whitespace-pre-wrap">{generateLocalInstructions(activeFile.language)}</pre>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">

          {/* Main Content - Resizable Chat and Editor */}
          <PanelGroup direction="horizontal" autoSaveId="python-ide-chat-editor">
            {/* Chat Panel */}
            {showChat && (
              <>
                <Panel defaultSize={30} minSize={20} maxSize={50}>
                  <div className="h-full flex flex-col" style={{ borderRight: `1px solid ${currentPythonTheme.border}`, backgroundColor: currentPythonTheme.subtle }}>
                    <div className="p-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentPythonTheme.border}` }}>
                <div className="flex items-center gap-2 font-mono text-xs" style={{ color: currentPythonTheme.highlight }}>
                  <MessageSquare className="w-4 h-4" />
                  <span>
                    {isFreestyleMode 
                      ? '🎨 FREESTYLE CODE VIBE' 
                      : `${LANGUAGE_CONFIG[activeFile?.language || currentLanguage]?.icon || '💻'} ${LANGUAGE_CONFIG[activeFile?.language || currentLanguage]?.displayName.toUpperCase() || 'CODE'} ASSISTANT`
                    }
                  </span>
                </div>
                <Button
                  onClick={() => setChatHistory([])}
                  variant="ghost"
                  size="sm"
                  className="font-mono text-xs h-7 px-2"
                  style={{
                    color: currentPythonTheme.text,
                    opacity: chatHistory.length > 0 ? 1 : 0.5,
                  }}
                  disabled={chatHistory.length === 0}
                  title="Clear chat history"
                >
                  Clear
                </Button>
              </div>

              {/* Chat History */}
              <ScrollArea className="flex-1">
                <div ref={chatScrollRef} className="p-3 space-y-3">
                  {chatHistory.length === 0 && (
                    <div className="font-mono text-xs" style={{ color: currentPythonTheme.text, opacity: 0.7 }}>
                      <p className="mb-2">💡 Ask me about {LANGUAGE_CONFIG[activeFile?.language || currentLanguage]?.displayName || 'code'}:</p>
                      <ul className="list-disc list-inside text-[10px]">
                        <li>Syntax and best practices</li>
                        <li>Code improvements and optimization</li>
                        <li>Debugging current errors</li>
                        <li>Language-specific features</li>
                        <li>Project structure analysis</li>
                      </ul>
                    </div>
                  )}
                  {chatHistory.map((msg, idx) => {
                    const hasCode = msg.role === 'assistant' && extractCodeFromResponse(msg.content);
                    return (
                      <div key={idx} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div 
                          className="inline-block max-w-[90%] p-2 rounded font-mono text-xs"
                          style={{
                            backgroundColor: msg.role === 'user' ? currentPythonTheme.bg : currentPythonTheme.subtle,
                            color: msg.role === 'user' ? currentPythonTheme.highlight : currentPythonTheme.text,
                            border: `1px solid ${currentPythonTheme.border}`,
                          }}
                        >
                          <div className="font-bold text-[10px] mb-1 opacity-70 flex items-center justify-between gap-2">
                            <span>{msg.role === 'user' ? 'YOU' : 'ARCHIMEDES'}</span>
                            {msg.role === 'assistant' && (
                              <div className="flex gap-1">
                                {hasCode && (
                                  <button
                                    onClick={() => insertCodeIntoEditor(hasCode)}
                                    className="text-[var(--workshop-highlight)]/70 hover:text-[var(--workshop-highlight)] transition-colors"
                                    title="Insert code into editor"
                                  >
                                    ⬇️
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.content).then(() => {
                                      speak('Code copied to clipboard');
                                    }).catch(err => {
                                      console.error('Failed to copy:', err);
                                    });
                                  }}
                                  className="text-[var(--workshop-highlight)]/70 hover:text-[var(--workshop-highlight)] transition-colors"
                                  title="Copy code to clipboard"
                                >
                                  📋
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    );
                  })}
                  {chatMutation.isPending && (
                    <div className="text-left">
                      <div className="inline-block p-2 rounded bg-black/50 text-[var(--workshop-text)]/70 font-mono text-xs">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Analyzing {aiProcessingLines.length > 0 ? `${aiProcessingLines.length} lines` : 'code'}...
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="p-3" style={{ borderTop: `1px solid ${currentPythonTheme.border}` }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Describe what you want to build..."
                    className="flex-1 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: currentPythonTheme.bg,
                      border: `1px solid ${currentPythonTheme.border}`,
                      color: currentPythonTheme.text,
                    }}
                    disabled={chatMutation.isPending}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!chatInput.trim() || chatMutation.isPending}
                    style={{
                      backgroundColor: currentPythonTheme.highlight,
                      color: currentPythonTheme.bg,
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
                  </div>
                </Panel>

                <PanelResizeHandle 
                  style={{ 
                    width: '3px', 
                    backgroundColor: currentPythonTheme.border,
                    cursor: 'col-resize'
                  }} 
                />
              </>
            )}

            {/* Editor/Output Section */}
            <Panel defaultSize={showChat ? 70 : 100} minSize={50}>
              <div className="h-full flex flex-col min-w-0">
          {/* FREESTYLE Mode Banner */}
          {isFreestyleMode && (
            <div className="p-4" style={{ backgroundColor: `${currentPythonTheme.highlight}10`, borderBottom: `1px solid ${currentPythonTheme.border}` }}>
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: currentPythonTheme.highlight }} />
                <div className="flex-1">
                  <div className="font-mono text-xs font-bold mb-2" style={{ color: currentPythonTheme.highlight }}>
                    🎨 FREESTYLE MODE - VIBE CODE WITH ARCHIMEDES
                  </div>
                  <p className="font-mono text-xs leading-relaxed" style={{ color: currentPythonTheme.text }}>
                    Chat freely with ARCHIMEDES in the AI panel to create any code you can imagine. 
                    Describe what you want to build, ask for examples, or request code snippets. 
                    ARCHIMEDES will generate fully functional code based on your vibe!
                  </p>
                </div>
                <button
                  onClick={() => setIsFreestyleMode(false)}
                  className="hover:opacity-70"
                  style={{ color: currentPythonTheme.text }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Archimedes Guidance Panel */}
          {showGuidance && !isFreestyleMode && (
            <div className="p-4" style={{ backgroundColor: `${currentPythonTheme.highlight}08`, borderBottom: `1px solid ${currentPythonTheme.border}` }}>
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: currentPythonTheme.highlight }} />
                <div className="flex-1">
                  <div className="font-mono text-xs font-bold mb-2" style={{ color: currentPythonTheme.highlight }}>
                    {currentLesson.title} - ARCHIMEDES GUIDANCE:
                  </div>
                  <p className="font-mono text-xs leading-relaxed" style={{ color: currentPythonTheme.text }}>
                    {currentLesson.guidance}
                  </p>
                  <div className="mt-3">
                    <div className="font-mono text-xs font-bold mb-2" style={{ color: currentPythonTheme.highlight }}>
                      LEARNING OBJECTIVES:
                    </div>
                    <div className="space-y-1">
                      {currentLesson.tasks.map((task, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <button
                            onClick={() => toggleTask(task)}
                            className="flex-shrink-0 mt-0.5"
                          >
                            <CheckCircle2
                              className="w-4 h-4"
                              style={{
                                color: completedTasks.has(task) ? currentPythonTheme.highlight : `${currentPythonTheme.highlight}50`
                              }}
                            />
                          </button>
                          <span 
                            className={`font-mono text-xs ${completedTasks.has(task) ? 'line-through' : ''}`}
                            style={{ 
                              color: completedTasks.has(task) ? currentPythonTheme.highlight : `${currentPythonTheme.text}B0`
                            }}
                          >
                            {task}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuidance(false)}
                  className="hover:opacity-70"
                  style={{ color: currentPythonTheme.text }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Notepad Section */}
          {showNotepad && (
            <div className="border-b p-4 space-y-3" style={{ 
              backgroundColor: `${currentPythonTheme.bg}dd`,
              borderColor: `${currentPythonTheme.highlight}30`
            }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" style={{ color: currentPythonTheme.highlight }} />
                  <h3 className="font-mono font-bold text-sm" style={{ color: currentPythonTheme.text }}>
                    NOTEPAD
                  </h3>
                </div>
                <button
                  onClick={() => setShowNotepad(false)}
                  className="hover:opacity-70"
                  style={{ color: currentPythonTheme.text }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={notepadTitle}
                onChange={(e) => setNotepadTitle(e.target.value)}
                placeholder="Note title..."
                className="w-full px-3 py-2 rounded font-mono text-sm border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: currentPythonTheme.bg,
                  color: currentPythonTheme.text,
                  borderColor: currentPythonTheme.border,
                }}
                data-testid="notepad-title-input"
              />

              <textarea
                value={notepadContent}
                onChange={(e) => setNotepadContent(e.target.value)}
                placeholder="Type your notes here... (supports plain text and HTML for preview)"
                className="w-full h-32 px-3 py-2 rounded font-mono text-sm border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: currentPythonTheme.bg,
                  color: currentPythonTheme.text,
                  borderColor: currentPythonTheme.border,
                }}
                data-testid="notepad-content-textarea"
              />

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => saveNotepadMutation.mutate()}
                  disabled={saveNotepadMutation.isPending || !notepadContent.trim()}
                  size="sm"
                  className="font-mono text-xs"
                  style={{ 
                    backgroundColor: currentPythonTheme.highlight,
                    color: currentPythonTheme.bg,
                  }}
                  data-testid="button-save-notepad"
                >
                  {saveNotepadMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3 mr-1" />
                      Save to Knowledge Base
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    setNotepadContent('');
                    setNotepadTitle('Untitled Note');
                  }}
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  style={{
                    borderColor: currentPythonTheme.border,
                    color: currentPythonTheme.text,
                  }}
                  data-testid="button-clear-notepad"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>

                <span className="ml-auto font-mono text-xs" style={{ color: currentPythonTheme.text, opacity: 0.7 }}>
                  {notepadContent.length} characters
                </span>
              </div>

              <div className="text-xs font-mono p-2 rounded" style={{ 
                backgroundColor: `${currentPythonTheme.highlight}10`,
                color: currentPythonTheme.text,
                opacity: 0.8
              }}>
                💡 Notes are saved to your knowledge base and can be retrieved using 'docs' or 'read {notepadTitle}' commands.
              </div>
            </div>
          )}

          {/* WebContainer Terminal Section */}
          {showWebContainer && (
            <div className="border-b" style={{ 
              backgroundColor: `${currentPythonTheme.bg}dd`,
              borderColor: `${currentPythonTheme.highlight}30`,
              height: '400px'
            }}>
              <div className="flex items-start justify-between p-3" style={{ borderBottom: `1px solid ${currentPythonTheme.border}` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Terminal className="w-5 h-5" style={{ color: currentPythonTheme.highlight }} />
                  <h3 className="font-mono font-bold text-sm" style={{ color: currentPythonTheme.text }}>
                    WEBCONTAINER TERMINAL
                  </h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ 
                    backgroundColor: `${currentPythonTheme.highlight}20`,
                    color: currentPythonTheme.highlight,
                  }}>
                    Node.js in Browser
                  </span>
                  {webContainerPreviewUrl && (
                    <a
                      href={webContainerPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs px-2 py-0.5 rounded flex items-center gap-1 hover:opacity-80 transition-all"
                      style={{ 
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        color: 'rgb(34, 197, 94)',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                      }}
                    >
                      🌐 Live Preview
                    </a>
                  )}
                  {!window.crossOriginIsolated && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ 
                      backgroundColor: 'rgba(251, 191, 36, 0.2)',
                      color: 'rgb(251, 191, 36)',
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                    }}>
                      ⚠ COI Required
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowWebContainer(false)}
                  className="hover:opacity-70 transition-opacity"
                  style={{ color: currentPythonTheme.text }}
                  title="Close WebContainer Terminal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="h-[calc(100%-48px)]">
                <WebContainerTerminal 
                  files={(() => {
                    // Use cached files if available, otherwise prepare new ones
                    if (Object.keys(webContainerFiles).length > 0) {
                      return webContainerFiles;
                    }

                    const currentCode = showMultiFileMode && activeFile ? activeFile.content : code;
                    const currentLang = showMultiFileMode && activeFile ? activeFile.language : detectLanguageFromCode(currentCode);
                    const fileName = showMultiFileMode && activeFile ? activeFile.name : 'main.py';

                    // Detect React project
                    const isReact = currentCode.includes('import React') || 
                                   currentCode.includes('from "react"') || 
                                   currentCode.includes("from 'react'") ||
                                   currentCode.includes('useState') ||
                                   currentCode.includes('useEffect') ||
                                   fileName.endsWith('.jsx') ||
                                   fileName.endsWith('.tsx');

                    // Detect Express/Node server
                    const isExpress = currentCode.includes('express') ||                                     currentCode.includes('http.createServer') ||
                                     (currentCode.includes('require(') && currentCode.includes('listen'));

                    if ((currentLang === 'javascript' || currentLang === 'typescript') && (isReact || isExpress)) {
                      return createNodeProjectFiles(currentCode);
                    }

                    // Default example server
                    return createNodeProjectFiles(`// Welcome to WebContainer Terminal!
// This runs Node.js entirely in your browser with full npm support.
// 
// Quick start:
// 1. Click 'Boot' to initialize the Node.js environment
// 2. Run 'npm install' to install dependencies
// 3. Run 'npm run dev' or 'npm start' to start the server
// 4. Click the preview URL to see your app

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(\`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WebContainer Demo</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          text-align: center;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        p { font-size: 1.2rem; opacity: 0.9; }
        .badge {
          background: #00ff41;
          color: #000;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          display: inline-block;
          margin-top: 1rem;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 WebContainer Running!</h1>
        <p>This Node.js server is running entirely in your browser.</p>
        <p>No backend required. Full npm support included.</p>
        <div class="badge">Powered by WebContainer API</div>
      </div>
    </body>
    </html>
  \`);
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(\`✓ Server running at http://localhost:\${PORT}\`);
  console.log(\`✓ Node.js version: \${process.version}\`);
  console.log(\`✓ Click the preview URL above to view your app\`);
});
`);
                  })()}
                  onPreviewUrl={(url) => {
                    setWebContainerPreviewUrl(url);
                    if (url) {
                      toast({
                        title: "Preview Ready",
                        description: "Your app is now accessible via the preview link",
                      });
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Editor with Optional Preview Panel */}
          <div className="flex-1 flex border-b border-[var(--workshop-highlight)]/30 min-h-0">
            {showPreview && (showMultiFileMode && activeFile && activeFile.language === 'html') || (!showMultiFileMode && detectLanguageFromCode(code) === 'html') ? (
              <PanelGroup direction="horizontal" autoSaveId="python-ide-html-preview">
                {/* Editor Panel */}
                <Panel defaultSize={50} minSize={30}>
                  <div className="h-full w-full relative">
                    {/* Copy Code Button */}
                    <button
                      onClick={() => {
                        const codeContent = showMultiFileMode && activeFile ? activeFile.content : code;
                        navigator.clipboard.writeText(codeContent).then(() => {
                          setCodeCopied(true);
                          toast({ title: "Copied!", description: "Code copied to clipboard" });
                          setTimeout(() => setCodeCopied(false), 2000);
                        });
                      }}
                      className="absolute top-2 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 rounded text-white/80 hover:text-white transition-colors"
                      title="Copy code to clipboard"
                      data-testid="button-copy-code"
                    >
                      {codeCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <Editor
                      height="100%"
                      width="100%"
                      language={showMultiFileMode && activeFile ? getMonacoLanguage(activeFile.language) : 'python'}
                      value={showMultiFileMode && activeFile ? activeFile.content : code}
                      onChange={(value) => {
                        if (showMultiFileMode && activeFile) {
                          updateFileContent(activeFile.id, value || '');
                        } else {
                          setCode(value || '');
                        }
                      }}
                      onMount={(editor, monaco) => {
                        try {
                          handleEditorDidMount(editor, monaco);
                        } catch (error) {
                          console.error('Editor mount failed:', error);
                          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                          setOutput(`Editor initialization error: ${errorMessage}`);
                        }
                      }}
                      theme="vs-dark"
                      loading={<div className="flex items-center justify-center h-full" style={{ color: currentPythonTheme.text }}>Loading editor...</div>}
                      options={{
                  minimap: { enabled: showMinimap },
                  fontSize: fontSize,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 10, bottom: 10 },
                  wordWrap: 'on',
                  renderWhitespace: 'selection',
                  renderLineHighlight: 'all',
                  tabSize: 4,
                  insertSpaces: true,
                  autoIndent: 'full',
                  formatOnPaste: true,
                  formatOnType: true,
                  trimAutoWhitespace: true,
                  quickSuggestions: { other: true, comments: false, strings: true },
                  acceptSuggestionOnEnter: 'on',
                  parameterHints: { enabled: true, cycle: true },
                  suggest: {
                    showKeywords: true,
                    showSnippets: true,
                    showFunctions: true,
                    showVariables: true,
                    showClasses: true,
                    showConstants: true,
                    showModules: true,
                    showProperties: true,
                    snippetsPreventQuickSuggestions: false
                  },
                  hover: { enabled: true, delay: 300, sticky: true },
                  find: { seedSearchStringFromSelection: 'selection', autoFindInSelection: 'never' },
                  contextmenu: true,
                  mouseWheelZoom: true,
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  lightbulb: {
                    enabled: 'on' as any
                  },
                  matchBrackets: 'always',
                  bracketPairColorization: { enabled: true },
                  guides: { bracketPairs: true, indentation: true },
                  selectOnLineNumbers: true,
                  multiCursorModifier: 'ctrlCmd',
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    useShadows: true,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                  },
                  folding: true,
                  foldingStrategy: 'indentation',
                  showFoldingControls: 'mouseover'
                }}
                      key={`editor-${dimensions.width}-${dimensions.height}-${isMaximized}`}
                    />
                  </div>
                </Panel>

                <PanelResizeHandle 
                  style={{ 
                    width: '3px', 
                    backgroundColor: currentPythonTheme.border,
                    cursor: 'col-resize'
                  }} 
                />

                {/* Live HTML Preview Panel */}
                <Panel defaultSize={50} minSize={30}>
                  <div className="h-full bg-white overflow-auto">
                    <div className="sticky top-0 px-2 py-1 bg-gray-100 border-b text-xs font-mono text-gray-600 flex items-center justify-between">
                      <span>🎨 Live Preview</span>
                      <button
                        onClick={() => {
                          const blob = new Blob([htmlPreviewState], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Open in New Tab
                      </button>
                    </div>
                    <iframe
                      srcDoc={htmlPreviewState}
                      sandbox="allow-scripts allow-same-origin"
                      className="w-full h-full border-none"
                      title="HTML Preview"
                    />
                  </div>
                </Panel>
              </PanelGroup>
            ) : showPreview ? (
              <PanelGroup direction="horizontal" autoSaveId="python-ide-preview">
                {/* Editor Panel */}
                <Panel defaultSize={60} minSize={30}>
                  <div className="h-full w-full relative">
                    {/* Copy Code Button */}
                    <button
                      onClick={() => {
                        const codeContent = showMultiFileMode && activeFile ? activeFile.content : code;
                        navigator.clipboard.writeText(codeContent).then(() => {
                          setCodeCopied(true);
                          toast({ title: "Copied!", description: "Code copied to clipboard" });
                          setTimeout(() => setCodeCopied(false), 2000);
                        });
                      }}
                      className="absolute top-2 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 rounded text-white/80 hover:text-white transition-colors"
                      title="Copy code to clipboard"
                      data-testid="button-copy-code-2"
                    >
                      {codeCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <Editor
                      height="100%"
                      width="100%"
                      language={showMultiFileMode && activeFile ? getMonacoLanguage(activeFile.language) : 'python'}
                      value={showMultiFileMode && activeFile ? activeFile.content : code}
                      onChange={(value) => {
                        if (showMultiFileMode && activeFile) {
                          updateFileContent(activeFile.id, value || '');
                        } else {
                          setCode(value || '');
                        }
                      }}
                      onMount={(editor, monaco) => {
                        try {
                          handleEditorDidMount(editor, monaco);
                        } catch (error) {
                          console.error('Editor mount failed:', error);
                          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                          setOutput(`Editor initialization error: ${errorMessage}`);
                        }
                      }}
                      theme="vs-dark"
                      loading={<div className="flex items-center justify-center h-full" style={{ color: currentPythonTheme.text }}>Loading editor...</div>}
                      options={{
                  // Display
                  minimap: { enabled: showMinimap },
                  fontSize: fontSize,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 10, bottom: 10 },
                  wordWrap: 'on',
                  renderWhitespace: 'selection',
                  renderLineHighlight: 'all',

                  // Editing
                  tabSize: 4,
                  insertSpaces: true,
                  autoIndent: 'full',
                  formatOnPaste: true,
                  formatOnType: true,
                  trimAutoWhitespace: true,

                  // IntelliSense
                  quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: true
                  },
                  acceptSuggestionOnEnter: 'on',
                  parameterHints: {
                    enabled: true,
                    cycle: true
                  },
                  suggest: {
                    showKeywords: true,
                    showSnippets: true,
                    showFunctions: true,
                    showVariables: true,
                    showClasses: true,
                    showConstants: true,
                    showModules: true,
                    showProperties: true,
                    snippetsPreventQuickSuggestions: false
                  },
                  hover: {
                    enabled: true,
                    delay: 300,
                    sticky: true
                  },

                  // Find/Replace
                  find: {
                    seedSearchStringFromSelection: 'selection',
                    autoFindInSelection: 'never'
                  },

                  // UI Features
                  contextmenu: true,
                  mouseWheelZoom: true,
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',

                  // Code Actions
                  lightbulb: {
                    enabled: 'on' as any
                  },

                  // Brackets
                  matchBrackets: 'always',
                  bracketPairColorization: {
                    enabled: true
                  },
                  guides: {
                    bracketPairs: true,
                    indentation: true
                  },

                  // Selection
                  selectOnLineNumbers: true,
                  multiCursorModifier: 'ctrlCmd',

                  // Scrollbar
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    useShadows: true,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                  },

                  // Folding
                  folding: true,
                  foldingStrategy: 'indentation',
                  showFoldingControls: 'mouseover'
                }}
                      key={`editor-${dimensions.width}-${dimensions.height}-${isMaximized}`}
                    />
                  </div>
                </Panel>

                <PanelResizeHandle 
                  style={{ 
                    width: '3px', 
                    backgroundColor: currentPythonTheme.border,
                    cursor: 'col-resize'
                  }} 
                />

                {/* Preview Panel */}
                <Panel defaultSize={40} minSize={25}>
                  <div 
                    className="h-full overflow-auto p-4" 
                    style={{ 
                      backgroundColor: currentPythonTheme.bg,
                      borderLeft: `1px solid ${currentPythonTheme.border}`
                    }}
                  >
                    <div className="font-mono text-xs mb-4 pb-2" style={{ 
                      color: currentPythonTheme.highlight,
                      borderBottom: `1px solid ${currentPythonTheme.border}`
                    }}>
                      {needsInput ? '⌨️ INTERACTIVE INPUT REQUIRED' : hasGuiElements ? '🎨 GUI APPLICATION PREVIEW' : '📺 LIVE OUTPUT PREVIEW'}
                    </div>

                    {hasGuiElements && guiOutput ? (
                      <div className="space-y-4">
                        <div className="font-mono text-xs mb-4" style={{ color: currentPythonTheme.text }}>
                          ✨ GUI application rendered successfully:
                        </div>
                        <div 
                          className="rounded p-4"
                          style={{ 
                            backgroundColor: 'white',
                            border: `2px solid ${currentPythonTheme.border}`
                          }}
                          dangerouslySetInnerHTML={{ __html: guiOutput }}
                        />
                        <div className="mt-4 p-3 rounded" style={{ 
                          backgroundColor: `${currentPythonTheme.highlight}10`,
                          border: `1px solid ${currentPythonTheme.border}`
                        }}>
                          <div className="font-mono text-xs" style={{ color: currentPythonTheme.text }}>
                            💡 <strong>Support:</strong> Your Python code generated visual output! The preview shows tkinter windows, matplotlib plots, or other GUI elements.
                          </div>
                        </div>
                      </div>
                    ) : needsInput ? (
                      <div className="space-y-4">
                        <div className="font-mono text-xs mb-4" style={{ color: currentPythonTheme.text }}>
                          Your code requires user input. Fill in the values below:
                        </div>

                        {inputPrompts.map((prompt, index) => (
                          <div key={index} className="space-y-2">
                            <label 
                              className="font-mono text-xs font-bold block"
                              style={{ color: currentPythonTheme.highlight }}
                            >
                              {prompt}
                            </label>
                            <input
                              type="text"
                              value={inputValues[index] || ''}
                              onChange={(e) => {
                                const newValues = [...inputValues];
                                newValues[index] = e.target.value;
                                setInputValues(newValues);
                              }}
                              placeholder={`Enter ${prompt.toLowerCase()}`}
                              className="w-full px-3 py-2 font-mono text-xs rounded focus:outline-none focus:ring-2"
                              style={{
                                backgroundColor: currentPythonTheme.subtle,
                                color: currentPythonTheme.text,
                                border: `1px solid ${currentPythonTheme.border}`,
                              }}
                              data-testid={`input-field-${index}`}
                            />
                          </div>
                        ))}

                        <Button
                          onClick={runWithInputs}
                          disabled={isRunning}
                          className="w-full font-mono text-sm mt-4"
                          style={{
                            backgroundColor: currentPythonTheme.highlight,
                            color: currentPythonTheme.bg,
                          }}
                          data-testid="button-run-with-inputs"
                        >
                          {isRunning ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Run with Inputs
                            </>
                          )}
                        </Button>

                        <div className="mt-4 p-3 rounded" style={{ 
                          backgroundColor: `${currentPythonTheme.highlight}10`,
                          border: `1px solid ${currentPythonTheme.border}`
                        }}>
                          <div className="font-mono text-xs" style={{ color: currentPythonTheme.text }}>
                            💡 <strong>How it works:</strong> Your input values will be automatically injected into the code before execution, replacing each input() call.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <pre 
                        className="font-mono text-xs whitespace-pre-wrap"
                        style={{ color: currentPythonTheme.text }}
                        data-testid="preview-output"
                      >
                        {output || '// Run code to see output here...'}
                      </pre>
                    )}
                  </div>
                </Panel>
              </PanelGroup>
            ) : (
              <div className="h-full w-full relative">
                {/* Copy Code Button */}
                <button
                  onClick={() => {
                    const codeContent = showMultiFileMode && activeFile ? activeFile.content : code;
                    navigator.clipboard.writeText(codeContent).then(() => {
                      setCodeCopied(true);
                      toast({ title: "Copied!", description: "Code copied to clipboard" });
                      setTimeout(() => setCodeCopied(false), 2000);
                    });
                  }}
                  className="absolute top-2 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 rounded text-white/80 hover:text-white transition-colors"
                  title="Copy code to clipboard"
                  data-testid="button-copy-code-3"
                >
                  {codeCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <Editor
                  height="100%"
                  width="100%"
                  language={showMultiFileMode && activeFile ? getMonacoLanguage(activeFile.language) : 'python'}
                  value={showMultiFileMode && activeFile ? activeFile.content : code}
                  onChange={(value) => {
                    if (showMultiFileMode && activeFile) {
                      updateFileContent(activeFile.id, value || '');
                    } else {
                      setCode(value || '');
                    }
                  }}
                  onMount={(editor, monaco) => {
                    try {
                      handleEditorDidMount(editor, monaco);
                    } catch (error) {
                      console.error('Editor mount failed:', error);
                      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                      setOutput(`Editor initialization error: ${errorMessage}`);
                    }
                  }}
                  theme="vs-dark"
                  loading={<div className="flex items-center justify-center h-full" style={{ color: currentPythonTheme.text }}>Loading editor...</div>}
                  options={{
              // Display
              minimap: { enabled: showMinimap },
              fontSize: fontSize,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 10, bottom: 10 },
              wordWrap: 'on',
              renderWhitespace: 'selection',
              renderLineHighlight: 'all',

              // Editing
              tabSize: 4,
              insertSpaces: true,
              autoIndent: 'full',
              formatOnPaste: true,
              formatOnType: true,
              trimAutoWhitespace: true,

              // IntelliSense
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true
              },
              acceptSuggestionOnEnter: 'on',
              parameterHints: {
                enabled: true,
                cycle: true
              },
              suggest: {
                showKeywords: true,
                showSnippets: true,
                showFunctions: true,
                showVariables: true,
                showClasses: true,
                showConstants: true,
                showModules: true,
                showProperties: true,
                snippetsPreventQuickSuggestions: false
              },
              hover: {
                enabled: true,
                delay: 300,
                sticky: true
              },

              // Find/Replace
              find: {
                seedSearchStringFromSelection: 'selection',
                autoFindInSelection: 'never'
              },

              // UI Features
              contextmenu: true,
              mouseWheelZoom: true,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',

              // Code Actions
              lightbulb: {
                enabled: 'on' as any
              },

              // Brackets
              matchBrackets: 'always',
              bracketPairColorization: {
                enabled: true
              },
              guides: {
                bracketPairs: true,
                indentation: true
              },

              // Selection
              selectOnLineNumbers: true,
              multiCursorModifier: 'ctrlCmd',

              // Scrollbar
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                useShadows: true,
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10
              },

              // Folding
              folding: true,
              foldingStrategy: 'indentation',
              showFoldingControls: 'mouseover'
            }}
                  key={`editor-${dimensions.width}-${dimensions.height}-${isMaximized}`}
                />
              </div>
            )}
          </div>

          {/* Run Button */}
          <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: currentPythonTheme.subtle, borderBottom: `1px solid ${currentPythonTheme.border}` }}>
            <div className="flex gap-2">
              <Button
                onClick={runCode}
                disabled={isRunning}
                className="font-mono text-sm"
                style={{
                  backgroundColor: currentPythonTheme.bg,
                  color: currentPythonTheme.highlight,
                  border: `1px solid ${currentPythonTheme.border}`,
                }}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {showMultiFileMode ? 'Run Active File' : 'Run Code'}
                  </>
                )}
              </Button>
              {showMultiFileMode && files.length > 1 && (
                <Button
                  onClick={() => {
                    // Run main file or first Python file
                    const mainFile = files.find(f => f.name === 'main.py') || files.find(f => f.language === 'python');
                    if (mainFile) {
                      setActiveFileId(mainFile.id);
                      setTimeout(() => runCode(), 100);
                    } else {
                      toast({
                        title: "No main file",
                        description: "Create a main.py file or select a Python file to run",
                        variant: "destructive"
                      });
                    }
                  }}
                  disabled={isRunning}
                  variant="outline"
                  className="font-mono text-sm"
                  style={{
                    backgroundColor: currentPythonTheme.bg,
                    color: currentPythonTheme.text,
                    border: `1px solid ${currentPythonTheme.border}`,
                  }}
                  title="Run main.py or first Python file"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Main
                </Button>
              )}
              <Button
                onClick={() => {
                  if (showMultiFileMode && activeFile) {
                    updateFileContent(activeFile.id, ''); // Clear active file content
                  } else {
                    setCode(''); // Clear main code state
                  }
                }}
                variant="outline"
                className="font-mono text-sm"
                style={{
                  backgroundColor: currentPythonTheme.bg,
                  color: currentPythonTheme.text,
                  border: `1px solid ${currentPythonTheme.border}`,
                }}
              >
                Clear Editor
              </Button>
              {!showGuidance && (
                <Button
                  onClick={() => setShowGuidance(true)}
                  variant="outline"
                  className="font-mono text-sm"
                  style={{
                    backgroundColor: currentPythonTheme.bg,
                    color: currentPythonTheme.highlight,
                    border: `1px solid ${currentPythonTheme.border}`,
                  }}
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Show Guidance
                </Button>
              )}
              <Button
                onClick={startCollaborativeReview}
                disabled={collaborativeReviewMutation.isPending}
                variant="outline"
                className="font-mono text-sm"
                data-testid="button-collaborative-review"
                style={{
                  backgroundColor: currentPythonTheme.bg,
                  color: '#ff6b6b',
                  border: `1px solid ${currentPythonTheme.border}`,
                }}
                title="Get collaborative feedback from multiple AI systems"
              >
                {collaborativeReviewMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Reviewing...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    AI Review
                  </>
                )}
              </Button>
            </div>
            <div className="font-mono text-xs" style={{ color: `${currentPythonTheme.text}B0` }}>
              {currentLesson.tasks.length > 0 && (
                <span>Progress: {completedTasks.size}/{currentLesson.tasks.length} objectives</span>
              )}
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 overflow-hidden" style={{ backgroundColor: currentPythonTheme.subtle }}>
            <ScrollArea className="h-full w-full">
              <div className="p-4">
                <pre className="font-mono text-xs whitespace-pre-wrap" style={{ color: currentPythonTheme.text }}>
                  {output || '// Run code to see output here...'}
                </pre>
              </div>
            </ScrollArea>
          </div>
        </div>
      </Panel>
    </PanelGroup>
    </div>

        {/* Resize handle */}
        {!isMaximized && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            style={{
              borderRight: `2px solid ${currentPythonTheme.border}`,
              borderBottom: `2px solid ${currentPythonTheme.border}`,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
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

      {/* Collaborative AI Review Panel */}
      {showCollaborativeReview && collaborativeReviewResult && (
        <div 
          className="fixed z-50 overflow-hidden shadow-2xl flex flex-col rounded-lg"
          style={{
            width: `${reviewDimensions.width}px`,
            height: `${reviewDimensions.height}px`,
            left: `${reviewPosition.x}px`,
            top: `${reviewPosition.y}px`,
            backgroundColor: currentPythonTheme.bg,
            border: `2px solid ${currentPythonTheme.border}`,
            boxShadow: `0 0 20px ${currentPythonTheme.highlight}40`,
          }}
          data-testid="panel-collaborative-review"
        >
          <div 
            className="flex-1 overflow-hidden flex flex-col"
            style={{ 
              backgroundColor: currentPythonTheme.bg,
            }}
          >
            {/* Header */}
            <div 
              className="px-6 py-4 flex items-center justify-between cursor-move"
              style={{ 
                backgroundColor: currentPythonTheme.subtle,
                borderBottom: `1px solid ${currentPythonTheme.border}`,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drag-handle')) {
                  setIsReviewDragging(true);
                  reviewDragStartRef.current = { x: e.clientX, y: e.clientY };
                }
              }}
            >
              <div className="flex items-center gap-3 drag-handle">
                <Users className="w-6 h-6" style={{ color: '#ff6b6b' }} />
                <div>
                  <h2 className="font-mono text-lg font-bold" style={{ color: currentPythonTheme.highlight }}>
                    Collaborative AI Code Review
                  </h2>
                  <p className="font-mono text-xs" style={{ color: currentPythonTheme.text }}>
                    {collaborativeReviewResult.summary}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded" style={{ backgroundColor: currentPythonTheme.bg }}>
                  <Star className="w-5 h-5" style={{ color: '#ffd700' }} />
                  <span className="font-mono text-xl font-bold" style={{ color: currentPythonTheme.highlight }}>
                    {collaborativeReviewResult.overallRating}/10
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allReviews = collaborativeReviewResult.reviews
                      .map(r => `${r.provider} (${r.model}) - Rating: ${r.rating}/10\n\n${r.feedback}`)
                      .join('\n\n' + '='.repeat(80) + '\n\n');
                    const fullText = `Collaborative AI Code Review\n\nOverall Rating: ${collaborativeReviewResult.overallRating}/10\n\nSummary: ${collaborativeReviewResult.summary}\n\n${'='.repeat(80)}\n\n${allReviews}`;
                    navigator.clipboard.writeText(fullText).then(() => {
                      toast({ title: "Copied!", description: "All reviews copied to clipboard" });
                      speak("Review feedback copied to clipboard");
                    });
                  }}
                  style={{ color: currentPythonTheme.highlight }}
                  title="Copy all reviews"
                >
                  <Download className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCollaborativeReview(false)}
                  style={{ color: currentPythonTheme.text }}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Review Cards */}
            <ScrollArea className="h-[calc(90vh-120px)]">
              <div className="p-6 space-y-6">
                {collaborativeReviewResult.reviews.map((review, index) => (
                  <div 
                    key={index}
                    className="rounded-lg overflow-hidden"
                    style={{ 
                      backgroundColor: currentPythonTheme.subtle,
                      border: `1px solid ${currentPythonTheme.border}`,
                    }}
                    data-testid={`review-card-${review.provider.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {/* Provider Header */}
                    <div 
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ 
                        backgroundColor: review.status === 'success' ? currentPythonTheme.bg : '#ff6b6b20',
                        borderBottom: `1px solid ${currentPythonTheme.border}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {review.status === 'success' ? (
                          <CheckCircle2 className="w-5 h-5" style={{ color: '#4ade80' }} />
                        ) : (
                          <AlertCircle className="w-5 h-5" style={{ color: '#ff6b6b' }} />
                        )}
                        <div>
                          <span className="font-mono text-sm font-bold" style={{ color: currentPythonTheme.highlight }}>
                            {review.provider}
                          </span>
                          <span className="font-mono text-xs ml-2" style={{ color: currentPythonTheme.text }}>
                            ({review.model})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {review.status === 'success' && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4" style={{ color: '#ffd700' }} />
                            <span className="font-mono text-sm font-bold" style={{ color: currentPythonTheme.text }}>
                              {review.rating}/10
                            </span>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const reviewText = `${review.provider} (${review.model})\nRating: ${review.rating}/10\n\n${review.feedback}`;
                            navigator.clipboard.writeText(reviewText).then(() => {
                              toast({ title: "Copied!", description: `${review.provider} review copied` });
                            });
                          }}
                          className="h-7 w-7 p-0"
                          style={{ color: currentPythonTheme.highlight }}
                          title="Copy this review"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Feedback Content */}
                    <div className="p-4">
                      <pre 
                        className="font-mono text-xs whitespace-pre-wrap leading-relaxed"
                        style={{ color: currentPythonTheme.text }}
                      >
                        {review.feedback}
                      </pre>
                    </div>
                  </div>
                ))}

                {collaborativeReviewResult.reviews.length === 0 && (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#ff6b6b' }} />
                    <p className="font-mono text-sm" style={{ color: currentPythonTheme.text }}>
                      No AI reviewers were able to analyze the code.
                    </p>
                    <p className="font-mono text-xs mt-2" style={{ color: `${currentPythonTheme.text}80` }}>
                      Please check API configurations for Groq, Gemini, or Mistral.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Resize handle */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
              style={{
                borderRight: `2px solid ${currentPythonTheme.border}`,
                borderBottom: `2px solid ${currentPythonTheme.border}`,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsReviewResizing(true);
                reviewResizeStartRef.current = {
                  width: reviewDimensions.width,
                  height: reviewDimensions.height,
                  mouseX: e.clientX,
                  mouseY: e.clientY
                };
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// Helper function to get theme styles
type ThemeColors = { bg: string; text: string; highlight: string; border: string; subtle: string; gradient?: boolean };

function getTheme(themeName: string): ThemeColors {
  const themes: Record<string, ThemeColors> = {
    'solarized-light': { bg: '#fdf6e3', text: '#657b83', highlight: '#2aa198', border: '#eee8d5', subtle: '#eee8d5' },
    'github-light': { bg: '#ffffff', text: '#24292e', highlight: '#0366d6', border: '#d1d5db', subtle: '#f6f8fa' },
    'sepia': { bg: '#f4ecd8', text: '#5b4636', highlight: '#8b4513', border: '#dcd0c0', subtle: '#e1d7c0' },
    'nord-light': { bg: '#eceff4', text: '#4c566a', highlight: '#81a1c1', border: '#d8dee9', subtle: '#e5e9f0' },
    'gruvbox-light': { bg: '#fbf1c7', text: '#3c3836', highlight: '#cc241d', border: '#ebdbb2', subtle: '#ebdbb2' },
    'one-light': { bg: '#fafafa', text: '#383a42', highlight: '#007acc', border: '#e0e0e0', subtle: '#f5f5f5' },
    'terminal-green': { bg: '#000000', text: '#00ff00', highlight: '#00ff00', border: '#00ff0040', subtle: '#00ff0010' },
    'nord-dark': { bg: '#2e3440', text: '#d8dee9', highlight: '#81a1c1', border: '#4c566a', subtle: '#3b4252' },
    'dracula': { bg: '#282a36', text: '#f8f8f2', highlight: '#ff79c6', border: '#44475a', subtle: '#44475a' },
    'one-dark': { bg: '#282c34', text: '#abb2bf', highlight: '#61afef', border: '#3a3f4b', subtle: '#313640' },
    'gruvbox-dark': { bg: '#282828', text: '#ebdbb2', highlight: '#cc241d', border: '#3c3836', subtle: '#3c3836' },
    'tokyo-night': { bg: '#24283b', text: '#a9b1d6', highlight: '#bb9af7', border: '#3a3f51', subtle: '#313644' },
    'monokai': { bg: '#272822', text: '#f8f8f2', highlight: '#e6db74', border: '#3e3d32', subtle: '#3e3d32' },
    'night-owl': { bg: '#011627', text: '#9b9ea0', highlight: '#7fdbca', border: '#1f2a38', subtle: '#1f2a38' },
    'cyberpunk-dark': { bg: 'linear-gradient(45deg, hsl(315 50% 18%) 0%, hsl(280 35% 14%) 25%, hsl(180 45% 16%) 50%, hsl(280 30% 12%) 75%, hsl(315 40% 10%) 100%)', text: '#ff006e', highlight: '#00f5ff', border: '#3c096c', subtle: '#240046', gradient: true },
    'forest-dark': { bg: 'radial-gradient(ellipse at bottom left, hsl(145 50% 22%) 0%, hsl(142 45% 18%) 35%, hsl(138 40% 14%) 65%, hsl(135 35% 10%) 100%)', text: '#14fdce', highlight: '#2dffaa', border: '#021509', subtle: '#0a4d2e', gradient: true },
    'ocean-deep': { bg: 'linear-gradient(to top, hsl(208 65% 20%) 0%, hsl(208 58% 16%) 30%, hsl(205 52% 12%) 65%, hsl(202 45% 8%) 100%)', text: '#0a9396', highlight: '#94d2bd', border: '#005f73', subtle: '#003545', gradient: true },
    'ember-dark': { bg: 'radial-gradient(ellipse at bottom, hsl(15 65% 28%) 0%, hsl(10 58% 20%) 30%, hsl(5 50% 14%) 60%, hsl(0 42% 8%) 100%)', text: '#ff6b35', highlight: '#ffd23f', border: '#4a1c1c', subtle: '#2d0f0f', gradient: true },
    'twilight-dark': { bg: 'radial-gradient(ellipse at bottom, hsl(280 55% 28%) 0%, hsl(290 48% 20%) 25%, hsl(285 40% 14%) 60%, hsl(280 32% 8%) 100%)', text: '#bb86fc', highlight: '#cf6bf9', border: '#2d1b3d', subtle: '#1e0f2d', gradient: true },
    'arctic-dark': { bg: 'radial-gradient(ellipse at top, hsl(183 42% 16%) 0%, hsl(198 32% 13%) 50%, hsl(200 28% 10%) 100%)', text: '#5eaaa8', highlight: '#a7d6d3', border: '#1c3040', subtle: '#14232e', gradient: true },
    'royal-dark': { bg: 'linear-gradient(135deg, hsl(280 40% 14%) 0%, hsl(262 35% 11%) 40%, hsl(48 30% 10%) 70%, hsl(262 30% 9%) 100%)', text: '#e6e4ed', highlight: '#c77dff', border: '#291452', subtle: '#1f0c38', gradient: true },
    'material-dark': { bg: '#263238', text: '#cfd8dc', highlight: '#00bcd4', border: '#37474f', subtle: '#37474f' },
    'oceanic-next': { bg: '#2b3e50', text: '#d8dee9', highlight: '#528bff', border: '#34495e', subtle: '#34495e' },
    'palenight': { bg: '#292d3e', text: '#6a737d', highlight: '#82aaff', border: '#35350', subtle: '#353b50' },

    // New mid-level eye-friendly themes with gradients
    'soft-morning': { bg: 'linear-gradient(135deg, #f5f2ea 0%, #f0ece2 50%, #ebe5d8 100%)', text: '#5a5a5a', highlight: '#6b9080', border: '#dfd3c3', subtle: '#e8dfd0', gradient: true },
    'warm-sand': { bg: 'radial-gradient(ellipse at center, #faf5ed 0%, #f5f0e8 50%, #f0ebe3 100%)', text: '#615950', highlight: '#b08968', border: '#e3ddd3', subtle: '#ede8df', gradient: true },
    'cool-mist': { bg: 'linear-gradient(to bottom, #edf5f7 0%, #e8f1f2 50%, #e3ebee 100%)', text: '#576066', highlight: '#7fa99b', border: '#d6e4e7', subtle: '#dfeaec', gradient: true },
    'lavender-dream': { bg: 'radial-gradient(circle at top, #f5f0fa 0%, #f0ecf5 50%, #ebe7f0 100%)', text: '#5d596d', highlight: '#9d8cc7', border: '#e0d9ea', subtle: '#e8e3ef', gradient: true },
    'sage-comfort': { bg: 'linear-gradient(135deg, #f2f7ed 0%, #edf2e8 50%, #e8ede3 100%)', text: '#556652', highlight: '#86a67c', border: '#dde5d6', subtle: '#e5ebe0', gradient: true },
    'sky-blue-soft': { bg: 'radial-gradient(ellipse at top, #edf6fd 0%, #e8f1f8 50%, #e3ecf3 1000%)', text: '#546478', highlight: '#6b9ac4', border: '#d6e5f0', subtle: '#dfeaf4', gradient: true },
    'peachy-calm': { bg: 'linear-gradient(to right, #fdf2ed 0%, #f8ede8 50%, #f3e8e3 100%)', text: '#6b5d58', highlight: '#d4a59a', border: '#ecddd6', subtle: '#f2e5df', gradient: true },

    // Business Professional Themes with gradients
    'executive-dark': { bg: 'radial-gradient(ellipse at top left, hsl(210 65% 28%) 0%, hsl(195 55% 22%) 25%, hsl(215 50% 16%) 50%, hsl(235 45% 12%) 75%, hsl(220 35% 6%) 100%)', text: '#d4d8de', highlight: '#4a9eff', border: '#242832', subtle: '#242832', gradient: true },
    'corporate-blue': { bg: 'conic-gradient(from 45deg at 30% 70%, hsl(215 75% 32%) 0%, hsl(200 68% 26%) 25%, hsl(220 62% 20%) 50%, hsl(205 55% 16%) 75%, hsl(210 48% 10%) 100%)', text: '#e4e7ed', highlight: '#5b9ff5', border: '#2b3346', subtle: '#2b3346', gradient: true },
    'finance-green': { bg: 'linear-gradient(135deg, hsl(150 65% 26%) 0%, hsl(165 58% 20%) 20%, hsl(145 52% 16%) 40%, hsl(130 45% 12%) 60%, hsl(155 38% 8%) 80%, hsl(145 32% 5%) 100%)', text: '#dfe5e1', highlight: '#40d97a', border: '#25382f', subtle: '#25382f', gradient: true },
    'professional-grey': { bg: 'radial-gradient(ellipse at bottom right, hsl(220 40% 26%) 0%, hsl(210 35% 20%) 30%, hsl(215 30% 16%) 60%, hsl(205 25% 12%) 80%, hsl(220 20% 7%) 100%)', text: '#e0e2e5', highlight: '#6ba3ff', border: '#2d3138', subtle: '#2d3138', gradient: true },
    'banking-teal': { bg: 'conic-gradient(from 90deg at 50% 50%, hsl(185 70% 24%) 0%, hsl(175 62% 18%) 25%, hsl(180 55% 14%) 50%, hsl(190 48% 10%) 75%, hsl(185 42% 6%) 100%)', text: '#e6eceb', highlight: '#40d2c8', border: '#1c3438', subtle: '#1c3438', gradient: true },
    'consulting-navy': { bg: 'radial-gradient(ellipse at center, hsl(220 80% 22%) 0%, hsl(235 70% 18%) 25%, hsl(215 65% 14%) 50%, hsl(230 58% 10%) 75%, hsl(220 50% 6%) 100%)', text: '#e0e3e8', highlight: '#5b9ff5', border: '#1a2440', subtle: '#1a2440', gradient: true },
    'accounting-beige': { bg: 'linear-gradient(160deg, hsl(35 60% 98%) 0%, hsl(42 55% 94%) 25%, hsl(30 50% 90%) 50%, hsl(38 45% 86%) 75%, hsl(35 40% 82%) 100%)', text: '#3d3528', highlight: '#b8863f', border: '#e3d9cc', subtle: '#e3d9cc', gradient: true },
    'law-burgundy': { bg: 'conic-gradient(from 180deg at 40% 60%, hsl(0 65% 24%) 0%, hsl(355 58% 18%) 30%, hsl(340 50% 14%) 60%, hsl(0 45% 10%) 80%, hsl(355 38% 6%) 100%)', text: '#e0dada', highlight: '#d65555', border: '#2e1f1f', subtle: '#2e1f1f', gradient: true },
    'tech-startup': { bg: 'linear-gradient(45deg, hsl(265 70% 26%) 0%, hsl(280 62% 20%) 20%, hsl(190 55% 18%) 40%, hsl(270 52% 14%) 60%, hsl(185 45% 12%) 80%, hsl(265 42% 8%) 100%)', text: '#e6e4ed', highlight: '#a366ff', border: '#291f38', subtle: '#291f38', gradient: true },
    'healthcare-white': { bg: 'radial-gradient(ellipse at top right, hsl(200 50% 99%) 0%, hsl(185 45% 96%) 25%, hsl(195 40% 94%) 50%, hsl(210 35% 92%) 75%, hsl(200 30% 88%) 100%)', text: '#2d3d4a', highlight: '#3d9dd6', border: '#e6ebee', subtle: '#e6ebee', gradient: true },
  };

  return themes[themeName] || themes['dracula']; // Fallback to dracula
}

// Helper function to get language config
function getLanguageConfig(language: string) {
  return LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.python;
}