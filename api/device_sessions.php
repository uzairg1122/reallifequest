<?php
declare(strict_types=1);
function issueChildDevice(PDO $pdo,string $child,string $family):string {
 $token=bin2hex(random_bytes(32));
 $pdo->prepare('INSERT INTO child_devices(token_hash,child_id,family_id,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 365 DAY))')->execute([hash('sha256',$token),$child,$family]);
 return $token;
}
function childDeviceLogin(PDO $pdo,array $input,int $ttl):array {
 $name=trim((string)($input['displayName']??''));$pin=(string)($input['pin']??'');$device=(string)($input['deviceToken']??'');$code=normalizeCode((string)($input['deviceCode']??''));
 if($name===''||!preg_match('/^\d{4}$/D',$pin))fail('Enter the child name and 4-digit PIN.',422);
 if($code!==''&&!preg_match('/^\d{6}$/D',$code))fail('Enter the six-digit phone connection code from your parent.',422);
 if($code===''&&!preg_match('/^[a-f0-9]{64}$/D',$device))fail('Ask your parent for a phone connection code from Family & account.',422);
 // Both a source limit and a child-bound limit survive changing names or devices.
 inviteThrottle($pdo,'child-device-login');
 $pdo->beginTransaction();
 try{
  if($code!==''){$find=$pdo->prepare('SELECT child_id,family_id FROM child_device_invites WHERE code_hash=? AND expires_at>UTC_TIMESTAMP() AND used_at IS NULL FOR UPDATE');$find->execute([hash('sha256',$code)]);}
  else{$find=$pdo->prepare('SELECT child_id,family_id FROM child_devices WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE');$find->execute([hash('sha256',$device)]);}
  $binding=$find->fetch();if(!$binding){$pdo->rollBack();fail('Phone connection expired or is invalid. Ask your parent for a new code.',401);}
  $find=$pdo->prepare("SELECT u.* FROM users u JOIN family_members m ON m.user_id=u.id WHERE u.id=? AND m.family_id=? AND u.role='child' AND m.role='child' FOR UPDATE");$find->execute([$binding['child_id'],$binding['family_id']]);$child=$find->fetch();
  if(!$child){$pdo->rollBack();fail('This child is no longer in the connected family.',401);}
  // Count wrong PIN attempts per child across IP addresses and connection codes.
  $key=hash('sha256','child-id|'.$child['id']);
  $pdo->prepare('INSERT INTO child_login_limits(attempt_key,attempts,window_start) VALUES (?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_start<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),1,attempts+1),window_start=IF(window_start<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),UTC_TIMESTAMP(),window_start)')->execute([$key]);
  $limit=$pdo->prepare('SELECT attempts FROM child_login_limits WHERE attempt_key=?');$limit->execute([$key]);
  if((int)$limit->fetchColumn()>5){$pdo->commit();fail('Too many PIN attempts. Please try again in 15 minutes.',429);}
  if(mb_strtolower($name)!==mb_strtolower($child['display_name'])||empty($child['child_pin_hash'])||!password_verify($pin,$child['child_pin_hash'])){$pdo->commit();fail('Child name or PIN is incorrect. Ask your parent if you need a new PIN.',401);}
  if($code!==''){$pdo->prepare('UPDATE child_device_invites SET used_at=UTC_TIMESTAMP() WHERE code_hash=?')->execute([hash('sha256',$code)]);$device=issueChildDevice($pdo,$child['id'],$binding['family_id']);}
  $pdo->prepare('DELETE FROM child_login_limits WHERE attempt_key=?')->execute([$key]);
  $session=issueToken($pdo,$child['id'],$ttl);$pdo->commit();
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 clearInviteThrottle($pdo,'child-device-login');
 return ['user'=>['id'=>$child['id'],'displayName'=>$child['display_name'],'role'=>'child','age'=>$child['age']??null],'familyId'=>$binding['family_id'],'token'=>$session,'childDeviceToken'=>$device];
}
