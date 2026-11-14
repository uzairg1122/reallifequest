<?php
// Directly exercise the league rollover logic against the live MariaDB.
$parts=[]; // guard the trailing route block in league_routes.php out
require __DIR__.'/../api/quest_helpers.php';
require __DIR__.'/../api/league_routes.php';
$pdo=new PDO('mysql:host=127.0.0.1;port=3308;dbname=rlq_audit;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
function uuid(){return sprintf('%08x-%04x-%04x-%04x-%012x',mt_rand(),mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand());}

// Use an isolated synthetic week no live endpoint will ever close, so the
// league_seasons once-only guard reflects only this harness (real weeks like
// isoWeekKey('-7 days') get closed by GET /league and would short-circuit us).
$prev='2000-W01';
$band='junior';
$pdo->prepare('DELETE FROM league_seasons WHERE iso_week=?')->execute([$prev]);
// Fresh synthetic family + parent
$stamp='lg'.time();
$parentId=uuid();$familyId=uuid();
$pdo->prepare('INSERT INTO users (id,email,password_hash,display_name,role) VALUES (?,?,?,?,?)')->execute([$parentId,$stamp.'@ex.test',password_hash('x',PASSWORD_DEFAULT),'LParent','parent']);
$pdo->prepare('INSERT INTO families (id,parent_id,name) VALUES (?,?,?)')->execute([$familyId,$parentId,'LFam']);
$pdo->prepare('INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,?)')->execute([$familyId,$parentId,'parent']);

// 5 children in Bronze(3), same age band, all present in the PRIOR week, distinct XP
$kids=[];
for($i=0;$i<5;$i++){
  $cid=uuid();$kids[]=$cid;
  $pdo->prepare('INSERT INTO users (id,email,password_hash,display_name,role,age) VALUES (?,?,?,?,?,?)')->execute([$cid,$stamp."k$i@ex.test",password_hash('x',PASSWORD_DEFAULT),"Kid$i",'child',11]);
  $pdo->prepare('INSERT INTO family_members (family_id,user_id,role) VALUES (?,?,?)')->execute([$familyId,$cid,'child']);
  $pdo->prepare('INSERT INTO child_wallets (child_id) VALUES (?)')->execute([$cid]);
  $pdo->prepare('INSERT INTO league_members (child_id,age_band,division,updated_week) VALUES (?,?,?,?)')->execute([$cid,$band,3,$prev]);
  // higher i => more XP in the prior week (Kid4 top, Kid0 bottom)
  $pdo->prepare('INSERT INTO xp_events (id,family_id,child_id,source,xp,coins,yyyymmdd,iso_week) VALUES (?,?,?,?,?,?,UTC_DATE(),?)')
      ->execute([uuid(),$familyId,$cid,'task_approval',($i+1)*20,0,$prev]);
}

echo "prev week=$prev, seeded 5 Bronze kids\n";
closeLeagueWeek($pdo,$prev);

// Bronze is the bottom division: promote top min(3,ceil(5*0.2))=1 to Silver(2), rest stay Bronze
$div=[];$st=$pdo->prepare('SELECT division FROM league_members WHERE child_id=?');
foreach($kids as $cid){$st->execute([$cid]);$div[]=(int)$st->fetchColumn();}
echo 'divisions after close (Kid0..Kid4): '.implode(',',$div)."\n";
$promoted=count(array_filter($div,fn($d)=>$d===2));
if($promoted!==1) fail1('expected exactly 1 promotion, got '.$promoted);
// Top XP kid (Kid4) must be the one promoted
if($div[4]!==2) fail1('top-XP kid should be promoted to Silver');

// History archived for the prior week
$h=$pdo->prepare('SELECT COUNT(*) FROM league_history WHERE iso_week=? AND age_band=?');$h->execute([$prev,$band]);
$hc=(int)$h->fetchColumn();
echo "history rows for prev week=$hc\n";
if($hc!==5) fail1('expected 5 archived history rows, got '.$hc);
$m=$pdo->query("SELECT movement,COUNT(*) c FROM league_history WHERE iso_week='".$prev."' GROUP BY movement")->fetchAll(PDO::FETCH_KEY_PAIR);
echo 'movements: '.json_encode($m)."\n";

// Idempotency: a second close must NOT double-archive (league_seasons guard)
closeLeagueWeek($pdo,$prev);
$h->execute([$prev,$band]);$hc2=(int)$h->fetchColumn();
echo "history rows after 2nd close=$hc2\n";
if($hc2!==5) fail1('rollover not idempotent: history grew to '.$hc2);

// cleanup synthetic data
$in=implode(',',array_fill(0,count($kids),'?'));
$pdo->prepare("DELETE FROM league_history WHERE child_id IN ($in)")->execute($kids);
$pdo->prepare("DELETE FROM xp_events WHERE child_id IN ($in)")->execute($kids);
$pdo->prepare("DELETE FROM league_members WHERE child_id IN ($in)")->execute($kids);
$pdo->prepare("DELETE FROM child_wallets WHERE child_id IN ($in)")->execute($kids);
$pdo->prepare("DELETE FROM family_members WHERE family_id=?")->execute([$familyId]);
$pdo->prepare("DELETE FROM users WHERE id IN ($in)")->execute($kids);
$pdo->prepare("DELETE FROM families WHERE id=?")->execute([$familyId]);
$pdo->prepare("DELETE FROM users WHERE id=?")->execute([$parentId]);
$pdo->prepare("DELETE FROM league_seasons WHERE iso_week=?")->execute([$prev]);
echo "PASS league rollover: promotion by weekly XP, season archive, idempotent re-close.\n";
function fail1($m){fwrite(STDERR,"ASSERT FAIL: $m\n");exit(1);}
