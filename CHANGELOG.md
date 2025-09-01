# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-01-15

### Added

#### **API Key Authentication System**

- **Complete JWT to API Key migration** - Replaced JWT authentication with production-ready API key system for B2B service-to-service communication
- **Secure API key generation** with format `altus4_sk_{environment}_{random}` and SHA-256 hashing
- **Comprehensive API key management** - Create, list, update, revoke, and regenerate API keys
- **Environment separation** - Support for 'test' and 'live' API key environments
- **Scoped permissions system** - API keys with specific permissions (search, analytics, admin)
- **Tiered rate limiting** - Different rate limits based on API key tiers (free, pro, enterprise)
- **API key usage tracking** - Monitor and analyze API key usage patterns
- **Bootstrap management route** - Initial API key creation using existing authentication

#### **Enhanced Middleware & Services**

- **ApiKeyService** - Complete lifecycle management for API key operations
- **ApiKeyController** - RESTful API endpoints for API key management
- **Enhanced rate limiting** - API key tier-based rate limiting with Redis integration
- **Improved middleware architecture** - Better separation of concerns and testability

#### **Testing Infrastructure**

- **508 total tests** across 21 test suites with **100% pass rate**
- **Comprehensive unit tests** for all new API key components
- **Integration tests** for end-to-end API key workflows
- **Advanced Jest mocking** with module-level instantiation handling
- **Security test coverage** for all authentication scenarios
- **Edge case validation** for robust error handling
- **Complex middleware testing** with proper mock setup for module-level instantiation
- **Mock service architecture** for reliable, isolated unit testing

#### **Security Enhancements**

- **Prefix-based API key lookup** for efficient validation without exposing full keys
- **IP address tracking** for API key usage monitoring and security
- **Generic error messages** that don't reveal system internals for security
- **Proper authorization header validation** with whitespace handling
- **Enhanced permission and role validation** with detailed error responses

#### **New API Endpoints**

- **API key management endpoints** - `/api/v1/api-keys/*` routes for API key operations
- **Management endpoints** - New `/api/v1/management/*` routes for system administration
- **Enhanced response metadata** - All responses now include API key tier information where applicable

#### **Commit Verification System**

- **GPG commit signing** - Complete setup with ECC Curve 25519 encryption for cryptographic commit verification
- **Comprehensive Git hooks** - Pre-commit, commit-msg, post-commit, and pre-push hooks for quality assurance
- **Security auditing** - Automated vulnerability scanning and dependency validation
- **Commit verification tools** - Scripts for verifying commit signatures and message format compliance
- **Documentation linting** - Automated markdown and code formatting validation
- **Performance monitoring** - Pre-commit performance checks and optimization validation

### Changed

#### **Documentation Updates**

- **Updated README.md** with complete API key authentication guide
- **API documentation refresh** in `docs/api/README.md` with new authentication examples
- **Architecture documentation** updated to reflect API key system design
- **Service documentation** includes new ApiKeyService details
- **Setup guides** updated with API key workflow instructions
- **Example updates** throughout documentation to use API key authentication

#### **Code Quality & Maintenance**

- **ESLint compliance** - All lint issues resolved for clean codebase
- **TypeScript strict mode** compliance across all new modules
- **Standardized error responses** with structured ApiResponse format
- **Improved logging** with request correlation and API key context

#### **Project Organization**

- **Script consolidation** - Moved all executable scripts from `scripts/` to `bin/` directory for better organization
- **Enhanced npm scripts** - Added commit verification, security auditing, and hook testing commands
- **Conventional commits enforcement** - Updated all Git hooks to enforce conventional commit message format

#### **Authentication System (Breaking Changes)**

- **JWT authentication deprecated** - All endpoints now require API key authentication
- **Authorization header format** - Changed from `Bearer <jwt_token>` to `Bearer <api_key>`
- **Error response structure** - Enhanced error responses with additional context and details
- **Rate limiting behavior** - Now based on API key tiers instead of IP/user-based limiting

### Fixed

#### **Test Suite Stabilization**

- **Module instantiation mocking** - Resolved complex Jest mocking issues for middleware testing
- **Rate limiter response structure** - Fixed mock return values to match actual Redis responses
- **Error message consistency** - Aligned all test expectations with actual middleware responses
- **Mock service cleanup** - Removed unused mock objects and variables
- **Rate limiter test refinements** - Fixed accurate response structure validation
- **Error message standardization** - Aligned all test expectations across test suites

#### **Middleware & System Fixes**

- **Request object validation** - Added proper IP and connection properties for middleware processing
- **Error code standardization** - Consistent error codes across all authentication flows
- **Memory leak prevention** - Proper cleanup in test suites and mock implementations
- **TypeScript build issues** - Fixed version mismatches and type compatibility
- **Linting issues** - Resolved ESLint and Prettier conflicts

