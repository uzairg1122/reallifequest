<?php
$pdo=new PDO('mysql:host=127.0.0.1;port=3308;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE IF NOT EXISTS rlq_audit CHARACTER SET utf8mb4');$pdo->exec('USE rlq_audit');
$exists=$pdo->query("SHOW TABLES LIKE 'users'")->fetch();
if(!$exists)$pdo->exec(file_get_contents(__DIR__.'/../api/schema.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../api/migration-003-family-polish.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../api/migration-004-photo-proof.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../api/migration-005-xp-ledger.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../api/migration-006-challenges.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../api/migration-007-social.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../api/migration-008-safety.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../api/migration-009-google-auth.sql'));
$pdo->exec(file_get_contents(__DIR__.'/../api/migration-010-release.sql'));
echo "Local test schema ready\n";
