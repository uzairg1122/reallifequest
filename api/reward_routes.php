<?php
if($parts===['rewards']&&$method==='GET'){
 $stmt=$pdo->prepare('SELECT * FROM rewards WHERE family_id=? ORDER BY created_at DESC');$stmt->execute([$family['id']]);$rewards=$stmt->fetchAll();
 $stmt=$pdo->prepare('SELECT r.*,u.display_name child_name FROM reward_requests r JOIN users u ON u.id=r.child_id WHERE r.family_id=?'.($user['role']==='child'?' AND r.child_id=?':'').' ORDER BY r.created_at DESC');$stmt->execute($user['role']==='child'?[$family['id'],$user['id']]:[$family['id']]);jsonResponse(['rewards'=>$rewards,'requests'=>$stmt->fetchAll()]);
}
if($parts===['rewards']&&$method==='POST'){
 if($user['role']!=='parent')fail('Only parents can add rewards.',403);$in=body();$name=trim((string)($in['name']??''));$cost=(int)($in['cost']??0);if($name===''||strlen($name)>160||$cost<1||$cost>100000)fail('Enter a reward name and coin cost.',422);
 $id=uuid();$pdo->prepare('INSERT INTO rewards (id,family_id,name,description,cost_coins) VALUES (?,?,?,?,?)')->execute([$id,$family['id'],$name,trim((string)($in['description']??'')),$cost]);jsonResponse(['id'=>$id],201);
}
if(count($parts)===3&&$parts[0]==='rewards'&&$parts[2]==='request'&&$method==='POST'){
 if($user['role']!=='child')fail('Only children can request rewards.',403);
 $pdo->beginTransaction();try{
 $lock=$pdo->prepare('SELECT coins FROM child_wallets WHERE child_id=? FOR UPDATE');$lock->execute([$user['id']]);$coins=(int)$lock->fetchColumn();
 $stmt=$pdo->prepare('SELECT * FROM rewards WHERE id=? AND family_id=?');$stmt->execute([$parts[1],$family['id']]);$r=$stmt->fetch();if(!$r){$pdo->rollBack();fail('Reward not found.',404);}if($coins<$r['cost_coins']){$pdo->rollBack();fail('Keep collecting coins for this reward.',422);}
 $stmt=$pdo->prepare("SELECT id FROM reward_requests WHERE reward_id=? AND child_id=? AND status='pending'");$stmt->execute([$r['id'],$user['id']]);if($stmt->fetch()){$pdo->rollBack();fail('Your parent is already reviewing this reward.',409);}
 $id=uuid();$pdo->prepare('INSERT INTO reward_requests (id,family_id,reward_id,child_id,name,cost_coins) VALUES (?,?,?,?,?,?)')->execute([$id,$family['id'],$r['id'],$user['id'],$r['name'],$r['cost_coins']]);notify($pdo,$family['parent_id'],'reward_requested','Reward request',$user['display_name'].' would like '.$r['name']);$pdo->commit();
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}jsonResponse(['id'=>$id],201);
}
if(count($parts)===3&&$parts[0]==='reward-requests'&&in_array($parts[2],['approve','reject'],true)&&$method==='POST'){
 if($user['role']!=='parent')fail('Only parents can approve rewards.',403);$pdo->beginTransaction();try{
 $stmt=$pdo->prepare("SELECT * FROM reward_requests WHERE id=? AND family_id=? AND status='pending' FOR UPDATE");$stmt->execute([$parts[1],$family['id']]);$r=$stmt->fetch();if(!$r){$pdo->rollBack();fail('Request already reviewed or unavailable.',422);}$approved=$parts[2]==='approve';
 if($approved){$stmt=$pdo->prepare('UPDATE child_wallets SET coins=coins-? WHERE child_id=? AND coins>=?');$stmt->execute([$r['cost_coins'],$r['child_id'],$r['cost_coins']]);if(!$stmt->rowCount()){$pdo->rollBack();fail('The child does not have enough coins now.',422);}}
 $pdo->prepare('UPDATE reward_requests SET status=? WHERE id=?')->execute([$approved?'approved':'rejected',$r['id']]);notify($pdo,$r['child_id'],$approved?'reward_approved':'reward_rejected',$approved?'You earned a reward!':'Reward request reviewed',$approved?$r['name'].' · '.$r['cost_coins'].' coins used.':'Your parent could not approve '.$r['name'].' yet.');$pdo->commit();
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}jsonResponse(['ok'=>true]);
}
