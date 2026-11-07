UPDATE IR_UserInfo
SET DigestNotificationSettingsJSON = (DigestNotificationSettingsJSON::jsonb ||
	jsonb_build_object('disable_weekly_digest', (DigestNotificationSettingsJSON::json->>'disable_daily_digest')::boolean))::json;