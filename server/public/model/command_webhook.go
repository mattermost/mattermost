// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
)

type CommandWebhook struct {
	Id        string
	CreateAt  int64
	CommandId string
	UserId    string
	ChannelId string
	RootId    string
	UseCount  int
}

const (
	CommandWebhookLifetime = 1000 * 60 * 30
)

func (o *CommandWebhook) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
	}
}

func (o *CommandWebhook) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("CommandWebhook.IsValid", "model.command_hook.id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("CommandWebhook.IsValid", "model.command_hook.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidId(o.CommandId) {
		return NewAppError("CommandWebhook.IsValid", "model.command_hook.command_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.UserId) {
		return NewAppError("CommandWebhook.IsValid", "model.command_hook.user_id.app_error", nil, "", http.StatusBadRequest)
	}

	if !IsValidId(o.ChannelId) {
		return NewAppError("CommandWebhook.IsValid", "model.command_hook.channel_id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.RootId != "" && !IsValidId(o.RootId) {
		return NewAppError("CommandWebhook.IsValid", "model.command_hook.root_id.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
