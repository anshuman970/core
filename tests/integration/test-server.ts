/**
 * Test Server Setup
 *
 * Creates and manages a test Express server instance for integration tests
 */

import express from 'express';
import request from 'supertest';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';

// Import middleware
import { requestLogger } from '@/middleware/requestLogger';
import { errorHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimiter';

// Import routes
import { authRoutes } from '@/routes/auth';
import { databaseRoutes } from '@/routes/database';
import { searchRoutes } from '@/routes/search';
import { analyticsRoutes } from '@/routes/analytics';

// Import test utilities
import { testDatabase } from '../test-database';
import { TestHelpers } from '../utils/test-helpers';

export class TestServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number;

  constructor(port: number = 0) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Basic middleware
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: true,
        credentials: true,
      })
    );
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware (disable rate limiting in tests)
    this.app.use(requestLogger);

    // Don't use rate limiter in tests
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(rateLimiter);
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API routes
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/databases', databaseRoutes);
    this.app.use('/api/v1/search', searchRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.originalUrl} not found`,
        },
      });
    });

    // Error handler
    this.app.use(errorHandler);
  }

  /**
   * Start the test server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          const address = this.server?.address();
          if (address && typeof address === 'object') {
            this.port = address.port;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the test server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close(error => {
          if (error) {
            reject(error);
          } else {
            this.server = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the Express application
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get the server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get base URL for the server
   */
  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Create a SuperTest instance for making requests
   */
  request() {
    return request(this.app);
  }
}

// Global test server instance
let globalTestServer: TestServer | null = null;

/**
 * Get or create the global test server instance
 */
export function getTestServer(): TestServer {
  if (!globalTestServer) {
    globalTestServer = new TestServer();
  }
  return globalTestServer;
}

/**
 * Setup function for integration tests
 */
export async function setupTestEnvironment(): Promise<{
  server: TestServer;
  database: typeof testDatabase;
  helpers: typeof TestHelpers;
}> {
  const server = getTestServer();

  // Start server if not already running
  if (server.getPort() === 0) {
    await server.start();
  }

  // Setup test database
  await testDatabase.connect();
  await testDatabase.setupSchema();

  return {
    server,
    database: testDatabase,
    helpers: TestHelpers,
  };
}

/**
 * Cleanup function for integration tests
 */
export async function teardownTestEnvironment(): Promise<void> {
  // Clean up test data
  await testDatabase.cleanup();

  // Close database connections
  await testDatabase.close();
  await TestHelpers.closeConnections();

  // Stop server
  if (globalTestServer) {
    await globalTestServer.stop();
    globalTestServer = null;
  }
}

/**
 * Create an authenticated request helper
 */
export function createAuthenticatedRequest(server: TestServer, token: string) {
  return {
    get: (url: string) => server.request().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => server.request().post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => server.request().put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => server.request().delete(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => server.request().patch(url).set('Authorization', `Bearer ${token}`),
  };
}
