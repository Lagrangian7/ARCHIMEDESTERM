
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, BookOpen, Code, Play, CheckCircle, Circle } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface PythonLessonsProps {
  onClose: () => void;
}

interface Lesson {
  id: string;
  title: string;
  day: number;
  description: string;
  concepts: string[];
  code: string;
  exercises: Exercise[];
  completed?: boolean;
}

interface Exercise {
  title: string;
  description: string;
  starterCode: string;
  solution: string;
  hints: string[];
}

const LESSONS: Lesson[] = [
  {
    id: 'day1-variables',
    title: 'Variables and Data Types',
    day: 1,
    description: 'Learn how to declare and work with different data types in Python',
    concepts: ['Numeric types', 'Strings', 'Booleans', 'Type conversion', 'Naming conventions'],
    code: `# Python Variables and Data Types

# Numeric Types
age = 25                    # Integer
temperature = 98.6          # Float
complex_num = 3 + 4j        # Complex number

print(f"Age: {age}, Type: {type(age)}")
print(f"Temperature: {temperature}, Type: {type(temperature)}")

# Strings
name = "Alice"
greeting = 'Hello, World!'
multiline = """This is a
multiline string"""

print(f"Name: {name}")
print(f"Greeting: {greeting}")

# Booleans
is_student = True
has_graduated = False

print(f"Is student: {is_student}")

# Type Conversion
num_str = "42"
num_int = int(num_str)      # String to integer
num_float = float(num_str)  # String to float

print(f"Original: {num_str}, As int: {num_int}, As float: {num_float}")

# Naming Conventions
# Good: snake_case for variables
user_age = 30
total_score = 100

# Type as Objects
print(f"Type of 42: {type(42)}")
print(f"Type of 'hello': {type('hello')}")`,
    exercises: [
      {
        title: 'Create Your Profile',
        description: 'Create variables for your name, age, height, and whether you are a student',
        starterCode: `# Create your profile variables here
# name = 
# age = 
# height = 
# is_student = 

# Print your profile
`,
        solution: `name = "Your Name"
age = 20
height = 5.8
is_student = True

print(f"Name: {name}")
print(f"Age: {age}")
print(f"Height: {height} feet")
print(f"Student: {is_student}")`,
        hints: [
          'Use quotes for strings',
          'Age should be an integer (whole number)',
          'Height can be a float (decimal)',
          'is_student should be True or False'
        ]
      }
    ]
  },
  {
    id: 'day1-strings',
    title: 'Working with Strings',
    day: 1,
    description: 'Master string operations, formatting, and manipulation',
    concepts: ['String literals', 'Escape sequences', 'String methods', 'Formatting', 'String operations'],
    code: `# Working with Strings

# String Literals and Escape Sequences
message = "Hello\\nWorld"  # \\n is newline
path = "C:\\\\Users\\\\Documents"  # \\\\ is backslash
quote = "She said, \\"Hello!\\""  # \\" is double quote

print("Message with newline:")
print(message)
print(f"Path: {path}")
print(quote)

# String Formatting
name = "Alice"
age = 25
score = 95.5

# F-strings (recommended)
formatted = f"Name: {name}, Age: {age}, Score: {score:.1f}"
print(formatted)

# Format method
formatted2 = "Name: {}, Age: {}, Score: {:.1f}".format(name, age, score)
print(formatted2)

# String Methods
text = "  Hello, World!  "
print(f"Original: '{text}'")
print(f"Upper: {text.upper()}")
print(f"Lower: {text.lower()}")
print(f"Strip: '{text.strip()}'")
print(f"Replace: {text.replace('World', 'Python')}")
print(f"Split: {text.split(',')}")

# String Operations
first = "Hello"
last = "World"
combined = first + " " + last
print(f"Combined: {combined}")
print(f"Repeated: {first * 3}")
print(f"Length: {len(combined)}")
print(f"First char: {combined[0]}")
print(f"Last char: {combined[-1]}")
print(f"Substring: {combined[0:5]}")`,
    exercises: [
      {
        title: 'String Manipulation Challenge',
        description: 'Take a sentence, convert it to uppercase, replace a word, and count characters',
        starterCode: `sentence = "python is awesome"

# Convert to uppercase


# Replace "awesome" with "amazing"


# Count total characters


# Split into words


# Print results
`,
        solution: `sentence = "python is awesome"

upper_sentence = sentence.upper()
print(f"Uppercase: {upper_sentence}")

replaced = sentence.replace("awesome", "amazing")
print(f"Replaced: {replaced}")

char_count = len(sentence)
print(f"Character count: {char_count}")

words = sentence.split()
print(f"Words: {words}")
print(f"Word count: {len(words)}")`,
        hints: [
          'Use .upper() method for uppercase',
          'Use .replace() method to swap words',
          'Use len() function to count characters',
          'Use .split() method to split into words'
        ]
      }
    ]
  },
  {
    id: 'day1-conditionals',
    title: 'Conditional Statements and Loops',
    day: 1,
    description: 'Learn to control program flow with if/else and loops',
    concepts: ['if/else statements', 'elif', 'nested conditions', 'while loops', 'for loops', 'break/continue'],
    code: `# Conditional Statements

# Simple if-else
age = 18
if age >= 18:
    print("You are an adult")
else:
    print("You are a minor")

# if-elif-else chain
score = 85
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
elif score >= 60:
    grade = "D"
else:
    grade = "F"
print(f"Score: {score}, Grade: {grade}")

# Nested if
temperature = 75
is_sunny = True

if temperature > 70:
    if is_sunny:
        print("Great day for outdoor activities!")
    else:
        print("Warm but cloudy")
else:
    print("It's a bit cool")

# While Loop
count = 1
print("Counting to 5:")
while count <= 5:
    print(count)
    count += 1

# For Loop with range
print("\\nEven numbers from 0 to 10:")
for i in range(0, 11, 2):
    print(i)

# For loop with list
fruits = ["apple", "banana", "cherry"]
print("\\nFruits:")
for fruit in fruits:
    print(f"- {fruit}")

# Break and Continue
print("\\nBreak example:")
for i in range(10):
    if i == 5:
        break
    print(i)

print("\\nContinue example:")
for i in range(5):
    if i == 2:
        continue
    print(i)`,
    exercises: [
      {
        title: 'Grade Calculator',
        description: 'Create a program that assigns letter grades based on numeric scores',
        starterCode: `# Create a list of test scores
scores = [95, 87, 76, 62, 58, 91]

# Loop through scores and assign grades
# Print each score with its grade

`,
        solution: `scores = [95, 87, 76, 62, 58, 91]

for score in scores:
    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 70:
        grade = "C"
    elif score >= 60:
        grade = "D"
    else:
        grade = "F"
    
    print(f"Score: {score} -> Grade: {grade}")`,
        hints: [
          'Use a for loop to iterate through scores',
          'Use if-elif-else to determine grade',
          'Print score and grade for each iteration'
        ]
      }
    ]
  },
  {
    id: 'day2-lists',
    title: 'Lists and Tuples',
    day: 2,
    description: 'Master Python\'s list and tuple data structures',
    concepts: ['Creating lists', 'List methods', 'Indexing and slicing', 'Tuples', 'List vs Tuple'],
    code: `# Lists - Ordered, Mutable Collections

# Creating lists
numbers = [1, 2, 3, 4, 5]
mixed = [1, "hello", 3.14, True]
nested = [[1, 2], [3, 4], [5, 6]]

print(f"Numbers: {numbers}")
print(f"Mixed types: {mixed}")
print(f"Nested: {nested}")

# List Methods (CRUD operations)
fruits = ["apple", "banana", "cherry"]

# Create/Add
fruits.append("date")           # Add to end
fruits.insert(1, "blueberry")   # Insert at index
print(f"After adding: {fruits}")

# Read/Access
print(f"First fruit: {fruits[0]}")
print(f"Last fruit: {fruits[-1]}")
print(f"Slice [1:3]: {fruits[1:3]}")

# Update
fruits[0] = "apricot"
print(f"After update: {fruits}")

# Delete
fruits.remove("banana")         # Remove by value
deleted = fruits.pop()          # Remove and return last
print(f"After deletion: {fruits}")
print(f"Deleted: {deleted}")

# Other List Operations
numbers = [3, 1, 4, 1, 5, 9, 2, 6]
print(f"\\nOriginal: {numbers}")
print(f"Length: {len(numbers)}")
print(f"Max: {max(numbers)}")
print(f"Min: {min(numbers)}")
print(f"Sum: {sum(numbers)}")
print(f"Sorted: {sorted(numbers)}")
print(f"Count of 1: {numbers.count(1)}")

# Tuples - Ordered, Immutable Collections
coordinates = (10, 20)
person = ("Alice", 25, "Engineer")

print(f"\\nCoordinates: {coordinates}")
print(f"Person: {person}")
print(f"First element: {person[0]}")

# Tuples are immutable
# person[0] = "Bob"  # This would cause an error!

# Unpacking
x, y = coordinates
name, age, job = person
print(f"x={x}, y={y}")
print(f"{name} is {age} years old")`,
    exercises: [
      {
        title: 'Shopping List Manager',
        description: 'Create and manipulate a shopping list with various operations',
        starterCode: `# Create an empty shopping list


# Add 5 items to the list


# Print the list


# Remove one item


# Update one item


# Print final list and count

`,
        solution: `shopping_list = []

# Add items
shopping_list.append("milk")
shopping_list.append("bread")
shopping_list.append("eggs")
shopping_list.append("cheese")
shopping_list.append("butter")

print(f"Original list: {shopping_list}")

# Remove item
shopping_list.remove("bread")
print(f"After removing bread: {shopping_list}")

# Update item
shopping_list[0] = "almond milk"
print(f"After updating: {shopping_list}")

print(f"Total items: {len(shopping_list)}")`,
        hints: [
          'Start with an empty list: []',
          'Use .append() to add items',
          'Use .remove() to delete items',
          'Use indexing to update: list[0] = new_value'
        ]
      }
    ]
  },
  {
    id: 'day2-dictionaries',
    title: 'Dictionaries and Sets',
    day: 2,
    description: 'Work with Python dictionaries and sets for key-value data and unique collections',
    concepts: ['Creating dictionaries', 'Dictionary methods', 'Sets', 'Dictionary vs List vs Tuple vs Set'],
    code: `# Dictionaries - Key-Value Pairs

# Creating dictionaries
student = {
    "name": "Alice",
    "age": 20,
    "grade": "A",
    "courses": ["Math", "Science", "English"]
}

print(f"Student: {student}")
print(f"Name: {student['name']}")
print(f"Courses: {student['courses']}")

# Dictionary Methods
print(f"\\nKeys: {student.keys()}")
print(f"Values: {student.values()}")
print(f"Items: {student.items()}")

# Adding/Updating
student["email"] = "alice@example.com"
student["age"] = 21
print(f"\\nUpdated: {student}")

# Safe access with get()
gpa = student.get("gpa", "Not available")
print(f"GPA: {gpa}")

# Looping through dictionary
print("\\nStudent info:")
for key, value in student.items():
    print(f"  {key}: {value}")

# Sets - Unordered, Unique Collections
numbers = {1, 2, 3, 4, 5}
unique_numbers = {1, 2, 2, 3, 3, 4, 5}  # Duplicates removed

print(f"\\nNumbers set: {numbers}")
print(f"Unique numbers: {unique_numbers}")

# Set operations
set1 = {1, 2, 3, 4}
set2 = {3, 4, 5, 6}

print(f"\\nSet 1: {set1}")
print(f"Set 2: {set2}")
print(f"Union: {set1 | set2}")
print(f"Intersection: {set1 & set2}")
print(f"Difference: {set1 - set2}")

# Adding to sets
fruits = {"apple", "banana"}
fruits.add("cherry")
fruits.add("apple")  # Duplicate, won't be added
print(f"\\nFruits: {fruits}")

# Comparison: List vs Tuple vs Dict vs Set
print("\\nData Structure Comparison:")
print("List: Ordered, Mutable, Allows duplicates")
print("Tuple: Ordered, Immutable, Allows duplicates")
print("Dict: Unordered, Mutable, Key-value pairs")
print("Set: Unordered, Mutable, No duplicates")`,
    exercises: [
      {
        title: 'Student Grade Book',
        description: 'Create a dictionary-based grade book system',
        starterCode: `# Create a grade book with student names and scores


# Add more students


# Update a student's grade


# Calculate average grade


# Print all students and grades

`,
        solution: `gradebook = {
    "Alice": 95,
    "Bob": 87,
    "Charlie": 92
}

# Add students
gradebook["Diana"] = 88
gradebook["Eve"] = 91

print(f"Grade book: {gradebook}")

# Update grade
gradebook["Bob"] = 90
print(f"Updated Bob's grade: {gradebook['Bob']}")

# Calculate average
total = sum(gradebook.values())
average = total / len(gradebook)
print(f"Average grade: {average:.1f}")

# Print all
print("\\nAll students:")
for student, grade in gradebook.items():
    print(f"  {student}: {grade}")`,
        hints: [
          'Create dictionary with name:grade pairs',
          'Use dict[key] = value to add/update',
          'Use sum(dict.values()) for total',
          'Use .items() to iterate over key-value pairs'
        ]
      }
    ]
  },
  {
    id: 'day3-functions',
    title: 'Functions in Python',
    day: 3,
    description: 'Learn to create reusable code with functions',
    concepts: ['Defining functions', 'Parameters', 'Return values', 'Variable scope', 'Default arguments'],
    code: `# Defining Functions

def greet(name):
    """Simple greeting function"""
    print(f"Hello, {name}!")

greet("Alice")
greet("Bob")

# Functions with return values
def add_numbers(a, b):
    """Add two numbers and return the result"""
    return a + b

result = add_numbers(5, 3)
print(f"5 + 3 = {result}")

# Functions with default parameters
def create_profile(name, age=18, city="Unknown"):
    """Create a user profile with default values"""
    return f"{name}, {age} years old, from {city}"

print(create_profile("Alice", 25, "New York"))
print(create_profile("Bob", 30))
print(create_profile("Charlie"))

# Multiple return values
def get_stats(numbers):
    """Calculate min, max, and average"""
    return min(numbers), max(numbers), sum(numbers) / len(numbers)

data = [10, 20, 30, 40, 50]
min_val, max_val, avg_val = get_stats(data)
print(f"Min: {min_val}, Max: {max_val}, Avg: {avg_val}")

# Variable Scope
global_var = "I'm global"

def scope_demo():
    local_var = "I'm local"
    print(f"Inside function - Global: {global_var}")
    print(f"Inside function - Local: {local_var}")

scope_demo()
print(f"Outside function - Global: {global_var}")
# print(local_var)  # This would cause an error!

# Nested Functions
def outer_function(x):
    """Outer function with nested function"""
    def inner_function(y):
        return y * 2
    
    result = inner_function(x)
    return result + 10

print(f"Nested function result: {outer_function(5)}")

# Keyword Arguments
def describe_pet(pet_name, animal_type="dog"):
    """Display pet information"""
    print(f"I have a {animal_type} named {pet_name}")

describe_pet("Willie")
describe_pet("Harry", "hamster")
describe_pet(animal_type="cat", pet_name="Whiskers")

# Arbitrary Arguments (*args)
def make_pizza(*toppings):
    """Make a pizza with any number of toppings"""
    print("Making pizza with:")
    for topping in toppings:
        print(f"  - {topping}")

make_pizza("pepperoni")
make_pizza("mushrooms", "peppers", "olives")`,
    exercises: [
      {
        title: 'Calculator Functions',
        description: 'Create a set of calculator functions for basic operations',
        starterCode: `# Create functions for add, subtract, multiply, divide


# Test your functions with different numbers


# Create a function that uses all four operations

`,
        solution: `def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b

def divide(a, b):
    if b == 0:
        return "Cannot divide by zero"
    return a / b

# Test functions
print(f"5 + 3 = {add(5, 3)}")
print(f"10 - 4 = {subtract(10, 4)}")
print(f"6 * 7 = {multiply(6, 7)}")
print(f"20 / 4 = {divide(20, 4)}")

def calculate_all(a, b):
    """Perform all operations"""
    print(f"{a} + {b} = {add(a, b)}")
    print(f"{a} - {b} = {subtract(a, b)}")
    print(f"{a} * {b} = {multiply(a, b)}")
    print(f"{a} / {b} = {divide(a, b)}")

calculate_all(12, 3)`,
        hints: [
          'Each function should take two parameters',
          'Use return to send back the result',
          'Check for division by zero',
          'Call each function with test values'
        ]
      }
    ]
  }
];

