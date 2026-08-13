// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type ServerLimits struct {
	MaxUsersLimit           int64 `json:"maxUsersLimit"`           // soft limit for max number of users.
	MaxUsersHardLimit       int64 `json:"maxUsersHardLimit"`       // hard limit for max number of active users.
	ActiveUserCount         int64 `json:"activeUserCount"`         // actual number of active users on server. Active = non deleted
	SingleChannelGuestCount int64 `json:"singleChannelGuestCount"` // count of guests in exactly one channel
	SingleChannelGuestLimit int64 `json:"singleChannelGuestLimit"` // limit equals licensed seats (1:1 ratio)
	PostHistoryLimit        int64 `json:"postHistoryLimit"`        // the actual message history limit value (0 if no limits)
	LastAccessiblePostTime  int64 `json:"lastAccessiblePostTime"`  // timestamp of the last accessible post (0 if no limits reached)
}
