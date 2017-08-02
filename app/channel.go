// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func CreateDefaultChannels(teamId string) ([]*model.Channel, *model.AppError) {
	townSquare := &model.Channel{DisplayName: utils.T("api.channel.create_default_channels.town_square"), Name: "town-square", Type: model.CHANNEL_OPEN, TeamId: teamId}

	if _, err := CreateChannel(townSquare, false); err != nil {
		return nil, err
	}

	offTopic := &model.Channel{DisplayName: utils.T("api.channel.create_default_channels.off_topic"), Name: "off-topic", Type: model.CHANNEL_OPEN, TeamId: teamId}

	if _, err := CreateChannel(offTopic, false); err != nil {
		return nil, err
	}

	channels := []*model.Channel{townSquare, offTopic}
	return channels, nil
}

func JoinDefaultChannels(teamId string, user *model.User, channelRole string, userRequestorId string) *model.AppError {
	var err *model.AppError = nil

	var requestor *model.User
	if userRequestorId != "" {
		if u := <-Srv.Store.User().Get(userRequestorId); u.Err != nil {
			return u.Err
		} else {
			requestor = u.Data.(*model.User)
		}
	}

	if result := <-Srv.Store.Channel().GetByName(teamId, "town-square", true); result.Err != nil {
		err = result.Err
	} else {
		townSquare := result.Data.(*model.Channel)

		cm := &model.ChannelMember{ChannelId: townSquare.Id, UserId: user.Id,
			Roles: channelRole, NotifyProps: model.GetDefaultChannelNotifyProps()}

		if cmResult := <-Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}

		if requestor == nil {
			if err := postJoinChannelMessage(user, townSquare); err != nil {
				l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
			}
		} else {
			if err := PostAddToChannelMessage(requestor, user, townSquare); err != nil {
				l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
			}
		}

		InvalidateCacheForChannelMembers(result.Data.(*model.Channel).Id)
	}

	if result := <-Srv.Store.Channel().GetByName(teamId, "off-topic", true); result.Err != nil {
		err = result.Err
	} else {
		offTopic := result.Data.(*model.Channel)

		cm := &model.ChannelMember{ChannelId: offTopic.Id, UserId: user.Id,
			Roles: channelRole, NotifyProps: model.GetDefaultChannelNotifyProps()}

		if cmResult := <-Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}

		if requestor == nil {
			if err := postJoinChannelMessage(user, offTopic); err != nil {
				l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
			}
		} else {
			if err := PostAddToChannelMessage(requestor, user, offTopic); err != nil {
				l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
			}
		}

		InvalidateCacheForChannelMembers(result.Data.(*model.Channel).Id)
	}

	return err
}

func CreateChannelWithUser(channel *model.Channel, userId string) (*model.Channel, *model.AppError) {
	if channel.IsGroupOrDirect() {
		return nil, model.NewAppError("CreateChannelWithUser", "api.channel.create_channel.direct_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if strings.Index(channel.Name, "__") > 0 {
		return nil, model.NewAppError("CreateChannelWithUser", "api.channel.create_channel.invalid_character.app_error", nil, "", http.StatusBadRequest)
	}

	if len(channel.TeamId) == 0 {
		return nil, model.NewAppError("CreateChannelWithUser", "app.channel.create_channel.no_team_id.app_error", nil, "", http.StatusBadRequest)
	}

	// Get total number of channels on current team
	if count, err := GetNumberOfChannelsOnTeam(channel.TeamId); err != nil {
		return nil, err
	} else {
		if int64(count+1) > *utils.Cfg.TeamSettings.MaxChannelsPerTeam {
			return nil, model.NewAppError("CreateChannelWithUser", "api.channel.create_channel.max_channel_limit.app_error", map[string]interface{}{"MaxChannelsPerTeam": *utils.Cfg.TeamSettings.MaxChannelsPerTeam}, "", http.StatusBadRequest)
		}
	}

	channel.CreatorId = userId

	rchannel, err := CreateChannel(channel, true)
	if err != nil {
		return nil, err
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_CREATED, "", "", userId, nil)
	message.Add("channel_id", channel.Id)
	message.Add("team_id", channel.TeamId)
	Publish(message)

	return rchannel, nil
}

func CreateChannel(channel *model.Channel, addMember bool) (*model.Channel, *model.AppError) {
	if result := <-Srv.Store.Channel().Save(channel); result.Err != nil {
		return nil, result.Err
	} else {
		sc := result.Data.(*model.Channel)

		if addMember {
			cm := &model.ChannelMember{
				ChannelId:   sc.Id,
				UserId:      channel.CreatorId,
				Roles:       model.ROLE_CHANNEL_USER.Id + " " + model.ROLE_CHANNEL_ADMIN.Id,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			}

			if cmresult := <-Srv.Store.Channel().SaveMember(cm); cmresult.Err != nil {
				return nil, cmresult.Err
			}

			InvalidateCacheForUser(channel.CreatorId)
		}

		return sc, nil
	}
}

func CreateDirectChannel(userId string, otherUserId string) (*model.Channel, *model.AppError) {
	if channel, err := createDirectChannel(userId, otherUserId); err != nil {
		if err.Id == store.CHANNEL_EXISTS_ERROR {
			return channel, nil
		} else {
			return nil, err
		}
	} else {
		WaitForChannelMembership(channel.Id, userId)

		InvalidateCacheForUser(userId)
		InvalidateCacheForUser(otherUserId)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_DIRECT_ADDED, "", channel.Id, "", nil)
		message.Add("teammate_id", otherUserId)
		Publish(message)

		return channel, nil
	}
}

