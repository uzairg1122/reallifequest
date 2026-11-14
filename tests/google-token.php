<?php
declare(strict_types=1);
require __DIR__.'/../api/google_token.php';
$key=openssl_pkey_new(['config'=>__DIR__.'/openssl-test.cnf','private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
$details=openssl_pkey_get_details($key);$public=$details['key'];$nonce=str_repeat('a',64);$now=time();$client='test.apps.googleusercontent.com';
$claims=['iss'=>'https://accounts.google.com','aud'=>$client,'sub'=>'google-parent-123','email'=>'parent@example.com','email_verified'=>true,'name'=>'Parent','iat'=>$now,'exp'=>$now+3600,'nonce'=>$nonce];
function signedToken(array $claims,$key,array $header=['alg'=>'RS256','kid'=>'test']):string {
    $encode=fn($value)=>rtrim(strtr(base64_encode($value),'+/','-_'),'=');
    $data=$encode(json_encode($header)).'.'.$encode(json_encode($claims));
    openssl_sign($data,$signature,$key,OPENSSL_ALGO_SHA256);
    return $data.'.'.$encode($signature);
}
$passed=0;
function check(bool $condition,string $label):void{global $passed;if(!$condition)throw new RuntimeException($label);$passed++;echo "PASS $label\n";}
$token=signedToken($claims,$key);
check(verifyGoogleToken($token,$client,$nonce,['test'=>$public])['sub']==='google-parent-123','valid signed identity');
foreach(['aud'=>'other-client','iss'=>'https://attacker.invalid','exp'=>$now-1,'iat'=>$now+120,'nonce'=>str_repeat('b',64),'email_verified'=>false,'sub'=>'','email'=>'not-email'] as $field=>$value){
    try{verifyGoogleToken(signedToken(array_replace($claims,[$field=>$value]),$key),$client,$nonce,['test'=>$public]);check(false,"reject $field");}
    catch(InvalidArgumentException $e){check(true,"reject $field");}
}
$wrongKey=openssl_pkey_new(['config'=>__DIR__.'/openssl-test.cnf','private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
foreach([signedToken($claims,$wrongKey),signedToken($claims,$key,['alg'=>'none','kid'=>'test']),signedToken($claims,$key,['alg'=>'RS256','kid'=>'untrusted']),'a.b.c','not-a-jwt'] as $bad){
    try{verifyGoogleToken($bad,$client,$nonce,['test'=>$public]);check(false,'reject malformed or forged token');}
    catch(InvalidArgumentException $e){check(true,'reject malformed or forged token');}
}
echo "$passed Google token checks passed\n";
