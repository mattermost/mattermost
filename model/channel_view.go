// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ChannelView struct {
	ChannelId     string `json:"channel_id"`
	PrevChannelId string `json:"prev_channel_id"`
}

func (o *ChannelView) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ChannelViewFromJson(data io.Reader) *ChannelView {
	decoder := json.NewDecoder(data)
	var o ChannelView
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