func createDirectChannel(userId string, otherUserId string) (*model.Channel, *model.AppError) {
	uc1 := Srv.Store.User().Get(userId)
	uc2 := Srv.Store.User().Get(otherUserId)

	if result := <-uc1; result.Err != nil {
		return nil, model.NewAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, userId, http.StatusBadRequest)
	}

	if result := <-uc2; result.Err != nil {
		return nil, model.NewAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, otherUserId, http.StatusBadRequest)
	}

	if result := <-Srv.Store.Channel().CreateDirectChannel(userId, otherUserId); result.Err != nil {
		if result.Err.Id == store.CHANNEL_EXISTS_ERROR {
			return result.Data.(*model.Channel), result.Err
		} else {
			return nil, result.Err
		}
	} else {
		channel := result.Data.(*model.Channel)
		return channel, nil
	}
}

func WaitForChannelMembership(channelId string, userId string) {
	if len(utils.Cfg.SqlSettings.DataSourceReplicas) > 0 {
		now := model.GetMillis()

		for model.GetMillis()-now < 12000 {

			time.Sleep(100 * time.Millisecond)

			result := <-Srv.Store.Channel().GetMember(channelId, userId)

			// If the membership was found then return
			if result.Err == nil {
				return
			}

			// If we recieved a error but it wasn't a missing channel member then return
			if result.Err.Id != store.MISSING_CHANNEL_MEMBER_ERROR {
				return
			}
		}

		l4g.Error("WaitForChannelMembership giving up channelId=%v userId=%v", channelId, userId)
	}
}

func CreateGroupChannel(userIds []string, creatorId string) (*model.Channel, *model.AppError) {
	if channel, err := createGroupChannel(userIds, creatorId); err != nil {
		if err.Id == store.CHANNEL_EXISTS_ERROR {
			return channel, nil
		} else {
			return nil, err
		}
	} else {
		for _, userId := range userIds {
			if userId == creatorId {
				WaitForChannelMembership(channel.Id, creatorId)
			}

			InvalidateCacheForUser(userId)
		}

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_GROUP_ADDED, "", channel.Id, "", nil)
		message.Add("teammate_ids", model.ArrayToJson(userIds))
		Publish(message)

		return channel, nil
	}
}

func createGroupChannel(userIds []string, creatorId string) (*model.Channel, *model.AppError) {
	if len(userIds) > model.CHANNEL_GROUP_MAX_USERS || len(userIds) < model.CHANNEL_GROUP_MIN_USERS {
		return nil, model.NewAppError("CreateGroupChannel", "api.channel.create_group.bad_size.app_error", nil, "", http.StatusBadRequest)
	}

	var users []*model.User
	if result := <-Srv.Store.User().GetProfileByIds(userIds, true); result.Err != nil {
		return nil, result.Err
	} else {
		users = result.Data.([]*model.User)
	}

	if len(users) != len(userIds) {
		return nil, model.NewAppError("CreateGroupChannel", "api.channel.create_group.bad_user.app_error", nil, "user_ids="+model.ArrayToJson(userIds), http.StatusBadRequest)
	}

	group := &model.Channel{
		Name:        model.GetGroupNameFromUserIds(userIds),
		DisplayName: model.GetGroupDisplayNameFromUsers(users, true),
		Type:        model.CHANNEL_GROUP,
	}

	if result := <-Srv.Store.Channel().Save(group); result.Err != nil {
		if result.Err.Id == store.CHANNEL_EXISTS_ERROR {
			return result.Data.(*model.Channel), result.Err
		} else {
			return nil, result.Err
		}
	} else {
		channel := result.Data.(*model.Channel)

		for _, user := range users {
			cm := &model.ChannelMember{
				UserId:      user.Id,
				ChannelId:   group.Id,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
				Roles:       model.ROLE_CHANNEL_USER.Id,
			}

			if result := <-Srv.Store.Channel().SaveMember(cm); result.Err != nil {
				return nil, result.Err
			}
		}

		return channel, nil
	}
}

func UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	if result := <-Srv.Store.Channel().Update(channel); result.Err != nil {
		return nil, result.Err
	} else {
		InvalidateCacheForChannel(channel)

		messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_UPDATED, "", channel.Id, "", nil)
		messageWs.Add("channel", channel.ToJson())
		Publish(messageWs)

		return channel, nil
	}
}

func RestoreChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	if result := <-Srv.Store.Channel().Restore(channel.Id, model.GetMillis()); result.Err != nil {
		return nil, result.Err
	} else {
		return channel, nil
	}
}

func PatchChannel(channel *model.Channel, patch *model.ChannelPatch, userId string) (*model.Channel, *model.AppError) {
	oldChannelDisplayName := channel.DisplayName
	oldChannelHeader := channel.Header
	oldChannelPurpose := channel.Purpose

	channel.Patch(patch)
	channel, err := UpdateChannel(channel)
	if err != nil {
		return nil, err
	}

	if oldChannelDisplayName != channel.DisplayName {
		if err := PostUpdateChannelDisplayNameMessage(userId, channel.Id, channel.TeamId, oldChannelDisplayName, channel.DisplayName); err != nil {
			l4g.Error(err.Error())
		}
	}

	if channel.Header != oldChannelHeader {
		if err := PostUpdateChannelHeaderMessage(userId, channel.Id, channel.TeamId, oldChannelHeader, channel.Header); err != nil {
			l4g.Error(err.Error())
		}
	}

	if channel.Purpose != oldChannelPurpose {
		if err := PostUpdateChannelPurposeMessage(userId, channel.Id, channel.TeamId, oldChannelPurpose, channel.Purpose); err != nil {
			l4g.Error(err.Error())
		}
	}

	return channel, err
}

func UpdateChannelMemberRoles(channelId string, userId string, newRoles string) (*model.ChannelMember, *model.AppError) {
	var member *model.ChannelMember
	var err *model.AppError
	if member, err = GetChannelMember(channelId, userId); err != nil {
		return nil, err
	}

	member.Roles = newRoles

	if result := <-Srv.Store.Channel().UpdateMember(member); result.Err != nil {
		return nil, result.Err
	}

	InvalidateCacheForUser(userId)
	return member, nil
}

func UpdateChannelMemberNotifyProps(data map[string]string, channelId string, userId string) (*model.ChannelMember, *model.AppError) {
	var member *model.ChannelMember
	var err *model.AppError
	if member, err = GetChannelMember(channelId, userId); err != nil {
		return nil, err
	}

	// update whichever notify properties have been provided, but don't change the others
	if markUnread, exists := data[model.MARK_UNREAD_NOTIFY_PROP]; exists {
		member.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] = markUnread
	}

	if desktop, exists := data[model.DESKTOP_NOTIFY_PROP]; exists {
		member.NotifyProps[model.DESKTOP_NOTIFY_PROP] = desktop
	}

	if email, exists := data[model.EMAIL_NOTIFY_PROP]; exists {
		member.NotifyProps[model.EMAIL_NOTIFY_PROP] = email
	}

	if push, exists := data[model.PUSH_NOTIFY_PROP]; exists {
		member.NotifyProps[model.PUSH_NOTIFY_PROP] = push
	}

	if result := <-Srv.Store.Channel().UpdateMember(member); result.Err != nil {
		return nil, result.Err
	} else {
		InvalidateCacheForUser(userId)
		InvalidateCacheForChannelMembersNotifyProps(channelId)
		return member, nil
	}
}

