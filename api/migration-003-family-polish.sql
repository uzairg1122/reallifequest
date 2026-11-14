-- Import into the existing database. Safe to repeat; does not remove family data.

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='age'),'SELECT 1','ALTER TABLE users ADD COLUMN age TINYINT UNSIGNED NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='child_pin_hash'),'SELECT 1','ALTER TABLE users ADD COLUMN child_pin_hash VARCHAR(255) NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='avatar_data'),'SELECT 1','ALTER TABLE users ADD COLUMN avatar_data MEDIUMTEXT NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pairing_codes' AND COLUMN_NAME='child_name'),'SELECT 1','ALTER TABLE pairing_codes ADD COLUMN child_name VARCHAR(80) NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pairing_codes' AND COLUMN_NAME='child_age'),'SELECT 1','ALTER TABLE pairing_codes ADD COLUMN child_age TINYINT UNSIGNED NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pairing_codes' AND COLUMN_NAME='task_payload'),'SELECT 1','ALTER TABLE pairing_codes ADD COLUMN task_payload LONGTEXT NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='category'),'SELECT 1','ALTER TABLE tasks ADD COLUMN category VARCHAR(60) NOT NULL DEFAULT ''Custom Missions''');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='icon'),'SELECT 1','ALTER TABLE tasks ADD COLUMN icon VARCHAR(32) NOT NULL DEFAULT ''⚔️''');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='days'),'SELECT 1','ALTER TABLE tasks ADD COLUMN days VARCHAR(16) NOT NULL DEFAULT ''both''');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='photo_required'),'SELECT 1','ALTER TABLE tasks ADD COLUMN photo_required TINYINT NOT NULL DEFAULT 0');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;

ALTER TABLE submissions MODIFY COLUMN proof_url MEDIUMTEXT NULL;

