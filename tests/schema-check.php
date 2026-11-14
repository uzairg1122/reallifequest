<?php
// Builds a throwaway database from schema.sql and replays every migration twice, so a new
// migration fails this check if it is not idempotent or depends on an earlier one.
$pdo=new PDO('mysql:host=127.0.0.1;port=3308;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$name='rlq_schema_'.bin2hex(random_bytes(4));
$pdo->exec('CREATE DATABASE '.$name.' CHARACTER SET utf8mb4');
$migrations=['003-family-polish','004-photo-proof','005-xp-ledger','006-challenges','007-social','008-safety','009-google-auth','010-release'];
try {
 $pdo->exec('USE '.$name);
 $pdo->exec(file_get_contents(__DIR__.'/../api/schema.sql'));
 foreach($migrations as $migration){
  $sql=file_get_contents(__DIR__.'/../api/migration-'.$migration.'.sql');
  if($sql===false) fail_missing($migration);
  $pdo->exec($sql);
  $pdo->exec($sql); // second pass must be a no-op
  echo "  ok  migration-{$migration} (applied twice)\n";
 }
 // The safety columns the API depends on must exist after the replay.
 foreach(['consent_at','consent_by','league_opt_in','public_nickname'] as $column){
  $stmt=$pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=\'users\' AND COLUMN_NAME=?');
  $stmt->execute([$name,$column]);
  if((int)$stmt->fetchColumn()!==1) fail_column($column);
 }
 foreach(['consents','safety_reports','user_blocks','reactions','data_requests','auth_identities','auth_nonces'] as $table){
  $stmt=$pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?');
  $stmt->execute([$name,$table]);
  if((int)$stmt->fetchColumn()!==1) fail_column($table);
 }
 // A brand new child must default to no consent and no public league.
 $pdo->exec("INSERT INTO users (id,email,password_hash,display_name,role,age) VALUES (UUID(),'schema@check.invalid','x','Fresh','child',8)");
 $row=$pdo->query("SELECT league_opt_in,consent_at FROM users WHERE email='schema@check.invalid'")->fetch();
 if((int)$row['league_opt_in']!==0||$row['consent_at']!==null) fail_column('safe defaults');
 echo "PASS fresh schema, all ".count($migrations)." migrations replayed twice, safety defaults are closed\n";
}finally{$pdo->exec('DROP DATABASE '.$name);}

function fail_missing(string $migration):never{exit("FAIL migration-{$migration}.sql is missing\n");}
function fail_column(string $what):never{exit("FAIL expected safety object missing or defaulted open: {$what}\n");}
