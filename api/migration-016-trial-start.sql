ALTER TABLE family_plans ADD COLUMN IF NOT EXISTS trial_started_at DATETIME NULL;

UPDATE family_plans AS plans
JOIN (
    SELECT family_id, MIN(claimed_at) AS claimed_at
    FROM family_trial_devices
    GROUP BY family_id
) AS claims ON claims.family_id = plans.family_id
SET plans.trial_started_at = claims.claimed_at
WHERE plans.trial_started_at IS NULL
  AND TIMESTAMPDIFF(SECOND, DATE_ADD(claims.claimed_at, INTERVAL 1 MONTH), plans.trial_ends_at) BETWEEN 0 AND 10;
