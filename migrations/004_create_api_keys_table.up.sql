-- Migration: Create API keys table for B2B authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  key_prefix VARCHAR(30) NOT NULL, -- 'altus4_sk_live_abc123def456'
  key_hash VARCHAR(64) NOT NULL,   -- SHA-256 hash of full key
  name VARCHAR(255) NOT NULL,      -- 'Production Server', 'Development API'
  environment ENUM('test', 'live') NOT NULL DEFAULT 'test',
  permissions JSON DEFAULT ('["search"]'), -- ["search", "analytics", "admin"]
  rate_limit_tier ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  rate_limit_custom JSON NULL,     -- Custom rate limits if needed
  expires_at TIMESTAMP NULL,       -- NULL = never expires
  last_used TIMESTAMP NULL,
  last_used_ip VARCHAR(45) NULL,   -- IPv4/IPv6 support
  usage_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_key_prefix (key_prefix),
  INDEX idx_user_id (user_id),
  INDEX idx_environment (environment),
  INDEX idx_active_keys (is_active, expires_at),
  INDEX idx_last_used (last_used),

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
