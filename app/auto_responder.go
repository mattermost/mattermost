// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) SendAutoResponse(channel *model.Channel, receiver *model.User, rootId string) {
	if receiver == nil || receiver.NotifyProps == nil {
		return
	}

	active := receiver.NotifyProps["auto_responder_active"] == "true"
	message := receiver.NotifyProps["auto_responder_message"]

	if active && message != "" {
		autoResponderPost := &model.Post{
			ChannelId: channel.Id,
			Message:   message,
			RootId:    rootId,
			ParentId:  rootId,
			Type:      model.POST_AUTO_RESPONDER,
			UserId:    receiver.Id,
		}

		if _, err := a.CreatePost(autoResponderPost, channel, false); err != nil {
			mlog.Error(err.Error())
		}
	}
}

func (a *App) SetAutoResponderStatus(user *model.User, oldNotifyProps model.StringMap) {
	active := user.NotifyProps["auto_responder_active"] == "true"
	oldActive := oldNotifyProps["auto_responder_active"] == "true"

	autoResponderEnabled := !oldActive && active
	autoResponderDisabled := oldActive && !active

	if autoResponderEnabled {
		a.SetStatusOutOfOffice(user.Id)
	} else if autoResponderDisabled {
		a.SetStatusOnline(user.Id, true)
	}
}

func (a *App) DisableAutoResponder(userId string, asAdmin bool) *model.AppError {
	user, err := a.GetUser(userId)
	if err != nil {
		return err
	}

	active := user.NotifyProps["auto_responder_active"] == "true"

	if active {
		patch := &model.UserPatch{}
		patch.NotifyProps = user.NotifyProps
		patch.NotifyProps["auto_responder_active"] = "false"

		_, err := a.PatchUser(userId, patch, asAdmin)
		if err != nil {
			return err
		}
	}

	return nil
}
