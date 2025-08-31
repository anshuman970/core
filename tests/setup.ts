import { logger } from '@/utils/logger';

// Set test environment
process.env.NODE_ENV = 'test';

// Configure logger for testing
logger.level = 'error'; // Only show errors during tests

// Global test timeout
jest.setTimeout(30000);

// Mock external services by default
jest.mock('../src/services/AIService', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    isAvailable: jest.fn(() => false),
    processSearchQuery: jest.fn(),
    categorizeResults: jest.fn(() => []),
    getQuerySuggestions: jest.fn(() => []),
    getOptimizationSuggestions: jest.fn(() => []),
    analyzeQuery: jest.fn(() => ({ recommendations: [], optimizations: [] })),
    generateInsights: jest.fn(() => ({ insights: [], performance: [] })),
  })),
}));

// Mock CacheService
jest.mock('../src/services/CacheService', () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getPopularQueries: jest.fn(() => []),
    getTopQueries: jest.fn(() => []),
    getQueryVolume: jest.fn(() => 0),
    getAverageResponseTime: jest.fn(() => 0),
    getPopularCategories: jest.fn(() => []),
    logSearchAnalytics: jest.fn(),
    getSearchHistory: jest.fn(() => []),
    close: jest.fn(),
    redis: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      quit: jest.fn(),
    },
  })),
}));

// Mock DatabaseService
jest.mock('../src/services/DatabaseService', () => ({
  DatabaseService: jest.fn().mockImplementation(() => ({
    executeFullTextSearch: jest.fn(),
    getSearchSuggestions: jest.fn(),
    analyzeQueryPerformance: jest.fn(() => [
      { metric: 'execution_time', value: 35 },
      { metric: 'result_count', value: 365 },
    ]),
    testConnection: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock UserService
jest.mock('../src/services/UserService', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    registerUser: jest.fn(),
    loginUser: jest.fn(),
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    changePassword: jest.fn(),
    deactivateUser: jest.fn(),
    generateToken: jest.fn(),
    verifyToken: jest.fn(),
    getAllUsers: jest.fn(),
    updateUserRole: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock MySQL connections to prevent real database calls
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(() =>
    Promise.resolve({
      execute: jest.fn(),
      end: jest.fn(),
    })
  ),
  createPool: jest.fn(() => ({
    execute: jest.fn(),
    end: jest.fn(),
  })),
}));

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global cleanup
afterAll(async () => {
  // Close any remaining connections
  await new Promise(resolve => setTimeout(resolve, 100));
});
