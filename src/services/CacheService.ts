import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import type { SearchAnalytics } from '@/types';

export class CacheService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      lazyConnect: true,
    });

    this.setupEventHandlers();
    this.connect();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      logger.info('Connected to Redis cache');
    });

    this.redis.on('disconnect', () => {
      this.isConnected = false;
      logger.warn('Disconnected from Redis cache');
    });

    this.redis.on('error', error => {
      logger.error('Redis error:', error);
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      logger.info('Reconnecting to Redis cache...');
    });
  }

  private async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
    }
  }

  /**
   * Check if cache is available
   */
  public isAvailable(): boolean {
    return this.isConnected;
  }

  /**
   * Get value from cache
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  public async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete key from cache
   */
  public async del(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Set value with expiration time
   */
  public async setex(key: string, seconds: number, value: any): Promise<void> {
    return this.set(key, value, seconds);
  }

  /**
   * Increment a numeric value
   */
  public async incr(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      return await this.redis.incr(key);
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Add item to sorted set
   */
  public async zadd(key: string, score: number, member: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.redis.zadd(key, score, member);
    } catch (error) {
      logger.error(`Cache zadd error for key ${key}:`, error);
    }
  }

  /**
   * Get top N items from sorted set
   */
  public async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      return await this.redis.zrevrange(key, start, stop);
    } catch (error) {
      logger.error(`Cache zrevrange error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Get popular search queries
   */
  public async getPopularQueries(partialQuery: string): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const cacheKey = `popular_queries:${partialQuery.toLowerCase()}`;
      const cached = await this.get<string[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // If not cached, return empty array - would be populated by analytics
      return [];
    } catch (error) {
      logger.error('Failed to get popular queries:', error);
      return [];
    }
  }

  /**
   * Get top queries for a user in specified time period
   */
  public async getTopQueries(userId: string, days: number): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const cacheKey = `top_queries:${userId}:${days}d`;
      const cached = await this.get<string[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Would fetch from analytics database in real implementation
      return [];
    } catch (error) {
      logger.error(`Failed to get top queries for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get query volume for user
   */
  public async getQueryVolume(userId: string, days: number): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const cacheKey = `query_volume:${userId}:${days}d`;
      const cached = await this.get<number>(cacheKey);

      if (cached !== null) {
        return cached;
      }

      return 0;
    } catch (error) {
      logger.error(`Failed to get query volume for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get average response time for user
   */
  public async getAverageResponseTime(userId: string, days: number): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const cacheKey = `avg_response_time:${userId}:${days}d`;
      const cached = await this.get<number>(cacheKey);

      if (cached !== null) {
        return cached;
      }

      return 0;
    } catch (error) {
      logger.error(`Failed to get avg response time for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get popular categories for user
   */
  public async getPopularCategories(userId: string, days: number): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const cacheKey = `popular_categories:${userId}:${days}d`;
      const cached = await this.get<string[]>(cacheKey);

      if (cached) {
        return cached;
      }

      return [];
    } catch (error) {
      logger.error(`Failed to get popular categories for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Log search analytics (would typically write to database too)
   */
  public async logSearchAnalytics(analytics: {
    userId: string;
    query: string;
    databases?: string[];
    resultCount: number;
    executionTime: number;
    searchMode?: string;
    timestamp: Date;
  }): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      // Increment query counter
      const queryKey = `query_count:${analytics.userId}`;
      await this.incr(queryKey);

      // Add to recent queries
      const recentKey = `recent_queries:${analytics.userId}`;
      await this.zadd(recentKey, analytics.timestamp.getTime(), analytics.query);

      // Cache query for popularity tracking
      const popularKey = `query_popularity:${analytics.query.toLowerCase()}`;
      await this.incr(popularKey);

      // Log execution time for performance tracking
      const perfKey = `query_perf:${analytics.userId}:${new Date().toDateString()}`;
      await this.zadd(perfKey, analytics.executionTime, analytics.query);
    } catch (error) {
      logger.error('Failed to log search analytics:', error);
    }
  }

  /**
   * Get search history for user
   */
  public async getSearchHistory(
    userId: string,
    limit: number,
    offset: number
  ): Promise<SearchAnalytics[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const cacheKey = `search_history:${userId}:${limit}:${offset}`;
      const cached = await this.get<SearchAnalytics[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Would fetch from database in real implementation
      return [];
    } catch (error) {
      logger.error(`Failed to get search history for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Cache user session data
   */
  public async setUserSession(userId: string, sessionData: any, ttl: number = 3600): Promise<void> {
    const sessionKey = `session:${userId}`;
    await this.setex(sessionKey, ttl, sessionData);
  }

  /**
   * Get user session data
   */
  public async getUserSession(userId: string): Promise<any> {
    const sessionKey = `session:${userId}`;
    return await this.get(sessionKey);
  }

  /**
   * Clear user session
   */
  public async clearUserSession(userId: string): Promise<void> {
    const sessionKey = `session:${userId}`;
    await this.del(sessionKey);
  }

  /**
   * Set rate limit for user/IP
   */
  public async setRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return true; // Allow request if cache unavailable
    }

    try {
      const rateLimitKey = `rate_limit:${key}`;
      const current = await this.incr(rateLimitKey);

      if (current === 1) {
        await this.redis.expire(rateLimitKey, windowSeconds);
      }

      return current <= limit;
    } catch (error) {
      logger.error(`Rate limit check error for key ${key}:`, error);
      return true; // Allow request on error
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from Redis cache');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Flush all cached data (use with caution)
   */
  public async flushAll(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      await this.redis.flushall();
      logger.info('Cache flushed successfully');
    } catch (error) {
      logger.error('Failed to flush cache:', error);
    }
  }
}
