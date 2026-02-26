// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type ServerLimits struct {
	MaxUsersLimit     int64 `json:"maxUsersLimit"`     // soft limit for max number of users.
	MaxUsersHardLimit int64 `json:"maxUsersHardLimit"` // hard limit for max number of active users.
	ActiveUserCount   int64 `json:"activeUserCount"`   // actual number of active users on server. Active = non deleted
	// Post history limit fields
	PostHistoryLimit       int64 `json:"postHistoryLimit"`       // The actual message history limit value (0 if no limits)
	LastAccessiblePostTime int64 `json:"lastAccessiblePostTime"` // Timestamp of the last accessible post (0 if no limits reached)
}
