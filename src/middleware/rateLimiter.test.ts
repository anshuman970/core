import { NextFunction, Request, Response } from 'express';

// Mock dependencies first
jest.mock('ioredis');

const mockConsume = jest.fn();
const mockRateLimiterInstance = {
  consume: mockConsume,
};

jest.mock('rate-limiter-flexible', () => ({
  RateLimiterRedis: jest.fn().mockImplementation(() => mockRateLimiterInstance),
}));

jest.mock('@/config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
    },
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000,
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { rateLimiter } from './rateLimiter';

const mockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  ip: '127.0.0.1',
  path: '/api/v1/test',
  method: 'GET',
  get: jest.fn().mockImplementation((header: string) => {
    if (header === 'X-Request-ID') return 'test-request-id';
    if (header === 'User-Agent') return 'test-user-agent';
    return undefined;
  }),
  ...overrides,
} as any);

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('Rate Limiter Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
    next = mockNext;
    mockConsume.mockResolvedValue(undefined);
  });

  describe('General Rate Limiting', () => {
    it('should allow request when under rate limit', async () => {
      await rateLimiter(req as Request, res as Response, next);

      expect(mockConsume).toHaveBeenCalledWith('127.0.0.1');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle unknown IP address', async () => {
      req = mockRequest({ ip: undefined });

      await rateLimiter(req as Request, res as Response, next);

      expect(mockConsume).toHaveBeenCalledWith('unknown');
      expect(next).toHaveBeenCalled();
    });

    it('should block request when rate limit exceeded', async () => {
      const rateLimiterError = {
        remainingPoints: 0,
        msBeforeNext: 30000,
        totalHits: 101,
      };
      mockConsume.mockRejectedValue(rateLimiterError);

      await rateLimiter(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith({
        'Retry-After': 30,
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': expect.any(String),
      });
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          details: {
            retryAfter: 30,
            limit: 100,
            remaining: 0,
          },
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'test-request-id',
          version: '0.1.0',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle rate limit error with missing properties', async () => {
      mockConsume.mockRejectedValue({});

      await rateLimiter(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith({
        'Retry-After': 60, // Should use windowMs default when msBeforeNext is missing
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': expect.any(String),
      });
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should log rate limit exceeded warning', async () => {
      const rateLimiterError = {
        remainingPoints: 5,
        msBeforeNext: 15000,
        totalHits: 95,
      };
      mockConsume.mockRejectedValue(rateLimiterError);

      await rateLimiter(req as Request, res as Response, next);

      const { logger } = require('@/utils/logger');
      expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded:', {
        ip: '127.0.0.1',
        path: '/api/v1/test',
        method: 'GET',
        userId: undefined,
        remainingPoints: 5,
        totalHits: 95,
        msBeforeNext: 15000,
        userAgent: 'test-user-agent',
      });
    });
  });

  describe('Authentication Endpoint Rate Limiting', () => {
    it('should use auth rate limiter for auth endpoints', async () => {
      req = mockRequest({ path: '/api/v1/auth/login' });

      await rateLimiter(req as Request, res as Response, next);

      expect(mockConsume).toHaveBeenCalledWith('127.0.0.1');
      expect(next).toHaveBeenCalled();
    });

    it('should block auth requests when auth rate limit exceeded', async () => {
      req = mockRequest({ path: '/api/v1/auth/register' });
      const rateLimiterError = {
        remainingPoints: 0,
        msBeforeNext: 900000, // 15 minutes
        totalHits: 6,
      };
      mockConsume.mockRejectedValue(rateLimiterError);

      await rateLimiter(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith({
        'Retry-After': 900,
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': expect.any(String),
      });
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Search Endpoint Rate Limiting', () => {
    it('should use search rate limiter for authenticated search requests', async () => {
      req = mockRequest({ path: '/api/v1/search/query' });
      (req as any).user = { id: 'user-123' };

      await rateLimiter(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fall back to general rate limiter for unauthenticated search requests', async () => {
      req = mockRequest({ path: '/api/v1/search/query' });
      // No user object

      await rateLimiter(req as Request, res as Response, next);

      expect(mockConsume).toHaveBeenCalledWith('127.0.0.1');
      expect(next).toHaveBeenCalled();
    });

    it('should handle search rate limit exceeded for authenticated users', async () => {
      req = mockRequest({ path: '/api/v1/search/query' });
      (req as any).user = { id: 'user-123' };
      mockConsume.mockRejectedValue({
        remainingPoints: 50,
        msBeforeNext: 300000, // 5 minutes
        totalHits: 1000,
      });

      await rateLimiter(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(429);
      const { logger } = require('@/utils/logger');
      expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded:', {
        ip: '127.0.0.1',
        path: '/api/v1/search/query',
        method: 'GET',
        userId: 'user-123',
        remainingPoints: 50,
        totalHits: 1000,
        msBeforeNext: 300000,
        userAgent: 'test-user-agent',
      });
    });
  });

  describe('Error Response Format', () => {
    it('should return proper API response format', async () => {
      mockConsume.mockRejectedValue({
        remainingPoints: 10,
        msBeforeNext: 45000,
        totalHits: 90,
      });

      await rateLimiter(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          details: {
            retryAfter: 45,
            limit: 100,
            remaining: 10,
          },
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'test-request-id',
          version: '0.1.0',
        },
      });
    });

    it('should handle missing request ID', async () => {
      req.get = jest.fn().mockReturnValue(undefined);
      mockConsume.mockRejectedValue({});

      await rateLimiter(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          details: {
            retryAfter: 60,
            limit: 100,
            remaining: 0,
          },
        },
        meta: {
          timestamp: expect.any(Date),
          requestId: 'unknown',
          version: '0.1.0',
        },
      });
    });
  });

  describe('Headers Management', () => {
    it('should set correct rate limit headers', async () => {
      const rateLimiterError = {
        remainingPoints: 25,
        msBeforeNext: 120000, // 2 minutes
        totalHits: 75,
      };
      mockConsume.mockRejectedValue(rateLimiterError);

      await rateLimiter(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith({
        'Retry-After': 120,
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '25',
        'X-RateLimit-Reset': expect.any(String),
      });
    });

    it('should ensure remaining points never go below zero', async () => {
      const rateLimiterError = {
        remainingPoints: -5, // Negative remaining points
        msBeforeNext: 60000,
        totalHits: 105,
      };
      mockConsume.mockRejectedValue(rateLimiterError);

      await rateLimiter(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith({
        'Retry-After': 60,
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0', // Should be 0, not -5
        'X-RateLimit-Reset': expect.any(String),
      });
    });

    it('should calculate correct retry after seconds', async () => {
      const rateLimiterError = {
        remainingPoints: 0,
        msBeforeNext: 90500, // 90.5 seconds
        totalHits: 100,
      };
      mockConsume.mockRejectedValue(rateLimiterError);

      await rateLimiter(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith({
        'Retry-After': 91, // Rounded up
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': expect.any(String),
      });
    });
  });
});