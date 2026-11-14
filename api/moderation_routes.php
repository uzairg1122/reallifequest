<?php
if(($parts[0]??'')==='moderation'){
 if(!isSafetyModerator($pdo,$user))fail('Moderation access required.',403);
 if($parts===['moderation','reports']&&$method==='GET'){
  $stmt=$pdo->query("SELECT id,reason,details,status,created_at FROM safety_reports WHERE status IN ('open','actioned') ORDER BY created_at LIMIT 100");jsonResponse(['reports'=>$stmt->fetchAll()]);
 }
 if(count($parts)===3&&$parts[1]==='reports'&&$method==='POST'){
  $in=body();$action=(string)($in['action']??'');if(!in_array($action,['reviewed','hide_from_league','restore_eligibility'],true))fail('Choose a moderation action.',422);
  $pdo->beginTransaction();try{
   $stmt=$pdo->prepare('SELECT reported_user_id FROM safety_reports WHERE id=? FOR UPDATE');$stmt->execute([$parts[2]]);$child=$stmt->fetchColumn();if(!$child){$pdo->rollBack();fail('Report not found.',404);}
   if($action==='hide_from_league'){$pdo->prepare('UPDATE users SET league_opt_in=0,league_suspended=1 WHERE id=?')->execute([$child]);$pdo->prepare('DELETE FROM league_members WHERE child_id=?')->execute([$child]);}
   if($action==='restore_eligibility')$pdo->prepare('UPDATE users SET league_suspended=0 WHERE id=?')->execute([$child]);
   $pdo->prepare('INSERT INTO moderation_actions (id,report_id,moderator_id,action) VALUES (?,?,?,?)')->execute([uuid(),$parts[2],$user['id'],$action]);
   $pdo->prepare('UPDATE safety_reports SET status=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?')->execute([$action==='hide_from_league'?'actioned':'reviewed',$parts[2]]);$pdo->commit();
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
  jsonResponse(['ok'=>true]);
 }
}
