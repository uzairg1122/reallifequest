<?php
declare(strict_types=1);

// Called in the same transaction as the notification. No network calls here.
function queuePush(PDO $pdo,string $notificationId,string $userId):void {
 if(empty($GLOBALS['config']['push']['enabled']))return;
 $devices=$pdo->prepare('SELECT d.id,d.session_hash FROM push_devices d JOIN sessions s ON s.token_hash=d.session_hash AND s.user_id=d.user_id WHERE d.user_id=? AND s.expires_at>UTC_TIMESTAMP()');
 $devices->execute([$userId]);
 $insert=$pdo->prepare('INSERT IGNORE INTO push_outbox(id,notification_id,device_id,user_id,session_hash,available_at,created_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())');
 foreach($devices->fetchAll() as $device)$insert->execute([uuid(),$notificationId,$device['id'],$userId,$device['session_hash']]);
 $GLOBALS['rlq_push_pending']=true;
}

function pushRoutes(PDO $pdo,array $user,array $parts,string $method,array $config):void {
 if($parts!==['notifications','device'])return;
 if($method!=='POST')fail('Method not allowed.',405);
 if(empty($config['push']['enabled']))fail('Phone notifications are not enabled on the server yet.',503);
 $in=body();$installation=(string)($in['installationId']??'');
 if(!preg_match('/^[a-f0-9-]{32,64}$/D',$installation))fail('Invalid phone registration.',422);
 $installationHash=hash('sha256',$installation);$sessionHash=hash('sha256',bearer());
 if(!empty($in['disable'])){
  $pdo->prepare('DELETE FROM push_devices WHERE installation_hash=? AND user_id=? AND session_hash=?')->execute([$installationHash,$user['id'],$sessionHash]);
  jsonResponse(['ok'=>true]);
 }
 $token=(string)($in['token']??'');
 $channel=(string)($in['channelId']??'');
 if($channel!==''&&!preg_match('/^rlq_[a-f0-9]{24}$/D',$channel))fail('Invalid phone notification channel.',422);
 if(strlen($token)<40||strlen($token)>4096||!preg_match('/^[A-Za-z0-9_:\-]+$/D',$token))fail('Invalid notification token.',422);
 savePushDevice($pdo,$user['id'],$sessionHash,$installationHash,$token,$channel);
 jsonResponse(['ok'=>true]);
}

