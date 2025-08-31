-- 001_create_users_table.up.sql
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 001_create_users_table.down.sql
DROP TABLE IF EXISTS users;

-- 002_create_searches_table.up.sql
CREATE TABLE IF NOT EXISTS searches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36),
  query TEXT NOT NULL,
  result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 002_create_searches_table.down.sql
DROP TABLE IF EXISTS searches;

-- 003_create_analytics_table.up.sql
CREATE TABLE IF NOT EXISTS analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 003_create_analytics_table.down.sql
DROP TABLE IF EXISTS analytics;
