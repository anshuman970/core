// src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { rateLimiter } from '@/middleware/rateLimiter';
import { authRoutes } from '@/routes/auth';
import { searchRoutes } from '@/routes/search';
import { databaseRoutes } from '@/routes/database';
import { analyticsRoutes } from '@/routes/analytics';

// Load environment variables
dotenv.config();

class AltusServer {
  private app: express.Application;
  private server: any;

  constructor () {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    }));

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging and rate limiting
    this.app.use(requestLogger);
    this.app.use(rateLimiter);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        uptime: process.uptime(),
      });
    });
  }

  private setupRoutes(): void {
    const apiV1 = express.Router();

    // Mount route modules
    apiV1.use('/auth', authRoutes);
    apiV1.use('/search', searchRoutes);
    apiV1.use('/databases', databaseRoutes);
    apiV1.use('/analytics', analyticsRoutes);

    // Mount API version
    this.app.use('/api/v1', apiV1);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    try {
      const port = config.port || 3000;

      this.server = createServer(this.app);

      this.server.listen(port, () => {
        logger.info(`🚀 Altus 4 Server started on port ${port}`);
        logger.info(`🌍 Environment: ${config.environment}`);
        logger.info(`📊 Health check: http://localhost:${port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('🛑 Graceful shutdown initiated...');

    if (this.server) {
      this.server.close(() => {
        logger.info('✅ HTTP server closed');
        process.exit(0);
      });
    }
  }
}

// Start the server
const altusServer = new AltusServer();
altusServer.start().catch((error) => {
  logger.error('Failed to start Altus 4:', error);
  process.exit(1);
});

export default altusServer;
