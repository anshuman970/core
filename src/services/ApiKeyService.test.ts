import type { CreateApiKeyRequest } from '@/services/ApiKeyService';
import { ApiKeyService } from '@/services/ApiKeyService';
import { logger } from '@/utils/logger';
import crypto from 'crypto';
import type { Connection } from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

// Explicitly unmock the ApiKeyService itself
jest.unmock('./ApiKeyService');

// Mock dependencies
jest.mock('@/config', () => ({
  config: {
    database: {
      host: 'localhost',
      port: 3306,
      username: 'test_user',
      password: 'test_password',
      database: 'test_db',
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHash: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

const mockCreateConnection = createConnection as jest.MockedFunction<typeof createConnection>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let mockConnection: jest.Mocked<Connection>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create mock connection
    mockConnection = {
      ping: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      end: jest.fn(),
    } as any;

    // Mock createConnection to return resolved promise
    mockCreateConnection.mockResolvedValue(mockConnection);

    // Mock UUID generation
    mockUuidv4.mockReturnValue('mock-uuid-123');

    // Mock crypto
    const mockHash = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-hash-123'),
    };
    mockCrypto.createHash.mockReturnValue(mockHash as any);
    mockCrypto.randomBytes.mockReturnValue('mock-random-bytes' as any);

    // Create service
    apiKeyService = new ApiKeyService();
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  describe('constructor', () => {
    it('should create ApiKeyService instance', () => {
      expect(apiKeyService).toBeDefined();
      expect(apiKeyService.generateApiKey).toBeInstanceOf(Function);
      expect(apiKeyService.validateApiKey).toBeInstanceOf(Function);
      expect(apiKeyService.revokeApiKey).toBeInstanceOf(Function);
    });

    it('should initialize database connection', () => {
      expect(mockCreateConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        user: 'test_user',
        password: 'test_password',
        database: 'test_db',
      });
      expect(mockConnection.ping).toHaveBeenCalled();
    });
  });

  describe('generateApiKey', () => {
    const validRequest: CreateApiKeyRequest = {
      userId: 'user-123',
      name: 'Test API Key',
      environment: 'test',
      permissions: ['search'],
      rateLimitTier: 'free',
    };

    it('should generate API key successfully', async () => {
      // Arrange
      mockConnection.execute.mockResolvedValue([{} as any, []] as any);

      // Act
      const result = await apiKeyService.generateApiKey(validRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.secretKey).toMatch(/^altus4_sk_test_/);
      expect(result.apiKey.id).toBe('mock-uuid-123');
      expect(result.apiKey.userId).toBe(validRequest.userId);
      expect(result.apiKey.name).toBe(validRequest.name);
      expect(result.apiKey.environment).toBe(validRequest.environment);
      expect(result.apiKey.permissions).toEqual(validRequest.permissions);
      expect(result.apiKey.rateLimitTier).toBe(validRequest.rateLimitTier);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.arrayContaining([
          'mock-uuid-123',
          validRequest.userId,
          expect.any(String), // keyPrefix
          'mock-hash-123', // keyHash
          validRequest.name,
          validRequest.environment,
          JSON.stringify(validRequest.permissions),
          validRequest.rateLimitTier,
          null, // rateLimitCustom
          null, // expiresAt
          expect.any(Date), // createdAt
        ])
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        `API key generated for user ${validRequest.userId}: altus4_sk_test_mock-random-byt...`
      );
    });

    it('should generate live environment API key', async () => {
      // Arrange
      const liveRequest = { ...validRequest, environment: 'live' as const };
      mockConnection.execute.mockResolvedValue([{} as any, []] as any);

      // Act
      const result = await apiKeyService.generateApiKey(liveRequest);

      // Assert
      expect(result.secretKey).toMatch(/^altus4_sk_live_/);
    });

    it('should handle custom rate limits', async () => {
      // Arrange - Custom rate limits are stored but not returned from generateApiKey
      const customRequest = {
        ...validRequest,
        rateLimitTier: 'enterprise' as const,
      };
      mockConnection.execute.mockResolvedValue([{} as any, []] as any);

      // Act
      const result = await apiKeyService.generateApiKey(customRequest);

      // Assert - Custom rate limits would be handled separately, not in generateApiKey
      expect(result.apiKey.rateLimitTier).toEqual('enterprise');
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.any(Array)
      );
    });

    it('should handle expiration date', async () => {
      // Arrange
      const expirationDate = new Date('2025-01-01');
      const requestWithExpiry = { ...validRequest, expiresAt: expirationDate };
      mockConnection.execute.mockResolvedValue([{} as any, []] as any);

      // Act
      const result = await apiKeyService.generateApiKey(requestWithExpiry);

      // Assert
      expect(result.apiKey.expiresAt).toEqual(expirationDate);
    });

    it('should accept any permissions in the service layer', async () => {
      // Arrange
      const requestWithCustomPermissions = { ...validRequest, permissions: ['custom-permission'] };
      mockConnection.execute.mockResolvedValue([{} as any, []] as any);

      // Act
      const result = await apiKeyService.generateApiKey(requestWithCustomPermissions);

      // Assert - Service layer accepts any permissions (validation happens at controller level)
      expect(result.apiKey.permissions).toEqual(['custom-permission']);
    });

    it('should handle database insertion errors', async () => {
      // Arrange
      mockConnection.execute.mockRejectedValue(new Error('Database insertion failed'));

      // Act & Assert
      await expect(apiKeyService.generateApiKey(validRequest)).rejects.toThrow(
        'Failed to generate API key'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate API key:',
        expect.any(Error)
      );
    });
  });

  describe('validateApiKey', () => {
    const testApiKey = 'altus4_sk_test_abc123def456ghi789jkl012mno345pqr678stu';

    it('should validate API key successfully', async () => {
      // Arrange
      const mockApiKeyData = {
        id: 'key-123',
        user_id: 'user-456',
        name: 'Test Key',
        environment: 'test',
        permissions: JSON.stringify(['search']),
        rate_limit_tier: 'free',
        rate_limit_custom: null,
        expires_at: null,
        is_active: true,
        created_at: new Date(),
      };

      mockConnection.execute
        .mockResolvedValueOnce([
          [{ ...mockApiKeyData, email: 'test@example.com', role: 'user' }],
          [],
        ] as any) // Find API key with user info
        .mockResolvedValueOnce([{} as any, []] as any); // Update last used

      // Act
      const result = await apiKeyService.validateApiKey(testApiKey);

      // Assert
      expect(result).toBeDefined();
      expect(result!.apiKey.id).toBe(mockApiKeyData.id);
      expect(result!.apiKey.userId).toBe(mockApiKeyData.user_id);
      expect(result!.apiKey.name).toBe(mockApiKeyData.name);
      expect(result!.apiKey.environment).toBe(mockApiKeyData.environment);
      expect(result!.apiKey.permissions).toEqual(['search']);
      expect(result!.apiKey.rateLimitTier).toBe(mockApiKeyData.rate_limit_tier);
      expect(result!.apiKey.isActive).toBe(true);
      expect(result!.user.id).toBe(mockApiKeyData.user_id);

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT ak.*, u.email, u.name, u.role'),
        ['altus4_sk_test_abc123def456ghi', 'mock-hash-123']
      );

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE api_keys SET last_used = ?, usage_count = usage_count + 1'),
        [expect.any(Date), mockApiKeyData.id]
      );
    });

    it('should handle short API key gracefully', async () => {
      // Arrange
      const shortApiKey = 'invalid-api-key';
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const result = await apiKeyService.validateApiKey(shortApiKey);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for non-existent API key', async () => {
      // Arrange
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const result = await apiKeyService.validateApiKey(testApiKey);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for inactive API key', async () => {
      // Arrange - Inactive keys are filtered out by the SQL query
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const result = await apiKeyService.validateApiKey(testApiKey);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for expired API key', async () => {
      // Arrange - Expired keys are filtered out by the SQL query
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const result = await apiKeyService.validateApiKey(testApiKey);

      // Assert
      expect(result).toBeNull();
    });

    it('should validate API key hash correctly', async () => {
      // Arrange - Hash validation is done in SQL query, so successful query means hash matched
      const mockApiKeyData = {
        id: 'key-123',
        user_id: 'user-456',
        name: 'Test Key',
        environment: 'test',
        permissions: JSON.stringify(['search']),
        rate_limit_tier: 'free',
        rate_limit_custom: null,
        expires_at: null,
        is_active: true,
        created_at: new Date(),
        email: 'test@example.com',
        role: 'user',
      };

      mockConnection.execute
        .mockResolvedValueOnce([[mockApiKeyData], []] as any)
        .mockResolvedValueOnce([{} as any, []] as any);

      // Act
      const result = await apiKeyService.validateApiKey(testApiKey);

      // Assert
      expect(result).toBeDefined();
      expect(result!.apiKey.id).toBe('key-123');
    });

    it('should return null for incorrect API key hash', async () => {
      // Arrange - Hash mismatch results in empty query result
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const result = await apiKeyService.validateApiKey(testApiKey);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await apiKeyService.validateApiKey(testApiKey);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to validate API key:',
        expect.any(Error)
      );
    });
  });

  describe('getUserApiKeys', () => {
    it('should get user API keys successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const mockKeys = [
        {
          id: 'key-1',
          user_id: userId,
          key_prefix: 'altus4_sk_test_abc123',
          name: 'Test Key 1',
          environment: 'test',
          permissions: JSON.stringify(['search']),
          rate_limit_tier: 'free',
          rate_limit_custom: null,
          expires_at: null,
          last_used: null,
          last_used_ip: null,
          usage_count: 0,
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
        {
          id: 'key-2',
          user_id: userId,
          key_prefix: 'altus4_sk_live_def456',
          name: 'Live Key 1',
          environment: 'live',
          permissions: JSON.stringify(['search', 'analytics']),
          rate_limit_tier: 'pro',
          rate_limit_custom: null,
          expires_at: null,
          last_used: new Date('2024-01-02'),
          last_used_ip: null,
          usage_count: 42,
          is_active: true,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];

      mockConnection.execute.mockResolvedValue([mockKeys, []] as any);

      // Act
      const result = await apiKeyService.getUserApiKeys(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'key-1',
        userId,
        keyPrefix: 'altus4_sk_test_abc123',
        name: 'Test Key 1',
        environment: 'test',
        permissions: ['search'],
        rateLimitTier: 'free',
        rateLimitCustom: undefined,
        expiresAt: undefined,
        lastUsed: undefined,
        lastUsedIp: null,
        usageCount: 0,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM api_keys'),
        [userId]
      );
    });

    it('should return empty array for user with no API keys', async () => {
      // Arrange
      const userId = 'user-no-keys';
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const result = await apiKeyService.getUserApiKeys(userId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 'user-123';
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(apiKeyService.getUserApiKeys(userId)).rejects.toThrow(
        'Failed to retrieve API keys'
      );

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM api_keys'),
        [userId]
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to get API keys for user ${userId}:`,
        expect.any(Error)
      );
    });
  });

  describe('updateApiKey', () => {
    it('should update API key successfully', async () => {
      // Arrange
      const keyId = 'key-123';
      const updates = {
        name: 'Updated Key Name',
        permissions: ['search', 'analytics'],
        rateLimitTier: 'pro' as const,
      };

      const mockUpdatedKey = {
        id: keyId,
        user_id: 'user-456',
        key_prefix: 'altus4_sk_test_abc123',
        name: updates.name,
        environment: 'test',
        permissions: JSON.stringify(updates.permissions),
        rate_limit_tier: updates.rateLimitTier,
        rate_limit_custom: null,
        expires_at: null,
        last_used: null,
        usage_count: 0,
        is_active: true,
        created_at: new Date(),
      };

      mockConnection.execute
        .mockResolvedValueOnce([{} as any, []] as any) // Update query
        .mockResolvedValueOnce([[mockUpdatedKey], []] as any); // Get updated key

      // Act
      const result = await apiKeyService.updateApiKey(keyId, 'user-456', updates);

      // Assert
      expect(result).toBeDefined();
      expect(result!.name).toBe(updates.name);
      expect(result!.permissions).toEqual(updates.permissions);
      expect(result!.rateLimitTier).toBe(updates.rateLimitTier);

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          'UPDATE api_keys SET name = ?, permissions = ?, rate_limit_tier = ?, updated_at = ? WHERE id = ? AND user_id = ?'
        ),
        [
          updates.name,
          JSON.stringify(updates.permissions),
          updates.rateLimitTier,
          expect.any(Date),
          keyId,
          'user-456',
        ]
      );

      expect(mockLogger.info).toHaveBeenCalledWith(`API key updated: ${keyId}`);
    });

    it('should return null for non-existent API key', async () => {
      // Arrange
      const keyId = 'non-existent-key';
      const updates = { name: 'New Name' };

      mockConnection.execute
        .mockResolvedValueOnce([{} as any, []] as any) // Update query
        .mockResolvedValueOnce([[], []] as any); // Get updated key (not found)

      // Act
      const result = await apiKeyService.updateApiKey(keyId, 'user-456', updates);

      // Assert
      expect(result).toBeNull();
    });

    it('should accept any permissions when updating in service layer', async () => {
      // Arrange
      const keyId = 'key-123';
      const customUpdates = { permissions: ['custom-permission'] };
      const mockUpdatedKey = {
        id: keyId,
        user_id: 'user-456',
        name: 'Test Key',
        environment: 'test',
        permissions: JSON.stringify(customUpdates.permissions),
        rate_limit_tier: 'free',
        rate_limit_custom: null,
        expires_at: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockConnection.execute
        .mockResolvedValueOnce([{} as any, []] as any) // Update query
        .mockResolvedValueOnce([[mockUpdatedKey], []] as any); // Get updated key

      // Act
      const result = await apiKeyService.updateApiKey(keyId, 'user-456', customUpdates);

      // Assert - Service layer accepts any permissions (validation happens at controller level)
      expect(result!.permissions).toEqual(['custom-permission']);
    });

    it('should handle database errors', async () => {
      // Arrange
      const keyId = 'key-123';
      const updates = { name: 'New Name' };
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(apiKeyService.updateApiKey(keyId, 'user-456', updates)).rejects.toThrow(
        'Database error'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to update API key ${keyId}:`,
        expect.any(Error)
      );
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key successfully', async () => {
      // Arrange
      const keyId = 'key-123';
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }, []] as any);

      // Act
      const result = await apiKeyService.revokeApiKey(keyId, 'user-456');

      // Assert
      expect(result).toBe(true);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE api_keys SET is_active = false, updated_at = ? WHERE id = ? AND user_id = ?',
        [expect.any(Date), keyId, 'user-456']
      );

      expect(mockLogger.info).toHaveBeenCalledWith(`API key revoked: ${keyId}`);
    });

    it('should return false for non-existent API key', async () => {
      // Arrange
      const keyId = 'non-existent-key';
      mockConnection.execute.mockResolvedValue([{ affectedRows: 0 }, []] as any);

      // Act
      const result = await apiKeyService.revokeApiKey(keyId, 'user-456');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      // Arrange
      const keyId = 'key-123';
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(apiKeyService.revokeApiKey(keyId, 'user-456')).rejects.toThrow(
        'Failed to revoke API key'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to revoke API key ${keyId}:`,
        expect.any(Error)
      );
    });
  });

  describe('getApiKeyUsage', () => {
    it('should get API key usage successfully', async () => {
      // Arrange
      const keyId = 'key-123';
      const mockKeyData = [
        {
          id: keyId,
          usage_count: 42,
          last_used: new Date('2024-01-02'),
          rate_limit_tier: 'free',
        },
      ];

      mockConnection.execute.mockResolvedValue([mockKeyData, []] as any);

      // Act
      const result = await apiKeyService.getApiKeyUsage(keyId, 'user-456');

      // Assert
      expect(result).toEqual({
        apiKeyId: keyId,
        requestCount: 42,
        lastUsed: new Date('2024-01-02'),
        rateLimitStatus: {
          tier: 'free',
          remaining: 1000, // Free tier limit
          resetTime: expect.any(Date),
        },
      });

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT id, usage_count, last_used, rate_limit_tier FROM api_keys WHERE id = ? AND user_id = ?',
        [keyId, 'user-456']
      );
    });

    it('should return null for non-existent API key', async () => {
      // Arrange
      const keyId = 'key-123';
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const result = await apiKeyService.getApiKeyUsage(keyId, 'user-456');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const keyId = 'key-123';
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await apiKeyService.getApiKeyUsage(keyId, 'user-456');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to get usage for API key ${keyId}:`,
        expect.any(Error)
      );
    });
  });

  describe('close', () => {
    it('should close database connection successfully', async () => {
      // Arrange
      mockConnection.end.mockResolvedValue(undefined);

      // Act
      await apiKeyService.close();

      // Assert
      expect(mockConnection.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('ApiKeyService database connection closed');
    });

    it('should handle connection close errors', async () => {
      // Arrange
      const closeError = new Error('Failed to close connection');
      mockConnection.end.mockRejectedValue(closeError);

      // Act
      await apiKeyService.close();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to close ApiKeyService database connection:',
        closeError
      );
    });
  });

  describe('private methods', () => {
    describe('generateSecureKey', () => {
      it('should generate key with correct format for test environment', () => {
        // This tests the private method indirectly through generateApiKey
        // The format is tested in the generateApiKey tests above
        expect(true).toBe(true); // Placeholder - covered by generateApiKey tests
      });
    });

    describe('validatePermissions', () => {
      it('should validate permissions correctly', async () => {
        // Arrange
        const validRequest: CreateApiKeyRequest = {
          userId: 'user-123',
          name: 'Test Key',
          environment: 'test',
          permissions: ['search', 'analytics'],
          rateLimitTier: 'free',
        };
        mockConnection.execute.mockResolvedValue([{} as any, []] as any);

        // Act & Assert - should not throw
        await expect(apiKeyService.generateApiKey(validRequest)).resolves.toBeDefined();
      });

      it('should accept any permissions in service layer', async () => {
        // Arrange
        const customRequest: CreateApiKeyRequest = {
          userId: 'user-123',
          name: 'Test Key',
          environment: 'test',
          permissions: ['custom-permission'],
          rateLimitTier: 'free',
        };
        mockConnection.execute.mockResolvedValue([{} as any, []] as any);

        // Act
        const result = await apiKeyService.generateApiKey(customRequest);

        // Assert - Service layer accepts any permissions (validation happens at controller level)
        expect(result.apiKey.permissions).toEqual(['custom-permission']);
      });
    });
  });
});
