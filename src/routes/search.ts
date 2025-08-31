import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { SearchController } from '@/controllers/SearchController';
import { ApiResponse, SearchRequest, SearchResponse } from '@/types';

const router = Router();
const searchController = new SearchController();

// Search request validation schema
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(500, 'Query too long'),
  databases: z.array(z.string()).optional().default([]),
  tables: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
  searchMode: z.enum(['natural', 'boolean', 'semantic']).optional().default('natural'),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  includeAnalytics: z.boolean().optional().default(false),
});

const suggestionRequestSchema = z.object({
  query: z.string().min(1).max(100),
  databases: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
});

const analyzeQuerySchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  databases: z.array(z.string()).min(1, 'At least one database required'),
});

/**
 * POST /api/v1/search
 * Execute a search across specified databases
 */
router.post(
  '/',
  authenticate,
  validateRequest({ body: searchRequestSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const searchRequest: SearchRequest = {
        ...req.body,
        userId: req.user!.id,
      };

      const result = await searchController.executeSearch(searchRequest);

      const response: ApiResponse<SearchResponse> = {
        success: true,
        data: result,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '0.1.0',
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search execution failed',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/search/suggestions
 * Get search suggestions based on partial query
 */
router.get(
  '/suggestions',
  authenticate,
  validateRequest({ query: suggestionRequestSchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const suggestions = await searchController.getSearchSuggestions({
        query: req.query.query as string,
        databases: req.query.databases as string[] || [],
        tables: req.query.tables as string[] || [],
        userId: req.user!.id,
      });

      const response: ApiResponse = {
        success: true,
        data: { suggestions },
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '0.1.0',
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SUGGESTIONS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get suggestions',
        },
      } as ApiResponse);
    }
  }
);

/**
 * POST /api/v1/search/analyze
 * Analyze search performance and get optimization suggestions
 */
router.post(
  '/analyze',
  authenticate,
  validateRequest({ body: analyzeQuerySchema }),
  async (req: AuthenticatedRequest, res) => {
    try {
      const analysis = await searchController.analyzeQuery({
        query: req.body.query,
        databases: req.body.databases,
        userId: req.user!.id,
      });

      const response: ApiResponse = {
        success: true,
        data: analysis,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '0.1.0',
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : 'Query analysis failed',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/search/trends/:userId
 * Get search trends and analytics for a user
 */
router.get(
  '/trends',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const trends = await searchController.getUserTrends(req.user!.id);

      const response: ApiResponse = {
        success: true,
        data: trends,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '0.1.0',
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'TRENDS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get trends',
        },
      } as ApiResponse);
    }
  }
);

/**
 * GET /api/v1/search/history
 * Get user's search history
 */
router.get(
  '/history',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await searchController.getSearchHistory(
        req.user!.id,
        limit,
        offset
      );

      const response: ApiResponse = {
        success: true,
        data: history,
        meta: {
          timestamp: new Date(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '0.1.0',
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get search history',
        },
      } as ApiResponse);
    }
  }
);

export { router as searchRoutes };

// src/controllers/SearchController.ts
import { logger } from '@/utils/logger';
import { SearchService } from '@/services/SearchService';
import { DatabaseService } from '@/services/DatabaseService';
import { AIService } from '@/services/AIService';
import { CacheService } from '@/services/CacheService';
import {
  SearchRequest,
  SearchResponse,
  QuerySuggestion,
  TrendInsight,
  SearchAnalytics
} from '@/types';

export class SearchController {
  private searchService: SearchService;
  private databaseService: DatabaseService;
  private aiService: AIService;
  private cacheService: CacheService;

  constructor () {
    this.databaseService = new DatabaseService();
    this.aiService = new AIService();
    this.cacheService = new CacheService();
    this.searchService = new SearchService(
      this.databaseService,
      this.aiService,
      this.cacheService
    );
  }

  /**
   * Execute a comprehensive search
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
   * Get search suggestions
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
      const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
        index === self.findIndex(s => s.text === suggestion.text)
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
      const analysis = {
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
          const dbAnalysis = await this.databaseService.analyzeQueryPerformance(
            dbId,
            params.query
          );
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
        }
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
