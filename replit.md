# Overview

This is an ARCHIMEDES v7 AI Terminal application - a cyberpunk-styled AI interface featuring dual AI modes, voice synthesis (HAL 9000 voice simulation), authentication, knowledge base, and terminal-based interaction with the Archimedes assistant. The application provides a retro computing aesthetic with phosphor display effects, scanlines, and authentic terminal features.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing
- **UI Components**: Extensive use of Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom terminal-themed color palette (electric green #00FF41, deep black #0D1117)
- **State Management**: React Query (TanStack Query) for server state, React hooks for local state
- **Terminal Interface**: Custom terminal component with phosphor display aesthetic, scanlines, and authentic terminal features
- **Music Player**: Webamp integration with butterchurn Milkdrop visualizer, launchable via "webamp" command, "play our song" command, or cassette tape icon in header
- **WebContainer Terminal**: In-browser Node.js runtime powered by @webcontainer/api and xterm.js
  - Runs Node.js entirely in the browser with a virtual file system
  - Full terminal emulation with xterm.js and fit addon
  - Supports npm package installation and script execution
  - Preview URL generation for web servers started in the container
  - Requires Cross-Origin Isolation headers (COEP/COOP) for SharedArrayBuffer
  - **Note**: May require opening app in a direct browser tab (not Replit preview) with hard refresh for headers to take effect
  - Toggle via Terminal icon button in Workshop IDE toolbar
  - Helper functions: createNodeProjectFiles() and createViteProjectFiles() for common project setups
  - coi-serviceworker polyfill installed to enable cross-origin isolation where possible
- **Animation System**: Comprehensive CSS animation library for enhanced visual effects
  - **Terminal animations**: Typewriter effects, glitch text, CRT boot, matrix reveal, scanline sweep, character-by-character reveal, flicker effects
  - **Monaco editor animations**: Cursor glow, bracket matching pulse, line highlight animation, selection glow, code execution flash, error shake, success pulse
  - **Matplotlib output animations**: Chart fade-in, hover glow, GIF animation container with rotating border, loading spinners
  - **Utility animations**: Fade, slide, scale, bounce animations with staggered delay utilities
  - **Accessibility**: All animations respect `prefers-reduced-motion` media query
- **Code Playground**: Multi-language code editor with Monaco supporting 15+ languages (Python, JavaScript, TypeScript, Java, C++, Rust, Go, Ruby, PHP, C#, Swift, Kotlin, Bash, SQL, HTML/CSS). Features include:
  - Automatic language detection from code content and fenced blocks
  - Multi-file extraction from AI responses (separates HTML, JS, Python, etc. into individual files)
  - Download buttons for individual code files with proper extensions
  - Local preview/run instructions for each language type
  - **Real-time code execution** via unified `/api/execute` endpoint supporting:
    - Python (with GUI capture for matplotlib, tkinter, pygame, turtle)
    - JavaScript (Node.js)
    - TypeScript (via tsx)
    - Bash/Shell scripts
    - C/C++ (compile and run)
    - Go (go run)
    - Rust (rustc and run)
    - Ruby
    - PHP
    - HTML (inline preview via iframe)
  - **Interactive stdin input** - Textarea field in output panel for providing input to programs that need it (Python input(), C scanf(), Node readline, etc.)
  - **Auto-detect output formats**:
    - JSON: Pretty-prints with syntax highlighting and full object inspection
    - CSV: Renders as interactive table with headers and rows
    - SVG: Displays vector graphics inline
    - XML/HTML: Formats with proper indentation
    - Plain text: Raw output display
  - **GUI output rendering**:
    - matplotlib: Charts rendered as PNG images
    - tkinter: Window screenshots captured via scrot
    - pygame: Surface captured after first flip as PNG
    - turtle: Canvas exported via PostScript and converted to PNG via Ghostscript
    - HTML: Sandboxed iframe preview with restrictive sandbox attributes
  - Virtual display (pyvirtualdisplay/Xvfb) for headless GUI rendering
  - Security hardening: spawn with array args, random temp filenames, 0o600 permissions, automatic cleanup, 50KB size limit, 30s timeout
  - Accessible via `code` or `playground` terminal command

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **API Design**: RESTful API with AI chat endpoint (`/api/chat`) for terminal-based interactions with Archimedes AI assistant
- **Academic Search**: Semantic Scholar API integration for academic paper search (FREE, no API key required)
- **Wolfram Alpha**: Full Results API integration for computational queries, math solving, data lookup, and knowledge queries with enhanced graphical and mathematical rendering
  - Graphics rendering: Images from Wolfram Alpha (plots, diagrams) rendered as HTML <img> tags
  - Mathematical rendering: MathML and LaTeX formats rendered using MathJax for proper mathematical display
  - Multi-format support: Requests plaintext, image, MathML, and LaTeX formats from API
- **Development Setup**: Vite development server with hot module replacement
- **Error Handling**: Centralized error middleware with structured error responses
- **Request Logging**: Custom middleware for API request/response logging

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM (DatabaseStorage implementation)
- **Schema**: Users table for authentication, conversations table with JSONB message storage, documents table for knowledge base
- **Document Persistence**: All uploaded documents and saved AI responses persist in PostgreSQL per user
- **Session Management**: UUID-based session tracking for conversation persistence

## Authentication and Authorization
- **User Model**: Simple username/password authentication schema
- **Session Handling**: Session-based conversation tracking without complex auth flows
- **Data Isolation**: Conversations tied to session IDs for user separation

## External APIs and Services
- **AI Backend Configuration** (optimized December 2025):
  - **Natural Mode**: Groq Llama 3.1 8B (PRIMARY) - fast, free, excellent for conversational chat
  - **Technical/Freestyle/Health Modes**: OpenRouter via Replit AI Integrations (PRIMARY) - Llama 3.3 70B for complex tasks
  - **Fallback Chain**: Primary → Groq → OpenRouter → Mistral API → HuggingFace → Static response
- **Code Completion** (Monaco Copilot/Codeium optimized):
  - Mistral Codestral (PRIMARY) - specialized code completion model, fastest and most accurate
  - OpenRouter DeepSeek Coder (FALLBACK 1) - excellent code model
  - Groq Llama 3.1 (FALLBACK 2) - fast general purpose
- **Academic Search**: Semantic Scholar API (FREE - 100 requests per 5 minutes, no authentication required)
- **Computational Knowledge**: Wolfram Alpha Full Results API for math solving, data lookup, and knowledge queries
- **Mathematical Rendering**: MathJax 3 CDN for rendering MathML and LaTeX mathematical expressions

## External Dependencies
- **Database Driver**: Neon Database serverless PostgreSQL client
- **UI Framework**: Comprehensive Radix UI component suite for accessible, unstyled components
- **Voice Integration**: Web Speech API for speech synthesis and speech recognition
- **Development Tools**: 
  - Replit-specific plugins for development environment
  - ESBuild for production bundling
  - TypeScript for type safety
- **Utility Libraries**:
  - date-fns for date manipulation
  - clsx and tailwind-merge for conditional styling
  - nanoid for ID generation
  - Zod for schema validation with Drizzle integration

## Key Design Patterns
- **Personality Training System**:
  - Users can mark any knowledge base document as "Personality Training" content
  - Documents marked with `isPersonality: true` are injected into AI system prompts
  - This allows users to customize Archimedes' humor style, tone, catchphrases, and response patterns
  - Personality content is automatically included in all AI modes (Natural, Technical, Health, Freestyle)
  - Toggle via Knowledge Base modal → "Train AI" button on each document
- **Multi-Mode AI Operation** (English-only system): 
  - **Natural mode** (default): Sassy cyberpunk AI for fun conversations AND code generation
  - **Technical mode**: Master builder - step-by-step guides for construction, trades, engineering & sciences
  - **Health mode**: Naturopathic wellness advisor - nutrition, herbs, natural healing
  - **Freestyle mode**: Proactive, collaborative programming assistant with multi-language code generation (Python, TypeScript, JavaScript, C++, Bash, HTML, CSS). Features enhanced interaction principles: anticipates user needs, asks smart follow-up questions (one at a time), uses prose over lists, provides critical feedback, and gets straight to the point without preambles. **Full-Stack Detection**: Automatically detects requests for web apps (Flask+React, Express+Vue, etc.) and generates coordinated backend + frontend + config files in a single response with clear file markers and connection instructions
- **Intelligent Language Detection**: Freestyle mode analyzes user requests to detect target programming language using:
  - Explicit language mentions (highest priority)
  - File extensions (.py, .ts, .js, .cpp, .sh)
  - Language-specific keywords and syntax patterns
  - Negative checks to avoid false positives (e.g., "Python script for Linux" correctly routes to Python, not Bash)
- **Language-Specific Code Generation**: Each language follows its own best practices:
  - Python: PEP 8, type hints, docstrings, snake_case
  - TypeScript: ESLint standards, type annotations, interfaces, camelCase
  - JavaScript: ES6+, async/await, JSDoc comments, modern patterns
  - C++: C++11+ standards, smart pointers, proper namespacing
  - Bash: ShellCheck compliance, proper quoting, error handling
- **Component Composition**: Modular UI components with consistent theming
- **Custom Hooks**: Specialized hooks for terminal functionality, speech synthesis, and mobile detection
- **Type Safety**: Comprehensive TypeScript usage with Zod schema validation
- **Development Experience**: Hot reloading, error overlays, and Replit integration for seamless development
- **Session Keep-Alive**: Automatic token refresh via heartbeat system prevents 30-minute OAuth timeout, pauses when tab is hidden to conserve resources