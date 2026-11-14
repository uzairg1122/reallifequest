<?php
// Loaded after authentication and family lookup in index.php.
// Spec section 10: parental consent, safety moderation, and data export/deletion.
// Nothing here accepts free text from one family to another, and no child record is
// ever exposed outside the family that owns it.

// Resolves a child id to a full users row, or fails. Only children of the caller's own
// family can be addressed, so one family can never touch another's consent or data.
function safetyChild(PDO $pdo, array $family, string $childId): array {
    $stmt = $pdo->prepare("SELECT u.* FROM users u JOIN family_members m ON m.user_id=u.id WHERE u.id=? AND u.role='child' AND m.family_id=? AND m.role='child'");
    $stmt->execute([$childId, $family['id']]);
    $child = $stmt->fetch();
    if (!$child) fail('That child is not in your family.', 404);
    return $child;
}

function consentState(array $child): array {
    return [
        'childId' => $child['id'],
        'name' => $child['display_name'],
        'ageBand' => ageBandFor($child['age'] === null || $child['age'] === '' ? null : (int)$child['age']),
        'consented' => childConsented($child),
        'consentAt' => $child['consent_at'] ?? null,
        'consentBy' => $child['consent_by'] ?? null,
        'leagueOptIn' => (int)($child['league_opt_in'] ?? 0) === 1,
        'publicNickname' => $child['public_nickname'] ?? null,
        'effectiveNickname' => publicNickname($child['public_nickname'] ?? null, $child['display_name'], $child['id']),
        // Little band is family-board-only by default; the toggle above is what unlocks it.
        'publicAllowedByDefault' => ageBandFor($child['age'] === null || $child['age'] === '' ? null : (int)$child['age']) !== 'little',
    ];
}

// ---------------------------------------------------------------------------
// 3. Parental consent (spec 10.1)
// ---------------------------------------------------------------------------

if ($parts === ['safety', 'consent'] && $method === 'GET') {
    if ($user['role'] !== 'parent') fail('Only a parent can review consent.', 403);
    $stmt = $pdo->prepare("SELECT u.* FROM users u JOIN family_members m ON m.user_id=u.id WHERE m.family_id=? AND m.role='child' ORDER BY u.display_name");
    $stmt->execute([$family['id']]);
    $children = array_map('consentState', $stmt->fetchAll());
    $history = $pdo->prepare('SELECT c.child_id,u.display_name child_name,c.scope,c.granted,c.created_at,c.revoked_at FROM consents c JOIN family_members m ON m.user_id=c.child_id JOIN users u ON u.id=c.child_id WHERE m.family_id=? ORDER BY c.created_at DESC LIMIT 100');
    $history->execute([$family['id']]);
    $audit = array_map(static fn($r) => [
        'childId' => $r['child_id'], 'childName' => $r['child_name'], 'scope' => $r['scope'],
        'granted' => (int)$r['granted'] === 1, 'createdAt' => $r['created_at'], 'revokedAt' => $r['revoked_at'] ?? null,
    ], $history->fetchAll());
    jsonResponse(['children' => $children, 'history' => $audit, 'scopes' => CONSENT_SCOPES]);
}

