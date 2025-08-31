import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import { DatabaseService } from '@/services/DatabaseService';
import { SearchService } from '@/services/SearchService';
import { TestHelpers } from '@tests/utils/test-helpers';

describe.skip('Search Performance Tests', () => {
  // Performance tests require MySQL and Redis to be running
  let databaseService: DatabaseService;
  let cacheService: CacheService;
  let aiService: AIService;
  let searchService: SearchService;
  beforeAll(async () => {
    // Initialize services
    databaseService = new DatabaseService();
    cacheService = new CacheService();
    aiService = new AIService();
    searchService = new SearchService(databaseService, aiService, cacheService);

    // Create test user for setup
    await TestHelpers.createTestUser({
      email: 'perf@example.com',
      name: 'Performance Test User',
    });

    // Insert large dataset for performance testing
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      title: `Performance Test Article ${i}`,
      content: `This is performance test content for article ${i}. It contains various keywords like database, search, optimization, MySQL, Redis, caching, and performance tuning. The content is designed to test full-text search capabilities under load with realistic data patterns.`,
      category: i % 5 === 0 ? 'database' : i % 3 === 0 ? 'search' : 'performance',
    }));

    await TestHelpers.insertTestContent(largeDataset);
  });

  afterAll(async () => {
    await TestHelpers.cleanupTestData();
    await TestHelpers.closeConnections();
  });

  describe('Search Query Performance', () => {
    it('should handle single search query within acceptable time', async () => {
      const { result, duration } = await TestHelpers.measurePerformance(async () => {
        return await searchService.performSearch('database optimization');
      });

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      console.log(`Single search query executed in ${duration.toFixed(2)}ms`);
    });

    it('should handle concurrent search queries efficiently', async () => {
      const queries = [
        'database performance',
        'MySQL optimization',
        'Redis caching',
        'search algorithms',
        'performance tuning',
      ];

      const { result: results, duration } = await TestHelpers.measurePerformance(async () => {
        return await Promise.all(queries.map(query => searchService.performSearch(query)));
      });

      expect(results).toHaveLength(queries.length);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Concurrent queries should not take much longer than single query
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

      console.log(`${queries.length} concurrent searches executed in ${duration.toFixed(2)}ms`);
    });

    it('should handle high-volume search requests', async () => {
      const searchPromises = Array.from({ length: 50 }, (_, i) =>
        searchService.performSearch(`performance test query ${i % 10}`)
      );

      const {
        result: results,
        duration,
        memoryUsage,
      } = await TestHelpers.measurePerformance(async () => {
        return await Promise.all(searchPromises);
      });

      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // High-volume requests should complete within reasonable time
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`50 search queries executed in ${duration.toFixed(2)}ms`);
      console.log(`Memory usage: ${JSON.stringify(memoryUsage, null, 2)}`);
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache performance improvement', async () => {
      const query = 'cache performance test unique query';

      // First search (cache miss) - hits database
      const { duration: uncachedDuration } = await TestHelpers.measurePerformance(async () => {
        return await searchService.performSearch(query);
      });

      // Second search (cache hit) - from cache
      const { duration: cachedDuration } = await TestHelpers.measurePerformance(async () => {
        return await searchService.performSearch(query);
      });

      // Cached query should be significantly faster
      expect(cachedDuration).toBeLessThan(uncachedDuration * 0.5); // At least 50% faster

      console.log(`Uncached query: ${uncachedDuration.toFixed(2)}ms`);
      console.log(`Cached query: ${cachedDuration.toFixed(2)}ms`);
      console.log(
        `Cache improvement: ${(((uncachedDuration - cachedDuration) / uncachedDuration) * 100).toFixed(1)}%`
      );
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle searches on large datasets efficiently', async () => {
      // Test with different query complexities
      const queries = [
        'database',
        'performance optimization',
        '+database +optimization -slow',
        'MySQL Redis caching performance',
      ];

      for (const query of queries) {
        const { result, duration } = await TestHelpers.measurePerformance(async () => {
          return await searchService.performSearch(query);
        });

        expect(result.success).toBe(true);
        expect(result.data.results.length).toBeGreaterThan(0);
        expect(duration).toBeLessThan(2000); // Should complete within 2 seconds even for large datasets

        console.log(
          `Query "${query}": ${duration.toFixed(2)}ms, ${result.data.totalCount} results`
        );
      }
    });

    it('should handle pagination efficiently', async () => {
      const query = 'test';
      const pageSize = 20;
      const pagesToTest = 5;

      for (let page = 0; page < pagesToTest; page++) {
        const offset = page * pageSize;

        const { result, duration } = await TestHelpers.measurePerformance(async () => {
          return await searchService.performSearch(query, {
            limit: pageSize,
            offset,
          });
        });

        expect(result.success).toBe(true);
        expect(result.data.results.length).toBeLessThanOrEqual(pageSize);
        expect(duration).toBeLessThan(1500); // Pagination should not significantly impact performance

        console.log(`Page ${page + 1}: ${duration.toFixed(2)}ms, offset: ${offset}`);
      }
    });
  });

  describe('Memory Usage', () => {
    it('should not have memory leaks during repeated searches', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many searches
      for (let i = 0; i < 100; i++) {
        await searchService.performSearch(`memory test query ${i % 10}`);

        // Occasionally force garbage collection if available
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(
        `Memory increase after 100 searches: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid queries efficiently', async () => {
      const invalidQueries = ['', '   ', '!@#$%^&*()', 'a'.repeat(1000)];

      for (const query of invalidQueries) {
        const { result, duration } = await TestHelpers.measurePerformance(async () => {
          return await searchService.performSearch(query);
        });

        expect(result.success).toBe(false);
        expect(duration).toBeLessThan(100); // Error handling should be very fast

        console.log(`Invalid query handling: ${duration.toFixed(2)}ms`);
      }
    });
  });
});
