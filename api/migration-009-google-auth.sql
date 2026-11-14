CREATE TABLE IF NOT EXISTS auth_identities (
  provider VARCHAR(20) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, subject),
  UNIQUE KEY user_provider (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce_hash CHAR(64) PRIMARY KEY,
  expires_at DATETIME NOT NULL,
  INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
