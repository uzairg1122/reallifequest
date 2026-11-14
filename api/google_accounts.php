<?php
declare(strict_types=1);
// Only call after Google token verification. Stable provider subject selects returning accounts.
function googleParentSession(PDO $pdo,array $claims,string $nonceHash,string $password,int $ttl,string $coParentCode='',bool $googleOnly=false,array $recoveryApprovals=[]):array {
    $pdo->beginTransaction();
    try {
        $lock=$pdo->prepare('SELECT 1 FROM auth_nonces WHERE nonce_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE');$lock->execute([$nonceHash]);
        if (!$lock->fetchColumn()) {$pdo->rollBack();fail('Google sign-in expired. Please start again.',401);}
        $pair=null;if($coParentCode!==''){if(!preg_match('/^\d{6}$/D',$coParentCode)){$pdo->rollBack();fail('Enter the six-digit co-parent invite code.',422);}$pair=lockPairingCode($pdo,$coParentCode,'co_parent');}
        $find=$pdo->prepare("SELECT u.* FROM auth_identities i JOIN users u ON u.id=i.user_id WHERE i.provider='google' AND i.subject=? FOR UPDATE");$find->execute([$claims['sub']]);$parent=$find->fetch();
        if (!$parent) {
            $email=strtolower(trim($claims['email']));
            $find=$pdo->prepare('SELECT * FROM users WHERE email=? FOR UPDATE');$find->execute([$email]);$parent=$find->fetch();
            if ($parent) {
                if ($parent['role']!=='parent') {$pdo->rollBack();fail('Google sign-in is available for parent accounts only.',403);}
                $linked=$pdo->prepare("SELECT subject FROM auth_identities WHERE provider='google' AND user_id=?");$linked->execute([$parent['id']]);
                if ($linked->fetchColumn()) {$pdo->rollBack();fail('This parent account is connected to another Google account.',403);}
                if ($googleOnly) {
                    // Explicit operator approval for one exact Gmail; not general email-based linking.
                    $until=$recoveryApprovals[$email]??0;
                    $issued=$claims['iat']??0;
                    $approved=is_int($until)&&$until>time()&&($claims['email_verified']??false)===true
                        &&str_ends_with($email,'@gmail.com')&&is_int($issued)&&$issued>=time()-300&&$issued<=time()+60;
                    if (!$approved) {$pdo->rollBack();fail('This email belongs to an older account. Contact support@nomolabs.pro to migrate it safely without losing family history.',409);}
                    // Retire the old app credentials and sessions atomically; retain user/family IDs and history.
                    $pdo->prepare('DELETE FROM sessions WHERE user_id=?')->execute([$parent['id']]);
                    $pdo->prepare('DELETE FROM password_resets WHERE user_id=?')->execute([$parent['id']]);
                    $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT),$parent['id']]);
                } else {
                    if ($password==='') {$pdo->rollBack();fail('Confirm your existing account password to connect Google.',409);}
                    if (!password_verify($password,$parent['password_hash'])) {$pdo->rollBack();fail('Existing account password is incorrect.',401);}
                }
            } else {
                $id=uuid();$name=mb_substr(trim((string)($claims['name']??'Parent')),0,80)?:'Parent';
                $pdo->prepare("INSERT INTO users (id,email,password_hash,display_name,role) VALUES (?,?,?,?,'parent')")->execute([$id,$email,password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT),$name]);
                if(!$pair){$familyId=uuid();$pdo->prepare('INSERT INTO families (id,parent_id,name) VALUES (?,?,?)')->execute([$familyId,$id,mb_substr($name."'s Family",0,120)]);
                $pdo->prepare("INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,'parent')")->execute([$familyId,$id]);}
                $parent=['id'=>$id,'display_name'=>$name,'role'=>'parent'];
            }
            $pdo->prepare("INSERT INTO auth_identities (provider,subject,user_id) VALUES ('google',?,?)")->execute([$claims['sub'],$parent['id']]);
        }
        if ($parent['role']!=='parent') {$pdo->rollBack();fail('Only parents can use Google sign-in.',403);}
        if($pair){
            $existing=$pdo->prepare('SELECT family_id FROM family_members WHERE user_id=? FOR UPDATE');$existing->execute([$parent['id']]);$existingFamilies=$existing->fetchAll(PDO::FETCH_COLUMN);
            if($existingFamilies&&!in_array($pair['family_id'],$existingFamilies,true)){$pdo->rollBack();fail('This Google account already belongs to another family.',409);}
            if(!$existingFamilies)$pdo->prepare("INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,'co_parent')")->execute([$pair['family_id'],$parent['id']]);
            $pdo->prepare('UPDATE pairing_codes SET used_at=UTC_TIMESTAMP() WHERE id=?')->execute([$pair['id']]);
        }
        $membership=$pdo->prepare('SELECT f.* FROM families f JOIN family_members m ON m.family_id=f.id WHERE m.user_id=? LIMIT 1');$membership->execute([$parent['id']]);$family=$membership->fetch()?:['id'=>null];
        $pdo->prepare('DELETE FROM auth_nonces WHERE nonce_hash=?')->execute([$nonceHash]);
        $sessionToken=issueToken($pdo,$parent['id'],$ttl);
        $pdo->commit();
    } catch (Throwable $e) { if($pdo->inTransaction())$pdo->rollBack();throw $e; }
    return ['user'=>['id'=>$parent['id'],'displayName'=>$parent['display_name'],'role'=>'parent'],'familyId'=>$family['id'],'token'=>$sessionToken];
}
