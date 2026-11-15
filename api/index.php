<?php
declare(strict_types=1);
ini_set('display_errors','0');

$config = require (getenv('RLQ_TEST_CONFIG') ?: __DIR__ . '/config.php');
require __DIR__ . '/quest_helpers.php';
require __DIR__ . '/release_helpers.php';
require __DIR__ . '/device_sessions.php';
require __DIR__ . '/push_notifications.php';
require __DIR__ . '/mission_common.php';
require __DIR__ . '/family_plan.php';
require __DIR__ . '/family_routines.php';

function jsonResponse(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): never { jsonResponse(['error' => $message], $status); }
set_exception_handler(function (Throwable $error): void {
    error_log('[Super Tasker] API request failed: ' . $error->getMessage());
    if ($error instanceof PDOException && in_array((int)($error->errorInfo[1] ?? 0), [1054, 1146], true)) {
        fail('Your family data is safe. The service needs an update. Please contact support@nomolabs.pro.', 503);
    }
    fail('The server could not finish this request. Please check the hosting PHP error log.', 500);
});
function body(): array { $value = json_decode(file_get_contents('php://input'), true); return is_array($value) ? $value : []; }
function bearer(): string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) return trim($m[1]);
    fail('Authentication required.', 401);
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $config['cors_origins'], true)) header("Access-Control-Allow-Origin: $origin");
header('Vary: Origin'); header('Access-Control-Allow-Headers: Content-Type, Authorization, X-RLQ-Trial-Device'); header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

try {
    $db = $config['db'];
    $pdo = new PDO("mysql:host={$db['host']};dbname={$db['name']};charset={$db['charset']}", $db['user'], $db['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
} catch (Throwable $e) {
    // Keep credentials and driver details out of the public response; Hostinger
    // error logs still receive the real reason for troubleshooting.
    error_log('[Super Tasker] Database connection failed: ' . $e->getMessage());
    fail('Database is not configured yet.', 503);
}

$method = $_SERVER['REQUEST_METHOD'];
// Send immediately after a committed event on FastCGI AND Hostinger LiteSpeed.
// Where response flushing is unavailable, one bounded send runs before PHP ends.
if(!empty($config['push']['enabled']))register_shutdown_function(function()use($pdo,$config):void{
 if(empty($GLOBALS['rlq_push_pending'])||$pdo->inTransaction())return;
 $limit=1;if(function_exists('fastcgi_finish_request')){fastcgi_finish_request();$limit=3;}elseif(function_exists('litespeed_finish_request')){litespeed_finish_request();$limit=3;}
 try{drainPush($pdo,$config['push'],$limit);}catch(Throwable $e){error_log('[RLQ push] Worker unavailable; pending notifications kept for cron.');}
});
$path = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '', '/');
$path = preg_replace('#^api/?#', '', $path);
$parts = $path === '' ? [] : explode('/', $path);

function currentUser(PDO $pdo): array {
    $hash = hash('sha256', bearer());
    $stmt = $pdo->prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP()');
    $stmt->execute([$hash]); $user = $stmt->fetch(); if (!$user) fail('Session expired. Please sign in again.', 401);
    // Extend active sessions only near expiry, avoiding a write on every poll.
    $days=max(1,min(90,(int)($GLOBALS['config']['token_ttl_days']??30)));
    $pdo->prepare('UPDATE sessions SET expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? DAY) WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() AND expires_at<DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? DAY)')->execute([$days,$hash,max(1,$days-1)]);
    return $user;
}
function issueToken(PDO $pdo, string $userId, int $days): string {
    $token = bin2hex(random_bytes(32)); $expires = gmdate('Y-m-d H:i:s', time() + $days * 86400);
    $stmt = $pdo->prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)'); $stmt->execute([uuid(), $userId, hash('sha256', $token), $expires]); return $token;
}
function familyFor(PDO $pdo, string $userId): array {
    $stmt = $pdo->prepare('SELECT f.* FROM families f JOIN family_members m ON m.family_id=f.id WHERE m.user_id=? LIMIT 1'); $stmt->execute([$userId]); $family = $stmt->fetch(); if (!$family) fail('Join a family first.', 403); return $family;
}

