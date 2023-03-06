UPDATE IR_UserInfo
SET DigestNotificationSettingsJSON = (DigestNotificationSettingsJSON::jsonb - 'DisableWeeklyDigest')::json;