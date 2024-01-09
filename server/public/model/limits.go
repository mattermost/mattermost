// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type UserLimits struct {
	MaxUsersLimit   int64 `json:"maxUsersLimit"`   // max number of users allowed
	ActiveUserCount int64 `json:"activeUserCount"` // actual number of active users on server. Active = non deleted
}
