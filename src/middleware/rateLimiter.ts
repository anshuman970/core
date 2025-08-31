/**
 * Rate Limiting Middleware
 *
 * Provides Express middleware for request rate limiting using Redis and rate-limiter-flexible.
 * Configures different rate limiters for general, authentication, and search endpoints.
 *
 * Usage:
 *   - Use rateLimiter to protect endpoints from abuse and excessive requests
 */
import { config } from '@/config';
import type { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';

// Create Redis client for rate limiting
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  lazyConnect: true,
});

// Redis connection event handlers for logging
redis.on('error', error => {
  logger.error('Rate limiter Redis error:', error);
});

redis.on('connect', () => {
  logger.info('Rate limiter Redis connected');
});

// General rate limiter instance
const rateLimiterInstance = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_rl',
  points: config.rateLimit.maxRequests, // Number of requests
  duration: Math.floor(config.rateLimit.windowMs / 1000), // Per duration in seconds
  blockDuration: Math.floor(config.rateLimit.windowMs / 1000), // Block for duration in seconds
});

// More strict rate limiter for authentication endpoints
const authRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_auth_rl',
  points: 5, // 5 attempts
  duration: 300, // Per 5 minutes
  blockDuration: 900, // Block for 15 minutes
});

// Search-specific rate limiter (more generous for authenticated users)
const searchRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_search_rl',
  points: 1000, // 1000 searches
  duration: 3600, // Per hour
  blockDuration: 300, // Block for 5 minutes
});

/**
 * Middleware to apply rate limiting based on endpoint type.
 * Responds with 429 if rate limit is exceeded.
 */
export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = req.ip || 'unknown';

    // Choose appropriate rate limiter based on endpoint
    let currentRateLimiter = rateLimiterInstance;

    if (req.path.includes('/auth/')) {
      currentRateLimiter = authRateLimiter;
    } else if (req.path.includes('/search/') && (req as any).user) {
      // Use user ID for authenticated search requests
      const userKey = (req as any).user.id;
      currentRateLimiter = searchRateLimiter;

      try {
        await searchRateLimiter.consume(userKey);
        next();
        return;
      } catch (_rateLimiterRes) {
        // Fall through to handle rate limit exceeded
      }
    }

    await currentRateLimiter.consume(key);
    next();
  } catch (rateLimiterRes: any) {
    const remainingPoints = rateLimiterRes?.remainingPoints || 0;
    const msBeforeNext = rateLimiterRes?.msBeforeNext || config.rateLimit.windowMs;
    const totalHits = rateLimiterRes?.totalHits || 0;

    // Set rate limit headers
    res.set({
      'Retry-After': Math.round(msBeforeNext / 1000) || 1,
      'X-RateLimit-Limit': config.rateLimit.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, remainingPoints).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
    });

    logger.warn('Rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      remainingPoints,
      totalHits,
      msBeforeNext,
      userAgent: req.get('User-Agent'),
    });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        details: {
          retryAfter: Math.round(msBeforeNext / 1000),
          limit: config.rateLimit.maxRequests,
          remaining: Math.max(0, remainingPoints),
        },
      },
      meta: {
        timestamp: new Date(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: process.env.npm_package_version || '0.1.0',
      },
    };

    res.status(429).json(response);
  }
};

// Export the rate limiter instance for testing
export { authRateLimiter, rateLimiterInstance, searchRateLimiter };

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await redis.quit();
    logger.info('Rate limiter Redis connection closed');
  } catch (error) {
    logger.error('Error closing rate limiter Redis connection:', error);
  }
});

process.on('SIGTERM', async () => {
  try {
    await redis.quit();
    logger.info('Rate limiter Redis connection closed');
  } catch (error) {
    logger.error('Error closing rate limiter Redis connection:', error);
  }
});
