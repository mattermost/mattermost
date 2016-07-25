// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	STATUS_OFFLINE    = "offline"
	STATUS_AWAY       = "away"
	STATUS_ONLINE     = "online"
	STATUS_CACHE_SIZE = 10000
)

type Status struct {
	UserId         string `json:"user_id"`
	Status         string `json:"status"`
	LastActivityAt int64  `json:"last_activity_at"`
}

func (o *Status) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func StatusFromJson(data io.Reader) *Status {
	decoder := json.NewDecoder(data)
	var o Status
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
