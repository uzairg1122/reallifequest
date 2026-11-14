<?php
if($parts===['account','auth-methods']&&$method==='GET'){
 if($user['role']!=='parent')fail('Parent account required.',403);
 $stmt=$pdo->prepare("SELECT 1 FROM auth_identities WHERE user_id=? AND provider='google'");$stmt->execute([$user['id']]);
 jsonResponse(['google'=>(bool)$stmt->fetchColumn(),'moderator'=>isSafetyModerator($pdo,$user),'primary'=>($family['parent_id']===$user['id'])]);
}
if($parts===['account','reauth-google']&&$method==='POST'){
 if($user['role']!=='parent')fail('Parent account required.',403);inviteThrottle($pdo,'reauth-'.$user['id']);
 $in=body();$nonce=(string)($in['nonce']??'');$token=(string)($in['idToken']??'');
 require_once __DIR__.'/google_token.php';
 try{$claims=verifyGoogleToken($token,(string)($config['google_client_id']??''),$nonce,googleSigningCertificates());}catch(Throwable $e){fail('Google verification failed. Please try again.',422);}
 $stmt=$pdo->prepare("SELECT 1 FROM auth_identities WHERE provider='google' AND subject=? AND user_id=?");$stmt->execute([$claims['sub'],$user['id']]);
 if(!$stmt->fetchColumn())fail('Choose the Google account connected to this parent.',403);
 $pdo->beginTransaction();
 try{
  $stmt=$pdo->prepare('DELETE FROM auth_nonces WHERE nonce_hash=? AND expires_at>UTC_TIMESTAMP()');$stmt->execute([hash('sha256',$nonce)]);
  if($stmt->rowCount()!==1){$pdo->rollBack();fail('Google confirmation expired. Please verify again.',422);}
  $grant=bin2hex(random_bytes(32));
  $pdo->prepare('DELETE FROM reauth_grants WHERE user_id=? OR expires_at<=UTC_TIMESTAMP()')->execute([$user['id']]);
  $pdo->prepare('INSERT INTO reauth_grants (token_hash,user_id,session_hash,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))')->execute([hash('sha256',$grant),$user['id'],hash('sha256',bearer())]);$pdo->commit();
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 clearInviteThrottle($pdo,'reauth-'.$user['id']);jsonResponse(['reauthToken'=>$grant]);
}
if($parts===['account','delete-self']&&$method==='POST'){
 $primaryCheck=$pdo->prepare('SELECT 1 FROM families WHERE parent_id=?');$primaryCheck->execute([$user['id']]);
 if($user['role']!=='parent'||$primaryCheck->fetchColumn())fail('The primary parent must use Delete family. Only co-parents can delete their own account here.',403);
 $in=body();if(($in['confirm']??'')!=='DELETE MY ACCOUNT')fail('Type DELETE MY ACCOUNT to confirm.',422);
 requireParentConfirmation($pdo,$user,$in);$pdo->beginTransaction();
 try{
  $pdo->prepare('UPDATE tasks t JOIN families f ON f.id=t.family_id SET t.created_by=f.parent_id WHERE t.created_by=?')->execute([$user['id']]);
  $pdo->prepare('DELETE FROM users WHERE id=?')->execute([$user['id']]);$pdo->commit();
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 jsonResponse(['ok'=>true,'deleted'=>true]);
}
