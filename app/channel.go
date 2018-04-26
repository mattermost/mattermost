// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) CreateDefaultChannels(teamId string) ([]*model.Channel, *model.AppError) {
	townSquare := &model.Channel{DisplayName: utils.T("api.channel.create_default_channels.town_square"), Name: "town-square", Type: model.CHANNEL_OPEN, TeamId: teamId}

	if _, err := a.CreateChannel(townSquare, false); err != nil {
		return nil, err
	}

	offTopic := &model.Channel{DisplayName: utils.T("api.channel.create_default_channels.off_topic"), Name: "off-topic", Type: model.CHANNEL_OPEN, TeamId: teamId}

	if _, err := a.CreateChannel(offTopic, false); err != nil {
		return nil, err
	}

	channels := []*model.Channel{townSquare, offTopic}
	return channels, nil
}

func (a *App) JoinDefaultChannels(teamId string, user *model.User, shouldBeAdmin bool, userRequestorId string) *model.AppError {
	var err *model.AppError = nil

	var requestor *model.User
	if userRequestorId != "" {
		if u := <-a.Srv.Store.User().Get(userRequestorId); u.Err != nil {
			return u.Err
		} else {
			requestor = u.Data.(*model.User)
		}
	}

	if result := <-a.Srv.Store.Channel().GetByName(teamId, "town-square", true); result.Err != nil {
		err = result.Err
	} else {
		townSquare := result.Data.(*model.Channel)

		cm := &model.ChannelMember{
			ChannelId:   townSquare.Id,
			UserId:      user.Id,
			SchemeUser:  true,
			SchemeAdmin: shouldBeAdmin,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}

		if cmResult := <-a.Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}
		if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(user.Id, townSquare.Id, model.GetMillis()); result.Err != nil {
			l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
		}

		if *a.Config().ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages {
			if requestor == nil {
				if err := a.postJoinTeamMessage(user, townSquare); err != nil {
					l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
				}
			} else {
				if err := a.postAddToTeamMessage(requestor, user, townSquare, ""); err != nil {
					l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
				}
			}
		}

		a.InvalidateCacheForChannelMembers(result.Data.(*model.Channel).Id)
	}

	if result := <-a.Srv.Store.Channel().GetByName(teamId, "off-topic", true); result.Err != nil {
		err = result.Err
	} else if offTopic := result.Data.(*model.Channel); offTopic.Type == model.CHANNEL_OPEN {

		cm := &model.ChannelMember{
			ChannelId:   offTopic.Id,
			UserId:      user.Id,
			SchemeUser:  true,
			SchemeAdmin: shouldBeAdmin,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}

		if cmResult := <-a.Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
			err = cmResult.Err
		}
		if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(user.Id, offTopic.Id, model.GetMillis()); result.Err != nil {
			l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
		}

		if requestor == nil {
			if err := a.postJoinChannelMessage(user, offTopic); err != nil {
				l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
			}
		} else {
			if err := a.PostAddToChannelMessage(requestor, user, offTopic, ""); err != nil {
				l4g.Error(utils.T("api.channel.post_user_add_remove_message_and_forget.error"), err)
			}
		}

		a.InvalidateCacheForChannelMembers(result.Data.(*model.Channel).Id)
	}

	return err
}

func (a *App) CreateChannelWithUser(channel *model.Channel, userId string) (*model.Channel, *model.AppError) {
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
	if count, err := a.GetNumberOfChannelsOnTeam(channel.TeamId); err != nil {
		return nil, err
	} else {
		if int64(count+1) > *a.Config().TeamSettings.MaxChannelsPerTeam {
			return nil, model.NewAppError("CreateChannelWithUser", "api.channel.create_channel.max_channel_limit.app_error", map[string]interface{}{"MaxChannelsPerTeam": *a.Config().TeamSettings.MaxChannelsPerTeam}, "", http.StatusBadRequest)
		}
	}

	channel.CreatorId = userId

	rchannel, err := a.CreateChannel(channel, true)
	if err != nil {
		return nil, err
	}

	var user *model.User
	if user, err = a.GetUser(userId); err != nil {
		return nil, err
	}

	a.postJoinChannelMessage(user, channel)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_CREATED, "", "", userId, nil)
	message.Add("channel_id", channel.Id)
	message.Add("team_id", channel.TeamId)
	a.Publish(message)

	return rchannel, nil
}

func (a *App) CreateChannel(channel *model.Channel, addMember bool) (*model.Channel, *model.AppError) {
	if result := <-a.Srv.Store.Channel().Save(channel, *a.Config().TeamSettings.MaxChannelsPerTeam); result.Err != nil {
		return nil, result.Err
	} else {
		sc := result.Data.(*model.Channel)

		if addMember {
			cm := &model.ChannelMember{
				ChannelId:   sc.Id,
				UserId:      channel.CreatorId,
				SchemeUser:  true,
				SchemeAdmin: true,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			}

			if cmresult := <-a.Srv.Store.Channel().SaveMember(cm); cmresult.Err != nil {
				return nil, cmresult.Err
			}
			if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(channel.CreatorId, sc.Id, model.GetMillis()); result.Err != nil {
				l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
			}

			a.InvalidateCacheForUser(channel.CreatorId)
		}

		return sc, nil
	}
}

