<?php
// Loaded after authentication and family lookup in index.php.
// Family board (all-time, from wallets) and weekly league board (current ISO week, from the XP ledger).
if($parts===['leaderboard']&&$method==='GET'){
    $week=isoWeekKey();
    $band=static function($age){$a=$age===null||$age===''?null:(int)$age;return $a===null?'junior':($a<=9?'little':($a<=12?'junior':'teen'));};
    $all=$pdo->prepare("SELECT u.id,u.display_name,u.age,u.avatar_data,COALESCE(w.xp,0) xp,COALESCE(w.level,1) level,COALESCE(w.coins,0) coins,COALESCE(w.stars,0) stars FROM family_members m JOIN users u ON u.id=m.user_id LEFT JOIN child_wallets w ON w.child_id=u.id WHERE m.family_id=? AND m.role='child' ORDER BY COALESCE(w.xp,0) DESC,u.display_name");
    $all->execute([$family['id']]); $allRows=$all->fetchAll();
    // Spec 6.5: XP above the daily cap is flagged in the ledger and is excluded from every
    // ranking, so the weekly board only sums unflagged rows. The all-time board reads the
    // wallet, which stores the XP actually granted, so it already matches this rule.
    $wk=$pdo->prepare("SELECT u.id,u.display_name,u.age,u.avatar_data,COALESCE(SUM(e.xp),0) xp FROM family_members m JOIN users u ON u.id=m.user_id LEFT JOIN xp_events e ON e.child_id=u.id AND e.iso_week=? AND e.flagged=0 WHERE m.family_id=? AND m.role='child' GROUP BY u.id,u.display_name,u.age,u.avatar_data ORDER BY COALESCE(SUM(e.xp),0) DESC,u.display_name");
    $wk->execute([$week,$family['id']]); $wkRows=$wk->fetchAll();
    foreach($allRows as &$r){$r['ageBand']=$band($r['age']??null);$r['xp']=(int)$r['xp'];$r['level']=(int)$r['level'];$r['coins']=(int)$r['coins'];$r['stars']=(int)$r['stars'];} unset($r);
    foreach($wkRows as &$r){$r['ageBand']=$band($r['age']??null);$r['xp']=(int)$r['xp'];} unset($r);
    jsonResponse(['week'=>$week,'allTime'=>$allRows,'weekly'=>$wkRows]);
}
