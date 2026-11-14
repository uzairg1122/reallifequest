<?php
// Loaded after authentication and family lookup in index.php.
// Cross-family weekly league by age band, with Bronze/Silver/Gold divisions,
// promote/relegate at each week boundary, and a season archive.

// Ensure a child has a league row; new children enter at the bottom (Bronze).
// Spec 7.1: public leagues are opt-in per child, so a child without recorded parental
// consent and an explicit league_opt_in is never inserted, and therefore never appears on
// a cross-family board. Any membership left over from an earlier opt-in is removed here so
// revoking consent takes the child off the public board on the very next request.
function leaguePlace(PDO $pdo, string $childId, ?int $age, string $week, array $child): array {
    $band = ageBandFor($age);
    if (!childLeagueEligible($child)) {
        $pdo->prepare('DELETE FROM league_members WHERE child_id=?')->execute([$childId]);
        return ['age_band' => $band, 'division' => LEAGUE_BOTTOM_DIVISION, 'opted_out' => true];
    }
    $row = $pdo->prepare('SELECT age_band,division FROM league_members WHERE child_id=?');
    $row->execute([$childId]); $found = $row->fetch();
    if (!$found) {
        $pdo->prepare('INSERT IGNORE INTO league_members (child_id,age_band,division,updated_week) VALUES (?,?,?,?)')
            ->execute([$childId, $band, LEAGUE_BOTTOM_DIVISION, $week]);
        return ['age_band' => $band, 'division' => LEAGUE_BOTTOM_DIVISION, 'opted_out' => false];
    }
    if ($found['age_band'] !== $band) {
        $pdo->prepare('UPDATE league_members SET age_band=? WHERE child_id=?')->execute([$band, $childId]);
        $found['age_band'] = $band;
    }
    return ['age_band' => $found['age_band'], 'division' => (int)$found['division'], 'opted_out' => false];
}

// Ranked standings within one age band + division for the current week (top 30).
// Spec 6.5: XP that breached the daily cap is flagged in the ledger and must not count
// toward a public ranking, so the SUM only ever sees unflagged rows. Spec 7.1: other
// families see a filtered nickname, never display_name.
function leagueBoard(PDO $pdo, string $band, int $division, string $week, string $subjectId, string $viewerId): array {
    // Spec 10.3: a blocked child disappears from the blocker's board immediately, so the
    // exclusion is part of the ranking query rather than a client-side filter.
    [$blockSql, $blockParams] = blockExclusion($pdo, $viewerId);
    $stmt = $pdo->prepare("SELECT u.id,u.display_name,u.public_nickname,u.avatar_data,COALESCE(SUM(e.xp),0) xp FROM league_members lm JOIN users u ON u.id=lm.child_id LEFT JOIN xp_events e ON e.child_id=lm.child_id AND e.iso_week=? AND e.flagged=0 WHERE lm.age_band=? AND lm.division=? AND {$blockSql} GROUP BY u.id,u.display_name,u.public_nickname,u.avatar_data ORDER BY COALESCE(SUM(e.xp),0) DESC,u.display_name LIMIT 30");
    $stmt->execute(array_merge([$week, $band, $division], $blockParams));
    $out = [];
    foreach ($stmt->fetchAll() as $i => $r) {
        $out[] = ['id' => $r['id'], 'display_name' => publicNickname($r['public_nickname'] ?? null, $r['display_name'], $r['id']), 'avatar_data' => $r['avatar_data'], 'xp' => (int)$r['xp'], 'rank' => $i + 1, 'isMe' => $r['id'] === $subjectId];
    }
    return $out;
}

// Archive a completed week and apply promote (top ~20%, max 3) / relegate (bottom ~20%, max 3).
// Idempotent: the league_seasons row is the once-only guard.
function closeLeagueWeek(PDO $pdo, string $week): void {
    $ins = $pdo->prepare('INSERT IGNORE INTO league_seasons (iso_week) VALUES (?)');
    $ins->execute([$week]);
    if ($ins->rowCount() === 0) return;
    $groups = $pdo->query('SELECT DISTINCT age_band,division FROM league_members')->fetchAll();
    foreach ($groups as $g) {
        $band = $g['age_band']; $div = (int)$g['division'];
        $stmt = $pdo->prepare("SELECT lm.child_id,COALESCE(SUM(e.xp),0) xp FROM league_members lm LEFT JOIN xp_events e ON e.child_id=lm.child_id AND e.iso_week=? AND e.flagged=0 WHERE lm.age_band=? AND lm.division=? AND lm.updated_week<=? GROUP BY lm.child_id ORDER BY COALESCE(SUM(e.xp),0) DESC,lm.child_id");
        $stmt->execute([$week, $band, $div, $week]);
        $rows = $stmt->fetchAll(); $n = count($rows);
        if ($n === 0) continue;
        $promote = $div > LEAGUE_TOP_DIVISION ? min(3, (int)ceil($n * 0.2)) : 0;
        $relegate = $div < LEAGUE_BOTTOM_DIVISION ? min(3, (int)ceil($n * 0.2)) : 0;
        foreach ($rows as $i => $r) {
            $movement = 'stayed'; $newDiv = $div;
            if ($promote > 0 && $i < $promote) { $movement = 'promoted'; $newDiv = max(LEAGUE_TOP_DIVISION, $div - 1); }
            elseif ($relegate > 0 && $i >= $n - $relegate) { $movement = 'relegated'; $newDiv = min(LEAGUE_BOTTOM_DIVISION, $div + 1); }
            $pdo->prepare('INSERT INTO league_history (id,iso_week,age_band,division,child_id,xp,rank_pos,movement) VALUES (?,?,?,?,?,?,?,?)')
                ->execute([uuid(), $week, $band, $div, $r['child_id'], (int)$r['xp'], $i + 1, $movement]);
            $pdo->prepare('UPDATE league_members SET division=?,updated_week=? WHERE child_id=?')
                ->execute([$newDiv, $week, $r['child_id']]);
        }
    }
}