func DeleteChannel(channel *model.Channel, userId string) *model.AppError {
	uc := Srv.Store.User().Get(userId)
	ihc := Srv.Store.Webhook().GetIncomingByChannel(channel.Id)
	ohc := Srv.Store.Webhook().GetOutgoingByChannel(channel.Id, -1, -1)

	if uresult := <-uc; uresult.Err != nil {
		return uresult.Err
	} else if ihcresult := <-ihc; ihcresult.Err != nil {
		return ihcresult.Err
	} else if ohcresult := <-ohc; ohcresult.Err != nil {
		return ohcresult.Err
	} else {
		user := uresult.Data.(*model.User)
		incomingHooks := ihcresult.Data.([]*model.IncomingWebhook)
		outgoingHooks := ohcresult.Data.([]*model.OutgoingWebhook)

		if channel.DeleteAt > 0 {
			err := model.NewLocAppError("deleteChannel", "api.channel.delete_channel.deleted.app_error", nil, "")
			err.StatusCode = http.StatusBadRequest
			return err
		}

		if channel.Name == model.DEFAULT_CHANNEL {
			err := model.NewLocAppError("deleteChannel", "api.channel.delete_channel.cannot.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
			err.StatusCode = http.StatusBadRequest
			return err
		}

		T := utils.GetUserTranslations(user.Locale)

		post := &model.Post{
			ChannelId: channel.Id,
			Message:   fmt.Sprintf(T("api.channel.delete_channel.archived"), user.Username),
			Type:      model.POST_CHANNEL_DELETED,
			UserId:    userId,
			Props: model.StringInterface{
				"username": user.Username,
			},
		}

		if _, err := CreatePost(post, channel.TeamId, false); err != nil {
			l4g.Error(utils.T("api.channel.delete_channel.failed_post.error"), err)
		}

		now := model.GetMillis()
		for _, hook := range incomingHooks {
			if result := <-Srv.Store.Webhook().DeleteIncoming(hook.Id, now); result.Err != nil {
				l4g.Error(utils.T("api.channel.delete_channel.incoming_webhook.error"), hook.Id)
			}
			InvalidateCacheForWebhook(hook.Id)
		}

		for _, hook := range outgoingHooks {
			if result := <-Srv.Store.Webhook().DeleteOutgoing(hook.Id, now); result.Err != nil {
				l4g.Error(utils.T("api.channel.delete_channel.outgoing_webhook.error"), hook.Id)
			}
		}

		if dresult := <-Srv.Store.Channel().Delete(channel.Id, model.GetMillis()); dresult.Err != nil {
			return dresult.Err
		}
		InvalidateCacheForChannel(channel)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_DELETED, channel.TeamId, "", "", nil)
		message.Add("channel_id", channel.Id)

		Publish(message)
	}

	return nil
}

func addUserToChannel(user *model.User, channel *model.Channel, teamMember *model.TeamMember) (*model.ChannelMember, *model.AppError) {
	if channel.DeleteAt > 0 {
		return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user_to_channel.deleted.app_error", nil, "")
	}

	if channel.Type != model.CHANNEL_OPEN && channel.Type != model.CHANNEL_PRIVATE {
		return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "")
	}

	cmchan := Srv.Store.Channel().GetMember(channel.Id, user.Id)

	if result := <-cmchan; result.Err != nil {
		if result.Err.Id != store.MISSING_CHANNEL_MEMBER_ERROR {
			return nil, result.Err
		}
	} else {
		channelMember := result.Data.(*model.ChannelMember)
		return channelMember, nil
	}

	newMember := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		Roles:       model.ROLE_CHANNEL_USER.Id,
	}
	if result := <-Srv.Store.Channel().SaveMember(newMember); result.Err != nil {
		l4g.Error("Failed to add member user_id=%v channel_id=%v err=%v", user.Id, channel.Id, result.Err)
		return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.app_error", nil, "")
	}

	WaitForChannelMembership(channel.Id, user.Id)

	InvalidateCacheForUser(user.Id)
	InvalidateCacheForChannelMembers(channel.Id)

	return newMember, nil
}

func AddUserToChannel(user *model.User, channel *model.Channel) (*model.ChannelMember, *model.AppError) {
	tmchan := Srv.Store.Team().GetMember(channel.TeamId, user.Id)
	var teamMember *model.TeamMember

	if result := <-tmchan; result.Err != nil {
		return nil, result.Err
	} else {
		teamMember = result.Data.(*model.TeamMember)
		if teamMember.DeleteAt > 0 {
			return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.deleted.app_error", nil, "")
		}
	}

	newMember, err := addUserToChannel(user, channel, teamMember)
	if err != nil {
		return nil, err
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_ADDED, "", channel.Id, "", nil)
	message.Add("user_id", user.Id)
	message.Add("team_id", channel.TeamId)
	Publish(message)

	return newMember, nil
}

func AddChannelMember(userId string, channel *model.Channel, userRequestorId string) (*model.ChannelMember, *model.AppError) {
	if result := <-Srv.Store.Channel().GetMember(channel.Id, userId); result.Err != nil {
		if result.Err.Id != store.MISSING_CHANNEL_MEMBER_ERROR {
			return nil, result.Err
		}
	} else {
		return result.Data.(*model.ChannelMember), nil
	}

	var user *model.User
	var err *model.AppError

	if user, err = GetUser(userId); err != nil {
		return nil, err
	}

	var userRequestor *model.User
	if userRequestor, err = GetUser(userRequestorId); err != nil {
		return nil, err
	}

	cm, err := AddUserToChannel(user, channel)
	if err != nil {
		return nil, err
	}

	if userId == userRequestorId {
		postJoinChannelMessage(user, channel)
	} else {
		go PostAddToChannelMessage(userRequestor, user, channel)
	}

	UpdateChannelLastViewedAt([]string{channel.Id}, userRequestor.Id)

	return cm, nil
}

