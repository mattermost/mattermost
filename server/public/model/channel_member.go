// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"
)

const (
	ChannelNotifyDefault             = "default"
	ChannelNotifyAll                 = "all"
	ChannelNotifyMention             = "mention"
	ChannelNotifyNone                = "none"
	ChannelMarkUnreadAll             = "all"
	ChannelMarkUnreadMention         = "mention"
	IgnoreChannelMentionsDefault     = "default"
	IgnoreChannelMentionsOff         = "off"
	IgnoreChannelMentionsOn          = "on"
	IgnoreChannelMentionsNotifyProp  = "ignore_channel_mentions"
	ChannelAutoFollowThreadsOff      = "off"
	ChannelAutoFollowThreadsOn       = "on"
	ChannelAutoFollowThreads         = "channel_auto_follow_threads"
	ChannelMemberNotifyPropsMaxRunes = 800000
)

type ChannelUnread struct {
	TeamId             string    `json:"team_id"`
	ChannelId          string    `json:"channel_id"`
	MsgCount           int64     `json:"msg_count"`
	MentionCount       int64     `json:"mention_count"`
	MentionCountRoot   int64     `json:"mention_count_root"`
	UrgentMentionCount int64     `json:"urgent_mention_count"`
	MsgCountRoot       int64     `json:"msg_count_root"`
	NotifyProps        StringMap `json:"-"`
}

type ChannelUnreadAt struct {
	TeamId             string    `json:"team_id"`
	UserId             string    `json:"user_id"`
	ChannelId          string    `json:"channel_id"`
	MsgCount           int64     `json:"msg_count"`
	MentionCount       int64     `json:"mention_count"`
	MentionCountRoot   int64     `json:"mention_count_root"`
	UrgentMentionCount int64     `json:"urgent_mention_count"`
	MsgCountRoot       int64     `json:"msg_count_root"`
	LastViewedAt       int64     `json:"last_viewed_at"`
	NotifyProps        StringMap `json:"-"`
}

type ChannelMember struct {
	ChannelId          string    `json:"channel_id"`
	UserId             string    `json:"user_id"`
	Roles              string    `json:"roles"`
	LastViewedAt       int64     `json:"last_viewed_at"`
	MsgCount           int64     `json:"msg_count"`
	MentionCount       int64     `json:"mention_count"`
	MentionCountRoot   int64     `json:"mention_count_root"`
	UrgentMentionCount int64     `json:"urgent_mention_count"`
	MsgCountRoot       int64     `json:"msg_count_root"`
	NotifyProps        StringMap `json:"notify_props"`
	LastUpdateAt       int64     `json:"last_update_at"`
	SchemeGuest        bool      `json:"scheme_guest"`
	SchemeUser         bool      `json:"scheme_user"`
	SchemeAdmin        bool      `json:"scheme_admin"`
	ExplicitRoles      string    `json:"explicit_roles"`
}

func (o *ChannelMember) Auditable() map[string]any {
	return map[string]any{
		"channel_id":           o.ChannelId,
		"user_id":              o.UserId,
		"roles":                o.Roles,
		"last_viewed_at":       o.LastViewedAt,
		"msg_count":            o.MsgCount,
		"mention_count":        o.MentionCount,
		"mention_count_root":   o.MentionCountRoot,
		"urgent_mention_count": o.UrgentMentionCount,
		"msg_count_root":       o.MsgCountRoot,
		"notify_props":         o.NotifyProps,
		"last_update_at":       o.LastUpdateAt,
		"scheme_guest":         o.SchemeGuest,
		"scheme_user":          o.SchemeUser,
		"scheme_admin":         o.SchemeAdmin,
		"explicit_roles":       o.ExplicitRoles,
	}
}

// ChannelMemberWithTeamData contains ChannelMember appended with extra team information
// as well.
type ChannelMemberWithTeamData struct {
	ChannelMember
	TeamDisplayName string `json:"team_display_name"`
	TeamName        string `json:"team_name"`
	TeamUpdateAt    int64  `json:"team_update_at"`
}

type ChannelMembers []ChannelMember

type ChannelMembersWithTeamData []ChannelMemberWithTeamData

type ChannelMemberForExport struct {
	ChannelMember
	ChannelName string
	Username    string
}

type ChannelMemberCursor struct {
	Page          int // If page is -1, then FromChannelID is used as a cursor.
	PerPage       int
	FromChannelID string
}

func (o *ChannelMember) IsValid() *AppError {
	if !IsValidId(o.ChannelId) {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if appErr := IsChannelMemberNotifyPropsValid(o.NotifyProps, false); appErr != nil {
		return appErr
	}

	if len(o.Roles) > UserRolesMaxLength {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.roles_limit.app_error",
			map[string]any{"Limit": UserRolesMaxLength}, "", http.StatusBadRequest)
	}

	return nil
}

