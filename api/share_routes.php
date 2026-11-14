<?php
// Loaded after authentication and family lookup in index.php.
// Parent-side social share cards + referral links: a summary of the family's
// progress the parent can share, plus a stable referral code captured at signup
// (auth/register reads ?ref= and records a row in referrals).

// Return the family's referral code, generating and storing one on first use.
function ensureReferralCode(PDO $pdo, array $family): string {
    $existing=trim((string)($family['referral_code']??''));
    if ($existing!=='') return $existing;
    for ($try=0;$try<8;$try++){
        $code=strtoupper(bin2hex(random_bytes(3))); // 6 hex chars
        $check=$pdo->prepare('SELECT 1 FROM families WHERE referral_code=?');
        $check->execute([$code]);
        if (!$check->fetch()) {
            $pdo->prepare('UPDATE families SET referral_code=? WHERE id=?')->execute([$code,$family['id']]);
            return $code;
        }
    }
    fail('Could not generate a referral code. Please try again.',503);
}

if ($parts === ['families','share'] && $method === 'GET') {
    if ($user['role'] !== 'parent') fail('Only a parent can open the family share card.',403);
    $totals=$pdo->prepare("SELECT COUNT(*) children,COALESCE(SUM(w.xp),0) xp,COALESCE(SUM(w.stars),0) stars,COALESCE(SUM(w.coins),0) coins FROM family_members m JOIN users u ON u.id=m.user_id LEFT JOIN child_wallets w ON w.child_id=u.id WHERE m.family_id=? AND m.role='child'");
    $totals->execute([$family['id']]); $t=$totals->fetch() ?: ['children'=>0,'xp'=>0,'stars'=>0,'coins'=>0];
    $top=$pdo->prepare("SELECT u.display_name,COALESCE(w.xp,0) xp,COALESCE(w.level,1) level FROM family_members m JOIN users u ON u.id=m.user_id LEFT JOIN child_wallets w ON w.child_id=u.id WHERE m.family_id=? AND m.role='child' ORDER BY COALESCE(w.xp,0) DESC,u.display_name LIMIT 1");
    $top->execute([$family['id']]); $topRow=$top->fetch();
    $referral=ensureReferralCode($pdo,$family);
    $referredCount=0; try { $rc=$pdo->prepare('SELECT COUNT(*) FROM referrals WHERE referrer_family_id=?'); $rc->execute([$family['id']]); $referredCount=(int)$rc->fetchColumn(); } catch (Throwable $e) { /* referrals table not migrated */ }
    $origin=publicAppOrigin();
    jsonResponse([
        'familyName'=>$family['name'],
        'totals'=>['children'=>(int)$t['children'],'xp'=>(int)$t['xp'],'stars'=>(int)$t['stars'],'coins'=>(int)$t['coins']],
        'topChild'=>$topRow?['name'=>$topRow['display_name'],'xp'=>(int)$topRow['xp'],'level'=>(int)$topRow['level']]:null,
        'referralCode'=>$referral,
        'referralUrl'=>$origin.'/?ref='.$referral,
        'referredCount'=>$referredCount,
        'theme'=>weeklyTheme(),
    ]);
}
