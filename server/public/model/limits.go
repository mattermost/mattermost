// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type UserLimits struct {
	MaxUsersLimit     int64 `json:"maxUsersLimit"`     // soft limit for max number of users.
	MaxUsersHardLimit int64 `json:"maxUsersHardLimit"` // hard limit for max number of active users.
	ActiveUserCount   int64 `json:"activeUserCount"`   // actual number of active users on server. Active = non deleted
}
