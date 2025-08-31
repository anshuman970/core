export interface DatabaseConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string; // Will be encrypted in storage
  ssl?: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface SearchRequest {
  query: string;
  databases?: string[];
  tables?: string[];
  columns?: string[];
  filters?: Record<string, any>;
  searchMode?: 'natural' | 'boolean' | 'semantic';
  limit?: number;
  offset?: number;
  includeAnalytics?: boolean;
  userId: string;
}

export interface SearchResult {
  id: string;
  table: string;
  database: string;
  relevanceScore: number;
  matchedColumns: string[];
  data: Record<string, any>;
  snippet?: string;
  categories?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  categories: Category[];
  suggestions: QuerySuggestion[];
  trends?: TrendInsight[];
  queryOptimization?: OptimizationSuggestion[];
  totalCount: number;
  executionTime: number;
  page: number;
  limit: number;
}

export interface Category {
  name: string;
  count: number;
  confidence: number;
}

export interface QuerySuggestion {
  text: string;
  score: number;
  type: 'spelling' | 'semantic' | 'popular';
}

export interface TrendInsight {
  period: 'day' | 'week' | 'month' | '3months' | '6months' | 'year';
  topQueries: string[];
  queryVolume: number;
  avgResponseTime: number;
  popularCategories: string[];
}

export interface OptimizationSuggestion {
  type: 'index' | 'query' | 'schema';
  description: string;
  impact: 'low' | 'medium' | 'high';
  sqlSuggestion?: string;
}

export interface TableSchema {
  database: string;
  table: string;
  columns: ColumnInfo[];
  fullTextIndexes: FullTextIndex[];
  estimatedRows: number;
  lastAnalyzed: Date;
}

export interface ColumnInfo {
  name: string;
  type: string;
  isFullTextIndexed: boolean;
  isSearchable: boolean;
  dataPreview?: string[];
}

export interface FullTextIndex {
  name: string;
  columns: string[];
  type: 'FULLTEXT';
  cardinality?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  connectedDatabases: string[];
  createdAt: Date;
  lastActive: Date;
}

export interface SearchAnalytics {
  id: string;
  userId: string;
  query: string;
  database: string;
  executionTime: number;
  resultCount: number;
  clickedResults?: string[];
  satisfaction?: number;
  timestamp: Date;
}

export interface AIInsight {
  type: 'query_optimization' | 'trend_analysis' | 'semantic_enhancement';
  confidence: number;
  description: string;
  actionable: boolean;
  data: Record<string, any>;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}

// Database connection pool configuration
export interface ConnectionPoolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
  reconnect: boolean;
  ssl?: string | boolean;
}

// Configuration interfaces
export interface AppConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  jwtSecret: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}
