import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { ApiResponse } from '@/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header missing or invalid',
        },
      } as ApiResponse);
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    } as ApiResponse);
  }
};

export const requireRole = (role: 'admin' | 'user') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      } as ApiResponse);
      return;
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `${role} role required`,
        },
      } as ApiResponse);
      return;
    }

    next();
  };
};

// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { ApiResponse } from '@/types';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor (message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_DATA';
    message = 'Invalid data format';
  }

  // Log error
  logger.error('Request error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(config.environment === 'development' && { stack: error.stack }),
    },
    meta: {
      timestamp: new Date(),
      requestId: req.get('X-Request-ID') || 'unknown',
      version: process.env.npm_package_version || '0.1.0',
    },
  };

  res.status(statusCode).json(response);
};

// src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Add request ID to headers
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log request
  logger.info('Incoming request:', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (body: any) {
    const duration = Date.now() - startTime;

    logger.info('Outgoing response:', {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: JSON.stringify(body).length,
    });

    return originalJson.call(this, body);
  };

  next();
};

// src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { ApiResponse } from '@/types';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'altus4_rl',
  points: config.rateLimit.maxRequests,
  duration: Math.floor(config.rateLimit.windowMs / 1000),
  blockDuration: Math.floor(config.rateLimit.windowMs / 1000),
});

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = req.ip || 'unknown';
    await rateLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    const remainingPoints = rateLimiterRes?.remainingPoints || 0;
    const msBeforeNext = rateLimiterRes?.msBeforeNext || config.rateLimit.windowMs;

    res.set({
      'Retry-After': Math.round(msBeforeNext / 1000) || 1,
      'X-RateLimit-Limit': config.rateLimit.maxRequests,
      'X-RateLimit-Remaining': remainingPoints,
      'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext),
    });

    logger.warn('Rate limit exceeded:', {
      ip: req.ip,
      remainingPoints,
      msBeforeNext,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    } as ApiResponse);
  }
};

// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiResponse } from '@/types';

export const validateRequest = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        };
        res.status(400).json(response);
      } else {
        next(error);
      }
    }
  };
};
