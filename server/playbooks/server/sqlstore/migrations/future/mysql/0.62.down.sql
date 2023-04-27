UPDATE IR_UserInfo
SET DigestNotificationSettingsJSON = JSON_REMOVE(DigestNotificationSettingsJSON, '$.disable_weekly_digest');