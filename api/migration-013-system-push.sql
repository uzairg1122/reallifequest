-- Additive: SDK-displayed notifications use a phone-created account/session channel.
CREATE TABLE IF NOT EXISTS push_delivery_settings (
 device_id CHAR(36) PRIMARY KEY,
 channel_id VARCHAR(80) NOT NULL,
 FOREIGN KEY (device_id) REFERENCES push_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
