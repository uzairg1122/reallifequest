-- Apply after migration-005-xp-ledger.sql. Safe to repeat; preserves existing data.
-- Family-vs-family challenges: an opt-in, code-joined competition scored from the XP ledger.

CREATE TABLE IF NOT EXISTS challenges (
  id CHAR(36) PRIMARY KEY,
  owner_family_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(8) NOT NULL,
  iso_week CHAR(8) NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_family_id) REFERENCES families(id) ON DELETE CASCADE,
  INDEX (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS challenge_families (
  challenge_id CHAR(36) NOT NULL,
  family_id CHAR(36) NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (challenge_id, family_id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
