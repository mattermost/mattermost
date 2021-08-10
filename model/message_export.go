// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type MessageExport struct {
	TeamId          *string
	TeamName        *string
	TeamDisplayName *string

	ChannelId          *string
	ChannelName        *string
	ChannelDisplayName *string
	ChannelType        *string

	UserId    *string
	UserEmail *string
	Username  *string
	IsBot     bool

	PostId         *string
	PostCreateAt   *int64
	PostUpdateAt   *int64
	PostDeleteAt   *int64
	PostMessage    *string
	PostType       *string
	PostRootId     *string
	PostProps      *string
	PostOriginalId *string
	PostFileIds    StringArray
}

type MessageExportCursor struct {
	LastPostUpdateAt int64
	LastPostId       string
}
