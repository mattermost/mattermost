// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

type TimerProvider struct {
}

const (
	CmdTimer = "timer"
)

func init() {
	app.RegisterCommandProvider(&TimerProvider{})
}

func (*TimerProvider) GetTrigger() string {
	return CmdTimer
}

func (*TimerProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdTimer,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_timer.desc"),
		AutoCompleteHint: T("api.command_timer.hint"),
		DisplayName:      T("api.command_timer.name"),
	}
}

func (*TimerProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	parts := strings.SplitN(message, " ", 2)
	if len(parts) == 0 || parts[0] == "" {
		return &model.CommandResponse{Text: args.T("api.command_timer.empty"), ResponseType: model.CommandResponseTypeEphemeral}
	}

	durationStr := parts[0]
	duration, err := time.ParseDuration(durationStr)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_timer.invalid_format"), ResponseType: model.CommandResponseTypeEphemeral}
	}
	if duration <= 0 || duration > 4*time.Hour {
		return &model.CommandResponse{Text: args.T("api.command_timer.invalid_duration"), ResponseType: model.CommandResponseTypeEphemeral}
	}

	timerMsg := ""
	if len(parts) > 1 {
		timerMsg = parts[1]
	}

	targetTime := time.Now().Add(duration)

	timerPost := &model.Post{
		ChannelId: args.ChannelId,
		RootId:    args.RootId,
		UserId:    args.UserId,
		Message:   timerMsg,
		Type:      fmt.Sprintf("%stimer", model.PostCustomTypePrefix),
	}
	timerPost.AddProp("timer_target", targetTime.UnixMilli())

	createdPost, _, appErr := a.CreatePostMissingChannel(rctx, timerPost, true, true)
	if appErr != nil {
		return &model.CommandResponse{Text: args.T("api.command_timer.create_failed"), ResponseType: model.CommandResponseTypeEphemeral}
	}

	a.Srv().Go(func() {
		time.Sleep(duration)

		post, storeErr := a.Srv().Store().Post().GetSingle(rctx, createdPost.Id, true)
		if storeErr != nil || post.DeleteAt > 0 {
			return
		}

		systemBot, appErr := a.GetSystemBot(rctx)
		if appErr != nil {
			rctx.Logger().Error("Unable to get system bot for timer notification.", mlog.Err(appErr))
			return
		}

		user, _ := a.GetUser(args.UserId)
		username := ""
		if user != nil {
			username = user.Username
		}

		var replyMsg string
		if timerMsg != "" {
			replyMsg = args.T("api.command_timer.expired", map[string]interface{}{"Message": timerMsg})
		} else {
			replyMsg = args.T("api.command_timer.expired_no_message")
		}
		if username != "" {
			replyMsg += " @" + username
		}

		notifyPost := &model.Post{
			ChannelId: args.ChannelId,
			RootId:    args.RootId,
			UserId:    systemBot.UserId,
			Message:   replyMsg,
		}

		if _, _, err := a.CreatePostMissingChannel(rctx, notifyPost, true, true); err != nil {
			rctx.Logger().Error("Unable to create timer notification post.", mlog.Err(err))
		}
	})

	return &model.CommandResponse{}
}
