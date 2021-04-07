// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

func (a *App) checkIfRespondedToday(createdAt int64, channelId, userId string) bool {
	// get last post in a calender day sent by user and if it's auto responder post then don't send again
	y, m, d := time.Unix(createdAt, 0).Date()
	since := model.GetMillisForTime(time.Date(y, m, d, 0, 0, 0, 0, time.UTC))
	autoResponded, err := a.Srv().Store.Post().CheckIfAutoResponseByUserInChannelSince(
		model.GetPostsSinceOptions{ChannelId: channelId, Time: since},
		userId,
	)

	if err != nil {
		mlog.Error("auto_responder.check_for_auto_respond_today_error", mlog.String("error", err.Error()))
		return false
	}

	return autoResponded

}

func (a *App) SendAutoResponseIfNecessary(channel *model.Channel, sender *model.User, post *model.Post) (bool, *model.AppError) {
	if channel.Type != model.CHANNEL_DIRECT {
		return false, nil
	}

	if sender.IsBot {
		return false, nil
	}

	receiverId := channel.GetOtherUserIdForDM(sender.Id)
	if receiverId == "" {
		// User direct messaged themself, let them test their auto-responder.
		receiverId = sender.Id
	}

	receiver, err := a.GetUser(receiverId)
	if err != nil {
		return false, err
	}

	if a.checkIfRespondedToday(post.CreateAt, post.ChannelId, receiverId) {
		return false, nil
	}

	return a.SendAutoResponse(channel, receiver, post)
}

func (a *App) SendAutoResponse(channel *model.Channel, receiver *model.User, post *model.Post) (bool, *model.AppError) {
	if receiver == nil || receiver.NotifyProps == nil {
		return false, nil
	}

	active := receiver.NotifyProps[model.AUTO_RESPONDER_ACTIVE_NOTIFY_PROP] == "true"
	message := receiver.NotifyProps[model.AUTO_RESPONDER_MESSAGE_NOTIFY_PROP]

	if !active || message == "" {
		return false, nil
	}

	rootID := post.Id
	if post.RootId != "" {
		rootID = post.RootId
	}

	autoResponderPost := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		RootId:    rootID,
		Type:      model.POST_AUTO_RESPONDER,
		UserId:    receiver.Id,
	}

	if _, err := a.CreatePost(autoResponderPost, channel, false, false); err != nil {
		return false, err
	}

	return true, nil
}

func (a *App) SetAutoResponderStatus(user *model.User, oldNotifyProps model.StringMap) {
	active := user.NotifyProps[model.AUTO_RESPONDER_ACTIVE_NOTIFY_PROP] == "true"
	oldActive := oldNotifyProps[model.AUTO_RESPONDER_ACTIVE_NOTIFY_PROP] == "true"

	autoResponderEnabled := !oldActive && active
	autoResponderDisabled := oldActive && !active

	if autoResponderEnabled {
		a.SetStatusOutOfOffice(user.Id)
	} else if autoResponderDisabled {
		a.SetStatusOnline(user.Id, true)
	}
}

func (a *App) DisableAutoResponder(userID string, asAdmin bool) *model.AppError {
	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	active := user.NotifyProps[model.AUTO_RESPONDER_ACTIVE_NOTIFY_PROP] == "true"

	if active {
		patch := &model.UserPatch{}
		patch.NotifyProps = user.NotifyProps
		patch.NotifyProps[model.AUTO_RESPONDER_ACTIVE_NOTIFY_PROP] = "false"

		_, err := a.PatchUser(userID, patch, asAdmin)
		if err != nil {
			return err
		}
	}

	return nil
}
