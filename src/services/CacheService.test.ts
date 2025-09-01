import { config } from '@/config';
import { logger } from '@/utils/logger';
import Redis from 'ioredis';
import { CacheService } from './CacheService';

// Explicitly unmock the CacheService itself
jest.unmock('./CacheService');

// Mock dependencies
jest.mock('@/config');
jest.mock('@/utils/logger');
jest.mock('ioredis');

const mockConfig = config as jest.Mocked<typeof config>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const MockRedis = Redis as jest.MockedClass<typeof Redis>;

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedisInstance: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis instance
    mockRedisInstance = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      zadd: jest.fn(),
      zrevrange: jest.fn(),
      expire: jest.fn(),
      flushall: jest.fn(),
    } as any;

    MockRedis.mockImplementation(() => mockRedisInstance);

    // Mock config
    mockConfig.redis = {
      host: 'localhost',
      port: 6379,
      password: undefined,
    };
  });

  describe('constructor', () => {
    it('should initialize Redis client and set up event handlers', () => {
      // Act
      cacheService = new CacheService();

      // Assert
      expect(MockRedis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        lazyConnect: true,
      });

      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockRedisInstance.connect).toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    beforeEach(() => {
      cacheService = new CacheService();
    });

    it('should handle connect event', () => {
      // Get the connect event handler
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      // Act
      connectHandler?.();

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('Connected to Redis cache');
    });

    it('should handle disconnect event', () => {
      // Get the disconnect event handler
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      // Act
      disconnectHandler?.();

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith('Disconnected from Redis cache');
    });

    it('should handle error event', () => {
      // Get the error event handler
      const errorHandler = mockRedisInstance.on.mock.calls.find(call => call[0] === 'error')?.[1];
      const testError = new Error('Redis connection error');

      // Act
      errorHandler?.(testError);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith('Redis error:', testError);
    });

    it('should handle reconnecting event', () => {
      // Get the reconnecting event handler
      const reconnectingHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'reconnecting'
      )?.[1];

      // Act
      reconnectingHandler?.();

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('Reconnecting to Redis cache...');
    });
  });

  describe('isAvailable', () => {
    it('should return connection status', () => {
      // Arrange
      cacheService = new CacheService();

      // Simulate connect event
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();

      // Act
      const isAvailable = cacheService.isAvailable();

      // Assert
      expect(isAvailable).toBe(true);
    });

    it('should return false when disconnected', () => {
      // Arrange
      cacheService = new CacheService();

      // Simulate disconnect event
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      const isAvailable = cacheService.isAvailable();

      // Assert
      expect(isAvailable).toBe(false);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should get and parse value from cache', async () => {
      // Arrange
      const testData = { name: 'test', value: 123 };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(testData));

      // Act
      const result = await cacheService.get<typeof testData>('test-key');

      // Assert
      expect(result).toEqual(testData);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      // Arrange
      mockRedisInstance.get.mockResolvedValue(null);

      // Act
      const result = await cacheService.get('non-existent-key');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      const result = await cacheService.get('test-key');

      // Assert
      expect(result).toBeNull();
      expect(mockRedisInstance.get).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      mockRedisInstance.get.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await cacheService.get('test-key');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cache get error for key test-key:',
        expect.any(Error)
      );
    });
  });

  describe('set', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should set value in cache without TTL', async () => {
      // Arrange
      const testData = { name: 'test', value: 123 };

      // Act
      await cacheService.set('test-key', testData);

      // Assert
      expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
    });

    it('should set value in cache with TTL', async () => {
      // Arrange
      const testData = { name: 'test', value: 123 };

      // Act
      await cacheService.set('test-key', testData, 300);

      // Assert
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        300,
        JSON.stringify(testData)
      );
    });

    it('should do nothing when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      await cacheService.set('test-key', 'test-value');

      // Assert
      expect(mockRedisInstance.set).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      mockRedisInstance.set.mockRejectedValue(new Error('Redis error'));

      // Act
      await cacheService.set('test-key', 'test-value');

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cache set error for key test-key:',
        expect.any(Error)
      );
    });
  });

  describe('del', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should delete key from cache', async () => {
      // Act
      await cacheService.del('test-key');

      // Assert
      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
    });

    it('should do nothing when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      await cacheService.del('test-key');

      // Assert
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });
  });

  describe('incr', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should increment numeric value', async () => {
      // Arrange
      mockRedisInstance.incr.mockResolvedValue(5);

      // Act
      const result = await cacheService.incr('test-counter');

      // Assert
      expect(result).toBe(5);
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('test-counter');
    });

    it('should return 0 when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      const result = await cacheService.incr('test-counter');

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('zadd', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should add item to sorted set', async () => {
      // Act
      await cacheService.zadd('test-set', 10, 'item1');

      // Assert
      expect(mockRedisInstance.zadd).toHaveBeenCalledWith('test-set', 10, 'item1');
    });

    it('should do nothing when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      await cacheService.zadd('test-set', 10, 'item1');

      // Assert
      expect(mockRedisInstance.zadd).not.toHaveBeenCalled();
    });
  });

  describe('zrevrange', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should get top N items from sorted set', async () => {
      // Arrange
      mockRedisInstance.zrevrange.mockResolvedValue(['item1', 'item2', 'item3']);

      // Act
      const result = await cacheService.zrevrange('test-set', 0, 2);

      // Assert
      expect(result).toEqual(['item1', 'item2', 'item3']);
      expect(mockRedisInstance.zrevrange).toHaveBeenCalledWith('test-set', 0, 2);
    });

    it('should return empty array when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      const result = await cacheService.zrevrange('test-set', 0, 2);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getPopularQueries', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should get popular queries from cache', async () => {
      // Arrange
      const popularQueries = ['database', 'mysql', 'optimization'];
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(popularQueries));

      // Act
      const result = await cacheService.getPopularQueries('dat');

      // Assert
      expect(result).toEqual(popularQueries);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('popular_queries:dat');
    });

    it('should return empty array when no cached data', async () => {
      // Arrange
      mockRedisInstance.get.mockResolvedValue(null);

      // Act
      const result = await cacheService.getPopularQueries('dat');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('logSearchAnalytics', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should log search analytics to cache', async () => {
      // Arrange
      const analytics = {
        userId: 'user123',
        query: 'database optimization',
        databases: ['db1', 'db2'],
        resultCount: 15,
        executionTime: 250,
        searchMode: 'semantic',
        timestamp: new Date('2023-01-01T12:00:00Z'),
      };

      mockRedisInstance.incr.mockResolvedValue(1);

      // Act
      await cacheService.logSearchAnalytics(analytics);

      // Assert
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('query_count:user123');
      expect(mockRedisInstance.zadd).toHaveBeenCalledWith(
        'recent_queries:user123',
        analytics.timestamp.getTime(),
        analytics.query
      );
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('query_popularity:database optimization');
      expect(mockRedisInstance.zadd).toHaveBeenCalledWith(
        expect.stringMatching(/^query_perf:user123:/),
        analytics.executionTime,
        analytics.query
      );
    });

    it('should do nothing when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      const analytics = {
        userId: 'user123',
        query: 'test',
        resultCount: 5,
        executionTime: 100,
        timestamp: new Date(),
      };

      // Act
      await cacheService.logSearchAnalytics(analytics);

      // Assert
      expect(mockRedisInstance.incr).not.toHaveBeenCalled();
    });
  });

  describe('setRateLimit', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should set rate limit and return true when under limit', async () => {
      // Arrange
      mockRedisInstance.incr.mockResolvedValue(1);

      // Act
      const result = await cacheService.setRateLimit('user123', 10, 3600);

      // Assert
      expect(result).toBe(true);
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('rate_limit:user123');
      expect(mockRedisInstance.expire).toHaveBeenCalledWith('rate_limit:user123', 3600);
    });

    it('should return false when over rate limit', async () => {
      // Arrange
      mockRedisInstance.incr.mockResolvedValue(11);

      // Act
      const result = await cacheService.setRateLimit('user123', 10, 3600);

      // Assert
      expect(result).toBe(false);
    });

    it('should not set expiry on subsequent increments', async () => {
      // Arrange
      mockRedisInstance.incr.mockResolvedValue(5);

      // Act
      const result = await cacheService.setRateLimit('user123', 10, 3600);

      // Assert
      expect(result).toBe(true);
      expect(mockRedisInstance.expire).not.toHaveBeenCalled();
    });

    it('should return true when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      const result = await cacheService.setRateLimit('user123', 10, 3600);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('disconnect', () => {
    beforeEach(() => {
      cacheService = new CacheService();
    });

    it('should disconnect from Redis', async () => {
      // Act
      await cacheService.disconnect();

      // Assert
      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Disconnected from Redis cache');
    });

    it('should handle disconnect errors', async () => {
      // Arrange
      (mockRedisInstance.disconnect as jest.Mock).mockRejectedValue(new Error('Disconnect error'));

      // Act
      await cacheService.disconnect();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error disconnecting from Redis:',
        expect.any(Error)
      );
    });
  });

  describe('flushAll', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should flush all cached data', async () => {
      // Act
      await cacheService.flushAll();

      // Assert
      expect(mockRedisInstance.flushall).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Cache flushed successfully');
    });

    it('should do nothing when cache is not available', async () => {
      // Arrange
      const disconnectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      disconnectHandler?.();

      // Act
      await cacheService.flushAll();

      // Assert
      expect(mockRedisInstance.flushall).not.toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    beforeEach(() => {
      cacheService = new CacheService();
      // Simulate connection
      const connectHandler = mockRedisInstance.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      connectHandler?.();
    });

    it('should set user session with TTL', async () => {
      // Arrange
      const sessionData = { userId: 'user123', role: 'admin' };

      // Act
      await cacheService.setUserSession('user123', sessionData, 1800);

      // Assert
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'session:user123',
        1800,
        JSON.stringify(sessionData)
      );
    });

    it('should get user session data', async () => {
      // Arrange
      const sessionData = { userId: 'user123', role: 'admin' };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(sessionData));

      // Act
      const result = await cacheService.getUserSession('user123');

      // Assert
      expect(result).toEqual(sessionData);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('session:user123');
    });

    it('should clear user session', async () => {
      // Act
      await cacheService.clearUserSession('user123');

      // Assert
      expect(mockRedisInstance.del).toHaveBeenCalledWith('session:user123');
    });
  });
});