func (a *App) CreateDirectChannel(userId string, otherUserId string) (*model.Channel, *model.AppError) {
	if channel, err := a.createDirectChannel(userId, otherUserId); err != nil {
		if err.Id == store.CHANNEL_EXISTS_ERROR {
			return channel, nil
		} else {
			return nil, err
		}
	} else {
		a.WaitForChannelMembership(channel.Id, userId)

		a.InvalidateCacheForUser(userId)
		a.InvalidateCacheForUser(otherUserId)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_DIRECT_ADDED, "", channel.Id, "", nil)
		message.Add("teammate_id", otherUserId)
		a.Publish(message)

		return channel, nil
	}
}

func (a *App) createDirectChannel(userId string, otherUserId string) (*model.Channel, *model.AppError) {
	uc1 := a.Srv.Store.User().Get(userId)
	uc2 := a.Srv.Store.User().Get(otherUserId)

	if result := <-uc1; result.Err != nil {
		return nil, model.NewAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, userId, http.StatusBadRequest)
	}

	if result := <-uc2; result.Err != nil {
		return nil, model.NewAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, otherUserId, http.StatusBadRequest)
	}

	if result := <-a.Srv.Store.Channel().CreateDirectChannel(userId, otherUserId); result.Err != nil {
		if result.Err.Id == store.CHANNEL_EXISTS_ERROR {
			return result.Data.(*model.Channel), result.Err
		} else {
			return nil, result.Err
		}
	} else {
		channel := result.Data.(*model.Channel)

		if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(userId, channel.Id, model.GetMillis()); result.Err != nil {
			l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
		}
		if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(otherUserId, channel.Id, model.GetMillis()); result.Err != nil {
			l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
		}

		return channel, nil
	}
}

func (a *App) WaitForChannelMembership(channelId string, userId string) {
	if len(a.Config().SqlSettings.DataSourceReplicas) > 0 {
		now := model.GetMillis()

		for model.GetMillis()-now < 12000 {

			time.Sleep(100 * time.Millisecond)

			result := <-a.Srv.Store.Channel().GetMember(channelId, userId)

			// If the membership was found then return
			if result.Err == nil {
				return
			}

			// If we received a error but it wasn't a missing channel member then return
			if result.Err.Id != store.MISSING_CHANNEL_MEMBER_ERROR {
				return
			}
		}

		l4g.Error("WaitForChannelMembership giving up channelId=%v userId=%v", channelId, userId)
	}
}

func (a *App) CreateGroupChannel(userIds []string, creatorId string) (*model.Channel, *model.AppError) {
	if channel, err := a.createGroupChannel(userIds, creatorId); err != nil {
		if err.Id == store.CHANNEL_EXISTS_ERROR {
			return channel, nil
		} else {
			return nil, err
		}
	} else {
		for _, userId := range userIds {
			if userId == creatorId {
				a.WaitForChannelMembership(channel.Id, creatorId)
			}

			a.InvalidateCacheForUser(userId)
		}

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_GROUP_ADDED, "", channel.Id, "", nil)
		message.Add("teammate_ids", model.ArrayToJson(userIds))
		a.Publish(message)

		return channel, nil
	}
}

func (a *App) createGroupChannel(userIds []string, creatorId string) (*model.Channel, *model.AppError) {
	if len(userIds) > model.CHANNEL_GROUP_MAX_USERS || len(userIds) < model.CHANNEL_GROUP_MIN_USERS {
		return nil, model.NewAppError("CreateGroupChannel", "api.channel.create_group.bad_size.app_error", nil, "", http.StatusBadRequest)
	}

	var users []*model.User
	if result := <-a.Srv.Store.User().GetProfileByIds(userIds, true); result.Err != nil {
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

	if result := <-a.Srv.Store.Channel().Save(group, *a.Config().TeamSettings.MaxChannelsPerTeam); result.Err != nil {
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
				SchemeUser:  true,
			}

			if result := <-a.Srv.Store.Channel().SaveMember(cm); result.Err != nil {
				return nil, result.Err
			}
			if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()); result.Err != nil {
				l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
			}
		}

		return channel, nil
	}
}

func (a *App) UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	if result := <-a.Srv.Store.Channel().Update(channel); result.Err != nil {
		return nil, result.Err
	} else {
		a.InvalidateCacheForChannel(channel)

		messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_UPDATED, "", channel.Id, "", nil)
		messageWs.Add("channel", channel.ToJson())
		a.Publish(messageWs)

		return channel, nil
	}
}

func (a *App) UpdateChannelScheme(channel *model.Channel) (*model.Channel, *model.AppError) {
	var oldChannel *model.Channel
	var err *model.AppError
	if oldChannel, err = a.GetChannel(channel.Id); err != nil {
		return nil, err
	}

	oldChannel.SchemeId = channel.SchemeId

	newChannel, err := a.UpdateChannel(oldChannel)
	if err != nil {
		return nil, err
	}

	return newChannel, nil
}

