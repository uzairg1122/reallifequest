<?php
declare(strict_types=1);

function imageData(mixed $value): ?string {
    if ($value===null || $value==='') return null;
    if (!is_string($value) || strlen($value)>1500000 || !preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#D',$value,$m)) fail('Choose a JPG, PNG or WebP photo smaller than 1 MB.',422);
    $bytes=base64_decode($m[2],true); $info=$bytes===false?false:@getimagesizefromstring($bytes);
    if (!$info || !in_array($info['mime'],['image/jpeg','image/png','image/webp'],true) || $info[0]>2000 || $info[1]>2000) fail('The photo could not be read. Please choose another image.',422);
    return 'data:'.$info['mime'].';base64,'.base64_encode($bytes);
}
function taskValues(array $in): array {
    $title=trim((string)($in['title']??'')); $mission=trim((string)($in['missionTitle']??$title));
    $description=trim((string)($in['description']??''));
    if ($title==='' || $mission==='' || strlen($title)>160 || strlen($mission)>160 || strlen($description)>2000) fail('Enter a task name and short instructions.',422);
    $category=(string)($in['category']??'Custom Missions');
    if (!in_array($category,['Morning Routine','School & Homework','Tidy & Order','Bedtime Wind-Down','Bonus','Custom Missions'],true)) $category='Custom Missions';
    $icon=(string)($in['icon']??'⚔️'); if(strlen($icon)>32)$icon='⚔️';
    $days=(string)($in['days']??'both'); if(!in_array($days,['both','Weekdays','Weekends','Once'],true))$days='both';
    $photoMode=$in['photoMode']??(empty($in['photoRequired'])?'optional':'required');
    if(!is_string($photoMode)||!in_array($photoMode,['optional','required','before_after'],true))fail('Choose optional, required, or before-and-after photo proof.',422);
    $difficulty=$in['difficulty']??null; if(!is_string($difficulty)||!array_key_exists($difficulty,XP_BY_DIFFICULTY))$difficulty=null;
    $xp=$difficulty!==null?XP_BY_DIFFICULTY[$difficulty]:min(500,max(0,(int)($in['xp']??0)));
    return [$title,$mission,$description,min(100000,max(0,(int)($in['coins']??0))),$xp,$difficulty,$category,$icon,$days,$photoMode==='optional'?0:1,$photoMode];
}
function insertMission(PDO $pdo,string $family,string $parent,string $child,array $input): string {
    $id=uuid();$values=taskValues($input);
    $pdo->prepare('INSERT INTO tasks (id,family_id,created_by,assigned_to,title,mission_title,description,coins,xp,difficulty,category,icon,days,photo_required,photo_mode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute(array_merge([$id,$family,$parent,$child],$values));
    return $id;
}

// XP is app-standardized (not parent-set) so leaderboards stay fair across families.
const DAILY_XP_CAP = 300;
const XP_BY_DIFFICULTY = ['easy'=>10,'medium'=>25,'hard'=>50];

// ISO-8601 year+week key (e.g. 2026-W39), matching the local edition's isoWeek().
function isoWeekKey(?string $date=null): string {
    return (new DateTimeImmutable($date ?? 'now', new DateTimeZone('UTC')))->format('o-\WW');
}
// Standardized XP for a task row: fixed by difficulty when set, else the legacy per-task xp.
function standardizedXp(array $task): int {
    $difficulty=$task['difficulty']??null;
    if (is_string($difficulty) && array_key_exists($difficulty,XP_BY_DIFFICULTY)) return XP_BY_DIFFICULTY[$difficulty];
    return max(0,(int)($task['xp']??0));
}
// Appends an approval to the XP ledger, enforcing the daily XP cap, and returns the XP actually granted.
// $task must carry task_id, xp, coins and (optionally) difficulty. Runs inside the caller's transaction.
function recordXpApproval(PDO $pdo, string $familyId, string $childId, array $task, string $submissionId): int {
    $today=gmdate('Y-m-d'); $week=isoWeekKey($today); $wanted=standardizedXp($task);
    $sum=$pdo->prepare('SELECT COALESCE(SUM(xp),0) FROM xp_events WHERE child_id=? AND yyyymmdd=? AND source=?');
    $sum->execute([$childId,$today,'task_approval']); $already=(int)$sum->fetchColumn();
    $granted=max(0,min($wanted,DAILY_XP_CAP-$already));
    $flagged=$granted<$wanted?1:0; $reason=$flagged?'daily_xp_cap':null;
    $difficulty=(is_string($task['difficulty']??null) && array_key_exists($task['difficulty'],XP_BY_DIFFICULTY))?$task['difficulty']:'custom';
    $pdo->prepare('INSERT INTO xp_events (id,family_id,child_id,task_id,submission_id,source,xp,coins,difficulty,yyyymmdd,iso_week,flagged,flag_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([uuid(),$familyId,$childId,$task['task_id']??null,$submissionId,'task_approval',$granted,max(0,(int)($task['coins']??0)),$difficulty,$today,$week,$flagged,$reason]);
    return $granted;
}

// Age band from a numeric age (spec §8.1). Null age defaults to junior.
function ageBandFor(?int $age): string {
    if ($age === null) return 'junior';
    return $age <= 9 ? 'little' : ($age <= 12 ? 'junior' : 'teen');
}

// System-defined weekly challenge theme. Deterministic from the ISO week so every
// family sees the same theme, and it rotates automatically each Monday.
const WEEKLY_THEMES = [
    ['key'=>'kindness','title'=>'Kindness Quest','emoji'=>'💛','blurb'=>'Earn XP with helpful, caring missions this week.'],
    ['key'=>'tidy','title'=>'Tidy Champions','emoji'=>'🧹','blurb'=>'Clean rooms and neat spaces score big this week.'],
    ['key'=>'homework','title'=>'Homework Heroes','emoji'=>'📚','blurb'=>'School and study missions are the stars this week.'],
    ['key'=>'earlybird','title'=>'Early Bird Week','emoji'=>'🌅','blurb'=>'Morning routines finished on time win the week.'],
    ['key'=>'helping','title'=>'Helping Hands','emoji'=>'🤝','blurb'=>'Lend a hand around the home for extra glory.'],
    ['key'=>'screenfree','title'=>'Screen-Free Streak','emoji'=>'🌳','blurb'=>'Off-screen adventures shine this week.'],
    ['key'=>'teamwork','title'=>'Family Teamwork','emoji'=>'🏰','blurb'=>'Team missions and shared chores take the crown.'],
    ['key'=>'healthy','title'=>'Healthy Habits','emoji'=>'🥕','blurb'=>'Healthy-choice missions power up the leaderboard.'],
];
function weeklyTheme(?string $week = null): array {
    $week = $week ?? isoWeekKey();
    $index = ((int)substr($week, -2)) % count(WEEKLY_THEMES);
    return ['week' => $week] + WEEKLY_THEMES[$index];
}

// Brute-force lockout for invite/join code entry, keyed by IP + tag (mirrors child login limits).
// Fails open if the limits table has not been migrated yet, so it never blocks a valid signup.
function inviteThrottle(PDO $pdo, string $tag): void {
    $key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'local') . '|' . $tag);
    try {
        $pdo->prepare('DELETE FROM invite_attempt_limits WHERE window_start<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY)')->execute();
        $pdo->prepare('INSERT INTO invite_attempt_limits (attempt_key,window_start) VALUES (?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_start<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),1,attempts+1),window_start=IF(window_start<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),UTC_TIMESTAMP(),window_start)')->execute([$key]);
        $c = $pdo->prepare('SELECT attempts FROM invite_attempt_limits WHERE attempt_key=?'); $c->execute([$key]);
        $attempts = (int)$c->fetchColumn();
    } catch (PDOException $e) {
        if (in_array((int)($e->errorInfo[1] ?? 0), [1146, 1054], true)) return;
        throw $e;
    }
    if ($attempts > 10) fail('Too many invite attempts. Please wait 15 minutes and try again.', 429);
}
function clearInviteThrottle(PDO $pdo, string $tag): void {
    try { $pdo->prepare('DELETE FROM invite_attempt_limits WHERE attempt_key=?')->execute([hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'local') . '|' . $tag)]); }
    catch (PDOException $e) { /* limits table not migrated yet */ }
}

