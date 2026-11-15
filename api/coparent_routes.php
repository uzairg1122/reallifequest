<?php
// Loaded after authentication and family lookup in index.php.
// Multiple caregivers can join an existing family
// (via a short-lived invite code) as a family_member with role 'co_parent'.
// A co-parent can manage missions, rewards and approvals but only the primary
// parent (families.parent_id) can remove co-parents or delete children.

// The primary parent is the family owner recorded on families.parent_id.
function isPrimaryParent(array $family, array $user): bool {
    return ($family['parent_id'] ?? null) === $user['id'];
}

if ($parts === ['families','co-parent-code'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only a parent can invite a co-parent.',403);
    $adult = $pdo->prepare("SELECT 1 FROM family_members WHERE family_id=? AND user_id=? AND role IN ('parent','co_parent')");
    $adult->execute([$family['id'],$user['id']]);
    if (!$adult->fetchColumn()) fail('Only adults in this family can invite a caregiver.',403);
    $code=(string)random_int(100000,999999);
    $expires=gmdate('Y-m-d H:i:s',time()+86400);
    $pdo->prepare('INSERT INTO pairing_codes (id,family_id,code_hash,kind,expires_at) VALUES (?,?,?,?,?)')
        ->execute([uuid(),$family['id'],hash('sha256',$code),'co_parent',$expires]);
    jsonResponse(['code'=>$code,'codeDisplay'=>groupCode($code),'expiresAt'=>gmdate('c',time()+86400),'inviteUrl'=>publicAppOrigin().'/?coparent='.$code]);
}

if ($parts === ['families','parents'] && $method === 'GET') {
    if ($user['role'] !== 'parent') fail('Only adults can view caregiver details.',403);
    $stmt=$pdo->prepare("SELECT u.id,u.display_name,u.email,m.role,m.joined_at,m.relationship FROM family_members m JOIN users u ON u.id=m.user_id WHERE m.family_id=? AND m.role IN ('parent','co_parent') ORDER BY (u.id=?) DESC,u.display_name");
    $stmt->execute([$family['id'],$family['parent_id']]);
    $parents=array_map(static function($p) use ($family){
        return ['id'=>$p['id'],'displayName'=>$p['display_name'],'email'=>$p['email'],'role'=>$p['role'],'isPrimary'=>$p['id']===($family['parent_id']??null),'joinedAt'=>$p['joined_at'],'relationship'=>$p['relationship']];
    },$stmt->fetchAll());
    jsonResponse(['parents'=>$parents,'viewerIsPrimary'=>isPrimaryParent($family,$user)]);
}

if ($parts === ['families','relationship'] && $method === 'POST') {
    if (!isPrimaryParent($family,$user)) fail('Only the family owner can change relationship labels.',403);
    $input = body();
    $label = $input['relationship'] ?? '';
    if (!in_array($label,['','Mother','Father','Grandmother','Grandfather','Brother','Sister','Other caregiver'],true)) {
        fail('Choose a valid relationship.',422);
    }
    $stmt = $pdo->prepare("UPDATE family_members SET relationship=? WHERE family_id=? AND user_id=? AND role IN ('parent','co_parent')");
    $stmt->execute([$label?:null,$family['id'],(string)($input['memberId']??'')]);
    jsonResponse(['ok'=>true]);
}

if ($parts === ['families','remove-coparent'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only a parent can remove a co-parent.',403);
    if (!isPrimaryParent($family,$user)) fail('Only the primary parent can remove a co-parent.',403);
    $target=trim((string)(body()['coParentId']??''));
    if ($target==='') fail('Choose the co-parent to remove.',422);
    if ($target===$user['id']) fail('The primary parent cannot remove themselves.',422);
    $stmt=$pdo->prepare("DELETE FROM family_members WHERE family_id=? AND user_id=? AND role='co_parent'");
    $stmt->execute([$family['id'],$target]);
    if ($stmt->rowCount()!==1) fail('That co-parent was not found in your family.',404);
    notify($pdo,$target,'coparent_removed','Co-parent access ended','You were removed from the family by the primary parent.');
    jsonResponse(['ok'=>true]);
}
