import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, X, BookOpen, Code, Loader2, Lightbulb, CheckCircle2, MessageSquare, Send, Maximize2, Minimize2, Eye, EyeOff, Download, Plus, Trash2, FileCode, ChevronDown, Info } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useMutation } from '@tanstack/react-query';
import { useSpeech } from '@/contexts/SpeechContext';
import { registerCompletion } from 'monacopilot';
import { registerCodeiumProvider } from '@live-codes/monaco-codeium-provider';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useToast } from '@/hooks/use-toast';

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
2. Install g++ (MinGW on Windows, Xcode on Mac, build-essential on Linux)
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
    guidance: `ARCHIMEDES: Welcome, aspiring programmer! Let's start with the fundamentals. Python emphasizes readability and simplicity - write code that's clear and maintainable. Follow PEP 8 style guidelines: use 4 spaces for indentation, lowercase with underscores for variables, and clear naming conventions.`,
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
}

interface MultiFileSession {
  files: CodeFile[];
  activeFileId: string;
}

export function PythonIDE({ onClose }: PythonIDEProps) {
  const { toast } = useToast();
  
  // Load session from localStorage or use defaults
  const loadSession = (): PythonSession | null => {
    const saved = localStorage.getItem(PYTHON_SESSION_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
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

  const [code, setCode] = useState(savedSession?.code || `# FREESTYLE MODE - Interactive Calculator with Visual Interface
# This calculator uses input() to create an interactive experience
# The preview panel will show input fields for you to fill in!

def calculator():
    """
    Interactive Calculator with Visual Output
    Uses input() for interactive GUI in preview panel
    """

    # Welcome message
    print("╔═══════════════════════════════════════╗")
    print("║   🧮 ARCHIMEDES CALCULATOR v7.0    ║")
    print("╚═══════════════════════════════════════╝")
    print()

    # Display operation menu
    print("📊 Available Operations:")
    print("  [1] ➕ Addition")
    print("  [2] ➖ Subtraction")
    print("  [3] ✖️  Multiplication")
    print("  [4] ➗ Division")
    print("  [5] 📐 Square Root")
    print("  [6] ⚡ Power")
    print()

    # Get user inputs through preview panel
    operation = input("Select operation (1-6): ")

    if operation in ['1', '2', '3', '4', '6']:
        num1 = float(input("Enter first number: "))
        num2 = float(input("Enter second number: "))

        print()
        print("═" * 40)
        print("📝 CALCULATION RESULT:")
        print("═" * 40)

        if operation == '1':
            result = num1 + num2
            print(f"✅ {num1} + {num2} = {result}")
        elif operation == '2':
            result = num1 - num2
            print(f"✅ {num1} - {num2} = {result}")
        elif operation == '3':
            result = num1 * num2
            print(f"✅ {num1} × {num2} = {result}")
        elif operation == '4':
            if num2 != 0:
                result = num1 / num2
                print(f"✅ {num1} ÷ {num2} = {result}")
            else:
                print("❌ Error: Division by zero!")
        elif operation == '6':
            result = num1 ** num2
            print(f"✅ {num1} ^ {num2} = {result}")

    elif operation == '5':
        num = float(input("Enter number: "))
        if num >= 0:
            result = num ** 0.5
            print()
            print("═" * 40)
            print("📝 CALCULATION RESULT:")
            print("═" * 40)
            print(f"✅ √{num} = {result}")
        else:
            print("❌ Error: Cannot calculate square root of negative number!")
    else:
        print("❌ Invalid operation selected!")

    print("═" * 40)
    print("💡 Calculator session complete!")

# Run the calculator
calculator()
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
  
  // Sync current file content with main code state when in multi-file mode
  const activeFile = files.find(f => f.id === activeFileId);
  
  // Save multi-file session to localStorage
  useEffect(() => {
    if (showMultiFileMode && files.length > 0) {
      localStorage.setItem(MULTI_FILE_SESSION_KEY, JSON.stringify({ files, activeFileId }));
    }
  }, [files, activeFileId, showMultiFileMode]);
  
  // Multi-file management functions
  const addNewFile = useCallback(() => {
    const langConfig = LANGUAGE_CONFIG[currentLanguage] || LANGUAGE_CONFIG.javascript;
    const newFile: CodeFile = {
      id: `file-${Date.now()}`,
      name: `file${files.length + 1}${langConfig.extension}`,
      language: currentLanguage,
      content: currentLanguage === 'python' ? '# New file\n' : '// New file\n'
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  }, [files.length, currentLanguage]);
  
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
  
  const updateFileName = useCallback((id: string, name: string) => {
    const newLang = getLanguageFromFilename(name);
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, name, language: newLang } : f
    ));
  }, []);
  
  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, content } : f
    ));
  }, []);
  
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
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    toast({ title: "Downloaded", description: `${files.length} files saved to your computer.` });
  }, [files, toast]);

  // Set document title when component mounts
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Archimedes Workshop - Multi-Language IDE';
    return () => { document.title = originalTitle; };
  }, []);
  const [showLessonsSidebar, setShowLessonsSidebar] = useState(true);
  const [isFreestyleMode, setIsFreestyleMode] = useState(true); // Default to Freestyle Mode
  const editorRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { speak } = useSpeech();
  const lastSpokenChatIdRef = useRef<string>('');

  // Resizable window state
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ width: 0, height: 0, mouseX: 0, mouseY: 0 });

  // Python IDE independent theme system - easy on the eyes
  const [pythonTheme, setPythonTheme] = useState('terminal-green');

  const PYTHON_THEMES = {
    // Light themes
    'solarized-light': {
      bg: 'hsl(44 87% 94%)',
      text: 'hsl(192 15% 40%)',
      highlight: 'hsl(205 69% 49%)',
      subtle: 'hsl(44 11% 86%)',
      border: 'hsl(45 7% 79%)',
    },
    'github-light': {
      bg: 'hsl(0 0% 99%)',
      text: 'hsl(210 11% 15%)',
      highlight: 'hsl(212 92% 45%)',
      subtle: 'hsl(210 18% 96%)',
      border: 'hsl(214 13% 93%)',
    },
    'sepia': {
      bg: 'hsl(40 35% 92%)',
      text: 'hsl(30 12% 25%)',
      highlight: 'hsl(25 75% 47%)',
      subtle: 'hsl(40 25% 85%)',
      border: 'hsl(40 18% 75%)',
    },
    'nord-light': {
      bg: 'hsl(219 28% 97%)',
      text: 'hsl(220 16% 36%)',
      highlight: 'hsl(213 32% 52%)',
      subtle: 'hsl(220 27% 92%)',
      border: 'hsl(220 16% 84%)',
    },
    'gruvbox-light': {
      bg: 'hsl(48 87% 88%)',
      text: 'hsl(0 4% 25%)',
      highlight: 'hsl(24 56% 50%)',
      subtle: 'hsl(48 45% 82%)',
      border: 'hsl(45 25% 70%)',
    },
    'one-light': {
      bg: 'hsl(230 1% 98%)',
      text: 'hsl(230 8% 24%)',
      highlight: 'hsl(221 87% 60%)',
      subtle: 'hsl(230 5% 94%)',
      border: 'hsl(230 8% 88%)',
    },

    // Dark themes - easy on the eyes
    'nord-dark': {
      bg: 'hsl(220 16% 22%)',
      text: 'hsl(218 27% 94%)',
      highlight: 'hsl(193 43% 67%)',
      subtle: 'hsl(220 17% 17%)',
      border: 'hsl(220 16% 28%)',
    },
    'dracula': {
      bg: 'hsl(231 15% 18%)',
      text: 'hsl(60 30% 96%)',
      highlight: 'hsl(326 100% 74%)',
      subtle: 'hsl(232 14% 22%)',
      border: 'hsl(231 15% 25%)',
    },
    'one-dark': {
      bg: 'hsl(220 13% 18%)',
      text: 'hsl(220 14% 71%)',
      highlight: 'hsl(207 82% 66%)',
      subtle: 'hsl(220 12% 22%)',
      border: 'hsl(220 13% 26%)',
    },
    'gruvbox-dark': {
      bg: 'hsl(0 0% 16%)',
      text: 'hsl(39 57% 85%)',
      highlight: 'hsl(24 100% 68%)',
      subtle: 'hsl(0 0% 20%)',
      border: 'hsl(0 0% 25%)',
    },
    'tokyo-night': {
      bg: 'hsl(235 16% 15%)',
      text: 'hsl(218 13% 65%)',
      highlight: 'hsl(187 71% 68%)',
      subtle: 'hsl(235 18% 18%)',
      border: 'hsl(235 16% 22%)',
    },
    'monokai': {
      bg: 'hsl(70 8% 15%)',
      text: 'hsl(60 30% 96%)',
      highlight: 'hsl(31 89% 65%)',
      subtle: 'hsl(70 8% 18%)',
      border: 'hsl(70 8% 22%)',
    },
    'night-owl': {
      bg: 'hsl(209 61% 16%)',
      text: 'hsl(210 40% 85%)',
      highlight: 'hsl(207 89% 75%)',
      subtle: 'hsl(209 61% 12%)',
      border: 'hsl(209 61% 20%)',
    },
    'material-dark': {
      bg: 'hsl(233 14% 16%)',
      text: 'hsl(0 0% 95%)',
      highlight: 'hsl(199 89% 68%)',
      subtle: 'hsl(233 14% 20%)',
      border: 'hsl(233 14% 24%)',
    },
    'oceanic-next': {
      bg: 'hsl(209 18% 18%)',
      text: 'hsl(0 0% 91%)',
      highlight: 'hsl(187 80% 70%)',
      subtle: 'hsl(209 18% 15%)',
      border: 'hsl(209 18% 22%)',
    },
    'palenight': {
      bg: 'hsl(233 22% 18%)',
      text: 'hsl(0 0% 87%)',
      highlight: 'hsl(267 57% 78%)',
      subtle: 'hsl(233 22% 15%)',
      border: 'hsl(233 22% 24%)',
    },
    'terminal-green': {
      bg: 'hsl(153 38% 8%)',
      text: 'hsl(166 98% 54%)',
      highlight: 'hsl(166 98% 54%)',
      subtle: 'hsl(153 45% 6%)',
      border: 'hsl(153 38% 12%)',
    },
  };

  const currentPythonTheme = PYTHON_THEMES[pythonTheme as keyof typeof PYTHON_THEMES];

  // Center window on mount
  useEffect(() => {
    const centerX = (window.innerWidth - dimensions.width) / 2;
    const centerY = (window.innerHeight - dimensions.height) / 2;
    setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
  }, []);

  // Handle window dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      setPosition(prev => ({
        x: Math.max(0, Math.min(window.innerWidth - dimensions.width, prev.x + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - dimensions.height, prev.y + deltaY))
      }));

      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dimensions]);

  // Handle window resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.mouseX;
      const deltaY = e.clientY - resizeStartRef.current.mouseY;

      setDimensions({
        width: Math.max(600, Math.min(window.innerWidth - position.x, resizeStartRef.current.width + deltaX)),
        height: Math.max(400, Math.min(window.innerHeight - position.y, resizeStartRef.current.height + deltaY))
      });
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, position]);

  // Trigger editor layout update when dimensions change
  useEffect(() => {
    if (editorRef.current && typeof editorRef.current.layout === 'function') {
      // Small delay to ensure DOM has updated
      const timer = setTimeout(() => {
        try {
          editorRef.current?.layout();
        } catch (error) {
          console.warn('Editor layout failed:', error);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [dimensions, isMaximized, showChat, showLessonsSidebar]);

  // Save session to localStorage whenever state changes
  useEffect(() => {
    const session: PythonSession = {
      code,
      output,
      selectedLesson,
      showGuidance,
      completedTasks: Array.from(completedTasks),
      chatHistory
    };
    localStorage.setItem(PYTHON_SESSION_KEY, JSON.stringify(session));
  }, [code, output, selectedLesson, showGuidance, completedTasks, chatHistory]);

  const currentLesson = LESSONS[selectedLesson];

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      // Determine the correct mode based on freestyle state
      const chatMode = isFreestyleMode ? 'freestyle' : 'technical';

      // Detect current language based on multi-file mode and active file
      const currentLanguage = showMultiFileMode && activeFile 
        ? activeFile.language 
        : 'python';
      const currentCode = showMultiFileMode && activeFile 
        ? activeFile.content 
        : code;
      const langConfig = LANGUAGE_CONFIG[currentLanguage];
      const langName = langConfig?.displayName || 'Python';
      const langExtension = langConfig?.extension || '.py';

      const contextMessage = isFreestyleMode 
        ? `${message}\n\nCurrent programming language: ${langName}\nCurrent code in editor:\n\`\`\`${currentLanguage}\n${currentCode}\n\`\`\`\n\nIMPORTANT: Generate ONLY clean, executable ${langName} code. The code should be ready to copy and paste directly into a ${langExtension} file. Do not wrap the code in markdown code blocks or add explanatory text before/after the code.`
        : `${message}\n\nCurrent lesson: ${currentLesson.title}\nCurrent code:\n\`\`\`python\n${code}\n\`\`\`\n\nIMPORTANT: Generate ONLY clean, executable Python code without markdown backticks or code block markers.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contextMessage,
          mode: chatMode,
          sessionId: `python-ide-${Date.now()}`,
          language: 'english',
          targetLanguage: currentLanguage
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      let cleanResponse = data.response;
      let foundValidCode = false;

      // Detect current language for code extraction
      const currentLanguage = showMultiFileMode && activeFile 
        ? activeFile.language 
        : 'python';

      // Language-specific code block patterns
      const languagePatterns: Record<string, RegExp> = {
        python: /```(?:python|py)\s*\n([\s\S]*?)```/,
        javascript: /```(?:javascript|js)\s*\n([\s\S]*?)```/,
        typescript: /```(?:typescript|ts)\s*\n([\s\S]*?)```/,
        java: /```(?:java)\s*\n([\s\S]*?)```/,
        cpp: /```(?:cpp|c\+\+|cxx)\s*\n([\s\S]*?)```/,
        c: /```(?:c)\s*\n([\s\S]*?)```/,
        rust: /```(?:rust|rs)\s*\n([\s\S]*?)```/,
        go: /```(?:go|golang)\s*\n([\s\S]*?)```/,
        ruby: /```(?:ruby|rb)\s*\n([\s\S]*?)```/,
        php: /```(?:php)\s*\n([\s\S]*?)```/,
        csharp: /```(?:csharp|cs|c#)\s*\n([\s\S]*?)```/,
        swift: /```(?:swift)\s*\n([\s\S]*?)```/,
        kotlin: /```(?:kotlin|kt)\s*\n([\s\S]*?)```/,
        bash: /```(?:bash|sh|shell)\s*\n([\s\S]*?)```/,
        sql: /```(?:sql)\s*\n([\s\S]*?)```/,
        html: /```(?:html)\s*\n([\s\S]*?)```/,
        css: /```(?:css)\s*\n([\s\S]*?)```/,
      };

      // Language-specific code detection patterns
      const languageDetectors: Record<string, RegExp> = {
        python: /(?:import|def|class|print|if|for|while|return)\s/,
        javascript: /(?:const|let|var|function|=>|console\.log|require|import)\s/,
        typescript: /(?:const|let|var|function|=>|interface|type|export|import)\s/,
        java: /(?:public|private|class|static|void|import|package)\s/,
        cpp: /(?:#include|int main|cout|cin|std::|using namespace)\s?/,
        c: /(?:#include|int main|printf|scanf|void)\s/,
        rust: /(?:fn|let|mut|impl|struct|enum|use|mod)\s/,
        go: /(?:func|package|import|var|const|type|struct)\s/,
        ruby: /(?:def|class|module|require|puts|end)\s/,
        php: /(?:<\?php|\$\w+|function|class|echo|require)\s?/,
        csharp: /(?:using|namespace|class|public|private|void|static)\s/,
        swift: /(?:func|var|let|class|struct|import|print)\s/,
        kotlin: /(?:fun|val|var|class|object|import|package)\s/,
        bash: /(?:#!\/bin\/bash|echo|if \[|for |while |done|fi)\s?/,
        sql: /(?:SELECT|INSERT|UPDATE|DELETE|CREATE|FROM|WHERE)\s/i,
        html: /(?:<html|<head|<body|<div|<script|<!DOCTYPE)\s?/i,
        css: /(?:\{|\}|margin|padding|color|background|display):/,
      };

      // Try language-specific pattern first
      const langPattern = languagePatterns[currentLanguage];
      if (langPattern) {
        const codeMatch = cleanResponse.match(langPattern);
        if (codeMatch && codeMatch[1]) {
          cleanResponse = codeMatch[1].trim();
          foundValidCode = true;
        }
      }

      // Try generic code block if language-specific didn't work
      if (!foundValidCode) {
        const genericBlockRegex = /```\s*\n([\s\S]*?)```/;
        const codeMatch = cleanResponse.match(genericBlockRegex);
        if (codeMatch && codeMatch[1]) {
          const potentialCode = codeMatch[1].trim();
          const detector = languageDetectors[currentLanguage];
          if (detector && detector.test(potentialCode)) {
            cleanResponse = potentialCode;
            foundValidCode = true;
          }
        }
      }

      // Try any code block pattern as fallback
      if (!foundValidCode) {
        const anyCodeBlock = /```(?:\w+)?\s*\n([\s\S]*?)```/;
        const codeMatch = cleanResponse.match(anyCodeBlock);
        if (codeMatch && codeMatch[1]) {
          cleanResponse = codeMatch[1].trim();
          foundValidCode = true;
        }
      }

      // Pattern 3: If no markdown blocks, check if entire response is code
      if (!foundValidCode) {
        const trimmed = cleanResponse.trim();
        const detector = languageDetectors[currentLanguage] || languageDetectors.python;
        if (detector.test(trimmed)) {
          const lines = trimmed.split('\n');
          const codeLines = lines.filter((line: string) => {
            return !line.match(/^(?:Here|This|The|I'll|Let|Note:|Example:|Output:)/i);
          });
          if (codeLines.length > 0) {
            cleanResponse = codeLines.join('\n').trim();
            foundValidCode = true;
          }
        }
      }

      const assistantMessage = { role: 'assistant' as const, content: data.response };
      setChatHistory(prev => [...prev, assistantMessage]);

      // Auto-paste valid code into editor (multi-file aware)
      if (foundValidCode && cleanResponse && cleanResponse.length > 0) {
        if (showMultiFileMode && activeFile) {
          updateFileContent(activeFile.id, cleanResponse);
          const langName = LANGUAGE_CONFIG[currentLanguage]?.displayName || 'Code';
          setOutput(`✓ ${langName} code automatically pasted into ${activeFile.name}. Ready to use.`);
        } else {
          setCode(cleanResponse);
          setOutput('✓ Clean Python code automatically pasted into editor. Press Run to execute.');
        }
        speak('Code pasted into editor and ready');
      } else {
        speak(data.response);
      }
    },
    onError: (error) => {
      const errorMessage = { role: 'assistant' as const, content: `Error: ${error.message}` };
      setChatHistory(prev => [...prev, errorMessage]);
      speak(`Error: ${error.message}`);
    }
  });

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Validate editor and monaco are properly initialized
    if (!editor || !monaco) {
      console.warn('Editor or Monaco not properly initialized');
      return;
    }

    try {
      editorRef.current = editor;

      // Safe focus with error handling
      setTimeout(() => {
        try {
          if (editor && typeof editor.focus === 'function') {
            editor.focus();
          }
        } catch (focusError) {
          console.debug('Editor focus skipped:', focusError);
        }
      }, 100);

      // Setup AI code completions with Codeium as default, Monacopilot as fallback
      setTimeout(() => {
        let codeiumEnabled = false;
        
        // Try Codeium first (FREE, unlimited, no API key needed)
        try {
          if (typeof registerCodeiumProvider === 'function') {
            registerCodeiumProvider(monaco, {
              onAutocomplete: (acceptedText: string) => {
                console.debug('Codeium completion accepted:', acceptedText.substring(0, 50) + '...');
              }
            });
            codeiumEnabled = true;
            console.debug('✓ Codeium AI code completions enabled (FREE, unlimited)');
          }
        } catch (codeiumError) {
          console.debug('Codeium registration failed, trying fallback:', codeiumError);
        }

        // Fallback to Monacopilot/Mistral if Codeium failed
        if (!codeiumEnabled && typeof registerCompletion === 'function') {
          try {
            registerCompletion(monaco, editor, {
              endpoint: '/api/code-completion',
              language: 'python',
              trigger: 'onIdle'
            });
            console.debug('Monacopilot enabled as fallback (Mistral AI)');
          } catch (monacopilotError) {
            console.debug('Monacopilot fallback also failed:', monacopilotError);
          }
        }
      }, 1000);
    } catch (error) {
      console.error('Editor initialization error:', error);
      console.warn('IDE will work without AI completions');
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatMutation.isPending) return;

    setChatHistory(prev => [...prev, { role: 'user', content: chatInput }]);
    chatMutation.mutate(chatInput);
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
      // Check for triple-quoted strings first (""" or ''')
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

    // Start timer
    const startTime = Date.now();
    const timer = setInterval(() => {
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

      clearInterval(timer);

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
      clearInterval(timer);
      setOutput(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      clearInterval(timer);
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
  };

  const activateFreestyleMode = () => {
    setIsFreestyleMode(true); // Explicitly set to Freestyle Mode
    setSelectedLesson('basics'); // Keep a default lesson selected
    setCode('# FREESTYLE MODE - Chat with ARCHIMEDES to create code\n# Ask for anything you want to build!\n\n');
    setOutput('');
    setShowGuidance(false);
    setShowChat(true);
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
      onClose();
    }
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      // Restore previous size and center position
      setDimensions({ width: 900, height: 600 });
      const centerX = (window.innerWidth - 900) / 2;
      const centerY = (window.innerHeight - 600) / 2;
      setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
      setIsMaximized(false);
    } else {
      // Maximize to full viewport
      setIsMaximized(true);
    }
  };

  return (
    <div 
      className="fixed z-50 overflow-hidden shadow-2xl flex flex-col"
      style={{
        width: isMaximized ? '100vw' : `${dimensions.width}px`,
        height: isMaximized ? '100vh' : `${dimensions.height}px`,
        left: isMaximized ? '0' : `${position.x}px`,
        top: isMaximized ? '0' : `${position.y}px`,
        backgroundColor: currentPythonTheme.bg,
        border: `2px solid ${currentPythonTheme.border}`,
        boxShadow: `0 0 20px ${currentPythonTheme.highlight}40`,
      }}
      data-no-terminal-autofocus
    >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 cursor-move"
          style={{
            backgroundColor: `${currentPythonTheme.subtle}80`,
            borderBottom: `1px solid ${currentPythonTheme.border}`,
          }}
          onMouseDown={(e) => {
            if (!isMaximized && e.target === e.currentTarget) {
              setIsDragging(true);
              dragStartRef.current = { x: e.clientX, y: e.clientY };
            }
          }}
        >
          <div className="flex items-center gap-3">
            <Code className="w-5 h-5" style={{ color: currentPythonTheme.highlight }} />
            <h3 className="font-mono text-sm font-bold" style={{ color: currentPythonTheme.text }}>
              Archimedes Workshop
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pythonTheme}
              onChange={(e) => setPythonTheme(e.target.value)}
              className="font-mono text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: currentPythonTheme.bg,
                color: currentPythonTheme.text,
                border: `1px solid ${currentPythonTheme.border}`,
              }}
            >
              <optgroup label="Light Themes">
                <option value="solarized-light">Solarized Light</option>
                <option value="github-light">GitHub Light</option>
                <option value="sepia">Sepia</option>
                <option value="nord-light">Nord Light</option>
                <option value="gruvbox-light">Gruvbox Light</option>
                <option value="one-light">One Light</option>
              </optgroup>
              <optgroup label="Dark Themes (Easy on Eyes)">
                <option value="terminal-green">Terminal Green</option>
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
            <Button
              onClick={() => setShowMultiFileMode(!showMultiFileMode)}
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              data-testid="button-toggle-multifile"
              style={{
                backgroundColor: showMultiFileMode ? currentPythonTheme.highlight : currentPythonTheme.bg,
                color: showMultiFileMode ? currentPythonTheme.bg : currentPythonTheme.highlight,
                borderColor: currentPythonTheme.border,
              }}
            >
              <FileCode className="w-4 h-4 mr-1" />
              {showMultiFileMode ? 'Single File' : 'Multi-File'}
            </Button>
            <Button
              onClick={toggleMaximize}
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              style={{
                backgroundColor: currentPythonTheme.bg,
                color: currentPythonTheme.highlight,
                borderColor: currentPythonTheme.border,
              }}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              onClick={() => setShowPreview(!showPreview)}
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              data-testid="button-toggle-preview"
              style={{
                backgroundColor: showPreview ? currentPythonTheme.subtle : currentPythonTheme.bg,
                color: currentPythonTheme.highlight,
                borderColor: currentPythonTheme.border,
              }}
            >
              {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
            <Button
              onClick={() => setShowChat(!showChat)}
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              style={{
                backgroundColor: showChat ? currentPythonTheme.subtle : currentPythonTheme.bg,
                color: currentPythonTheme.highlight,
                borderColor: currentPythonTheme.border,
              }}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {showChat ? 'Hide' : 'Ask'} Archimedes
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              style={{
                backgroundColor: currentPythonTheme.bg,
                color: currentPythonTheme.text,
                borderColor: currentPythonTheme.border,
              }}
            >
              Close (Save Session)
            </Button>
            <Button
              onClick={handleQuit}
              variant="ghost"
              size="sm"
              className="font-mono text-xs"
              style={{
                backgroundColor: currentPythonTheme.bg,
                color: 'hsl(0 70% 50%)',
              }}
            >
              Quit & Clear
            </Button>
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
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20"
                      title="Delete file"
                    >
                      <Trash2 className="w-3 h-3" style={{ color: 'hsl(0 70% 50%)' }} />
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
            
            {/* Language Selector */}
            <select
              value={currentLanguage}
              onChange={(e) => setCurrentLanguage(e.target.value)}
              className="ml-2 px-1 py-0.5 rounded text-xs font-mono"
              style={{
                backgroundColor: currentPythonTheme.bg,
                color: currentPythonTheme.text,
                border: `1px solid ${currentPythonTheme.border}`,
              }}
              title="Language for new files"
            >
              {Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => (
                <option key={lang} value={lang}>
                  {config.icon} {config.displayName}
                </option>
              ))}
            </select>
            
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
          {/* Sidebar - Lessons (Collapsible) */}
          {showLessonsSidebar && (
            <div className="w-72 overflow-y-auto" style={{ borderRight: `1px solid ${currentPythonTheme.border}`, backgroundColor: currentPythonTheme.subtle }}>
              <div className="p-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentPythonTheme.border}` }}>
                <div className="flex items-center gap-2 font-mono text-xs" style={{ color: currentPythonTheme.highlight }}>
                  <BookOpen className="w-4 h-4" />
                  <span>COMPREHENSIVE LESSONS</span>
                </div>
                <button
                  onClick={() => setShowLessonsSidebar(false)}
                  className="hover:opacity-70"
                  style={{ color: currentPythonTheme.text }}
                  title="Close lessons sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 space-y-1">
                {/* FREESTYLE Mode Option */}
                <button
                  onClick={activateFreestyleMode}
                  data-freestyle-mode
                  className="w-full text-left px-3 py-2 rounded font-mono text-xs transition-colors"
                  style={{
                    backgroundColor: isFreestyleMode ? currentPythonTheme.bg : 'transparent',
                    color: currentPythonTheme.highlight,
                    border: isFreestyleMode ? `1px solid ${currentPythonTheme.border}` : 'none',
                  }}
                >
                  <div className="font-bold flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" />
                    FREESTYLE MODE
                  </div>
                  <div className="text-[10px] opacity-70 mt-1">Vibe code with AI chat - create anything!</div>
                </button>

                {/* Regular Lessons */}
                {Object.entries(LESSONS).map(([key, lesson]) => (
                  <button
                    key={key}
                    onClick={() => loadLesson(key as keyof typeof LESSONS)}
                    className="w-full text-left px-3 py-2 rounded font-mono text-xs transition-colors"
                    style={{
                      backgroundColor: selectedLesson === key && !isFreestyleMode ? currentPythonTheme.bg : 'transparent',
                      color: selectedLesson === key && !isFreestyleMode ? currentPythonTheme.highlight : currentPythonTheme.text,
                      border: selectedLesson === key && !isFreestyleMode ? `1px solid ${currentPythonTheme.border}` : 'none',
                    }}
                  >
                    <div className="font-bold">{lesson.title}</div>
                    <div className="text-[10px] opacity-70 mt-1">{lesson.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show Lessons Button (when sidebar is closed) */}
          {!showLessonsSidebar && (
            <div className="w-12 flex flex-col items-center py-3" style={{ borderRight: `1px solid ${currentPythonTheme.border}`, backgroundColor: currentPythonTheme.subtle }}>
              <button
                onClick={() => setShowLessonsSidebar(true)}
                className="p-2 rounded hover:opacity-70"
                style={{ color: currentPythonTheme.highlight }}
                title="Show lessons sidebar"
              >
                <BookOpen className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Editor and Output Split */}
          <div className="flex-1 flex">
            {/* Chat Panel */}
            {showChat && (
              <div className="w-96 flex flex-col" style={{ borderRight: `1px solid ${currentPythonTheme.border}`, backgroundColor: currentPythonTheme.subtle }}>
                <div className="p-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentPythonTheme.border}` }}>
                  <div className="flex items-center gap-2 font-mono text-xs" style={{ color: currentPythonTheme.highlight }}>
                    <MessageSquare className="w-4 h-4" />
                    <span>{isFreestyleMode ? '🎨 FREESTYLE CODE VIBE' : 'PYTHON PROGRAMMING ASSISTANT'}</span>
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
                        <p className="mb-2">💡 Ask me about:</p>
                        <ul className="list-disc list-inside space-y-1 text-[10px]">
                          <li>Syntax and best practices</li>
                          <li>Code improvements and optimization</li>
                          <li>Debugging current errors</li>
                          <li>Lesson-specific questions</li>
                          <li>Project structure analysis</li>
                        </ul>
                      </div>
                    )}
                    {chatHistory.map((msg, idx) => (
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
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content).then(() => {
                                    speak('Code copied to clipboard');
                                  }).catch(err => {
                                    console.error('Failed to copy:', err);
                                  });
                                }}
                                className="text-[var(--terminal-highlight)]/70 hover:text-[var(--terminal-highlight)] transition-colors"
                                title="Copy code to clipboard"
                              >
                                📋
                              </button>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    ))}
                    {chatMutation.isPending && (
                      <div className="text-left">
                        <div className="inline-block p-2 rounded bg-black/50 text-[var(--terminal-text)]/70 font-mono text-xs">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                          Analyzing...
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
                      placeholder={isFreestyleMode ? "Describe code you want to create..." : "Ask about Python code..."}
                      className="flex-1 rounded px-3 py-2 font-mono text-xs focus:outline-none"
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
            )}

            {/* Editor/Output Section */}
            <div className="flex-1 flex flex-col min-w-0">
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

            {/* Editor with Optional Preview Panel */}
            <div className="flex-1 border-b border-[var(--terminal-highlight)]/30 min-h-0">
              {showPreview ? (
                <PanelGroup direction="horizontal" autoSaveId="python-ide-preview">
                  {/* Editor Panel */}
                  <Panel defaultSize={60} minSize={30}>
                    <div className="h-full w-full relative">
                      <Editor
                        height="100%"
                        width="100%"
                        language={showMultiFileMode && activeFile ? (LANGUAGE_CONFIG[activeFile.language]?.monacoLang || 'python') : 'python'}
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
                    minimap: { enabled: false },
                    fontSize: 13,
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
                      <div className="font-mono text-xs mb-3 pb-2" style={{ 
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
                              💡 <strong>GUI Support:</strong> Your Python code generated visual output! The preview shows tkinter windows, matplotlib plots, or other GUI elements.
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
                          className="font-mono text-xs leading-relaxed whitespace-pre-wrap"
                          style={{ color: currentPythonTheme.text }}
                          data-testid="preview-output"
                        >
                          {output || '(Run code to see output here)'}
                        </pre>
                      )}
                    </div>
                  </Panel>
                </PanelGroup>
              ) : (
                <div className="h-full w-full relative">
                  <Editor
                    height="100%"
                    width="100%"
                    language={showMultiFileMode && activeFile ? (LANGUAGE_CONFIG[activeFile.language]?.monacoLang || 'python') : 'python'}
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
                      minimap: { enabled: false },
                      fontSize: 13,
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
                      Run Code
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setCode('')}
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
    </div>
  );
}