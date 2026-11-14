CREATE TABLE IF NOT EXISTS family_plans (
    family_id CHAR(36) PRIMARY KEY,
    trial_ends_at DATETIME NOT NULL,
    purchase_token VARCHAR(2048) NULL,
    paid_until DATETIME NULL,
    checked_at DATETIME NULL,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    INDEX (checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recurring_missions (
    id CHAR(36) PRIMARY KEY,
    family_id CHAR(36) NOT NULL,
    child_id CHAR(36) NOT NULL,
    task_json TEXT NOT NULL,
    frequency ENUM('daily','weekdays','weekends','weekly') NOT NULL,
    timezone VARCHAR(64) NOT NULL,
    next_at DATETIME NOT NULL,
    FOREIGN KEY (family_id,child_id) REFERENCES family_members(family_id,user_id) ON DELETE CASCADE,
    INDEX (next_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
