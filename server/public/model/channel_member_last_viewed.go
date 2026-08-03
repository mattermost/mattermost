// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const ChannelMemberLastViewedMaxPerPage = 1000

type ChannelMemberLastViewed struct {
	UserId       string
	LastViewedAt int64
}