// Group a 6-digit invite code as XXX-XXX for readable display (storage/matching stays digit-only).
function groupCode(string $code): string {
    return strlen($code) === 6 ? substr($code, 0, 3) . '-' . substr($code, 3, 3) : $code;
}
// Normalize an invite code the user typed: strip spaces/dashes so 123-456 == 123456.
function normalizeCode(string $raw): string {
    return preg_replace('/[^0-9A-Za-z]/', '', $raw);
}

// Division labels for the weekly league (1=Gold at the top).
const LEAGUE_DIVISIONS = [1=>'Gold', 2=>'Silver', 3=>'Bronze'];
const LEAGUE_TOP_DIVISION = 1;
const LEAGUE_BOTTOM_DIVISION = 3;
function divisionName(int $division): string {
    return LEAGUE_DIVISIONS[$division] ?? ('Division ' . $division);
}

// ---------------------------------------------------------------------------
// Spec 10: child safety, privacy and compliance
// ---------------------------------------------------------------------------

// Preset reactions only (spec 10.3). No free text can ever cross between families.
const ALLOWED_REACTIONS = ['👏', '🔥', '⭐'];

// Consent scopes a parent can grant or withdraw (spec 10.1). Kept explicit so the audit
// trail records which permission was agreed to, not just a single undifferentiated yes.
const CONSENT_SCOPES = [
    'app_data_collection' => "Store this child's nickname, age band, avatar and mission activity on the server",
    'public_league' => "Show this child's nickname, avatar and weekly XP rank on public leagues",
    'photo_proof' => 'Keep photo proof on the server so a parent can review it later',
];

