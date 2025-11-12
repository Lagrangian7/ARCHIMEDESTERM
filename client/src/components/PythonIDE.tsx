import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, X, BookOpen, Code, Loader2, Lightbulb, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useMutation } from '@tanstack/react-query';
import { useSpeech } from '@/contexts/SpeechContext';

interface PythonIDEProps {
  onClose: () => void;
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

interface PythonSession {
  code: string;
  output: string;
  selectedLesson: keyof typeof LESSONS;
  showGuidance: boolean;
  completedTasks: string[];
  chatHistory: Array<{ role: 'user' | 'assistant', content: string }>;
}

export function PythonIDE({ onClose }: PythonIDEProps) {
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

  const savedSession = loadSession();

  const [code, setCode] = useState(savedSession?.code || LESSONS.basics.code);
  const [output, setOutput] = useState(savedSession?.output || '');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<keyof typeof LESSONS>(savedSession?.selectedLesson || 'basics');
  const [showGuidance, setShowGuidance] = useState(savedSession?.showGuidance ?? true);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set(savedSession?.completedTasks || []));
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>(
    (savedSession?.chatHistory as Array<{ role: 'user' | 'assistant', content: string }>) || []
  );
  const editorRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { speak } = useSpeech();
  const lastSpokenChatIdRef = useRef<string>('');

  // Get current theme from body class
  const [currentTheme, setCurrentTheme] = useState('');

