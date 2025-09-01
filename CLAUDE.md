# Altus 4 - AI-Enhanced MySQL Full-Text Search Engine

## Project Overview

Altus 4 is an intelligent search-as-a-service platform that leverages MySQL's built-in full-text search capabilities while adding AI-powered optimizations and enhancements. Users can connect their existing MySQL databases to Altus 4, which then provides enhanced search capabilities with semantic understanding, query optimization, and trend analysis.

## Core Value Proposition

Instead of requiring users to migrate to specialized search solutions like Elasticsearch or Solr, Altus 4 enhances MySQL's native `FULLTEXT` search with:

- AI-powered query optimization and semantic search

```text
src/
├── config/          # Configuration management and validation
├── controllers/     # Route controllers with business logic
├── middleware/      # Express middleware (auth, validation, rate limiting)
├── routes/         # API route definitions with Zod validation
├── services/       # Core business logic services
├── types/          # TypeScript interface and type definitions
├── utils/          # Utility functions (logging, encryption, etc.)
```

- Natural language query processing
- Intelligent result categorization and insights
- Performance monitoring and optimization suggestions
- Multi-database federation capabilities

## Technology Stack

- **Backend**: Node.js with TypeScript
- **Framework**: Express.js with comprehensive middleware stack
- **Database**: MySQL 8.0+ (for client databases and metadata storage)
- **Cache**: Redis (for performance optimization and analytics)
- **AI Integration**: OpenAI API (GPT models for semantic enhancement)
- **Authentication**: JWT-based with bcrypt password hashing
- **Validation**: Zod schemas for request/response validation
- **Logging**: Winston with structured logging
- **Development**: ESLint, Prettier, Jest for testing

## Project Architecture

### Four Core Layers

1. **Database Integration Layer**: Secure multi-tenant MySQL connection management
2. **Search Engine Core**: MySQL FULLTEXT optimization and query execution
3. **AI Enhancement Layer**: Semantic search, categorization, and optimization suggestions
4. **API Layer**: RESTful endpoints with authentication and rate limiting

### Key Services

- `DatabaseService`: Connection pooling and schema discovery
- `SearchService`: Core search orchestration and result processing
- `AIService`: OpenAI integration for semantic enhancement
- `CacheService`: Redis-based caching and analytics storage

## Development Guidelines

### Code Conventions

- **TypeScript**: Strict mode enabled with comprehensive type definitions
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces
- **Async/Await**: Preferred over Promises for better readability
- **Error Handling**: Custom AppError class with proper error codes
- **Logging**: Structured logging with appropriate levels (info, warn, error)

### File Organization

```text
src/
├── config/          # Configuration management and validation
├── controllers/     # Route controllers with business logic
├── middleware/      # Express middleware (auth, validation, rate limiting)
├── routes/         # API route definitions with Zod validation
├── services/       # Core business logic services
├── types/          # TypeScript interface and type definitions
├── utils/          # Utility functions (logging, encryption, etc.)
└── index.ts        # Application entry point
```

### Testing Strategy

- **Unit Tests**: Jest for service and utility functions
- **Integration Tests**: API endpoint testing with test database
- **Test Files**: Co-located with source files using `.test.ts` suffix
- **Coverage**: Aim for 80%+ code coverage on core services

## Key Features & Functionality

### Database Management

- Secure credential encryption for client database connections
- Connection pooling with configurable limits and timeouts
- Automatic schema discovery and FULLTEXT index detection
- Connection health monitoring and reconnection logic

### Search Capabilities

- Natural language, boolean, and semantic search modes
- Multi-database and multi-table search federation
- Intelligent result ranking and relevance scoring
- Auto-generated search suggestions and query corrections

### AI Enhancements

- Query optimization recommendations using AI analysis
- Semantic search using embeddings for concept matching
- Automatic result categorization and tagging
- Trend analysis and search pattern insights

### Performance & Security