function savePushDevice(PDO $pdo,string $userId,string $sessionHash,string $installationHash,string $token,string $channel):void {
 // The native installation id and FCM token are unguessable device credentials.
 // Rebinding a shared phone drops old queued messages before setting its owner.
 $pdo->beginTransaction();
 try{
  $lookup=$pdo->prepare('SELECT * FROM push_devices WHERE installation_hash=? OR token_hash=? FOR UPDATE');
  $lookup->execute([$installationHash,hash('sha256',$token)]);
  $deviceId='';
  foreach($lookup->fetchAll() as $old){
   if($old['installation_hash']===$installationHash&&$old['user_id']===$userId&&$old['session_hash']===$sessionHash&&$old['token_hash']===hash('sha256',$token)){$deviceId=$old['id'];continue;}
   $pdo->prepare('DELETE FROM push_devices WHERE id=?')->execute([$old['id']]);
  }
  // An app resume must not erase pending deliveries for an unchanged binding.
  if($deviceId===''){$deviceId=uuid();$pdo->prepare('INSERT INTO push_devices(id,installation_hash,user_id,session_hash,token_hash,fcm_token) VALUES (?,?,?,?,?,?)')->execute([$deviceId,$installationHash,$userId,$sessionHash,hash('sha256',$token),$token]);}
  else $pdo->prepare('UPDATE push_devices SET updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([$deviceId]);
  if($channel!=='')$pdo->prepare('INSERT INTO push_delivery_settings(device_id,channel_id) VALUES (?,?) ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id)')->execute([$deviceId,$channel]);
  $pdo->commit();
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

// FCM may rotate its token while JavaScript is closed. Prove possession of the
// existing installation + token; this endpoint cannot change the account/session.
function refreshPushToken(PDO $pdo,array $in):void {
 $installation=(string)($in['installationId']??'');$old=(string)($in['previousToken']??'');$next=(string)($in['token']??'');
 if(!preg_match('/^[a-f0-9-]{32,64}$/D',$installation)||strlen($old)<40||strlen($old)>4096||strlen($next)<40||strlen($next)>4096||!preg_match('/^[A-Za-z0-9_:\-]+$/D',$next))fail('Invalid notification refresh.',422);
 inviteThrottle($pdo,'push-refresh');
 $stmt=$pdo->prepare('UPDATE push_devices d JOIN sessions s ON s.token_hash=d.session_hash AND s.user_id=d.user_id AND s.expires_at>UTC_TIMESTAMP() SET d.fcm_token=?,d.token_hash=?,d.updated_at=UTC_TIMESTAMP() WHERE d.installation_hash=? AND d.token_hash=?');
 try{$stmt->execute([$next,hash('sha256',$next),hash('sha256',$installation),hash('sha256',$old)]);}catch(PDOException $e){if((int)($e->errorInfo[1]??0)!==1062)throw $e;fail('Notification refresh not available.',409);}
 if(!$stmt->rowCount())fail('Reopen the app to reconnect notifications.',401);
 jsonResponse(['ok'=>true]);
}

function pushHttp(string $url,array $payload,array $headers=[]):array {
 if(!function_exists('curl_init'))throw new RuntimeException('Push requires PHP cURL.');
 $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,CURLOPT_HTTPHEADER=>$headers,CURLOPT_POSTFIELDS=>json_encode($payload,JSON_THROW_ON_ERROR)]);
 $body=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
 return [$status,is_string($body)?(json_decode($body,true)?:[]):[]];
}

function pushAccessToken(array $push):string {
 return serviceAccountAccessToken($push, 'https://www.googleapis.com/auth/firebase.messaging');
}

function serviceAccountAccessToken(array $settings, string $scope):string {
 static $tokens=[];
 $cacheKey=$scope.':'.($settings['service_account_file']??'');
 if(isset($tokens[$cacheKey]))return $tokens[$cacheKey];
 $path=(string)($settings['service_account_file']??'');$real=realpath($path);
 if(!$real||!is_file($real)||preg_match('~(?:^|[\\\\/])public_html(?:[\\\\/]|$)~i',$real))throw new RuntimeException('Store push service-account credentials outside public_html.');
 $key=json_decode((string)file_get_contents($real),true,512,JSON_THROW_ON_ERROR);
 if(isset($settings['project_id'])&&($key['project_id']??'')!==$settings['project_id'])throw new RuntimeException('Push project and service account do not match.');
 $b64=fn(string $s):string=>rtrim(strtr(base64_encode($s),'+/','-_'),'=');$now=time();
 $jwt=$b64(json_encode(['alg'=>'RS256','typ'=>'JWT'])).'.'.$b64(json_encode(['iss'=>$key['client_email'],'scope'=>$scope,'aud'=>'https://oauth2.googleapis.com/token','iat'=>$now,'exp'=>$now+3500]));
 if(!openssl_sign($jwt,$signature,$key['private_key'],OPENSSL_ALGO_SHA256))throw new RuntimeException('Push signing failed.');
 $ch=curl_init('https://oauth2.googleapis.com/token');
 curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,CURLOPT_POSTFIELDS=>http_build_query(['grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion'=>$jwt.'.'.$b64($signature)])]);
 $body=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);$value=json_decode((string)$body,true);
 if($status!==200||empty($value['access_token']))throw new RuntimeException('Push authentication failed. Check the private service account and FCM API.');
 return $tokens[$cacheKey]=(string)$value['access_token'];
}

// Only generic text crosses FCM. Names, mission text, photos, PINs and bearer tokens stay on Hostinger.
function pushText(string $type):array {
 return match($type){
  'task_assigned'=>['A new mission awaits','Open Real Life Quest to see your new task.'],
  'task_submitted'=>['Mission ready for review','Open Real Life Quest to review your child\'s work.'],
  'task_approved'=>['Mission approved!','Your coins and progress are ready.'],
  'task_rejected'=>['Mission needs another try','Open Real Life Quest for your parent\'s feedback.'],
  'reward_requested'=>['Reward request','Your child has a reward request to review.'],
  'reward_approved'=>['You earned a reward!','Open Real Life Quest to see your reward.'],
  default=>['Family update','Open Real Life Quest to see your family update.']
 };
}

