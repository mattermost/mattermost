// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type CommandWebhook struct {
	Id        string
	CreateAt  int64
	CommandId string
	UserId    string
	ChannelId string
	RootId    string
	ParentId  string
	UseCount  int
}

const (
	COMMAND_WEBHOOK_LIFETIME = 1000 * 60 * 30
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
	if len(o.Id) != 26 {
		return NewLocAppError("CommandWebhook.IsValid", "model.command_hook.id.app_error", nil, "")
	}

	if o.CreateAt == 0 {
		return NewLocAppError("CommandWebhook.IsValid", "model.command_hook.create_at.app_error", nil, "id="+o.Id)
	}

	if len(o.CommandId) != 26 {
		return NewLocAppError("CommandWebhook.IsValid", "model.command_hook.command_id.app_error", nil, "")
	}

	if len(o.UserId) != 26 {
		return NewLocAppError("CommandWebhook.IsValid", "model.command_hook.user_id.app_error", nil, "")
	}

	if len(o.ChannelId) != 26 {
		return NewLocAppError("CommandWebhook.IsValid", "model.command_hook.channel_id.app_error", nil, "")
	}

	if len(o.RootId) != 0 && len(o.RootId) != 26 {
		return NewLocAppError("CommandWebhook.IsValid", "model.command_hook.root_id.app_error", nil, "")
	}

	if len(o.ParentId) != 0 && len(o.ParentId) != 26 {
		return NewLocAppError("CommandWebhook.IsValid", "model.command_hook.parent_id.app_error", nil, "")
	}

	return nil
}
