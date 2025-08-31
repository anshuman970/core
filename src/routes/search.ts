import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '@/middleware/auth';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { SearchController } from '@/controllers/SearchController';
import type { ApiResponse, SearchRequest, SearchResponse } from '@/types';

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
        databases: (req.query.databases as string[]) || [],
        tables: (req.query.tables as string[]) || [],
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
router.get('/trends', authenticate, async (req: AuthenticatedRequest, res) => {
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
});

/**
 * GET /api/v1/search/history
 * Get user's search history
 */
router.get('/history', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await searchController.getSearchHistory(req.user!.id, limit, offset);

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
});

export { router as searchRoutes };
