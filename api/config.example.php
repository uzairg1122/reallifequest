<?php
// Copy this file to config.php on the hosting account and fill in the values.
// Keep config.php outside public access when possible, or use the included .htaccess.
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'real_life_quest',
        'user' => 'database_user',
        'password' => 'database_password',
        'charset' => 'utf8mb4',
    ],
    'cors_origins' => [
        'https://nomolabs.pro',
        'https://api.nomolabs.pro',
        'https://localhost', // Capacitor Android's bundled app origin; not the API host.
    ],
    'token_ttl_days' => 30,
    // Web OAuth Client ID (public identifier, NOT the client secret).
    'google_client_id' => '771794282164-1c01eddpmelkubpeeoo5rdghh5mkqb0v.apps.googleusercontent.com',
    'parent_auth_mode' => 'google', // Google parents, children keep family code/name/PIN.
    'google_legacy_recovery' => [], // Operator-approved exact Gmail => Unix expiry; disabled by default.
    'public_app_url' => 'https://api.nomolabs.pro/real-life-quest',
    'reset_mail_enabled' => false, // Enable only after hosting mail delivery is verified.
    'mail_from' => 'support@nomolabs.pro',
    'moderation_admin_emails' => [], // Explicit operators; Google-linked accounts only.
    'recurring_missions_enabled' => false,
    'billing' => [
        'enabled' => false,
        'service_account_file' => '/ABSOLUTE/PRIVATE/play-service-account.json',
    ],
    'push' => [
        'enabled' => false, // Enable only after migration-012 and private FCM setup.
        'project_id' => 'real-life-quest-792fa',
        'service_account_file' => '/ABSOLUTE/PRIVATE/fcm-service-account.json',
    ],
];
