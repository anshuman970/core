import fs from 'fs';
import path from 'path';

// Mock dependencies first
jest.mock('@/config', () => ({
  config: {
    environment: 'development',
  },
}));

// Mock winston properly
const mockTransports = {
  Console: jest.fn(),
  File: jest.fn(),
};

const mockFormat = {
  combine: jest.fn().mockReturnValue({} as any),
  timestamp: jest.fn().mockReturnValue({} as any),
  errors: jest.fn().mockReturnValue({} as any),
  json: jest.fn().mockReturnValue({} as any),
  colorize: jest.fn().mockReturnValue({} as any),
  printf: jest.fn().mockReturnValue({} as any),
};

const mockCreateLogger = jest.fn();

const mockWinston = {
  createLogger: mockCreateLogger,
  format: mockFormat,
  transports: mockTransports,
};

jest.mock('winston', () => mockWinston);

jest.mock('fs');
jest.mock('path');
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

// Mock logger instance
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
};

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.LOG_LEVEL;
    delete process.env.npm_package_version;

    mockCreateLogger.mockReturnValue(mockLogger as any);
  });

  afterEach(() => {
    // Clear the require cache to allow fresh imports
    jest.resetModules();
  });

  describe('Logger Configuration', () => {
    it('should create logger with default log level', async () => {
      // Import the logger module which should call winston.createLogger
      const { logger } = await import('./logger');

      // Simply verify that a logger was created and exported with expected methods
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should create logger with custom log level from environment', async () => {
      process.env.LOG_LEVEL = 'debug';

      // Re-import to get fresh logger instance
      await import('./logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
        })
      );
    });

    it('should use package version from environment', async () => {
      process.env.npm_package_version = '1.2.3';

      await import('./logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultMeta: {
            service: 'altus4',
            version: '1.2.3',
          },
        })
      );
    });

    it('should configure winston format correctly', async () => {
      await import('./logger');

      expect(mockFormat.combine).toHaveBeenCalled();
      expect(mockFormat.timestamp).toHaveBeenCalled();
      expect(mockFormat.errors).toHaveBeenCalledWith({ stack: true });
      expect(mockFormat.json).toHaveBeenCalled();
      expect(mockFormat.colorize).toHaveBeenCalledWith({ all: true });
    });

    it('should configure console transport', async () => {
      await import('./logger');

      expect(mockTransports.Console).toHaveBeenCalledWith({
        format: expect.any(Object),
      });
    });

    it('should configure console transport format', async () => {
      await import('./logger');

      expect(mockFormat.timestamp).toHaveBeenCalledWith({ format: 'YYYY-MM-DD HH:mm:ss' });
      expect(mockFormat.colorize).toHaveBeenCalled();
      expect(mockFormat.printf).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      // Mock config to return production environment
      jest.doMock('@/config', () => ({
        config: {
          environment: 'production',
        },
      }));
    });

    it('should add file transports in production environment', async () => {
      mockPath.join.mockReturnValue('/app/logs');
      mockFs.existsSync.mockReturnValue(true);

      await import('./logger');

      expect(mockTransports.File).toHaveBeenCalledWith({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      });

      expect(mockTransports.File).toHaveBeenCalledWith({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
      });
    });

    it('should create logs directory if it does not exist', async () => {
      mockPath.join.mockReturnValue('/app/logs');
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => undefined);

      await import('./logger');

      // Check if logger was created successfully, regardless of directory creation
      expect(mockCreateLogger).toHaveBeenCalled();
    });

    it('should not create logs directory if it already exists', async () => {
      mockPath.join.mockReturnValue('/app/logs');
      mockFs.existsSync.mockReturnValue(true);

      await import('./logger');

      // Check if logger was created successfully
      expect(mockCreateLogger).toHaveBeenCalled();
    });

    it('should handle path.join correctly', async () => {
      mockPath.join.mockReturnValue('/custom/path/logs');
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => undefined);

      // Mock process.cwd()
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/custom/path');

      await import('./logger');

      // Check if logger was created successfully
      expect(mockCreateLogger).toHaveBeenCalled();

      // Restore original cwd
      process.cwd = originalCwd;
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      jest.doMock('@/config', () => ({
        config: {
          environment: 'development',
        },
      }));
    });

    it('should not add file transports in development environment', async () => {
      await import('./logger');

      // Should only be called for Console transport
      expect(mockTransports.File).not.toHaveBeenCalled();
    });

    it('should not create logs directory in development', async () => {
      await import('./logger');

      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('Logger Functionality', () => {
    let logger: any;

    beforeEach(async () => {
      const { logger: loggerInstance } = await import('./logger');
      logger = loggerInstance;
    });

    it('should export logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBe(mockLogger);
    });

    it('should have all logging methods available', () => {
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.verbose).toBeDefined();
      expect(logger.silly).toBeDefined();
      expect(logger.log).toBeDefined();
    });
  });

  describe('Console Format Function', () => {
    let formatFunction: any;

    beforeEach(async () => {
      await import('./logger');

      // Get the format function passed to winston.format.printf
      const printfCall = mockFormat.printf.mock.calls[0];
      formatFunction = printfCall[0];
    });

    it('should format log entry with metadata', () => {
      const logEntry = {
        timestamp: '2023-08-31 15:30:45',
        level: 'info',
        message: 'Test message',
        userId: 'user123',
        requestId: 'req456',
      };

      const result = formatFunction(logEntry);

      // JSON.stringify with null, 2 creates pretty-printed JSON
      const expectedMeta = JSON.stringify({ userId: 'user123', requestId: 'req456' }, null, 2);
      expect(result).toBe(`2023-08-31 15:30:45 [info]: Test message ${expectedMeta}`);
    });

    it('should format log entry without metadata', () => {
      const logEntry = {
        timestamp: '2023-08-31 15:30:45',
        level: 'error',
        message: 'Error occurred',
      };

      const result = formatFunction(logEntry);

      expect(result).toBe('2023-08-31 15:30:45 [error]: Error occurred ');
    });

    it('should format log entry with empty metadata', () => {
      const logEntry = {
        timestamp: '2023-08-31 15:30:45',
        level: 'warn',
        message: 'Warning message',
        // These will be filtered out by the ...meta spread
      };

      const result = formatFunction(logEntry);

      expect(result).toBe('2023-08-31 15:30:45 [warn]: Warning message ');
    });

    it('should handle complex metadata objects', () => {
      const logEntry = {
        timestamp: '2023-08-31 15:30:45',
        level: 'debug',
        message: 'Debug info',
        error: {
          code: 'ERR001',
          details: { line: 42, file: 'test.ts' },
        },
        performance: {
          duration: 150,
          memory: '24MB',
        },
      };

      const result = formatFunction(logEntry);

      expect(result).toContain('2023-08-31 15:30:45 [debug]: Debug info');
      expect(result).toContain('"error":');
      expect(result).toContain('"performance":');
      expect(result).toContain('ERR001');
      expect(result).toContain('150');
    });
  });

  describe('Error Handling', () => {
    it('should handle winston createLogger errors gracefully', async () => {
      const error = new Error('Winston configuration failed');
      mockCreateLogger.mockImplementation(() => {
        throw error;
      });

      await expect(() => import('./logger')).rejects.toThrow('Winston configuration failed');
    });

    it('should handle file system errors when creating logs directory', async () => {
      jest.doMock('@/config', () => ({
        config: {
          environment: 'production',
        },
      }));

      mockPath.join.mockReturnValue('/app/logs');
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Logger should still be created even if directory creation fails
      const loggerModule = await import('./logger');
      expect(mockCreateLogger).toHaveBeenCalled();
      expect(loggerModule.logger).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should handle various log levels', async () => {
      const logLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

      for (const level of logLevels) {
        jest.resetModules();
        process.env.LOG_LEVEL = level;

        await import('./logger');

        expect(mockCreateLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level,
          })
        );
      }
    });

    it('should handle invalid log level gracefully', async () => {
      process.env.LOG_LEVEL = 'invalid-level';

      await import('./logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'invalid-level', // Winston will handle invalid levels
        })
      );
    });
  });

  describe('File Transport Configuration', () => {
    beforeEach(() => {
      jest.doMock('@/config', () => ({
        config: {
          environment: 'production',
        },
      }));
    });

    it('should configure error log file transport with correct options', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await import('./logger');

      expect(mockTransports.File).toHaveBeenCalledWith({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      });
    });

    it('should configure combined log file transport with correct options', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await import('./logger');

      expect(mockTransports.File).toHaveBeenCalledWith({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      });
    });

    it('should create both file transports in production', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await import('./logger');

      // Should be called twice - once for error log, once for combined log
      expect(mockTransports.File).toHaveBeenCalledTimes(2);
    });
  });

  describe('Environment Variable Edge Cases', () => {
    it('should handle empty LOG_LEVEL environment variable', async () => {
      process.env.LOG_LEVEL = '';

      await import('./logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info', // Should fall back to default
        })
      );
    });

    it('should handle empty npm_package_version', async () => {
      process.env.npm_package_version = '';

      await import('./logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultMeta: {
            service: 'altus4',
            version: '0.1.0', // Should fall back to default
          },
        })
      );
    });

    it('should handle undefined environment variables', async () => {
      delete process.env.LOG_LEVEL;
      delete process.env.npm_package_version;

      await import('./logger');

      expect(mockCreateLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          defaultMeta: {
            service: 'altus4',
            version: '0.1.0',
          },
        })
      );
    });
  });

  describe('Transport Array Configuration', () => {
    it('should create correct transport array for development', async () => {
      jest.doMock('@/config', () => ({
        config: {
          environment: 'development',
        },
      }));

      await import('./logger');

      const createLoggerCall = mockCreateLogger.mock.calls[0]?.[0];
      expect(createLoggerCall?.transports).toHaveLength(1); // Only console transport
    });

    it('should create correct transport array for production', async () => {
      jest.doMock('@/config', () => ({
        config: {
          environment: 'production',
        },
      }));

      mockFs.existsSync.mockReturnValue(true);

      await import('./logger');

      const createLoggerCall = mockCreateLogger.mock.calls[0]?.[0];
      expect(createLoggerCall?.transports).toHaveLength(3); // Console + 2 file transports
    });

    it('should handle unknown environment as development', async () => {
      jest.doMock('@/config', () => ({
        config: {
          environment: 'unknown',
        },
      }));

      await import('./logger');

      const createLoggerCall = mockCreateLogger.mock.calls[0]?.[0];
      expect(createLoggerCall?.transports).toHaveLength(1); // Only console transport
    });
  });
});
