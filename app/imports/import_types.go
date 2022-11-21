// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import (
	"archive/zip"

	"github.com/mattermost/mattermost-server/v6/model"
)

// Import Data Models

type LineImportData struct {
	Type          string                   `json:"type"`
	Scheme        *SchemeImportData        `json:"scheme,omitempty"`
	Team          *TeamImportData          `json:"team,omitempty"`
	Channel       *ChannelImportData       `json:"channel,omitempty"`
	User          *UserImportData          `json:"user,omitempty"`
	Post          *PostImportData          `json:"post,omitempty"`
	DirectChannel *DirectChannelImportData `json:"direct_channel,omitempty"`
	DirectPost    *DirectPostImportData    `json:"direct_post,omitempty"`
	Emoji         *EmojiImportData         `json:"emoji,omitempty"`
	TopicalThread *TopicalThreadImportData `json:"topical_thread,omitempty"`
	Version       *int                     `json:"version,omitempty"`
}

type TeamImportData struct {
	Name            *string `json:"name"`
	DisplayName     *string `json:"display_name"`
	Type            *string `json:"type"`
	Description     *string `json:"description,omitempty"`
	AllowOpenInvite *bool   `json:"allow_open_invite,omitempty"`
	Scheme          *string `json:"scheme,omitempty"`
}

type ChannelImportData struct {
	Team        *string            `json:"team"`
	Name        *string            `json:"name"`
	DisplayName *string            `json:"display_name"`
	Type        *model.ChannelType `json:"type"`
	Header      *string            `json:"header,omitempty"`
	Purpose     *string            `json:"purpose,omitempty"`
	Scheme      *string            `json:"scheme,omitempty"`
}

type UserImportData struct {
	ProfileImage       *string   `json:"profile_image,omitempty"`
	ProfileImageData   *zip.File `json:"-"`
	Username           *string   `json:"username"`
	Email              *string   `json:"email"`
	AuthService        *string   `json:"auth_service"`
	AuthData           *string   `json:"auth_data,omitempty"`
	Password           *string   `json:"password,omitempty"`
	Nickname           *string   `json:"nickname"`
	FirstName          *string   `json:"first_name"`
	LastName           *string   `json:"last_name"`
	Position           *string   `json:"position"`
	Roles              *string   `json:"roles"`
	Locale             *string   `json:"locale"`
	UseMarkdownPreview *string   `json:"feature_enabled_markdown_preview,omitempty"`
	UseFormatting      *string   `json:"formatting,omitempty"`
	ShowUnreadSection  *string   `json:"show_unread_section,omitempty"`
	DeleteAt           *int64    `json:"delete_at,omitempty"`

	Teams *[]UserTeamImportData `json:"teams,omitempty"`

	Theme               *string `json:"theme,omitempty"`
	UseMilitaryTime     *string `json:"military_time,omitempty"`
	CollapsePreviews    *string `json:"link_previews,omitempty"`
	MessageDisplay      *string `json:"message_display,omitempty"`
	CollapseConsecutive *string `json:"collapse_consecutive_messages,omitempty"`
	ColorizeUsernames   *string `json:"colorize_usernames,omitempty"`
	ChannelDisplayMode  *string `json:"channel_display_mode,omitempty"`
	TutorialStep        *string `json:"tutorial_step,omitempty"`
	EmailInterval       *string `json:"email_interval,omitempty"`

	NotifyProps *UserNotifyPropsImportData `json:"notify_props,omitempty"`
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
	Theme    *string                  `json:"theme,omitempty"`
	Channels *[]UserChannelImportData `json:"channels,omitempty"`
}

type UserChannelImportData struct {
	Name        *string                           `json:"name"`
	Roles       *string                           `json:"roles"`
	NotifyProps *UserChannelNotifyPropsImportData `json:"notify_props,omitempty"`
	Favorite    *bool                             `json:"favorite,omitempty"`
}

type UserChannelNotifyPropsImportData struct {
	Desktop    *string `json:"desktop"`
	Mobile     *string `json:"mobile"`
	MarkUnread *string `json:"mark_unread"`
}

type EmojiImportData struct {
	Name  *string   `json:"name"`
	Image *string   `json:"image"`
	Data  *zip.File `json:"-"`
}

type ReactionImportData struct {
	User      *string `json:"user"`
	CreateAt  *int64  `json:"create_at"`
	EmojiName *string `json:"emoji_name"`
}

type ReplyImportData struct {
	User *string `json:"user"`

	Type     *string `json:"type"`
	Message  *string `json:"message"`
	CreateAt *int64  `json:"create_at"`
	EditAt   *int64  `json:"edit_at"`

	FlaggedBy   *[]string               `json:"flagged_by,omitempty"`
	Reactions   *[]ReactionImportData   `json:"reactions,omitempty"`
	Attachments *[]AttachmentImportData `json:"attachments,omitempty"`
}

type PostImportData struct {
	Team    *string `json:"team"`
	Channel *string `json:"channel"`
	User    *string `json:"user"`

	Type     *string                `json:"type"`
	Message  *string                `json:"message"`
	Props    *model.StringInterface `json:"props"`
	CreateAt *int64                 `json:"create_at"`
	EditAt   *int64                 `json:"edit_at"`

	FlaggedBy   *[]string               `json:"flagged_by,omitempty"`
	Reactions   *[]ReactionImportData   `json:"reactions,omitempty"`
	Replies     *[]ReplyImportData      `json:"replies,omitempty"`
	Attachments *[]AttachmentImportData `json:"attachments,omitempty"`
	IsPinned    *bool                   `json:"is_pinned,omitempty"`
}

type DirectChannelImportData struct {
	Members     *[]string `json:"members"`
	FavoritedBy *[]string `json:"favorited_by"`

	Header *string `json:"header"`
}

type DirectPostImportData struct {
	ChannelMembers *[]string `json:"channel_members"`
	User           *string   `json:"user"`

	Type     *string                `json:"type"`
	Message  *string                `json:"message"`
	Props    *model.StringInterface `json:"props"`
	CreateAt *int64                 `json:"create_at"`
	EditAt   *int64                 `json:"edit_at"`

	FlaggedBy   *[]string               `json:"flagged_by"`
	Reactions   *[]ReactionImportData   `json:"reactions"`
	Replies     *[]ReplyImportData      `json:"replies"`
	Attachments *[]AttachmentImportData `json:"attachments"`
	IsPinned    *bool                   `json:"is_pinned,omitempty"`
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
	DefaultTeamGuestRole    *RoleImportData `json:"default_team_guest_role"`
	DefaultChannelGuestRole *RoleImportData `json:"default_channel_guest_role"`
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
	Path *string   `json:"path"`
	Data *zip.File `json:"-"`
}

type ComparablePreference struct {
	Category string
	Name     string
}

type TopicalThreadImportData struct {
	PostImportData *PostImportData `json:"post_import_data"`
	CollectionType *string         `json:"collection_type"`
	CollectionId   *string         `json:"collection_id"`
	TopicType      *string         `json:"topic_type"`
	TopicId        *string         `json:"topic_id"`
}
