// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

var echoSem chan bool

type EchoProvider struct {
}

const (
	CmdEcho = "echo"
)

func init() {
	app.RegisterCommandProvider(&EchoProvider{})
}

func (*EchoProvider) GetTrigger() string {
	return CmdEcho
}

func (*EchoProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CmdEcho,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_echo.desc"),
		AutoCompleteHint: T("api.command_echo.hint"),
		DisplayName:      T("api.command_echo.name"),
	}
}

func (*EchoProvider) DoCommand(a *app.App, rctx request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	if message == "" {
		return &model.CommandResponse{Text: args.T("api.command_echo.message.app_error"), ResponseType: model.CommandResponseTypeEphemeral}
	}

	maxThreads := 100

	delay := 0
	if endMsg := strings.LastIndex(message, "\""); string(message[0]) == "\"" && endMsg > 1 {
		if checkDelay, err := strconv.Atoi(strings.Trim(message[endMsg:], " \"")); err == nil {
			delay = checkDelay
		}
		message = message[1:endMsg]
	} else if strings.Contains(message, " ") {
		delayIdx := strings.LastIndex(message, " ")
		delayStr := strings.Trim(message[delayIdx:], " ")

		if checkDelay, err := strconv.Atoi(delayStr); err == nil {
			delay = checkDelay
			message = message[:delayIdx]
		}
	}

	if delay > 10000 {
		return &model.CommandResponse{Text: args.T("api.command_echo.delay.app_error"), ResponseType: model.CommandResponseTypeEphemeral}
	}

	if echoSem == nil {
		// We want one additional thread allowed so we never reach channel lockup
		echoSem = make(chan bool, maxThreads+1)
	}

	if len(echoSem) >= maxThreads {
		return &model.CommandResponse{Text: args.T("api.command_echo.high_volume.app_error"), ResponseType: model.CommandResponseTypeEphemeral}
	}

	echoSem <- true
	a.Srv().Go(func() {
		defer func() { <-echoSem }()
		post := &model.Post{}
		post.ChannelId = args.ChannelId
		post.RootId = args.RootId
		post.Message = message
		post.UserId = args.UserId

		time.Sleep(time.Duration(delay) * time.Second)

		if _, err := a.CreatePostMissingChannel(rctx, post, true, true); err != nil {
			rctx.Logger().Error("Unable to create /echo post.", mlog.Err(err))
		}
	})

	return &model.CommandResponse{}
}
