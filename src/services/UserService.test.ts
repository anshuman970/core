// Import config through the mock
import type { User } from '@/types';
import { logger } from '@/utils/logger';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { UserService } from './UserService';

// Explicitly unmock the UserService itself
jest.unmock('./UserService');

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
    jwtSecret: 'test-secret-key',
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

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

const mockCreateConnection = createConnection as jest.MockedFunction<typeof createConnection>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('UserService', () => {
  let userService: UserService;
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

    // Create service
    userService = new UserService();
    // Wait for initialization
    await new Promise(resolve => {
      setTimeout(resolve, 10);
    });
  });

  describe('constructor', () => {
    it('should create UserService instance', () => {
      expect(userService).toBeDefined();
      expect(userService.registerUser).toBeInstanceOf(Function);
      expect(userService.loginUser).toBeInstanceOf(Function);
      expect(userService.getUserById).toBeInstanceOf(Function);
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

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'john@example.com',
        password: 'password123',
        name: 'John Doe',
        role: 'user' as const,
      };
      const hashedPassword = 'hashed_password_123';
      const mockToken = 'mock-jwt-token';

      mockConnection.execute
        .mockResolvedValueOnce([[], []] as any) // Check if user exists (should be empty)
        .mockResolvedValueOnce([{} as any, []] as any); // Insert user

      (mockBcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (mockJwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = await userService.registerUser(userData);

      // Assert
      expect(result).toBeDefined();
      expect(result.user).toEqual({
        id: 'mock-uuid-123',
        email: userData.email,
        name: userData.name,
        role: userData.role,
        connectedDatabases: [],
        createdAt: expect.any(Date),
        lastActive: expect.any(Date),
      });
      expect(result.token).toBe(mockToken);

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        'SELECT id FROM users WHERE email = ?',
        [userData.email]
      );

      expect(mockBcrypt.hash).toHaveBeenCalledWith(userData.password, 12);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `User registered successfully: ${userData.email}`
      );
    });

    it('should register user with default role when role is not provided', async () => {
      // Arrange
      const userData = {
        email: 'jane@example.com',
        password: 'password123',
        name: 'Jane Doe',
      };

      mockConnection.execute
        .mockResolvedValueOnce([[], []] as any) // Check if user exists
        .mockResolvedValueOnce([{} as any, []] as any); // Insert user

      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (mockJwt.sign as jest.Mock).mockReturnValue('mock-token');

      // Act
      const result = await userService.registerUser(userData);

      // Assert
      expect(result.user.role).toBe('user');
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining(['user'])
      );
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
      };

      mockConnection.execute.mockResolvedValue([
        [{ id: 'existing-id' }] as RowDataPacket[],
        [],
      ] as any);

      // Act & Assert
      await expect(userService.registerUser(userData)).rejects.toThrow(
        'User with this email already exists'
      );

      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('User registration failed:', expect.any(Error));
    });

    it('should handle password hashing errors', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockConnection.execute.mockResolvedValue([[], []] as any);
      (mockBcrypt.hash as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

      // Act & Assert
      await expect(userService.registerUser(userData)).rejects.toThrow('Hashing failed');
      expect(mockLogger.error).toHaveBeenCalledWith('User registration failed:', expect.any(Error));
    });

    it('should handle database insertion errors', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockConnection.execute
        .mockResolvedValueOnce([[], []] as any) // Check if user exists
        .mockRejectedValueOnce(new Error('Database insertion failed')); // Insert fails

      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      // Act & Assert
      await expect(userService.registerUser(userData)).rejects.toThrow('Database insertion failed');
    });
  });

  describe('loginUser', () => {
    it('should login user successfully', async () => {
      // Arrange
      const credentials = {
        email: 'john@example.com',
        password: 'password123',
      };

      const mockUserData = {
        id: 'user-id-123',
        email: credentials.email,
        name: 'John Doe',
        password_hash: 'hashed_password_123',
        role: 'user',
        created_at: new Date('2023-01-01'),
        last_active: new Date('2023-01-01'),
      };

      const mockDatabases = [{ id: 'db1' }, { id: 'db2' }];
      const mockToken = 'mock-jwt-token';

      mockConnection.execute
        .mockResolvedValueOnce([[mockUserData], []] as any) // Get user
        .mockResolvedValueOnce([{} as any, []] as any) // Update last active
        .mockResolvedValueOnce([mockDatabases, []] as any); // Get connected databases

      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockJwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = await userService.loginUser(credentials);

      // Assert
      expect(result.user).toEqual({
        id: mockUserData.id,
        email: mockUserData.email,
        name: mockUserData.name,
        role: mockUserData.role,
        connectedDatabases: ['db1', 'db2'],
        createdAt: new Date(mockUserData.created_at),
        lastActive: expect.any(Date),
      });
      expect(result.token).toBe(mockToken);

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          'SELECT id, email, name, password_hash, role, created_at, last_active'
        ),
        [credentials.email]
      );

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        credentials.password,
        mockUserData.password_hash
      );

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE users SET last_active = ? WHERE id = ?',
        [expect.any(Date), mockUserData.id]
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        `User logged in successfully: ${credentials.email}`
      );
    });

    it('should throw error if user not found', async () => {
      // Arrange
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act & Assert
      await expect(userService.loginUser(credentials)).rejects.toThrow('Invalid email or password');

      expect(mockBcrypt.compare).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('User login failed:', expect.any(Error));
    });

    it('should throw error if password is invalid', async () => {
      // Arrange
      const credentials = {
        email: 'john@example.com',
        password: 'wrongpassword',
      };

      const mockUserData = {
        id: 'user-id-123',
        password_hash: 'hashed_password_123',
      };

      mockConnection.execute.mockResolvedValue([[mockUserData], []] as any);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(userService.loginUser(credentials)).rejects.toThrow('Invalid email or password');

      expect(mockConnection.execute).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET last_active'),
        expect.any(Array)
      );
    });

    it('should handle bcrypt comparison errors', async () => {
      // Arrange
      const credentials = {
        email: 'john@example.com',
        password: 'password123',
      };

      const mockUserData = {
        password_hash: 'hashed_password_123',
      };

      mockConnection.execute.mockResolvedValue([[mockUserData], []] as any);
      (mockBcrypt.compare as jest.Mock).mockRejectedValue(new Error('Bcrypt comparison failed'));

      // Act & Assert
      await expect(userService.loginUser(credentials)).rejects.toThrow('Bcrypt comparison failed');
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      // Arrange
      const userId = 'user-id-123';
      const mockUserData = {
        id: userId,
        email: 'john@example.com',
        name: 'John Doe',
        role: 'user',
        created_at: new Date('2023-01-01'),
        last_active: new Date('2023-01-02'),
      };
      const mockDatabases = [{ id: 'db1' }, { id: 'db2' }];

      mockConnection.execute
        .mockResolvedValueOnce([[mockUserData], []] as any) // Get user
        .mockResolvedValueOnce([mockDatabases, []] as any); // Get connected databases

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toEqual({
        id: userId,
        email: 'john@example.com',
        name: 'John Doe',
        role: 'user',
        connectedDatabases: ['db1', 'db2'],
        createdAt: new Date('2023-01-01'),
        lastActive: new Date('2023-01-02'),
      });

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT id, email, name, role, created_at, last_active'),
        [userId]
      );
    });

    it('should return null if user not found', async () => {
      // Arrange
      const userId = 'nonexistent-id';
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const userId = 'user-id-123';
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to get user by ID ${userId}:`,
        expect.any(Error)
      );
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Arrange
      const userId = 'user-id-123';
      const updates = {
        name: 'John Smith',
        email: 'johnsmith@example.com',
      };

      const mockUpdatedUser: User = {
        id: userId,
        email: updates.email,
        name: updates.name,
        role: 'user',
        connectedDatabases: [],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockConnection.execute.mockResolvedValue([{} as any, []] as any);

      // Mock getUserById to return updated user
      jest.spyOn(userService, 'getUserById').mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await userService.updateUser(userId, updates);

      // Assert
      expect(result).toEqual(mockUpdatedUser);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?',
        [updates.name, updates.email, expect.any(Date), userId]
      );

      expect(mockLogger.info).toHaveBeenCalledWith(`User updated successfully: ${userId}`);
    });

    it('should update only name when email is not provided', async () => {
      // Arrange
      const userId = 'user-id-123';
      const updates = { name: 'John Smith' };

      mockConnection.execute.mockResolvedValue([{} as any, []] as any);
      jest.spyOn(userService, 'getUserById').mockResolvedValue({} as User);

      // Act
      await userService.updateUser(userId, updates);

      // Assert
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE users SET name = ?, updated_at = ? WHERE id = ?',
        [updates.name, expect.any(Date), userId]
      );
    });

    it('should return user without changes when no updates provided', async () => {
      // Arrange
      const userId = 'user-id-123';
      const mockUser = { id: userId } as User;

      jest.spyOn(userService, 'getUserById').mockResolvedValue(mockUser);

      // Act
      const result = await userService.updateUser(userId, {});

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockConnection.execute).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.any(Array)
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 'user-id-123';
      const updates = { name: 'John Smith' };

      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(userService.updateUser(userId, updates)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to update user ${userId}:`,
        expect.any(Error)
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const userId = 'user-id-123';
      const currentPassword = 'oldpassword';
      const newPassword = 'newpassword';
      const mockHashedPassword = 'new_hashed_password';

      mockConnection.execute
        .mockResolvedValueOnce([[{ password_hash: 'old_hashed_password' }], []] as any) // Get current password
        .mockResolvedValueOnce([{} as any, []] as any); // Update password

      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockBcrypt.hash as jest.Mock).mockResolvedValue(mockHashedPassword);

      // Act
      const result = await userService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result).toBe(true);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(currentPassword, 'old_hashed_password');
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        [mockHashedPassword, expect.any(Date), userId]
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        `Password changed successfully for user: ${userId}`
      );
    });

    it('should throw error if user not found', async () => {
      // Arrange
      const userId = 'nonexistent-id';
      mockConnection.execute.mockResolvedValue([[], []] as any);

      // Act & Assert
      await expect(userService.changePassword(userId, 'oldpass', 'newpass')).rejects.toThrow(
        'User not found'
      );

      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error if current password is incorrect', async () => {
      // Arrange
      const userId = 'user-id-123';
      mockConnection.execute.mockResolvedValue([[{ password_hash: 'hashed_password' }], []] as any);
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        userService.changePassword(userId, 'wrongpassword', 'newpassword')
      ).rejects.toThrow('Current password is incorrect');

      expect(mockBcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      // Arrange
      const userId = 'user-id-123';
      mockConnection.execute.mockResolvedValue([{} as any, []] as any);

      // Act
      const result = await userService.deactivateUser(userId);

      // Assert
      expect(result).toBe(true);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE users SET is_active = false, updated_at = ? WHERE id = ?',
        [expect.any(Date), userId]
      );

      expect(mockLogger.info).toHaveBeenCalledWith(`User deactivated successfully: ${userId}`);
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 'user-id-123';
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(userService.deactivateUser(userId)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to deactivate user ${userId}:`,
        expect.any(Error)
      );
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token successfully', () => {
      // Arrange
      const user: User = {
        id: 'user-id-123',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'user',
        connectedDatabases: [],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      const mockToken = 'mock-jwt-token';
      (mockJwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const token = userService.generateToken(user);

      // Assert
      expect(token).toBe(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        'test-secret-key',
        { expiresIn: '7d' }
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify JWT token successfully', () => {
      // Arrange
      const token = 'valid-jwt-token';
      const mockPayload = {
        id: 'user-id-123',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'user',
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(mockPayload);

      // Act
      const result = userService.verifyToken(token);

      // Assert
      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
    });

    it('should handle invalid token', () => {
      // Arrange
      const token = 'invalid-jwt-token';
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      expect(() => userService.verifyToken(token)).toThrow('Invalid or expired token');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Token verification failed:',
        expect.any(Error)
      );
    });
  });

  describe('getAllUsers', () => {
    it('should get all users with pagination', async () => {
      // Arrange
      const page = 1;
      const limit = 20;

      const mockCountResult = [{ total: 50 }];
      const mockUsersData = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'user',
          created_at: new Date('2023-01-01'),
          last_active: new Date('2023-01-02'),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User 2',
          role: 'admin',
          created_at: new Date('2023-01-03'),
          last_active: new Date('2023-01-04'),
        },
      ];

      mockConnection.execute
        .mockResolvedValueOnce([mockCountResult, []] as any) // Get count
        .mockResolvedValueOnce([mockUsersData, []] as any) // Get users
        .mockResolvedValueOnce([[{ id: 'db1' }], []] as any) // Get databases for user 1
        .mockResolvedValueOnce([[{ id: 'db2' }], []] as any); // Get databases for user 2

      // Act
      const result = await userService.getAllUsers(page, limit);

      // Assert
      expect(result.total).toBe(50);
      expect(result.users).toHaveLength(2);
      expect(result.users[0]).toEqual({
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        role: 'user',
        connectedDatabases: ['db1'],
        createdAt: new Date('2023-01-01'),
        lastActive: new Date('2023-01-02'),
      });

      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('LIMIT ? OFFSET ?'),
        [limit, 0]
      );
    });

    it('should handle custom page and limit', async () => {
      // Arrange
      const page = 3;
      const limit = 10;

      mockConnection.execute
        .mockResolvedValueOnce([[{ total: 25 }], []] as any) // Get count
        .mockResolvedValueOnce([[], []] as any); // Get users (empty)

      // Act
      await userService.getAllUsers(page, limit);

      // Assert
      expect(mockConnection.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('LIMIT ? OFFSET ?'),
        [limit, 20] // (page - 1) * limit = 2 * 10 = 20
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(userService.getAllUsers()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get all users:', expect.any(Error));
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      // Arrange
      const userId = 'user-id-123';
      const newRole = 'admin';
      mockConnection.execute.mockResolvedValue([{} as any, []] as any);

      // Act
      const result = await userService.updateUserRole(userId, newRole);

      // Assert
      expect(result).toBe(true);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
        [newRole, expect.any(Date), userId]
      );

      expect(mockLogger.info).toHaveBeenCalledWith(`User role updated: ${userId} -> ${newRole}`);
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 'user-id-123';
      const newRole = 'admin';
      mockConnection.execute.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(userService.updateUserRole(userId, newRole)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to update user role for ${userId}:`,
        expect.any(Error)
      );
    });
  });

  describe('close', () => {
    it('should close database connection successfully', async () => {
      // Arrange
      mockConnection.end.mockResolvedValue(undefined);

      // Act
      await userService.close();

      // Assert
      expect(mockConnection.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('UserService database connection closed');
    });

    it('should handle connection close errors', async () => {
      // Arrange
      const closeError = new Error('Failed to close connection');
      mockConnection.end.mockRejectedValue(closeError);

      // Act
      await userService.close();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to close UserService database connection:',
        closeError
      );
    });
  });
});