func (a *App) UpdateChannelPrivacy(oldChannel *model.Channel, user *model.User) (*model.Channel, *model.AppError) {
	if channel, err := a.UpdateChannel(oldChannel); err != nil {
		return channel, err
	} else {
		if err := a.postChannelPrivacyMessage(user, channel); err != nil {
			if channel.Type == model.CHANNEL_OPEN {
				channel.Type = model.CHANNEL_PRIVATE
			} else {
				channel.Type = model.CHANNEL_OPEN
			}
			// revert to previous channel privacy
			a.UpdateChannel(channel)
			return channel, err
		}

		return channel, nil
	}
}

func (a *App) postChannelPrivacyMessage(user *model.User, channel *model.Channel) *model.AppError {
	privacy := (map[string]string{
		model.CHANNEL_OPEN:    "private_to_public",
		model.CHANNEL_PRIVATE: "public_to_private",
	})[channel.Type]
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   utils.T("api.channel.change_channel_privacy." + privacy),
		Type:      model.POST_CHANGE_CHANNEL_PRIVACY,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postChannelPrivacyMessage", "api.channel.post_channel_privacy_message.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) RestoreChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	if result := <-a.Srv.Store.Channel().Restore(channel.Id, model.GetMillis()); result.Err != nil {
		return nil, result.Err
	} else {
		return channel, nil
	}
}

func (a *App) PatchChannel(channel *model.Channel, patch *model.ChannelPatch, userId string) (*model.Channel, *model.AppError) {
	oldChannelDisplayName := channel.DisplayName
	oldChannelHeader := channel.Header
	oldChannelPurpose := channel.Purpose

	channel.Patch(patch)
	channel, err := a.UpdateChannel(channel)
	if err != nil {
		return nil, err
	}

	if oldChannelDisplayName != channel.DisplayName {
		if err := a.PostUpdateChannelDisplayNameMessage(userId, channel, oldChannelDisplayName, channel.DisplayName); err != nil {
			l4g.Error(err.Error())
		}
	}

	if channel.Header != oldChannelHeader {
		if err := a.PostUpdateChannelHeaderMessage(userId, channel, oldChannelHeader, channel.Header); err != nil {
			l4g.Error(err.Error())
		}
	}

	if channel.Purpose != oldChannelPurpose {
		if err := a.PostUpdateChannelPurposeMessage(userId, channel, oldChannelPurpose, channel.Purpose); err != nil {
			l4g.Error(err.Error())
		}
	}

	return channel, err
}

func (a *App) GetSchemeRolesForChannel(channelId string) (string, string, *model.AppError) {
	var channel *model.Channel
	var err *model.AppError

	if channel, err = a.GetChannel(channelId); err != nil {
		return "", "", err
	}

	if channel.SchemeId != nil && len(*channel.SchemeId) != 0 {
		if scheme, err := a.GetScheme(*channel.SchemeId); err != nil {
			return "", "", err
		} else {
			return scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole, nil
		}
	}

	var team *model.Team

	if team, err = a.GetTeam(channel.TeamId); err != nil {
		return "", "", err
	}

	if team.SchemeId != nil && len(*team.SchemeId) != 0 {
		if scheme, err := a.GetScheme(*team.SchemeId); err != nil {
			return "", "", err
		} else {
			return scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole, nil
		}
	}

	return model.CHANNEL_USER_ROLE_ID, model.CHANNEL_ADMIN_ROLE_ID, nil
}

func (a *App) UpdateChannelMemberRoles(channelId string, userId string, newRoles string) (*model.ChannelMember, *model.AppError) {
	var member *model.ChannelMember
	var err *model.AppError
	if member, err = a.GetChannelMember(channelId, userId); err != nil {
		return nil, err
	}

	schemeUserRole, schemeAdminRole, err := a.GetSchemeRolesForChannel(channelId)
	if err != nil {
		return nil, err
	}

	var newExplicitRoles []string
	member.SchemeUser = false
	member.SchemeAdmin = false

	for _, roleName := range strings.Fields(newRoles) {
		if role, err := a.GetRoleByName(roleName); err != nil {
			err.StatusCode = http.StatusBadRequest
			return nil, err
		} else if !role.SchemeManaged {
			// The role is not scheme-managed, so it's OK to apply it to the explicit roles field.
			newExplicitRoles = append(newExplicitRoles, roleName)
		} else {
			// The role is scheme-managed, so need to check if it is part of the scheme for this channel or not.
			switch roleName {
			case schemeAdminRole:
				member.SchemeAdmin = true
			case schemeUserRole:
				member.SchemeUser = true
			default:
				// If not part of the scheme for this channel, then it is not allowed to apply it as an explicit role.
				return nil, model.NewAppError("UpdateChannelMemberRoles", "api.channel.update_channel_member_roles.scheme_role.app_error", nil, "role_name="+roleName, http.StatusBadRequest)
			}
		}
	}

	member.ExplicitRoles = strings.Join(newExplicitRoles, " ")

	if result := <-a.Srv.Store.Channel().UpdateMember(member); result.Err != nil {
		return nil, result.Err
	} else {
		member = result.Data.(*model.ChannelMember)
	}

	a.InvalidateCacheForUser(userId)
	return member, nil
}

