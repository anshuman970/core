# Test Suite Documentation

This directory contains comprehensive test suites for the Altus 4 project, covering unit tests, integration tests, and performance tests.

## Test Structure

```txt
tests/
├── integration/          # Integration tests for API endpoints
│   ├── auth.integration.test.ts
│   ├── database.integration.test.ts
│   ├── search.integration.test.ts
│   ├── analytics.integration.test.ts
│   └── test-server.ts    # Test server setup and utilities
├── performance/          # Performance benchmarking tests
├── utils/               # Test utilities and helpers
│   └── test-helpers.ts  # Common test helper functions
├── env-setup.js         # Environment setup for Jest
├── setup.ts            # Test setup and mocking
├── test-database.ts    # Database utilities for tests
└── README.md           # This file
```

## Running Tests

### Unit Tests (Recommended)

```bash
npm test              # Run all tests (unit + integration)
npm run test:unit     # Run only unit tests (faster, no external deps)
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run with coverage reporting
```

### Integration Tests (Requires Database)

```bash
npm run test:integration  # Run only integration tests
```

**Note**: Integration tests require MySQL and Redis to be running. They are designed to work with test databases and will not affect production data.

### Performance Tests

```bash
npm run test:performance  # Run performance benchmarks
```

## Test Configuration

### Environment Variables for Testing

```bash
# Test Database Configuration
TEST_DB_HOST=localhost
TEST_DB_PORT=3306
TEST_DB_USERNAME=test_user
TEST_DB_PASSWORD=test_password
TEST_DB_DATABASE=altus4_test

# Test Redis Configuration
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6379
TEST_REDIS_DB=1

# JWT Secret for Tests
TEST_JWT_SECRET=test_jwt_secret_key_for_integration_tests_only
```

## Integration Test Features

### Authentication Tests (`auth.integration.test.ts`)

- User registration with validation
- Login/logout functionality
- Profile management (get, update)
- Password change operations
- Token refresh mechanism
- Account deactivation

### Database Management Tests (`database.integration.test.ts`)

- CRUD operations for database connections
- Connection testing and validation
- Schema discovery
- Connection status monitoring
- User isolation and security

### Search Tests (`search.integration.test.ts`)

- Full-text search execution (natural, boolean, semantic)
- Search suggestions and autocompletion
- Query analysis and optimization
- Search history and trends
- Performance testing
- Pagination and filtering

### Analytics Tests (`analytics.integration.test.ts`)

- Search trends and metrics
- Performance analytics
- Popular queries tracking
- User insights and recommendations
- Dashboard data aggregation
- Admin-only endpoints
- Data isolation and security

## Test Utilities

### TestServer (`test-server.ts`)

- Express server setup for integration tests
- Middleware configuration
- Route mounting
- Request helpers with authentication
- Lifecycle management (start/stop)

### TestDatabase (`test-database.ts`)

- Database connection management
- Schema setup and teardown
- Test data insertion and cleanup
- Query execution helpers
- Connection pooling

### TestHelpers (`test-helpers.ts`)

- User creation and management
- Database connection utilities
- JWT token generation
- Mock services creation
- Performance measurement
- Request/response assertion helpers

## Test Best Practices

### Unit Tests

- Use mocks for external services (database, cache, AI)
- Test business logic in isolation
- Focus on edge cases and error handling
- Maintain high code coverage (>80%)

### Integration Tests

- Test complete API workflows
- Verify request/response formats
- Test authentication and authorization
- Ensure proper error handling
- Test pagination and filtering
- Verify data isolation between users

### Performance Tests

- Measure response times
- Test concurrent request handling
- Monitor memory usage
- Benchmark database queries
- Test rate limiting effectiveness

## Mocking Strategy

The test suite uses comprehensive mocking for external dependencies:

- **Database Services**: Mocked in unit tests, real connections in integration tests
- **Cache Service**: Redis mocked in unit tests
- **AI Service**: OpenAI API mocked for consistent testing
- **External APIs**: All external calls mocked to ensure test reliability

## Continuous Integration

Tests are configured to run in CI/CD pipelines with:

- Separate test databases
- Environment isolation
- Parallel test execution
- Coverage reporting
- Performance regression detection

## Troubleshooting

### Common Issues

1. **Integration tests failing**: Ensure MySQL and Redis are running
2. **Permission errors**: Check database user permissions
3. **Port conflicts**: Verify test ports are available
4. **Memory issues**: Increase Node.js memory limit for large test suites

### Debug Mode

```bash
NODE_ENV=test DEBUG=* npm test  # Run with debug logging
```

### Test Database Setup

```sql
-- Create test database and user
CREATE DATABASE IF NOT EXISTS altus4_test;
CREATE USER IF NOT EXISTS 'test_user'@'localhost' IDENTIFIED BY 'test_password';
GRANT ALL PRIVILEGES ON altus4_test.* TO 'test_user'@'localhost';
FLUSH PRIVILEGES;
```

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- `coverage/lcov-report/index.html` - HTML coverage report
- `coverage/coverage-final.json` - JSON coverage data
- `coverage/lcov.info` - LCOV format for CI tools
