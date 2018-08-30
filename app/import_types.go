// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import "github.com/mattermost/mattermost-server/model"

// Import Data Models

type LineImportData struct {
	Type          string                   `json:"type"`
	Scheme        *SchemeImportData        `json:"scheme"`
	Team          *TeamImportData          `json:"team"`
	Channel       *ChannelImportData       `json:"channel"`
	User          *UserImportData          `json:"user"`
	Post          *PostImportData          `json:"post"`
	DirectChannel *DirectChannelImportData `json:"direct_channel"`
	DirectPost    *DirectPostImportData    `json:"direct_post"`
	Emoji         *EmojiImportData         `json:"emoji"`
	Version       *int                     `json:"version"`
}

type TeamImportData struct {
	Name            *string `json:"name"`
	DisplayName     *string `json:"display_name"`
	Type            *string `json:"type"`
	Description     *string `json:"description"`
	AllowOpenInvite *bool   `json:"allow_open_invite"`
	Scheme          *string `json:"scheme"`
}

type ChannelImportData struct {
	Team        *string `json:"team"`
	Name        *string `json:"name"`
	DisplayName *string `json:"display_name"`
	Type        *string `json:"type"`
	Header      *string `json:"header"`
	Purpose     *string `json:"purpose"`
	Scheme      *string `json:"scheme"`
}

type UserImportData struct {
	ProfileImage *string `json:"profile_image"`
	Username     *string `json:"username"`
	Email        *string `json:"email"`
	AuthService  *string `json:"auth_service"`
	AuthData     *string `json:"auth_data"`
	Password     *string `json:"password"`
	Nickname     *string `json:"nickname"`
	FirstName    *string `json:"first_name"`
	LastName     *string `json:"last_name"`
	Position     *string `json:"position"`
	Roles        *string `json:"roles"`
	Locale       *string `json:"locale"`

	Teams *[]UserTeamImportData `json:"teams"`

	Theme              *string `json:"theme"`
	UseMilitaryTime    *string `json:"military_time"`
	CollapsePreviews   *string `json:"link_previews"`
	MessageDisplay     *string `json:"message_display"`
	ChannelDisplayMode *string `json:"channel_display_mode"`
	TutorialStep       *string `json:"tutorial_step"`

	NotifyProps *UserNotifyPropsImportData `json:"notify_props"`
}

type UserNotifyPropsImportData struct {
	Desktop      *string `json:"desktop"`
	DesktopSound *string `json:"desktop_sound"`

	Email *string `json:"email"`

	Mobile           *string `json:"mobile"`
	MobilePushStatus *string `json:"mobile_push_status"`

	ChannelTrigger  *string `json:"channel"`
	CommentsTrigger *string `json:"comments"`
	MentionKeys     *string `json:"mention_keys"`
}

type UserTeamImportData struct {
	Name     *string                  `json:"name"`
	Roles    *string                  `json:"roles"`
	Channels *[]UserChannelImportData `json:"channels"`
}

type UserChannelImportData struct {
	Name        *string                           `json:"name"`
	Roles       *string                           `json:"roles"`
	NotifyProps *UserChannelNotifyPropsImportData `json:"notify_props"`
	Favorite    *bool                             `json:"favorite"`
}

type UserChannelNotifyPropsImportData struct {
	Desktop    *string `json:"desktop"`
	Mobile     *string `json:"mobile"`
	MarkUnread *string `json:"mark_unread"`
}

type EmojiImportData struct {
	Name  *string `json:"name"`
	Image *string `json:"image"`
}

type ReactionImportData struct {
	User      *string `json:"user"`
	CreateAt  *int64  `json:"create_at"`
	EmojiName *string `json:"emoji_name"`
}

type ReplyImportData struct {
	User *string `json:"user"`

	Message  *string `json:"message"`
	CreateAt *int64  `json:"create_at"`

	FlaggedBy   *[]string               `json:"flagged_by"`
	Reactions   *[]ReactionImportData   `json:"reactions"`
	Attachments *[]AttachmentImportData `json:"attachments"`
}

type PostImportData struct {
	Team    *string `json:"team"`
	Channel *string `json:"channel"`
	User    *string `json:"user"`

	Message  *string `json:"message"`
	CreateAt *int64  `json:"create_at"`

	FlaggedBy   *[]string               `json:"flagged_by"`
	Reactions   *[]ReactionImportData   `json:"reactions"`
	Replies     *[]ReplyImportData      `json:"replies"`
	Attachments *[]AttachmentImportData `json:"attachments"`
}

type DirectChannelImportData struct {
	Members     *[]string `json:"members"`
	FavoritedBy *[]string `json:"favorited_by"`

	Header *string `json:"header"`
}

type DirectPostImportData struct {
	ChannelMembers *[]string `json:"channel_members"`
	User           *string   `json:"user"`

	Message  *string `json:"message"`
	CreateAt *int64  `json:"create_at"`

	FlaggedBy   *[]string               `json:"flagged_by"`
	Reactions   *[]ReactionImportData   `json:"reactions"`
	Replies     *[]ReplyImportData      `json:"replies"`
	Attachments *[]AttachmentImportData `json:"attachments"`
}

type SchemeImportData struct {
	Name                    *string         `json:"name"`
	DisplayName             *string         `json:"display_name"`
	Description             *string         `json:"description"`
	Scope                   *string         `json:"scope"`
	DefaultTeamAdminRole    *RoleImportData `json:"default_team_admin_role"`
	DefaultTeamUserRole     *RoleImportData `json:"default_team_user_role"`
	DefaultChannelAdminRole *RoleImportData `json:"default_channel_admin_role"`
	DefaultChannelUserRole  *RoleImportData `json:"default_channel_user_role"`
}

type RoleImportData struct {
	Name        *string   `json:"name"`
	DisplayName *string   `json:"display_name"`
	Description *string   `json:"description"`
	Permissions *[]string `json:"permissions"`
}

type LineImportWorkerData struct {
	LineImportData
	LineNumber int
}

type LineImportWorkerError struct {
	Error      *model.AppError
	LineNumber int
}

type AttachmentImportData struct {
	Path *string `json:"path"`
}
