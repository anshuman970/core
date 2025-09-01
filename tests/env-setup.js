// Set test environment
process.env.NODE_ENV = 'test';

// Load environment from .env.test if it exists, otherwise use defaults
try {
  require('dotenv').config({ path: '.env.test' });
} catch (error) {
  // .env.test doesn't exist, that's okay for unit tests
}

// Ensure critical test environment variables are set
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_at_least_32_characters_long';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
process.env.DB_DATABASE = process.env.DB_DATABASE || 'altus4_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
