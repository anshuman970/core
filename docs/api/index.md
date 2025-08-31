# API Reference

**Complete API Documentation for Altus 4**

Altus 4 provides a RESTful API for managing database connections, executing searches, and accessing analytics. All endpoints follow REST conventions and return JSON responses.

## Authentication

All API endpoints (except authentication endpoints) require JWT authentication.

### Authentication Flow

1. **Register** a new user account
2. **Login** to receive a JWT token
3. **Include token** in `Authorization` header for all subsequent requests

```bash
# Include JWT token in all requests
Authorization: Bearer <your-jwt-token>
```

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | User login | No |
| `POST` | `/api/auth/logout` | User logout | Yes |
| `GET` | `/api/auth/profile` | Get user profile | Yes |
| `PUT` | `/api/auth/profile` | Update profile | Yes |
| `POST` | `/api/auth/change-password` | Change password | Yes |
| `POST` | `/api/auth/refresh` | Refresh JWT token | Yes |
| `DELETE` | `/api/auth/deactivate` | Deactivate account | Yes |

[**→ Complete Authentication Documentation**](./auth.md)

## Database Management

Manage MySQL database connections for searching.

### Database Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/databases` | List user databases | Yes |
| `POST` | `/api/databases` | Add database connection | Yes |
| `GET` | `/api/databases/:id` | Get database details | Yes |
| `PUT` | `/api/databases/:id` | Update database connection | Yes |
| `DELETE` | `/api/databases/:id` | Remove database connection | Yes |
| `POST` | `/api/databases/:id/test` | Test database connection | Yes |
| `GET` | `/api/databases/:id/schema` | Get database schema | Yes |
| `GET` | `/api/databases/:id/status` | Get connection status | Yes |

[**Complete Database Documentation**](./database.md)

## Search Operations

Execute searches across connected databases with AI enhancements.

### Search Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/search` | Execute search | Yes |
| `GET` | `/api/search/suggestions` | Get search suggestions | Yes |
| `POST` | `/api/search/analyze` | Analyze query performance | Yes |
| `GET` | `/api/search/history` | Get search history | Yes |
| `GET` | `/api/search/trends` | Get user search trends | Yes |

[**Complete Search Documentation**](./search.md)

## Analytics & Insights

Access search analytics, performance metrics, and trend data.

### Analytics Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/analytics/dashboard` | Get dashboard data | Yes |
| `GET` | `/api/analytics/trends` | Get search trends | Yes |
| `GET` | `/api/analytics/performance` | Get performance metrics | Yes |
| `GET` | `/api/analytics/popular-queries` | Get popular queries | Yes |
| `GET` | `/api/analytics/insights` | Get AI-generated insights | Yes |
| `GET` | `/api/analytics/overview` | Get system overview | Yes |
| `GET` | `/api/analytics/user-activity` | Get user activity metrics | Yes |

[**Complete Analytics Documentation**](./analytics.md)

## System Endpoints

Health checks and system information.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/health` | System health check | No |
| `GET` | `/health/db` | Database health check | No |
| `GET` | `/health/redis` | Redis health check | No |
| `GET` | `/version` | API version info | No |

## Request/Response Format

### Standard Response Format

All API responses follow this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
    version: string;
    executionTime?: number;
  };
}
```

### Success Response Example

```json
{
  "success": true,
  "data": {
    "results": [...],
    "totalCount": 42,
    "executionTime": 123
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_abc123",
    "version": "0.1.0",
    "executionTime": 123
  }
}
```

### Error Response Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "query",
      "reason": "Query cannot be empty"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_abc123",
    "version": "0.1.0"
  }
}
```

## Error Handling

### HTTP Status Codes

| Status | Code | Description | Common Causes |
|--------|------|-------------|---------------|
| 200 | OK | Request successful | - |
| 201 | Created | Resource created | Registration, database connection |
| 400 | Bad Request | Invalid request | Missing/invalid parameters |
| 401 | Unauthorized | Authentication required | Missing/invalid JWT token |
| 403 | Forbidden | Insufficient permissions | Accessing other user's resources |
| 404 | Not Found | Resource not found | Invalid database/search ID |
| 429 | Too Many Requests | Rate limit exceeded | Too many API calls |
| 500 | Internal Server Error | Server error | Database/Redis connectivity issues |

### Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `DATABASE_ERROR` | 500 | Database connectivity/query error |
| `CACHE_ERROR` | 500 | Redis connectivity error |
| `AI_SERVICE_ERROR` | 500 | OpenAI API error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

[**Complete Error Documentation**](./errors.md)

## Rate Limiting

API requests are rate-limited to ensure fair usage and system stability.

### Default Limits

- **Authentication endpoints**: 10 requests per minute
- **Search endpoints**: 60 requests per minute
- **Database management**: 30 requests per minute
- **Analytics endpoints**: 120 requests per minute

### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642248000
X-RateLimit-Window: 60
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "details": {
      "limit": 60,
      "remaining": 0,
      "resetTime": "2024-01-15T10:31:00.000Z"
    }
  }
}
```

## Request Examples

### cURL Examples

```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password",
    "name": "Test User"
  }'

# Login and get JWT token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure_password"
  }'

# Execute search with JWT token
curl -X POST http://localhost:3000/api/search \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mysql performance optimization",
    "databases": ["db-uuid-1", "db-uuid-2"],
    "searchMode": "semantic",
    "limit": 20
  }'
```

### JavaScript/Node.js Examples

```javascript
// Using fetch API
const response = await fetch('http://localhost:3000/api/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'database optimization',
    databases: ['db-uuid-1'],
    searchMode: 'natural',
    limit: 10
  })
});

const result = await response.json();
console.log(result.data.results);
```

### Python Examples

```python
import requests

# Search request
response = requests.post(
    'http://localhost:3000/api/search',
    headers={
        'Authorization': f'Bearer {jwt_token}',
        'Content-Type': 'application/json'
    },
    json={
        'query': 'performance tuning',
        'databases': ['db-uuid-1'],
        'searchMode': 'boolean',
        'limit': 15
    }
)

data = response.json()
print(data['data']['results'])
```

## Related Documentation

- **[Authentication Guide](./auth.md)** - Complete authentication flow
- **[Database Management](./database.md)** - Managing database connections
- **[Search Operations](./search.md)** - Search API and features
- **[Analytics API](./analytics.md)** - Analytics and insights
- **[Request/Response Schemas](./schemas/)** - Complete type definitions
- **[Error Handling](./errors.md)** - Error codes and troubleshooting

## API Testing

### Testing Tools

- **[Postman Collection](./postman-collection.json)** - Import ready-to-use requests
- **[OpenAPI Spec](./openapi.yaml)** - Machine-readable API definition
- **[Insomnia Workspace](./insomnia-workspace.json)** - Alternative REST client

### Testing Checklist

- [ ] Authentication flow (register, login, token refresh)
- [ ] Database management (add, test, remove connections)
- [ ] Search operations (natural, boolean, semantic modes)
- [ ] Error handling (invalid requests, authentication failures)
- [ ] Rate limiting (exceeding request limits)
- [ ] Analytics access (trends, performance metrics)

---

**Need help?** Check out the [examples section](../examples/README.md) for practical implementations or [report issues](https://github.com/yourusername/altus4/issues) if you find any problems.
