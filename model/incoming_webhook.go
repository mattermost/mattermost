// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"encoding/json"
	"io"
)

const (
	DEFAULT_WEBHOOK_USERNAME = "webhook"
	DEFAULT_WEBHOOK_ICON     = "/static/images/webhook_icon.jpg"
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

type IncomingWebhookRequest struct {
	Text        string          `json:"text"`
	Username    string          `json:"username"`
	IconURL     string          `json:"icon_url"`
	ChannelName string          `json:"channel"`
	Props       StringInterface `json:"props"`
	Attachments interface{}     `json:"attachments"`
	Type        string          `json:"type"`
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

func (o *IncomingWebhook) IsValid(T goi18n.TranslateFunc) *AppError {

	if len(o.Id) != 26 {
		return NewAppError("IncomingWebhook.IsValid", T("Invalid Id"), "")
	}

	if o.CreateAt == 0 {
		return NewAppError("IncomingWebhook.IsValid", T("Create at must be a valid time"), "id="+o.Id)
	}

	if o.UpdateAt == 0 {
		return NewAppError("IncomingWebhook.IsValid", T("Update at must be a valid time"), "id="+o.Id)
	}

	if len(o.UserId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", T("Invalid user id"), "")
	}

	if len(o.ChannelId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", T("Invalid channel id"), "")
	}

	if len(o.TeamId) != 26 {
		return NewAppError("IncomingWebhook.IsValid", T("Invalid channel id"), "")
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

func IncomingWebhookRequestFromJson(data io.Reader) *IncomingWebhookRequest {
	decoder := json.NewDecoder(data)
	var o IncomingWebhookRequest
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
