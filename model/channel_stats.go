// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type ChannelStats struct {
	ChannelId       string `json:"channel_id"`
	MemberCount     int64  `json:"member_count"`
	GuestCount      int64  `json:"guest_count"`
	PinnedPostCount int64  `json:"pinnedpost_count"`
}