if ($parts === ['league'] && $method === 'GET') {
    $week = isoWeekKey(); $prev = isoWeekKey('-7 days');
    closeLeagueWeek($pdo, $prev);
    if ($user['role'] === 'child') {
        $subjects = [['id' => $user['id'], 'display_name' => $user['display_name'], 'age' => $user['age'] ?? null, 'consent_at' => $user['consent_at'] ?? null, 'league_opt_in' => $user['league_opt_in'] ?? 0]];
    } else {
        $s = $pdo->prepare("SELECT u.id,u.display_name,u.age,u.consent_at,u.league_opt_in FROM family_members m JOIN users u ON u.id=m.user_id WHERE m.family_id=? AND m.role='child' ORDER BY u.display_name");
        $s->execute([$family['id']]); $subjects = $s->fetchAll();
    }
    $leagues = [];
    foreach ($subjects as $c) {
        $age = array_key_exists('age', $c) && $c['age'] !== null ? (int)$c['age'] : null;
        $place = leaguePlace($pdo, $c['id'], $age, $week, $c);
        $board = $place['opted_out'] ? [] : leagueBoard($pdo, $place['age_band'], $place['division'], $week, $c['id'], $user['id']);
        $hist = $pdo->prepare('SELECT iso_week,division,rank_pos,movement,xp FROM league_history WHERE child_id=? ORDER BY iso_week DESC LIMIT 4');
        $hist->execute([$c['id']]);
        $history = array_map(static fn($h) => ['week' => $h['iso_week'], 'division' => (int)$h['division'], 'divisionName' => divisionName((int)$h['division']), 'rank' => (int)$h['rank_pos'], 'movement' => $h['movement'], 'xp' => (int)$h['xp']], $hist->fetchAll());
        $leagues[] = [
            'childId' => $c['id'], 'childName' => $c['display_name'], 'ageBand' => $place['age_band'],
            'division' => $place['division'], 'divisionName' => divisionName($place['division']),
            'entries' => $board, 'history' => $history,
            // The client uses these two flags to explain the family-board-only state
            // instead of rendering an empty league screen.
            'optedOut' => $place['opted_out'],
            'optedOutReason' => $place['opted_out'] ? (!empty($c['league_suspended'])?'moderation':(childConsented($c) ? 'parent_opt_out' : 'consent_required')) : null,
        ];
    }
    jsonResponse(['week' => $week, 'theme' => weeklyTheme($week), 'divisions' => LEAGUE_DIVISIONS, 'leagues' => $leagues]);
}

// Parent-only opt-in toggle (spec 7.1 / 11.2 ChildProfile.league_opt_in). Requires a
// parent in the same family, and a child without recorded consent is refused so consent
// can never be implied by turning the league on.
if ($parts === ['league', 'opt-in'] && $method === 'POST') {
    if ($user['role'] !== 'parent') fail('Only a parent can change public league participation.',403);
    $in = body(); $childId = trim((string)($in['childId'] ?? '')); $enabled = !empty($in['enabled']);
    $stmt = $pdo->prepare("SELECT u.* FROM users u JOIN family_members m ON m.user_id=u.id WHERE u.id=? AND u.role='child' AND m.family_id=? AND m.role='child'");
    $stmt->execute([$childId, $family['id']]); $child = $stmt->fetch();
    if (!$child) fail('That child is not in your family.',404);
    if($enabled&&!empty($child['league_suspended']))fail('Public league participation is paused by moderation. Contact support@nomolabs.pro.',403);
    if ($enabled && !childConsented($child)) fail('Give consent for this child first, then public leagues can be turned on.',422);
    $pdo->prepare('UPDATE users SET league_opt_in=? WHERE id=?')->execute([$enabled ? 1 : 0, $childId]);
    // Take effect immediately rather than at the next week boundary.
    if (!$enabled) $pdo->prepare('DELETE FROM league_members WHERE child_id=?')->execute([$childId]);
    else leaguePlace($pdo, $childId, $child['age'] === null ? null : (int)$child['age'], isoWeekKey(), ['consent_at' => $child['consent_at'], 'league_opt_in' => 1]);
    jsonResponse(['childId' => $childId, 'leagueOptIn' => $enabled, 'ageBand' => ageBandFor($child['age'] === null ? null : (int)$child['age'])]);
}
