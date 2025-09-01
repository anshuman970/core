-- Migration: Revert users table changes
ALTER TABLE users
DROP COLUMN password_hash,
DROP COLUMN is_active,
DROP COLUMN last_active;

-- Restore password to NOT NULL
ALTER TABLE users
MODIFY COLUMN password VARCHAR(255) NOT NULL;

-- Drop indexes
ALTER TABLE users DROP INDEX idx_email_active;
ALTER TABLE users DROP INDEX idx_last_active;
