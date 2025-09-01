import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import { DatabaseService } from '@/services/DatabaseService';
import { SearchService } from '@/services/SearchService';
import { TestHelpers } from '@tests/utils/test-helpers';

describe('Search Performance Tests', () => {
  // Performance tests using mocked services for consistent testing
  let databaseService: DatabaseService;
  let cacheService: CacheService;
  let aiService: AIService;
  let searchService: SearchService;

  beforeAll(async () => {
    // Initialize services (these will use the mocked implementations)
    databaseService = new DatabaseService();
    cacheService = new CacheService();
    aiService = new AIService();
    searchService = new SearchService(databaseService, aiService, cacheService);
  });

  afterAll(async () => {
    // No cleanup needed for mocked services
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Search Query Performance', () => {
    it('should handle single search query within acceptable time', async () => {
      const { result, duration } = await TestHelpers.measurePerformance(async () => {
        return await searchService.performSearch('database optimization', {
          databases: ['test_db'],
        });
      });

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      // eslint-disable-next-line no-console
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
        return await Promise.all(
          queries.map(query => searchService.performSearch(query, { databases: ['test_db'] }))
        );
      });

      expect(results).toHaveLength(queries.length);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Concurrent queries should not take much longer than single query
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

      // eslint-disable-next-line no-console
      console.log(`${queries.length} concurrent searches executed in ${duration.toFixed(2)}ms`);
    });

    it('should handle high-volume search requests', async () => {
      const searchPromises = Array.from({ length: 50 }, (_, i) =>
        searchService.performSearch(`performance test query ${i % 10}`, {
          databases: ['test_db'],
        })
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

      // eslint-disable-next-line no-console
      console.log(`50 search queries executed in ${duration.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`Memory usage: ${JSON.stringify(memoryUsage, null, 2)}`);
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache performance improvement', async () => {
      const query = 'cache performance test unique query';

      // First search (cache miss) - hits database
      const { duration: uncachedDuration } = await TestHelpers.measurePerformance(async () => {
        return await searchService.performSearch(query, { databases: ['test_db'] });
      });

      // Second search (cache hit) - from cache
      const { duration: cachedDuration } = await TestHelpers.measurePerformance(async () => {
        return await searchService.performSearch(query, { databases: ['test_db'] });
      });

      // Cached query should be significantly faster
      expect(cachedDuration).toBeLessThan(uncachedDuration * 0.5); // At least 50% faster

      // eslint-disable-next-line no-console
      console.log(`Uncached query: ${uncachedDuration.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`Cached query: ${cachedDuration.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
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
          return await searchService.performSearch(query, { databases: ['test_db'] });
        });

        expect(result.success).toBe(true);
        expect(result.data.results.length).toBeGreaterThan(0);
        expect(duration).toBeLessThan(2000); // Should complete within 2 seconds even for large datasets

        // eslint-disable-next-line no-console
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
            databases: ['test_db'],
            limit: pageSize,
            offset,
          });
        });

        expect(result.success).toBe(true);
        expect(result.data.results.length).toBeLessThanOrEqual(pageSize);
        expect(duration).toBeLessThan(1500); // Pagination should not significantly impact performance

        // eslint-disable-next-line no-console
        console.log(`Page ${page + 1}: ${duration.toFixed(2)}ms, offset: ${offset}`);
      }
    });
  });

  describe('Memory Usage', () => {
    it('should not have memory leaks during repeated searches', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many searches
      for (let i = 0; i < 100; i++) {
        await searchService.performSearch(`memory test query ${i % 10}`, {
          databases: ['test_db'],
        });

        // Occasionally force garbage collection if available
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      // eslint-disable-next-line no-console
      console.log(
        `Memory increase after 100 searches: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid queries efficiently', async () => {
      // These queries should actually fail validation
      const invalidQueries = ['!@#$%^&*()', 'a'.repeat(1001)]; // removed empty queries since they return success with empty results

      for (const query of invalidQueries) {
        const { result, duration } = await TestHelpers.measurePerformance(async () => {
          return await searchService.performSearch(query, { databases: ['test_db'] });
        });

        expect(result.success).toBe(false);
        expect(duration).toBeLessThan(100); // Error handling should be very fast

        // eslint-disable-next-line no-console
        console.log(`Invalid query handling: ${duration.toFixed(2)}ms`);
      }
    });

    it('should handle empty queries efficiently', async () => {
      // Empty queries should return success with empty results
      const emptyQueries = ['', '   '];

      for (const query of emptyQueries) {
        const { result, duration } = await TestHelpers.measurePerformance(async () => {
          return await searchService.performSearch(query, { databases: ['test_db'] });
        });

        expect(result.success).toBe(true);
        expect(result.data.results).toEqual([]);
        expect(duration).toBeLessThan(50); // Should be very fast for empty queries

        // eslint-disable-next-line no-console
        console.log(`Empty query handling: ${duration.toFixed(2)}ms`);
      }
    });
  });
});
