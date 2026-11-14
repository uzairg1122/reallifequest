<?php
declare(strict_types=1);

function nextMissionTime(string $frequency, string $timezone, string $time, int $weekday, ?DateTimeImmutable $now = null): string {
    $zone = new DateTimeZone($timezone);
    $local = ($now ?? new DateTimeImmutable())->setTimezone($zone);
    [$hour,$minute] = array_map('intval', explode(':', $time));
    for ($offset=0; $offset<=7; $offset++) {
        $candidate = $local->modify("+$offset days")->setTime($hour,$minute);
        $day = (int)$candidate->format('N');
        $matches = match ($frequency) {
            'daily' => true,
            'weekdays' => $day <= 5,
            'weekends' => $day >= 6,
            'weekly' => $day === $weekday,
        };
        if ($matches && $candidate > $local) return $candidate->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }
    throw new RuntimeException('Could not calculate next mission time.');
}

function assignDueMissions(PDO $pdo, bool $billingEnabled): int {
    $access = $billingEnabled
        ? 'JOIN family_plans p ON p.family_id=r.family_id AND (p.trial_ends_at>UTC_TIMESTAMP() OR p.paid_until>UTC_TIMESTAMP())'
        : '';
    $due = $pdo->query("SELECT r.id FROM recurring_missions r $access WHERE r.next_at<=UTC_TIMESTAMP() ORDER BY r.next_at LIMIT 100")->fetchAll(PDO::FETCH_COLUMN);
    $lock = $pdo->prepare("SELECT r.*,f.parent_id FROM recurring_missions r JOIN families f ON f.id=r.family_id $access WHERE r.id=? AND r.next_at<=UTC_TIMESTAMP() FOR UPDATE");
    $count = 0;
    foreach ($due as $id) {
        $pdo->beginTransaction();
        try {
            $lock->execute([$id]);
            $rule = $lock->fetch();
            $lock->closeCursor();
            if ($rule) {
                $template = json_decode($rule['task_json'], true, 512, JSON_THROW_ON_ERROR);
                insertMission($pdo,$rule['family_id'],$rule['parent_id'],$rule['child_id'],$template['task']);
                notify($pdo,$rule['child_id'],'task_assigned','A new mission awaits',$template['task']['title']);
                $next = nextMissionTime($rule['frequency'],$rule['timezone'],$template['time'],$template['weekday']);
                $pdo->prepare('UPDATE recurring_missions SET next_at=? WHERE id=?')->execute([$next,$id]);
                $count++;
            }
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }
    return $count;
}
