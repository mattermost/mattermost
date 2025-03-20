// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import (
	"archive/zip"
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
)

// Import Data Models

type LineImportData struct {
	Type          string                   `json:"type"`
	Role          *RoleImportData          `json:"role,omitempty"`
	Scheme        *SchemeImportData        `json:"scheme,omitempty"`
	Team          *TeamImportData          `json:"team,omitempty"`
	Channel       *ChannelImportData       `json:"channel,omitempty"`
	User          *UserImportData          `json:"user,omitempty"`
	Bot           *BotImportData           `json:"bot,omitempty"`
	Post          *PostImportData          `json:"post,omitempty"`
	DirectChannel *DirectChannelImportData `json:"direct_channel,omitempty"`
	DirectPost    *DirectPostImportData    `json:"direct_post,omitempty"`
	Emoji         *EmojiImportData         `json:"emoji,omitempty"`
	Version       *int                     `json:"version,omitempty"`
	Info          *VersionInfoImportData   `json:"info,omitempty"`
}

type VersionInfoImportData struct {
	Generator  string          `json:"generator"`
	Version    string          `json:"version"`
	Created    string          `json:"created"`
	Additional json.RawMessage `json:"additional,omitempty"`
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
	DeletedAt   *int64             `json:"deleted_at,omitempty"`
}

type Avatar struct {
	ProfileImage     *string   `json:"profile_image,omitempty"`
	ProfileImageData *zip.File `json:"-"`
}

type UserImportData struct {
	Avatar
	Username           *string `json:"username"`
	Email              *string `json:"email"`
	AuthService        *string `json:"auth_service"`
	AuthData           *string `json:"auth_data,omitempty"`
	Password           *string `json:"password,omitempty"`
	Nickname           *string `json:"nickname"`
	FirstName          *string `json:"first_name"`
	LastName           *string `json:"last_name"`
	Position           *string `json:"position"`
	Roles              *string `json:"roles"`
	Locale             *string `json:"locale"`
	UseMarkdownPreview *string `json:"feature_enabled_markdown_preview,omitempty"`
	UseFormatting      *string `json:"formatting,omitempty"`
	ShowUnreadSection  *string `json:"show_unread_section,omitempty"`
	DeleteAt           *int64  `json:"delete_at,omitempty"`

	SendOnCtrlEnter          *string `json:"send_on_ctrl_enter,omitempty"`
	CodeBlockCtrlEnter       *string `json:"code_block_ctrl_enter,omitempty"`
	ShowJoinLeave            *string `json:"show_join_leave,omitempty"`
	ShowUnreadScrollPosition *string `json:"show_unread_scroll_position,omitempty"`
	SyncDrafts               *string `json:"sync_drafts,omitempty"`
	LimitVisibleDmsGms       *string `json:"limit_visible_dms_gms,omitempty"`
	NameFormat               *string `json:"name_format,omitempty"`

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

	NotifyProps  *UserNotifyPropsImportData `json:"notify_props,omitempty"`
	CustomStatus *model.CustomStatus        `json:"custom_status,omitempty"`
}

type BotImportData struct {
	Avatar
	Username    *string `json:"username"`
	Owner       *string `json:"owner"`
	DisplayName *string `json:"display_name"`
	Description *string `json:"description,omitempty"`
	DeleteAt    *int64  `json:"delete_at,omitempty"`
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
	Name               *string                           `json:"name"`
	Roles              *string                           `json:"roles"`
	NotifyProps        *UserChannelNotifyPropsImportData `json:"notify_props,omitempty"`
	Favorite           *bool                             `json:"favorite,omitempty"`
	MentionCount       *int64                            `json:"mention_count,omitempty"`
	MentionCountRoot   *int64                            `json:"mention_count_root,omitempty"`
	UrgentMentionCount *int64                            `json:"urgend_mention_count,omitempty"`
	MsgCount           *int64                            `json:"msg_count,omitempty"`
	MsgCountRoot       *int64                            `json:"msg_count_root,omitempty"`
	LastViewedAt       *int64                            `json:"last_viewed_at,omitempty"`
}

type DirectChannelMemberImportData struct {
	Username           *string                           `json:"username"`
	NotifyProps        *UserChannelNotifyPropsImportData `json:"notify_props,omitempty"`
	SchemeUser         *bool                             `json:"scheme_user,omitempty"`
	SchemeAdmin        *bool                             `json:"scheme_admin,omitempty"`
	SchemeGuest        *bool                             `json:"scheme_guest,omitempty"`
	MentionCount       *int64                            `json:"mention_count,omitempty"`
	MentionCountRoot   *int64                            `json:"mention_count_root,omitempty"`
	UrgentMentionCount *int64                            `json:"urgend_mention_count,omitempty"`
	MsgCount           *int64                            `json:"msg_count,omitempty"`
	MsgCountRoot       *int64                            `json:"msg_count_root,omitempty"`
	LastViewedAt       *int64                            `json:"last_viewed_at,omitempty"`
}

type UserChannelNotifyPropsImportData struct {
	Desktop                  *string `json:"desktop"`
	Mobile                   *string `json:"mobile"`
	MarkUnread               *string `json:"mark_unread"`
	Email                    *string `json:"email,omitempty"`
	IgnoreChannelMentions    *string `json:"ignore_channel_mentions,omitempty"`
	ChannelAutoFollowThreads *string `json:"channel_auto_follow_threads,omitempty"`
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

	Type     *string                `json:"type"`
	Message  *string                `json:"message"`
	Props    *model.StringInterface `json:"props"`
	CreateAt *int64                 `json:"create_at"`
	EditAt   *int64                 `json:"edit_at"`

	FlaggedBy   *[]string               `json:"flagged_by,omitempty"`
	Reactions   *[]ReactionImportData   `json:"reactions,omitempty"`
	Attachments *[]AttachmentImportData `json:"attachments,omitempty"`
	IsPinned    *bool                   `json:"is_pinned,omitempty"`
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

	ThreadFollowers *[]ThreadFollowerImportData `json:"thread_followers,omitempty"`
}

type DirectChannelImportData struct {
	Members      *[]string                        `json:"members,omitempty"`
	Participants []*DirectChannelMemberImportData `json:"participants,omitempty"`
	FavoritedBy  *[]string                        `json:"favorited_by,omitempty"`
	ShownBy      *[]string                        `json:"shown_by,omitempty"`

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

	FlaggedBy   *[]string               `json:"flagged_by,omitempty"`
	Reactions   *[]ReactionImportData   `json:"reactions"`
	Replies     *[]ReplyImportData      `json:"replies"`
	Attachments *[]AttachmentImportData `json:"attachments"`
	IsPinned    *bool                   `json:"is_pinned,omitempty"`

	ThreadFollowers *[]ThreadFollowerImportData `json:"thread_followers,omitempty"`
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
	Name          *string   `json:"name"`
	DisplayName   *string   `json:"display_name"`
	Description   *string   `json:"description"`
	Permissions   *[]string `json:"permissions"`
	SchemeManaged *bool     `json:"scheme_managed"`
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

type ThreadFollowerImportData struct {
	// User is the username of the follower. It's the general convention
	// for import data types to name it as user for the username.
	User           *string `json:"user"`
	LastViewed     *int64  `json:"last_viewed,omitempty"`
	UnreadMentions *int64  `json:"unread_mentions,omitempty"`
}
