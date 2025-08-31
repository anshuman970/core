import { createConnection } from 'mysql2/promise';
import Redis from 'ioredis';
import { logger } from '@/utils/logger';

export default async function globalSetup() {
  logger.info('Setting up test environment...');

  try {
    // Test database connection
    const dbConnection = await createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
    });

    // Create test database if it doesn't exist
    const testDbName = process.env.DB_DATABASE || 'altus4_test';
    await dbConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${testDbName}\``);

    // Switch to test database
    await dbConnection.execute(`USE \`${testDbName}\``);

    // Create test tables
    const createTablesSQL = `
      -- Test users table
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );

      -- Test database connections table
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Test search analytics table
      CREATE TABLE IF NOT EXISTS search_analytics (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        database_id VARCHAR(36),
        query_text TEXT NOT NULL,
        search_mode ENUM('natural', 'boolean', 'semantic') DEFAULT 'natural',
        result_count INT DEFAULT 0,
        execution_time_ms INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (database_id) REFERENCES database_connections(id) ON DELETE SET NULL
      );

      -- Test content table with full-text index for testing searches
      CREATE TABLE IF NOT EXISTS test_content (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FULLTEXT(title, content)
      );

      -- Insert test data
      INSERT IGNORE INTO test_content (id, title, content, category) VALUES
        (1, 'Database Performance Optimization', 'Learn how to optimize MySQL database performance with indexes, query optimization, and caching strategies.', 'database'),
        (2, 'Full-Text Search Tutorial', 'Complete guide to MySQL full-text search including boolean mode, natural language mode, and query expansion.', 'search'),
        (3, 'AI Integration Guide', 'How to integrate AI services with your database for enhanced search capabilities and intelligent insights.', 'ai'),
        (4, 'Security Best Practices', 'Essential security practices for database applications including encryption, authentication, and access control.', 'security'),
        (5, 'Caching Strategies', 'Implement effective caching with Redis to improve application performance and reduce database load.', 'performance');
    `;

    // Execute table creation
    const statements = createTablesSQL.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await dbConnection.execute(statement);
      }
    }

    await dbConnection.end();
    logger.info('Test database setup completed');

    // Test Redis connection
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_TEST_DB || '1'), // Use different DB for tests
      lazyConnect: true,
    });

    await redis.connect();
    await redis.flushdb(); // Clear test database
    await redis.disconnect();
    logger.info('Test Redis setup completed');
  } catch (error) {
    logger.error('Test setup failed:', error);
    throw error;
  }
}
