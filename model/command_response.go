// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	COMMAND_RESPONSE_TYPE_IN_CHANNEL = "in_channel"
	COMMAND_RESPONSE_TYPE_EPHEMERAL  = "ephemeral"
)

type CommandResponse struct {
	ResponseType string      `json:"response_type"`
	Text         string      `json:"text"`
	GotoLocation string      `json:"goto_location"`
	Attachments  interface{} `json:"attachments"`
}

func (o *CommandResponse) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func CommandResponseFromJson(data io.Reader) *CommandResponse {
	decoder := json.NewDecoder(data)
	var o CommandResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
