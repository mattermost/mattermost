// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type TeamStats struct {
	TeamId      string `json:"team_id"`
	MemberCount int64  `json:"member_count"`
}

func (o *TeamStats) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func TeamStatsFromJson(data io.Reader) *TeamStats {
	decoder := json.NewDecoder(data)
	var o TeamStats
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
