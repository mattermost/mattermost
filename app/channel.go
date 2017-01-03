// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func MakeDirectChannelVisible(channelId string) *model.AppError {
	var members []model.ChannelMember
	if result := <-Srv.Store.Channel().GetMembers(channelId); result.Err != nil {
		return result.Err
	} else {
		members = result.Data.([]model.ChannelMember)
	}

	if len(members) != 2 {
		return model.NewLocAppError("MakeDirectChannelVisible", "api.post.make_direct_channel_visible.get_2_members.error", map[string]interface{}{"ChannelId": channelId}, "")
	}

	// make sure the channel is visible to both members
	for i, member := range members {
		otherUserId := members[1-i].UserId

		if result := <-Srv.Store.Preference().Get(member.UserId, model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW, otherUserId); result.Err != nil {
			// create a new preference since one doesn't exist yet
			preference := &model.Preference{
				UserId:   member.UserId,
				Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
				Name:     otherUserId,
				Value:    "true",
			}

			if saveResult := <-Srv.Store.Preference().Save(&model.Preferences{*preference}); saveResult.Err != nil {
				return saveResult.Err
			} else {
				message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PREFERENCE_CHANGED, "", "", member.UserId, nil)
				message.Add("preference", preference.ToJson())

				go Publish(message)
			}
		} else {
			preference := result.Data.(model.Preference)

			if preference.Value != "true" {
				// update the existing preference to make the channel visible
				preference.Value = "true"

				if updateResult := <-Srv.Store.Preference().Save(&model.Preferences{preference}); updateResult.Err != nil {
					return updateResult.Err
				} else {
					message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PREFERENCE_CHANGED, "", "", member.UserId, nil)
					message.Add("preference", preference.ToJson())

					go Publish(message)
				}
			}
		}
	}

	return nil
}

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

func JoinDefaultChannels(teamId string, user *model.User, channelRole string) *model.AppError {
	var err *model.AppError = nil

	if result := <-Srv.Store.Channel().GetByName(teamId, "town-square"); result.Err != nil {
		err = result.Err
	} else {
		cm := &model.ChannelMember{ChannelId: result.Data.(*model.Channel).Id, UserId: user.Id,
			Roles: channelRole, NotifyProps: model.GetDefaultChannelNotifyProps()}

		if cmResult := <-Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}

		post := &model.Post{
			ChannelId: result.Data.(*model.Channel).Id,
			Message:   fmt.Sprintf(utils.T("api.channel.join_channel.post_and_forget"), user.Username),
			Type:      model.POST_JOIN_LEAVE,
			UserId:    user.Id,
		}

		InvalidateCacheForChannel(result.Data.(*model.Channel).Id)

		if _, err := CreatePost(post, teamId, false); err != nil {
			l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
		}
	}

	if result := <-Srv.Store.Channel().GetByName(teamId, "off-topic"); result.Err != nil {
		err = result.Err
	} else {
		cm := &model.ChannelMember{ChannelId: result.Data.(*model.Channel).Id, UserId: user.Id,
			Roles: channelRole, NotifyProps: model.GetDefaultChannelNotifyProps()}

		if cmResult := <-Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}

		post := &model.Post{
			ChannelId: result.Data.(*model.Channel).Id,
			Message:   fmt.Sprintf(utils.T("api.channel.join_channel.post_and_forget"), user.Username),
			Type:      model.POST_JOIN_LEAVE,
			UserId:    user.Id,
		}

		InvalidateCacheForChannel(result.Data.(*model.Channel).Id)

		if _, err := CreatePost(post, teamId, false); err != nil {
			l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
		}
	}

	return err
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
	uc := Srv.Store.User().Get(otherUserId)

	if uresult := <-uc; uresult.Err != nil {
		return nil, model.NewLocAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, otherUserId)
	}

	if result := <-Srv.Store.Channel().CreateDirectChannel(userId, otherUserId); result.Err != nil {
		if result.Err.Id == store.CHANNEL_EXISTS_ERROR {
			return result.Data.(*model.Channel), nil
		} else {
			return nil, result.Err
		}
	} else {
		channel := result.Data.(*model.Channel)

		InvalidateCacheForUser(userId)
		InvalidateCacheForUser(otherUserId)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_DIRECT_ADDED, "", channel.Id, "", nil)
		message.Add("teammate_id", otherUserId)
		Publish(message)

		return channel, nil
	}
}

func AddUserToChannel(user *model.User, channel *model.Channel) (*model.ChannelMember, *model.AppError) {
	if channel.DeleteAt > 0 {
		return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user_to_channel.deleted.app_error", nil, "")
	}

	if channel.Type != model.CHANNEL_OPEN && channel.Type != model.CHANNEL_PRIVATE {
		return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "")
	}

	tmchan := Srv.Store.Team().GetMember(channel.TeamId, user.Id)
	cmchan := Srv.Store.Channel().GetMember(channel.Id, user.Id)

	if result := <-tmchan; result.Err != nil {
		return nil, result.Err
	} else {
		teamMember := result.Data.(model.TeamMember)
		if teamMember.DeleteAt > 0 {
			return nil, model.NewLocAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.deleted.app_error", nil, "")
		}
	}

	if result := <-cmchan; result.Err != nil {
		if result.Err.Id != store.MISSING_CHANNEL_MEMBER_ERROR {
			return nil, result.Err
		}
	} else {
		channelMember := result.Data.(model.ChannelMember)
		return &channelMember, nil
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

	InvalidateCacheForUser(user.Id)
	InvalidateCacheForChannel(channel.Id)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_ADDED, "", channel.Id, "", nil)
	message.Add("user_id", user.Id)
	message.Add("team_id", channel.TeamId)
	Publish(message)

	return newMember, nil
}

func AddDirectChannels(teamId string, user *model.User) *model.AppError {
	var profiles map[string]*model.User
	if result := <-Srv.Store.User().GetProfiles(teamId, 0, 100); result.Err != nil {
		return model.NewLocAppError("AddDirectChannels", "api.user.add_direct_channels_and_forget.failed.error", map[string]interface{}{"UserId": user.Id, "TeamId": teamId, "Error": result.Err.Error()}, "")
	} else {
		profiles = result.Data.(map[string]*model.User)
	}

	var preferences model.Preferences

	for id := range profiles {
		if id == user.Id {
			continue
		}

		profile := profiles[id]

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
	if result := <-Srv.Store.Channel().Get(channelId, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func GetChannelByName(channelName, teamId string) (*model.Channel, *model.AppError) {
	if result := <-Srv.Store.Channel().GetByName(teamId, channelName); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func JoinChannel(channel *model.Channel, userId string) *model.AppError {
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
			PostUserAddRemoveMessage(userId, channel.Id, channel.TeamId, fmt.Sprintf(utils.T("api.channel.join_channel.post_and_forget"), user.Username), model.POST_JOIN_LEAVE)
		} else {
			return model.NewLocAppError("JoinChannel", "api.channel.join_channel.permissions.app_error", nil, "")
		}
	}

	return nil
}

func PostUserAddRemoveMessage(userId, channelId, teamId, message, postType string) *model.AppError {
	post := &model.Post{
		ChannelId: channelId,
		Message:   message,
		Type:      postType,
		UserId:    userId,
	}
	if _, err := CreatePost(post, teamId, false); err != nil {
		return model.NewLocAppError("PostUserAddRemoveMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error())
	}

	return nil
}
