// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	WEBSOCKET_EVENT_TYPING             = "typing"
	WEBSOCKET_EVENT_POSTED             = "posted"
	WEBSOCKET_EVENT_POST_EDITED        = "post_edited"
	WEBSOCKET_EVENT_POST_DELETED       = "post_deleted"
	WEBSOCKET_EVENT_CHANNEL_DELETED    = "channel_deleted"
	WEBSOCKET_EVENT_CHANNEL_VIEWED     = "channel_viewed"
	WEBSOCKET_EVENT_DIRECT_ADDED       = "direct_added"
	WEBSOCKET_EVENT_NEW_USER           = "new_user"
	WEBSOCKET_EVENT_LEAVE_TEAM         = "leave_team"
	WEBSOCKET_EVENT_USER_ADDED         = "user_added"
	WEBSOCKET_EVENT_USER_REMOVED       = "user_removed"
	WEBSOCKET_EVENT_PREFERENCE_CHANGED = "preference_changed"
	WEBSOCKET_EVENT_EPHEMERAL_MESSAGE  = "ephemeral_message"
	WEBSOCKET_EVENT_STATUS_CHANGE      = "status_change"
)

type WebSocketMessage interface {
	ToJson() string
	IsValid() bool
}

type WebSocketEvent struct {
	TeamId    string                 `json:"team_id"`
	ChannelId string                 `json:"channel_id"`
	UserId    string                 `json:"user_id"`
	Event     string                 `json:"event"`
	Data      map[string]interface{} `json:"data"`
}

func (m *WebSocketEvent) Add(key string, value interface{}) {
	m.Data[key] = value
}

func NewWebSocketEvent(teamId string, channelId string, userId string, event string) *WebSocketEvent {
	return &WebSocketEvent{TeamId: teamId, ChannelId: channelId, UserId: userId, Event: event, Data: make(map[string]interface{})}
}

func (o *WebSocketEvent) IsValid() bool {
	return o.Event != ""
}

func (o *WebSocketEvent) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func WebSocketEventFromJson(data io.Reader) *WebSocketEvent {
	decoder := json.NewDecoder(data)
	var o WebSocketEvent
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

type WebSocketResponse struct {
	Status   string                 `json:"status"`
	SeqReply int64                  `json:"seq_reply,omitempty"`
	Data     map[string]interface{} `json:"data,omitempty"`
	Error    *AppError              `json:"error,omitempty"`
}

func (m *WebSocketResponse) Add(key string, value interface{}) {
	m.Data[key] = value
}

func NewWebSocketResponse(status string, seqReply int64, data map[string]interface{}) *WebSocketResponse {
	return &WebSocketResponse{Status: status, SeqReply: seqReply, Data: data}
}

func NewWebSocketError(seqReply int64, err *AppError) *WebSocketResponse {
	return &WebSocketResponse{Status: STATUS_FAIL, SeqReply: seqReply, Error: err}
}

func (o *WebSocketResponse) IsValid() bool {
	return o.Status != ""
}

func (o *WebSocketResponse) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func WebSocketResponseFromJson(data io.Reader) *WebSocketResponse {
	decoder := json.NewDecoder(data)
	var o WebSocketResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
