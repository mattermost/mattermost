// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

// WebSocketRequest represents a request made to the server through a websocket.
type WebSocketRequest struct {
	// Client-provided fields
	Seq    int64                  `json:"seq"`    // A counter which is incremented for every request made.
	Action string                 `json:"action"` // The action to perform for a request. For example: get_statuses, user_typing.
	Data   map[string]interface{} `json:"data"`   // The metadata for an action.

	// Server-provided fields
	Session Session            `json:"-"`
	T       i18n.TranslateFunc `json:"-"`
	Locale  string             `json:"-"`
}

func (o *WebSocketRequest) Clone() (*WebSocketRequest, error) {
	buf, err := json.Marshal(o)
	if err != nil {
		return nil, err
	}
	var ret WebSocketRequest
	err = json.Unmarshal(buf, &ret)
	if err != nil {
		return nil, err
	}
	return &ret, nil
}