function drainPush(PDO $pdo,array $push,int $limit=20,?callable $transport=null):array {
 if(empty($push['enabled']))return ['sent'=>0,'failed'=>0];
 $limit=max(1,min(50,$limit));$sent=0;$failed=0;$errors=[];
 // Atomic row leases permit cron + post-response workers without simultaneous sends.
 $due=$pdo->query("SELECT id FROM push_outbox WHERE available_at<=UTC_TIMESTAMP() AND (locked_until IS NULL OR locked_until<UTC_TIMESTAMP()) ORDER BY created_at LIMIT $limit")->fetchAll();
 foreach($due as $candidate){
  $claim=$pdo->prepare('UPDATE push_outbox SET locked_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 60 SECOND) WHERE id=? AND available_at<=UTC_TIMESTAMP() AND (locked_until IS NULL OR locked_until<UTC_TIMESTAMP())');$claim->execute([$candidate['id']]);if(!$claim->rowCount())continue;
  $read=$pdo->prepare('SELECT q.*,n.type,d.fcm_token,p.channel_id FROM push_outbox q JOIN notifications n ON n.id=q.notification_id JOIN push_devices d ON d.id=q.device_id AND d.user_id=q.user_id AND d.session_hash=q.session_hash JOIN sessions s ON s.token_hash=d.session_hash AND s.user_id=d.user_id AND s.expires_at>UTC_TIMESTAMP() LEFT JOIN push_delivery_settings p ON p.device_id=d.id WHERE q.id=?');$read->execute([$candidate['id']]);$row=$read->fetch();
  if(!$row){$pdo->prepare('DELETE FROM push_outbox WHERE id=?')->execute([$candidate['id']]);continue;}
  try{
   [$title,$body]=pushText($row['type']);
   $message=['message'=>['token'=>$row['fcm_token'],'data'=>['notificationId'=>$row['notification_id'],'userId'=>$row['user_id'],'sessionHash'=>$row['session_hash'],'type'=>$row['type'],'title'=>$title,'body'=>$body],'android'=>['priority'=>'HIGH','ttl'=>'86400s']]];
   if(!empty($row['channel_id'])){
    // Android/Google Play services can display this while the application process is asleep.
    // Only generic text is visible; authenticated family data is fetched after opening the app.
    $message['message']['notification']=['title'=>$title,'body'=>$body];
    $message['message']['android']['notification']=['channel_id'=>$row['channel_id'],'tag'=>'rlq:'.$row['notification_id'],'icon'=>'ic_notification','color'=>'#008999','visibility'=>'PRIVATE','notification_priority'=>'PRIORITY_HIGH'];
   }
   [$status,$response]=$transport?$transport($message):pushHttp('https://fcm.googleapis.com/v1/projects/'.rawurlencode($push['project_id']).'/messages:send',$message,['Content-Type: application/json','Authorization: Bearer '.pushAccessToken($push)]);
   $unregistered=false;foreach(($response['error']['details']??[]) as $detail)if(($detail['errorCode']??'')==='UNREGISTERED')$unregistered=true;
   if($unregistered){$pdo->prepare('DELETE FROM push_devices WHERE id=?')->execute([$row['device_id']]);continue;}
   if($status>=200&&$status<300){$pdo->prepare('DELETE FROM push_outbox WHERE id=?')->execute([$row['id']]);$sent++;continue;}
   $code=$response['error']['status']??'NETWORK_ERROR';
   throw new RuntimeException('FCM_'.(in_array($code,['PERMISSION_DENIED','UNAUTHENTICATED','INVALID_ARGUMENT','UNAVAILABLE','RESOURCE_EXHAUSTED','NOT_FOUND'],true)?$code:'NETWORK_ERROR'));
  }catch(Throwable $e){
   $attempt=(int)$row['attempts']+1;$failed++;
   if($attempt>=8){$pdo->prepare('DELETE FROM push_outbox WHERE id=?')->execute([$row['id']]);error_log('[RLQ push] Delivery exhausted; in-app notification retained.');}
   else{$delay=min(3600,30*(2**$attempt));$pdo->prepare('UPDATE push_outbox SET attempts=?,locked_until=NULL,available_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND) WHERE id=?')->execute([$attempt,$delay,$row['id']]);}
   // Never log tokens, service keys, payloads or private family text.
   $reason=preg_match('/^FCM_[A-Z_]+$/D',$e->getMessage())?$e->getMessage():'SENDER_AUTH_OR_CONFIGURATION';
   $errors[$reason]=($errors[$reason]??0)+1;error_log('[RLQ push] Delivery failed: '.$reason);
  }
 }
 return ['sent'=>$sent,'failed'=>$failed]+($errors?['errors'=>$errors]:[]);
}
