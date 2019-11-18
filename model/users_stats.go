// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type UsersStats struct {
	TotalUsersCount int64 `json:"total_users_count"`
}

func (o *UsersStats) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func UsersStatsFromJson(data io.Reader) *UsersStats {
	var o *UsersStats
	json.NewDecoder(data).Decode(&o)
	return o
}
