# Real Life Quest on ordinary shared hosting

The backend is designed for cPanel-style hosting with PHP and MySQL.

## Requirements

- PHP 8.1 or newer
- PDO MySQL extension
- MySQL 8 or MariaDB 10.4+
- Apache `mod_rewrite`
- HTTPS

## Deployment

1. Create a MySQL database and database user in the hosting control panel.
2. Import `api/schema.sql` with phpMyAdmin.
3. For an existing database, run `api/migration-001-invites.sql` once in phpMyAdmin.
4. Upload the `api` folder into the website directory.
5. Copy `api/config.example.php` to `api/config.php` and enter the database credentials.
6. Set `cors_origins` to the exact frontend domain.
7. Upload the built React `dist` files to the public website directory.
8. Confirm `https://your-domain.example/api/health` returns an `ok` response.

The React frontend can call the API through the same domain using `/api`. No Node.js process needs to run after the static build is uploaded. Parent invites save the child name, age and selected starter missions; a child can join with a six-digit code or a direct `?invite=CODE` link.

## Current API capabilities

Parent registration creates a family. Child registration accepts the six-digit family pairing code. Parents can assign missions, children can submit a note and proof URL, and parents can approve or reject submissions. Approval is a server-side transaction that updates the child wallet and creates a notification for the child. Notifications are available through the API for in-app polling.

OS-level push notifications still need a provider such as Firebase Cloud Messaging, OneSignal, or Web Push. That integration can be added without changing the shared-hosting requirement.
