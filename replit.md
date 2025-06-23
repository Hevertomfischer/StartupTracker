# Startup Management Platform

## Overview

This is a comprehensive startup management platform built with React, TypeScript, Express.js, and PostgreSQL. The system provides a complete solution for managing startup portfolios, team members, tasks, workflows, and documentation. It features a modern web interface with drag-and-drop kanban boards, file management, user authentication, role-based access control, and automated workflow capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Radix UI components with Tailwind CSS for styling
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **Drag & Drop**: @dnd-kit for kanban board functionality

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ESM modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with local strategy and express-session
- **File Handling**: Multer for file uploads with disk storage
- **Email Service**: Resend for email notifications

### Database Architecture
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Key Tables**: 
  - Users with role-based permissions
  - Startups with comprehensive metadata
  - Tasks and workflow management
  - File attachments and pitch deck storage
  - Audit trails and status history

## Key Components

### Authentication & Authorization
- **Authentication**: Session-based auth with Passport.js local strategy
- **Authorization**: Role-based access control (Admin, Investor, User roles)
- **Session Management**: Memory store with 30-day session persistence
- **Protected Routes**: Component-level route protection based on user roles

### Startup Management
- **CRUD Operations**: Full create, read, update, delete functionality
- **Status Tracking**: Customizable status pipeline with drag-and-drop kanban
- **File Management**: Pitch deck uploads and document attachments
- **Team Members**: Multi-member startup teams with role assignments
- **History Tracking**: Complete audit trail of changes and status updates

### Task Management
- **Task CRUD**: Create, assign, and track tasks across startups
- **Priority System**: High, Medium, Low priority assignments
- **Status Workflow**: Todo, In Progress, Done status tracking
- **Comments**: Task-level discussion threads
- **Assignment**: Tasks can be assigned to specific team members

### Workflow Engine
- **Automated Workflows**: Trigger-based automation system
- **Conditions**: Field-based conditional logic
- **Actions**: Email notifications, status changes, task creation
- **Logging**: Comprehensive workflow execution logging
- **Status Tracking**: Success/failure monitoring with detailed error reporting

### File Management
- **Upload System**: Secure file upload with type validation
- **Storage**: Local disk storage with organized directory structure
- **File Types**: Support for documents, images, and presentation files
- **Pitch Decks**: Dedicated pitch deck management per startup
- **Access Control**: Secure file serving with authentication

## Data Flow

### Authentication Flow
1. User submits credentials via login form
2. Passport.js validates against database
3. Session created and stored in memory store
4. User object cached in React Query
5. Protected routes check authentication status

### Startup Management Flow
1. CRUD operations trigger API calls
2. Drizzle ORM handles database operations
3. React Query manages cache invalidation
4. UI updates reflect changes immediately
5. Audit trail records all modifications

### File Upload Flow
1. Multer middleware processes file uploads
2. Files stored in local uploads directory
3. File metadata saved to database
4. Frontend updates with file information
5. Static file serving for access

### Workflow Execution Flow
1. Triggers monitor startup status changes
2. Conditions evaluated against startup data
3. Actions executed based on workflow configuration
4. Results logged to workflow_logs table
5. Email notifications sent via Resend service

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Router (Wouter)
- **TypeScript**: Full TypeScript support across frontend and backend
- **Build Tools**: Vite, ESBuild for production builds
- **Database**: PostgreSQL with Drizzle ORM and postgres.js driver

### UI/UX Dependencies
- **Component Library**: Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with custom theme configuration
- **Icons**: Lucide React for consistent iconography
- **Drag & Drop**: @dnd-kit for kanban board interactions

### Backend Dependencies
- **Web Framework**: Express.js with TypeScript support
- **Authentication**: Passport.js with express-session
- **File Handling**: Multer for multipart form data
- **Email Service**: Resend for transactional emails
- **Session Storage**: memorystore for session persistence

### Database Dependencies
- **ORM**: Drizzle ORM for type-safe database operations
- **Database Driver**: @neondatabase/serverless for PostgreSQL connection
- **Migrations**: Drizzle Kit for schema management

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite development server with HMR
- **Database**: PostgreSQL via Replit's built-in database
- **File Storage**: Local uploads directory
- **Environment**: Node.js 20 with hot reload via tsx

### Production Build
- **Frontend Build**: Vite builds optimized React bundle to dist/public
- **Backend Build**: ESBuild bundles server code to dist/index.js
- **Database**: PostgreSQL via DATABASE_URL environment variable
- **File Serving**: Express static middleware for uploaded files

### Replit Configuration
- **Modules**: nodejs-20, bash, web, postgresql-16
- **Deployment**: Autoscale deployment target
- **Port Configuration**: Internal port 5000, external port 80
- **Build Process**: npm run build compiles both frontend and backend
- **Start Command**: NODE_ENV=production node dist/index.js

### Environment Variables
- **DATABASE_URL**: PostgreSQL connection string
- **SESSION_SECRET**: Secret key for session encryption
- **RESEND_API_KEY**: API key for email service
- **NODE_ENV**: Environment flag for production optimizations

## Recent Changes

- June 23, 2025: Fixed PDF extraction review screen and implemented AI startup review system
  - Fixed state management issue preventing confirmation screen from appearing after PDF processing
  - Removed dependency on extractedData state for confirmation view rendering
  - Implemented immediate state updates for better user experience
  - Created comprehensive AI startup review modal for manual verification
  - Added AI generation tracking fields to database schema (created_by_ai, ai_extraction_data)
  - Added "Revisar IA" button to dashboard for accessing AI-generated startup review
  - Implemented filtering system to identify AI-generated startups vs manual entries
  - Added editing capabilities for AI-generated startup data
  - Enhanced startup creation flow to mark AI-generated entries properly

- June 23, 2025: Complete refactor of AI modal component for startup creation
  - Completely rewrote AddStartupWithAIModal with simplified state management
  - Eliminated complex state conflicts causing confirmation screen issues
  - Implemented direct view switching instead of complex step management
  - Fixed PDF processing functionality for AI-powered startup creation
  - Resolved multer field name mismatch ('file' vs 'pitch_deck')
  - Changed route permissions from admin-only to authenticated users
  - Removed PDF file size limitations
  - Fixed ES module compatibility issues with PDF parsing
  - Enhanced error handling and logging for better debugging
  
- June 23, 2025: Smart Startup Data Auto-completion Wizard Implementation (Completed)
  - Implemented intelligent form auto-completion based on partial data inputs
  - Added predictive field completion using existing startup database patterns
  - Created smart suggestions for sector, business model, location, website, and description fields
  - Built confidence scoring system for suggestion quality assessment
  - Added visual indicators with animated lightbulb icons
  - Implemented contextual suggestions that consider related form fields
  - Created pattern analysis from existing startup database for intelligent recommendations

## Changelog

- June 13, 2025: Initial setup
- June 23, 2025: PDF processing fixes and improvements

## User Preferences

Preferred communication style: Simple, everyday language.