/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory
  rootDir: '.',

  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.ts',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/tests/**/*.test.ts',
  ],

  // Setup files
  setupFiles: ['<rootDir>/tests/env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    // Only include files that have meaningful tests for now
    'src/services/SearchService.ts',
    'src/config/index.ts',
    // Add other files as they get proper test coverage
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 60,
      statements: 60,
    },
    // Specific thresholds for individual files
    'src/services/SearchService.ts': {
      branches: 70,
      functions: 80,
      lines: 70,
      statements: 70,
    },
    'src/config/index.ts': {
      branches: 50,
      functions: 30,
      lines: 60,
      statements: 60,
    },
  },

  // Module resolution - CORRECT property name is moduleNameMapper
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  // Transform configuration
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  // Test timeout
  testTimeout: 30000,

  // Global setup/teardown (temporarily disabled)
  // globalSetup: '<rootDir>/tests/global-setup.ts',
  // globalTeardown: '<rootDir>/tests/global-teardown.ts',

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Handle async operations
  detectOpenHandles: true,
  forceExit: true,
};
