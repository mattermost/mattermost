// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"

	goi18n "github.com/mattermost/go-i18n/i18n"
)

// WebSocketRequest represents a request made to the server through a websocket.
type WebSocketRequest struct {
	// Client-provided fields
	Seq    int64                  `json:"seq"`    // A counter which is incremented for every request made.
	Action string                 `json:"action"` // The action to perform for a request. For example: get_statuses, user_typing.
	Data   map[string]interface{} `json:"data"`   // The metadata for an action.

	// Server-provided fields
	Session Session              `json:"-"`
	T       goi18n.TranslateFunc `json:"-"`
	Locale  string               `json:"-"`
}

func (o *WebSocketRequest) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func WebSocketRequestFromJson(data io.Reader) *WebSocketRequest {
	var o *WebSocketRequest
	json.NewDecoder(data).Decode(&o)
	return o
}