  useEffect(() => {
    const updateTheme = () => {
      const bodyClasses = document.body.className;
      const themeClass = bodyClasses.split(' ').find(cls => cls.startsWith('theme-'));
      setCurrentTheme(themeClass || 'theme-green');
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `As a Python programming expert analyzing code in the Python IDE, ${message}\n\nCurrent lesson: ${currentLesson.title}\nCurrent code:\n\`\`\`python\n${code}\n\`\`\`\n\nProvide focused Python programming guidance.`,
          mode: 'natural'
        })
      });
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage = { role: 'assistant' as const, content: data.response };
      setChatHistory(prev => [...prev, assistantMessage]);
      // Speak the response vocally
      speak(data.response);
    },
    onError: (error) => {
      const errorMessage = { role: 'assistant' as const, content: `Error: ${error.message}` };
      setChatHistory(prev => [...prev, errorMessage]);
      speak(`Error: ${error.message}`);
    }
  });

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
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
    if (lastMessage && lastMessage.role === 'assistant') {
      const messageId = `${chatHistory.length}-${lastMessage.content.substring(0, 20)}`;
      if (messageId !== lastSpokenChatIdRef.current) {
        lastSpokenChatIdRef.current = messageId;
        speak(lastMessage.content);
      }
    }
  }, [chatHistory, speak]);

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

  const loadLesson = (lessonKey: keyof typeof LESSONS) => {
    setSelectedLesson(lessonKey);
    setCode(LESSONS[lessonKey].code);
    setOutput('');
    setShowGuidance(true);
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

  return (
    <div 
      className={`fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 ${currentTheme}`}
      data-no-terminal-autofocus
    >
      <div className="w-full h-full max-w-7xl max-h-[90vh] bg-[var(--terminal-bg)] border-2 border-[var(--terminal-highlight)] rounded-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-[var(--terminal-highlight)]/30">
          <div className="flex items-center gap-3">
            <Code className="w-5 h-5 text-[var(--terminal-highlight)]" />
            <h3 className="text-[var(--terminal-highlight)] font-mono text-sm font-bold">
              Archi v7 PythonIDE
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowChat(!showChat)}
              variant="outline"
              size="sm"
              className={`bg-black border-[var(--terminal-highlight)]/50 font-mono text-xs ${
                showChat ? 'bg-[var(--terminal-highlight)]/20 text-[var(--terminal-highlight)]' : 'text-[var(--terminal-highlight)] hover:bg-[var(--terminal-highlight)]/20'
              }`}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {showChat ? 'Hide' : 'Ask'} Archimedes
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="bg-black text-[var(--terminal-highlight)] hover:text-white hover:bg-[var(--terminal-highlight)]/20 border-[var(--terminal-highlight)]/50 font-mono text-xs"
            >
              Close (Save Session)
            </Button>
            <Button
              onClick={handleQuit}
              variant="ghost"
              size="sm"
              className="bg-black text-red-500 hover:text-red-400 hover:bg-red-500/20 font-mono text-xs"
            >
              Quit & Clear
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Lessons */}
          <div className="w-72 border-r border-[var(--terminal-highlight)]/30 bg-black/30 overflow-y-auto">
            <div className="p-3 border-b border-[var(--terminal-highlight)]/20">
              <div className="flex items-center gap-2 text-[var(--terminal-highlight)] font-mono text-xs">
                <BookOpen className="w-4 h-4" />
                <span>COMPREHENSIVE LESSONS</span>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {Object.entries(LESSONS).map(([key, lesson]) => (
                <button
                  key={key}
                  onClick={() => loadLesson(key as keyof typeof LESSONS)}
                  className={`w-full text-left px-3 py-2 rounded font-mono text-xs transition-colors ${
                    selectedLesson === key
                      ? 'bg-[var(--terminal-highlight)]/20 text-[var(--terminal-highlight)] border border-[var(--terminal-highlight)]/50'
                      : 'text-[var(--terminal-highlight)]/70 hover:bg-[var(--terminal-highlight)]/10 hover:text-[var(--terminal-highlight)]'
                  }`}
                >
                  <div className="font-bold">{lesson.title}</div>
                  <div className="text-[10px] opacity-70 mt-1">{lesson.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Editor and Output Split */}
          <div className="flex-1 flex">
            {/* Chat Panel */}
            {showChat && (
              <div className="w-96 border-r border-[var(--terminal-highlight)]/30 bg-black/30 flex flex-col">
                <div className="p-3 border-b border-[var(--terminal-highlight)]/20">
                  <div className="flex items-center gap-2 text-[var(--terminal-highlight)] font-mono text-xs">
                    <MessageSquare className="w-4 h-4" />
                    <span>PYTHON PROGRAMMING ASSISTANT</span>
                  </div>
                </div>

                {/* Chat History */}
                <ScrollArea className="flex-1">
                  <div ref={chatScrollRef} className="p-3 space-y-3">
                    {chatHistory.length === 0 && (
                      <div className="text-[var(--terminal-text)]/70 font-mono text-xs">
                        <p className="mb-2">💡 Ask me about:</p>
                        <ul className="list-disc list-inside space-y-1 text-[10px]">
                          <li>Python syntax and best practices</li>
                          <li>Code improvements and optimization</li>
                          <li>Debugging current errors</li>
                          <li>Lesson-specific questions</li>
                          <li>Project structure analysis</li>
                        </ul>
                      </div>
                    )}
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block max-w-[90%] p-2 rounded font-mono text-xs ${
                          msg.role === 'user' 
                            ? 'bg-[var(--terminal-highlight)]/20 text-[var(--terminal-highlight)]' 
                            : 'bg-black/50 text-[var(--terminal-text)]/90'
                        }`}>
                          <div className="font-bold text-[10px] mb-1 opacity-70">
                            {msg.role === 'user' ? 'YOU' : 'ARCHIMEDES'}
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
                <form onSubmit={handleChatSubmit} className="p-3 border-t border-[var(--terminal-highlight)]/30">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about Python code..."
                      className="flex-1 bg-black/50 border border-[var(--terminal-highlight)]/30 rounded px-3 py-2 text-[var(--terminal-text)] font-mono text-xs focus:outline-none focus:border-[var(--terminal-highlight)]"
                      disabled={chatMutation.isPending}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!chatInput.trim() || chatMutation.isPending}
                      className="bg-[var(--terminal-highlight)] text-black hover:bg-[var(--terminal-highlight)]/80"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Editor/Output Section */}
            <div className="flex-1 flex flex-col min-w-0">
            {/* Archimedes Guidance Panel */}
            {showGuidance && (
              <div className="p-4 bg-[var(--terminal-highlight)]/5 border-b border-[var(--terminal-highlight)]/30">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-[var(--terminal-highlight)] mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[var(--terminal-highlight)] font-mono text-xs font-bold mb-2">
                      ARCHIMEDES GUIDANCE:
                    </div>
                    <p className="text-[var(--terminal-text)] font-mono text-xs leading-relaxed">
                      {currentLesson.guidance}
                    </p>
                    <div className="mt-3">
                      <div className="text-[var(--terminal-highlight)] font-mono text-xs font-bold mb-2">
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
                                className={`w-4 h-4 ${
                                  completedTasks.has(task)
                                    ? 'text-[var(--terminal-highlight)]'
                                    : 'text-[var(--terminal-highlight)]/30'
                                }`}
                              />
                            </button>
                            <span className={`font-mono text-xs ${
                              completedTasks.has(task)
                                ? 'text-[var(--terminal-highlight)] line-through'
                                : 'text-[var(--terminal-text)]/70'
                            }`}>
                              {task}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGuidance(false)}
                    className="text-[var(--terminal-highlight)]/50 hover:text-[var(--terminal-highlight)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 border-b border-[var(--terminal-highlight)]/30 min-h-0">
              <div className="h-full w-full relative">
                <Editor
                  height="100%"
                  width="100%"
                  defaultLanguage="python"
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  onMount={handleEditorDidMount}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on',
                    padding: { top: 10, bottom: 10 },
                    quickSuggestions: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    acceptSuggestionOnEnter: 'on'
                  }}
                />
              </div>
            </div>

            {/* Run Button */}
            <div className="px-4 py-2 bg-black/30 border-b border-[var(--terminal-highlight)]/30 flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  onClick={runCode}
                  disabled={isRunning}
                  className="bg-black text-[var(--terminal-highlight)] border border-[var(--terminal-highlight)]/50 hover:bg-[var(--terminal-highlight)]/20 font-mono text-sm"
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
                  className="bg-black border-[var(--terminal-highlight)]/50 text-[var(--terminal-highlight)] hover:bg-[var(--terminal-highlight)]/20 font-mono text-sm"
                >
                  Clear Editor
                </Button>
                {!showGuidance && (
                  <Button
                    onClick={() => setShowGuidance(true)}
                    variant="outline"
                    className="border-[var(--terminal-highlight)]/50 text-[var(--terminal-highlight)] hover:bg-[var(--terminal-highlight)]/20 font-mono text-sm"
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Show Guidance
                  </Button>
                )}
              </div>
              <div className="text-[var(--terminal-text)]/70 font-mono text-xs">
                {currentLesson.tasks.length > 0 && (
                  <span>Progress: {completedTasks.size}/{currentLesson.tasks.length} objectives</span>
                )}
              </div>
            </div>

            {/* Output */}
            <div className="flex-1 bg-black/50 overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="p-4">
                  <pre className="font-mono text-xs text-[var(--terminal-text)] whitespace-pre-wrap">
                    {output || '// Run code to see output here...'}
                  </pre>
                </div>
              </ScrollArea>
            </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-black/50 border-t border-[var(--terminal-highlight)]/30 flex items-center justify-between">
          <div className="text-[var(--terminal-text)]/70 font-mono text-xs">
            💡 {currentLesson.title} - Follow Archimedes' guidance and complete all objectives
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[var(--terminal-text)]/50 font-mono text-xs">
              💾 Session auto-saved
            </div>
            <div className="text-[var(--terminal-text)]/50 font-mono text-xs">
              Lesson {Object.keys(LESSONS).indexOf(selectedLesson) + 1} of {Object.keys(LESSONS).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}