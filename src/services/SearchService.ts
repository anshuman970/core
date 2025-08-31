import type {
  Category,
  OptimizationSuggestion,
  QuerySuggestion,
  SearchRequest,
  SearchResponse,
  SearchResult,
  TrendInsight,
} from '@/types';
import { logger } from '@/utils/logger';
import type { AIService } from './AIService';
import type { CacheService } from './CacheService';
import type { DatabaseService } from './DatabaseService';

export class SearchService {
  private databaseService: DatabaseService;
  private aiService: AIService;
  private cacheService: CacheService;

  constructor(databaseService: DatabaseService, aiService: AIService, cacheService: CacheService) {
    this.databaseService = databaseService;
    this.aiService = aiService;
    this.cacheService = cacheService;
  }

  /**
   * Execute a comprehensive search across specified databases
   */
  public async search(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();
    logger.info(`Search request: ${request.query} by user ${request.userId}`);

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(request);

      // Check cache first
      if (!request.includeAnalytics) {
        const cachedResult = await this.cacheService.get<SearchResponse>(cacheKey);
        if (cachedResult) {
          logger.info(`Cache hit for query: ${request.query}`);
          return cachedResult;
        }
      }

      // Process the search query with AI if semantic search is requested
      let processedQuery = request.query;

      if (request.searchMode === 'semantic' && this.aiService.isAvailable()) {
        const aiProcessing = await this.aiService.processSearchQuery(request.query);
        processedQuery = aiProcessing.optimizedQuery || request.query;
        // Context could be used for future enhancements
      }

      // Execute search across all specified databases
      const searchPromises = (request.databases || []).map(async dbId => {
        return this.executeSearchOnDatabase(dbId, processedQuery, request);
      });

      const databaseResults = await Promise.allSettled(searchPromises);

      // Collect successful results
      const allResults: SearchResult[] = [];
      const failedDatabases: string[] = [];

      databaseResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        } else {
          failedDatabases.push(request.databases![index]);
          logger.error(`Search failed for database ${request.databases![index]}:`, result.reason);
        }
      });

      // Sort results by relevance score
      allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply pagination
      const paginatedResults = allResults.slice(
        request.offset || 0,
        (request.offset || 0) + (request.limit || 20)
      );

      // Generate categories using AI
      const categories = await this.generateCategories(paginatedResults);

      // Get search suggestions
      const suggestions = await this.getSearchSuggestions(request);

      // Get trends if requested
      let trends: TrendInsight[] | undefined;
      if (request.includeAnalytics) {
        trends = await this.getTrendInsights(request.userId);
      }

      // Get query optimization suggestions
      const optimizationSuggestions = await this.getOptimizationSuggestions(
        request,
        allResults.length,
        Date.now() - startTime
      );

      const response: SearchResponse = {
        results: paginatedResults,
        categories,
        suggestions,
        trends,
        queryOptimization: optimizationSuggestions,
        totalCount: allResults.length,
        executionTime: Date.now() - startTime,
        page: Math.floor((request.offset || 0) / (request.limit || 20)) + 1,
        limit: request.limit || 20,
      };

      // Cache the result (except when analytics are included)
      if (!request.includeAnalytics) {
        await this.cacheService.set(cacheKey, response, 300); // 5 minutes cache
      }

      // Log search analytics
      await this.logSearchAnalytics(request, response);

      logger.info(
        `Search completed in ${response.executionTime}ms, found ${response.totalCount} results`
      );
      return response;
    } catch (error) {
      logger.error('Search execution failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute search on a single database
   */
  private async executeSearchOnDatabase(
    databaseId: string,
    query: string,
    request: SearchRequest
  ): Promise<SearchResult[]> {
    try {
      const rawResults = await this.databaseService.executeFullTextSearch(
        databaseId,
        query,
        request.tables || [],
        request.columns,
        request.limit || 20,
        request.offset || 0
      );

      return rawResults.map((row, index) => ({
        id: `${databaseId}_${row.table_name}_${index}`,
        table: row.table_name,
        database: databaseId,
        relevanceScore: row.relevance_score || 0,
        matchedColumns: this.extractMatchedColumns(row),
        data: this.sanitizeRowData(row),
        snippet: this.generateSnippet(row, query),
        categories: [], // Will be filled by AI categorization
      }));
    } catch (error) {
      logger.error(`Database search failed for ${databaseId}:`, error);
      return [];
    }
  }

  /**
   * Generate search result categories using AI
   */
  private async generateCategories(results: SearchResult[]): Promise<Category[]> {
    if (results.length === 0 || !this.aiService.isAvailable()) {
      return [];
    }

    try {
      const categories = await this.aiService.categorizeResults(results);
      return categories.map(category => ({
        name: category.name,
        count: category.count,
        confidence: category.confidence,
      }));
    } catch (error) {
      logger.error('AI categorization failed:', error);
      return [];
    }
  }

  /**
   * Get search suggestions
   */
  public async getSearchSuggestions(request: SearchRequest): Promise<QuerySuggestion[]> {
    const suggestions: QuerySuggestion[] = [];

    try {
      // Get spelling corrections and semantic suggestions from AI
      if (this.aiService.isAvailable()) {
        const aiSuggestions = await this.aiService.getQuerySuggestions(request.query);
        suggestions.push(...aiSuggestions);
      }

      // Get popular queries from database
      const popularSuggestions = await this.cacheService.getPopularQueries(request.query);
      suggestions.push(
        ...popularSuggestions.map(query => ({
          text: query,
          score: 0.8,
          type: 'popular' as const,
        }))
      );

      // Remove duplicates and sort by score
      const uniqueSuggestions = suggestions.filter(
        (suggestion, index, self) => index === self.findIndex(s => s.text === suggestion.text)
      );

      return uniqueSuggestions.sort((a, b) => b.score - a.score).slice(0, 5);
    } catch (error) {
      logger.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Get trend insights for a user
   */
  private async getTrendInsights(userId: string): Promise<TrendInsight[]> {
    try {
      // This would typically query your analytics database
      // For now, return mock data structure
      return [
        {
          period: 'week',
          topQueries: await this.cacheService.getTopQueries(userId, 7),
          queryVolume: await this.cacheService.getQueryVolume(userId, 7),
          avgResponseTime: await this.cacheService.getAverageResponseTime(userId, 7),
          popularCategories: await this.cacheService.getPopularCategories(userId, 7),
        },
      ];
    } catch (error) {
      logger.error('Failed to get trend insights:', error);
      return [];
    }
  }

  /**
   * Get query optimization suggestions
   */
  private async getOptimizationSuggestions(
    request: SearchRequest,
    resultCount: number,
    executionTime: number
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    try {
      // Performance-based suggestions
      if (executionTime > 5000) {
        // More than 5 seconds
        suggestions.push({
          type: 'index',
          description:
            'Query execution time is high. Consider adding full-text indexes to frequently searched columns.',
          impact: 'high',
        });
      }

      if (resultCount === 0) {
        suggestions.push({
          type: 'query',
          description: 'No results found. Try using broader search terms or check spelling.',
          impact: 'medium',
        });
      }

      // AI-powered suggestions
      if (this.aiService.isAvailable()) {
        const aiSuggestions = await this.aiService.getOptimizationSuggestions(
          request.query,
          executionTime,
          resultCount
        );
        suggestions.push(...aiSuggestions);
      }

      return suggestions;
    } catch (error) {
      logger.error('Failed to get optimization suggestions:', error);
      return suggestions;
    }
  }

  /**
   * Generate cache key for search request
   */
  private generateCacheKey(request: SearchRequest): string {
    const key = {
      query: request.query,
      databases: request.databases?.sort(),
      tables: request.tables?.sort(),
      columns: request.columns?.sort(),
      searchMode: request.searchMode,
      limit: request.limit,
      offset: request.offset,
    };

    return `search:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  /**
   * Extract matched columns from search result
   */
  private extractMatchedColumns(row: any): string[] {
    const matchedColumns: string[] = [];

    // This is a simplified implementation
    // In practice, you'd analyze which columns contributed to the match
    Object.keys(row).forEach(key => {
      if (key !== 'table_name' && key !== 'relevance_score' && row[key]) {
        matchedColumns.push(key);
      }
    });

    return matchedColumns;
  }

  /**
   * Sanitize row data for response
   */
  private sanitizeRowData(row: any): Record<string, any> {
    const sanitized = { ...row };
    delete sanitized.table_name;
    delete sanitized.relevance_score;
    return sanitized;
  }

  /**
   * Generate search result snippet
   */
  private generateSnippet(row: any, query: string): string {
    const searchTerms = query.toLowerCase().split(/\s+/);

    // Find the first text field that contains search terms
    for (const [, value] of Object.entries(row)) {
      if (typeof value === 'string' && value.length > 50) {
        const lowerValue = value.toLowerCase();

        // Check if any search term is in this field
        const hasMatch = searchTerms.some(term => lowerValue.includes(term));

        if (hasMatch) {
          // Generate snippet around the first match
          const firstMatch = searchTerms.find(term => lowerValue.includes(term));
          if (firstMatch) {
            const index = lowerValue.indexOf(firstMatch);
            const start = Math.max(0, index - 50);
            const end = Math.min(value.length, index + firstMatch.length + 50);
            return `...${value.substring(start, end)}...`;
          }
        }
      }
    }

    // Fallback: return first text field truncated
    for (const [, value] of Object.entries(row)) {
      if (typeof value === 'string' && value.length > 20) {
        return value.substring(0, 100) + (value.length > 100 ? '...' : '');
      }
    }

    return '';
  }

  /**
   * Log search analytics
   */
  private async logSearchAnalytics(
    request: SearchRequest,
    response: SearchResponse
  ): Promise<void> {
    try {
      const analyticsData = {
        userId: request.userId,
        query: request.query,
        databases: request.databases,
        resultCount: response.totalCount,
        executionTime: response.executionTime,
        searchMode: request.searchMode,
        timestamp: new Date(),
      };

      await this.cacheService.logSearchAnalytics(analyticsData);
    } catch (error) {
      logger.error('Failed to log search analytics:', error);
    }
  }

  /**
   * Simple search method for testing (alias to search)
   */
  public async performSearch(query: string, options?: any): Promise<any> {
    const request: SearchRequest = {
      query,
      userId: 'test-user',
      databases: options?.databases || [],
      tables: options?.tables,
      columns: options?.columns,
      searchMode: options?.searchMode || 'natural',
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      includeAnalytics: options?.includeAnalytics || false,
    };

    try {
      const response = await this.search(request);
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search failed',
        },
      };
    }
  }

  /**
   * Analyze search performance (public method for testing)
   */
  public async analyzeSearchPerformance(): Promise<any> {
    // Mock performance analysis for testing
    return [
      { metric: 'execution_time', value: Math.floor(Math.random() * 100) + 10 },
      { metric: 'result_count', value: Math.floor(Math.random() * 500) + 1 },
    ];
  }
}
