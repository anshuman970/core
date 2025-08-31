-- Migration: Create searches table
CREATE TABLE IF NOT EXISTS searches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36),
  query TEXT NOT NULL,
  result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
