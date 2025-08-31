import type { NextFunction, Request, Response } from 'express';

const mockUuid = 'test-request-id-123';

// Mock dependencies first
jest.mock('uuid', () => ({
  v4: jest.fn(() => mockUuid),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { requestLogger } from './requestLogger';

const mockRequest = (overrides: Partial<Request> = {}): Partial<Request> =>
  ({
    method: 'GET',
    url: '/api/v1/test',
    ip: '127.0.0.1',
    connection: { remoteAddress: '192.168.1.1' } as any,
    headers: {},
    get: jest.fn().mockImplementation((header: string) => {
      if (header === 'User-Agent') {
        return 'test-user-agent';
      }
      if (header === 'Content-Length') {
        return '100';
      }
      if (header === 'Content-Type') {
        return 'application/json';
      }
      return undefined;
    }),
    ...overrides,
  }) as any;

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    json: jest.fn(),
    send: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn(),
    statusCode: 200,
  };

  // Mock the original methods
  (res as any).originalJson = jest.fn();
  (res as any).originalSend = jest.fn();
  (res as any).originalEnd = jest.fn();

  return res;
};

const mockNext: NextFunction = jest.fn();

describe('Request Logger Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
    next = mockNext;

    // Mock Date.now for consistent timing tests
    originalDateNow = Date.now;
    Date.now = jest.fn().mockReturnValue(1000000);
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('Request ID Generation', () => {
    it('should generate and set request ID', () => {
      requestLogger(req as Request, res as Response, next);

      expect(req.headers!['x-request-id']).toBe(mockUuid);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', mockUuid);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Request Logging', () => {
    it('should log incoming request metadata', () => {
      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Incoming request:', {
        requestId: mockUuid,
        method: 'GET',
        url: '/api/v1/test',
        ip: '127.0.0.1',
        userAgent: 'test-user-agent',
        contentLength: '100',
        contentType: 'application/json',
        userId: undefined,
      });
    });

    it('should use connection remote address when IP is not available', () => {
      req = mockRequest({ ip: undefined });

      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Incoming request:', {
        requestId: mockUuid,
        method: 'GET',
        url: '/api/v1/test',
        ip: '192.168.1.1',
        userAgent: 'test-user-agent',
        contentLength: '100',
        contentType: 'application/json',
        userId: undefined,
      });
    });

    it('should include user ID when user is authenticated', () => {
      (req as any).user = { id: 'user-123' };

      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Incoming request:', {
        requestId: mockUuid,
        method: 'GET',
        url: '/api/v1/test',
        ip: '127.0.0.1',
        userAgent: 'test-user-agent',
        contentLength: '100',
        contentType: 'application/json',
        userId: 'user-123',
      });
    });

    it('should handle missing headers gracefully', () => {
      req.get = jest.fn().mockReturnValue(undefined);

      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Incoming request:', {
        requestId: mockUuid,
        method: 'GET',
        url: '/api/v1/test',
        ip: '127.0.0.1',
        userAgent: undefined,
        contentLength: undefined,
        contentType: undefined,
        userId: undefined,
      });
    });
  });

  describe('Skip Path Logic', () => {
    it('should skip logging for health check endpoint', () => {
      req.url = '/health';

      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip logging for favicon.ico', () => {
      req.url = '/favicon.ico';

      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip logging for robots.txt', () => {
      req.url = '/robots.txt';

      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip logging for paths containing skip patterns', () => {
      req.url = '/api/v1/health/status';

      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should log for regular endpoints', () => {
      req.url = '/api/v1/search';

      requestLogger(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Incoming request:', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Response JSON Logging', () => {
    it('should log outgoing JSON response', () => {
      const responseBody = { success: true, data: 'test' };

      requestLogger(req as Request, res as Response, next);

      // Simulate response after some time
      Date.now = jest.fn().mockReturnValue(1000150); // 150ms later

      // Call the overridden json method
      res.json!(responseBody);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Outgoing response:', {
        requestId: mockUuid,
        statusCode: 200,
        duration: '150ms',
        contentLength: JSON.stringify(responseBody).length,
        success: true,
        errorCode: undefined,
      });
    });

    it('should log error response with error code', () => {
      const responseBody = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };

      requestLogger(req as Request, res as Response, next);
      Date.now = jest.fn().mockReturnValue(1000075); // 75ms later

      res.json!(responseBody);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Outgoing response:', {
        requestId: mockUuid,
        statusCode: 200,
        duration: '75ms',
        contentLength: JSON.stringify(responseBody).length,
        success: false,
        errorCode: 'VALIDATION_ERROR',
      });
    });

    it('should not log JSON response for skipped paths', () => {
      req.url = '/health';
      const responseBody = { status: 'ok' };

      requestLogger(req as Request, res as Response, next);
      res.json!(responseBody);

      const { logger } = require('@/utils/logger');
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('Response Send Logging', () => {
    it('should log outgoing send response with string body', () => {
      const responseBody = 'Hello World';

      requestLogger(req as Request, res as Response, next);
      Date.now = jest.fn().mockReturnValue(1000200); // 200ms later

      res.send!(responseBody);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Outgoing response (send):', {
        requestId: mockUuid,
        statusCode: 200,
        duration: '200ms',
        contentLength: responseBody.length,
      });
    });

    it('should log outgoing send response with object body', () => {
      const responseBody = { message: 'Hello World' };

      requestLogger(req as Request, res as Response, next);
      Date.now = jest.fn().mockReturnValue(1000100); // 100ms later

      res.send!(responseBody);

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Outgoing response (send):', {
        requestId: mockUuid,
        statusCode: 200,
        duration: '100ms',
        contentLength: JSON.stringify(responseBody).length,
      });
    });

    it('should not log send response for skipped paths', () => {
      req.url = '/favicon.ico';

      requestLogger(req as Request, res as Response, next);
      res.send!('favicon content');

      const { logger } = require('@/utils/logger');
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('Response End Logging', () => {
    it('should log request completion', () => {
      requestLogger(req as Request, res as Response, next);
      Date.now = jest.fn().mockReturnValue(1000300); // 300ms later

      res.end!();

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Request completed:', {
        requestId: mockUuid,
        statusCode: 200,
        duration: '300ms',
      });
    });

    it('should log request completion with chunk and encoding', () => {
      requestLogger(req as Request, res as Response, next);
      Date.now = jest.fn().mockReturnValue(1000050); // 50ms later

      res.end!('response chunk', 'utf8');

      const { logger } = require('@/utils/logger');
      expect(logger.info).toHaveBeenCalledWith('Request completed:', {
        requestId: mockUuid,
        statusCode: 200,
        duration: '50ms',
      });
    });

    it('should not log request completion for skipped paths', () => {
      req.url = '/robots.txt';

      requestLogger(req as Request, res as Response, next);
      res.end!();

      const { logger } = require('@/utils/logger');
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('Method Override Behavior', () => {
    it('should preserve original method functionality', () => {
      const originalJson = jest.fn();
      const originalSend = jest.fn();
      const originalEnd = jest.fn();

      res.json = originalJson;
      res.send = originalSend;
      res.end = originalEnd;

      requestLogger(req as Request, res as Response, next);

      const responseBody = { test: 'data' };

      // Test json method
      res.json!(responseBody);
      expect(originalJson).toHaveBeenCalledWith(responseBody);

      // Test send method
      res.send!('test data');
      expect(originalSend).toHaveBeenCalledWith('test data');

      // Test end method
      res.end!('chunk', 'utf8');
      expect(originalEnd).toHaveBeenCalledWith('chunk', 'utf8');
    });
  });

  describe('Timing Calculations', () => {
    it('should calculate duration correctly for different response methods', () => {
      requestLogger(req as Request, res as Response, next);

      // Test different timing scenarios
      const testCases = [
        { delay: 50, expected: '50ms' },
        { delay: 1000, expected: '1000ms' },
        { delay: 0, expected: '0ms' },
      ];

      testCases.forEach(({ delay, expected }) => {
        jest.clearAllMocks();
        Date.now = jest.fn().mockReturnValue(1000000 + delay);

        res.json!({ test: 'data' });

        const { logger } = require('@/utils/logger');
        expect(logger.info).toHaveBeenCalledWith(
          'Outgoing response:',
          expect.objectContaining({ duration: expected })
        );
      });
    });
  });

  describe('Status Code Handling', () => {
    it('should log different status codes correctly', () => {
      const statusCodes = [200, 201, 400, 401, 404, 500];

      statusCodes.forEach(statusCode => {
        jest.clearAllMocks();
        res.statusCode = statusCode;

        requestLogger(req as Request, res as Response, next);
        res.json!({ status: statusCode });

        const { logger } = require('@/utils/logger');
        expect(logger.info).toHaveBeenCalledWith(
          'Outgoing response:',
          expect.objectContaining({ statusCode })
        );
      });
    });
  });
});
