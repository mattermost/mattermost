// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ChannelMemberLoadList pairs channel members with IDs of channels
// the user left or was removed from since the cursor.
type ChannelMemberLoadList struct {
	Members []*ChannelMemberLoadItem `json:"members"`
	// RemovedChannelIds: channel IDs the user left or was removed from since the cursor.
	// Sourced from the ChannelMemberHistory table (leave_time > since).
	RemovedChannelIds []string `json:"removed_channel_ids,omitempty"`
}

// ChannelLoadItem is the compact channel representation for the home screen.
// Heavy fields (Header, Purpose, BannerInfo) are omitted — fetched lazily on channel open.
type ChannelLoadItem struct {
	Id                string      `json:"id"`
	CreateAt          int64       `json:"create_at,omitempty"`
	UpdateAt          int64       `json:"update_at,omitempty"`
	DeleteAt          int64       `json:"delete_at,omitempty"`
	TeamId            string      `json:"team_id"`
	Type              ChannelType `json:"type"`
	DisplayName       string      `json:"display_name"`
	Name              string      `json:"name"`
	LastPostAt        int64       `json:"last_post_at"`
	TotalMsgCount     int64       `json:"total_msg_count"`
	CreatorId         string      `json:"creator_id,omitempty"`
	GroupConstrained  *bool       `json:"group_constrained"`
	Shared            *bool       `json:"shared"`
	TotalMsgCountRoot int64       `json:"total_msg_count_root,omitempty"` // CRT only
	LastRootPostAt    int64       `json:"last_root_post_at,omitempty"`    // CRT only
	PolicyEnforced    bool        `json:"policy_enforced,omitempty"`
	// MemberCount is populated only for GM channels so the client can display
	// the correct member badge (GM icon shows membersCount - 1) at cold start,
	// without waiting for the deferred profile fetch to complete.
	MemberCount int64 `json:"member_count,omitempty"`
}

// ChannelMemberLoadItem is the compact channel membership for the home screen.
// NotifyProps is omitted — fetched lazily when the user opens the channel.
// The client derives all badge counts (mentions, unreads) directly from these fields.
type ChannelMemberLoadItem struct {
	ChannelId               string    `json:"channel_id"`
	UserId                  string    `json:"user_id"`
	Roles                   string    `json:"roles"`
	LastViewedAt            int64     `json:"last_viewed_at"`
	NotifyProps             StringMap `json:"notify_props"`
	MsgCount                int64     `json:"msg_count"`
	MentionCount            int64     `json:"mention_count"`
	MentionCountRoot        int64     `json:"mention_count_root"`
	UrgentMentionCount      int64     `json:"urgent_mention_count"`
	MsgCountRoot            int64     `json:"msg_count_root"`
	LastUpdateAt            int64     `json:"last_update_at"`
	SchemeGuest             bool      `json:"scheme_guest"`
	SchemeUser              bool      `json:"scheme_user"`
	SchemeAdmin             bool      `json:"scheme_admin"`
	AutoTranslationDisabled bool      `json:"autotranslation_disabled,omitempty"`
}

// RoleLoadItem is the compact role representation for client-side permission evaluation.
type RoleLoadItem struct {
	Id          string   `json:"id"`
	Name        string   `json:"name"`
	CreateAt    int64    `json:"create_at,omitempty"`
	UpdateAt    int64    `json:"update_at,omitempty"`
	DeleteAt    int64    `json:"delete_at,omitempty"`
	Permissions []string `json:"permissions"`
}
