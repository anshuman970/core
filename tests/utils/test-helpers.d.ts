import type { Connection } from 'mysql2/promise';
import type Redis from 'ioredis';
import type { DatabaseConnection, User } from '@/types';
export declare class TestHelpers {
    private static dbConnection;
    private static redisConnection;
    /**
     * Get test database connection
     */
    static getDbConnection(): Promise<Connection>;
    /**
     * Get test Redis connection
     */
    static getRedisConnection(): Promise<Redis>;
    /**
     * Create a test user
     */
    static createTestUser(override?: Partial<User>): Promise<User & {
        password: string;
    }>;
    /**
     * Create a test database connection
     */
    static createTestDatabaseConnection(userId: string, override?: Partial<DatabaseConnection>): Promise<DatabaseConnection>;
    /**
     * Generate JWT token for testing
     */
    static generateTestToken(user: User): string;
    /**
     * Clean up test data
     */
    static cleanupTestData(): Promise<void>;
    /**
     * Insert test search data
     */
    static insertTestContent(content: Array<{
        title: string;
        content: string;
        category?: string;
    }>): Promise<void>;
    /**
     * Wait for async operations
     */
    static wait(ms: number): Promise<void>;
    /**
     * Close test connections
     */
    static closeConnections(): Promise<void>;
    /**
     * Mock Express request object
     */
    static mockRequest(overrides?: any): any;
    /**
     * Mock Express response object
     */
    static mockResponse(): any;
    /**
     * Assert response structure
     */
    static assertApiResponse(response: any, expectedData?: any): void;
    /**
     * Create mock database service
     */
    static createMockDatabaseService(): any;
    /**
     * Create mock cache service
     */
    static createMockCacheService(): any;
    /**
     * Performance measurement
     */
    static measurePerformance<T>(operation: () => Promise<T>): Promise<{
        result: T;
        duration: number;
        memoryUsage: NodeJS.MemoryUsage;
    }>;
}
//# sourceMappingURL=test-helpers.d.ts.map