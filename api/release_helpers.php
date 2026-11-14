<?php
function lockPairingCode(PDO $pdo,string $code,string $kind):array {
    if(!$pdo->inTransaction())throw new LogicException('Invite claim requires a transaction');
    $stmt=$pdo->prepare('SELECT * FROM pairing_codes WHERE code_hash=? AND kind=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() ORDER BY created_at DESC LIMIT 1 FOR UPDATE');
    $stmt->execute([hash('sha256',$code),$kind]);$pair=$stmt->fetch();
    if(!$pair){$pdo->rollBack();fail('That invite is invalid, expired or already used.',422);}return $pair;
}
function requireParentConfirmation(PDO $pdo,array $user,array $input):void {
    global $config;
    if($user['role']!=='parent')fail('Parent authentication required.',403);
    $googleOnly=($config['parent_auth_mode']??'legacy')==='google';
    if(!$googleOnly&&!empty($input['password'])&&password_verify((string)$input['password'],$user['password_hash']))return;
    $token=(string)($input['reauthToken']??'');
    if($token!==''){
        $stmt=$pdo->prepare('DELETE FROM reauth_grants WHERE token_hash=? AND user_id=? AND session_hash=? AND expires_at>UTC_TIMESTAMP()');
        $stmt->execute([hash('sha256',$token),$user['id'],hash('sha256',bearer())]);
        if($stmt->rowCount()===1)return;
    }
    fail($googleOnly?'Verify your Google account again for this action.':'Confirm your password or verify with Google again for this action.',422);
}
function publicAppOrigin():string {
    global $config;
    $origin=rtrim((string)($config['public_app_url']??''),'/');
    return filter_var($origin,FILTER_VALIDATE_URL)&&parse_url($origin,PHP_URL_SCHEME)==='https'&&!parse_url($origin,PHP_URL_QUERY)&&!parse_url($origin,PHP_URL_FRAGMENT)?$origin:'';
}
function isSafetyModerator(PDO $pdo,array $user):bool {
 global $config;
 if($user['role']!=='parent'||!in_array(strtolower($user['email']??''),array_map('strtolower',$config['moderation_admin_emails']??[]),true))return false;
 $s=$pdo->prepare("SELECT 1 FROM auth_identities WHERE user_id=? AND provider='google'");$s->execute([$user['id']]);return (bool)$s->fetchColumn();
}