// Report reasons (spec 10.3). Fixed set, so a report always lands in a triage bucket.
const REPORT_REASONS = ['name', 'avatar', 'behaviour', 'spam', 'other'];

// Spec 10.1: no child personal information is stored server-side before a parent
// consents, and spec 7.1: public boards show a nickname, never a real name.
function childConsented(array $user): bool {
    return !empty($user['consent_at']);
}

// Public cross-family league entry (spec 7.1). Opt-in is per child, and it additionally
// requires recorded consent, so revoking consent or flipping the opt-in takes the child
// off every public board on the very next request.
function childLeagueEligible(array $user): bool {
    return childConsented($user) && (int)($user['league_opt_in'] ?? 0) === 1 && empty($user['league_suspended']);
}

// Nickname filter (spec 7.1 / 10.3). Rejects profanity, contact details, addresses and
// anything URL-like. Returns the accepted nickname, or fails the request outright — a
// filtered nickname is never silently replaced, so a parent always knows what went wrong.
const NICKNAME_BLOCKLIST = [
    'fuck','shit','bitch','cunt','asshole','bastard','dick','pussy','slut','whore','faggot','retard',
    'rape','nazi','kill','murder','suicide',
];
function nicknameIsSafe(string $raw): bool {
    $value = trim(preg_replace('/\s+/u', ' ', $raw) ?? '');
    if ($value === '' || mb_strlen($value) > 24) return false;
    // Control characters and emoji-as-letters: nicknames are plain text only.
    if (preg_match('/[\x00-\x1F\x7F]/u', $value)) return false;
    // Personal information: emails, phone numbers, digits runs, addresses, URLs.
    if (preg_match('/[0-9]/u', $value)) return false;
    if (preg_match('/@|https?:|www\.|\.com|\.net|\.org|\bcom\b/i', $value)) return false;
    // 123 anywhere is a street number, "st/rd/ave" is a street: treat as an address.
    if (preg_match('/\b\d+\s|\b(st|street|rd|road|ave|avenue|blvd|lane|ln|drive|dr)\b/i', $value)) return false;
    if (!preg_match('/^[\p{L}\p{M}][\p{L}\p{M} \'’-]*$/u', $value)) return false;
    // Substring match so "Scunthorpe"-style embedded words are still caught.
    $squashed = mb_strtolower(str_replace([' ', "'", '’', '-'], '', $value));
    foreach (NICKNAME_BLOCKLIST as $word) {
        if (str_contains($squashed, $word)) return false;
    }
    return true;
}

// What other families see for a child. An unset or rejected nickname falls back to a
// deterministic, non-identifying alias so a child is never published under display_name.
function publicNickname(?string $stored, string $displayName, string $childId): string {
    $candidate = trim((string)$stored);
    if ($candidate !== '' && nicknameIsSafe($candidate)) return $candidate;
    $derived = trim((string)$displayName);
    if ($derived !== '' && nicknameIsSafe($derived)) return $derived;
    return 'Hero ' . strtoupper(substr(str_replace('-', '', $childId), 0, 3));
}

// Records a consent grant or revocation. The consents table is append-only, so a parent
// can always show exactly when each child was consented and by whom.
function recordConsent(PDO $pdo, string $childId, string $parentId, bool $granted, string $scope = 'app_data_collection'): void {
    $pdo->prepare('INSERT INTO consents (id,child_id,granted_by,scope,granted) VALUES (?,?,?,?,?)')
        ->execute([uuid(), $childId, $parentId, $scope, $granted ? 1 : 0]);
    $pdo->prepare('UPDATE users SET consent_at=?,consent_by=? WHERE id=?')
        ->execute([$granted ? gmdate('Y-m-d H:i:s') : null, $granted ? $parentId : null, $childId]);
}

// SQL fragment + params that hides blocked users from a public board. Returns [sql, params]
// so callers can splice it into any query without re-deriving the block rule.
function blockExclusion(PDO $pdo, string $viewerId, string $alias = 'u'): array {
    try {
        $check = $pdo->prepare('SELECT blocked_id FROM user_blocks WHERE blocker_id=?');
        $check->execute([$viewerId]);
        $blocked = array_map('strval', $check->fetchAll(PDO::FETCH_COLUMN));
    } catch (PDOException $e) {
        if (in_array((int)($e->errorInfo[1] ?? 0), [1146, 1054], true)) return ['1=1', []];
        throw $e;
    }
    if ($blocked === []) return ['1=1', []];
    $place = implode(',', array_fill(0, count($blocked), '?'));
    return [$alias . '.id NOT IN (' . $place . ')', $blocked];
}