- Redis caching for frequently accessed data and search results
- Rate limiting with IP-based throttling
- JWT authentication with role-based access control
- SQL injection prevention and input sanitization

## Environment Setup

### Required Environment Variables

```bash
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USERNAME=altus4_user
DB_PASSWORD=secure_password
DB_DATABASE=altus4_metadata
JWT_SECRET=minimum_32_character_secret_key
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=sk-your_openai_key
```

### Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run test` - Run test suite with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix linting issues

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login with JWT token

### Search Operations

- `POST /api/v1/search` - Execute search across databases
- `GET /api/v1/search/suggestions` - Get search suggestions
- `POST /api/v1/search/analyze` - Analyze query performance
- `GET /api/v1/search/trends` - Get user search trends
- `GET /api/v1/search/history` - Get search history

### Database Management

- `POST /api/v1/databases` - Add database connection
- `GET /api/v1/databases` - List user's database connections
- `PUT /api/v1/databases/:id` - Update database connection
- `DELETE /api/v1/databases/:id` - Remove database connection
- `GET /api/v1/databases/:id/schema` - Discover database schema

## Instructions for Claude

### When Working on This Project

1. **Type Safety**: Always use TypeScript types from `src/types/index.ts`. Create new types when needed.

2. **Error Handling**: Use the `AppError` class for application errors with appropriate HTTP status codes and error codes.

3. **Database Operations**:
   - Use connection pooling through `DatabaseService`
   - Always release connections after use
   - Handle connection failures gracefully

4. **Authentication**:
   - Protect all routes except auth endpoints with `authenticate` middleware
   - Use `AuthenticatedRequest` interface for authenticated routes
   - Include user context in all operations

5. **Validation**:
   - Use Zod schemas for all API input validation
   - Validate environment variables on startup
   - Sanitize database inputs to prevent SQL injection

6. **Logging**:
   - Use structured logging with relevant context
   - Log errors with stack traces
   - Include request IDs for traceability

7. **Performance**:
   - Cache frequently accessed data in Redis
   - Use database indexes effectively
   - Implement proper pagination for large result sets

8. **AI Integration**:
   - Handle OpenAI API failures gracefully
   - Implement fallbacks when AI services are unavailable
   - Cache AI responses when appropriate

### Code Quality Standards

- Write comprehensive JSDoc comments for public functions
- Include error handling in all async operations
- Use descriptive variable names and function names
- Follow the established patterns in existing code
- Write tests for new functionality
- Ensure all new code passes linting and type checking

### When Adding New Features

1. Update relevant TypeScript interfaces
2. Add appropriate validation schemas
3. Implement error handling and logging
4. Update API documentation
5. Add tests for the new functionality
6. Consider caching implications
7. Update this CLAUDE.md if architectural changes are made

## Current Development Status

### ✅ Completed

- Project architecture and TypeScript setup
- Core type definitions and interfaces
- Express server with middleware stack
- Configuration management with validation
- Database service with connection pooling
- Search service architecture
- Authentication and security middleware
- API route structure with validation

### 🚧 In Progress

- AI service implementation (OpenAI integration)
- Cache service implementation (Redis)
- Complete authentication routes
- Database schema discovery functionality

### 📋 Next Steps

1. Implement missing services (AIService, CacheService)
2. Complete user management and authentication
3. Add comprehensive test suite
4. Implement real-time analytics dashboard
5. Add performance monitoring and alerting
6. Create deployment documentation

## Important Notes

- **Security**: Never commit actual API keys or database credentials
- **Performance**: Monitor database connection usage and implement circuit breakers
- **Scalability**: Design for horizontal scaling with stateless architecture
- **Monitoring**: Implement proper health checks and metrics collection
- **API Documentation**: Keep API documentation up to date with code changes and strictl no emojies
- **Style**: Use the style of the existing code and the code documentation in the codebase.
- **Documentation**: Keep API documentation up to date with code changes and strictl no emojies
