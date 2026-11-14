<?php
declare(strict_types=1);

// Trust only Google's fixed HTTPS certificate endpoint, never a URL from the JWT.
function googleSigningCertificates(): array {
    $cache = sys_get_temp_dir() . '/rlq-google-signing-certs-v1.json';
    $saved = is_file($cache) ? json_decode((string) @file_get_contents($cache), true) : null;
    if (is_array($saved) && ($saved['expires'] ?? 0) > time() && is_array($saved['certs'] ?? null)) return $saved['certs'];
    $url = 'https://www.googleapis.com/oauth2/v1/certs';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>10, CURLOPT_TIMEOUT=>20, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2]);
        $raw = curl_exec($ch); $status = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($status !== 200 || !is_string($raw)) throw new RuntimeException('Google certificates unavailable');
    } else {
        $context = stream_context_create(['http'=>['timeout'=>20], 'ssl'=>['verify_peer'=>true, 'verify_peer_name'=>true]]);
        $raw = @file_get_contents($url, false, $context);
        if (!is_string($raw)) throw new RuntimeException('Google certificates unavailable');
    }
    $certs = json_decode($raw, true);
    if (!is_array($certs) || !$certs) throw new RuntimeException('Invalid Google certificate response');
    // Cache briefly, below Google's normal key cache lifetime; never accept expired cached keys.
    @file_put_contents($cache, json_encode(['expires'=>time()+300, 'certs'=>$certs]), LOCK_EX);
    return $certs;
}

function googleDecodeSegment(string $part): string {
    if (!preg_match('/^[A-Za-z0-9_-]+$/D', $part)) throw new InvalidArgumentException('Invalid token encoding');
    $decoded = base64_decode(strtr($part, '-_', '+/') . str_repeat('=', (4-strlen($part)%4)%4), true);
    if ($decoded === false) throw new InvalidArgumentException('Invalid token encoding');
    return $decoded;
}

function verifyGoogleToken(string $token, string $clientId, string $nonce, array $certs, ?int $now = null): array {
    $now ??= time();
    if (strlen($token)>16000 || $clientId==='' || !preg_match('/^[a-f0-9]{64}$/D', $nonce)) throw new InvalidArgumentException('Invalid Google credential');
    $parts=explode('.', $token);
    if (count($parts)!==3) throw new InvalidArgumentException('Invalid Google credential');
    $header=json_decode(googleDecodeSegment($parts[0]),true);
    $claims=json_decode(googleDecodeSegment($parts[1]),true);
    if (!is_array($header)||!is_array($claims)||($header['alg']??'')!=='RS256'||!is_string($header['kid']??null)||!isset($certs[$header['kid']])) throw new InvalidArgumentException('Invalid Google signing key');
    if (openssl_verify($parts[0].'.'.$parts[1],googleDecodeSegment($parts[2]),$certs[$header['kid']],OPENSSL_ALGO_SHA256)!==1) throw new InvalidArgumentException('Invalid Google signature');
    if (($claims['aud']??null)!==$clientId || !in_array($claims['iss']??'', ['accounts.google.com','https://accounts.google.com'],true)
        || !is_numeric($claims['exp']??null) || (int)$claims['exp']<=$now
        || !is_numeric($claims['iat']??null) || (int)$claims['iat']>$now+60
        || !is_string($claims['nonce']??null) || !hash_equals($nonce,$claims['nonce'])
        || !is_string($claims['sub']??null) || $claims['sub']==='' || strlen($claims['sub'])>255
        || ($claims['email_verified']??false)!==true || !filter_var($claims['email']??'',FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Google credential does not match this login');
    return $claims;
}
