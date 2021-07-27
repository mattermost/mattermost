// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
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
)

type ChannelUnread struct {
	TeamId           string    `json:"team_id"`
	ChannelId        string    `json:"channel_id"`
	MsgCount         int64     `json:"msg_count"`
	MentionCount     int64     `json:"mention_count"`
	MentionCountRoot int64     `json:"mention_count_root"`
	MsgCountRoot     int64     `json:"msg_count_root"`
	NotifyProps      StringMap `json:"-"`
}

type ChannelUnreadAt struct {
	TeamId           string    `json:"team_id"`
	UserId           string    `json:"user_id"`
	ChannelId        string    `json:"channel_id"`
	MsgCount         int64     `json:"msg_count"`
	MentionCount     int64     `json:"mention_count"`
	MentionCountRoot int64     `json:"mention_count_root"`
	MsgCountRoot     int64     `json:"msg_count_root"`
	LastViewedAt     int64     `json:"last_viewed_at"`
	NotifyProps      StringMap `json:"-"`
}

type ChannelMember struct {
	ChannelId        string    `json:"channel_id"`
	UserId           string    `json:"user_id"`
	Roles            string    `json:"roles"`
	LastViewedAt     int64     `json:"last_viewed_at"`
	MsgCount         int64     `json:"msg_count"`
	MentionCount     int64     `json:"mention_count"`
	MentionCountRoot int64     `json:"mention_count_root"`
	MsgCountRoot     int64     `json:"msg_count_root"`
	NotifyProps      StringMap `json:"notify_props"`
	LastUpdateAt     int64     `json:"last_update_at"`
	SchemeGuest      bool      `json:"scheme_guest"`
	SchemeUser       bool      `json:"scheme_user"`
	SchemeAdmin      bool      `json:"scheme_admin"`
	ExplicitRoles    string    `json:"explicit_roles"`
}

type ChannelMembers []ChannelMember

type ChannelMemberForExport struct {
	ChannelMember
	ChannelName string
	Username    string
}

func (o *ChannelMembers) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func (o *ChannelUnread) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func (o *ChannelUnreadAt) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func (o *ChannelMember) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
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
