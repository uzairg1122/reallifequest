<?php
if (($parts[0] ?? '') === 'recurring-missions') {
    if ($user['role'] !== 'parent') fail('Only parents can manage recurring missions.',403);
    if ($method === 'GET' && count($parts) === 1) {
        $query = $pdo->prepare('SELECT id,child_id,task_json,frequency,timezone,next_at FROM recurring_missions WHERE family_id=? ORDER BY next_at');
        $query->execute([$family['id']]);
        $rules = array_map(static function (array $row): array {
            $data = json_decode($row['task_json'], true);
            return ['id'=>$row['id'],'childId'=>$row['child_id'],'title'=>$data['task']['title'],'frequency'=>$row['frequency'],
                'time'=>$data['time'],'timezone'=>$row['timezone'],'nextAt'=>str_replace(' ','T',$row['next_at']).'Z'];
        }, $query->fetchAll());
        jsonResponse(['rules'=>$rules]);
    }
    if ($method === 'POST' && count($parts) === 1) {
        $input = body();
        $child = (string)($input['childId'] ?? '');
        $frequency = $input['frequency'] ?? '';
        $time = $input['time'] ?? '';
        $timezone = $input['timezone'] ?? '';
        $weekday = (int)($input['weekday'] ?? 0);
        if (!in_array($frequency,['daily','weekdays','weekends','weekly'],true) || !is_string($time)
            || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$time) || !is_string($timezone)
            || ($timezone !== 'UTC' && !in_array($timezone,DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC),true))
            || ($frequency === 'weekly' && ($weekday < 1 || $weekday > 7))) fail('Choose a valid schedule.',422);
        $task = $input['task'] ?? null;
        if (!is_array($task)) fail('Choose a mission.',422);
        taskValues($task);
        missionDeadlineMinutes($task);
        $task['days'] = 'Once';
        $next = nextMissionTime($frequency,$timezone,$time,$weekday);
        $data = json_encode(['task'=>$task,'time'=>$time,'weekday'=>$weekday,'createdBy'=>$user['id']],JSON_THROW_ON_ERROR);
        $query = $pdo->prepare("INSERT INTO recurring_missions (id,family_id,child_id,task_json,frequency,timezone,next_at)
            SELECT ?,family_id,user_id,?,?,?,? FROM family_members WHERE family_id=? AND user_id=? AND role='child'");
        $query->execute([uuid(),$data,$frequency,$timezone,$next,$family['id'],$child]);
        if (!$query->rowCount()) fail('That child is not in your family.',404);
        jsonResponse(['ok'=>true],201);
    }
    if ($method === 'POST' && count($parts) === 3 && $parts[2] === 'stop') {
        $pdo->prepare('DELETE FROM recurring_missions WHERE id=? AND family_id=?')->execute([$parts[1],$family['id']]);
        jsonResponse(['ok'=>true]);
    }
    fail('Method not allowed.',405);
}

if ($parts === ['reports','insights'] && $method === 'GET') {
    if ($user['role'] !== 'parent') fail('Only parents can view family insights.',403);
    $range = $_GET['range'] ?? 'weekly';
    $child = (string)($_GET['child'] ?? '');
    $today = new DateTimeImmutable('today',new DateTimeZone('UTC'));
    $start = match ($range) {
        'weekly' => $today->modify('monday this week'),
        'monthly' => $today->modify('first day of this month'),
        'yearly' => $today->setDate((int)$today->format('Y'),1,1),
        default => fail('Choose a valid report period.',422),
    };
    $end = $today->modify('+1 day')->format('Y-m-d');
    $dates = [$family['id'],$start->format('Y-m-d'),$end,$child,$child];
    $approved = $pdo->prepare("SELECT DATE(s.reviewed_at) day,COUNT(*) approved
        FROM submissions s JOIN tasks t ON t.id=s.task_id
        WHERE t.family_id=? AND s.reviewed_at>=? AND s.reviewed_at<? AND s.status='approved'
        AND (?='' OR s.child_id=?) GROUP BY DATE(s.reviewed_at)");
    $approved->execute($dates);
    $earned = $pdo->prepare("SELECT yyyymmdd day,SUM(xp) xp,SUM(coins) coins FROM xp_events
        WHERE family_id=? AND yyyymmdd>=? AND yyyymmdd<? AND source='task_approval'
        AND (?='' OR child_id=?) GROUP BY yyyymmdd");
    $earned->execute($dates);
    jsonResponse(['start'=>$start->format('Y-m-d'),'approved'=>$approved->fetchAll(),'earned'=>$earned->fetchAll()]);
}

if ($parts === ['reports','weekly'] && $method === 'GET') {
    if ($user['role'] !== 'parent') fail('Only parents can view the family report.',403);
    $offset = ($_GET['week'] ?? '') === 'previous' ? '-7 days' : 'now';
    $week = isoWeekKey($offset);
    $query = $pdo->prepare("SELECT u.id,u.display_name,
        COALESCE(e.xp,0) xp, COALESCE(e.coins,0) coins, COALESCE(s.approved,0) approved
        FROM family_members m JOIN users u ON u.id=m.user_id
        LEFT JOIN (SELECT child_id,SUM(xp) xp,SUM(coins) coins FROM xp_events
            WHERE family_id=? AND iso_week=? AND source='task_approval' GROUP BY child_id) e ON e.child_id=u.id
        LEFT JOIN (SELECT s.child_id,COUNT(*) approved FROM submissions s JOIN tasks t ON t.id=s.task_id
            WHERE t.family_id=? AND s.status='approved' AND YEARWEEK(s.reviewed_at,3)=? GROUP BY s.child_id) s ON s.child_id=u.id
        WHERE m.family_id=? AND m.role='child' ORDER BY u.display_name");
    $query->execute([$family['id'],$week,$family['id'],str_replace('-W','',$week),$family['id']]);
    jsonResponse(['week'=>$week,'children'=>$query->fetchAll()]);
}
