// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
)

const (
	CHANNEL_ROLE_ADMIN     = "admin"
	CHANNEL_NOTIFY_ALL     = "all"
	CHANNEL_NOTIFY_MENTION = "mention"
	CHANNEL_NOTIFY_NONE    = "none"
	CHANNEL_NOTIFY_QUIET   = "quiet"
)

type ChannelMember struct {
	ChannelId    string `json:"channel_id"`
	UserId       string `json:"user_id"`
	Roles        string `json:"roles"`
	LastViewedAt int64  `json:"last_viewed_at"`
	MsgCount     int64  `json:"msg_count"`
	MentionCount int64  `json:"mention_count"`
	NotifyLevel  string `json:"notify_level"`
	LastUpdateAt int64  `json:"last_update_at"`
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

	if len(o.NotifyLevel) > 20 || !IsChannelNotifyLevelValid(o.NotifyLevel) {
		return NewAppError("ChannelMember.IsValid", "Invalid notify level", "notify_level="+o.NotifyLevel)
	}

	return nil
}

func (o *ChannelMember) PreSave() {
	o.LastUpdateAt = GetMillis()
}

func IsChannelNotifyLevelValid(notifyLevel string) bool {
	return notifyLevel == CHANNEL_NOTIFY_ALL || notifyLevel == CHANNEL_NOTIFY_MENTION || notifyLevel == CHANNEL_NOTIFY_NONE || notifyLevel == CHANNEL_NOTIFY_QUIET
}
