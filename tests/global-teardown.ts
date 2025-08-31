import { createConnection } from 'mysql2/promise';
import Redis from 'ioredis';
import { logger } from '@/utils/logger';

export default async function globalTeardown() {
  logger.info('Tearing down test environment...');

  try {
    // Clean up test database
    if (process.env.NODE_ENV === 'test' && process.env.DB_DATABASE) {
      const connection = await createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'root',
      });

      // Only drop if it's clearly a test database
      if (process.env.DB_DATABASE.includes('test')) {
        await connection.execute(`DROP DATABASE IF EXISTS \`${process.env.DB_DATABASE}\``);
        logger.info(`Test database ${process.env.DB_DATABASE} cleaned up`);
      }

      await connection.end();
    }

    // Clean up test Redis database
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_TEST_DB || '1'),
      lazyConnect: true,
    });

    await redis.connect();
    await redis.flushdb();
    await redis.disconnect();
    logger.info('Test Redis database cleaned up');
  } catch (error) {
    logger.error('Test teardown failed:', error);
  }
}