func AddDirectChannels(teamId string, user *model.User) *model.AppError {
	var profiles []*model.User
	if result := <-Srv.Store.User().GetProfiles(teamId, 0, 100); result.Err != nil {
		return model.NewLocAppError("AddDirectChannels", "api.user.add_direct_channels_and_forget.failed.error", map[string]interface{}{"UserId": user.Id, "TeamId": teamId, "Error": result.Err.Error()}, "")
	} else {
		profiles = result.Data.([]*model.User)
	}

	var preferences model.Preferences

	for _, profile := range profiles {
		if profile.Id == user.Id {
			continue
		}

		preference := model.Preference{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     profile.Id,
			Value:    "true",
		}

		preferences = append(preferences, preference)

		if len(preferences) >= 10 {
			break
		}
	}

	if result := <-Srv.Store.Preference().Save(&preferences); result.Err != nil {
		return model.NewLocAppError("AddDirectChannels", "api.user.add_direct_channels_and_forget.failed.error", map[string]interface{}{"UserId": user.Id, "TeamId": teamId, "Error": result.Err.Error()}, "")
	}

	return nil
}

func PostUpdateChannelHeaderMessage(userId string, channelId string, teamId string, oldChannelHeader, newChannelHeader string) *model.AppError {
	uc := Srv.Store.User().Get(userId)

	if uresult := <-uc; uresult.Err != nil {
		return model.NewLocAppError("PostUpdateChannelHeaderMessage", "api.channel.post_update_channel_header_message_and_forget.retrieve_user.error", nil, uresult.Err.Error())
	} else {
		user := uresult.Data.(*model.User)

		var message string
		if oldChannelHeader == "" {
			message = fmt.Sprintf(utils.T("api.channel.post_update_channel_header_message_and_forget.updated_to"), user.Username, newChannelHeader)
		} else if newChannelHeader == "" {
			message = fmt.Sprintf(utils.T("api.channel.post_update_channel_header_message_and_forget.removed"), user.Username, oldChannelHeader)
		} else {
			message = fmt.Sprintf(utils.T("api.channel.post_update_channel_header_message_and_forget.updated_from"), user.Username, oldChannelHeader, newChannelHeader)
		}

		post := &model.Post{
			ChannelId: channelId,
			Message:   message,
			Type:      model.POST_HEADER_CHANGE,
			UserId:    userId,
			Props: model.StringInterface{
				"username":   user.Username,
				"old_header": oldChannelHeader,
				"new_header": newChannelHeader,
			},
		}

		if _, err := CreatePost(post, teamId, false); err != nil {
			return model.NewLocAppError("", "api.channel.post_update_channel_header_message_and_forget.post.error", nil, err.Error())
		}
	}

	return nil
}

func PostUpdateChannelPurposeMessage(userId string, channelId string, teamId string, oldChannelPurpose string, newChannelPurpose string) *model.AppError {
	uc := Srv.Store.User().Get(userId)

	if uresult := <-uc; uresult.Err != nil {
		return model.NewLocAppError("PostUpdateChannelPurposeMessage", "app.channel.post_update_channel_purpose_message.retrieve_user.error", nil, uresult.Err.Error())
	} else {
		user := uresult.Data.(*model.User)

		var message string
		if oldChannelPurpose == "" {
			message = fmt.Sprintf(utils.T("app.channel.post_update_channel_purpose_message.updated_to"), user.Username, newChannelPurpose)
		} else if newChannelPurpose == "" {
			message = fmt.Sprintf(utils.T("app.channel.post_update_channel_purpose_message.removed"), user.Username, oldChannelPurpose)
		} else {
			message = fmt.Sprintf(utils.T("app.channel.post_update_channel_purpose_message.updated_from"), user.Username, oldChannelPurpose, newChannelPurpose)
		}

		post := &model.Post{
			ChannelId: channelId,
			Message:   message,
			Type:      model.POST_PURPOSE_CHANGE,
			UserId:    userId,
			Props: model.StringInterface{
				"username":    user.Username,
				"old_purpose": oldChannelPurpose,
				"new_purpose": newChannelPurpose,
			},
		}
		if _, err := CreatePost(post, teamId, false); err != nil {
			return model.NewLocAppError("", "app.channel.post_update_channel_purpose_message.post.error", nil, err.Error())
		}
	}

	return nil
}

