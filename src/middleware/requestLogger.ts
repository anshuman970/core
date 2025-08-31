import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Add request ID to headers
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Skip logging for health checks and static assets
  const skipPaths = ['/health', '/favicon.ico', '/robots.txt'];
  const shouldSkip = skipPaths.some(path => req.url.includes(path));

  if (!shouldSkip) {
    // Log request
    logger.info('Incoming request:', {
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      contentLength: req.get('Content-Length'),
      contentType: req.get('Content-Type'),
      userId: (req as any).user?.id,
    });
  }

  // Override res.json to log response
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;

  res.json = function (body: any) {
    if (!shouldSkip) {
      const duration = Date.now() - startTime;
      logger.info('Outgoing response:', {
        requestId,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: JSON.stringify(body).length,
        success: body?.success,
        errorCode: body?.error?.code,
      });
    }

    return originalJson.call(this, body);
  };

  res.send = function (body: any) {
    if (!shouldSkip) {
      const duration = Date.now() - startTime;
      logger.info('Outgoing response (send):', {
        requestId,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: typeof body === 'string' ? body.length : JSON.stringify(body).length,
      });
    }

    return originalSend.call(this, body);
  };

  res.end = function (chunk?: any, encoding?: any) {
    if (!shouldSkip) {
      const duration = Date.now() - startTime;
      logger.info('Request completed:', {
        requestId,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    }

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};
