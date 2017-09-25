// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type MessageExport struct {
	TeamId              *string	`json:"team_id"`
	TeamCreateAt        *int64	`json:"team_create_at"`
	TeamUpdateAt        *int64	`json:"team_update_at"`
	TeamDeleteAt        *int64	`json:"team_delete_at"`
	TeamDisplayName     *string	`json:"team_display_name"`
	TeamName            *string	`json:"team_name"`
	TeamDescription     *string	`json:"team_description"`
	TeamAllowOpenInvite	*bool	`json:"team_type"`

	ChannelId			*string	`json:"channel_id"`
	ChannelCreateAt		*int64	`json:"channel_create_at"`
	ChannelUpdateAt		*int64	`json:"channel_update_at"`
	ChannelDeleteAt		*int64	`json:"channel_delete_at"`
	ChannelDisplayName	*string	`json:"channel_display_name"`
	ChannelName			*string	`json:"channel_name"`
	ChannelHeader		*string	`json:"channel_header"`
	ChannelPurpose		*string	`json:"channel_purpose"`
	ChannelLastPostAt	*int64	`json:"channel_last_post_at"`

	UserId			*string    `json:"user_id"`
	UserCreateAt	*int64     `json:"user_create_at,omitempty"`
	UserUpdateAt	*int64     `json:"user_update_at,omitempty"`
	UserDeleteAt	*int64     `json:"user_delete_at"`
	UserUsername	*string    `json:"user_username"`
	UserEmail		*string    `json:"user_email"`
	UserNickname	*string    `json:"user_nickname"`
	UserFirstName	*string    `json:"user_first_name"`
	UserLastName	*string    `json:"user_last_name"`

	PostId			*string			`json:"post_id"`
	PostCreateAt	*int64			`json:"post_create_at"`
	PostUpdateAt	*int64			`json:"post_update_at"`
	PostEditAt		*int64			`json:"post_edit_at"`
	PostDeleteAt	*int64			`json:"post_delete_at"`
	PostRootId		*string			`json:"post_root_id"`
	PostParentId 	*string			`json:"post_parent_id"`
	PostOriginalId 	*string			`json:"post_original_id"`
	PostMessage		*string			`json:"post_message"`
	PostType		*string			`json:"post_type"`
	PostProps		StringInterface	`json:"post_props"`
	PostHashtags	*string			`json:"post_hashtags"`
	PostFileIds		StringArray		`json:"post_file_ids,omitempty"`

	// TODO: because of the structure of the query in sql_compliance_store, we only get a result whenever a user sends
	// 		 a message, which makes ChannelMember unnecessary, because the LastViewed at time is implicitly the time at
	// 		 which the message was sent... but I don't want a record for every single message viewed event, do I?
	ChannelMemberLastViewedAt	*int64	`json:"channel_member_last_viewed_at"`
	ChannelMemberLastUpdateAt	*int64	`json:"channel_member_last_update_at"`
}
