package model

import (
	"encoding/json"
	"io"
)

type UsersStats struct {
	TotalUserCount  int64  `json:"total_user_count"`
}

func (o *UsersStats) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UsersStatsFromJson(data io.Reader) *UsersStats {
	decoder := json.NewDecoder(data)
	var o UsersStats
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
