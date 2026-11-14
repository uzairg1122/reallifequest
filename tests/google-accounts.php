<?php
declare(strict_types=1);
require __DIR__.'/../api/google_accounts.php';
function uuid():string{return bin2hex(random_bytes(16));}
function fail(string $message,int $status=400):never{throw new RuntimeException($message,$status);}
function familyFor(PDO $pdo,string $id):array{$s=$pdo->prepare('SELECT f.* FROM families f JOIN family_members m ON m.family_id=f.id WHERE m.user_id=? LIMIT 1');$s->execute([$id]);return $s->fetch(PDO::FETCH_ASSOC)?:throw new RuntimeException('No family');}
function issueToken(PDO $pdo,string $id,int $days):string{$token=bin2hex(random_bytes(32));$pdo->prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)')->execute([uuid(),$id,hash('sha256',$token),gmdate('Y-m-d H:i:s',time()+86400*$days)]);return $token;}
$pdo=new PDO('mysql:host=127.0.0.1;port=3308;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db='rlq_google_test_'.bin2hex(random_bytes(4));$pdo->exec('CREATE DATABASE '.$db);$pdo->exec('USE '.$db);
$count=0;
function check(bool $value,string $label):void{global $count;if(!$value)throw new RuntimeException($label);$count++;echo "PASS $label\n";}
function nonce(PDO $pdo):string{$hash=hash('sha256',random_bytes(32));$pdo->prepare('INSERT INTO auth_nonces (nonce_hash,expires_at) VALUES (?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))')->execute([$hash]);return $hash;}
function rejects(callable $fn,int $status,string $label):void{try{$fn();check(false,$label);}catch(RuntimeException $e){check($e->getCode()===$status,$label);}}
try{
 $pdo->exec(file_get_contents(__DIR__.'/../api/schema.sql'));
 $pdo->exec(file_get_contents(__DIR__.'/../api/migration-009-google-auth.sql'));
 $claims=['sub'=>'parent-sub','email'=>'parent@test.invalid','name'=>'Google Parent'];
 $firstNonce=nonce($pdo);$first=googleParentSession($pdo,$claims,$firstNonce,'',30);
 check($first['user']['role']==='parent','new parent created');
 check((int)$pdo->query('SELECT COUNT(*) FROM families')->fetchColumn()===1,'one family created');
 $pdo->prepare('UPDATE families SET name=? WHERE id=?')->execute(['Saved family history',$first['familyId']]);
 $again=googleParentSession($pdo,array_replace($claims,['email'=>'changed@test.invalid']),nonce($pdo),'',30);
 check($again['user']['id']===$first['user']['id']&&$again['familyId']===$first['familyId'],'returning subject keeps same account and family');
 check($pdo->query('SELECT name FROM families')->fetchColumn()==='Saved family history','saved family data preserved');
 check($again['token']!==$first['token'],'returning login creates fresh session');
 check((int)$pdo->query('SELECT COUNT(*) FROM auth_identities')->fetchColumn()===1,'no duplicate identity');
 rejects(fn()=>googleParentSession($pdo,$claims,$firstNonce,'',30),401,'used nonce cannot be replayed');
 $legacy=uuid();$family=uuid();
 $pdo->prepare("INSERT INTO users (id,email,password_hash,display_name,role) VALUES (?,?,?,?,'parent')")->execute([$legacy,'legacy@test.invalid',password_hash('ExistingPassword123',PASSWORD_DEFAULT),'Legacy Parent']);
 $pdo->prepare('INSERT INTO families (id,parent_id,name) VALUES (?,?,?)')->execute([$family,$legacy,'Existing history']);
 $pdo->prepare("INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,'parent')")->execute([$family,$legacy]);
 $linkClaims=['sub'=>'legacy-google','email'=>'legacy@test.invalid','name'=>'Legacy'];$linkNonce=nonce($pdo);
 rejects(fn()=>googleParentSession($pdo,$linkClaims,$linkNonce,'',30),409,'existing account requires password');
 rejects(fn()=>googleParentSession($pdo,$linkClaims,$linkNonce,'wrong',30),401,'wrong linking password denied');
 $linked=googleParentSession($pdo,$linkClaims,$linkNonce,'ExistingPassword123',30);
 check($linked['user']['id']===$legacy&&$linked['familyId']===$family,'link keeps existing account and family');
 $child=uuid();$pdo->prepare("INSERT INTO users (id,email,password_hash,display_name,role) VALUES (?,?,?,?,'child')")->execute([$child,'child@test.invalid','x','Child']);
 rejects(fn()=>googleParentSession($pdo,['sub'=>'child-sub','email'=>'child@test.invalid','name'=>'Child'],nonce($pdo),'',30),403,'child cannot become parent through Google');
 check((int)$pdo->query('SELECT COUNT(*) FROM families')->fetchColumn()===2,'retries never create extra family');
 echo "$count Google account checks passed\n";
}finally{if($pdo->inTransaction())$pdo->rollBack();$pdo->exec('DROP DATABASE '.$db);}
