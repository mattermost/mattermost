// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ChannelStats struct {
	ChannelId   string `json:"channel_id"`
	MemberCount int64  `json:"member_count"`
}

func (o *ChannelStats) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func ChannelStatsFromJson(data io.Reader) *ChannelStats {
	var o *ChannelStats
	json.NewDecoder(data).Decode(&o)
	return o
}
