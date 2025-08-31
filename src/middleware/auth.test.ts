import { TestHelpers } from '@tests/utils/test-helpers';
import jwt from 'jsonwebtoken';
import { authenticate } from './auth';

describe.skip('Auth Middleware', () => {
  // Auth tests require MySQL to be running
  let mockReq: any;
  let mockRes: any;
  let nextFunction: jest.Mock;
  let testUser: any;

  beforeEach(async () => {
    mockReq = TestHelpers.mockRequest();
    mockRes = TestHelpers.mockResponse();
    nextFunction = jest.fn();

    testUser = await TestHelpers.createTestUser({
      email: 'auth@example.com',
      name: 'Auth Test User',
    });
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('Valid Token', () => {
    it('should allow access with valid JWT token', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken(testUser);
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe(testUser.id);
      expect(mockReq.user.email).toBe(testUser.email);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should extract user information correctly from token', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken({
        ...testUser,
        role: 'admin',
      });
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockReq.user).toEqual(
        expect.objectContaining({
          id: testUser.id,
          email: testUser.email,
          role: 'admin',
        })
      );
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Invalid Token', () => {
    it('should reject request with invalid token', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer invalid.token.here',
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      // Arrange
      const expiredToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject malformed token', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer malformed.token',
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Missing Token', () => {
    it('should reject request with no authorization header', async () => {
      // Arrange - no authorization header set

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'InvalidFormat token_here',
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_AUTH_FORMAT',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with empty Bearer token', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer ',
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: expect.any(String),
        },
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-insensitive Bearer prefix', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken(testUser);
      mockReq.headers = {
        authorization: `bearer ${validToken}`, // lowercase 'bearer'
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });

    it('should handle extra whitespace in authorization header', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken(testUser);
      mockReq.headers = {
        authorization: `  Bearer   ${validToken}  `, // extra whitespace
      };

      // Act
      await authenticate(mockReq, mockRes, nextFunction);

      // Assert
      expect(nextFunction).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should process valid tokens quickly', async () => {
      // Arrange
      const validToken = TestHelpers.generateTestToken(testUser);
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
      };

      // Act & Assert
      const { duration } = await TestHelpers.measurePerformance(async () => {
        await authenticate(mockReq, mockRes, nextFunction);
      });

      expect(duration).toBeLessThan(50); // Should be very fast (< 50ms)
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
