# Shared-hosting backend

This API is deliberately plain PHP and MySQL so it can run on ordinary cPanel/shared hosting. It does not require Node.js, Docker, a worker process, or a VPS.

## Install

1. Create a MySQL database and user in cPanel.
2. Import `schema.sql` with phpMyAdmin.
3. If this is an existing installation, run `migration-001-invites.sql` once in phpMyAdmin to add child age and invite task fields.
4. Copy `config.example.php` to `config.php` and enter the database credentials and the real frontend origin.
5. Upload the `api` folder to the domain, for example `https://example.com/api/`.
6. Enable PHP 8.1+ with PDO MySQL and HTTPS.

The health check is `GET /api/health`. The API uses JSON and bearer tokens. Parent registration creates a family. A parent creates an invite with the child name, age and one or more starter tasks; the six digit code or direct invite link lets the child join. Those selected tasks are created automatically for the child at registration. Task assignment, child submission, parent approval/rejection, server-side wallet rewards and in-app notifications are handled by the API.

## Notifications

Notifications are stored server-side and can be read through `GET /api/notifications`, so the first frontend integration can poll them. True OS push notifications should be added through a provider such as Firebase Cloud Messaging, OneSignal, or Web Push with VAPID. That provider can call this PHP API without changing the hosting model.

## Security notes

Use HTTPS, a strong database password, and a real origin in `config.php`. Passwords use PHP's password hashing; session tokens are stored only as SHA-256 hashes. Approval and reward changes happen inside a database transaction and are checked on the server. Uploaded photos should be moved to private object storage or a protected directory before production launch; the current endpoints accept a proof URL rather than handling uploads.
