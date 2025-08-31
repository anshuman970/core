/**
 * SearchController
 *
 * Handles search operations, suggestions, and analytics for user queries.
 * Integrates with SearchService, DatabaseService, AIService, and CacheService.
 *
 * Usage:
 *   - Instantiate and use executeSearch() to perform searches
 *   - Use getSearchSuggestions() for query suggestions
 */
import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import { DatabaseService } from '@/services/DatabaseService';
import { SearchService } from '@/services/SearchService';
import type {
  OptimizationSuggestion,
  QuerySuggestion,
  SearchAnalytics,
  SearchRequest,
  SearchResponse,
  TrendInsight,
} from '@/types';
import { logger } from '@/utils/logger';

export class SearchController {
  /**
   * SearchService instance for executing searches and aggregating results.
   */
  private searchService: SearchService;

  /**
   * DatabaseService instance for database operations.
   */
  private databaseService: DatabaseService;

  /**
   * AIService instance for query optimization and suggestions.
   */
  private aiService: AIService;

  /**
   * CacheService instance for caching search results and analytics.
   */
  private cacheService: CacheService;

  /**
   * Initialize the SearchController and its dependencies.
   */
  constructor() {
    this.databaseService = new DatabaseService();
    this.aiService = new AIService();
    this.cacheService = new CacheService();
    this.searchService = new SearchService(this.databaseService, this.aiService, this.cacheService);
  }

  /**
   * Execute a comprehensive search for a user request.
   * Logs the request and delegates to SearchService.
   *
   * @param request - SearchRequest object containing query and options
   * @returns SearchResponse with aggregated results
   * @throws Error if search execution fails
   */
  public async executeSearch(request: SearchRequest): Promise<SearchResponse> {
    logger.info(`Search request from user ${request.userId}: ${request.query}`);

    try {
      return await this.searchService.search(request);
    } catch (error) {
      logger.error('Search execution failed:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions for a query.
   * Combines AI-powered and database-based suggestions.
   *
   * @param params - Object containing query, databases, tables, and userId
   * @returns Array of QuerySuggestion objects
   */
  public async getSearchSuggestions(params: {
    query: string;
    databases: string[];
    tables: string[];
    userId: string;
  }): Promise<QuerySuggestion[]> {
    try {
      const suggestions: QuerySuggestion[] = [];

      // Get AI-powered suggestions if available
      if (this.aiService.isAvailable()) {
        const aiSuggestions = await this.aiService.getQuerySuggestions(params.query);
        suggestions.push(...aiSuggestions);
      }

      // Get database-based suggestions
      for (const dbId of params.databases) {
        const dbSuggestions = await this.databaseService.getSearchSuggestions(
          dbId,
          params.query,
          params.tables || []
        );

        dbSuggestions.forEach(suggestion => {
          suggestions.push({
            text: suggestion,
            score: 0.7,
            type: 'popular',
          });
        });
      }

      // Remove duplicates and sort by score
      const uniqueSuggestions = suggestions.filter(
        (suggestion, index, self) => index === self.findIndex(s => s.text === suggestion.text)
      );

      return uniqueSuggestions.sort((a, b) => b.score - a.score).slice(0, 10);
    } catch (error) {
      logger.error('Failed to get search suggestions:', error);
      throw error;
    }
  }

  /**
   * Analyze query performance
   */
  public async analyzeQuery(params: {
    query: string;
    databases: string[];
    userId: string;
  }): Promise<any> {
    try {
      const analysis: {
        query: string;
        recommendations: string[];
        performance: Record<string, any>;
        optimization: OptimizationSuggestion[];
      } = {
        query: params.query,
        recommendations: [],
        performance: {},
        optimization: [],
      };

      // Analyze query with AI if available
      if (this.aiService.isAvailable()) {
        const aiAnalysis = await this.aiService.analyzeQuery(params.query);
        analysis.recommendations.push(...aiAnalysis.recommendations);
        analysis.optimization.push(...aiAnalysis.optimizations);
      }

      // Analyze database performance
      for (const dbId of params.databases) {
        try {
          const dbAnalysis = await this.databaseService.analyzeQueryPerformance(dbId, params.query);
          analysis.performance[dbId] = dbAnalysis;
        } catch (error) {
          logger.error(`Database analysis failed for ${dbId}:`, error);
        }
      }

      return analysis;
    } catch (error) {
      logger.error('Query analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get user search trends
   */
  public async getUserTrends(userId: string): Promise<TrendInsight[]> {
    try {
      return [
        {
          period: 'week',
          topQueries: await this.cacheService.getTopQueries(userId, 7),
          queryVolume: await this.cacheService.getQueryVolume(userId, 7),
          avgResponseTime: await this.cacheService.getAverageResponseTime(userId, 7),
          popularCategories: await this.cacheService.getPopularCategories(userId, 7),
        },
        {
          period: 'month',
          topQueries: await this.cacheService.getTopQueries(userId, 30),
          queryVolume: await this.cacheService.getQueryVolume(userId, 30),
          avgResponseTime: await this.cacheService.getAverageResponseTime(userId, 30),
          popularCategories: await this.cacheService.getPopularCategories(userId, 30),
        },
      ];
    } catch (error) {
      logger.error('Failed to get user trends:', error);
      throw error;
    }
  }

  /**
   * Get user search history
   */
  public async getSearchHistory(
    userId: string,
    limit: number,
    offset: number
  ): Promise<SearchAnalytics[]> {
    try {
      return await this.cacheService.getSearchHistory(userId, limit, offset);
    } catch (error) {
      logger.error('Failed to get search history:', error);
      throw error;
    }
  }
}
