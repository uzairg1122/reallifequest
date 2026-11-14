<?php
declare(strict_types=1);
require __DIR__.'/../api/google_accounts.php';
require __DIR__.'/../api/release_helpers.php';
function uuid():string{return bin2hex(random_bytes(16));}
function fail(string $message,int $status=400):never{throw new RuntimeException($message,$status);}
function bearer():string{return 'hostinger-test-session';}
function issueToken(PDO $p,string $uid,int $days):string{$token=bin2hex(random_bytes(32));$p->prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY))')->execute([uuid(),$uid,hash('sha256',$token)]);return $token;}
function nonce(PDO $p):string{$n=hash('sha256',random_bytes(32));$p->prepare('INSERT INTO auth_nonces(nonce_hash,expires_at) VALUES (?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))')->execute([$n]);return $n;}
$pass=0;function check(bool $value,string $label):void{global $pass;if(!$value)throw new RuntimeException($label);$pass++;echo 'PASS '.$label."\n";}
function denied(callable $fn,int $status,string $label):void{try{$fn();throw new RuntimeException('Unexpected success: '.$label);}catch(RuntimeException $e){check($e->getCode()===$status,$label);}}
$p=new PDO('mysql:host=127.0.0.1;port=3308','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$db='rlq_hostinger_'.bin2hex(random_bytes(4));$p->exec('CREATE DATABASE '.$db);$p->exec('USE '.$db);
try{
 $p->exec(file_get_contents(__DIR__.'/../api/schema.sql'));foreach(['003-family-polish','004-photo-proof','005-xp-ledger','006-challenges','007-social','008-safety','009-google-auth','010-release'] as $m)$p->exec(file_get_contents(__DIR__.'/../api/migration-'.$m.'.sql'));
 $ownerClaims=['sub'=>'owner-google-sub','email'=>'owner@example.test','name'=>'Owner'];$owner=googleParentSession($p,$ownerClaims,nonce($p),'',30,'',true);$again=googleParentSession($p,$ownerClaims,nonce($p),'',30,'',true);check($again['familyId']===$owner['familyId'],'Google-only returning login keeps family');
 $code='321654';$pair=uuid();$p->prepare("INSERT INTO pairing_codes(id,family_id,code_hash,kind,expires_at) VALUES (?,?,?,'co_parent',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY))")->execute([$pair,$owner['familyId'],hash('sha256',$code)]);
 $otherClaims=['sub'=>'other-google-sub','email'=>'other@example.test','name'=>'Other'];$other=googleParentSession($p,$otherClaims,nonce($p),'',30,'',true);denied(fn()=>googleParentSession($p,$otherClaims,nonce($p),'',30,$code,true),409,'existing family cannot be silently replaced');check(!$p->query("SELECT used_at FROM pairing_codes WHERE id='$pair'")->fetchColumn(),'failed join leaves invitation usable');
 $cpClaims=['sub'=>'coparent-google-sub','email'=>'cp@example.test','name'=>'Co-parent'];$cp=googleParentSession($p,$cpClaims,nonce($p),'',30,$code,true);check($cp['familyId']===$owner['familyId'],'Google co-parent joins invited family');check((int)$p->query('SELECT COUNT(*) FROM families')->fetchColumn()===2,'co-parent creates no extra family');$stmt=$p->prepare('SELECT role FROM family_members WHERE user_id=?');$stmt->execute([$cp['user']['id']]);check($stmt->fetchColumn()==='co_parent','Google co-parent has limited membership role');denied(fn()=>googleParentSession($p,['sub'=>'replay-sub','email'=>'replay@example.test','name'=>'Replay'],nonce($p),'',30,$code,true),422,'co-parent invitation cannot be reused');
 $legacy=uuid();$p->prepare("INSERT INTO users(id,email,password_hash,display_name,role) VALUES (?,?,?,'Legacy','parent')")->execute([$legacy,'legacy@example.test',password_hash('known-password',PASSWORD_DEFAULT)]);denied(fn()=>googleParentSession($p,['sub'=>'legacy-sub','email'=>'legacy@example.test','name'=>'Legacy'],nonce($p),'known-password',30,'',true),409,'Google-only mode never links legacy history by email/password');
 $GLOBALS['config']=['parent_auth_mode'=>'google'];denied(fn()=>requireParentConfirmation($p,['id'=>$legacy,'role'=>'parent','password_hash'=>password_hash('known-password',PASSWORD_DEFAULT)],['password'=>'known-password']),422,'Google-only confirmation rejects even a valid app password');
 $recoverId=uuid();$recoverEmail='recovery-fixture@gmail.com';$p->prepare("INSERT INTO users(id,email,password_hash,display_name,role) VALUES (?,?,?,'Recovery','parent')")->execute([$recoverId,$recoverEmail,password_hash('retired-password',PASSWORD_DEFAULT)]);
 $recoverFamily=uuid();$p->prepare("INSERT INTO families(id,parent_id,name) VALUES (?,?,'Saved family')")->execute([$recoverFamily,$recoverId]);$p->prepare("INSERT INTO family_members(family_id,user_id,role) VALUES (?,?,'parent')")->execute([$recoverFamily,$recoverId]);
 $oldToken=issueToken($p,$recoverId,30);$recoveryClaims=['sub'=>'recovery-sub','email'=>$recoverEmail,'email_verified'=>true,'iat'=>time()];
 denied(fn()=>googleParentSession($p,['sub'=>'non-gmail-recovery','email'=>'legacy@example.test','email_verified'=>true,'iat'=>time()],nonce($p),'',30,'',true,['legacy@example.test'=>time()+3600]),409,'third-party Google email cannot use Gmail recovery approval');
 denied(fn()=>googleParentSession($p,$recoveryClaims,nonce($p),'',30,'',true),409,'Gmail recovery requires explicit operator approval');
 denied(fn()=>googleParentSession($p,$recoveryClaims,nonce($p),'',30,'',true,[$recoverEmail=>time()-1]),409,'expired operator approval cannot link history');
 denied(fn()=>googleParentSession($p,array_replace($recoveryClaims,['iat'=>time()-600]),nonce($p),'',30,'',true,[$recoverEmail=>time()+3600]),409,'recovery requires freshly issued Google token');
 denied(fn()=>googleParentSession($p,array_replace($recoveryClaims,['email_verified'=>false]),nonce($p),'',30,'',true,[$recoverEmail=>time()+3600]),409,'unverified Google email cannot recover history');
 $recovered=googleParentSession($p,$recoveryClaims,nonce($p),'',30,'',true,[$recoverEmail=>time()+3600]);check($recovered['user']['id']===$recoverId&&$recovered['familyId']===$recoverFamily,'approved Gmail recovery preserves existing user and family');
 $s=$p->prepare('SELECT COUNT(*) FROM sessions WHERE token_hash=?');$s->execute([hash('sha256',$oldToken)]);check((int)$s->fetchColumn()===0,'recovery revokes old app sessions');
 $s=$p->prepare('SELECT password_hash FROM users WHERE id=?');$s->execute([$recoverId]);check(!password_verify('retired-password',$s->fetchColumn()),'recovery retires forgotten app password');
 $returned=googleParentSession($p,$recoveryClaims,nonce($p),'',30,'',true);check($returned['familyId']===$recoverFamily,'after recovery Google subject works without further approval');
 echo "$pass Hostinger Google-only checks passed\n";
}finally{if($p->inTransaction())$p->rollBack();$p->exec('DROP DATABASE '.$db);}
