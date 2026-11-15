# Real Life Quest family plan

The primary parent buys access for the whole family. A one-calendar-month trial starts on the family's first authenticated use after billing is enabled, including for existing families. The trial requires no payment method and never charges automatically. After the trial, a parent chooses a subscription in Google Play. The child's phone displays a message to ask their parent to renew.

## Play Console

1. Use the Real Life Quest Android app with package `com.reallifequest.app`. Complete the merchant payments setup.
2. Under Monetize with Play → Products → Subscriptions, create the subscription product `family_access`.
3. Add two auto-renewing base plans. Use ID `monthly` for **USD 2.99 per month** and ID `yearly` for **USD 12.99 per year**. Review local prices and activate both. The app displays prices supplied by Play.
4. Upload a signed AAB to an internal testing track and add the tester's Google account to license testing. Install the internal test build through Google Play. Test purchase, cancellation, expiry and restore using test payment methods.
5. Enable the Google Play Android Developer API and grant a dedicated service account access to this app in Play Console, including the order/subscription permissions required to read and acknowledge subscriptions. Put the service account JSON in Hostinger's private folder. Use its absolute server path in the config below.

## Hostinger

1. Back up the database and API files. Import `api/migration-013-family-plan.sql` in phpMyAdmin.
2. Upload these files to `public_html/api`: `index.php`, `quest_routes.php`, `mission_common.php`, `push_notifications.php`, `family_plan.php`, `family_routines.php` and `family_routine_routes.php`.
3. Replace the existing private `send-push.php` cron script with `scripts/send-push.php`. Keep the current every-minute schedule.
4. Merge these entries into the existing server `config.php` array:

```php
'recurring_missions_enabled' => true,
'billing' => [
    'enabled' => false,
    'service_account_file' => '/absolute/private/play-service-account.json',
],
```

5. Enable billing on the test backend first. Check a new family, a second child phone, an expired trial, a license-test purchase, restore, and the recurring worker output. Then activate billing on the live backend when the matching app is available on Play. The server gate applies to older app versions too.

Recurring missions use the timezone selected from the parent device at setup. The next scheduled run appears under Assign missions. The worker skips missed occurrences after downtime and creates one current task when it resumes. Subscription renewals and cancellations are reconciled by the worker. Each run checks up to ten subscriptions due for refresh.

Sources: [Play Billing integration](https://developer.android.com/google/play/billing/integrate), [subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions).
