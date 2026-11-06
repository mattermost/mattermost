-- Job types must match the singleton job types in server/channels/jobs/concurrency.go.
UPDATE Jobs
SET ConcurrencyKey = Type
WHERE Status IN ('pending', 'in_progress', 'cancel_requested')
    AND ConcurrencyKey IS NULL
    AND Type IN (
        'active_users',
        'autotranslation_recovery',
        'cleanup_desktop_tokens',
        'cleanup_expired_access_tokens',
        'data_retention',
        'delete_expired_posts',
        'elasticsearch_post_aggregation',
        'expiry_notify',
        'export_delete',
        'import_delete',
        'install_plugin_notify_admin',
        'last_accessible_post',
        'ldap_sync',
        'message_export',
        'mobile_session_metadata',
        'notify_expiring_access_tokens',
        'plugins',
        'post_persistent_notifications',
        'product_notices',
        'push_proxy_auth',
        'refresh_materialized_views',
        'trial_notify_admin',
        'upgrade_notify_admin'
    );

UPDATE Jobs
SET Status = 'canceled'
WHERE Id IN (
    SELECT Id FROM (
        SELECT Id, ROW_NUMBER() OVER (PARTITION BY ConcurrencyKey ORDER BY CreateAt DESC, Id DESC) AS Rank
        FROM Jobs
        WHERE Status = 'pending' AND ConcurrencyKey IS NOT NULL
    ) Ranked
    WHERE Rank > 1
);

UPDATE Jobs
SET Status = 'error',
    Data = COALESCE(CASE WHEN jsonb_typeof(Data) = 'object' THEN Data END, '{}'::jsonb)
        || jsonb_build_object('error', 'Job was stopped during upgrade because a more recently active job of the same type was running.')
WHERE Id IN (
    SELECT Id FROM (
        SELECT Id, ROW_NUMBER() OVER (PARTITION BY ConcurrencyKey ORDER BY LastActivityAt DESC, Id DESC) AS Rank
        FROM Jobs
        WHERE Status IN ('in_progress', 'cancel_requested') AND ConcurrencyKey IS NOT NULL
    ) Ranked
    WHERE Rank > 1
);
