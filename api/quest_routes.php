<?php
// Loaded after authentication and family lookup in index.php.
if($parts===['suggestions']&&$method==='POST'){
 if($user['role']!=='child')fail('Only children can suggest a mission.',403);$name=trim((string)(body()['name']??''));if($name===''||strlen($name)>160)fail('Enter a short mission idea.',422);notify($pdo,$family['parent_id'],'mission_suggested','A new mission idea',$user['display_name'].': '.$name);jsonResponse(['ok'=>true]);
}
if($parts===['family','schedule']&&$method==='PATCH'){
 if($user['role']!=='parent')fail('Only parents can set the family schedule.',403);$input=body();$schedule=[];
 foreach(['Weekdays','Weekends'] as $day){$row=$input[$day]??[];foreach(['curfew','departure'] as $field){if(!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/',(string)($row[$field]??'')))fail('Choose valid morning and bedtime hours.',422);}$schedule[$day]=['curfew'=>$row['curfew'],'departure'=>$row['departure'],'reminder'=>!empty($row['reminder']),'multiplier'=>false];}
 $pdo->prepare('UPDATE families SET schedule_json=? WHERE id=?')->execute([json_encode($schedule),$family['id']]);jsonResponse(['ok'=>true]);
}
if ($parts===['family'] && $method==='GET') {
    $stmt=$pdo->prepare('SELECT u.id,u.display_name,u.role,u.age,u.avatar_data,COALESCE(w.coins,0) coins,COALESCE(w.xp,0) xp,COALESCE(w.level,1) level,COALESCE(w.stars,0) stars FROM family_members m JOIN users u ON u.id=m.user_id LEFT JOIN child_wallets w ON w.child_id=u.id WHERE m.family_id=? ORDER BY u.role DESC,u.display_name');$stmt->execute([$family['id']]);jsonResponse(['family'=>$family,'members'=>$stmt->fetchAll(),'plan'=>$plan]);
}
if ($parts===['profile'] && $method==='PATCH') {
    $input=body();$id=$user['id'];
    if ($user['role']==='parent' && isset($input['childId'])) {
        $id=(string)$input['childId'];$check=$pdo->prepare("SELECT 1 FROM family_members WHERE family_id=? AND user_id=? AND role='child'");$check->execute([$family['id'],$id]);if(!$check->fetch())fail('That child is not in your family.',403);
    } elseif(isset($input['childId']) && $input['childId']!==$id) fail('You can only change your own photo.',403);
    if ($user['role']==='parent') {
        $name=trim((string)($input['displayName']??''));$age=$input['age']??null;
        if($name===''||strlen($name)>80)fail('Enter a name up to 80 characters.',422);
        if($id!==$user['id']&&(!is_numeric($age)||(int)$age<4||(int)$age>18))fail('Choose an age from 4 to 18.',422);
        $pdo->prepare('UPDATE users SET display_name=?,age=? WHERE id=?')->execute([$name,$id===$user['id']?null:(int)$age,$id]);
    }
    if(array_key_exists('avatarData',$input))$pdo->prepare('UPDATE users SET avatar_data=? WHERE id=?')->execute([imageData($input['avatarData']),$id]);
    jsonResponse(['ok'=>true]);
}
if ($parts===['tasks'] && $method==='GET') {
    if($user['role']==='parent'){$stmt=$pdo->prepare('SELECT t.*,u.display_name child_name,a.display_name assigner_name FROM tasks t JOIN users u ON u.id=t.assigned_to LEFT JOIN users a ON a.id=t.created_by WHERE t.family_id=? ORDER BY t.created_at DESC');$stmt->execute([$family['id']]);}
    else{$stmt=$pdo->prepare('SELECT t.*,a.display_name assigner_name FROM tasks t LEFT JOIN users a ON a.id=t.created_by WHERE t.family_id=? AND t.assigned_to=? ORDER BY t.created_at DESC');$stmt->execute([$family['id'],$user['id']]);}
    jsonResponse(['tasks'=>$stmt->fetchAll()]);
}
if ($parts===['tasks'] && $method==='POST') {
    if($user['role']!=='parent')fail('Only a parent can assign tasks.',403);
    $input=body();$child=(string)($input['childId']??'');$check=$pdo->prepare("SELECT 1 FROM family_members WHERE family_id=? AND user_id=? AND role='child'");$check->execute([$family['id'],$child]);if(!$check->fetch())fail('That child is not in your family.',403);
    taskValues($input);missionDeadlineMinutes($input);$pdo->beginTransaction();try{$id=insertMission($pdo,$family['id'],$user['id'],$child,$input);notify($pdo,$child,'task_assigned','A new mission awaits',(string)$input['title']);$pdo->commit();}catch(Throwable $e){$pdo->rollBack();throw $e;}jsonResponse(['id'=>$id],201);
}
if (($parts[0]??'')==='tasks' && count($parts)===3 && $parts[2]==='submit' && $method==='POST') {
    if($user['role']!=='child')fail('Only a child can submit a task.',403);
    $input=body();$proof=imageData($input['proofUrl']??null);$before=imageData($input['proofBeforeUrl']??null);$note=trim((string)($input['note']??''));if(strlen($note)>2000)fail('Please shorten your note.',422);
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare("SELECT * FROM tasks WHERE id=? AND family_id=? AND assigned_to=? AND status IN ('active','rejected') FOR UPDATE");$stmt->execute([$parts[1],$family['id'],$user['id']]);$task=$stmt->fetch();
        if(!$task){$pdo->rollBack();fail('This mission is already submitted or unavailable.',422);}
        $mode=$task['photo_mode']??($task['photo_required']?'required':'optional');
        if($mode==='before_after'&&(!$before||!$proof)){$pdo->rollBack();fail('Add both a before and an after photo.',422);}
        if($mode==='required'&&!$proof){$pdo->rollBack();fail('Add a photo before submitting this mission.',422);}
        if($mode!=='before_after'&&$before){$pdo->rollBack();fail('This mission accepts one task photo.',422);}
        $id=uuid();$pdo->prepare('INSERT INTO submissions (id,task_id,child_id,note,proof_url,proof_before_url) VALUES (?,?,?,?,?,?)')->execute([$id,$task['id'],$user['id'],$note,$proof,$before]);
        $pdo->prepare("UPDATE tasks SET status='submitted' WHERE id=?")->execute([$task['id']]);notify($pdo,$task['created_by'],'task_submitted','Mission ready for review',$user['display_name'].' finished '.$task['mission_title']);$pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}jsonResponse(['submissionId'=>$id],201);
}
if(($parts[0]??'')==='submissions'&&count($parts)===3&&$parts[2]==='proof'&&$method==='GET'){
 if($user['role']!=='parent')fail('Only parents can review photos.',403);
 $stmt=$pdo->prepare('SELECT s.proof_url,s.proof_before_url FROM submissions s JOIN tasks t ON t.id=s.task_id WHERE s.id=? AND t.family_id=?');$stmt->execute([$parts[1],$family['id']]);$row=$stmt->fetch();if(!$row)fail('Photo not found.',404);
 header('Cache-Control: no-store');jsonResponse(['proofUrl'=>$row['proof_url'],'proofBeforeUrl'=>$row['proof_before_url']]);
}
if ($parts===['submissions'] && $method==='GET') {
 if($user['role']!=='parent')fail('Only parents can review missions.',403);
 $limit=50;$offset=max(0,(int)($_GET['cursor']??0));
 $stmt=$pdo->prepare("SELECT s.id submission_id,s.child_id,s.task_id,s.status,s.note,s.parent_feedback,s.created_at,s.reviewed_at,(s.proof_url IS NOT NULL AND s.proof_url<>'') has_proof,(s.proof_before_url IS NOT NULL AND s.proof_before_url<>'') has_before_proof,t.title,t.mission_title,t.description,t.coins,t.xp,t.category,t.icon,t.photo_required,t.photo_mode,u.display_name child_name FROM submissions s JOIN tasks t ON t.id=s.task_id JOIN users u ON u.id=s.child_id WHERE t.family_id=? ORDER BY (s.status='submitted') DESC,s.created_at DESC,s.id DESC LIMIT 51 OFFSET ".$offset);$stmt->execute([$family['id']]);$rows=$stmt->fetchAll();$more=count($rows)>$limit;jsonResponse(['submissions'=>array_slice($rows,0,$limit),'nextCursor'=>$more?(string)($offset+$limit):null]);
}
