-- migration-007: co-parent role, invite brute-force lockout, cross-family weekly league,
-- season archive, and referral tracking. Idempotent. Apply after migration-006-challenges.sql.

-- 1. Allow a co-parent membership role alongside parent/child.
SET @rlq_sql = IF((SELECT LOCATE('co_parent',COLUMN_TYPE) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='family_members' AND COLUMN_NAME='role')>0,'SELECT 1','ALTER TABLE family_members MODIFY COLUMN role ENUM(''parent'',''child'',''co_parent'') NOT NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

-- 2. Invite kind on pairing codes: child pairing vs co-parent invite.
SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pairing_codes' AND COLUMN_NAME='kind'),'SELECT 1','ALTER TABLE pairing_codes ADD COLUMN kind ENUM(''child'',''co_parent'') NOT NULL DEFAULT ''child'' AFTER family_id');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

-- 3. Stable per-family referral code (generated on first request).
SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='families' AND COLUMN_NAME='referral_code'),'SELECT 1','ALTER TABLE families ADD COLUMN referral_code VARCHAR(12) NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

-- 4. Brute-force lockout for invite/join code attempts (mirrors child_login_limits).
CREATE TABLE IF NOT EXISTS invite_attempt_limits (
  attempt_key CHAR(64) PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 1,
  window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Current league division per child, grouped by age band (1=Gold, 2=Silver, 3=Bronze).
CREATE TABLE IF NOT EXISTS league_members (
  child_id CHAR(36) PRIMARY KEY,
  age_band ENUM('little','junior','teen') NOT NULL DEFAULT 'junior',
  division INT NOT NULL DEFAULT 3,
  updated_week CHAR(8) NOT NULL,
  FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (age_band, division)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Season archive: finalized weekly standings with promote/relegate movement.
CREATE TABLE IF NOT EXISTS league_history (
  id CHAR(36) PRIMARY KEY,
  iso_week CHAR(8) NOT NULL,
  age_band ENUM('little','junior','teen') NOT NULL,
  division INT NOT NULL,
  child_id CHAR(36) NOT NULL,
  xp INT NOT NULL DEFAULT 0,
  rank_pos INT NOT NULL DEFAULT 0,
  movement ENUM('promoted','relegated','stayed') NOT NULL DEFAULT 'stayed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (iso_week, age_band, division),
  INDEX (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Season close guard: one row per closed ISO week keeps promote/relegate idempotent.
CREATE TABLE IF NOT EXISTS league_seasons (
  iso_week CHAR(8) PRIMARY KEY,
  closed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Referral signups (one per new user).
CREATE TABLE IF NOT EXISTS referrals (
  id CHAR(36) PRIMARY KEY,
  referrer_family_id CHAR(36) NOT NULL,
  new_user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_new_user (new_user_id),
  FOREIGN KEY (referrer_family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (new_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
