<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
// Keep worker and service-account JSON outside public_html on Hostinger.
$apiDirectory=dirname(__DIR__).'/public_html/api';
$configPath=$argv[1]??$apiDirectory.'/config.php';$helperPath=$argv[2]??$apiDirectory.'/push_notifications.php';
if(!is_file($configPath)||!is_file($helperPath)){fwrite(STDERR,"API files not found. Put send-push.php in private next to public_html, or pass the config.php and push_notifications.php absolute paths.\n");exit(1);}
$config=require $configPath;require $helperPath;
$workerLock = fopen(__DIR__.'/send-push.lock','c');
if (!$workerLock) exit(1);
if (!flock($workerLock,LOCK_EX | LOCK_NB)) exit(0);
try{
 $d=$config['db'];$pdo=new PDO("mysql:host={$d['host']};dbname={$d['name']};charset={$d['charset']}",$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
 $api = dirname($helperPath);
 if (!empty($config['billing']['enabled'])) {
     require $api.'/family_plan.php';
     $subscriptions = $pdo->query("SELECT family_id,purchase_token FROM family_plans WHERE purchase_token IS NOT NULL
         AND (checked_at IS NULL OR checked_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR))
         ORDER BY checked_at LIMIT 10")->fetchAll();
     foreach ($subscriptions as $subscription) {
         try {
             verifyFamilyPurchase($pdo,$config['billing'],$subscription['family_id'],$subscription['purchase_token']);
         } catch (Throwable $error) {
             error_log('Play subscription refresh failed: '.$error->getMessage());
             $pdo->prepare('UPDATE family_plans SET checked_at=UTC_TIMESTAMP() WHERE family_id=? AND purchase_token=?')
                 ->execute([$subscription['family_id'],$subscription['purchase_token']]);
         }
     }
 }
 $assigned = 0;
 if (!empty($config['recurring_missions_enabled'])) {
     require $api.'/quest_helpers.php';
     require $api.'/mission_common.php';
     require $api.'/family_routines.php';
     $assigned = assignDueMissions($pdo,!empty($config['billing']['enabled']));
 }
 $result=drainPush($pdo,$config['push']??[],50);
 $result['assigned'] = $assigned;
 echo json_encode($result).PHP_EOL;
 // Prune only stale delivery metadata; never notifications/history/family data.
 $pdo->exec('DELETE d FROM push_devices d LEFT JOIN sessions s ON s.token_hash=d.session_hash AND s.user_id=d.user_id AND s.expires_at>UTC_TIMESTAMP() WHERE s.id IS NULL');
}catch(Throwable $e){fwrite(STDERR,"Push worker failed. Check private configuration and PHP error log.\n");exit(1);}
