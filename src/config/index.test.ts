import { config, generateEnvTemplate, validateConfig } from './index';

describe('Config Module', () => {
  describe('config object', () => {
    it('should have required properties', () => {
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('jwtSecret');
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('redis');
      expect(config).toHaveProperty('openai');
      expect(config).toHaveProperty('rateLimit');
    });

    it('should parse environment variables correctly', () => {
      expect(typeof config.port).toBe('number');
      expect(['development', 'production', 'test']).toContain(config.environment);
      expect(typeof config.jwtSecret).toBe('string');
      expect(typeof config.database.host).toBe('string');
      expect(typeof config.redis.host).toBe('string');
      expect(typeof config.openai.apiKey).toBe('string');
      expect(typeof config.rateLimit.windowMs).toBe('number');
    });
  });

  describe('validateConfig', () => {
    it('should not throw for valid config', () => {
      expect(() => validateConfig()).not.toThrow();
    });

    it('should throw if port is out of range', () => {
      const originalPort = config.port;
      (config as any).port = 70000;
      expect(() => validateConfig()).toThrow('PORT must be between 1 and 65535');
      (config as any).port = originalPort;
    });

    it('should throw if JWT_SECRET is too short', () => {
      const originalSecret = config.jwtSecret;
      (config as any).jwtSecret = 'short';
      expect(() => validateConfig()).toThrow(/JWT_SECRET must be at least/);
      (config as any).jwtSecret = originalSecret;
    });

    it('should throw if NODE_ENV is invalid', () => {
      const originalEnv = config.environment;
      (config as any).environment = 'invalid_env';
      expect(() => validateConfig()).toThrow(
        'NODE_ENV must be one of: development, production, test'
      );
      (config as any).environment = originalEnv;
    });
  });

  describe('generateEnvTemplate', () => {
    it('should return a string containing environment variable keys', () => {
      const template = generateEnvTemplate();
      expect(typeof template).toBe('string');
      expect(template).toContain('NODE_ENV');
      expect(template).toContain('DB_HOST');
      expect(template).toContain('JWT_SECRET');
      expect(template).toContain('OPENAI_API_KEY');
    });
  });
});
