<?php
declare(strict_types=1);
// Only a new randomly named database is created/dropped; never the app database.
$admin=new PDO('mysql:host=127.0.0.1;port=3308','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db='rlq_push_test_'.bin2hex(random_bytes(5));$admin->exec("CREATE DATABASE `$db` CHARACTER SET utf8mb4");
function uuid():string{return bin2hex(random_bytes(4)).'-'.bin2hex(random_bytes(2)).'-'.bin2hex(random_bytes(2)).'-'.bin2hex(random_bytes(2)).'-'.bin2hex(random_bytes(6));}
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
require __DIR__.'/../api/push_notifications.php';
try{
 $p=new PDO("mysql:host=127.0.0.1;port=3308;dbname=$db",'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
 $p->exec('CREATE TABLE users(id CHAR(36) PRIMARY KEY) ENGINE=InnoDB; CREATE TABLE sessions(id CHAR(36) PRIMARY KEY,user_id CHAR(36),token_hash CHAR(64),expires_at DATETIME) ENGINE=InnoDB; CREATE TABLE notifications(id CHAR(36) PRIMARY KEY,user_id CHAR(36),type VARCHAR(80),title TEXT,body TEXT) ENGINE=InnoDB;');
 $sql=file_get_contents(__DIR__.'/../api/migration-012-push.sql');$p->exec($sql);$p->exec($sql);$system=file_get_contents(__DIR__.'/../api/migration-013-system-push.sql');$p->exec($system);$p->exec($system);
 $GLOBALS['config']=['push'=>['enabled'=>true]];
 $a=uuid();$b=uuid();$ha=hash('sha256','session a');$hb=hash('sha256','session b');$da=uuid();$dbid=uuid();
 foreach([[$a,$ha,$da,'a'],[$b,$hb,$dbid,'b']] as [$user,$hash,$device,$suffix]){
  $p->prepare('INSERT INTO users VALUES (?)')->execute([$user]);$p->prepare('INSERT INTO sessions VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY))')->execute([uuid(),$user,$hash]);
  $p->prepare('INSERT INTO push_devices(id,installation_hash,user_id,session_hash,token_hash,fcm_token) VALUES (?,?,?,?,?,?)')->execute([$device,hash('sha256','install'.$suffix),$user,$hash,hash('sha256','token-'.$suffix),'token-'.$suffix]);
 }
 $notice=function(string $user)use($p):string{$id=uuid();$p->prepare('INSERT INTO notifications VALUES (?,?,?,?,?)')->execute([$id,$user,'task_assigned','Private child name','Private task text']);queuePush($p,$id,$user);return $id;};
 $p->beginTransaction();$notice($a);$p->rollBack();check((int)$p->query('SELECT COUNT(*) FROM push_outbox')->fetchColumn()===0,'Rollback must never push an uncommitted task');
 $id=$notice($a);$calls=[];
 savePushDevice($p,$a,$ha,hash('sha256','installa'),'token-a','');check((int)$p->query('SELECT COUNT(*) FROM push_outbox')->fetchColumn()===1,'Resume/reconnect must not erase pending notifications');
 $sender=function(array $message)use(&$calls):array{$calls[]=$message;return[200,['name'=>'accepted']];};
 $result=drainPush($p,['enabled'=>true],20,$sender);
 check($result['sent']===1&&count($calls)===1,'Exactly the intended device must receive the task');check($calls[0]['message']['token']==='token-a','Wrong-family token');check($calls[0]['message']['data']['userId']===$a,'Owner missing');check($calls[0]['message']['data']['sessionHash']===$ha,'Session binding missing');check(!str_contains(json_encode($calls),'Private'),'Private task text must not cross FCM');check($calls[0]['message']['data']['notificationId']===$id,'Stable dedupe id');
 drainPush($p,['enabled'=>true],20,$sender);check(count($calls)===1,'Successful outbox replay must not send again');
 $p->prepare('INSERT INTO push_delivery_settings(device_id,channel_id) VALUES (?,?)')->execute([$da,'rlq_'.str_repeat('a',24)]);
 $systemId=$notice($a);drainPush($p,['enabled'=>true],20,$sender);$systemPayload=end($calls)['message'];check(isset($systemPayload['notification']),'Background system display must not depend on the app service waking');check($systemPayload['android']['notification']['channel_id']==='rlq_'.str_repeat('a',24),'Use exact phone sound/session channel');check($systemPayload['android']['notification']['visibility']==='PRIVATE','Private lockscreen previews');check($systemPayload['android']['notification']['tag']==='rlq:'.$systemId,'Stable notification replacement tag');check(!str_contains(json_encode($systemPayload),'Private task'),'No private task text in visible notification');
 $calls=array_slice($calls,0,1);
 $notice($a);$p->prepare('DELETE FROM sessions WHERE token_hash=?')->execute([$ha]);drainPush($p,['enabled'=>true],20,$sender);check(count($calls)===1,'Logged-out device must not receive queued pushes');
 $notice($b);$p->prepare('UPDATE push_devices SET user_id=?,session_hash=? WHERE id=?')->execute([$a,$ha,$dbid]);drainPush($p,['enabled'=>true],20,$sender);check(count($calls)===1,'Account switch must not expose queued previous-account messages');
 $p->prepare('UPDATE push_devices SET user_id=?,session_hash=? WHERE id=?')->execute([$b,$hb,$dbid]);$notice($b);
 $result=drainPush($p,['enabled'=>true],20,fn()=>[503,[]]);check($result['failed']===1,'Transient failure must be counted');check((int)$p->query('SELECT attempts FROM push_outbox LIMIT 1')->fetchColumn()===1,'Retry must stay queued');check((int)$p->query('SELECT COUNT(*) FROM notifications')->fetchColumn()>=4,'Delivery failure must retain in-app history');
 $p->exec('UPDATE push_outbox SET available_at=UTC_TIMESTAMP()');drainPush($p,['enabled'=>true],20,fn()=>[404,['error'=>['details'=>[['errorCode'=>'UNREGISTERED']]]]]);check((int)$p->query('SELECT COUNT(*) FROM push_devices WHERE id='.$p->quote($dbid))->fetchColumn()===0,'Uninstalled device token must be removed');
 echo "PASS push migration replay, transaction rollback, exact account/session delivery, privacy, dedupe, logout, account switch, transient retry, in-app history retention and unregistered-token cleanup.\n";
}finally{if(preg_match('/^rlq_push_test_[a-f0-9]{10}$/D',$db))$admin->exec("DROP DATABASE `$db`");}
