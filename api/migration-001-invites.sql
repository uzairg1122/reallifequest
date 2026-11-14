-- Run once in phpMyAdmin on an existing installation.
ALTER TABLE users ADD COLUMN age TINYINT UNSIGNED NULL AFTER role;
ALTER TABLE users ADD COLUMN child_pin_hash VARCHAR(255) NULL AFTER age;
ALTER TABLE pairing_codes ADD COLUMN child_name VARCHAR(80) NULL AFTER used_at;
ALTER TABLE pairing_codes ADD COLUMN child_age TINYINT UNSIGNED NULL AFTER child_name;
ALTER TABLE pairing_codes ADD COLUMN task_payload LONGTEXT NULL AFTER child_age;
