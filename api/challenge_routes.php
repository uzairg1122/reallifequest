<?php
// Loaded after authentication and family lookup in index.php.
// Family-vs-family challenges: opt-in, joined by a short code, scored from the XP ledger
// as average weekly XP per child so a bigger family has no built-in advantage.

// Readable 6-char code (no 0/O/1/I), shown to humans as XXX-XXX.
function challengeCode(): string {
    $alphabet='23456789ABCDEFGHJKMNPQRSTUVWXYZ'; $out='';
    for($i=0;$i<6;$i++){$out.=$alphabet[random_int(0,strlen($alphabet)-1)];}
    return substr($out,0,3).'-'.substr($out,3,3);
}
function normalizeChallengeCode(string $raw): string {
    return strtoupper(preg_replace('/[^0-9A-Za-z]/','',$raw));
}
// Average weekly XP per child for every family in a challenge, ranked.
// Spec 6.5: flagged (over-cap) XP is excluded, and the child count only includes children
// a parent has actually consented to, so an unconsented child can never move a family up.
function challengeStandings(PDO $pdo, string $challengeId, string $week, string $myFamilyId): array {
    $stmt=$pdo->prepare("SELECT f.id,f.name,(SELECT COUNT(*) FROM family_members fm JOIN users cu ON cu.id=fm.user_id WHERE fm.family_id=f.id AND fm.role='child' AND cu.consent_at IS NOT NULL) child_count,COALESCE((SELECT SUM(e.xp) FROM xp_events e JOIN family_members fm ON fm.user_id=e.child_id AND fm.family_id=e.family_id JOIN users cu ON cu.id=e.child_id WHERE e.family_id=f.id AND e.iso_week=? AND e.flagged=0 AND cu.consent_at IS NOT NULL),0) week_xp FROM challenge_families cf JOIN families f ON f.id=cf.family_id WHERE cf.challenge_id=?");
    $stmt->execute([$week,$challengeId]);
    $rows=array_map(static function($r) use ($myFamilyId){
        $children=max(1,(int)$r['child_count']); $weekXp=(int)$r['week_xp'];
        return ['familyId'=>$r['id'],'name'=>$r['name'],'children'=>(int)$r['child_count'],'weekXp'=>$weekXp,'avgXp'=>(int)round($weekXp/$children),'isMe'=>$r['id']===$myFamilyId];
    },$stmt->fetchAll());
    usort($rows,static fn($a,$b)=>$b['avgXp']<=>$a['avgXp'] ?: strcasecmp($a['name'],$b['name']));
    foreach($rows as $i=>&$r){$r['rank']=$i+1;} unset($r);
    return $rows;
}

if($parts===['challenges']&&$method==='GET'){
    $week=isoWeekKey();
    $list=$pdo->prepare("SELECT c.id,c.name,c.code,c.iso_week,c.status,c.owner_family_id,c.created_at FROM challenges c JOIN challenge_families cf ON cf.challenge_id=c.id WHERE cf.family_id=? ORDER BY c.created_at DESC");
    $list->execute([$family['id']]);
    $out=array_map(static function($c) use ($pdo,$week,$family){
        return ['id'=>$c['id'],'name'=>$c['name'],'code'=>$c['code'],'week'=>$c['iso_week'],'currentWeek'=>$week,'status'=>$c['status'],'isOwner'=>$c['owner_family_id']===$family['id'],'standings'=>challengeStandings($pdo,$c['id'],$week,$family['id'])];
    },$list->fetchAll());
    jsonResponse(['week'=>$week,'challenges'=>$out]);
}

if($parts===['challenges']&&$method==='POST'){
    if($user['role']!=='parent') fail('Only a parent can start a family challenge.',403);
    $name=trim((string)(body()['name']??''));
    if($name===''||strlen($name)>120) fail('Give the challenge a short name.',422);
    $week=isoWeekKey();
    $code=''; for($try=0;$try<8;$try++){$candidate=challengeCode();$check=$pdo->prepare('SELECT 1 FROM challenges WHERE code=?');$check->execute([$candidate]);if(!$check->fetch()){$code=$candidate;break;}}
    if($code==='') fail('Could not generate a challenge code. Please try again.',503);
    $id=uuid();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO challenges (id,owner_family_id,name,code,iso_week) VALUES (?,?,?,?,?)')->execute([$id,$family['id'],$name,$code,$week]);
        $pdo->prepare('INSERT INTO challenge_families (challenge_id,family_id) VALUES (?,?)')->execute([$id,$family['id']]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    jsonResponse(['id'=>$id,'code'=>$code,'name'=>$name,'week'=>$week],201);
}

if($parts===['challenges','join']&&$method==='POST'){
    if($user['role']!=='parent') fail('Only a parent can join a family challenge.',403);
    $code=normalizeChallengeCode((string)(body()['code']??''));
    if(strlen($code)!==6) fail('Enter the 6-character challenge code.',422);
    $find=$pdo->prepare("SELECT id,name FROM challenges WHERE REPLACE(code,'-','')=? AND status='open'");
    $find->execute([$code]); $challenge=$find->fetch();
    if(!$challenge) fail('That challenge code was not found.',404);
    $pdo->prepare('INSERT IGNORE INTO challenge_families (challenge_id,family_id) VALUES (?,?)')->execute([$challenge['id'],$family['id']]);
    jsonResponse(['id'=>$challenge['id'],'name'=>$challenge['name']]);
}
