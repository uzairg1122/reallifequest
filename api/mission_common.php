<?php
declare(strict_types=1);

function uuid(): string {
    $data = random_bytes(16); $data[6] = chr((ord($data[6]) & 0x0f) | 0x40); $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
function notify(PDO $pdo, string $userId, string $type, string $title, string $message): void {
    $id=uuid();$stmt = $pdo->prepare('INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,?,?,?)'); $stmt->execute([$id, $userId, $type, $title, $message]);
    queuePush($pdo,$id,$userId);
}
