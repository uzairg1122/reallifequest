<?php
if($parts===['auth','password','request']&&$method==='POST'){
 $in=body();$email=strtolower(trim((string)($in['email']??'')));if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Enter a valid parent email.',422);
 inviteThrottle($pdo,'password-reset-'.hash('sha256',$email));
 if(empty($config['reset_mail_enabled'])||!publicAppOrigin())fail('Email recovery is not available yet. Use your linked Google account or contact support@nomolabs.pro.',503);
 $stmt=$pdo->prepare("SELECT id FROM users WHERE email=? AND role='parent'");$stmt->execute([$email]);$id=$stmt->fetchColumn();
 if($id){
  $token=bin2hex(random_bytes(32));$pdo->prepare('DELETE FROM password_resets WHERE user_id=? OR expires_at<=UTC_TIMESTAMP()')->execute([$id]);
  $pdo->prepare('INSERT INTO password_resets (token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))')->execute([hash('sha256',$token),$id]);
  $url=publicAppOrigin().'/reset-password.html#token='.rawurlencode($token);
  $from=(string)($config['mail_from']??'');
  if(!filter_var($from,FILTER_VALIDATE_EMAIL)||!mail($email,'Reset your Super Tasker password',"Use this link within 15 minutes to reset your password:\n".$url."\nIf you did not request this, ignore this email.","From: ".$from."\r\nContent-Type: text/plain; charset=UTF-8"))error_log('[RLQ] Password reset email could not be sent; check mail configuration.');
 }
 jsonResponse(['ok'=>true,'message'=>'If a parent account uses that email, a reset link will arrive shortly.']);
}
if($parts===['auth','password','reset']&&$method==='POST'){
 inviteThrottle($pdo,'password-reset-token');$in=body();$token=(string)($in['token']??'');$next=(string)($in['password']??'');
 if(!preg_match('/^[a-f0-9]{64}$/D',$token)||strlen($next)<8||strlen($next)>72)fail('Use a valid reset link and an 8–72 character password.',422);
 $pdo->beginTransaction();
 try{
  $stmt=$pdo->prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE');$stmt->execute([hash('sha256',$token)]);$id=$stmt->fetchColumn();if(!$id){$pdo->rollBack();fail('This reset link has expired or was already used.',422);}
  $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($next,PASSWORD_DEFAULT),$id]);$pdo->prepare('DELETE FROM sessions WHERE user_id=?')->execute([$id]);$pdo->prepare('DELETE FROM password_resets WHERE user_id=?')->execute([$id]);$pdo->commit();
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 clearInviteThrottle($pdo,'password-reset-token');jsonResponse(['ok'=>true]);
}
