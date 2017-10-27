// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type MessageExport struct {
	TeamId              *string
	TeamCreateAt        *int64
	TeamUpdateAt        *int64
	TeamDeleteAt        *int64
	TeamDisplayName     *string
	TeamName            *string
	TeamDescription     *string
	TeamAllowOpenInvite *bool

	ChannelId          *string
	ChannelCreateAt    *int64
	ChannelUpdateAt    *int64
	ChannelDeleteAt    *int64
	ChannelDisplayName *string
	ChannelName        *string
	ChannelHeader      *string
	ChannelPurpose     *string
	ChannelLastPostAt  *int64

	UserId        *string
	UserCreateAt  *int64
	UserUpdateAt  *int64
	UserDeleteAt  *int64
	UserUsername  *string
	UserEmail     *string
	UserNickname  *string
	UserFirstName *string
	UserLastName  *string

	PostId         *string
	PostCreateAt   *int64
	PostUpdateAt   *int64
	PostEditAt     *int64
	PostDeleteAt   *int64
	PostRootId     *string
	PostParentId   *string
	PostOriginalId *string
	PostMessage    *string
	PostType       *string
	PostProps      StringInterface
	PostHashtags   *string
	PostFileIds    StringArray

	// only non-null if PostType is system_add_to_channel
	AddedUserEmail *string

	// only non-null if PostType is system_remove_from_channel
	RemovedUserEmail *string
}
