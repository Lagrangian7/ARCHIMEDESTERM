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

## External Dependencies
- **Database Driver**: Neon Database serverless PostgreSQL client
- **UI Framework**: Comprehensive Radix UI component suite for accessible, unstyled components
- **Voice Integration**: Web Speech API for speech synthesis and speech recognition
- **Academic APIs**: Semantic Scholar API (FREE - 100 requests per 5 minutes, no authentication required)
- **Mathematical Rendering**: MathJax 3 CDN for rendering MathML and LaTeX mathematical expressions
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
- **Dual Mode Operation**: Natural chat mode vs. technical protocol mode with distinct AI personalities
- **Component Composition**: Modular UI components with consistent theming
- **Custom Hooks**: Specialized hooks for terminal functionality, speech synthesis, and mobile detection
- **Type Safety**: Comprehensive TypeScript usage with Zod schema validation
- **Development Experience**: Hot reloading, error overlays, and Replit integration for seamless development