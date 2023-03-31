// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// DigestNotificationSettings is a separate type to make it easy to marshal/unmarshal it into JSON
// in the sqlstore. It is set by the user with the `/playbook settings digest [on/off]` slash command.
type DigestNotificationSettings struct {
	DisableDailyDigest  bool `json:"disable_daily_digest"`
	DisableWeeklyDigest bool `json:"disable_weekly_digest"`
}

type UserInfo struct {
	ID                string
	LastDailyTodoDMAt int64
	DigestNotificationSettings
}

type UserInfoStore interface {
	// Get retrieves a UserInfo struct by the user's userID.
	Get(userID string) (UserInfo, error)

	// Upsert inserts (creates) or updates the UserInfo in info.
	Upsert(info UserInfo) error
}

// UserInfoTelemetry defines the methods that the UserInfo store needs from the RudderTelemetry.
// userID is the user initiating the event.
type UserInfoTelemetry interface {
	// ChangeDigestSettings tracks when a user changes one of the digest settings
	ChangeDigestSettings(userID string, old DigestNotificationSettings, new DigestNotificationSettings)
}
