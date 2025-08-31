/**
 * Authentication Middleware
 *
 * Provides Express middleware for JWT authentication and role-based access control.
 * Adds user information to the request object if authentication succeeds.
 *
 * Usage:
 *   - Use authenticate to protect routes and extract user info from JWT
 *   - Use requireRole to restrict access based on user role
 */
import { config } from '@/config';
import type { ApiResponse } from '@/types';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Extends Express Request to include authenticated user info.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
  };
}

/**
 * Middleware to authenticate requests using JWT.
 * Adds user info to req.user if token is valid.
 * Responds with 401 if token is missing or invalid.
 */
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
  } catch (_error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    } as ApiResponse);
  }
};

/**
 * Middleware to require a specific user role for access.
 * Responds with 401 if user is not authenticated or role does not match.
 *
 * @param role - Required user role ('admin' or 'user')
 */
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
