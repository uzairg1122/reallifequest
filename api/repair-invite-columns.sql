-- Select the existing app database in phpMyAdmin, then import this file.
-- Adds missing invite columns only. Existing rows and columns are preserved.

SET @rlq_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'age'),
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN age TINYINT UNSIGNED NULL'
);
PREPARE rlq_stmt FROM @rlq_sql;
EXECUTE rlq_stmt;
DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pairing_codes' AND COLUMN_NAME = 'child_name'),
  'SELECT 1',
  'ALTER TABLE pairing_codes ADD COLUMN child_name VARCHAR(80) NULL'
);
PREPARE rlq_stmt FROM @rlq_sql;
EXECUTE rlq_stmt;
DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pairing_codes' AND COLUMN_NAME = 'child_age'),
  'SELECT 1',
  'ALTER TABLE pairing_codes ADD COLUMN child_age TINYINT UNSIGNED NULL'
);
PREPARE rlq_stmt FROM @rlq_sql;
EXECUTE rlq_stmt;
DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pairing_codes' AND COLUMN_NAME = 'task_payload'),
  'SELECT 1',
  'ALTER TABLE pairing_codes ADD COLUMN task_payload LONGTEXT NULL'
);
PREPARE rlq_stmt FROM @rlq_sql;
EXECUTE rlq_stmt;
DEALLOCATE PREPARE rlq_stmt;
