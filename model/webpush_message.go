// Copyright (c) 2016 NAVER Corp. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
)

type WebpushMessage struct {
	Id             string `json:"id"`
	Title          string `json:"title"`
	Message        string `json:"message"`
	ToUserId       string `json:"to_user_id"`
	Url            string `json:"url"`
	RegistrationId string `json:"registration_id"`
}

func (msg *WebpushMessage) ToJson() string {
	b, err := json.Marshal(msg)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func WebpushMessageListToJson(l []*WebpushMessage) string {
	b, err := json.Marshal(l)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}
