import { config } from '@/config';
import type { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import type { NextFunction, Request, Response } from 'express';

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
  // eslint-disable-next-line no-unused-vars
  _next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';

  if (error instanceof AppError) {
    const { statusCode: errorStatus, code: errorCode, message: errorMessage } = error;
    statusCode = errorStatus;
    code = errorCode;
    message = errorMessage;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    const { message: errorMessage } = error;
    message = errorMessage;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_DATA';
    message = 'Invalid data format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired';
  } else if (error.message.includes('ER_NO_SUCH_TABLE')) {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'Database table not found';
  } else if (error.message.includes('ECONNREFUSED')) {
    statusCode = 500;
    code = 'CONNECTION_ERROR';
    message = 'Database connection refused';
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
    statusCode,
    code,
  });

  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(config.environment === 'development' && {
        stack: error.stack,
        details: error.message,
      }),
    },
    meta: {
      timestamp: new Date(),
      requestId: req.get('X-Request-ID') || 'unknown',
      version: process.env.npm_package_version || '0.1.0',
    },
  };

  res.status(statusCode).json(response);
};
