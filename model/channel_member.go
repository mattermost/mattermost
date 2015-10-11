// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
)

const (
	CHANNEL_ROLE_ADMIN          = "admin"
	CHANNEL_NOTIFY_DEFAULT      = "default"
	CHANNEL_NOTIFY_ALL          = "all"
	CHANNEL_NOTIFY_MENTION      = "mention"
	CHANNEL_NOTIFY_NONE         = "none"
	CHANNEL_MARK_UNREAD_ALL     = "all"
	CHANNEL_MARK_UNREAD_MENTION = "mention"
)

type ChannelMember struct {
	ChannelId    string    `json:"channel_id"`
	UserId       string    `json:"user_id"`
	Roles        string    `json:"roles"`
	LastViewedAt int64     `json:"last_viewed_at"`
	MsgCount     int64     `json:"msg_count"`
	MentionCount int64     `json:"mention_count"`
	NotifyProps  StringMap `json:"notify_props"`
	LastUpdateAt int64     `json:"last_update_at"`
}

func (o *ChannelMember) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelMemberFromJson(data io.Reader) *ChannelMember {
	decoder := json.NewDecoder(data)
	var o ChannelMember
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *ChannelMember) IsValid() *AppError {

	if len(o.ChannelId) != 26 {
		return NewAppError("ChannelMember.IsValid", "Invalid channel id", "")
	}

	if len(o.UserId) != 26 {
		return NewAppError("ChannelMember.IsValid", "Invalid user id", "")
	}

	for _, role := range strings.Split(o.Roles, " ") {
		if !(role == "" || role == CHANNEL_ROLE_ADMIN) {
			return NewAppError("ChannelMember.IsValid", "Invalid role", "role="+role)
		}
	}

	notifyLevel := o.NotifyProps["desktop"]
	if len(notifyLevel) > 20 || !IsChannelNotifyLevelValid(notifyLevel) {
		return NewAppError("ChannelMember.IsValid", "Invalid notify level", "notify_level="+notifyLevel)
	}

	markUnreadLevel := o.NotifyProps["mark_unread"]
	if len(markUnreadLevel) > 20 || !IsChannelMarkUnreadLevelValid(markUnreadLevel) {
		return NewAppError("ChannelMember.IsValid", "Invalid mark unread level", "mark_unread_level="+markUnreadLevel)
	}

	return nil
}

func (o *ChannelMember) PreSave() {
	o.LastUpdateAt = GetMillis()
}

func (o *ChannelMember) PreUpdate() {
	o.LastUpdateAt = GetMillis()
}

func IsChannelNotifyLevelValid(notifyLevel string) bool {
	return notifyLevel == CHANNEL_NOTIFY_DEFAULT ||
		notifyLevel == CHANNEL_NOTIFY_ALL ||
		notifyLevel == CHANNEL_NOTIFY_MENTION ||
		notifyLevel == CHANNEL_NOTIFY_NONE
}

func IsChannelMarkUnreadLevelValid(markUnreadLevel string) bool {
	return markUnreadLevel == CHANNEL_MARK_UNREAD_ALL || markUnreadLevel == CHANNEL_MARK_UNREAD_MENTION
}

func GetDefaultChannelNotifyProps() StringMap {
	return StringMap{
		"desktop":     CHANNEL_NOTIFY_DEFAULT,
		"mark_unread": CHANNEL_MARK_UNREAD_ALL,
	}
}