#### **Commit Verification Fixes**

- **GPG agent configuration** - Fixed pinentry setup for macOS commit signing
- **Hook execution permissions** - Ensured all Git hooks are properly executable
- **Markdown formatting** - Fixed documentation formatting issues in commit verification guide
- **Version references** - Updated all test expectations to match version 0.2.0
- **Script path references** - Updated all references from `scripts/` to `bin/` directory

---

## [0.1.0] - 2024-01-01

### Initial Release - AI-Enhanced MySQL Full-Text Search Engine

This is the first official release of Altus 4, a production-ready AI-enhanced MySQL full-text search engine with zero-migration setup.

### Added

#### **Core Search Engine**

- **Three search modes**: Basic keyword, Boolean operators, and Natural language processing
- **MySQL FULLTEXT integration** with `MATCH() AGAINST()` optimization
- **Query preprocessing** with stemming, stop word removal, and term expansion
- **Search result ranking** with relevance scoring and custom weighting
- **Real-time search suggestions** and auto-completion support

#### **AI Enhancement Features**

- **OpenAI GPT integration** for intelligent query optimization
- **Semantic search capabilities** with natural language understanding
- **Query categorization** and intent recognition
- **AI-powered search insights** and result enhancement
- **Smart query suggestions** based on user context

#### **Database Integration**

- **Zero-migration setup** - works with existing MySQL databases
- **Dynamic database connections** with connection pooling
- **FULLTEXT index management** and optimization
- **Custom table configuration** support
- **Database health monitoring** and automatic reconnection

#### **Performance & Caching**

- **Redis caching layer** with intelligent cache invalidation
- **Query result caching** with TTL management
- **Search analytics caching** for performance insights
- **Connection pooling** for optimal resource utilization
- **Rate limiting** to prevent abuse and ensure stability

#### **Security & Authentication**

- **JWT-based authentication** with refresh token support
- **bcrypt password hashing** with configurable salt rounds
- **Role-based access control** (Admin, User roles)
- **AES-256-GCM encryption** for sensitive data
- **Request validation** with Zod schemas
- **Security headers** and CORS configuration

#### **Analytics & Monitoring**

- **Real-time search analytics** with query performance tracking
- **User behavior insights** and search pattern analysis
- **Performance metrics** collection and reporting
- **Error tracking** and logging with structured logs
- **Health check endpoints** for system monitoring

#### **Developer Experience**

- **Comprehensive REST API** with OpenAPI documentation
- **TypeScript support** with strict type checking
- **Extensive test suite** with 87% coverage (407 tests across 18 suites)
- **Integration tests** for end-to-end functionality
- **Docker support** with multi-stage builds
- **Development tools** including hot reload and debugging

#### **Documentation & Examples**

- **Complete API documentation** with request/response examples
- **Architecture guides** explaining system design patterns
- **Setup and deployment guides** for various environments
- **Code examples** and tutorials for common use cases
- **Service documentation** with detailed class explanations

#### **Production Features**

- **Environment-based configuration** with validation
- **Graceful shutdown** handling for clean deployment
- **Error handling middleware** with standardized error responses
- **Request logging** with correlation IDs for tracing
- **Memory and resource optimization** for production workloads

### Changed

#### **Architecture Improvements**

- **Modular service architecture** replacing monolithic design patterns
- **Dependency injection** implementation for better testability
- **Centralized configuration management** with environment validation
- **Standardized error handling** across all services and controllers
- **Improved logging strategy** with structured JSON logs

#### **Performance Optimizations**

- **Query optimization** algorithms for better search performance
- **Caching strategy refinement** to reduce database load
- **Connection pooling improvements** for better resource management
- **Memory usage optimization** in search result processing

### Fixed

#### **Test Suite Stabilization**

- **Jest auto-mocking issues** preventing service method execution
- **TypeScript compilation errors** in test files for bcrypt, OpenAI, and Redis mocking
- **Asynchronous constructor handling** in UserService tests
- **Database connection mocking** to properly simulate MySQL operations
- **Date formatting inconsistencies** in cache key generation tests

#### **Development Environment**

- **ESLint and Prettier configuration** conflicts
- **TypeScript strict mode** compliance across all modules
- **Environment variable validation** and type safety
- **Import path resolution** and module dependency management

#### **Security Enhancements**

- **JWT token validation** edge cases and error handling
- **Password hashing** consistency and validation
- **SQL injection prevention** through parameterized queries
- **Rate limiting** accuracy and redis connection handling

#### **Monitoring & Logging**

- **Error logging** format standardization
- **Performance metric** collection accuracy
- **Health check** reliability and timeout handling
- **Analytics data** consistency and validation

---

[0.2.0]: https://github.com/your-org/altus4/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/your-org/altus4/releases/tag/v0.1.0
