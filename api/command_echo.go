// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strconv"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
)

var echoSem chan bool

type EchoProvider struct {
}

const (
	CMD_ECHO = "echo"
)

func init() {
	RegisterCommandProvider(&EchoProvider{})
}

func (me *EchoProvider) GetTrigger() string {
	return CMD_ECHO
}

func (me *EchoProvider) GetCommand(c *Context) *model.Command {
	return &model.Command{
		Trigger:          CMD_ECHO,
		AutoComplete:     true,
		AutoCompleteDesc: c.T("api.command_echo.desc"),
		AutoCompleteHint: c.T("api.command_echo.hint"),
		DisplayName:      c.T("api.command_echo.name"),
	}
}

func (me *EchoProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {
	maxThreads := 100

	delay := 0
	if endMsg := strings.LastIndex(message, "\""); string(message[0]) == "\"" && endMsg > 1 {
		if checkDelay, err := strconv.Atoi(strings.Trim(message[endMsg:], " \"")); err == nil {
			delay = checkDelay
		}
		message = message[1:endMsg]
	} else if strings.Index(message, " ") > -1 {
		delayIdx := strings.LastIndex(message, " ")
		delayStr := strings.Trim(message[delayIdx:], " ")

		if checkDelay, err := strconv.Atoi(delayStr); err == nil {
			delay = checkDelay
			message = message[:delayIdx]
		}
	}

	if delay > 10000 {
		return &model.CommandResponse{Text: c.T("api.command_echo.delay.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	if echoSem == nil {
		// We want one additional thread allowed so we never reach channel lockup
		echoSem = make(chan bool, maxThreads+1)
	}

	if len(echoSem) >= maxThreads {
		return &model.CommandResponse{Text: c.T("api.command_echo.high_volume.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	echoSem <- true
	go func() {
		defer func() { <-echoSem }()
		post := &model.Post{}
		post.ChannelId = channelId
		post.Message = message

		time.Sleep(time.Duration(delay) * time.Second)

		if _, err := CreatePost(c, post, true); err != nil {
			l4g.Error(c.T("api.command_echo.create.app_error"), err)
		}
	}()

	return &model.CommandResponse{}
}