if ($parts === ['health'] && $method === 'GET') jsonResponse(['ok' => true, 'service' => 'real-life-quest-api', 'backend'=>'php','parentAuth'=>$config['parent_auth_mode']??'legacy','version' => '2026-11-12-child-pin','pushEnabled'=>!empty($config['push']['enabled'])]);
if ($parts === ['auth','logout'] && $method === 'POST') {
    $pdo->prepare('DELETE FROM sessions WHERE token_hash=?')->execute([hash('sha256',bearer())]);jsonResponse(['ok'=>true]);
}
if($parts===['notifications','refresh-device']&&$method==='POST'){
 if(empty($config['push']['enabled']))fail('Phone notifications are not enabled yet.',503);
 refreshPushToken($pdo,body());
}

if(($config['parent_auth_mode']??'legacy')==='google'&&in_array($path,['auth/register','auth/login','auth/register-coparent','auth/password/request','auth/password/reset','account/password'],true))fail('Parents sign in with Google. Manage account recovery through Google.',403);

require __DIR__ . '/google_auth_routes.php';
require __DIR__ . '/password_recovery.php';

if ($parts === ['auth','register'] && $method === 'POST') {
    $input = body(); $email = strtolower(trim((string)($input['email'] ?? ''))); $password = (string)($input['password'] ?? ''); $name = trim((string)($input['displayName'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || $name === '') fail('Enter a valid email, an 8-character password and a name.');
    $id = uuid(); $pdo->beginTransaction();
    try { $pdo->prepare('INSERT INTO users (id,email,password_hash,display_name,role) VALUES (?,?,?,?,?)')->execute([$id,$email,password_hash($password,PASSWORD_DEFAULT),$name,'parent']); $familyId=uuid(); $pdo->prepare('INSERT INTO families (id,parent_id,name) VALUES (?,?,?)')->execute([$familyId,$id,$name."'s Family"]); $pdo->prepare('INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,?)')->execute([$familyId,$id,'parent']); $pdo->commit(); } catch (Throwable $e) { $pdo->rollBack(); fail('That email may already be registered.',409); }
    $ref=normalizeCode((string)($input['ref']??'')); if($ref!==''){ try { $rf=$pdo->prepare('SELECT id FROM families WHERE referral_code=? LIMIT 1'); $rf->execute([strtoupper($ref)]); $refFam=$rf->fetchColumn(); if($refFam) $pdo->prepare('INSERT IGNORE INTO referrals (id,referrer_family_id,new_user_id) VALUES (?,?,?)')->execute([uuid(),$refFam,$id]); } catch (Throwable $e) { error_log('[Super Tasker] referral capture skipped: '.$e->getMessage()); } }
    jsonResponse(['user'=>['id'=>$id,'displayName'=>$name,'role'=>'parent'],'familyId'=>$familyId,'token'=>issueToken($pdo,$id,$config['token_ttl_days'])],201);
}

if ($parts === ['auth','login'] && $method === 'POST') {
    $input=body(); inviteThrottle($pdo,'parent-login-'.hash('sha256',strtolower(trim((string)($input['email']??''))))); $stmt=$pdo->prepare('SELECT * FROM users WHERE email=? LIMIT 1'); $stmt->execute([strtolower(trim((string)($input['email']??'')))]); $user=$stmt->fetch(); if(!$user || !password_verify((string)($input['password']??''),$user['password_hash'])) fail('Email or password is incorrect.',401);
    clearInviteThrottle($pdo,'parent-login-'.hash('sha256',strtolower(trim((string)($input['email']??'')))));
    jsonResponse(['user'=>['id'=>$user['id'],'displayName'=>$user['display_name'],'role'=>$user['role'],'age'=>$user['age']??null],'token'=>issueToken($pdo,$user['id'],$config['token_ttl_days'])]);
}

if ($parts === ['auth','register-child'] && $method === 'POST') {
    $input = body(); $email = strtolower(trim((string)($input['email'] ?? ''))); $password = (string)($input['password'] ?? ''); $pin = (string)($input['pin'] ?? ''); $code = normalizeCode((string)($input['code'] ?? '')); $name = trim((string)($input['displayName'] ?? '')); $age = (int)($input['age'] ?? 0);
    if (!preg_match('/^\d{6}$/', $code) || $age < 4 || $age > 18) fail('Enter the child age and a six-digit pairing code.');
    if (!preg_match('/^\d{4}$/', $pin)) fail('Choose a 4-digit child PIN.');
    if ($email === '') $email = 'child-' . bin2hex(random_bytes(8)) . '@local.invalid';
    if ($password === '') $password = bin2hex(random_bytes(16));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) fail('Child account details are invalid.');
    inviteThrottle($pdo, 'child-join');
    $pdo->beginTransaction(); $pair=lockPairingCode($pdo,$code,'child');requireInviteFamilyAccess($pdo,$pair);
    $name = $name !== '' ? $name : trim((string)($pair['child_name'] ?? '')); if ($name === '') fail('Child name is required.'); $age = (int)($pair['child_age'] ?: $age); $parentStmt=$pdo->prepare('SELECT parent_id FROM families WHERE id=?'); $parentStmt->execute([$pair['family_id']]); $parentId=(string)$parentStmt->fetchColumn(); $id = uuid();
    try { $pdo->prepare('INSERT INTO users (id,email,password_hash,display_name,role,age) VALUES (?,?,?,?,?,?)')->execute([$id,$email,password_hash($password,PASSWORD_DEFAULT),$name,'child',$age]); $pdo->prepare('UPDATE users SET child_pin_hash=? WHERE id=?')->execute([password_hash($pin,PASSWORD_DEFAULT),$id]); $pdo->prepare('INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,?)')->execute([$pair['family_id'],$id,'child']); $pdo->prepare('INSERT INTO child_wallets (child_id) VALUES (?)')->execute([$id]); $tasks=json_decode((string)($pair['task_payload']??'[]'),true); if(is_array($tasks)){ foreach(array_slice($tasks,0,50) as $task){ if(is_array($task))insertMission($pdo,$pair['family_id'],$parentId,$id,$task); } } $pdo->prepare('UPDATE pairing_codes SET used_at=UTC_TIMESTAMP() WHERE id=?')->execute([$pair['id']]); $pdo->commit(); } catch (Throwable $e) { $pdo->rollBack(); fail('That email may already be registered or the invite is invalid.',409); }
    clearInviteThrottle($pdo, 'child-join');
    jsonResponse(['user'=>['id'=>$id,'displayName'=>$name,'role'=>'child','age'=>$age],'familyId'=>$pair['family_id'],'childDeviceToken'=>issueChildDevice($pdo,$id,$pair['family_id']),'token'=>issueToken($pdo,$id,$config['token_ttl_days'])],201);
}

if ($parts === ['auth','register-coparent'] && $method === 'POST') {
    $input = body(); $email = strtolower(trim((string)($input['email'] ?? ''))); $password = (string)($input['password'] ?? ''); $name = trim((string)($input['displayName'] ?? '')); $code = normalizeCode((string)($input['code'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || $name === '') fail('Enter a valid email, an 8-character password and your name.');
    if (!preg_match('/^\d{6}$/', $code)) fail('Enter the 6-digit co-parent invite code.');
    inviteThrottle($pdo, 'coparent-join');
    $pdo->beginTransaction(); $pair=lockPairingCode($pdo,$code,'co_parent');requireInviteFamilyAccess($pdo,$pair);
    $id = uuid();
    try { $pdo->prepare('INSERT INTO users (id,email,password_hash,display_name,role) VALUES (?,?,?,?,?)')->execute([$id,$email,password_hash($password,PASSWORD_DEFAULT),$name,'parent']); $pdo->prepare('INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,?)')->execute([$pair['family_id'],$id,'co_parent']); $pdo->prepare('UPDATE pairing_codes SET used_at=UTC_TIMESTAMP() WHERE id=?')->execute([$pair['id']]); $pdo->commit(); } catch (Throwable $e) { $pdo->rollBack(); fail('That email may already be registered or the invite is invalid.',409); }
    clearInviteThrottle($pdo, 'coparent-join');
    notify($pdo,$id,'coparent_joined','You joined as a co-parent','You can now help manage missions and rewards.');
    jsonResponse(['user'=>['id'=>$id,'displayName'=>$name,'role'=>'parent'],'familyId'=>$pair['family_id'],'token'=>issueToken($pdo,$id,$config['token_ttl_days'])],201);
}

if ($parts === ['auth','child-login'] && $method === 'POST') jsonResponse(childDeviceLogin($pdo,body(),(int)$config['token_ttl_days']));

$user = currentUser($pdo); $family = null;
$plan = null;
if (!empty($config['billing']['enabled'])) {
    $family = familyFor($pdo, $user['id']);
    $planRow = familyPlan($pdo, $family['id']);
    $trialDevice = $_SERVER['HTTP_X_RLQ_TRIAL_DEVICE'] ?? '';
    $trialBlocked = false;
    if ($planRow['trial_ends_at'] === null && $user['id'] === $family['parent_id']
        && preg_match('/^[a-f0-9]{64}$/D',$trialDevice)) {
        $trialBlocked = !claimFamilyTrial($pdo,$family['id'],$trialDevice);
        $planRow = familyPlan($pdo,$family['id']);
    }
    if ($parts === ['billing','verify'] && $method === 'POST') {
        if ($user['id'] !== $family['parent_id']) fail('Only the primary parent can manage this plan.',403);
        $token = body()['purchaseToken'] ?? null;
        if (!is_string($token) || $token === '' || strlen($token) > 2048) fail('Invalid purchase token.',422);
        verifyFamilyPurchase($pdo, $config['billing'], $family['id'], $token, true);
        $planRow = familyPlan($pdo, $family['id']);
        jsonResponse(['plan'=>publicFamilyPlan($planRow,$family,$user)]);
    }
    if ($planRow['purchase_token'] && !$planRow['paid_active']
        && (!$planRow['checked_at'] || strtotime($planRow['checked_at'].' UTC') < time()-300)) {
        try {
            verifyFamilyPurchase($pdo,$config['billing'],$family['id'],$planRow['purchase_token']);
            $planRow = familyPlan($pdo,$family['id']);
        } catch (Throwable $error) {
            error_log('Play subscription refresh failed: '.$error->getMessage());
            $pdo->prepare('UPDATE family_plans SET checked_at=UTC_TIMESTAMP() WHERE family_id=? AND purchase_token=?')
                ->execute([$family['id'],$planRow['purchase_token']]);
        }
    }
    $plan = publicFamilyPlan($planRow,$family,$user);
    if ($parts === ['billing'] && $method === 'GET') jsonResponse(['plan'=>$plan+['trialBlocked'=>$trialBlocked]]);
    $accountAccess = in_array($parts, [
        ['account','auth-methods'], ['account','reauth-google'], ['account','delete-self'],
        ['safety','export'], ['safety','erase-family'], ['safety','erase-child'], ['family','delete-child'],
    ], true);
    if (!$plan['active'] && !$accountAccess) fail('Your family needs an active plan.',402);
}
pushRoutes($pdo,$user,$parts,$method,$config);
if ($parts === ['families','child-device-code'] && $method === 'POST') {
 if($user['role']!=='parent')fail('Only a parent can connect a child phone.',403);
 $family=familyFor($pdo,$user['id']);$child=(string)(body()['childId']??'');
 $find=$pdo->prepare("SELECT 1 FROM family_members WHERE user_id=? AND family_id=? AND role='child'");$find->execute([$child,$family['id']]);if(!$find->fetchColumn())fail('Child not found in this family.',404);
 inviteThrottle($pdo,'child-device-code');
 $pdo->prepare('DELETE FROM child_device_invites WHERE expires_at<=UTC_TIMESTAMP() OR child_id=?')->execute([$child]);
 for($attempt=0;$attempt<5;$attempt++){
  $code=(string)random_int(100000,999999);
  try{$pdo->prepare('INSERT INTO child_device_invites(code_hash,child_id,family_id,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))')->execute([hash('sha256',$code),$child,$family['id']]);jsonResponse(['code'=>$code,'expiresAt'=>gmdate('c',time()+900)]);}
  catch(PDOException $e){if((int)($e->errorInfo[1]??0)!==1062)throw $e;}
 }
 fail('Could not create a connection code. Please try again.',503);
}
if(($parts[0]??'')==='account'&&in_array($parts[1]??'',['auth-methods','reauth-google','delete-self'],true)){
 $lookup=$pdo->prepare('SELECT f.* FROM families f JOIN family_members m ON m.family_id=f.id WHERE m.user_id=? LIMIT 1');$lookup->execute([$user['id']]);$family=$lookup->fetch()?:['id'=>'','parent_id'=>''];require __DIR__.'/account_release_routes.php';
}
if ($parts === ['families','pairing-code'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only a parent can create a pairing code.',403); $family=familyFor($pdo,$user['id']); $input=body(); $childName=trim((string)($input['childName']??'')); $childAge=(int)($input['childAge']??0); $tasks=$input['tasks']??[]; if($childName===''||$childAge<4||$childAge>18||!is_array($tasks)||count($tasks)<1||count($tasks)>30)fail('Enter a child name, age and choose 1–30 tasks.'); $code=(string)random_int(100000,999999); $payload=json_encode(array_values($tasks),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); $pdo->prepare('INSERT INTO pairing_codes (id,family_id,code_hash,expires_at,child_name,child_age,task_payload) VALUES (?,?,?,?,?,?,?)')->execute([uuid(),$family['id'],hash('sha256',$code),gmdate('Y-m-d H:i:s',time()+86400),$childName,$childAge,$payload]); jsonResponse(['code'=>$code,'expiresAt'=>gmdate('c',time()+86400),'inviteUrl'=>publicAppOrigin().'/?invite='.$code]);
}
if ($parts === ['families','join'] && $method === 'POST') {
 if($user['role']!=='child')fail('Only a child can join.',403);
 $existing=$pdo->prepare('SELECT 1 FROM family_members WHERE user_id=?');$existing->execute([$user['id']]);
 if($existing->fetchColumn())fail('This child already belongs to a family.',409);
 $code=normalizeCode((string)(body()['code']??''));inviteThrottle($pdo,'child-join');$pdo->beginTransaction();
 try{$pair=lockPairingCode($pdo,$code,'child');requireInviteFamilyAccess($pdo,$pair);$pdo->prepare("INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,'child')")->execute([$pair['family_id'],$user['id']]);$pdo->prepare('UPDATE pairing_codes SET used_at=UTC_TIMESTAMP() WHERE id=?')->execute([$pair['id']]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 clearInviteThrottle($pdo,'child-join');jsonResponse(['familyId'=>$pair['family_id']]);
}

$family=$family ?? familyFor($pdo,$user['id']);
require __DIR__ . '/family_routine_routes.php';
require __DIR__ . '/account_release_routes.php';
require __DIR__ . '/moderation_routes.php';
require __DIR__ . '/quest_routes.php';
require __DIR__ . '/reward_routes.php';
require __DIR__ . '/leaderboard_routes.php';
require __DIR__ . '/challenge_routes.php';
require __DIR__ . '/league_routes.php';
require __DIR__ . '/coparent_routes.php';
require __DIR__ . '/share_routes.php';
require __DIR__ . '/safety_routes.php';
if ($parts === ['account','password'] && $method === 'PATCH') {
    if ($user['role'] !== 'parent') fail('Only parents can change an account password.',403);
    $input=body(); $current=(string)($input['currentPassword']??''); $next=(string)($input['newPassword']??'');
    requireParentConfirmation($pdo,$user,array_merge($input,['password'=>$current]));
    if (strlen($next)<8 || strlen($next)>72) fail('Use a new password between 8 and 72 bytes.');
    if ($next===$current) fail('Choose a different new password.');
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($next,PASSWORD_DEFAULT),$user['id']]);
        $pdo->prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?')->execute([$user['id'],hash('sha256',bearer())]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    jsonResponse(['ok'=>true]);
}
if ($parts === ['family','delete-child'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only parents can delete a child profile.',403);
    if (($family['parent_id'] ?? null) !== $user['id']) fail('Only the primary parent can delete a child profile.',403);
    $input=body(); $child=trim((string)($input['childId']??''));
    requireParentConfirmation($pdo,$user,$input);
    $pdo->beginTransaction();
    try {
        $stmt=$pdo->prepare("SELECT u.id FROM users u JOIN family_members m ON m.user_id=u.id WHERE u.id=? AND u.role='child' AND m.role='child' AND m.family_id=? FOR UPDATE");
        $stmt->execute([$child,$family['id']]);
        if (!$stmt->fetch()) { $pdo->rollBack(); fail('Child was not found in your family.',404); }
        $stmt=$pdo->prepare('SELECT family_id FROM family_members WHERE user_id=? AND family_id<>?'); $stmt->execute([$child,$family['id']]);
        if ($stmt->fetch()) { $pdo->rollBack(); fail('This child belongs to another family too. The profile cannot be deleted here.',409); }
        $pdo->prepare('DELETE FROM submissions WHERE child_id=?')->execute([$child]);
        $pdo->prepare('DELETE FROM tasks WHERE assigned_to=?')->execute([$child]);
        // Membership, wallet, sessions and notifications cascade from users.
        $pdo->prepare("DELETE FROM users WHERE id=? AND role='child'")->execute([$child]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    jsonResponse(['ok'=>true]);
}
if ($parts === ['family','child-pin'] && $method === 'PATCH') {
    if ($user['role'] !== 'parent') fail('Only a parent can reset a child PIN.',403);
    $input=body(); $child=trim((string)($input['childId']??'')); $pin=(string)($input['pin']??'');
    if (!preg_match('/^\d{4}$/',$pin)) fail('PIN must contain exactly 4 numbers.');
    $pdo->beginTransaction();
    $stmt=$pdo->prepare("UPDATE users u JOIN family_members m ON m.user_id=u.id SET u.child_pin_hash=? WHERE u.id=? AND m.family_id=? AND m.role='child'"); $stmt->execute([password_hash($pin,PASSWORD_DEFAULT),$child,$family['id']]);
    if ($stmt->rowCount()!==1) {$pdo->rollBack();fail('Child was not found in this family.',404);}
    $pdo->prepare('DELETE FROM sessions WHERE user_id=?')->execute([$child]);
    // Existing phone bindings still require the new PIN on the next sign-in.
    $pdo->prepare('DELETE FROM child_device_invites WHERE child_id=?')->execute([$child]);
    $pdo->prepare('DELETE FROM child_login_limits WHERE attempt_key=?')->execute([hash('sha256','child-id|'.$child)]);
    $pdo->commit();
    notify($pdo,$child,'pin_reset','Your child PIN was reset','Sign in again with the new PIN from your parent.'); jsonResponse(['ok'=>true]);
}
if ($parts === ['family'] && $method === 'GET') { $stmt=$pdo->prepare('SELECT u.id,u.display_name,u.role,COALESCE(w.coins,0) coins,COALESCE(w.xp,0) xp,COALESCE(w.level,1) level,COALESCE(w.stars,0) stars FROM family_members m JOIN users u ON u.id=m.user_id LEFT JOIN child_wallets w ON w.child_id=u.id WHERE m.family_id=? ORDER BY m.role DESC,u.display_name'); $stmt->execute([$family['id']]); jsonResponse(['family'=>$family,'members'=>$stmt->fetchAll()]); }
if ($parts === ['tasks'] && $method === 'GET') { $stmt=$pdo->prepare('SELECT * FROM tasks WHERE family_id=? AND assigned_to=? ORDER BY created_at DESC'); $stmt->execute([$family['id'],$user['id']]); jsonResponse(['tasks'=>$stmt->fetchAll()]); }
if ($parts === ['submissions'] && $method === 'GET') { if($user['role']!=='parent') fail('Only a parent can view submissions.',403); $stmt=$pdo->prepare('SELECT s.*,s.id AS submission_id,t.title,t.mission_title,t.description,t.coins,t.xp,u.display_name child_name FROM submissions s JOIN tasks t ON t.id=s.task_id JOIN users u ON u.id=s.child_id WHERE t.family_id=? ORDER BY s.created_at DESC'); $stmt->execute([$family['id']]); jsonResponse(['submissions'=>$stmt->fetchAll()]); }
if ($parts === ['tasks'] && $method === 'POST') { if($user['role']!=='parent') fail('Only a parent can assign tasks.',403); $in=body(); $child=trim((string)($in['childId']??'')); $check=$pdo->prepare('SELECT 1 FROM family_members WHERE family_id=? AND user_id=? AND role="child"'); $check->execute([$family['id'],$child]); if(!$check->fetch()) fail('That child is not in this family.',422); $task=[uuid(),$family['id'],$user['id'],$child,trim((string)($in['title']??'')),trim((string)($in['missionTitle']??$in['title']??'')),trim((string)($in['description']??'')),max(0,(int)($in['coins']??0)),max(0,(int)($in['xp']??0)),($in['dueDate']??null)]; if($task[4]===''||$task[5]==='') fail('Task title and mission title are required.'); $pdo->prepare('INSERT INTO tasks (id,family_id,created_by,assigned_to,title,mission_title,description,coins,xp,due_date) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute($task); notify($pdo,$child,'task_assigned','A new mission awaits',$task[5]); jsonResponse(['id'=>$task[0]],201); }
if ($parts[0] === 'tasks' && count($parts) === 3 && $parts[2] === 'submit' && $method === 'POST') { if($user['role']!=='child') fail('Only a child can submit a task.',403); $taskId=$parts[1]; $check=$pdo->prepare('SELECT * FROM tasks WHERE id=? AND family_id=? AND assigned_to=? AND status="active"'); $check->execute([$taskId,$family['id'],$user['id']]); $task=$check->fetch(); if(!$task) fail('Task is unavailable.',422); $in=body(); $pdo->beginTransaction(); $pdo->prepare('INSERT INTO submissions (id,task_id,child_id,note,proof_url) VALUES (?,?,?,?,?)')->execute([$subId=uuid(),$taskId,$user['id'],trim((string)($in['note']??'')),trim((string)($in['proofUrl']??''))]); $pdo->prepare('UPDATE tasks SET status="submitted" WHERE id=?')->execute([$taskId]); notify($pdo,$task['created_by'],'task_submitted','Mission ready for review',$task['mission_title']); $pdo->commit(); jsonResponse(['submissionId'=>$subId],201); }
if ($parts[0] === 'submissions' && count($parts) === 3 && in_array($parts[2],['approve','reject'],true) && $method === 'POST') { if($user['role']!=='parent') fail('Only a parent can review tasks.',403); $submissionId=$parts[1]; $pdo->beginTransaction(); $stmt=$pdo->prepare('SELECT s.*,t.* FROM submissions s JOIN tasks t ON t.id=s.task_id WHERE s.id=? AND t.family_id=? AND s.status="submitted" FOR UPDATE'); $stmt->execute([$submissionId,$family['id']]); $row=$stmt->fetch(); if(!$row){$pdo->rollBack();fail('Submission is unavailable.',422);} $approved=$parts[2]==='approve'; $feedback=trim((string)(body()['feedback']??'')); $pdo->prepare('UPDATE submissions SET status=?,parent_feedback=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?')->execute([$approved?'approved':'rejected',$feedback,$submissionId]); $pdo->prepare('UPDATE tasks SET status=? WHERE id=?')->execute([$approved?'approved':'rejected',$row['task_id']]); $grantedXp=(int)$row['xp']; if($approved){$pdo->prepare('INSERT INTO child_wallets (child_id) VALUES (?) ON DUPLICATE KEY UPDATE child_id=child_id')->execute([$row['child_id']]);$walletLock=$pdo->prepare('SELECT child_id FROM child_wallets WHERE child_id=? FOR UPDATE');$walletLock->execute([$row['child_id']]);$grantedXp=recordXpApproval($pdo,$family['id'],$row['child_id'],$row,$submissionId);$pdo->prepare('INSERT INTO child_wallets (child_id) VALUES (?) ON DUPLICATE KEY UPDATE child_id=child_id')->execute([$row['child_id']]);$pdo->prepare('UPDATE child_wallets SET coins=coins+?,xp=xp+?,stars=stars+1,level=1+FLOOR(xp/500) WHERE child_id=?')->execute([$row['coins'],$grantedXp,$row['child_id']]);} notify($pdo,$row['child_id'],$approved?'task_approved':'task_rejected',$approved?'Mission approved!':'Mission needs another try',$approved?"+{$row['coins']} coins and +{$grantedXp} XP earned.":($feedback?:'Please check the task and try again.')); $pdo->commit(); jsonResponse(['status'=>$approved?'approved':'rejected']); }
if ($parts === ['notifications'] && $method === 'GET') { $stmt=$pdo->prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100'); $stmt->execute([$user['id']]); jsonResponse(['notifications'=>$stmt->fetchAll()]); }

fail('Route not found.',404);