export function PythonLessons({ onClose }: PythonLessonsProps) {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

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

  const markComplete = () => {
    if (selectedLesson) {
      setCompletedLessons(prev => new Set([...prev, selectedLesson.id]));
    }
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
            <BookOpen className="w-5 h-5 text-[#00FF41]" />
            <h3 className="text-[#00FF41] font-mono text-sm font-bold">
              PYTHON PROGRAMMING LESSONS - ARCHIMEDES GUIDED LEARNING
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
          {/* Lesson Sidebar */}
          <div className="w-80 border-r border-[#00FF41]/30 bg-black/30 overflow-y-auto">
            <div className="p-3 border-b border-[#00FF41]/20">
              <div className="flex items-center gap-2 text-[#00FF41] font-mono text-xs">
                <Code className="w-4 h-4" />
                <span>CURRICULUM</span>
              </div>
            </div>
            <div className="p-2">
              {['DAY 1', 'DAY 2', 'DAY 3'].map(day => {
                const dayNum = parseInt(day.split(' ')[1]);
                const dayLessons = LESSONS.filter(l => l.day === dayNum);
                
                return (
                  <div key={day} className="mb-4">
                    <div className="text-[#00FF41] font-mono text-xs font-bold px-2 py-1 border-b border-[#00FF41]/20">
                      {day}
                    </div>
                    <div className="space-y-1 mt-1">
                      {dayLessons.map(lesson => (
                        <button
                          key={lesson.id}
                          onClick={() => {
                            setSelectedLesson(lesson);
                            setCode(lesson.code);
                            setOutput('');
                            setCurrentExercise(null);
                            setShowSolution(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded font-mono text-xs transition-colors ${
                            selectedLesson?.id === lesson.id
                              ? 'bg-[#00FF41]/20 text-[#00FF41] border border-[#00FF41]/50'
                              : 'text-[#00FF41]/70 hover:bg-[#00FF41]/10 hover:text-[#00FF41]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {completedLessons.has(lesson.id) ? (
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            ) : (
                              <Circle className="w-3 h-3" />
                            )}
                            <span className="font-bold">{lesson.title}</span>
                          </div>
                          <div className="text-[10px] opacity-70 mt-1">{lesson.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lesson Content */}
          {selectedLesson ? (
            <div className="flex-1 flex flex-col">
              {/* Lesson Info */}
              <div className="p-4 border-b border-[#00FF41]/30 bg-black/20">
                <h2 className="text-[#00FF41] font-mono text-lg font-bold mb-2">
                  {selectedLesson.title}
                </h2>
                <p className="text-[#00FF41]/80 text-sm mb-3">{selectedLesson.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedLesson.concepts.map(concept => (
                    <span
                      key={concept}
                      className="px-2 py-1 bg-[#00FF41]/10 border border-[#00FF41]/30 rounded text-[#00FF41] text-xs"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={markComplete}
                    size="sm"
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Complete
                  </Button>
                  {selectedLesson.exercises.length > 0 && !currentExercise && (
                    <Button
                      onClick={() => {
                        setCurrentExercise(selectedLesson.exercises[0]);
                        setCode(selectedLesson.exercises[0].starterCode);
                        setShowSolution(false);
                        setOutput('');
                      }}
                      size="sm"
                      className="bg-[#00FF41] text-black hover:bg-[#00FF41]/80"
                    >
                      Start Exercise
                    </Button>
                  )}
                </div>
              </div>

              {/* Exercise Info (if active) */}
              {currentExercise && (
                <div className="p-4 border-b border-[#00FF41]/30 bg-[#00FF41]/5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[#00FF41] font-mono text-md font-bold">
                      Exercise: {currentExercise.title}
                    </h3>
                    <Button
                      onClick={() => {
                        setCurrentExercise(null);
                        setCode(selectedLesson.code);
                        setShowSolution(false);
                      }}
                      size="sm"
                      variant="ghost"
                      className="text-[#00FF41]/70 hover:text-[#00FF41]"
                    >
                      Back to Lesson
                    </Button>
                  </div>
                  <p className="text-[#00FF41]/80 text-sm mb-2">{currentExercise.description}</p>
                  {!showSolution && currentExercise.hints.length > 0 && (
                    <details className="text-xs">
                      <summary className="text-[#00FF41]/70 cursor-pointer hover:text-[#00FF41]">
                        Show Hints
                      </summary>
                      <ul className="mt-2 ml-4 list-disc text-[#00FF41]/60">
                        {currentExercise.hints.map((hint, i) => (
                          <li key={i}>{hint}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <Button
                    onClick={() => {
                      setShowSolution(!showSolution);
                      if (!showSolution) {
                        setCode(currentExercise.solution);
                      } else {
                        setCode(currentExercise.starterCode);
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="mt-2 text-[#00FF41] border-[#00FF41]/30 hover:bg-[#00FF41]/10"
                  >
                    {showSolution ? 'Hide Solution' : 'Show Solution'}
                  </Button>
                </div>
              )}

              {/* Code Editor */}
              <div className="flex-1 border-b border-[#00FF41]/30">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on'
                  }}
                />
              </div>

              {/* Run Button */}
              <div className="px-4 py-2 bg-black/30 border-b border-[#00FF41]/30">
                <Button
                  onClick={runCode}
                  disabled={isRunning}
                  className="bg-[#00FF41] text-black hover:bg-[#00FF41]/80 font-mono"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isRunning ? 'Running...' : 'Run Code'}
                </Button>
              </div>

              {/* Output */}
              <div className="flex-1 bg-black/50">
                <ScrollArea className="h-full">
                  <pre className="p-4 font-mono text-xs text-[#00FF41] whitespace-pre-wrap">
                    {output || '// Run your code to see output here...'}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-[#00FF41]/70">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-mono text-lg">Select a lesson to begin</p>
                <p className="font-mono text-sm mt-2">
                  Learn Python with ARCHIMEDES as your guide
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-black/50 border-t border-[#00FF41]/30">
          <div className="text-[#00FF41]/70 font-mono text-xs">
            💡 Progress: {completedLessons.size}/{LESSONS.length} lessons completed
          </div>
        </div>
      </div>
    </div>
  );
}
