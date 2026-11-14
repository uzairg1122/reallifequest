<?php
// Restore into a newly generated throwaway database; never overwrite rlq_local.
$file=realpath($argv[1]??'');$folder=realpath(__DIR__.'/../artifacts/backups');
if(!$file||!$folder||!str_starts_with($file,$folder.DIRECTORY_SEPARATOR))throw new RuntimeException('Choose a local backup artifact.');
$sql=file_get_contents($file);
if(preg_match('/^\s*(?:CREATE\s+DATABASE|USE\s+)/mi',$sql))throw new RuntimeException('Backup must not select another database.');
$p=new PDO('mysql:host=127.0.0.1;port=3308','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$name='rlq_restore_'.bin2hex(random_bytes(5));
$p->exec('CREATE DATABASE '.$name);
try{$p->exec('USE '.$name);$p->exec($sql);$count=$p->query('SHOW TABLES')->rowCount();if($count<10)throw new RuntimeException('Incomplete backup');echo 'PASS isolated backup restore, '.$count." tables, source database untouched\n";}finally{$p->exec('DROP DATABASE '.$name);}
