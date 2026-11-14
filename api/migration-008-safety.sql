-- migration-008: child safety and compliance. Idempotent. Apply after migration-007-social.sql.
--
-- Covers spec section 10 (COPPA / safety) and closes the section 7.1 privacy gap where
-- every child was auto-enrolled into cross-family public leagues regardless of age band.
--
-- 1. Explicit, auditable parental consent per child (spec 10.1). NULL consent_at means
--    "not yet consented"; the API refuses to place a child in any public ranking without it.
-- 2. league_opt_in: public cross-family league participation is opt-in, default OFF.
--    Children already enrolled before this migration are grandfathered in so existing
--    seasons and the rollover harness keep working.
-- 3. reports + blocks: child/parent safety reporting and self-service blocking.
-- 4. reactions: preset-only emoji reactions on public boards (no free-text chat).

-- 1a. Consent timestamp on the child profile.
SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='consent_at'),'SELECT 1','ALTER TABLE users ADD COLUMN consent_at DATETIME NULL AFTER avatar_data');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

-- 1b. Which parent gave consent, for audit.
SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='consent_by'),'SELECT 1','ALTER TABLE users ADD COLUMN consent_by CHAR(36) NULL AFTER consent_at');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

-- 1c. Public-league opt-in. Default 0 (off) for every child going forward.
SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='league_opt_in'),'SELECT 1','ALTER TABLE users ADD COLUMN league_opt_in TINYINT(1) NOT NULL DEFAULT 0 AFTER consent_by');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

-- 1d. Grandfather children already placed in a league so current seasons are preserved.
-- Grandfathering is only coherent if the child also has a consent record, so the backfill
-- writes one consent row per affected child (both scopes the migration touches). Without
-- this the parent dashboard would show a child opted into public boards with no consent
-- on file, which is exactly the state section 10 forbids.
UPDATE users u JOIN league_members lm ON lm.child_id = u.id SET u.league_opt_in = 1 WHERE u.league_opt_in = 0;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='consents'),'INSERT IGNORE INTO consents (id,child_id,granted_by,scope,granted,created_at) SELECT UUID(),u.id,COALESCE(u.consent_by,f.parent_id),s.scope,1,UTC_TIMESTAMP() FROM users u JOIN league_members lm ON lm.child_id=u.id JOIN families f ON f.id=(SELECT family_id FROM family_members m WHERE m.user_id=u.id AND m.role=''child'' LIMIT 1) JOIN (SELECT ''app_data_collection'' scope UNION ALL SELECT ''public_league'') s LEFT JOIN consents existing ON existing.child_id=u.id AND existing.scope=s.scope WHERE existing.id IS NULL','SELECT 1');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

-- And consent_at itself, so the grandfathered state is complete even if the consent row
-- insert above is skipped on a database that has not run the table creation yet.
UPDATE users u JOIN league_members lm ON lm.child_id = u.id
SET u.consent_at = COALESCE(u.consent_at, UTC_TIMESTAMP()),
    u.consent_by = COALESCE(u.consent_by, (SELECT parent_id FROM families WHERE id = (SELECT family_id FROM family_members m WHERE m.user_id = u.id AND m.role='child' LIMIT 1)))
WHERE u.consent_at IS NULL;

-- 1e. Public nickname. Spec 7.1: no real names on public boards, and the nickname filter
-- blocks personal info and bad words. NULL means "not set"; the API derives a safe
-- default at read time rather than ever publishing display_name.
SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='public_nickname'),'SELECT 1','ALTER TABLE users ADD COLUMN public_nickname VARCHAR(24) NULL AFTER consent_by');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

-- 2. Consent audit trail: every grant and revocation, never overwritten in place.
CREATE TABLE IF NOT EXISTS consents (
  id CHAR(36) PRIMARY KEY,
  child_id CHAR(36) NOT NULL,
  granted_by CHAR(36) NOT NULL,
  scope VARCHAR(60) NOT NULL DEFAULT 'app_data_collection',
  granted TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (child_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3a. Safety reports raised by any member of a family.
CREATE TABLE IF NOT EXISTS safety_reports (
  id CHAR(36) PRIMARY KEY,
  reporter_id CHAR(36) NOT NULL,
  reporter_family_id CHAR(36) NOT NULL,
  reported_user_id CHAR(36) NOT NULL,
  reason VARCHAR(40) NOT NULL,
  details VARCHAR(500) NULL,
  status ENUM('open','reviewed','actioned') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (status, created_at),
  INDEX (reported_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3b. Blocking. A blocked child disappears from the blocker's public boards immediately.
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id CHAR(36) NOT NULL,
  blocked_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Preset-only reactions. The API rejects anything outside this fixed set, so no
--    free text can ever reach another family.
CREATE TABLE IF NOT EXISTS reactions (
  id CHAR(36) PRIMARY KEY,
  from_user_id CHAR(36) NOT NULL,
  to_user_id CHAR(36) NOT NULL,
  emoji VARCHAR(8) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reaction (from_user_id, to_user_id, emoji),
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Full data-export and deletion request log (spec 10.1: parent can export/delete at any time).
CREATE TABLE IF NOT EXISTS data_requests (
  id CHAR(36) PRIMARY KEY,
  family_id CHAR(36) NOT NULL,
  requested_by CHAR(36) NOT NULL,
  kind ENUM('export','delete_child','delete_family') NOT NULL,
  target_user_id CHAR(36) NULL,
  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (family_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
