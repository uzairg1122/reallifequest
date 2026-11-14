<?php
declare(strict_types=1);
// CLI/cron only. Put this script and backups OUTSIDE public_html.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$configPath=realpath($argv[1]??'');$directory=$argv[2]??'';
if(!$configPath||$directory===''||!str_starts_with($directory,DIRECTORY_SEPARATOR)&&!preg_match('/^[A-Z]:[\\\\\/]/i',$directory))throw new RuntimeException('Usage: php backup-hostinger.php /absolute/api/config.php /absolute/private-backup-folder');
if(!is_dir($directory)&&!mkdir($directory,0700,true))throw new RuntimeException('Cannot create backup folder.');
$directory=realpath($directory);if(!$directory||preg_match('~(?:^|[/\\\\])public_html(?:[/\\\\]|$)~i',$directory))throw new RuntimeException('Backups must be outside public_html.');
$config=require $configPath;$db=$config['db'];$pdo=new PDO("mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",$db['user'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec("SET SESSION sql_mode='NO_AUTO_VALUE_ON_ZERO'");
$special=$pdo->prepare("SELECT (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA=?) + (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=?) + (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=?)");$special->execute([$db['name'],$db['name'],$db['name']]);if((int)$special->fetchColumn()>0)throw new RuntimeException('Use a full hosting database export for databases with views, triggers or stored routines.');
$q=$pdo->prepare("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");$q->execute([$db['name']]);$tables=$q->fetchAll();if(!$tables)throw new RuntimeException('No database tables found.');foreach($tables as $table)if(strcasecmp($table['ENGINE'],'InnoDB')!==0)throw new RuntimeException('All tables must use InnoDB for a consistent backup.');
function identifier(string $name):string{return '`'.str_replace('`','``',$name).'`';}
$base=$directory.DIRECTORY_SEPARATOR.'rlq-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.sql.gz';$partial=$base.'.partial';$output=gzopen($partial,'wb6');if(!$output)throw new RuntimeException('Cannot open private backup.');chmod($partial,0600);
function line(string $text):void{global $output;if(gzwrite($output,$text."\n")===false)throw new RuntimeException('Backup write failed.');}
$counts=[];
try{
 $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');$pdo->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');
 line('-- Real Life Quest private consistent snapshot '.gmdate('c'));line('SET NAMES utf8mb4;');line("SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';");line('SET FOREIGN_KEY_CHECKS=0;');
 foreach($tables as $table){$name=$table['TABLE_NAME'];$quoted=identifier($name);$create=$pdo->query('SHOW CREATE TABLE '.$quoted)->fetch(PDO::FETCH_NUM);line($create[1].';');$pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY,false);$rows=$pdo->query('SELECT * FROM '.$quoted);$count=0;
  while($row=$rows->fetch()){$columns=implode(',',array_map('identifier',array_keys($row)));$values=implode(',',array_map(fn($v)=>$v===null?'NULL':$pdo->quote((string)$v),array_values($row)));line('INSERT INTO '.$quoted.' ('.$columns.') VALUES ('.$values.');');$count++;}
  $rows->closeCursor();$pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY,true);$counts[$name]=$count;
 }
 line('SET FOREIGN_KEY_CHECKS=1;');$pdo->commit();gzclose($output);$output=null;if(!rename($partial,$base))throw new RuntimeException('Cannot finalize backup.');
 $manifest=['createdAt'=>gmdate('c'),'file'=>basename($base),'sha256'=>hash_file('sha256',$base),'tables'=>$counts];$manifestPath=$base.'.json';if(file_put_contents($manifestPath,json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES))===false)throw new RuntimeException('Cannot save integrity manifest.');chmod($manifestPath,0600);
 echo 'Backup complete: '.basename($base).' ('.count($counts)." tables). Keep the archive and JSON manifest private.\n";
}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();if(is_resource($output))gzclose($output);throw $error;}
// No automatic deletion: the owner chooses retention after off-host copies are verified.
