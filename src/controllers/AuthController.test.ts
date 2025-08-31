import { AuthController } from './AuthController';
import { UserService } from '@/services/UserService';
import type { User } from '@/types';

// Mock the UserService
jest.mock('@/services/UserService');
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AuthController', () => {
  let authController: AuthController;
  let mockUserService: jest.Mocked<UserService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user' as const,
    connectedDatabases: [],
    createdAt: new Date('2024-01-01'),
    lastActive: new Date('2024-01-01'),
  };

  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked UserService instance
    mockUserService = {
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      getUserById: jest.fn(),
      updateUser: jest.fn(),
      changePassword: jest.fn(),
      deactivateUser: jest.fn(),
      verifyToken: jest.fn(),
      generateToken: jest.fn(),
    } as any;

    // Mock the UserService constructor
    (UserService as jest.MockedClass<typeof UserService>).mockImplementation(() => mockUserService);

    authController = new AuthController();
  });

  describe('register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
      role: 'user' as const,
    };

    it('should register a user successfully', async () => {
      const expectedResult = { user: mockUser, token: mockToken };
      mockUserService.registerUser.mockResolvedValue(expectedResult);

      const result = await authController.register(validUserData);

      expect(mockUserService.registerUser).toHaveBeenCalledWith({
        ...validUserData,
        name: 'Test User',
        email: 'test@example.com',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid email format', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' };

      await expect(authController.register(invalidData)).rejects.toThrow('Invalid email format');
      expect(mockUserService.registerUser).not.toHaveBeenCalled();
    });

    it('should throw error for weak password', async () => {
      const invalidData = { ...validUserData, password: 'weak' };

      await expect(authController.register(invalidData)).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
      expect(mockUserService.registerUser).not.toHaveBeenCalled();
    });

    it('should throw error for short name', async () => {
      const invalidData = { ...validUserData, name: 'A' };

      await expect(authController.register(invalidData)).rejects.toThrow(
        'Name must be at least 2 characters long'
      );
      expect(mockUserService.registerUser).not.toHaveBeenCalled();
    });

    it('should trim and lowercase email, trim name', async () => {
      const dataWithSpaces = {
        ...validUserData,
        email: 'TEST@EXAMPLE.COM',
        name: '  Test User  ',
      };
      const expectedResult = { user: mockUser, token: mockToken };
      mockUserService.registerUser.mockResolvedValue(expectedResult);

      await authController.register(dataWithSpaces);

      expect(mockUserService.registerUser).toHaveBeenCalledWith({
        ...dataWithSpaces,
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should handle UserService errors', async () => {
      const serviceError = new Error('Email already exists');
      mockUserService.registerUser.mockRejectedValue(serviceError);

      await expect(authController.register(validUserData)).rejects.toThrow('Email already exists');
    });
  });

  describe('login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    it('should login successfully', async () => {
      const expectedResult = { user: mockUser, token: mockToken };
      mockUserService.loginUser.mockResolvedValue(expectedResult);

      const result = await authController.login(validCredentials);

      expect(mockUserService.loginUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should throw error for missing email', async () => {
      const invalidCredentials = { ...validCredentials, email: '' };

      await expect(authController.login(invalidCredentials)).rejects.toThrow(
        'Email and password are required'
      );
      expect(mockUserService.loginUser).not.toHaveBeenCalled();
    });

    it('should throw error for missing password', async () => {
      const invalidCredentials = { ...validCredentials, password: '' };

      await expect(authController.login(invalidCredentials)).rejects.toThrow(
        'Email and password are required'
      );
      expect(mockUserService.loginUser).not.toHaveBeenCalled();
    });

    it('should trim and lowercase email', async () => {
      const credentialsWithSpaces = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'SecurePass123!',
      };
      const expectedResult = { user: mockUser, token: mockToken };
      mockUserService.loginUser.mockResolvedValue(expectedResult);

      await authController.login(credentialsWithSpaces);

      expect(mockUserService.loginUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Invalid credentials');
      mockUserService.loginUser.mockRejectedValue(authError);

      await expect(authController.login(validCredentials)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      mockUserService.getUserById.mockResolvedValue(mockUser);

      const result = await authController.getProfile('user-123');

      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserService.getUserById.mockResolvedValue(null);

      const result = await authController.getProfile('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Database connection failed');
      mockUserService.getUserById.mockRejectedValue(serviceError);

      await expect(authController.getProfile('user-123')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('updateProfile', () => {
    const validUpdates = { name: 'Updated Name', email: 'updated@example.com' };

    it('should update profile successfully', async () => {
      const updatedUser = { ...mockUser, ...validUpdates };
      mockUserService.updateUser.mockResolvedValue(updatedUser);

      const result = await authController.updateProfile('user-123', validUpdates);

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        name: 'Updated Name',
        email: 'updated@example.com',
      });
      expect(result).toEqual(updatedUser);
    });

    it('should validate and normalize email', async () => {
      const updates = { email: 'UPDATED@EXAMPLE.COM' };
      mockUserService.updateUser.mockResolvedValue(mockUser);

      await authController.updateProfile('user-123', updates);

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        email: 'updated@example.com',
      });
    });

    it('should validate and trim name', async () => {
      const updates = { name: '  Updated Name  ' };
      mockUserService.updateUser.mockResolvedValue(mockUser);

      await authController.updateProfile('user-123', updates);

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        name: 'Updated Name',
      });
    });

    it('should throw error for invalid email', async () => {
      const updates = { email: 'invalid-email' };

      await expect(authController.updateProfile('user-123', updates)).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should throw error for short name', async () => {
      const updates = { name: 'A' };

      await expect(authController.updateProfile('user-123', updates)).rejects.toThrow(
        'Name must be at least 2 characters long'
      );
    });
  });

  describe('changePassword', () => {
    const validPasswords = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass123!',
    };

    it('should change password successfully', async () => {
      mockUserService.changePassword.mockResolvedValue(true);

      const result = await authController.changePassword('user-123', validPasswords);

      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        'user-123',
        'OldPass123!',
        'NewPass123!'
      );
      expect(result).toBe(true);
    });

    it('should validate password length', async () => {
      const invalidPasswords = { ...validPasswords, newPassword: 'short' };

      await expect(authController.changePassword('user-123', invalidPasswords)).rejects.toThrow(
        'New password must be at least 8 characters long'
      );
    });

    it('should validate password complexity', async () => {
      const weakPassword = 'newpassword123'; // Missing uppercase and special chars
      const invalidPasswords = { ...validPasswords, newPassword: weakPassword };

      await expect(authController.changePassword('user-123', invalidPasswords)).rejects.toThrow(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      );
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Current password is incorrect');
      mockUserService.changePassword.mockRejectedValue(serviceError);

      await expect(authController.changePassword('user-123', validPasswords)).rejects.toThrow(
        'Current password is incorrect'
      );
    });
  });

  describe('refreshToken', () => {
    const validToken = 'valid-jwt-token';
    const decodedToken = { id: 'user-123', email: 'test@example.com' };

    it('should refresh token successfully', async () => {
      mockUserService.verifyToken.mockReturnValue(decodedToken);
      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockUserService.generateToken.mockReturnValue('new-jwt-token');

      const result = await authController.refreshToken(validToken);

      expect(mockUserService.verifyToken).toHaveBeenCalledWith(validToken);
      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockUserService.generateToken).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({ user: mockUser, token: 'new-jwt-token' });
    });

    it('should throw error when user not found', async () => {
      mockUserService.verifyToken.mockReturnValue(decodedToken);
      mockUserService.getUserById.mockResolvedValue(null);

      await expect(authController.refreshToken(validToken)).rejects.toThrow('User not found');
    });

    it('should handle token verification errors', async () => {
      mockUserService.verifyToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(authController.refreshToken('invalid-token')).rejects.toThrow('Token expired');
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate account successfully', async () => {
      mockUserService.deactivateUser.mockResolvedValue(true);

      const result = await authController.deactivateAccount('user-123');

      expect(mockUserService.deactivateUser).toHaveBeenCalledWith('user-123');
      expect(result).toBe(true);
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('User not found');
      mockUserService.deactivateUser.mockRejectedValue(serviceError);

      await expect(authController.deactivateAccount('user-123')).rejects.toThrow('User not found');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const result = await authController.logout('user-123');

      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Simulate an error in the try block (though currently there's none)
      const result = await authController.logout('user-123');

      expect(result).toBe(true);
    });
  });
});