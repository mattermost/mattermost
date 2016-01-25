// Copyright (c) 2016 NAVER Corp. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type WebpushEndpoint struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	UserId   string `json:"user_id"`
	Endpoint string `json:"endpoint"`
}

func (gcm *WebpushEndpoint) ToJson() string {
	b, err := json.Marshal(gcm)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func WebpushEndpointFromJson(data io.Reader) *WebpushEndpoint {
	decoder := json.NewDecoder(data)
	var gcm WebpushEndpoint
	err := decoder.Decode(&gcm)
	if err == nil {
		return &gcm
	} else {
		return nil
	}
}
