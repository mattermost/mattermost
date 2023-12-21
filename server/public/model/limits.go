// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type UserLimits struct {
	MaxUsersLimit      int64 `json:"maxUsersLimit"`      // max number of users allowed
	LowerBandUserLimit int64 `json:"lowerBandUserLimit"` // user count for 1st warning
	UpperBandUserLimit int64 `json:"upperBandUserLimit"` // user count for 2nd warning
	ActiveUserCount    int64 `json:"activeUserCount"`    // actual number of active users on server. Active = non deleted
}
