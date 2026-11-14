<?php
// Public authentication endpoints, included before currentUser()/familyFor().
if ($parts === ['auth','google','challenge'] && $method === 'POST') {
    if (empty($config['google_client_id'])) fail('Google sign-in is not configured on this server.',503);
    inviteThrottle($pdo,'google-challenge');
    $pdo->exec('DELETE FROM auth_nonces WHERE expires_at<=UTC_TIMESTAMP()');
    $nonce=bin2hex(random_bytes(32));
    $pdo->prepare('INSERT INTO auth_nonces (nonce_hash,expires_at) VALUES (?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))')->execute([hash('sha256',$nonce)]);
    jsonResponse(['nonce'=>$nonce]);
}
if ($parts === ['auth','google'] && $method === 'POST') {
    $clientId=(string)($config['google_client_id']??'');
    if ($clientId==='') fail('Google sign-in is not configured on this server.',503);
    inviteThrottle($pdo,'google-login');
    $in=body();$nonce=(string)($in['nonce']??'');$token=(string)($in['idToken']??'');
    if (!preg_match('/^[a-f0-9]{64}$/D',$nonce)||strlen($token)>16000||count(explode('.',$token))!==3) fail('Invalid Google credential.',401);
    $nonceHash=hash('sha256',$nonce);
    $check=$pdo->prepare('SELECT 1 FROM auth_nonces WHERE nonce_hash=? AND expires_at>UTC_TIMESTAMP()');$check->execute([$nonceHash]);
    if (!$check->fetchColumn()) fail('Google sign-in expired. Please start again.',401);
    require_once __DIR__.'/google_token.php';
    try { $certs=googleSigningCertificates(); } catch (Throwable $e) { error_log('[RLQ] Google certificate fetch failed');fail('Cannot reach Google verification. Check the server internet connection and try again.',503); }
    try { $claims=verifyGoogleToken($token,$clientId,$nonce,$certs); } catch (Throwable $e) { fail('Google could not verify this sign-in. Please start again.',401); }
    require_once __DIR__.'/google_accounts.php';
    $approvals=$config['google_legacy_recovery']??[];
    $result=googleParentSession($pdo,$claims,$nonceHash,(string)($in['password']??''),(int)$config['token_ttl_days'],normalizeCode((string)($in['coParentCode']??'')),($config['parent_auth_mode']??'legacy')==='google',is_array($approvals)?$approvals:[]);
    clearInviteThrottle($pdo,'google-login');clearInviteThrottle($pdo,'google-challenge');
    jsonResponse($result);
}