func PostUpdateChannelDisplayNameMessage(userId string, channelId string, teamId string, oldChannelDisplayName, newChannelDisplayName string) *model.AppError {
	uc := Srv.Store.User().Get(userId)

	if uresult := <-uc; uresult.Err != nil {
		return model.NewLocAppError("PostUpdateChannelDisplayNameMessage", "api.channel.post_update_channel_displayname_message_and_forget.retrieve_user.error", nil, uresult.Err.Error())
	} else {
		user := uresult.Data.(*model.User)

		message := fmt.Sprintf(utils.T("api.channel.post_update_channel_displayname_message_and_forget.updated_from"), user.Username, oldChannelDisplayName, newChannelDisplayName)

		post := &model.Post{
			ChannelId: channelId,
			Message:   message,
			Type:      model.POST_DISPLAYNAME_CHANGE,
			UserId:    userId,
			Props: model.StringInterface{
				"username":        user.Username,
				"old_displayname": oldChannelDisplayName,
				"new_displayname": newChannelDisplayName,
			},
		}

		if _, err := CreatePost(post, teamId, false); err != nil {
			return model.NewLocAppError("PostUpdateChannelDisplayNameMessage", "api.channel.post_update_channel_displayname_message_and_forget.create_post.error", nil, err.Error())
		}
	}

	return nil
}

