// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type IncomingWebhook struct {
	Id        string `json:"id"`
	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
	DeleteAt  int64  `json:"delete_at"`
	UserId    string `json:"user_id"`
	ChannelId string `json:"channel_id"`
	TeamId    string `json:"team_id"`
}

func (o *IncomingWebhook) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func IncomingWebhookFromJson(data io.Reader) *IncomingWebhook {
	decoder := json.NewDecoder(data)
	var o IncomingWebhook
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func IncomingWebhookListToJson(l []*IncomingWebhook) string {
	b, err := json.Marshal(l)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func IncomingWebhookListFromJson(data io.Reader) []*IncomingWebhook {
	decoder := json.NewDecoder(data)
	var o []*IncomingWebhook
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}

func (o *IncomingWebhook) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("IncomingWebhook.IsValid", "Invalid Id", "")
	}

	if o.CreateAt == 0 {
		return NewAppError("IncomingWebhook.IsValid", "Create at must be a valid time", "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewAppError("IncomingWebhook.IsValid", "Update at must be a valid time", "id="+o.Id)
	}

	if len(o.UserId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", "Invalid user id", "")
	}

	if len(o.ChannelId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", "Invalid channel id", "")
	}

	if len(o.TeamId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", "Invalid channel id", "")
	}

	return nil
}

func (o *IncomingWebhook) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt
}

func (o *IncomingWebhook) PreUpdate() {
	o.UpdateAt = GetMillis()
}