func (a *App) UpdateChannelMemberNotifyProps(data map[string]string, channelId string, userId string) (*model.ChannelMember, *model.AppError) {
	var member *model.ChannelMember
	var err *model.AppError
	if member, err = a.GetChannelMember(channelId, userId); err != nil {
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

	if result := <-a.Srv.Store.Channel().UpdateMember(member); result.Err != nil {
		return nil, result.Err
	} else {
		a.InvalidateCacheForUser(userId)
		a.InvalidateCacheForChannelMembersNotifyProps(channelId)
		// Notify the clients that the member notify props changed
		evt := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_MEMBER_UPDATED, "", "", userId, nil)
		evt.Add("channelMember", member.ToJson())
		a.Publish(evt)
		return member, nil
	}
}

func (a *App) DeleteChannel(channel *model.Channel, userId string) *model.AppError {
	ihc := a.Srv.Store.Webhook().GetIncomingByChannel(channel.Id)
	ohc := a.Srv.Store.Webhook().GetOutgoingByChannel(channel.Id, -1, -1)

	var user *model.User
	if userId != "" {
		uc := a.Srv.Store.User().Get(userId)
		uresult := <-uc
		if uresult.Err != nil {
			return uresult.Err
		}
		user = uresult.Data.(*model.User)
	}

	if ihcresult := <-ihc; ihcresult.Err != nil {
		return ihcresult.Err
	} else if ohcresult := <-ohc; ohcresult.Err != nil {
		return ohcresult.Err
	} else {
		incomingHooks := ihcresult.Data.([]*model.IncomingWebhook)
		outgoingHooks := ohcresult.Data.([]*model.OutgoingWebhook)

		if channel.DeleteAt > 0 {
			err := model.NewAppError("deleteChannel", "api.channel.delete_channel.deleted.app_error", nil, "", http.StatusBadRequest)
			return err
		}

		if channel.Name == model.DEFAULT_CHANNEL {
			err := model.NewAppError("deleteChannel", "api.channel.delete_channel.cannot.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "", http.StatusBadRequest)
			return err
		}

		if user != nil {
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

			if _, err := a.CreatePost(post, channel, false); err != nil {
				l4g.Error(utils.T("api.channel.delete_channel.failed_post.error"), err)
			}
		}

		now := model.GetMillis()
		for _, hook := range incomingHooks {
			if result := <-a.Srv.Store.Webhook().DeleteIncoming(hook.Id, now); result.Err != nil {
				l4g.Error(utils.T("api.channel.delete_channel.incoming_webhook.error"), hook.Id)
			}
			a.InvalidateCacheForWebhook(hook.Id)
		}

		for _, hook := range outgoingHooks {
			if result := <-a.Srv.Store.Webhook().DeleteOutgoing(hook.Id, now); result.Err != nil {
				l4g.Error(utils.T("api.channel.delete_channel.outgoing_webhook.error"), hook.Id)
			}
		}

		if dresult := <-a.Srv.Store.Channel().Delete(channel.Id, model.GetMillis()); dresult.Err != nil {
			return dresult.Err
		}
		a.InvalidateCacheForChannel(channel)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_DELETED, channel.TeamId, "", "", nil)
		message.Add("channel_id", channel.Id)
		a.Publish(message)
	}

	return nil
}

func (a *App) addUserToChannel(user *model.User, channel *model.Channel, teamMember *model.TeamMember) (*model.ChannelMember, *model.AppError) {
	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user_to_channel.deleted.app_error", nil, "", http.StatusBadRequest)
	}

	if channel.Type != model.CHANNEL_OPEN && channel.Type != model.CHANNEL_PRIVATE {
		return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusBadRequest)
	}

	cmchan := a.Srv.Store.Channel().GetMember(channel.Id, user.Id)

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
		SchemeUser:  true,
	}
	if result := <-a.Srv.Store.Channel().SaveMember(newMember); result.Err != nil {
		l4g.Error("Failed to add member user_id=%v channel_id=%v err=%v", user.Id, channel.Id, result.Err)
		return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.app_error", nil, "", http.StatusInternalServerError)
	}
	a.WaitForChannelMembership(channel.Id, user.Id)

	if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()); result.Err != nil {
		l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
	}

	a.InvalidateCacheForUser(user.Id)
	a.InvalidateCacheForChannelMembers(channel.Id)

	return newMember, nil
}

func (a *App) AddUserToChannel(user *model.User, channel *model.Channel) (*model.ChannelMember, *model.AppError) {
	tmchan := a.Srv.Store.Team().GetMember(channel.TeamId, user.Id)
	var teamMember *model.TeamMember

	if result := <-tmchan; result.Err != nil {
		return nil, result.Err
	} else {
		teamMember = result.Data.(*model.TeamMember)
		if teamMember.DeleteAt > 0 {
			return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.deleted.app_error", nil, "", http.StatusBadRequest)
		}
	}

	newMember, err := a.addUserToChannel(user, channel, teamMember)
	if err != nil {
		return nil, err
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_ADDED, "", channel.Id, "", nil)
	message.Add("user_id", user.Id)
	message.Add("team_id", channel.TeamId)
	a.Publish(message)

	return newMember, nil
}

