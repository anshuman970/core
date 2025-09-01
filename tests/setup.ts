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

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    ttl: jest.fn().mockResolvedValue(-1),
    expire: jest.fn().mockResolvedValue(1),
    flushdb: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    status: 'ready',
  }));
});

// Mock CacheService with simple in-memory cache for testing
const mockCache = new Map();

jest.mock('../src/services/CacheService', () => ({
  CacheService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation(async key => mockCache.get(key) || null),
    set: jest.fn().mockImplementation(async (key, value) => {
      mockCache.set(key, value);
      return true;
    }),
    del: jest.fn().mockImplementation(async key => {
      mockCache.delete(key);
      return true;
    }),
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
    executeFullTextSearch: jest
      .fn()
      .mockImplementation(async (dbId, query, tables, columns, limit) => {
        // Generate mock search results with realistic data
        const resultCount = Math.min(limit || 20, 100); // Simulate finding results
        const results = Array.from({ length: resultCount }, (_, i) => ({
          id: `result_${i}`,
          table_name: 'test_content',
          title: `Mock Result ${i} matching "${query}"`,
          content: `This is mock content for result ${i} containing search term "${query}" and other relevant information.`,
          relevance_score: Math.random() * 0.8 + 0.2, // 0.2 to 1.0
          category: ['database', 'search', 'performance'][i % 3],
        }));

        // Add small delay to simulate database query time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
        return results;
      }),
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
      execute: jest.fn().mockResolvedValue([[], { affectedRows: 1, insertId: 1 }]),
      end: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue(undefined),
    })
  ),
  createPool: jest.fn(() => ({
    execute: jest.fn().mockResolvedValue([[], { affectedRows: 1, insertId: 1 }]),
    end: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn(() =>
      Promise.resolve({
        execute: jest.fn().mockResolvedValue([[], { affectedRows: 1, insertId: 1 }]),
        release: jest.fn(),
        ping: jest.fn().mockResolvedValue(undefined),
      })
    ),
  })),
}));

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
