// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	ACTION_TYPING       = "typing"
	ACTION_POSTED       = "posted"
	ACTION_POST_EDITED  = "post_edited"
	ACTION_POST_DELETED = "post_deleted"
	ACTION_VIEWED       = "viewed"
	ACTION_NEW_USER     = "new_user"
	ACTION_USER_ADDED   = "user_added"
	ACTION_USER_REMOVED = "user_removed"
)

type Message struct {
	TeamId    string            `json:"team_id"`
	ChannelId string            `json:"channel_id"`
	UserId    string            `json:"user_id"`
	Action    string            `json:"action"`
	Props     map[string]string `json:"props"`
}

func (m *Message) Add(key string, value string) {
	m.Props[key] = value
}

func NewMessage(teamId string, channelId string, userId string, action string) *Message {
	return &Message{TeamId: teamId, ChannelId: channelId, UserId: userId, Action: action, Props: make(map[string]string)}
}

func (o *Message) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func MessageFromJson(data io.Reader) *Message {
	decoder := json.NewDecoder(data)
	var o Message
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