func (a *App) AddChannelMember(userId string, channel *model.Channel, userRequestorId string, postRootId string) (*model.ChannelMember, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetMember(channel.Id, userId); result.Err != nil {
		if result.Err.Id != store.MISSING_CHANNEL_MEMBER_ERROR {
			return nil, result.Err
		}
	} else {
		return result.Data.(*model.ChannelMember), nil
	}

	var user *model.User
	var err *model.AppError

	if user, err = a.GetUser(userId); err != nil {
		return nil, err
	}

	var userRequestor *model.User
	if userRequestorId != "" {
		if userRequestor, err = a.GetUser(userRequestorId); err != nil {
			return nil, err
		}
	}

	cm, err := a.AddUserToChannel(user, channel)
	if err != nil {
		return nil, err
	}

	if userRequestorId == "" || userId == userRequestorId {
		a.postJoinChannelMessage(user, channel)
	} else {
		a.Go(func() {
			a.PostAddToChannelMessage(userRequestor, user, channel, postRootId)
		})
	}

	if userRequestor != nil {
		a.UpdateChannelLastViewedAt([]string{channel.Id}, userRequestor.Id)
	}

	return cm, nil
}

func (a *App) AddDirectChannels(teamId string, user *model.User) *model.AppError {
	var profiles []*model.User
	if result := <-a.Srv.Store.User().GetProfiles(teamId, 0, 100); result.Err != nil {
		return model.NewAppError("AddDirectChannels", "api.user.add_direct_channels_and_forget.failed.error", map[string]interface{}{"UserId": user.Id, "TeamId": teamId, "Error": result.Err.Error()}, "", http.StatusInternalServerError)
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

	if result := <-a.Srv.Store.Preference().Save(&preferences); result.Err != nil {
		return model.NewAppError("AddDirectChannels", "api.user.add_direct_channels_and_forget.failed.error", map[string]interface{}{"UserId": user.Id, "TeamId": teamId, "Error": result.Err.Error()}, "", http.StatusInternalServerError)
	}

	return nil
}

func (a *App) PostUpdateChannelHeaderMessage(userId string, channel *model.Channel, oldChannelHeader, newChannelHeader string) *model.AppError {
	uc := a.Srv.Store.User().Get(userId)

	if uresult := <-uc; uresult.Err != nil {
		return model.NewAppError("PostUpdateChannelHeaderMessage", "api.channel.post_update_channel_header_message_and_forget.retrieve_user.error", nil, uresult.Err.Error(), http.StatusBadRequest)
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
			ChannelId: channel.Id,
			Message:   message,
			Type:      model.POST_HEADER_CHANGE,
			UserId:    userId,
			Props: model.StringInterface{
				"username":   user.Username,
				"old_header": oldChannelHeader,
				"new_header": newChannelHeader,
			},
		}

		if _, err := a.CreatePost(post, channel, false); err != nil {
			return model.NewAppError("", "api.channel.post_update_channel_header_message_and_forget.post.error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) PostUpdateChannelPurposeMessage(userId string, channel *model.Channel, oldChannelPurpose string, newChannelPurpose string) *model.AppError {
	uc := a.Srv.Store.User().Get(userId)

	if uresult := <-uc; uresult.Err != nil {
		return model.NewAppError("PostUpdateChannelPurposeMessage", "app.channel.post_update_channel_purpose_message.retrieve_user.error", nil, uresult.Err.Error(), http.StatusBadRequest)
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
			ChannelId: channel.Id,
			Message:   message,
			Type:      model.POST_PURPOSE_CHANGE,
			UserId:    userId,
			Props: model.StringInterface{
				"username":    user.Username,
				"old_purpose": oldChannelPurpose,
				"new_purpose": newChannelPurpose,
			},
		}
		if _, err := a.CreatePost(post, channel, false); err != nil {
			return model.NewAppError("", "app.channel.post_update_channel_purpose_message.post.error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) PostUpdateChannelDisplayNameMessage(userId string, channel *model.Channel, oldChannelDisplayName, newChannelDisplayName string) *model.AppError {
	uc := a.Srv.Store.User().Get(userId)

	if uresult := <-uc; uresult.Err != nil {
		return model.NewAppError("PostUpdateChannelDisplayNameMessage", "api.channel.post_update_channel_displayname_message_and_forget.retrieve_user.error", nil, uresult.Err.Error(), http.StatusBadRequest)
	} else {
		user := uresult.Data.(*model.User)

		message := fmt.Sprintf(utils.T("api.channel.post_update_channel_displayname_message_and_forget.updated_from"), user.Username, oldChannelDisplayName, newChannelDisplayName)

		post := &model.Post{
			ChannelId: channel.Id,
			Message:   message,
			Type:      model.POST_DISPLAYNAME_CHANGE,
			UserId:    userId,
			Props: model.StringInterface{
				"username":        user.Username,
				"old_displayname": oldChannelDisplayName,
				"new_displayname": newChannelDisplayName,
			},
		}

		if _, err := a.CreatePost(post, channel, false); err != nil {
			return model.NewAppError("PostUpdateChannelDisplayNameMessage", "api.channel.post_update_channel_displayname_message_and_forget.create_post.error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) GetChannel(channelId string) (*model.Channel, *model.AppError) {
	if result := <-a.Srv.Store.Channel().Get(channelId, true); result.Err != nil && result.Err.Id == "store.sql_channel.get.existing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func (a *App) GetChannelByName(channelName, teamId string) (*model.Channel, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetByName(teamId, channelName, true); result.Err != nil && result.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func (a *App) GetChannelsByNames(channelNames []string, teamId string) ([]*model.Channel, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetByNames(teamId, channelNames, true); result.Err != nil && result.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.([]*model.Channel), nil
	}
}

func (a *App) GetChannelByNameForTeamName(channelName, teamName string) (*model.Channel, *model.AppError) {
	var team *model.Team

	if result := <-a.Srv.Store.Team().GetByName(teamName); result.Err != nil {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else {
		team = result.Data.(*model.Team)
	}

	if result := <-a.Srv.Store.Channel().GetByName(team.Id, channelName, true); result.Err != nil && result.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	} else if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.(*model.Channel), nil
	}
}

func (a *App) GetChannelsForUser(teamId string, userId string) (*model.ChannelList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetChannels(teamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func (a *App) GetDeletedChannels(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetDeleted(teamId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func (a *App) GetChannelsUserNotIn(teamId string, userId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetMoreChannels(teamId, userId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func (a *App) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) (*model.ChannelList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetPublicChannelsByIdsForTeam(teamId, channelIds); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func (a *App) GetPublicChannelsForTeam(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetPublicChannelsForTeam(teamId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func (a *App) GetChannelMember(channelId string, userId string) (*model.ChannelMember, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetMember(channelId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelMember), nil
	}
}

func (a *App) GetChannelMembersPage(channelId string, page, perPage int) (*model.ChannelMembers, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetMembers(channelId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelMembers), nil
	}
}

func (a *App) GetChannelMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetMembersByIds(channelId, userIds); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelMembers), nil
	}
}

func (a *App) GetChannelMembersForUser(teamId string, userId string) (*model.ChannelMembers, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetMembersForUser(teamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelMembers), nil
	}
}

func (a *App) GetChannelMemberCount(channelId string) (int64, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetMemberCount(channelId, true); result.Err != nil {
		return 0, result.Err
	} else {
		return result.Data.(int64), nil
	}
}

func (a *App) GetChannelCounts(teamId string, userId string) (*model.ChannelCounts, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetChannelCounts(teamId, userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelCounts), nil
	}
}

func (a *App) GetChannelUnread(channelId, userId string) (*model.ChannelUnread, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetChannelUnread(channelId, userId)
	if result.Err != nil {
		return nil, result.Err
	}
	channelUnread := result.Data.(*model.ChannelUnread)

	if channelUnread.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.CHANNEL_MARK_UNREAD_MENTION {
		channelUnread.MsgCount = 0
	}

	return channelUnread, nil
}

func (a *App) JoinChannel(channel *model.Channel, userId string) *model.AppError {
	if channel.DeleteAt > 0 {
		return model.NewAppError("JoinChannel", "api.channel.join_channel.already_deleted.app_error", nil, "", http.StatusBadRequest)
	}

	userChan := a.Srv.Store.User().Get(userId)
	memberChan := a.Srv.Store.Channel().GetMember(channel.Id, userId)

	if uresult := <-userChan; uresult.Err != nil {
		return uresult.Err
	} else if mresult := <-memberChan; mresult.Err == nil && mresult.Data != nil {
		// user is already in the channel
		return nil
	} else {
		user := uresult.Data.(*model.User)

		if channel.Type == model.CHANNEL_OPEN {
			if _, err := a.AddUserToChannel(user, channel); err != nil {
				return err
			}

			if err := a.postJoinChannelMessage(user, channel); err != nil {
				return err
			}
		} else {
			return model.NewAppError("JoinChannel", "api.channel.join_channel.permissions.app_error", nil, "", http.StatusBadRequest)
		}
	}

	return nil
}

func (a *App) postJoinChannelMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.channel.join_channel.post_and_forget"), user.Username),
		Type:      model.POST_JOIN_CHANNEL,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postJoinChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) postJoinTeamMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.team.join_team.post_and_forget"), user.Username),
		Type:      model.POST_JOIN_TEAM,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postJoinTeamMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) LeaveChannel(channelId string, userId string) *model.AppError {
	sc := a.Srv.Store.Channel().Get(channelId, true)
	uc := a.Srv.Store.User().Get(userId)
	ccm := a.Srv.Store.Channel().GetMemberCount(channelId, false)

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
			err := model.NewAppError("LeaveChannel", "api.channel.leave.direct.app_error", nil, "", http.StatusBadRequest)
			return err
		}

		if channel.Type == model.CHANNEL_PRIVATE && membersCount == 1 {
			err := model.NewAppError("LeaveChannel", "api.channel.leave.last_member.app_error", nil, "userId="+user.Id, http.StatusBadRequest)
			return err
		}

		if err := a.removeUserFromChannel(userId, userId, channel); err != nil {
			return err
		}

		if channel.Name == model.DEFAULT_CHANNEL && !*a.Config().ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages {
			return nil
		}

		a.Go(func() {
			a.postLeaveChannelMessage(user, channel)
		})
	}

	return nil
}

func (a *App) postLeaveChannelMessage(user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.channel.leave.left"), user.Username),
		Type:      model.POST_LEAVE_CHANNEL,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postLeaveChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) PostAddToChannelMessage(user *model.User, addedUser *model.User, channel *model.Channel, postRootId string) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.channel.add_member.added"), addedUser.Username, user.Username),
		Type:      model.POST_ADD_TO_CHANNEL,
		UserId:    user.Id,
		RootId:    postRootId,
		Props: model.StringInterface{
			"userId":                       user.Id,
			"username":                     user.Username,
			model.POST_PROPS_ADDED_USER_ID: addedUser.Id,
			"addedUsername":                addedUser.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postAddToChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) postAddToTeamMessage(user *model.User, addedUser *model.User, channel *model.Channel, postRootId string) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.team.add_user_to_team.added"), addedUser.Username, user.Username),
		Type:      model.POST_ADD_TO_TEAM,
		UserId:    user.Id,
		RootId:    postRootId,
		Props: model.StringInterface{
			"userId":                       user.Id,
			"username":                     user.Username,
			model.POST_PROPS_ADDED_USER_ID: addedUser.Id,
			"addedUsername":                addedUser.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postAddToTeamMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) postRemoveFromChannelMessage(removerUserId string, removedUser *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.channel.remove_member.removed"), removedUser.Username),
		Type:      model.POST_REMOVE_FROM_CHANNEL,
		UserId:    removerUserId,
		Props: model.StringInterface{
			"removedUserId":   removedUser.Id,
			"removedUsername": removedUser.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postRemoveFromChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) removeUserFromChannel(userIdToRemove string, removerUserId string, channel *model.Channel) *model.AppError {
	if channel.DeleteAt > 0 {
		err := model.NewAppError("RemoveUserFromChannel", "api.channel.remove_user_from_channel.deleted.app_error", nil, "", http.StatusBadRequest)
		return err
	}

	if channel.Name == model.DEFAULT_CHANNEL {
		return model.NewAppError("RemoveUserFromChannel", "api.channel.remove.default.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "", http.StatusBadRequest)
	}

	if cmresult := <-a.Srv.Store.Channel().RemoveMember(channel.Id, userIdToRemove); cmresult.Err != nil {
		return cmresult.Err
	}
	if cmhResult := <-a.Srv.Store.ChannelMemberHistory().LogLeaveEvent(userIdToRemove, channel.Id, model.GetMillis()); cmhResult.Err != nil {
		return cmhResult.Err
	}

	a.InvalidateCacheForUser(userIdToRemove)
	a.InvalidateCacheForChannelMembers(channel.Id)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_REMOVED, "", channel.Id, "", nil)
	message.Add("user_id", userIdToRemove)
	message.Add("remover_id", removerUserId)
	a.Publish(message)

	// because the removed user no longer belongs to the channel we need to send a separate websocket event
	userMsg := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_REMOVED, "", "", userIdToRemove, nil)
	userMsg.Add("channel_id", channel.Id)
	userMsg.Add("remover_id", removerUserId)
	a.Publish(userMsg)

	return nil
}

func (a *App) RemoveUserFromChannel(userIdToRemove string, removerUserId string, channel *model.Channel) *model.AppError {
	var err *model.AppError
	if err = a.removeUserFromChannel(userIdToRemove, removerUserId, channel); err != nil {
		return err
	}

	var user *model.User
	if user, err = a.GetUser(userIdToRemove); err != nil {
		return err
	}

	if userIdToRemove == removerUserId {
		a.postLeaveChannelMessage(user, channel)
	} else {
		a.Go(func() {
			a.postRemoveFromChannelMessage(removerUserId, user, channel)
		})
	}

	return nil
}

func (a *App) GetNumberOfChannelsOnTeam(teamId string) (int, *model.AppError) {
	// Get total number of channels on current team
	if result := <-a.Srv.Store.Channel().GetTeamChannels(teamId); result.Err != nil {
		return 0, result.Err
	} else {
		return len(*result.Data.(*model.ChannelList)), nil
	}
}

func (a *App) SetActiveChannel(userId string, channelId string) *model.AppError {
	status, err := a.GetStatus(userId)

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

	a.AddStatusCache(status)

	if status.Status != oldStatus {
		a.BroadcastStatus(status)
	}

	return nil
}

func (a *App) UpdateChannelLastViewedAt(channelIds []string, userId string) *model.AppError {
	if result := <-a.Srv.Store.Channel().UpdateLastViewedAt(channelIds, userId); result.Err != nil {
		return result.Err
	}

	if *a.Config().ServiceSettings.EnableChannelViewedMessages {
		for _, channelId := range channelIds {
			message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, "", "", userId, nil)
			message.Add("channel_id", channelId)
			a.Publish(message)
		}
	}

	return nil
}

func (a *App) AutocompleteChannels(teamId string, term string) (*model.ChannelList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().AutocompleteInTeam(teamId, term); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func (a *App) SearchChannels(teamId string, term string) (*model.ChannelList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().SearchInTeam(teamId, term); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func (a *App) SearchChannelsUserNotIn(teamId string, userId string, term string) (*model.ChannelList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().SearchMore(userId, teamId, term); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.ChannelList), nil
	}
}

func (a *App) ViewChannel(view *model.ChannelView, userId string, clearPushNotifications bool) (map[string]int64, *model.AppError) {
	if err := a.SetActiveChannel(userId, view.ChannelId); err != nil {
		return nil, err
	}

	channelIds := []string{}

	if len(view.ChannelId) > 0 {
		channelIds = append(channelIds, view.ChannelId)
	}

	var pchan store.StoreChannel
	if len(view.PrevChannelId) > 0 {
		channelIds = append(channelIds, view.PrevChannelId)

		if *a.Config().EmailSettings.SendPushNotifications && clearPushNotifications && len(view.ChannelId) > 0 {
			pchan = a.Srv.Store.User().GetUnreadCountForChannel(userId, view.ChannelId)
		}
	}

	if len(channelIds) == 0 {
		return map[string]int64{}, nil
	}

	uchan := a.Srv.Store.Channel().UpdateLastViewedAt(channelIds, userId)

	if pchan != nil {
		if result := <-pchan; result.Err != nil {
			return nil, result.Err
		} else {
			if result.Data.(int64) > 0 {
				a.ClearPushNotification(userId, view.ChannelId)
			}
		}
	}

	var times map[string]int64
	if result := <-uchan; result.Err != nil {
		return nil, result.Err
	} else {
		times = result.Data.(map[string]int64)
	}

	if *a.Config().ServiceSettings.EnableChannelViewedMessages && model.IsValidId(view.ChannelId) {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, "", "", userId, nil)
		message.Add("channel_id", view.ChannelId)
		a.Publish(message)
	}

	return times, nil
}

func (a *App) PermanentDeleteChannel(channel *model.Channel) *model.AppError {
	if result := <-a.Srv.Store.Post().PermanentDeleteByChannel(channel.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Channel().PermanentDeleteMembersByChannel(channel.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Webhook().PermanentDeleteIncomingByChannel(channel.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Webhook().PermanentDeleteOutgoingByChannel(channel.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Channel().PermanentDelete(channel.Id); result.Err != nil {
		return result.Err
	}

	return nil
}

// This function is intended for use from the CLI. It is not robust against people joining the channel while the move
// is in progress, and therefore should not be used from the API without first fixing this potential race condition.
func (a *App) MoveChannel(team *model.Team, channel *model.Channel, user *model.User) *model.AppError {
	// Check that all channel members are in the destination team.
	if channelMembers, err := a.GetChannelMembersPage(channel.Id, 0, 10000000); err != nil {
		return err
	} else {
		channelMemberIds := []string{}
		for _, channelMember := range *channelMembers {
			channelMemberIds = append(channelMemberIds, channelMember.UserId)
		}

		if teamMembers, err2 := a.GetTeamMembersByIds(team.Id, channelMemberIds); err != nil {
			return err2
		} else {
			if len(teamMembers) != len(*channelMembers) {
				return model.NewAppError("MoveChannel", "app.channel.move_channel.members_do_not_match.error", nil, "", http.StatusInternalServerError)
			}
		}
	}

	// keep instance of the previous team
	var previousTeam *model.Team
	if result := <-a.Srv.Store.Team().Get(channel.TeamId); result.Err != nil {
		return result.Err
	} else {
		previousTeam = result.Data.(*model.Team)
	}
	channel.TeamId = team.Id
	if result := <-a.Srv.Store.Channel().Update(channel); result.Err != nil {
		return result.Err
	}
	a.postChannelMoveMessage(user, channel, previousTeam)

	return nil
}

func (a *App) postChannelMoveMessage(user *model.User, channel *model.Channel, previousTeam *model.Team) *model.AppError {

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(utils.T("api.team.move_channel.success"), previousTeam.Name),
		Type:      model.POST_MOVE_CHANNEL,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(post, channel, false); err != nil {
		return model.NewAppError("postChannelMoveMessage", "api.team.move_channel.post.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) GetPinnedPosts(channelId string) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Channel().GetPinnedPosts(channelId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetByName("", model.GetDMNameFromIds(userId1, userId2), true)
	if result.Err != nil && result.Err.Id == store.MISSING_CHANNEL_ERROR {
		result := <-a.Srv.Store.Channel().CreateDirectChannel(userId1, userId2)
		if result.Err != nil {
			return nil, model.NewAppError("GetOrCreateDMChannel", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message, http.StatusBadRequest)
		}
		a.InvalidateCacheForUser(userId1)
		a.InvalidateCacheForUser(userId2)

		channel := result.Data.(*model.Channel)
		if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(userId1, channel.Id, model.GetMillis()); result.Err != nil {
			l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
		}
		if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(userId2, channel.Id, model.GetMillis()); result.Err != nil {
			l4g.Warn("Failed to update ChannelMemberHistory table %v", result.Err)
		}

		return channel, nil
	} else if result.Err != nil {
		return nil, model.NewAppError("GetOrCreateDMChannel", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message, result.Err.StatusCode)
	}
	return result.Data.(*model.Channel), nil
}

func (a *App) ToggleMuteChannel(channelId string, userId string) *model.ChannelMember {
	result := <-a.Srv.Store.Channel().GetMember(channelId, userId)

	if result.Err != nil {
		return nil
	}

	member := result.Data.(*model.ChannelMember)

	if member.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.CHANNEL_NOTIFY_MENTION {
		member.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_MARK_UNREAD_ALL
	} else {
		member.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] = model.CHANNEL_NOTIFY_MENTION
	}

	a.Srv.Store.Channel().UpdateMember(member)
	return member
}
