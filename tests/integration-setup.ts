/**
 * Setup for Integration Tests
 *
 * This setup file is used specifically for integration tests and does not
 * mock external services like the main setup.ts does.
 */

import { logger } from '@/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';

// Configure logger for testing
logger.level = 'error'; // Only show errors during tests

// Global test timeout
jest.setTimeout(60000);

// Don't mock external services for integration tests - we want real connections

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global cleanup
afterAll(async () => {
  // Close any remaining connections
  await new Promise(resolve => setTimeout(resolve, 100));
});
