# Overview

This is an ARCHIMEDES AI Terminal application - a retro-futuristic terminal interface with cyberpunk aesthetics that provides AI assistance in two distinct modes: Natural Chat Mode for conversational interactions and Technical Mode for concise, step-by-step technical responses. The application features a dark terminal with authentic green phosphor text, voice synthesis capabilities, speech recognition, and command history functionality.

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

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **API Design**: RESTful API with single chat endpoint (`/api/chat`)
- **Development Setup**: Vite development server with hot module replacement
- **Error Handling**: Centralized error middleware with structured error responses
- **Request Logging**: Custom middleware for API request/response logging

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Users table for authentication, conversations table with JSONB message storage
- **Development Storage**: In-memory storage implementation for development/testing
- **Session Management**: UUID-based session tracking for conversation persistence

## Authentication and Authorization
- **User Model**: Simple username/password authentication schema
- **Session Handling**: Session-based conversation tracking without complex auth flows
- **Data Isolation**: Conversations tied to session IDs for user separation

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
- **Dual Mode Operation**: Natural chat mode vs. technical protocol mode with distinct AI personalities
- **Component Composition**: Modular UI components with consistent theming
- **Custom Hooks**: Specialized hooks for terminal functionality, speech synthesis, and mobile detection
- **Type Safety**: Comprehensive TypeScript usage with Zod schema validation
- **Development Experience**: Hot reloading, error overlays, and Replit integration for seamless development