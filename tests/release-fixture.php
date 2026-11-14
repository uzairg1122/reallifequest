<?php
// Disposable audit DB only. Never point this fixture at a family database.
$p=new PDO('mysql:host=127.0.0.1;port=3308;dbname=rlq_audit','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if(($argv[1]??'')==='clear-limits'){$p->exec('DELETE FROM invite_attempt_limits');exit;}
if(($argv[1]??'')==='reset'){
 $p->prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))')->execute([hash('sha256',$argv[3]),$argv[2]]);exit;
}
if(($argv[1]??'')==='reviews'){
 $task=$p->prepare('SELECT id,assigned_to FROM tasks WHERE created_by=? LIMIT 1');$task->execute([$argv[2]]);$row=$task->fetch(PDO::FETCH_ASSOC);
 if(!$row)throw new RuntimeException('Missing audit task');
 $insert=$p->prepare("INSERT INTO submissions(id,task_id,child_id,status,proof_url) VALUES (?,?,?,'approved',?)");
 for($i=0;$i<55;$i++)$insert->execute([sprintf('%s-%s-%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(6))),$row['id'],$row['assigned_to'],'data:image/png;base64,'.str_repeat('A',4096)]);
}
