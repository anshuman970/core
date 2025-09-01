-- Migration: Update users table for API key authentication
ALTER TABLE users
ADD COLUMN password_hash VARCHAR(255) NULL AFTER password,
ADD COLUMN is_active BOOLEAN DEFAULT true AFTER role,
ADD COLUMN last_active TIMESTAMP NULL AFTER updated_at;

-- Make password nullable since API-only users might not have passwords
ALTER TABLE users
MODIFY COLUMN password VARCHAR(255) NULL;

-- Update existing records to have password_hash from password field
UPDATE users SET password_hash = password WHERE password IS NOT NULL;

-- Add index for better performance
ALTER TABLE users ADD INDEX idx_email_active (email, is_active);
ALTER TABLE users ADD INDEX idx_last_active (last_active);
