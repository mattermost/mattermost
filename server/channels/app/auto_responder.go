// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// check if there is any auto_response type post in channel by the user in a calender day
func (a *App) checkIfRespondedToday(createdAt int64, channelId, userId string) (bool, error) {
	y, m, d := model.GetTimeForMillis(createdAt).Date()
	since := model.GetMillisForTime(time.Date(y, m, d, 0, 0, 0, 0, time.UTC))
	return a.Srv().Store().Post().HasAutoResponsePostByUserSince(
		model.GetPostsSinceOptions{ChannelId: channelId, Time: since},
		userId,
	)
}

func (a *App) SendAutoResponseIfNecessary(rctx request.CTX, channel *model.Channel, sender *model.User, post *model.Post) (bool, *model.AppError) {
	if channel.Type != model.ChannelTypeDirect {
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

	receiver, aErr := a.GetUser(receiverId)
	if aErr != nil {
		return false, aErr
	}

	autoResponded, err := a.checkIfRespondedToday(post.CreateAt, post.ChannelId, receiverId)
	if err != nil {
		return false, model.NewAppError("SendAutoResponseIfNecessary", "app.user.send_auto_response.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if autoResponded {
		return false, nil
	}

	return a.SendAutoResponse(rctx, channel, receiver, post)
}

func (a *App) SendAutoResponse(rctx request.CTX, channel *model.Channel, receiver *model.User, post *model.Post) (bool, *model.AppError) {
	if receiver == nil || receiver.NotifyProps == nil {
		return false, nil
	}

	active := receiver.NotifyProps[model.AutoResponderActiveNotifyProp] == "true"
	message := receiver.NotifyProps[model.AutoResponderMessageNotifyProp]

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
		Type:      model.PostTypeAutoResponder,
		UserId:    receiver.Id,
	}

	if _, err := a.CreatePost(rctx, autoResponderPost, channel, model.CreatePostFlags{}); err != nil {
		return false, err
	}

	return true, nil
}

func (a *App) SetAutoResponderStatus(rctx request.CTX, user *model.User, oldNotifyProps model.StringMap) {
	active := user.NotifyProps[model.AutoResponderActiveNotifyProp] == "true"
	oldActive := oldNotifyProps[model.AutoResponderActiveNotifyProp] == "true"

	autoResponderEnabled := !oldActive && active
	autoResponderDisabled := oldActive && !active

	if autoResponderEnabled {
		a.SetStatusOutOfOffice(user.Id)
	} else if autoResponderDisabled {
		a.SetStatusOnline(user.Id, true)
	}
}

func (a *App) DisableAutoResponder(rctx request.CTX, userID string, asAdmin bool) *model.AppError {
	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	active := user.NotifyProps[model.AutoResponderActiveNotifyProp] == "true"

	if active {
		patch := &model.UserPatch{}
		patch.NotifyProps = user.NotifyProps
		patch.NotifyProps[model.AutoResponderActiveNotifyProp] = "false"

		_, err := a.PatchUser(rctx, userID, patch, asAdmin)
		if err != nil {
			return err
		}
	}

	return nil
}
