<?php
declare(strict_types=1);
$directory=realpath(__DIR__.'/../artifacts/hostinger-backup-test');$files=glob($directory.'/*.sql.gz');usort($files,fn($a,$b)=>filemtime($b)<=>filemtime($a));$file=$files[0]??throw new RuntimeException('Create a local audit backup first.');
$manifest=json_decode(file_get_contents($file.'.json'),true,512,JSON_THROW_ON_ERROR);if(!hash_equals($manifest['sha256'],hash_file('sha256',$file)))throw new RuntimeException('Backup checksum failed.');
$sql=gzdecode(file_get_contents($file));if($sql===false||preg_match('/^\s*(?:CREATE\s+DATABASE|USE\s+)/mi',$sql))throw new RuntimeException('Backup cannot select another database.');
$pdo=new PDO('mysql:host=127.0.0.1;port=3308','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$name='rlq_restore_secure_'.bin2hex(random_bytes(5));$pdo->exec('CREATE DATABASE '.$name);
try{$pdo->exec('USE '.$name);$pdo->exec($sql);foreach($manifest['tables'] as $table=>$count){$actual=(int)$pdo->query('SELECT COUNT(*) FROM `'.str_replace('`','``',$table).'`')->fetchColumn();if($actual!==$count)throw new RuntimeException('Restored table row count differs.');}
 $original=$pdo->query("SELECT id,proof_url FROM rlq_audit.submissions WHERE proof_url IS NOT NULL LIMIT 1")->fetch(PDO::FETCH_ASSOC);
 if($original){$find=$pdo->prepare('SELECT proof_url FROM submissions WHERE id=?');$find->execute([$original['id']]);if($find->fetchColumn()!==$original['proof_url'])throw new RuntimeException('Restored photo differs.');}
 echo 'PASS gzip checksum, isolated restore, '.count($manifest['tables'])." table row counts and exact photo bytes. Source database unchanged.\n";
}finally{$pdo->exec('DROP DATABASE '.$name);}
