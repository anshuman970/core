import { config } from '@/config';
import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.colorize({ all: true })
  ),
  defaultMeta: {
    service: 'altus4',
    version: process.env.npm_package_version || '0.1.0',
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaString}`;
        })
      ),
    }),

    // File transport for production
    ...(config.environment === 'production'
      ? [
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ]
      : []),
  ],
});

// Create logs directory if it doesn't exist in production
if (config.environment === 'production') {
  const fs = require('fs');
  const path = require('path');

  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

// src/utils/encryption.ts
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

export class EncryptionUtil {
  /**
   * Hash password using bcrypt
   */
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Encrypt sensitive data (like database credentials)
   */
  public static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  public static decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// .env.example file content
export const envExampleContent = `# Altus 4 Environment Configuration

# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (Primary - for metadata storage)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=altus4_user
DB_PASSWORD=your_secure_password_here
DB_DATABASE=altus4_metadata

# Redis Configuration (for caching and session management)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Authentication & Security
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here_minimum_32_characters_required
ENCRYPTION_KEY=your_encryption_key_for_database_credentials_32_bytes

# OpenAI Integration (for AI features)
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000

# Logging
LOG_LEVEL=info

# Database Pool Settings (optional fine-tuning)
DB_CONNECTION_LIMIT=10
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000

# Development/Testing
ENABLE_QUERY_LOGGING=true
ENABLE_PERFORMANCE_MONITORING=true
`;

// src/utils/database.ts
/**
 * Database utilities for metadata storage
 */
export const createMetadataTables = `
-- Altus 4 Metadata Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_created_at (created_at)
);

-- Database connections table
CREATE TABLE IF NOT EXISTS database_connections (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INT DEFAULT 3306,
  database_name VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password_encrypted TEXT NOT NULL,
  ssl_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_tested TIMESTAMP NULL,
  connection_status ENUM('active', 'inactive', 'error') DEFAULT 'inactive',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (connection_status),
  INDEX idx_active (is_active)
);

-- Search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  database_id VARCHAR(36),
  query_text TEXT NOT NULL,
  search_mode ENUM('natural', 'boolean', 'semantic') DEFAULT 'natural',
  result_count INT DEFAULT 0,
  execution_time_ms INT DEFAULT 0,
  tables_searched JSON,
  columns_searched JSON,
  filters_applied JSON,
  clicked_results JSON,
  user_satisfaction TINYINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (database_id) REFERENCES database_connections(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_database_id (database_id),
  INDEX idx_created_at (created_at),
  FULLTEXT idx_query_text (query_text)
);

-- Table schemas cache
CREATE TABLE IF NOT EXISTS table_schemas (
  id VARCHAR(36) PRIMARY KEY,
  database_id VARCHAR(36) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  column_info JSON NOT NULL,
  fulltext_indexes JSON,
  estimated_rows BIGINT DEFAULT 0,
  last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_searchable BOOLEAN DEFAULT true,
  FOREIGN KEY (database_id) REFERENCES database_connections(id) ON DELETE CASCADE,
  UNIQUE KEY unique_db_table (database_id, table_name),
  INDEX idx_database_id (database_id),
  INDEX idx_searchable (is_searchable),
  INDEX idx_analyzed (last_analyzed)
);

-- API tokens table (for API access)
CREATE TABLE IF NOT EXISTS api_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  permissions JSON DEFAULT ('["search"]'),
  expires_at TIMESTAMP NULL,
  last_used TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash),
  INDEX idx_active (is_active)
);

-- Query suggestions cache
CREATE TABLE IF NOT EXISTS query_suggestions (
  id VARCHAR(36) PRIMARY KEY,
  query_text VARCHAR(500) NOT NULL,
  suggestion_text VARCHAR(500) NOT NULL,
  suggestion_type ENUM('spelling', 'semantic', 'popular') NOT NULL,
  score DECIMAL(3,2) DEFAULT 0.50,
  usage_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_query_suggestion (query_text, suggestion_text),
  INDEX idx_query_text (query_text),
  INDEX idx_suggestion_type (suggestion_type),
  INDEX idx_score (score),
  FULLTEXT idx_query_fulltext (query_text, suggestion_text)
);
`;

// README.md content
export const readmeContent = `# Altus 4

AI-Enhanced MySQL Full-Text Search Engine

## Overview

Altus 4 is an intelligent search-as-a-service platform that leverages MySQL's built-in full-text search capabilities while adding AI-powered optimizations and enhancements.

## Features

- 🔍 **Advanced Full-Text Search**: Utilizes MySQL's FULLTEXT indexes with intelligent query optimization
- 🤖 **AI-Enhanced Results**: Natural language processing and semantic search capabilities
- 📊 **Analytics & Insights**: Search trends, performance monitoring, and optimization suggestions
- 🔗 **Multi-Database Support**: Connect and search across multiple MySQL databases
- 🚀 **High Performance**: Connection pooling, caching, and optimized query execution
- 🔐 **Enterprise Security**: JWT authentication, encrypted credentials, rate limiting

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- MySQL 8.0+
- Redis 6.0+
- OpenAI API key (optional, for AI features)

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/yourusername/altus4.git
cd altus4

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
nano .env

# Build the project
npm run build

# Start development server
npm run dev
\`\`\`

### Environment Setup

Create a \`.env\` file based on \`.env.example\`:

\`\`\`env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USERNAME=altus4_user
DB_PASSWORD=your_password
DB_DATABASE=altus4_metadata
JWT_SECRET=your_jwt_secret_minimum_32_characters
OPENAI_API_KEY=sk-your_openai_key
\`\`\`

### Database Setup

Create the metadata database and run the schema:

\`\`\`bash
mysql -u root -p
CREATE DATABASE altus4_metadata;
CREATE USER 'altus4_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON altus4_metadata.* TO 'altus4_user'@'localhost';
FLUSH PRIVILEGES;
\`\`\`

## API Usage

### Authentication

\`\`\`bash
# Register user
curl -X POST http://localhost:3000/api/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"password","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"password"}'
\`\`\`

### Search

\`\`\`bash
# Execute search
curl -X POST http://localhost:3000/api/v1/search \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "search terms",
    "databases": ["db1", "db2"],
    "searchMode": "natural",
    "limit": 20
  }'
\`\`\`

## Development

### Project Structure

\`\`\`
src/
├── config/          # Configuration management
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── routes/         # API route definitions
├── services/       # Business logic services
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Application entry point
\`\`\`

### Available Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build production bundle
- \`npm run start\` - Start production server
- \`npm run test\` - Run test suite
- \`npm run lint\` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- 📚 [Documentation](https://docs.altus4.dev)
- 🐛 [Issue Tracker](https://github.com/yourusername/altus4/issues)
- 💬 [Discussions](https://github.com/yourusername/altus4/discussions)
`;
