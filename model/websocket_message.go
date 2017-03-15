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
	WEBSOCKET_EVENT_CHANNEL_CREATED    = "channel_created"
	WEBSOCKET_EVENT_DIRECT_ADDED       = "direct_added"
	WEBSOCKET_EVENT_GROUP_ADDED        = "group_added"
	WEBSOCKET_EVENT_NEW_USER           = "new_user"
	WEBSOCKET_EVENT_LEAVE_TEAM         = "leave_team"
	WEBSOCKET_EVENT_UPDATE_TEAM        = "update_team"
	WEBSOCKET_EVENT_USER_ADDED         = "user_added"
	WEBSOCKET_EVENT_USER_UPDATED       = "user_updated"
	WEBSOCKET_EVENT_USER_REMOVED       = "user_removed"
	WEBSOCKET_EVENT_PREFERENCE_CHANGED = "preference_changed"
	WEBSOCKET_EVENT_EPHEMERAL_MESSAGE  = "ephemeral_message"
	WEBSOCKET_EVENT_STATUS_CHANGE      = "status_change"
	WEBSOCKET_EVENT_HELLO              = "hello"
	WEBSOCKET_EVENT_WEBRTC             = "webrtc"
	WEBSOCKET_AUTHENTICATION_CHALLENGE = "authentication_challenge"
	WEBSOCKET_EVENT_REACTION_ADDED     = "reaction_added"
	WEBSOCKET_EVENT_REACTION_REMOVED   = "reaction_removed"
)

type WebSocketMessage interface {
	ToJson() string
	IsValid() bool
	EventType() string
	SetSequence(seq uint64)
}

type WebsocketBroadcast struct {
	OmitUsers map[string]bool `json:"omit_users"` // broadcast is omitted for users listed here
	UserId    string          `json:"user_id"`    // broadcast only occurs for this user
	ChannelId string          `json:"channel_id"` // broadcast only occurs for users in this channel
	TeamId    string          `json:"team_id"`    // broadcast only occurs for users in this team
}

type WebSocketEvent struct {
	Event          string                 `json:"event"`
	Data           map[string]interface{} `json:"data"`
	Broadcast      *WebsocketBroadcast    `json:"broadcast"`
	Sequence       uint64                 `json:"seq"`
	PreComputeJson []byte                 `json:"-"`
}

func (m *WebSocketEvent) Add(key string, value interface{}) {
	m.Data[key] = value
}

func NewWebSocketEvent(event, teamId, channelId, userId string, omitUsers map[string]bool) *WebSocketEvent {
	return &WebSocketEvent{Event: event, Data: make(map[string]interface{}),
		Broadcast: &WebsocketBroadcast{TeamId: teamId, ChannelId: channelId, UserId: userId, OmitUsers: omitUsers}}
}

func (o *WebSocketEvent) IsValid() bool {
	return o.Event != ""
}

func (o *WebSocketEvent) EventType() string {
	return o.Event
}

func (o *WebSocketEvent) SetSequence(seq uint64) {
	o.Sequence = seq
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
	Status         string                 `json:"status"`
	SeqReply       int64                  `json:"seq_reply,omitempty"`
	Data           map[string]interface{} `json:"data,omitempty"`
	Error          *AppError              `json:"error,omitempty"`
	PreComputeJson []byte                 `json:"-"`
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

func (o *WebSocketResponse) EventType() string {
	return ""
}

func (o *WebSocketResponse) SetSequence(seq uint64) {
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
