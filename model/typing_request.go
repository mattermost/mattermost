// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type TypingRequest struct {
	ChannelId string `json:"channel_id"`
	ParentId  string `json:"parent_id"`
}

func (o *TypingRequest) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func TypingRequestFromJson(data io.Reader) *TypingRequest {
	var o *TypingRequest
	json.NewDecoder(data).Decode(&o)
	return o
}
