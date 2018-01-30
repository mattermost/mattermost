// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type Audit struct {
	Id        string `json:"id"`
	CreateAt  int64  `json:"create_at"`
	UserId    string `json:"user_id"`
	Action    string `json:"action"`
	ExtraInfo string `json:"extra_info"`
	IpAddress string `json:"ip_address"`
	SessionId string `json:"session_id"`
}

func (o *Audit) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func AuditFromJson(data io.Reader) *Audit {
	var o *Audit
	json.NewDecoder(data).Decode(&o)
	return o
}
