-- Apply after migration-004-photo-proof.sql. Safe to repeat; preserves existing data.
-- Adds the append-only XP ledger and a difficulty label on tasks so leaderboards
-- can be recomputed server-side (anti-cheat: XP is app-standardized and daily-capped).

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='difficulty'),'SELECT 1','ALTER TABLE tasks ADD COLUMN difficulty ENUM(''easy'',''medium'',''hard'') NULL AFTER xp');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

CREATE TABLE IF NOT EXISTS xp_events (
  id CHAR(36) PRIMARY KEY,
  family_id CHAR(36) NOT NULL,
  child_id CHAR(36) NOT NULL,
  task_id CHAR(36) NULL,
  submission_id CHAR(36) NULL,
  source ENUM('task_approval','bonus','adjustment') NOT NULL DEFAULT 'task_approval',
  xp INT NOT NULL DEFAULT 0,
  coins INT NOT NULL DEFAULT 0,
  difficulty ENUM('easy','medium','hard','custom') NOT NULL DEFAULT 'custom',
  yyyymmdd DATE NOT NULL,
  iso_week CHAR(8) NOT NULL,
  flagged TINYINT NOT NULL DEFAULT 0,
  flag_reason VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (family_id, iso_week),
  INDEX (child_id, yyyymmdd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
