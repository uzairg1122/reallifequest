<?php
declare(strict_types=1);
function fail(string $message,int $status=400):never{throw new RuntimeException($message,$status);}
function bearer():string{return $GLOBALS['test_session'];}
require __DIR__.'/../api/release_helpers.php';
$pdo=new PDO('mysql:host=127.0.0.1;port=3308','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$db='rlq_security_'.bin2hex(random_bytes(4));$pdo->exec('CREATE DATABASE '.$db);$pdo->exec('USE '.$db);
$pass=0;
function ok(bool $value,string $label):void{global $pass;if(!$value)throw new RuntimeException($label);$pass++;echo "PASS $label\n";}
function denied(callable $fn,string $label,int $status=422):void{try{$fn();ok(false,$label);}catch(RuntimeException $e){ok($e->getCode()===$status,$label);}}
try{
 $pdo->exec(file_get_contents(__DIR__.'/../api/schema.sql'));
 foreach(['003-family-polish','004-photo-proof','005-xp-ledger','006-challenges','007-social','008-safety','009-google-auth','010-release'] as $m)$pdo->exec(file_get_contents(__DIR__.'/../api/migration-'.$m.'.sql'));
 $user=['id'=>bin2hex(random_bytes(16)),'email'=>'owner@example.test','role'=>'parent','password_hash'=>password_hash('known-password',PASSWORD_DEFAULT)];
 $pdo->prepare("INSERT INTO users(id,email,password_hash,display_name,role) VALUES (?,?,?,'Owner','parent')")->execute([$user['id'],$user['email'],$user['password_hash']]);$GLOBALS['test_session']='session-one';
 $proof=bin2hex(random_bytes(32));$pdo->prepare('INSERT INTO reauth_grants(token_hash,user_id,session_hash,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))')->execute([hash('sha256',$proof),$user['id'],hash('sha256',bearer())]);
 denied(fn()=>requireParentConfirmation($pdo,$user,['password'=>'wrong']),'wrong password cannot authorize');
 $GLOBALS['test_session']='different-session';denied(fn()=>requireParentConfirmation($pdo,$user,['reauthToken'=>$proof]),'Google grant bound to session');
 $GLOBALS['test_session']='session-one';requireParentConfirmation($pdo,$user,['reauthToken'=>$proof]);ok(true,'Google grant authorizes without invented password');
 denied(fn()=>requireParentConfirmation($pdo,$user,['reauthToken'=>$proof]),'Google grant cannot be replayed');
 requireParentConfirmation($pdo,$user,['password'=>'known-password']);ok(true,'existing parent password still works');
 $GLOBALS['config']=['moderation_admin_emails'=>[$user['email']]];ok(!isSafetyModerator($pdo,$user),'email allowlist alone does not confer moderation');
 $pdo->prepare("INSERT INTO auth_identities(provider,subject,user_id) VALUES ('google','verified-test-subject',?)")->execute([$user['id']]);ok(isSafetyModerator($pdo,$user),'moderator requires explicit allowlist and Google link');
 $GLOBALS['config']=['moderation_admin_emails'=>[]];ok(!isSafetyModerator($pdo,$user),'ordinary Google parent not moderator');
 $family=bin2hex(random_bytes(16));$pdo->prepare('INSERT INTO families(id,parent_id,name) VALUES (?,?,?)')->execute([$family,$user['id'],'Test']);
 $invite=bin2hex(random_bytes(16));$pdo->prepare("INSERT INTO pairing_codes(id,family_id,code_hash,kind,expires_at) VALUES (?,?,?,'co_parent',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY))")->execute([$invite,$family,hash('sha256','123456')]);
 $pdo->beginTransaction();denied(fn()=>lockPairingCode($pdo,'123456','child'),'co-parent code rejected for child');
 $pdo->beginTransaction();ok(lockPairingCode($pdo,'123456','co_parent')['id']===$invite,'correct invite kind accepted under row lock');$pdo->rollBack();
 echo "$pass release security checks passed\n";
}finally{if($pdo->inTransaction())$pdo->rollBack();$pdo->exec('DROP DATABASE '.$db);}