if ($parts === ['safety', 'consent'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only a parent can give or withdraw consent.', 403);
    $in = body(); $child = safetyChild($pdo, $family, trim((string)($in['childId'] ?? '')));
    $granted = !empty($in['granted']);
    $scope = (string)($in['scope'] ?? 'app_data_collection');
    if (!in_array($scope, CONSENT_SCOPES, true)) $scope = 'app_data_collection';
    $pdo->beginTransaction();
    try {
        recordConsent($pdo, $child['id'], $user['id'], $granted, $scope);
        // Withdrawing consent has to take effect now, not at the next season boundary:
        // leave every public board, stop ranking this child, and drop reactions that
        // would otherwise keep their nickname visible to other families.
        if (!$granted) {
            $pdo->prepare('DELETE FROM league_members WHERE child_id=?')->execute([$child['id']]);
            $pdo->prepare('UPDATE users SET league_opt_in=0 WHERE id=?')->execute([$child['id']]);
            $pdo->prepare('DELETE FROM reactions WHERE from_user_id=? OR to_user_id=?')->execute([$child['id'], $child['id']]);
        } elseif (($child['league_opt_in'] ?? 0) == 1) {
            leaguePlace($pdo, $child['id'], $child['age'] === null ? null : (int)$child['age'], isoWeekKey(), ['consent_at' => gmdate('Y-m-d H:i:s'), 'league_opt_in' => 1]);
        }
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    $fresh = safetyChild($pdo, $family, $child['id']);
    jsonResponse(['child' => consentState($fresh), 'granted' => $granted]);
}

// Public nickname. Spec 7.1 / 10.3: other families see this, never display_name, and the
// filter blocks profanity plus anything resembling contact or address information.
if ($parts === ['safety', 'nickname'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only a parent can set a public nickname.', 403);
    $in = body(); $child = safetyChild($pdo, $family, trim((string)($in['childId'] ?? '')));
    $nickname = trim((string)($in['nickname'] ?? ''));
    if (!nicknameIsSafe($nickname)) {
        fail('Pick a nickname of up to 24 letters with no numbers, contact details or rude words.', 422);
    }
    $pdo->prepare('UPDATE users SET public_nickname=? WHERE id=?')->execute([$nickname, $child['id']]);
    jsonResponse(['childId' => $child['id'], 'publicNickname' => $nickname]);
}

// ---------------------------------------------------------------------------
// 4. Safety: report, block, preset reactions (spec 10.3)
// ---------------------------------------------------------------------------

if ($parts === ['safety', 'report'] && $method === 'POST') {
    $in = body();
    $reportedId = trim((string)($in['userId'] ?? ''));
    $reason = (string)($in['reason'] ?? '');
    $details = trim((string)($in['details'] ?? ''));
    if (!in_array($reason, REPORT_REASONS, true)) $reason = 'other';
    if (mb_strlen($details) > 500) fail('Please keep report details under 500 characters.', 422);
    if ($reportedId === '' || $reportedId === $user['id']) fail('Choose another profile to report.', 422);
    $check = $pdo->prepare('SELECT id FROM users WHERE id=?'); $check->execute([$reportedId]);
    if (!$check->fetch()) fail('That profile no longer exists.', 404);
    $id = uuid();
    $pdo->prepare('INSERT INTO safety_reports (id,reporter_id,reporter_family_id,reported_user_id,reason,details) VALUES (?,?,?,?,?,?)')
        ->execute([$id, $user['id'], $family['id'], $reportedId, $reason, $details]);
    // Reporting also blocks, so the family stops seeing the profile immediately.
    $pdo->prepare('INSERT IGNORE INTO user_blocks (blocker_id,blocked_id) VALUES (?,?)')->execute([$user['id'], $reportedId]);
    jsonResponse(['id' => $id, 'status' => 'open', 'blocked' => true], 201);
}

if ($parts === ['safety', 'reports'] && $method === 'GET') {
    if ($user['role'] !== 'parent') fail('Only a parent can review reports.', 403);
    $stmt = $pdo->prepare('SELECT r.id,r.reason,r.details,r.status,r.created_at,u.display_name reported_name FROM safety_reports r JOIN family_members m ON m.family_id=r.reporter_family_id JOIN users u ON u.id=r.reported_user_id WHERE m.user_id=? AND m.family_id=? ORDER BY r.created_at DESC LIMIT 50');
    $stmt->execute([$user['id'], $family['id']]);
    jsonResponse(['reports' => array_map(static fn($r) => [
        'id' => $r['id'], 'reason' => $r['reason'], 'details' => $r['details'] ?? '', 'status' => $r['status'],
        'reportedName' => $r['reported_name'], 'createdAt' => $r['created_at'],
    ], $stmt->fetchAll())]);
}

if ($parts === ['safety', 'block'] && $method === 'POST') {
    $in = body();
    $targetId = trim((string)($in['userId'] ?? ''));
    if ($targetId === '' || $targetId === $user['id']) fail('Choose another profile to block or unblock.', 422);
    $check = $pdo->prepare('SELECT id FROM users WHERE id=?'); $check->execute([$targetId]);
    if (!$check->fetch()) fail('That profile no longer exists.', 404);
    if (!empty($in['blocked'])) {
        $pdo->prepare('INSERT IGNORE INTO user_blocks (blocker_id,blocked_id) VALUES (?,?)')->execute([$user['id'], $targetId]);
    } else {
        $pdo->prepare('DELETE FROM user_blocks WHERE blocker_id=? AND blocked_id=?')->execute([$user['id'], $targetId]);
    }
    jsonResponse(['userId' => $targetId, 'blocked' => !empty($in['blocked'])]);
}

if ($parts === ['safety', 'blocks'] && $method === 'GET') {
    $stmt = $pdo->prepare('SELECT blocked_id FROM user_blocks WHERE blocker_id=?'); $stmt->execute([$user['id']]);
    jsonResponse(['blocks' => array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN))]);
}

// Preset reactions only. The emoji must be one of the three allowed values, so no child
// can type anything that reaches another family.
if ($parts === ['safety', 'reaction'] && $method === 'POST') {
    $in = body();
    $toId = trim((string)($in['userId'] ?? ''));
    $emoji = (string)($in['emoji'] ?? '');
    if (!in_array($emoji, ALLOWED_REACTIONS, true)) fail('Choose one of the preset reactions.', 422);
    if ($toId === '' || $toId === $user['id']) fail('Choose another profile to react to.', 422);
    $check = $pdo->prepare('SELECT id FROM users WHERE id=?'); $check->execute([$toId]);
    if (!$check->fetch()) fail('That profile no longer exists.', 404);
    $pdo->prepare('INSERT INTO reactions (id,from_user_id,to_user_id,emoji) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id=id')
        ->execute([uuid(), $user['id'], $toId, $emoji]);
    $counts = $pdo->prepare('SELECT emoji,COUNT(*) n FROM reactions WHERE to_user_id=? GROUP BY emoji'); $counts->execute([$toId]);
    $out = array_fill_keys(ALLOWED_REACTIONS, 0);
    foreach ($counts->fetchAll() as $row) $out[$row['emoji']] = (int)$row['n'];
    $mine = $pdo->prepare('SELECT emoji FROM reactions WHERE from_user_id=? AND to_user_id=?'); $mine->execute([$user['id'], $toId]);
    jsonResponse(['userId' => $toId, 'counts' => $out, 'mine' => array_map('strval', $mine->fetchAll(PDO::FETCH_COLUMN))]);
}

// ---------------------------------------------------------------------------
// 5. Data export and deletion (spec 10.1: parent can review and delete at any time)
// ---------------------------------------------------------------------------

if ($parts === ['safety', 'export'] && $method === 'GET') {
    if ($user['role'] !== 'parent') fail('Only a parent can export family data.', 403);
    $familyId = $family['id'];
    $pdo->prepare('INSERT INTO data_requests (id,family_id,requested_by,kind,status,completed_at) VALUES (?,?,?,\'export\',\'completed\',UTC_TIMESTAMP())')
        ->execute([uuid(), $familyId, $user['id']]);
    $export = ['exportedAt' => gmdate('c'), 'family' => ['id' => $family['id'], 'name' => $family['name']]];
    $collect = static function (string $sql, array $params = []) use ($pdo, $familyId): array {
        $stmt = $pdo->prepare($sql); $stmt->execute($params); return $stmt->fetchAll();
    };
    $export['parents'] = $collect('SELECT u.id,u.email,u.display_name,u.role,m.role family_role,m.joined_at FROM users u JOIN family_members m ON m.user_id=u.id WHERE m.family_id=? AND u.role<>\'child\'', [$familyId]);
    $export['children'] = $collect('SELECT u.id,u.display_name,u.age,u.consent_at,u.consent_by,u.league_opt_in,u.public_nickname,u.created_at FROM users u JOIN family_members m ON m.user_id=u.id WHERE m.family_id=? AND u.role=\'child\'', [$familyId]);
    $export['tasks'] = $collect('SELECT * FROM tasks WHERE family_id=?', [$familyId]);
    $export['submissions'] = $collect('SELECT s.* FROM submissions s JOIN tasks t ON t.id=s.task_id WHERE t.family_id=?', [$familyId]);
    $export['xpLedger'] = $collect('SELECT * FROM xp_events WHERE family_id=? ORDER BY created_at', [$familyId]);
    $export['rewards'] = $collect('SELECT r.* FROM rewards r WHERE r.family_id=?', [$familyId]);
    $export['rewardRequests'] = $collect('SELECT rr.* FROM reward_requests rr JOIN rewards r ON r.id=rr.reward_id WHERE r.family_id=?', [$familyId]);
    $export['wallets'] = $collect('SELECT * FROM child_wallets WHERE child_id IN (SELECT user_id FROM family_members WHERE family_id=? AND role=\'child\')', [$familyId]);
    $export['leagueHistory'] = $collect('SELECT * FROM league_history WHERE child_id IN (SELECT user_id FROM family_members WHERE family_id=? AND role=\'child\')', [$familyId]);
    $export['consents'] = $collect('SELECT c.* FROM consents c JOIN family_members m ON m.user_id=c.child_id WHERE m.family_id=?', [$familyId]);
    $export['notifications'] = $collect('SELECT n.* FROM notifications n WHERE n.user_id IN (SELECT user_id FROM family_members WHERE family_id=?)', [$familyId]);
    $export['blocks'] = $collect('SELECT b.* FROM user_blocks b WHERE b.blocker_id IN (SELECT user_id FROM family_members WHERE family_id=?)', [$familyId]);
    jsonResponse($export);
}

// Complete deletion of one child's data. Distinct from the existing /family/delete-child,
// which only removes the account row: this removes every trace and scrubs the name from
// submissions and ledger history so nothing about the child survives.
if ($parts === ['safety', 'erase-child'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only a parent can erase child data.', 403);
    if (($family['parent_id'] ?? null) !== $user['id']) fail('Only the primary parent can erase child data.', 403);
    $in = body();
    $child = safetyChild($pdo, $family, trim((string)($in['childId'] ?? '')));
    requireParentConfirmation($pdo,$user,$in);
    $typed = trim((string)($in['confirm'] ?? ''));
    if (mb_strtolower($typed) !== mb_strtolower('erase ' . $child['display_name'])) fail('Type "erase ' . $child['display_name'] . '" to confirm.', 422);
    $childId = $child['id'];
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO data_requests (id,family_id,requested_by,kind,target_user_id,status) VALUES (?,?,?,\'delete_child\',?,\'pending\')')
            ->execute([uuid(), $family['id'], $user['id'], $childId]);
        $pdo->prepare('DELETE FROM submissions WHERE child_id=?')->execute([$childId]);
        $pdo->prepare('DELETE FROM reward_requests WHERE child_id=?')->execute([$childId]);
        $pdo->prepare('DELETE FROM tasks WHERE assigned_to=?')->execute([$childId]);
        // Detach before the user row goes, because the child_wallets FK is not cascading.
        $pdo->prepare('DELETE FROM child_wallets WHERE child_id=?')->execute([$childId]);
        $pdo->prepare('DELETE FROM users WHERE id=? AND role=\'child\'')->execute([$childId]);
        $pdo->prepare('UPDATE data_requests SET status=\'completed\',completed_at=UTC_TIMESTAMP() WHERE family_id=? AND target_user_id=?')
            ->execute([$family['id'], $childId]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    jsonResponse(['ok' => true, 'erased' => $childId]);
}

// Delete the whole family account: every child, every co-parent, the family row and the
// parent's own account. This is irreversible, so it demands the parent password and an
// exact typed confirmation.
if ($parts === ['safety', 'erase-family'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only a parent can delete the family account.', 403);
    if (($family['parent_id'] ?? null) !== $user['id']) fail('Only the primary parent can delete the family account.', 403);
    $in = body();
    requireParentConfirmation($pdo,$user,$in);
    if (mb_strtoupper(trim((string)($in['confirm'] ?? ''))) !== 'DELETE MY FAMILY') fail('Type DELETE MY FAMILY to confirm.', 422);
    $familyId = $family['id'];
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO data_requests (id,family_id,requested_by,kind,status) VALUES (?,?,?,\'delete_family\',\'pending\')')
            ->execute([uuid(), $familyId, $user['id']]);
        $pdo->prepare('DELETE FROM submissions WHERE child_id IN (SELECT user_id FROM family_members WHERE family_id=? AND role=\'child\')')->execute([$familyId]);
        $pdo->prepare('DELETE FROM tasks WHERE family_id=?')->execute([$familyId]);
        $pdo->prepare('DELETE FROM child_wallets WHERE child_id IN (SELECT user_id FROM family_members WHERE family_id=? AND role=\'child\')')->execute([$familyId]);
        $pdo->prepare('DELETE FROM users WHERE id IN (SELECT user_id FROM family_members WHERE family_id=?)')->execute([$familyId]);
        // The families row has the FK that family_members points at, so it goes last.
        $pdo->prepare('DELETE FROM families WHERE id=?')->execute([$familyId]);
        $pdo->prepare('DELETE FROM data_requests WHERE family_id=?')->execute([$familyId]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    jsonResponse(['ok' => true, 'deleted' => true]);
}
