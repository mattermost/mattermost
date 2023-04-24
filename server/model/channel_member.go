// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strings"
)

const (
	ChannelNotifyDefault            = "default"
	ChannelNotifyAll                = "all"
	ChannelNotifyMention            = "mention"
	ChannelNotifyNone               = "none"
	ChannelMarkUnreadAll            = "all"
	ChannelMarkUnreadMention        = "mention"
	IgnoreChannelMentionsDefault    = "default"
	IgnoreChannelMentionsOff        = "off"
	IgnoreChannelMentionsOn         = "on"
	IgnoreChannelMentionsNotifyProp = "ignore_channel_mentions"
	ChannelAutoFollowThreads        = "channel_auto_follow_threads"
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

func (o *ChannelMember) Auditable() map[string]interface{} {
	return map[string]interface{}{
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

// The following are some GraphQL methods necessary to return the
// data in float64 type. The spec doesn't support 64 bit integers,
// so we have to pass the data in float64. The _ at the end is
// a hack to keep the attribute name same in GraphQL schema.

func (o *ChannelMember) LastViewedAt_() float64 {
	return float64(o.LastViewedAt)
}

func (o *ChannelMember) MsgCount_() float64 {
	return float64(o.MsgCount)
}

func (o *ChannelMember) MentionCount_() float64 {
	return float64(o.MentionCount)
}

func (o *ChannelMember) MentionCountRoot_() float64 {
	return float64(o.MentionCountRoot)
}

func (o *ChannelMember) UrgentMentionCount_() float64 {
	return float64(o.UrgentMentionCount)
}

func (o *ChannelMember) MsgCountRoot_() float64 {
	return float64(o.MsgCountRoot)
}

func (o *ChannelMember) LastUpdateAt_() float64 {
	return float64(o.LastUpdateAt)
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

func (o *ChannelMember) IsValid() *AppError {
	if !IsValidId(o.ChannelId) {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	notifyLevel := o.NotifyProps[DesktopNotifyProp]
	if len(notifyLevel) > 20 || !IsChannelNotifyLevelValid(notifyLevel) {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.notify_level.app_error", nil, "notify_level="+notifyLevel, http.StatusBadRequest)
	}

	markUnreadLevel := o.NotifyProps[MarkUnreadNotifyProp]
	if len(markUnreadLevel) > 20 || !IsChannelMarkUnreadLevelValid(markUnreadLevel) {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.unread_level.app_error", nil, "mark_unread_level="+markUnreadLevel, http.StatusBadRequest)
	}

	if pushLevel, ok := o.NotifyProps[PushNotifyProp]; ok {
		if len(pushLevel) > 20 || !IsChannelNotifyLevelValid(pushLevel) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.push_level.app_error", nil, "push_notification_level="+pushLevel, http.StatusBadRequest)
		}
	}

	if sendEmail, ok := o.NotifyProps[EmailNotifyProp]; ok {
		if len(sendEmail) > 20 || !IsSendEmailValid(sendEmail) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.email_value.app_error", nil, "push_notification_level="+sendEmail, http.StatusBadRequest)
		}
	}

	if ignoreChannelMentions, ok := o.NotifyProps[IgnoreChannelMentionsNotifyProp]; ok {
		if len(ignoreChannelMentions) > 40 || !IsIgnoreChannelMentionsValid(ignoreChannelMentions) {
			return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.ignore_channel_mentions_value.app_error", nil, "ignore_channel_mentions="+ignoreChannelMentions, http.StatusBadRequest)
		}
	}

	if len(o.Roles) > UserRolesMaxLength {
		return NewAppError("ChannelMember.IsValid", "model.channel_member.is_valid.roles_limit.app_error",
			map[string]any{"Limit": UserRolesMaxLength}, "", http.StatusBadRequest)
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

func GetDefaultChannelNotifyProps() StringMap {
	return StringMap{
		DesktopNotifyProp:               ChannelNotifyDefault,
		MarkUnreadNotifyProp:            ChannelMarkUnreadAll,
		PushNotifyProp:                  ChannelNotifyDefault,
		EmailNotifyProp:                 ChannelNotifyDefault,
		IgnoreChannelMentionsNotifyProp: IgnoreChannelMentionsDefault,
	}
}
