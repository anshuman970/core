# Contributing to Altus 4

Thank you for your interest in contributing to Altus 4! This document provides guidelines for contributing to the project.

## Development Setup

1. **Prerequisites**
   - Node.js 18+ (recommend Node.js 20)
   - MySQL 8.0+
   - Redis 7+
   - Git

2. **Getting Started**

   ```bash
   git clone <repository-url>
   cd altus4
   npm install
   cp .env.example .env
   # Configure your .env file with database and API credentials
   npm run dev
   ```

3. **Database Setup**
   - Create a MySQL database for development
   - Update .env with your database credentials
   - The application will handle schema creation

## Development Workflow

### Before You Start

1. Check existing issues and PRs to avoid duplicate work
2. For new features, create an issue to discuss the approach
3. Fork the repository and create a feature branch

### Making Changes

1. **Branch Naming**
   - `feature/description` for new features
   - `fix/description` for bug fixes
   - `docs/description` for documentation
   - `refactor/description` for refactoring

2. **Code Standards**
   - Follow existing TypeScript conventions
   - Use meaningful variable and function names
   - Add JSDoc comments for public APIs
   - Follow the established project structure

3. **Testing**

   ```bash
   npm run test          # Run all tests
   npm run test:watch    # Run tests in watch mode
   npm run lint          # Check linting
   npm run build         # Verify TypeScript compilation
   ```

4. **Commits**
   - Use conventional commit format: `type(scope): description`
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
   - Keep commits atomic and well-described

### Submitting Changes

1. **Pull Request Process**
   - Create a detailed PR using the provided template
   - Link to related issues
   - Ensure all checks pass
   - Request review from relevant code owners

2. **Review Process**
   - Address feedback promptly
   - Keep discussions constructive
   - Update documentation if needed

## Code Guidelines

### TypeScript

- Use strict TypeScript configuration
- Define proper interfaces in `src/types/`
- Avoid `any` types unless absolutely necessary
- Use meaningful generic type names

### Error Handling

- Use the `AppError` class for application errors
- Provide meaningful error messages
- Include proper HTTP status codes
- Log errors with appropriate context

### Database Operations

- Always use connection pooling through `DatabaseService`
- Release connections after use
- Use prepared statements to prevent SQL injection
- Handle connection failures gracefully

### Security

- Never commit secrets or API keys
- Validate all user inputs
- Use proper authentication middleware
- Follow security best practices for database connections

### Performance

- Cache frequently accessed data in Redis
- Use appropriate database indexes
- Implement proper pagination
- Monitor performance metrics

## Testing Guidelines

### Unit Tests

- Test individual functions and classes
- Mock external dependencies
- Aim for high test coverage on core business logic
- Use descriptive test names

### Integration Tests

- Test API endpoints end-to-end
- Use test database with realistic data
- Test error conditions and edge cases
- Verify proper cleanup after tests

### Performance Tests

- Benchmark critical search operations
- Test with realistic data volumes
- Monitor memory usage and response times
- Set performance regression thresholds

## Documentation

### Code Documentation

- Add JSDoc comments for all public APIs
- Document complex algorithms and business logic
- Include usage examples where helpful
- Keep comments up-to-date with code changes

### API Documentation

- Document all endpoints with request/response examples
- Include error response formats
- Document authentication requirements
- Update OpenAPI specification if applicable

## Issue Reporting

### Bug Reports

Use the bug report template and include:

- Clear description of the issue
- Steps to reproduce
- Expected vs. actual behavior
- Environment details
- Relevant logs or error messages

### Feature Requests

Use the feature request template and include:

- Clear description of the desired feature
- Use case and business value
- Proposed implementation approach
- Impact on existing functionality

## Security

### Reporting Security Issues

- **DO NOT** create public issues for security vulnerabilities
- Email security issues to the maintainers
- Include detailed information about the vulnerability
- Allow time for fix before public disclosure

### Security Guidelines

- Follow secure coding practices
- Validate and sanitize all inputs
- Use parameterized queries for database operations
- Implement proper authentication and authorization
- Keep dependencies updated

## Community

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

### Getting Help

- Check existing documentation first
- Search issues and discussions
- Create a question issue if needed
- Join community discussions

## Release Process

### Version Management

- Follow semantic versioning (SemVer)
- Update CHANGELOG.md for each release
- Tag releases with version numbers
- Create GitHub releases with release notes

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Security scan completed
- [ ] Performance benchmarks verified

## Resources

- [Project README](../README.md)
- [API Documentation](../docs/api.md)
- [Architecture Overview](../CLAUDE.md)
- [Security Guidelines](../docs/security.md)

Thank you for contributing to Altus 4!
