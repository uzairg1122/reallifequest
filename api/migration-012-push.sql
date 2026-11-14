-- Additive only: keep all existing families, accounts, tasks and photos.
CREATE TABLE IF NOT EXISTS push_devices (
 id CHAR(36) PRIMARY KEY,
 installation_hash CHAR(64) NOT NULL UNIQUE,
 user_id CHAR(36) NOT NULL,
 session_hash CHAR(64) NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 fcm_token VARCHAR(4096) NOT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX push_owner_session (user_id,session_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS push_outbox (
 id CHAR(36) PRIMARY KEY,
 notification_id CHAR(36) NOT NULL,
 device_id CHAR(36) NOT NULL,
 user_id CHAR(36) NOT NULL,
 session_hash CHAR(64) NOT NULL,
 attempts INT NOT NULL DEFAULT 0,
 available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 locked_until DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (device_id) REFERENCES push_devices(id) ON DELETE CASCADE,
 FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
 UNIQUE KEY push_once (notification_id,device_id),
 INDEX push_due (available_at,locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
