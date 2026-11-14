<?php
// Durable local app database, deliberately separate from the disposable rlq_audit tests.
$pdo=new PDO('mysql:host=127.0.0.1;port=3308;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE IF NOT EXISTS rlq_local CHARACTER SET utf8mb4');
$pdo->exec('USE rlq_local');
if (!$pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn()) $pdo->exec(file_get_contents(__DIR__.'/../api/schema.sql'));
foreach(['003-family-polish','004-photo-proof','005-xp-ledger','006-challenges','007-social','008-safety','009-google-auth','010-release'] as $migration) $pdo->exec(file_get_contents(__DIR__.'/../api/migration-'.$migration.'.sql'));
echo "Local app database ready. Existing family records preserved.\n";