-- Restore routine labels for presets assigned by earlier app versions.
UPDATE tasks SET category='Morning Routine',icon='🪥' WHERE category='Custom Missions' AND (title='Brush Your Teeth' OR mission_title='Brush Your Teeth');
UPDATE tasks SET category='Morning Routine',icon='🫧' WHERE category='Custom Missions' AND (title='Wash Face & Hands' OR mission_title='Wash Face & Hands');
UPDATE tasks SET category='Morning Routine',icon='👕' WHERE category='Custom Missions' AND (title='Get Dressed' OR mission_title='Get Dressed');
UPDATE tasks SET category='Morning Routine',icon='🛏️' WHERE category='Custom Missions' AND (title='Make Your Bed' OR mission_title='Make Your Bed');
UPDATE tasks SET category='Morning Routine',icon='🪮' WHERE category='Custom Missions' AND (title='Comb Your Hair' OR mission_title='Comb Your Hair');
UPDATE tasks SET category='Morning Routine',icon='🥣' WHERE category='Custom Missions' AND (title='Breakfast Time' OR mission_title='Breakfast Time');
UPDATE tasks SET category='School & Homework',icon='🎒' WHERE category='Custom Missions' AND (title='Backpack Check' OR mission_title='Backpack Check');
UPDATE tasks SET category='School & Homework',icon='💧' WHERE category='Custom Missions' AND (title='Pack Your Water Bottle' OR mission_title='Pack Your Water Bottle');
UPDATE tasks SET category='School & Homework',icon='📝' WHERE category='Custom Missions' AND (title='Homework Check-in' OR mission_title='Homework Check-in');
UPDATE tasks SET category='School & Homework',icon='📗' WHERE category='Custom Missions' AND (title='Read a Book' OR mission_title='Read a Book');
UPDATE tasks SET category='School & Homework',icon='✏️' WHERE category='Custom Missions' AND (title='Clear Your Study Space' OR mission_title='Clear Your Study Space');
UPDATE tasks SET category='School & Homework',icon='📋' WHERE category='Custom Missions' AND (title='Check Tomorrow’s School List' OR mission_title='Check Tomorrow’s School List');
UPDATE tasks SET category='Tidy & Order',icon='🧸' WHERE category='Custom Missions' AND (title='Put Toys Away' OR mission_title='Put Toys Away');
UPDATE tasks SET category='Tidy & Order',icon='🧺' WHERE category='Custom Missions' AND (title='Clothes in the Hamper' OR mission_title='Clothes in the Hamper');
UPDATE tasks SET category='Tidy & Order',icon='👟' WHERE category='Custom Missions' AND (title='Shoes in Their Place' OR mission_title='Shoes in Their Place');
UPDATE tasks SET category='Tidy & Order',icon='📚' WHERE category='Custom Missions' AND (title='Put Books on the Shelf' OR mission_title='Put Books on the Shelf');
UPDATE tasks SET category='Bedtime Wind-Down',icon='🌙' WHERE category='Custom Missions' AND (title='Put On Pyjamas' OR mission_title='Put On Pyjamas');
UPDATE tasks SET category='Bedtime Wind-Down',icon='🪥' WHERE category='Custom Missions' AND (title='Brush Teeth Before Bed' OR mission_title='Brush Teeth Before Bed');
UPDATE tasks SET category='Bedtime Wind-Down',icon='📖' WHERE category='Custom Missions' AND (title='Choose a Bedtime Story' OR mission_title='Choose a Bedtime Story');
UPDATE tasks SET category='Bedtime Wind-Down',icon='👚' WHERE category='Custom Missions' AND (title='Lay Out Tomorrow’s Clothes' OR mission_title='Lay Out Tomorrow’s Clothes');
UPDATE tasks SET category='Bedtime Wind-Down',icon='📵' WHERE category='Custom Missions' AND (title='Put Screens Away' OR mission_title='Put Screens Away');
UPDATE tasks SET category='Bonus',icon='🍽️' WHERE category='Custom Missions' AND (title='Set the Dinner Table' OR mission_title='Set the Dinner Table');
UPDATE tasks SET category='Bonus',icon='🥄' WHERE category='Custom Missions' AND (title='Clear Your Place' OR mission_title='Clear Your Place');
UPDATE tasks SET category='Bonus',icon='🪴' WHERE category='Custom Missions' AND (title='Water the Plants' OR mission_title='Water the Plants');
UPDATE tasks SET category='Bonus',icon='🧦' WHERE category='Custom Missions' AND (title='Match the Socks' OR mission_title='Match the Socks');
UPDATE tasks SET category='Bonus',icon='👕' WHERE category='Custom Missions' AND (title='Put Clean Clothes Away' OR mission_title='Put Clean Clothes Away');
UPDATE tasks SET category='Bonus',icon='🧺' WHERE category='Custom Missions' AND (title='Fold Small Towels' OR mission_title='Fold Small Towels');
UPDATE tasks SET category='Bonus',icon='🧽' WHERE category='Custom Missions' AND (title='Wipe the Table' OR mission_title='Wipe the Table');
UPDATE tasks SET category='Bonus',icon='♻️' WHERE category='Custom Missions' AND (title='Organize Recycling Bin' OR mission_title='Organize Recycling Bin');
UPDATE tasks SET category='Bonus',icon='🧩' WHERE category='Custom Missions' AND (title='Help Sibling with Puzzle' OR mission_title='Help Sibling with Puzzle');
UPDATE tasks SET category='Bonus',icon='🧹' WHERE category='Custom Missions' AND (title='Sweep a Small Floor Area' OR mission_title='Sweep a Small Floor Area');
UPDATE tasks SET category='Bonus',icon='🥪' WHERE category='Custom Missions' AND (title='Help Pack Your Lunch' OR mission_title='Help Pack Your Lunch');
UPDATE tasks SET category='Bonus',icon='🛒' WHERE category='Custom Missions' AND (title='Help Make a Grocery List' OR mission_title='Help Make a Grocery List');
UPDATE tasks SET category='Bonus',icon='🐾' WHERE category='Custom Missions' AND (title='Help Refill Pet Water' OR mission_title='Help Refill Pet Water');
CREATE TABLE IF NOT EXISTS reward_requests (
 id CHAR(36) PRIMARY KEY,
 family_id CHAR(36) NOT NULL,
 reward_id CHAR(36) NOT NULL,
 child_id CHAR(36) NOT NULL,
 name VARCHAR(160) NOT NULL,
 cost_coins INT UNSIGNED NOT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
 FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
 FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET @rlq_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='families' AND COLUMN_NAME='schedule_json'),'SELECT 1','ALTER TABLE families ADD COLUMN schedule_json TEXT NULL');
PREPARE rlq_stmt FROM @rlq_sql; EXECUTE rlq_stmt; DEALLOCATE PREPARE rlq_stmt;
CREATE TABLE IF NOT EXISTS child_login_limits (
 attempt_key CHAR(64) PRIMARY KEY,
 attempts INT NOT NULL DEFAULT 1,
 window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
