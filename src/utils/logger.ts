/**
 * Logger Utility
 *
 * Provides a configured Winston logger for application-wide logging.
 * Supports console logging for development and file logging for production.
 * Automatically creates logs directory if needed.
 *
 * Usage:
 *   - Use logger.info, logger.error, etc. for structured logging
 */
import { config } from '@/config';
import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Winston logger instance configured for Altus4 application.
 * Includes timestamp, error stack, JSON formatting, and colorization.
 * Logs to console in development and to files in production.
 */
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.colorize({ all: true })
  ),
  defaultMeta: {
    service: 'altus4',
    version: process.env.npm_package_version || '0.1.0',
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaString}`;
        })
      ),
    }),

    // File transport for production
    ...(config.environment === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

// Create logs directory if it doesn't exist in production
if (config.environment === 'production') {
  const fs = require('fs');
  const path = require('path');

  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}
