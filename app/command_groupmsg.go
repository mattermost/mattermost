// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type groupmsgProvider struct {
}

const (
	CMD_GROUPMSG = "groupmsg"
)

func init() {
	RegisterCommandProvider(&groupmsgProvider{})
}

func (me *groupmsgProvider) GetTrigger() string {
	return CMD_GROUPMSG
}

func (me *groupmsgProvider) GetCommand(T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_GROUPMSG,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_groupmsg.desc"),
		AutoCompleteHint: T("api.command_groupmsg.hint"),
		DisplayName:      T("api.command_groupmsg.name"),
	}
}

func (me *groupmsgProvider) DoCommand(args *model.CommandArgs, message string) *model.CommandResponse {

	splitMessage := strings.SplitN(message, " ", 2)

	parsedMessage := ""
	targetUsername := ""
	teamId := ""

	if len(splitMessage) > 1 {
		parsedMessage = strings.SplitN(message, " ", 2)[1]
	}
	targetUsername = strings.SplitN(message, " ", 2)[0]
	targetUsername = strings.TrimPrefix(targetUsername, "@")

	var userProfile *model.User
	if result := <-Global().Srv.Store.User().GetByUsername(targetUsername); result.Err != nil {
		l4g.Error(result.Err.Error())
		return &model.CommandResponse{Text: args.T("api.command_groupmsg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		userProfile = result.Data.(*model.User)
	}

	if userProfile.Id == args.UserId {
		return &model.CommandResponse{Text: args.T("api.command_groupmsg.missing.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// Find the channel based on this user
	channelName := model.GetDMNameFromIds(args.UserId, userProfile.Id)

	targetChannelId := ""
	if channel := <-Global().Srv.Store.Channel().GetByName(args.TeamId, channelName, true); channel.Err != nil {
		if channel.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
			if directChannel, err := Global().CreateDirectChannel(args.UserId, userProfile.Id); err != nil {
				l4g.Error(err.Error())
				return &model.CommandResponse{Text: args.T("api.command_groupmsg.group_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
			} else {
				targetChannelId = directChannel.Id
			}
		} else {
			l4g.Error(channel.Err.Error())
			return &model.CommandResponse{Text: args.T("api.command_groupmsg.group_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	} else {
		channel := channel.Data.(*model.Channel)
		targetChannelId = channel.Id
		teamId = channel.TeamId
	}

	if len(parsedMessage) > 0 {
		post := &model.Post{}
		post.Message = parsedMessage
		post.ChannelId = targetChannelId
		post.UserId = args.UserId
		if _, err := Global().CreatePostMissingChannel(post, true); err != nil {
			return &model.CommandResponse{Text: args.T("api.command_groupmsg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	if teamId == "" {
		if len(args.Session.TeamMembers) == 0 {
			return &model.CommandResponse{Text: args.T("api.command_groupmsg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
		teamId = args.Session.TeamMembers[0].TeamId
	}

	team, err := Global().GetTeam(teamId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_groupmsg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{GotoLocation: args.SiteURL + "/" + team.Name + "/channels/" + channelName, Text: "", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}
