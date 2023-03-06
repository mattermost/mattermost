UPDATE IR_UserInfo
SET DigestNotificationSettingsJSON =
    JSON_SET(DigestNotificationSettingsJSON, '$.disable_weekly_digest',
             JSON_EXTRACT(DigestNotificationSettingsJSON, '$.disable_daily_digest'));