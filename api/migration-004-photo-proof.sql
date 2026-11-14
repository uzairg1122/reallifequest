-- Apply after migration-003-family-polish.sql. Safe to repeat; preserves existing data.
SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='photo_mode'),'SELECT 1','ALTER TABLE tasks ADD COLUMN photo_mode VARCHAR(20) NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;
UPDATE tasks SET photo_mode=IF(photo_required=1,'required','optional') WHERE photo_mode IS NULL;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='submissions' AND COLUMN_NAME='proof_before_url'),'SELECT 1','ALTER TABLE submissions ADD COLUMN proof_before_url MEDIUMTEXT NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;
