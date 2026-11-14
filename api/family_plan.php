<?php
declare(strict_types=1);

const FAMILY_SUBSCRIPTION = 'family_access';
const FAMILY_PACKAGE = 'com.reallifequest.app';

function familyPlan(PDO $pdo, string $id): array {
    $query = $pdo->prepare('SELECT *, trial_ends_at>UTC_TIMESTAMP() trial_active, paid_until>UTC_TIMESTAMP() paid_active FROM family_plans WHERE family_id=?');
    $query->execute([$id]);
    return $query->fetch() ?: [
        'trial_ends_at'=>null,'trial_active'=>false,'paid_active'=>false,
        'purchase_token'=>null,'checked_at'=>null,
    ];
}

function claimFamilyTrial(PDO $pdo, string $familyId, string $deviceHash): bool {
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT id FROM families WHERE id=? FOR UPDATE');
        $lock->execute([$familyId]);
        if (!$lock->fetchColumn()) throw new RuntimeException('Family no longer exists.');
        if (familyPlan($pdo,$familyId)['trial_ends_at'] !== null) {
            $pdo->commit();
            return true;
        }
        $claim = $pdo->prepare('INSERT IGNORE INTO family_trial_devices (device_hash,family_id) VALUES (?,?)');
        $claim->execute([$deviceHash,$familyId]);
        $granted = $claim->rowCount() === 1;
        if ($granted) {
            $pdo->prepare('INSERT INTO family_plans (family_id,trial_ends_at) VALUES (?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 MONTH))')->execute([$familyId]);
        }
        $pdo->commit();
        return $granted;
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function playPublisher(array $settings, string $path, ?array $body = null): array {
    $token = serviceAccountAccessToken($settings, 'https://www.googleapis.com/auth/androidpublisher');
    $ch = curl_init('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'.FAMILY_PACKAGE.$path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $token", 'Content-Type: application/json'],
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode((object)$body));
    $data = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if (in_array($status,[404,410],true)) return [];
    if ($status !== 200 && $status !== 204) throw new RuntimeException('Play Developer API returned HTTP '.$status);
    return json_decode((string)$data, true) ?: [];
}

function verifyFamilyPurchase(PDO $pdo, array $settings, string $id, string $token, bool $restore = false): void {
    $encoded = rawurlencode($token);
    $purchase = playPublisher($settings, '/purchases/subscriptionsv2/tokens/'.$encoded);
    $expected = hash('sha256', $id);
    $owner = $purchase['externalAccountIdentifiers']['obfuscatedExternalAccountId'] ?? '';
    if ($purchase && !hash_equals($expected, $owner)) {
        if ($restore) fail('This purchase belongs to a different family.', 403);
        throw new RuntimeException('Unexpected subscription owner.');
    }
    $expires = 0;
    if (in_array($purchase['subscriptionState'] ?? '', ['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'], true)) {
        foreach ($purchase['lineItems'] ?? [] as $item) {
            if (($item['productId'] ?? '') === FAMILY_SUBSCRIPTION) $expires = max($expires, strtotime($item['expiryTime'] ?? '') ?: 0);
        }
    }
    if ($restore && $expires <= time()) fail('Google Play has no active subscription for this purchase yet.', 409);
    if ($expires > time() && ($purchase['acknowledgementState'] ?? '') === 'ACKNOWLEDGEMENT_STATE_PENDING') {
        playPublisher($settings, '/purchases/subscriptions/'.FAMILY_SUBSCRIPTION.'/tokens/'.$encoded.':acknowledge', []);
    }
    $until = $expires > time() ? gmdate('Y-m-d H:i:s', $expires) : null;
    if ($restore) {
        $pdo->prepare('INSERT INTO family_plans (family_id,trial_ends_at,purchase_token,paid_until,checked_at)
            VALUES (?,UTC_TIMESTAMP(),?,?,UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE purchase_token=VALUES(purchase_token),paid_until=VALUES(paid_until),checked_at=UTC_TIMESTAMP()')
            ->execute([$id,$token,$until]);
    } else {
        $pdo->prepare('UPDATE family_plans SET paid_until=?,checked_at=UTC_TIMESTAMP() WHERE family_id=? AND purchase_token=?')->execute([$until,$id,$token]);
    }
}

function publicFamilyPlan(array $plan, array $family, array $user): array {
    return [
        'active' => (bool)($plan['trial_active'] || $plan['paid_active']),
        'trialEndsAt' => $plan['trial_ends_at'] === null ? null : str_replace(' ', 'T', $plan['trial_ends_at']).'Z',
        'paid' => (bool)$plan['paid_active'],
        'canPurchase' => $user['id'] === $family['parent_id'],
        'accountId' => hash('sha256', $family['id']),
    ];
}

function requireInviteFamilyAccess(PDO $pdo, array $invite): void {
    if (empty($GLOBALS['config']['billing']['enabled'])) return;
    $plan = familyPlan($pdo,$invite['family_id']);
    if (!$plan['trial_active'] && !$plan['paid_active']) fail('Ask the primary parent to renew the family plan before joining.',402);
}