func IsChannelMemberNotifyPropsValid(notifyProps map[string]string, allowMissingFields bool) *AppError {
	if notifyLevel, ok := notifyProps[DesktopNotifyProp]; ok || !allowMissingFields {
		if len(notifyLevel) > 20 || !IsChannelNotifyLevelValid(notifyLevel) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.notify_level.app_error", nil, "notify_level="+notifyLevel, http.StatusBadRequest)
		}
	}

	if markUnreadLevel, ok := notifyProps[MarkUnreadNotifyProp]; ok || !allowMissingFields {
		if len(markUnreadLevel) > 20 || !IsChannelMarkUnreadLevelValid(markUnreadLevel) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.unread_level.app_error", nil, "mark_unread_level="+markUnreadLevel, http.StatusBadRequest)
		}
	}

	if pushLevel, ok := notifyProps[PushNotifyProp]; ok {
		if len(pushLevel) > 20 || !IsChannelNotifyLevelValid(pushLevel) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.push_level.app_error", nil, "push_notification_level="+pushLevel, http.StatusBadRequest)
		}
	}

	if sendEmail, ok := notifyProps[EmailNotifyProp]; ok {
		if len(sendEmail) > 20 || !IsSendEmailValid(sendEmail) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.email_value.app_error", nil, "push_notification_level="+sendEmail, http.StatusBadRequest)
		}
	}

	if ignoreChannelMentions, ok := notifyProps[IgnoreChannelMentionsNotifyProp]; ok {
		if len(ignoreChannelMentions) > 40 || !IsIgnoreChannelMentionsValid(ignoreChannelMentions) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.ignore_channel_mentions_value.app_error", nil, "ignore_channel_mentions="+ignoreChannelMentions, http.StatusBadRequest)
		}
	}

	if channelAutoFollowThreads, ok := notifyProps[ChannelAutoFollowThreads]; ok {
		if len(channelAutoFollowThreads) > 3 || !IsChannelAutoFollowThreadsValid(channelAutoFollowThreads) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.channel_auto_follow_threads_value.app_error", nil, "channel_auto_follow_threads="+channelAutoFollowThreads, http.StatusBadRequest)
		}
	}

	jsonStringNotifyProps := string(ToJSON(notifyProps))
	if utf8.RuneCountInString(jsonStringNotifyProps) > ChannelMemberNotifyPropsMaxRunes {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.notify_props.app_error", nil, fmt.Sprint("length=", utf8.RuneCountInString(jsonStringNotifyProps)), http.StatusBadRequest)
	}

	return nil
}

func (o *ChannelMember) PreSave() {
	o.LastUpdateAt = GetMillis()
}

func (o *ChannelMember) PreUpdate() {
	o.LastUpdateAt = GetMillis()
}

func (o *ChannelMember) GetRoles() []string {
	return strings.Fields(o.Roles)
}

func (o *ChannelMember) SetChannelMuted(muted bool) {
	if o.IsChannelMuted() {
		o.NotifyProps[MarkUnreadNotifyProp] = ChannelMarkUnreadAll
	} else {
		o.NotifyProps[MarkUnreadNotifyProp] = ChannelMarkUnreadMention
	}
}

func (o *ChannelMember) IsChannelMuted() bool {
	return o.NotifyProps[MarkUnreadNotifyProp] == ChannelMarkUnreadMention
}

func IsChannelNotifyLevelValid(notifyLevel string) bool {
	return notifyLevel == ChannelNotifyDefault ||
		notifyLevel == ChannelNotifyAll ||
		notifyLevel == ChannelNotifyMention ||
		notifyLevel == ChannelNotifyNone
}

func IsChannelMarkUnreadLevelValid(markUnreadLevel string) bool {
	return markUnreadLevel == ChannelMarkUnreadAll || markUnreadLevel == ChannelMarkUnreadMention
}

func IsSendEmailValid(sendEmail string) bool {
	return sendEmail == ChannelNotifyDefault || sendEmail == "true" || sendEmail == "false"
}

func IsIgnoreChannelMentionsValid(ignoreChannelMentions string) bool {
	return ignoreChannelMentions == IgnoreChannelMentionsOn || ignoreChannelMentions == IgnoreChannelMentionsOff || ignoreChannelMentions == IgnoreChannelMentionsDefault
}

func IsChannelAutoFollowThreadsValid(channelAutoFollowThreads string) bool {
	return channelAutoFollowThreads == ChannelAutoFollowThreadsOn || channelAutoFollowThreads == ChannelAutoFollowThreadsOff
}

func GetDefaultChannelNotifyProps() StringMap {
	return StringMap{
		DesktopNotifyProp:               ChannelNotifyDefault,
		MarkUnreadNotifyProp:            ChannelMarkUnreadAll,
		PushNotifyProp:                  ChannelNotifyDefault,
		EmailNotifyProp:                 ChannelNotifyDefault,
		IgnoreChannelMentionsNotifyProp: IgnoreChannelMentionsDefault,
		ChannelAutoFollowThreads:        ChannelAutoFollowThreadsOff,
	}
}

type ChannelMemberIdentifier struct {
	ChannelId string `json:"channel_id"`
	UserId    string `json:"user_id"`
}