func GetChannel(channelId string) (*model.Channel, *model.AppError) {
	if result := <-Srv.Store.Channel().Get(channelId, true); result.Err != nil && result.Err.Id == "store.sql_channel.get.existing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func GetChannelByName(channelName, teamId string) (*model.Channel, *model.AppError) {
	if result := <-Srv.Store.Channel().GetByName(teamId, channelName, true); result.Err != nil && result.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func GetChannelByNameForTeamName(channelName, teamName string) (*model.Channel, *model.AppError) {
	var team *model.Team

	if result := <-Srv.Store.Team().GetByName(teamName); result.Err != nil {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	if result := <-Srv.Store.Channel().GetByName(team.Id, channelName, true); result.Err != nil && result.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func GetChannelsForUser(teamId string, userId string) (*model.ChannelList, *model.AppError) {
	if result := <-Srv.Store.Channel().GetChannels(teamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func GetDeletedChannels(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	if result := <-Srv.Store.Channel().GetDeleted(teamId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func GetChannelsUserNotIn(teamId string, userId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	if result := <-Srv.Store.Channel().GetMoreChannels(teamId, userId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) (*model.ChannelList, *model.AppError) {
	if result := <-Srv.Store.Channel().GetPublicChannelsByIdsForTeam(teamId, channelIds); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func GetPublicChannelsForTeam(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	if result := <-Srv.Store.Channel().GetPublicChannelsForTeam(teamId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func GetChannelMember(channelId string, userId string) (*model.ChannelMember, *model.AppError) {
	if result := <-Srv.Store.Channel().GetMember(channelId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelMember), nil
	}
}

func GetChannelMembersPage(channelId string, page, perPage int) (*model.ChannelMembers, *model.AppError) {
	if result := <-Srv.Store.Channel().GetMembers(channelId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelMembers), nil
	}
}

func GetChannelMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, *model.AppError) {
	if result := <-Srv.Store.Channel().GetMembersByIds(channelId, userIds); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelMembers), nil
	}
}

func GetChannelMembersForUser(teamId string, userId string) (*model.ChannelMembers, *model.AppError) {
	if result := <-Srv.Store.Channel().GetMembersForUser(teamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelMembers), nil
	}
}

func GetChannelMemberCount(channelId string) (int64, *model.AppError) {
	if result := <-Srv.Store.Channel().GetMemberCount(channelId, true); result.Err != nil {
		return 0, result.Err
	} else {
		return result.Data.(int64), nil
	}
}

func GetChannelCounts(teamId string, userId string) (*model.ChannelCounts, *model.AppError) {
	if result := <-Srv.Store.Channel().GetChannelCounts(teamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelCounts), nil
	}
}

func GetChannelUnread(channelId, userId string) (*model.ChannelUnread, *model.AppError) {
	result := <-Srv.Store.Channel().GetChannelUnread(channelId, userId)
	if result.Err != nil {
		return nil, result.Err
	}
	channelUnread := result.Data.(*model.ChannelUnread)

	if channelUnread.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.CHANNEL_MARK_UNREAD_MENTION {
		channelUnread.MsgCount = 0
	}

	return channelUnread, nil
}

func JoinChannel(channel *model.Channel, userId string) *model.AppError {
	if channel.DeleteAt > 0 {
		return model.NewLocAppError("JoinChannel", "api.channel.join_channel.already_deleted.app_error", nil, "")
	}

	userChan := Srv.Store.User().Get(userId)
	memberChan := Srv.Store.Channel().GetMember(channel.Id, userId)

	if uresult := <-userChan; uresult.Err != nil {
		return uresult.Err
	} else if mresult := <-memberChan; mresult.Err == nil && mresult.Data != nil {
		// user is already in the channel
		return nil
	} else {
		user := uresult.Data.(*model.User)

		if channel.Type == model.CHANNEL_OPEN {
			if _, err := AddUserToChannel(user, channel); err != nil {
				return err
			}

			if err := postJoinChannelMessage(user, channel); err != nil {
				return err
			}
		} else {
			return model.NewLocAppError("JoinChannel", "api.channel.join_channel.permissions.app_error", nil, "")
		}
	}

	return nil
}

func postJoinChannelMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.channel.join_channel.post_and_forget"), user.Username),
		Type:      model.POST_JOIN_CHANNEL,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := CreatePost(post, channel.TeamId, false); err != nil {
		return model.NewLocAppError("postJoinChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error())
	}

	return nil
}

func LeaveChannel(channelId string, userId string) *model.AppError {
	sc := Srv.Store.Channel().Get(channelId, true)
	uc := Srv.Store.User().Get(userId)
	ccm := Srv.Store.Channel().GetMemberCount(channelId, false)

	if cresult := <-sc; cresult.Err != nil {
		return cresult.Err
	} else if uresult := <-uc; uresult.Err != nil {
		return cresult.Err
	} else if ccmresult := <-ccm; ccmresult.Err != nil {
		return ccmresult.Err
	} else {
		channel := cresult.Data.(*model.Channel)
		user := uresult.Data.(*model.User)
		membersCount := ccmresult.Data.(int64)

		if channel.IsGroupOrDirect() {
			err := model.NewLocAppError("LeaveChannel", "api.channel.leave.direct.app_error", nil, "")
			err.StatusCode = http.StatusBadRequest
			return err
		}

		if channel.Type == model.CHANNEL_PRIVATE && membersCount == 1 {
			err := model.NewLocAppError("LeaveChannel", "api.channel.leave.last_member.app_error", nil, "userId="+user.Id)
			err.StatusCode = http.StatusBadRequest
			return err
		}

		if err := removeUserFromChannel(userId, userId, channel); err != nil {
			return err
		}

		go postLeaveChannelMessage(user, channel)
	}

	return nil
}

func postLeaveChannelMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.channel.leave.left"), user.Username),
		Type:      model.POST_LEAVE_CHANNEL,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := CreatePost(post, channel.TeamId, false); err != nil {
		return model.NewLocAppError("postLeaveChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error())
	}

	return nil
}

func PostAddToChannelMessage(user *model.User, addedUser *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.channel.add_member.added"), addedUser.Username, user.Username),
		Type:      model.POST_ADD_TO_CHANNEL,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username":      user.Username,
			"addedUsername": addedUser.Username,
		},
	}

	if _, err := CreatePost(post, channel.TeamId, false); err != nil {
		return model.NewLocAppError("postAddToChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error())
	}

	return nil
}

func PostRemoveFromChannelMessage(removerUserId string, removedUser *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.channel.remove_member.removed"), removedUser.Username),
		Type:      model.POST_REMOVE_FROM_CHANNEL,
		UserId:    removerUserId,
		Props: model.StringInterface{
			"removedUsername": removedUser.Username,
		},
	}

	if _, err := CreatePost(post, channel.TeamId, false); err != nil {
		return model.NewLocAppError("postRemoveFromChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error())
	}

	return nil
}

func removeUserFromChannel(userIdToRemove string, removerUserId string, channel *model.Channel) *model.AppError {
	if channel.DeleteAt > 0 {
		err := model.NewLocAppError("RemoveUserFromChannel", "api.channel.remove_user_from_channel.deleted.app_error", nil, "")
		err.StatusCode = http.StatusBadRequest
		return err
	}

	if channel.Name == model.DEFAULT_CHANNEL {
		return model.NewLocAppError("RemoveUserFromChannel", "api.channel.remove.default.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
	}

	if cmresult := <-Srv.Store.Channel().RemoveMember(channel.Id, userIdToRemove); cmresult.Err != nil {
		return cmresult.Err
	}

	InvalidateCacheForUser(userIdToRemove)
	InvalidateCacheForChannelMembers(channel.Id)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_REMOVED, "", channel.Id, "", nil)
	message.Add("user_id", userIdToRemove)
	message.Add("remover_id", removerUserId)
	go Publish(message)

	// because the removed user no longer belongs to the channel we need to send a separate websocket event
	userMsg := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_REMOVED, "", "", userIdToRemove, nil)
	userMsg.Add("channel_id", channel.Id)
	userMsg.Add("remover_id", removerUserId)
	go Publish(userMsg)

	return nil
}

func RemoveUserFromChannel(userIdToRemove string, removerUserId string, channel *model.Channel) *model.AppError {
	var err *model.AppError
	if err = removeUserFromChannel(userIdToRemove, removerUserId, channel); err != nil {
		return err
	}

	var user *model.User
	if user, err = GetUser(userIdToRemove); err != nil {
		return err
	}

	if userIdToRemove == removerUserId {
		postLeaveChannelMessage(user, channel)
	} else {
		go PostRemoveFromChannelMessage(removerUserId, user, channel)
	}

	return nil
}

func GetNumberOfChannelsOnTeam(teamId string) (int, *model.AppError) {
	// Get total number of channels on current team
	if result := <-Srv.Store.Channel().GetTeamChannels(teamId); result.Err != nil {
		return 0, result.Err
	} else {
		return len(*result.Data.(*model.ChannelList)), nil
	}
}

func SetActiveChannel(userId string, channelId string) *model.AppError {
	status, err := GetStatus(userId)

	oldStatus := model.STATUS_OFFLINE

	if err != nil {
		status = &model.Status{UserId: userId, Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: channelId}
	} else {
		oldStatus = status.Status
		status.ActiveChannel = channelId
		if !status.Manual && channelId != "" {
			status.Status = model.STATUS_ONLINE
		}
		status.LastActivityAt = model.GetMillis()
	}

	AddStatusCache(status)

	if status.Status != oldStatus {
		BroadcastStatus(status)
	}

	return nil
}

func UpdateChannelLastViewedAt(channelIds []string, userId string) *model.AppError {
	if result := <-Srv.Store.Channel().UpdateLastViewedAt(channelIds, userId); result.Err != nil {
		return result.Err
	}

	if *utils.Cfg.ServiceSettings.EnableChannelViewedMessages {
		for _, channelId := range channelIds {
			message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, "", "", userId, nil)
			message.Add("channel_id", channelId)
			go Publish(message)
		}
	}

	return nil
}

func SearchChannels(teamId string, term string) (*model.ChannelList, *model.AppError) {
	if result := <-Srv.Store.Channel().SearchInTeam(teamId, term); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func SearchChannelsUserNotIn(teamId string, userId string, term string) (*model.ChannelList, *model.AppError) {
	if result := <-Srv.Store.Channel().SearchMore(userId, teamId, term); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func ViewChannel(view *model.ChannelView, userId string, clearPushNotifications bool) *model.AppError {
	if err := SetActiveChannel(userId, view.ChannelId); err != nil {
		return err
	}

	channelIds := []string{}

	if len(view.ChannelId) > 0 {
		channelIds = append(channelIds, view.ChannelId)
	}

	var pchan store.StoreChannel
	if len(view.PrevChannelId) > 0 {
		channelIds = append(channelIds, view.PrevChannelId)

		if *utils.Cfg.EmailSettings.SendPushNotifications && clearPushNotifications && len(view.ChannelId) > 0 {
			pchan = Srv.Store.User().GetUnreadCountForChannel(userId, view.ChannelId)
		}
	}

	if len(channelIds) == 0 {
		return nil
	}

	uchan := Srv.Store.Channel().UpdateLastViewedAt(channelIds, userId)

	if pchan != nil {
		if result := <-pchan; result.Err != nil {
			return result.Err
		} else {
			if result.Data.(int64) > 0 {
				ClearPushNotification(userId, view.ChannelId)
			}
		}
	}

	if result := <-uchan; result.Err != nil {
		return result.Err
	}

	if *utils.Cfg.ServiceSettings.EnableChannelViewedMessages && len(view.ChannelId) > 0 {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, "", "", userId, nil)
		message.Add("channel_id", view.ChannelId)
		go Publish(message)
	}

	return nil
}

func PermanentDeleteChannel(channel *model.Channel) *model.AppError {
	if result := <-Srv.Store.Post().PermanentDeleteByChannel(channel.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Channel().PermanentDeleteMembersByChannel(channel.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Webhook().PermanentDeleteIncomingByChannel(channel.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Webhook().PermanentDeleteOutgoingByChannel(channel.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Channel().PermanentDelete(channel.Id); result.Err != nil {
		return result.Err
	}

	return nil
}

func GetPinnedPosts(channelId string) (*model.PostList, *model.AppError) {
	if result := <-Srv.Store.Channel().GetPinnedPosts(channelId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	result := <-Srv.Store.Channel().GetByName("", model.GetDMNameFromIds(userId1, userId2), true)
	if result.Err != nil && result.Err.Id == store.MISSING_CHANNEL_ERROR {
		result := <-Srv.Store.Channel().CreateDirectChannel(userId1, userId2)
		if result.Err != nil {
			return nil, model.NewAppError("GetOrCreateDMChannel", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message, http.StatusBadRequest)
		}
		InvalidateCacheForUser(userId1)
		InvalidateCacheForUser(userId2)
		return result.Data.(*model.Channel), nil
	} else if result.Err != nil {
		return nil, model.NewAppError("GetOrCreateDMChannel", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message, result.Err.StatusCode)
	}
	return result.Data.(*model.Channel), nil
}
