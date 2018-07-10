// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
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

func (me *groupmsgProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_GROUPMSG,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_groupmsg.desc"),
		AutoCompleteHint: T("api.command_groupmsg.hint"),
		DisplayName:      T("api.command_groupmsg.name"),
	}
}

func (me *groupmsgProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	targetUsers := map[string]*model.User{}
	targetUsersSlice := []string{args.UserId}
	invalidUsernames := []string{}

	users, parsedMessage := groupMsgUsernames(message)

	for _, username := range users {
		username = strings.TrimSpace(username)
		username = strings.TrimPrefix(username, "@")
		if result := <-a.Srv.Store.User().GetByUsername(username); result.Err != nil {
			invalidUsernames = append(invalidUsernames, username)
		} else {
			targetUser := result.Data.(*model.User)
			_, exists := targetUsers[targetUser.Id]
			if !exists && targetUser.Id != args.UserId {
				targetUsers[targetUser.Id] = targetUser
				targetUsersSlice = append(targetUsersSlice, targetUser.Id)
			}
		}
	}

	if len(invalidUsernames) > 0 {
		invalidUsersString := map[string]interface{}{
			"Users": "@" + strings.Join(invalidUsernames, ", @"),
		}
		return &model.CommandResponse{
			Text:         args.T("api.command_groupmsg.invalid_user.app_error", len(invalidUsernames), invalidUsersString),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	if len(targetUsersSlice) == 2 {
		return GetCommandProvider("msg").DoCommand(a, args, fmt.Sprintf("%s %s", targetUsers[targetUsersSlice[1]].Username, parsedMessage))
	}

	if len(targetUsersSlice) < model.CHANNEL_GROUP_MIN_USERS {
		minUsers := map[string]interface{}{
			"MinUsers": model.CHANNEL_GROUP_MIN_USERS - 1,
		}
		return &model.CommandResponse{
			Text:         args.T("api.command_groupmsg.min_users.app_error", minUsers),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	if len(targetUsersSlice) > model.CHANNEL_GROUP_MAX_USERS {
		maxUsers := map[string]interface{}{
			"MaxUsers": model.CHANNEL_GROUP_MAX_USERS - 1,
		}
		return &model.CommandResponse{
			Text:         args.T("api.command_groupmsg.max_users.app_error", maxUsers),
			ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		}
	}

	var groupChannel *model.Channel
	var channelErr *model.AppError

	if a.SessionHasPermissionTo(args.Session, model.PERMISSION_CREATE_GROUP_CHANNEL) {
		groupChannel, channelErr = a.CreateGroupChannel(targetUsersSlice, args.UserId)
		if channelErr != nil {
			mlog.Error(channelErr.Error())
			return &model.CommandResponse{Text: args.T("api.command_groupmsg.group_fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	} else {
		groupChannel, channelErr = a.GetGroupChannel(targetUsersSlice)
		if channelErr != nil {
			return &model.CommandResponse{Text: args.T("api.command_groupmsg.permission.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	if len(parsedMessage) > 0 {
		post := &model.Post{}
		post.Message = parsedMessage
		post.ChannelId = groupChannel.Id
		post.UserId = args.UserId
		if _, err := a.CreatePostMissingChannel(post, true); err != nil {
			return &model.CommandResponse{Text: args.T("api.command_groupmsg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	team, err := a.GetTeam(args.TeamId)
	if err != nil {
		return &model.CommandResponse{Text: args.T("api.command_groupmsg.fail.app_error"), ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{GotoLocation: args.SiteURL + "/" + team.Name + "/channels/" + groupChannel.Name, Text: "", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func groupMsgUsernames(message string) ([]string, string) {
	result := []string{}
	resultMessage := ""
	for idx, part := range strings.Split(message, ",") {
		clean := strings.TrimPrefix(strings.TrimSpace(part), "@")
		split := strings.Fields(clean)
		if len(split) > 0 {
			result = append(result, split[0])
		}
		if len(split) > 1 {
			splitted := strings.SplitN(message, ",", idx+1)
			resultMessage = strings.TrimPrefix(strings.TrimSpace(splitted[len(splitted)-1]), "@")
			resultMessage = strings.TrimSpace(strings.TrimPrefix(resultMessage, split[0]))
			break
		}
	}
	return result, resultMessage
}
