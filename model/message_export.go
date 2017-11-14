// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type MessageExport struct {
	ChannelId          *string
	ChannelDisplayName *string

	UserId    *string
	UserEmail *string

	PostId       *string
	PostCreateAt *int64
	PostMessage  *string
	PostType     *string
	PostFileIds  StringArray

	// only non-null if PostType is system_add_to_channel
	AddedUserEmail *string

	// only non-null if PostType is system_remove_from_channel
	RemovedUserEmail *string
}
