<?php
declare(strict_types=1);
$pdo=new PDO('mysql:host=127.0.0.1;port=3308;dbname=rlq_audit','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if(($argv[1]??'')==='migrate'){$pdo->exec(file_get_contents(__DIR__.'/../api/migration-011-sessions-devices.sql'));exit;}
$hash=hash('sha256',$argv[2]??'');
if(($argv[1]??'')==='near-expiry')$pdo->prepare('UPDATE sessions SET expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY) WHERE token_hash=?')->execute([$hash]);
if(($argv[1]??'')==='expire')$pdo->prepare('UPDATE sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE token_hash=?')->execute([$hash]);
$find=$pdo->prepare('SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),expires_at) FROM sessions WHERE token_hash=?');$find->execute([$hash]);echo json_encode(['seconds'=>$find->fetchColumn()]);
