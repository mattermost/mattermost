// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ChannelMemberLastViewedMaxPerPage bounds a single page of
// ChannelStore.GetMembersWithLastViewedAtSince.
const ChannelMemberLastViewedMaxPerPage = 1000

// ChannelMemberLastViewed is a channel member's read state, as returned by
// ChannelStore.GetMembersWithLastViewedAtSince. It deliberately carries no user
// profile data: callers that need usernames or emails resolve them separately so
// there is a single source of truth for user attributes.
type ChannelMemberLastViewed struct {
	UserId string
	// LastViewedAt is COALESCEd from a nullable column, so 0 means either "never
	// viewed" or "NULL in the database"; the two are not distinguishable here.
	LastViewedAt int64
}
