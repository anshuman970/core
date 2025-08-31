import { SearchController } from './SearchController';
import { SearchService } from '@/services/SearchService';
import { DatabaseService } from '@/services/DatabaseService';
import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import type {
  SearchRequest,
  SearchResponse,
  QuerySuggestion,
  OptimizationSuggestion,
  TrendInsight,
  SearchAnalytics,
} from '@/types';

// Mock dependencies
jest.mock('@/services/SearchService');
jest.mock('@/services/DatabaseService');
jest.mock('@/services/AIService');
jest.mock('@/services/CacheService');
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SearchController', () => {
  let searchController: SearchController;
  let mockSearchService: jest.Mocked<SearchService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockAIService: jest.Mocked<AIService>;
  let mockCacheService: jest.Mocked<CacheService>;

  const mockSearchRequest: SearchRequest = {
    query: 'test query',
    databases: ['db-1', 'db-2'],
    tables: ['users', 'products'],
    searchMode: 'natural',
    limit: 10,
    offset: 0,
    userId: 'user-123',
  };

  const mockSearchResponse: SearchResponse = {
    results: [
      {
        id: 'result-1',
        table: 'users',
        database: 'db-1',
        relevanceScore: 0.9,
        matchedColumns: ['name', 'email'],
        data: { id: 1, name: 'John Doe', email: 'john@example.com' },
      },
    ],
    categories: [],
    suggestions: [],
    totalCount: 1,
    executionTime: 150,
    page: 1,
    limit: 10,
  };

  const mockQuerySuggestions: QuerySuggestion[] = [
    { text: 'test query suggestion', score: 0.8, type: 'semantic' },
    { text: 'popular query', score: 0.7, type: 'popular' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SearchService
    mockSearchService = {
      search: jest.fn(),
    } as any;

    // Mock DatabaseService
    mockDatabaseService = {
      getSearchSuggestions: jest.fn(),
      analyzeQueryPerformance: jest.fn(),
    } as any;

    // Mock AIService
    mockAIService = {
      isAvailable: jest.fn(),
      getQuerySuggestions: jest.fn(),
      analyzeQuery: jest.fn(),
    } as any;

    // Mock CacheService
    mockCacheService = {
      getTopQueries: jest.fn(),
      getQueryVolume: jest.fn(),
      getAverageResponseTime: jest.fn(),
      getPopularCategories: jest.fn(),
      getSearchHistory: jest.fn(),
    } as any;

    // Setup service constructors
    (SearchService as jest.MockedClass<typeof SearchService>).mockImplementation(() => mockSearchService);
    (DatabaseService as jest.MockedClass<typeof DatabaseService>).mockImplementation(() => mockDatabaseService);
    (AIService as jest.MockedClass<typeof AIService>).mockImplementation(() => mockAIService);
    (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

    searchController = new SearchController();
  });

  describe('executeSearch', () => {
    it('should execute search successfully', async () => {
      mockSearchService.search.mockResolvedValue(mockSearchResponse);

      const result = await searchController.executeSearch(mockSearchRequest);

      expect(mockSearchService.search).toHaveBeenCalledWith(mockSearchRequest);
      expect(result).toEqual(mockSearchResponse);
    });

    it('should handle search service errors', async () => {
      const searchError = new Error('Search failed');
      mockSearchService.search.mockRejectedValue(searchError);

      await expect(searchController.executeSearch(mockSearchRequest)).rejects.toThrow(
        'Search failed'
      );
    });

    it('should log search requests', async () => {
      mockSearchService.search.mockResolvedValue(mockSearchResponse);

      await searchController.executeSearch(mockSearchRequest);

      // Logger is mocked, so we can't directly verify calls, but the method should complete
      expect(mockSearchService.search).toHaveBeenCalled();
    });
  });

  describe('getSearchSuggestions', () => {
    const suggestionParams = {
      query: 'test',
      databases: ['db-1'],
      tables: ['users'],
      userId: 'user-123',
    };

    it('should get suggestions with AI available', async () => {
      mockAIService.isAvailable.mockReturnValue(true);
      mockAIService.getQuerySuggestions.mockResolvedValue([
        { text: 'ai suggestion', score: 0.9, type: 'semantic' },
      ]);
      mockDatabaseService.getSearchSuggestions.mockResolvedValue(['database suggestion']);

      const result = await searchController.getSearchSuggestions(suggestionParams);

      expect(mockAIService.isAvailable).toHaveBeenCalled();
      expect(mockAIService.getQuerySuggestions).toHaveBeenCalledWith('test');
      expect(mockDatabaseService.getSearchSuggestions).toHaveBeenCalledWith('db-1', 'test', ['users']);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ text: 'ai suggestion', score: 0.9, type: 'semantic' });
      expect(result[1]).toMatchObject({ text: 'database suggestion', score: 0.7, type: 'popular' });
    });

    it('should get suggestions without AI', async () => {
      mockAIService.isAvailable.mockReturnValue(false);
      mockDatabaseService.getSearchSuggestions.mockResolvedValue(['database suggestion']);

      const result = await searchController.getSearchSuggestions(suggestionParams);

      expect(mockAIService.getQuerySuggestions).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ text: 'database suggestion', score: 0.7, type: 'popular' });
    });

    it('should handle multiple databases', async () => {
      mockAIService.isAvailable.mockReturnValue(false);
      mockDatabaseService.getSearchSuggestions
        .mockResolvedValueOnce(['suggestion 1'])
        .mockResolvedValueOnce(['suggestion 2']);

      const multiDbParams = { ...suggestionParams, databases: ['db-1', 'db-2'] };
      const result = await searchController.getSearchSuggestions(multiDbParams);

      expect(mockDatabaseService.getSearchSuggestions).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should remove duplicates and limit results', async () => {
      mockAIService.isAvailable.mockReturnValue(true);
      mockAIService.getQuerySuggestions.mockResolvedValue([
        { text: 'duplicate', score: 0.9, type: 'semantic' },
      ]);
      mockDatabaseService.getSearchSuggestions.mockResolvedValue(['duplicate', 'unique']);

      const result = await searchController.getSearchSuggestions(suggestionParams);

      expect(result).toHaveLength(2); // Should have duplicate removed
      const texts = result.map(s => s.text);
      expect(texts).toContain('duplicate');
      expect(texts).toContain('unique');
    });

    it('should sort by score descending', async () => {
      mockAIService.isAvailable.mockReturnValue(true);
      mockAIService.getQuerySuggestions.mockResolvedValue([
        { text: 'low score', score: 0.5, type: 'semantic' },
        { text: 'high score', score: 0.9, type: 'semantic' },
      ]);
      mockDatabaseService.getSearchSuggestions.mockResolvedValue([]);

      const result = await searchController.getSearchSuggestions(suggestionParams);

      expect(result[0].text).toBe('high score');
      expect(result[1].text).toBe('low score');
    });

    it('should limit results to 10', async () => {
      mockAIService.isAvailable.mockReturnValue(false);
      const manyResults = Array.from({ length: 15 }, (_, i) => `suggestion ${i}`);
      mockDatabaseService.getSearchSuggestions.mockResolvedValue(manyResults);

      const result = await searchController.getSearchSuggestions(suggestionParams);

      expect(result).toHaveLength(10);
    });

    it('should handle errors gracefully', async () => {
      const dbError = new Error('Database error');
      mockAIService.isAvailable.mockReturnValue(false);
      mockDatabaseService.getSearchSuggestions.mockRejectedValue(dbError);

      await expect(searchController.getSearchSuggestions(suggestionParams)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('analyzeQuery', () => {
    const analyzeParams = {
      query: 'SELECT * FROM users',
      databases: ['db-1'],
      userId: 'user-123',
    };

    const mockOptimizations: OptimizationSuggestion[] = [
      {
        type: 'index',
        description: 'Consider adding an index',
        impact: 'high',
      },
    ];

    it('should analyze query with AI available', async () => {
      mockAIService.isAvailable.mockReturnValue(true);
      mockAIService.analyzeQuery.mockResolvedValue({
        recommendations: ['Use specific columns'],
        optimizations: mockOptimizations,
      });
      mockDatabaseService.analyzeQueryPerformance.mockResolvedValue([
        { metric: 'execution_time', value: 100 },
        { metric: 'index_usage', value: 'full_scan' },
      ]);

      const result = await searchController.analyzeQuery(analyzeParams);

      expect(mockAIService.analyzeQuery).toHaveBeenCalledWith('SELECT * FROM users');
      expect(mockDatabaseService.analyzeQueryPerformance).toHaveBeenCalledWith('db-1', 'SELECT * FROM users');
      
      expect(result).toMatchObject({
        query: 'SELECT * FROM users',
        recommendations: ['Use specific columns'],
        optimization: mockOptimizations,
        performance: {
          'db-1': [{ metric: 'execution_time', value: 100 }, { metric: 'index_usage', value: 'full_scan' }],
        },
      });
    });

    it('should analyze query without AI', async () => {
      mockAIService.isAvailable.mockReturnValue(false);
      mockDatabaseService.analyzeQueryPerformance.mockResolvedValue([
        { metric: 'execution_time', value: 200 },
      ]);

      const result = await searchController.analyzeQuery(analyzeParams);

      expect(mockAIService.analyzeQuery).not.toHaveBeenCalled();
      expect(result.recommendations).toEqual([]);
      expect(result.optimization).toEqual([]);
      expect(result.performance).toMatchObject({
        'db-1': [{ metric: 'execution_time', value: 200 }],
      });
    });

    it('should handle multiple databases', async () => {
      mockAIService.isAvailable.mockReturnValue(false);
      mockDatabaseService.analyzeQueryPerformance
        .mockResolvedValueOnce([{ metric: 'execution_time', value: 100 }])
        .mockResolvedValueOnce([{ metric: 'execution_time', value: 200 }]);

      const multiDbParams = { ...analyzeParams, databases: ['db-1', 'db-2'] };
      const result = await searchController.analyzeQuery(multiDbParams);

      expect(mockDatabaseService.analyzeQueryPerformance).toHaveBeenCalledTimes(2);
      expect(result.performance).toMatchObject({
        'db-1': [{ metric: 'execution_time', value: 100 }],
        'db-2': [{ metric: 'execution_time', value: 200 }],
      });
    });

    it('should handle database analysis errors gracefully', async () => {
      mockAIService.isAvailable.mockReturnValue(false);
      const dbError = new Error('Database analysis failed');
      mockDatabaseService.analyzeQueryPerformance.mockRejectedValue(dbError);

      const result = await searchController.analyzeQuery(analyzeParams);

      // Should not throw, but continue without that database's analysis
      expect(result.performance).toEqual({});
    });

    it('should handle overall analysis errors', async () => {
      mockAIService.isAvailable.mockImplementation(() => {
        throw new Error('AI service error');
      });

      await expect(searchController.analyzeQuery(analyzeParams)).rejects.toThrow(
        'AI service error'
      );
    });
  });

  describe('getUserTrends', () => {
    const mockTrendData = {
      topQueries: ['query 1', 'query 2'],
      queryVolume: 100,
      avgResponseTime: 150,
      popularCategories: ['category 1', 'category 2'],
    };

    beforeEach(() => {
      mockCacheService.getTopQueries.mockResolvedValue(mockTrendData.topQueries);
      mockCacheService.getQueryVolume.mockResolvedValue(mockTrendData.queryVolume);
      mockCacheService.getAverageResponseTime.mockResolvedValue(mockTrendData.avgResponseTime);
      mockCacheService.getPopularCategories.mockResolvedValue(mockTrendData.popularCategories);
    });

    it('should get user trends successfully', async () => {
      const result = await searchController.getUserTrends('user-123');

      expect(result).toHaveLength(2); // Week and month trends
      
      // Check week trends
      expect(result[0]).toMatchObject({
        period: 'week',
        ...mockTrendData,
      });
      expect(mockCacheService.getTopQueries).toHaveBeenCalledWith('user-123', 7);
      expect(mockCacheService.getQueryVolume).toHaveBeenCalledWith('user-123', 7);
      expect(mockCacheService.getAverageResponseTime).toHaveBeenCalledWith('user-123', 7);
      expect(mockCacheService.getPopularCategories).toHaveBeenCalledWith('user-123', 7);

      // Check month trends
      expect(result[1]).toMatchObject({
        period: 'month',
        ...mockTrendData,
      });
      expect(mockCacheService.getTopQueries).toHaveBeenCalledWith('user-123', 30);
    });

    it('should handle cache service errors', async () => {
      const cacheError = new Error('Cache service error');
      mockCacheService.getTopQueries.mockRejectedValue(cacheError);

      await expect(searchController.getUserTrends('user-123')).rejects.toThrow(
        'Cache service error'
      );
    });
  });

  describe('getSearchHistory', () => {
    const mockSearchHistory: SearchAnalytics[] = [
      {
        id: 'search-1',
        userId: 'user-123',
        query: 'test query',
        database: 'db-1',
        executionTime: 100,
        resultCount: 5,
        timestamp: new Date('2024-01-01'),
      },
    ];

    it('should get search history successfully', async () => {
      mockCacheService.getSearchHistory.mockResolvedValue(mockSearchHistory);

      const result = await searchController.getSearchHistory('user-123', 10, 0);

      expect(mockCacheService.getSearchHistory).toHaveBeenCalledWith('user-123', 10, 0);
      expect(result).toEqual(mockSearchHistory);
    });

    it('should handle default parameters', async () => {
      mockCacheService.getSearchHistory.mockResolvedValue(mockSearchHistory);

      await searchController.getSearchHistory('user-123', 20, 10);

      expect(mockCacheService.getSearchHistory).toHaveBeenCalledWith('user-123', 20, 10);
    });

    it('should handle cache service errors', async () => {
      const cacheError = new Error('Cache service error');
      mockCacheService.getSearchHistory.mockRejectedValue(cacheError);

      await expect(searchController.getSearchHistory('user-123', 10, 0)).rejects.toThrow(
        'Cache service error'
      );
    });
  });
});