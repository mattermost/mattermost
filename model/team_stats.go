// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type TeamStats struct {
	TeamId            string `json:"team_id"`
	TotalMemberCount  int64  `json:"total_member_count"`
	ActiveMemberCount int64  `json:"active_member_count"`
}

func (o *TeamStats) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func TeamStatsFromJson(data io.Reader) *TeamStats {
	var o *TeamStats
	json.NewDecoder(data).Decode(&o)
	return o
}
