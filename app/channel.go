// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
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
		u := <-a.Srv.Store.User().Get(userRequestorId)
		if u.Err != nil {
			return u.Err
		}
		requestor = u.Data.(*model.User)
	}

	defaultChannelList := []string{"town-square"}

	if len(a.Config().TeamSettings.ExperimentalDefaultChannels) == 0 {
		defaultChannelList = append(defaultChannelList, "off-topic")
	} else {
		seenChannels := map[string]bool{}
		for _, channelName := range a.Config().TeamSettings.ExperimentalDefaultChannels {
			if !seenChannels[channelName] {
				defaultChannelList = append(defaultChannelList, channelName)
				seenChannels[channelName] = true
			}
		}
	}

	for _, channelName := range defaultChannelList {
		if result := <-a.Srv.Store.Channel().GetByName(teamId, channelName, true); result.Err != nil {
			err = result.Err
		} else {

			channel := result.Data.(*model.Channel)

			if channel.Type != model.CHANNEL_OPEN {
				continue
			}

			cm := &model.ChannelMember{
				ChannelId:   channel.Id,
				UserId:      user.Id,
				SchemeUser:  true,
				SchemeAdmin: shouldBeAdmin,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			}

			if cmResult := <-a.Srv.Store.Channel().SaveMember(cm); cmResult.Err != nil {
				err = cmResult.Err
			}
			if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()); result.Err != nil {
				mlog.Warn(fmt.Sprintf("Failed to update ChannelMemberHistory table %v", result.Err))
			}

			if *a.Config().ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages {
				if channel.Name == model.DEFAULT_CHANNEL {
					if requestor == nil {
						if err := a.postJoinTeamMessage(user, channel); err != nil {
							mlog.Error(fmt.Sprint("Failed to post join/leave message", err))
						}
					} else {
						if err := a.postAddToTeamMessage(requestor, user, channel, ""); err != nil {
							mlog.Error(fmt.Sprint("Failed to post join/leave message", err))
						}
					}
				} else {
					if requestor == nil {
						if err := a.postJoinChannelMessage(user, channel); err != nil {
							mlog.Error(fmt.Sprint("Failed to post join/leave message", err))
						}
					} else {
						if err := a.PostAddToChannelMessage(requestor, user, channel, ""); err != nil {
							mlog.Error(fmt.Sprint("Failed to post join/leave message", err))
						}
					}
				}
			}

			a.InvalidateCacheForChannelMembers(result.Data.(*model.Channel).Id)
		}
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
	count, err := a.GetNumberOfChannelsOnTeam(channel.TeamId)
	if err != nil {
		return nil, err
	}

	if int64(count+1) > *a.Config().TeamSettings.MaxChannelsPerTeam {
		return nil, model.NewAppError("CreateChannelWithUser", "api.channel.create_channel.max_channel_limit.app_error", map[string]interface{}{"MaxChannelsPerTeam": *a.Config().TeamSettings.MaxChannelsPerTeam}, "", http.StatusBadRequest)
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

// RenameChannel is used to rename the channel Name and the DisplayName fields
func (a *App) RenameChannel(channel *model.Channel, newChannelName string, newDisplayName string) (*model.Channel, *model.AppError) {
	if channel.Type == model.CHANNEL_DIRECT {
		return nil, model.NewAppError("RenameChannel", "api.channel.rename_channel.cant_rename_direct_messages.app_error", nil, "", http.StatusBadRequest)
	}

	if channel.Type == model.CHANNEL_GROUP {
		return nil, model.NewAppError("RenameChannel", "api.channel.rename_channel.cant_rename_group_messages.app_error", nil, "", http.StatusBadRequest)
	}

	channel.Name = newChannelName
	if newDisplayName != "" {
		channel.DisplayName = newDisplayName
	}

	newChannel, err := a.UpdateChannel(channel)
	if err != nil {
		return nil, err
	}

	return newChannel, nil
}

func (a *App) CreateChannel(channel *model.Channel, addMember bool) (*model.Channel, *model.AppError) {
	result := <-a.Srv.Store.Channel().Save(channel, *a.Config().TeamSettings.MaxChannelsPerTeam)
	if result.Err != nil {
		return nil, result.Err
	}

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
			mlog.Warn(fmt.Sprintf("Failed to update ChannelMemberHistory table %v", result.Err))
		}

		a.InvalidateCacheForUser(channel.CreatorId)
	}

	if a.PluginsReady() {
		a.Go(func() {
			pluginContext := &plugin.Context{}
			a.Plugins.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.ChannelHasBeenCreated(pluginContext, sc)
				return true
			}, plugin.ChannelHasBeenCreatedId)
		})
	}

	return sc, nil
}

func (a *App) CreateDirectChannel(userId string, otherUserId string) (*model.Channel, *model.AppError) {
	channel, err := a.createDirectChannel(userId, otherUserId)
	if err != nil {
		if err.Id == store.CHANNEL_EXISTS_ERROR {
			return channel, nil
		}
		return nil, err
	}

	a.WaitForChannelMembership(channel.Id, userId)

	a.InvalidateCacheForUser(userId)
	a.InvalidateCacheForUser(otherUserId)

	if a.PluginsReady() {
		a.Go(func() {
			pluginContext := &plugin.Context{}
			a.Plugins.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.ChannelHasBeenCreated(pluginContext, channel)
				return true
			}, plugin.ChannelHasBeenCreatedId)
		})
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_DIRECT_ADDED, "", channel.Id, "", nil)
	message.Add("teammate_id", otherUserId)
	a.Publish(message)

	return channel, nil
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

	result := <-a.Srv.Store.Channel().CreateDirectChannel(userId, otherUserId)
	if result.Err != nil {
		if result.Err.Id == store.CHANNEL_EXISTS_ERROR {
			return result.Data.(*model.Channel), result.Err
		}
		return nil, result.Err
	}

	channel := result.Data.(*model.Channel)

	if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(userId, channel.Id, model.GetMillis()); result.Err != nil {
		mlog.Warn(fmt.Sprintf("Failed to update ChannelMemberHistory table %v", result.Err))
	}
	if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(otherUserId, channel.Id, model.GetMillis()); result.Err != nil {
		mlog.Warn(fmt.Sprintf("Failed to update ChannelMemberHistory table %v", result.Err))
	}

	return channel, nil
}

func (a *App) WaitForChannelMembership(channelId string, userId string) {
	if len(a.Config().SqlSettings.DataSourceReplicas) == 0 {
		return
	}

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

	mlog.Error(fmt.Sprintf("WaitForChannelMembership giving up channelId=%v userId=%v", channelId, userId), mlog.String("user_id", userId))
}

func (a *App) CreateGroupChannel(userIds []string, creatorId string) (*model.Channel, *model.AppError) {
	channel, err := a.createGroupChannel(userIds, creatorId)
	if err != nil {
		if err.Id == store.CHANNEL_EXISTS_ERROR {
			return channel, nil
		}
		return nil, err
	}

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

func (a *App) createGroupChannel(userIds []string, creatorId string) (*model.Channel, *model.AppError) {
	if len(userIds) > model.CHANNEL_GROUP_MAX_USERS || len(userIds) < model.CHANNEL_GROUP_MIN_USERS {
		return nil, model.NewAppError("CreateGroupChannel", "api.channel.create_group.bad_size.app_error", nil, "", http.StatusBadRequest)
	}

	result := <-a.Srv.Store.User().GetProfileByIds(userIds, true)
	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	if len(users) != len(userIds) {
		return nil, model.NewAppError("CreateGroupChannel", "api.channel.create_group.bad_user.app_error", nil, "user_ids="+model.ArrayToJson(userIds), http.StatusBadRequest)
	}

	group := &model.Channel{
		Name:        model.GetGroupNameFromUserIds(userIds),
		DisplayName: model.GetGroupDisplayNameFromUsers(users, true),
		Type:        model.CHANNEL_GROUP,
	}

	result = <-a.Srv.Store.Channel().Save(group, *a.Config().TeamSettings.MaxChannelsPerTeam)
	if result.Err != nil {
		if result.Err.Id == store.CHANNEL_EXISTS_ERROR {
			return result.Data.(*model.Channel), result.Err
		}
		return nil, result.Err
	}
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
			mlog.Warn(fmt.Sprintf("Failed to update ChannelMemberHistory table %v", result.Err))
		}
	}

	return channel, nil
}

func (a *App) GetGroupChannel(userIds []string) (*model.Channel, *model.AppError) {
	if len(userIds) > model.CHANNEL_GROUP_MAX_USERS || len(userIds) < model.CHANNEL_GROUP_MIN_USERS {
		return nil, model.NewAppError("GetGroupChannel", "api.channel.create_group.bad_size.app_error", nil, "", http.StatusBadRequest)
	}

	result := <-a.Srv.Store.User().GetProfileByIds(userIds, true)
	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	if len(users) != len(userIds) {
		return nil, model.NewAppError("GetGroupChannel", "api.channel.create_group.bad_user.app_error", nil, "user_ids="+model.ArrayToJson(userIds), http.StatusBadRequest)
	}

	channel, err := a.GetChannelByName(model.GetGroupNameFromUserIds(userIds), "", true)
	if err != nil {
		return nil, err
	}

	return channel, nil
}

func (a *App) UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	result := <-a.Srv.Store.Channel().Update(channel)
	if result.Err != nil {
		return nil, result.Err
	}

	a.InvalidateCacheForChannel(channel)

	messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_UPDATED, "", channel.Id, "", nil)
	messageWs.Add("channel", channel.ToJson())
	a.Publish(messageWs)

	return channel, nil
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
	channel, err := a.UpdateChannel(oldChannel)
	if err != nil {
		return channel, err
	}

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

	a.InvalidateCacheForChannel(channel)

	messageWs := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_CONVERTED, channel.TeamId, "", "", nil)
	messageWs.Add("channel_id", channel.Id)
	a.Publish(messageWs)

	return channel, nil
}

func (a *App) postChannelPrivacyMessage(user *model.User, channel *model.Channel) *model.AppError {
	message := (map[string]string{
		model.CHANNEL_OPEN:    utils.T("api.channel.change_channel_privacy.private_to_public"),
		model.CHANNEL_PRIVATE: utils.T("api.channel.change_channel_privacy.public_to_private"),
	})[channel.Type]
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
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
	result := <-a.Srv.Store.Channel().Restore(channel.Id, model.GetMillis())
	if result.Err != nil {
		return nil, result.Err
	}
	return channel, nil
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
			mlog.Error(err.Error())
		}
	}

	if channel.Header != oldChannelHeader {
		if err := a.PostUpdateChannelHeaderMessage(userId, channel, oldChannelHeader, channel.Header); err != nil {
			mlog.Error(err.Error())
		}
	}

	if channel.Purpose != oldChannelPurpose {
		if err := a.PostUpdateChannelPurposeMessage(userId, channel, oldChannelPurpose, channel.Purpose); err != nil {
			mlog.Error(err.Error())
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
		scheme, err := a.GetScheme(*channel.SchemeId)
		if err != nil {
			return "", "", err
		}
		return scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole, nil
	}

	var team *model.Team

	if team, err = a.GetTeam(channel.TeamId); err != nil {
		return "", "", err
	}

	if team.SchemeId != nil && len(*team.SchemeId) != 0 {
		scheme, err := a.GetScheme(*team.SchemeId)
		if err != nil {
			return "", "", err
		}
		return scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole, nil
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
		role, err := a.GetRoleByName(roleName)
		if err != nil {
			err.StatusCode = http.StatusBadRequest
			return nil, err
		}

		if !role.SchemeManaged {
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

	result := <-a.Srv.Store.Channel().UpdateMember(member)
	if result.Err != nil {
		return nil, result.Err
	}
	member = result.Data.(*model.ChannelMember)

	a.InvalidateCacheForUser(userId)
	return member, nil
}

func (a *App) UpdateChannelMemberSchemeRoles(channelId string, userId string, isSchemeUser bool, isSchemeAdmin bool) (*model.ChannelMember, *model.AppError) {
	member, err := a.GetChannelMember(channelId, userId)
	if err != nil {
		return nil, err
	}

	member.SchemeAdmin = isSchemeAdmin
	member.SchemeUser = isSchemeUser

	// If the migration is not completed, we also need to check the default channel_admin/channel_user roles are not present in the roles field.
	if err = a.IsPhase2MigrationCompleted(); err != nil {
		member.ExplicitRoles = RemoveRoles([]string{model.CHANNEL_USER_ROLE_ID, model.CHANNEL_ADMIN_ROLE_ID}, member.ExplicitRoles)
	}

	result := <-a.Srv.Store.Channel().UpdateMember(member)
	if result.Err != nil {
		return nil, result.Err
	}
	member = result.Data.(*model.ChannelMember)

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

	result := <-a.Srv.Store.Channel().UpdateMember(member)
	if result.Err != nil {
		return nil, result.Err
	}

	a.InvalidateCacheForUser(userId)
	a.InvalidateCacheForChannelMembersNotifyProps(channelId)
	// Notify the clients that the member notify props changed
	evt := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_MEMBER_UPDATED, "", "", userId, nil)
	evt.Add("channelMember", member.ToJson())
	a.Publish(evt)
	return member, nil
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

	ihcresult := <-ihc
	if ihcresult.Err != nil {
		return ihcresult.Err
	}

	ohcresult := <-ohc
	if ohcresult.Err != nil {
		return ohcresult.Err
	}

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
			mlog.Error(fmt.Sprintf("Failed to post archive message %v", err))
		}
	}

	now := model.GetMillis()
	for _, hook := range incomingHooks {
		if result := <-a.Srv.Store.Webhook().DeleteIncoming(hook.Id, now); result.Err != nil {
			mlog.Error(fmt.Sprintf("Encountered error deleting incoming webhook, id=%v", hook.Id))
		}
		a.InvalidateCacheForWebhook(hook.Id)
	}

	for _, hook := range outgoingHooks {
		if result := <-a.Srv.Store.Webhook().DeleteOutgoing(hook.Id, now); result.Err != nil {
			mlog.Error(fmt.Sprintf("Encountered error deleting outgoing webhook, id=%v", hook.Id))
		}
	}

	deleteAt := model.GetMillis()

	if dresult := <-a.Srv.Store.Channel().Delete(channel.Id, deleteAt); dresult.Err != nil {
		return dresult.Err
	}
	a.InvalidateCacheForChannel(channel)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_DELETED, channel.TeamId, "", "", nil)
	message.Add("channel_id", channel.Id)
	message.Add("delete_at", deleteAt)
	a.Publish(message)

	return nil
}

func (a *App) addUserToChannel(user *model.User, channel *model.Channel, teamMember *model.TeamMember) (*model.ChannelMember, *model.AppError) {
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
		mlog.Error(fmt.Sprintf("Failed to add member user_id=%v channel_id=%v err=%v", user.Id, channel.Id, result.Err), mlog.String("user_id", user.Id))
		return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.app_error", nil, "", http.StatusInternalServerError)
	}
	a.WaitForChannelMembership(channel.Id, user.Id)

	if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()); result.Err != nil {
		mlog.Warn(fmt.Sprintf("Failed to update ChannelMemberHistory table %v", result.Err))
	}

	a.InvalidateCacheForUser(user.Id)
	a.InvalidateCacheForChannelMembers(channel.Id)

	return newMember, nil
}

func (a *App) AddUserToChannel(user *model.User, channel *model.Channel) (*model.ChannelMember, *model.AppError) {
	tmchan := a.Srv.Store.Team().GetMember(channel.TeamId, user.Id)
	var teamMember *model.TeamMember

	result := <-tmchan
	if result.Err != nil {
		return nil, result.Err
	}
	teamMember = result.Data.(*model.TeamMember)
	if teamMember.DeleteAt > 0 {
		return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.deleted.app_error", nil, "", http.StatusBadRequest)
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

func (a *App) AddChannelMember(userId string, channel *model.Channel, userRequestorId string, postRootId string, clearPushNotifications bool) (*model.ChannelMember, *model.AppError) {
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

	if a.PluginsReady() {
		a.Go(func() {
			pluginContext := &plugin.Context{}
			a.Plugins.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.UserHasJoinedChannel(pluginContext, cm, userRequestor)
				return true
			}, plugin.UserHasJoinedChannelId)
		})
	}

	if userRequestorId == "" || userId == userRequestorId {
		a.postJoinChannelMessage(user, channel)
	} else {
		a.Go(func() {
			a.PostAddToChannelMessage(userRequestor, user, channel, postRootId)
		})
	}

	if userRequestor != nil {
		a.MarkChannelsAsViewed([]string{channel.Id}, userRequestor.Id, clearPushNotifications)
	}

	return cm, nil
}

func (a *App) AddDirectChannels(teamId string, user *model.User) *model.AppError {
	var profiles []*model.User
	result := <-a.Srv.Store.User().GetProfiles(teamId, 0, 100)
	if result.Err != nil {
		return model.NewAppError("AddDirectChannels", "api.user.add_direct_channels_and_forget.failed.error", map[string]interface{}{"UserId": user.Id, "TeamId": teamId, "Error": result.Err.Error()}, "", http.StatusInternalServerError)
	}
	profiles = result.Data.([]*model.User)

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

	uresult := <-uc
	if uresult.Err != nil {
		return model.NewAppError("PostUpdateChannelHeaderMessage", "api.channel.post_update_channel_header_message_and_forget.retrieve_user.error", nil, uresult.Err.Error(), http.StatusBadRequest)
	}

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

	return nil
}

func (a *App) PostUpdateChannelPurposeMessage(userId string, channel *model.Channel, oldChannelPurpose string, newChannelPurpose string) *model.AppError {
	uc := a.Srv.Store.User().Get(userId)

	uresult := <-uc
	if uresult.Err != nil {
		return model.NewAppError("PostUpdateChannelPurposeMessage", "app.channel.post_update_channel_purpose_message.retrieve_user.error", nil, uresult.Err.Error(), http.StatusBadRequest)
	}

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

	return nil
}

func (a *App) PostUpdateChannelDisplayNameMessage(userId string, channel *model.Channel, oldChannelDisplayName, newChannelDisplayName string) *model.AppError {
	uc := a.Srv.Store.User().Get(userId)

	uresult := <-uc
	if uresult.Err != nil {
		return model.NewAppError("PostUpdateChannelDisplayNameMessage", "api.channel.post_update_channel_displayname_message_and_forget.retrieve_user.error", nil, uresult.Err.Error(), http.StatusBadRequest)
	}

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

	return nil
}

func (a *App) GetChannel(channelId string) (*model.Channel, *model.AppError) {
	result := <-a.Srv.Store.Channel().Get(channelId, true)
	if result.Err != nil {
		if result.Err.Id == "store.sql_channel.get.existing.app_error" {
			result.Err.StatusCode = http.StatusNotFound
			return nil, result.Err
		}
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	}
	return result.Data.(*model.Channel), nil
}

func (a *App) GetChannelByName(channelName, teamId string, includeDeleted bool) (*model.Channel, *model.AppError) {
	var result store.StoreResult

	if includeDeleted {
		result = <-a.Srv.Store.Channel().GetByNameIncludeDeleted(teamId, channelName, false)
	} else {
		result = <-a.Srv.Store.Channel().GetByName(teamId, channelName, false)
	}

	if result.Err != nil && result.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	}

	if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	}

	return result.Data.(*model.Channel), nil
}

func (a *App) GetChannelsByNames(channelNames []string, teamId string) ([]*model.Channel, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetByNames(teamId, channelNames, true)
	if result.Err != nil {
		if result.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
			result.Err.StatusCode = http.StatusNotFound
			return nil, result.Err
		}
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	}
	return result.Data.([]*model.Channel), nil
}

func (a *App) GetChannelByNameForTeamName(channelName, teamName string, includeDeleted bool) (*model.Channel, *model.AppError) {
	var team *model.Team

	result := <-a.Srv.Store.Team().GetByName(teamName)
	if result.Err != nil {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	}
	team = result.Data.(*model.Team)

	if includeDeleted {
		result = <-a.Srv.Store.Channel().GetByNameIncludeDeleted(team.Id, channelName, false)
	} else {
		result = <-a.Srv.Store.Channel().GetByName(team.Id, channelName, false)
	}

	if result.Err != nil && result.Err.Id == "store.sql_channel.get_by_name.missing.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	}

	if result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	}

	return result.Data.(*model.Channel), nil
}

func (a *App) GetChannelsForUser(teamId string, userId string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetChannels(teamId, userId, includeDeleted)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) GetDeletedChannels(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetDeleted(teamId, offset, limit)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) GetChannelsUserNotIn(teamId string, userId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetMoreChannels(teamId, userId, offset, limit)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) (*model.ChannelList, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetPublicChannelsByIdsForTeam(teamId, channelIds)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) GetPublicChannelsForTeam(teamId string, offset int, limit int) (*model.ChannelList, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetPublicChannelsForTeam(teamId, offset, limit)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) GetChannelMember(channelId string, userId string) (*model.ChannelMember, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetMember(channelId, userId)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelMember), nil
}

func (a *App) GetChannelMembersPage(channelId string, page, perPage int) (*model.ChannelMembers, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetMembers(channelId, page*perPage, perPage)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelMembers), nil
}

func (a *App) GetChannelMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetMembersByIds(channelId, userIds)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelMembers), nil
}

func (a *App) GetChannelMembersForUser(teamId string, userId string) (*model.ChannelMembers, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetMembersForUser(teamId, userId)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelMembers), nil
}

func (a *App) GetChannelMemberCount(channelId string) (int64, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetMemberCount(channelId, true)
	if result.Err != nil {
		return 0, result.Err
	}
	return result.Data.(int64), nil
}

func (a *App) GetChannelCounts(teamId string, userId string) (*model.ChannelCounts, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetChannelCounts(teamId, userId)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelCounts), nil
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
	userChan := a.Srv.Store.User().Get(userId)
	memberChan := a.Srv.Store.Channel().GetMember(channel.Id, userId)

	uresult := <-userChan
	if uresult.Err != nil {
		return uresult.Err
	}

	mresult := <-memberChan
	if mresult.Err == nil && mresult.Data != nil {
		// user is already in the channel
		return nil
	}

	user := uresult.Data.(*model.User)

	if channel.Type != model.CHANNEL_OPEN {
		return model.NewAppError("JoinChannel", "api.channel.join_channel.permissions.app_error", nil, "", http.StatusBadRequest)
	}

	cm, err := a.AddUserToChannel(user, channel)
	if err != nil {
		return err
	}

	if a.PluginsReady() {
		a.Go(func() {
			pluginContext := &plugin.Context{}
			a.Plugins.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.UserHasJoinedChannel(pluginContext, cm, nil)
				return true
			}, plugin.UserHasJoinedChannelId)
		})
	}

	if err := a.postJoinChannelMessage(user, channel); err != nil {
		return err
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

	cresult := <-sc
	if cresult.Err != nil {
		return cresult.Err
	}
	uresult := <-uc
	if uresult.Err != nil {
		return cresult.Err
	}
	ccmresult := <-ccm
	if ccmresult.Err != nil {
		return ccmresult.Err
	}

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
	if channel.Name == model.DEFAULT_CHANNEL {
		return model.NewAppError("RemoveUserFromChannel", "api.channel.remove.default.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "", http.StatusBadRequest)
	}

	cm, err := a.GetChannelMember(channel.Id, userIdToRemove)
	if err != nil {
		return err
	}

	if cmresult := <-a.Srv.Store.Channel().RemoveMember(channel.Id, userIdToRemove); cmresult.Err != nil {
		return cmresult.Err
	}
	if cmhResult := <-a.Srv.Store.ChannelMemberHistory().LogLeaveEvent(userIdToRemove, channel.Id, model.GetMillis()); cmhResult.Err != nil {
		return cmhResult.Err
	}

	a.InvalidateCacheForUser(userIdToRemove)
	a.InvalidateCacheForChannelMembers(channel.Id)

	if a.PluginsReady() {

		var actorUser *model.User
		if removerUserId != "" {
			actorUser, _ = a.GetUser(removerUserId)
		}

		a.Go(func() {
			pluginContext := &plugin.Context{}
			a.Plugins.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.UserHasLeftChannel(pluginContext, cm, actorUser)
				return true
			}, plugin.UserHasLeftChannelId)
		})
	}

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
	result := <-a.Srv.Store.Channel().GetTeamChannels(teamId)
	if result.Err != nil {
		return 0, result.Err
	}
	return len(*result.Data.(*model.ChannelList)), nil
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
	includeDeleted := *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	result := <-a.Srv.Store.Channel().AutocompleteInTeam(teamId, term, includeDeleted)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) AutocompleteChannelsForSearch(teamId string, userId string, term string) (*model.ChannelList, *model.AppError) {
	includeDeleted := *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	result := <-a.Srv.Store.Channel().AutocompleteInTeamForSearch(teamId, userId, term, includeDeleted)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) SearchChannels(teamId string, term string) (*model.ChannelList, *model.AppError) {
	includeDeleted := *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	result := <-a.Srv.Store.Channel().SearchInTeam(teamId, term, includeDeleted)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) SearchChannelsUserNotIn(teamId string, userId string, term string) (*model.ChannelList, *model.AppError) {
	result := <-a.Srv.Store.Channel().SearchMore(userId, teamId, term)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.ChannelList), nil
}

func (a *App) MarkChannelsAsViewed(channelIds []string, userId string, clearPushNotifications bool) (map[string]int64, *model.AppError) {
	// I start looking for channels with notifications before I mark it as read, to clear the push notifications if needed
	channelsToClearPushNotifications := []string{}
	if *a.Config().EmailSettings.SendPushNotifications && clearPushNotifications {
		for _, channelId := range channelIds {
			if model.IsValidId(channelId) {
				result := <-a.Srv.Store.Channel().GetMember(channelId, userId)
				if result.Err != nil {
					mlog.Warn(fmt.Sprintf("Failed to get membership %v", result.Err))
					continue
				}
				member := result.Data.(*model.ChannelMember)

				notify := member.NotifyProps[model.PUSH_NOTIFY_PROP]
				if notify == model.CHANNEL_NOTIFY_DEFAULT {
					user, _ := a.GetUser(userId)
					notify = user.NotifyProps[model.PUSH_NOTIFY_PROP]
				}
				if notify == model.USER_NOTIFY_ALL {
					if result := <-a.Srv.Store.User().GetAnyUnreadPostCountForChannel(userId, channelId); result.Err == nil {
						if result.Data.(int64) > 0 {
							channelsToClearPushNotifications = append(channelsToClearPushNotifications, channelId)
						}
					}
				} else if notify == model.USER_NOTIFY_MENTION {
					if result := <-a.Srv.Store.User().GetUnreadCountForChannel(userId, channelId); result.Err == nil {
						if result.Data.(int64) > 0 {
							channelsToClearPushNotifications = append(channelsToClearPushNotifications, channelId)
						}
					}
				}
			}
		}
	}
	result := <-a.Srv.Store.Channel().UpdateLastViewedAt(channelIds, userId)
	if result.Err != nil {
		return nil, result.Err
	}

	times := result.Data.(map[string]int64)
	if *a.Config().ServiceSettings.EnableChannelViewedMessages {
		for _, channelId := range channelIds {
			if model.IsValidId(channelId) {
				message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, "", "", userId, nil)
				message.Add("channel_id", channelId)
				a.Publish(message)
			}
		}
	}
	for _, channelId := range channelsToClearPushNotifications {
		a.ClearPushNotification(userId, channelId)
	}
	return times, nil
}

func (a *App) ViewChannel(view *model.ChannelView, userId string, clearPushNotifications bool) (map[string]int64, *model.AppError) {
	if err := a.SetActiveChannel(userId, view.ChannelId); err != nil {
		return nil, err
	}

	channelIds := []string{}

	if len(view.ChannelId) > 0 {
		channelIds = append(channelIds, view.ChannelId)
	}

	if len(view.PrevChannelId) > 0 {
		channelIds = append(channelIds, view.PrevChannelId)
	}

	if len(channelIds) == 0 {
		return map[string]int64{}, nil
	}

	return a.MarkChannelsAsViewed(channelIds, userId, clearPushNotifications)
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
	channelMembers, err := a.GetChannelMembersPage(channel.Id, 0, 10000000)
	if err != nil {
		return err
	}

	channelMemberIds := []string{}
	for _, channelMember := range *channelMembers {
		channelMemberIds = append(channelMemberIds, channelMember.UserId)
	}

	teamMembers, err2 := a.GetTeamMembersByIds(team.Id, channelMemberIds)
	if err2 != nil {
		return err2
	}

	if len(teamMembers) != len(*channelMembers) {
		return model.NewAppError("MoveChannel", "app.channel.move_channel.members_do_not_match.error", nil, "", http.StatusInternalServerError)
	}

	// keep instance of the previous team
	var previousTeam *model.Team
	result := <-a.Srv.Store.Team().Get(channel.TeamId)
	if result.Err != nil {
		return result.Err
	}
	previousTeam = result.Data.(*model.Team)

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
	result := <-a.Srv.Store.Channel().GetPinnedPosts(channelId)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.PostList), nil
}

func (a *App) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	result := <-a.Srv.Store.Channel().GetByName("", model.GetDMNameFromIds(userId1, userId2), true)
	if result.Err != nil {
		if result.Err.Id == store.MISSING_CHANNEL_ERROR {
			result := <-a.Srv.Store.Channel().CreateDirectChannel(userId1, userId2)
			if result.Err != nil {
				return nil, model.NewAppError("GetOrCreateDMChannel", "web.incoming_webhook.channel.app_error", nil, "err="+result.Err.Message, http.StatusBadRequest)
			}
			a.InvalidateCacheForUser(userId1)
			a.InvalidateCacheForUser(userId2)

			channel := result.Data.(*model.Channel)
			if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(userId1, channel.Id, model.GetMillis()); result.Err != nil {
				mlog.Warn(fmt.Sprintf("Failed to update ChannelMemberHistory table %v", result.Err))
			}
			if result := <-a.Srv.Store.ChannelMemberHistory().LogJoinEvent(userId2, channel.Id, model.GetMillis()); result.Err != nil {
				mlog.Warn(fmt.Sprintf("Failed to update ChannelMemberHistory table %v", result.Err))
			}

			return channel, nil
		}
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

func (a *App) FillInChannelProps(channel *model.Channel) *model.AppError {
	return a.FillInChannelsProps(&model.ChannelList{channel})
}

func (a *App) FillInChannelsProps(channelList *model.ChannelList) *model.AppError {
	// Group the channels by team and call GetChannelsByNames just once per team.
	channelsByTeam := make(map[string]model.ChannelList)
	for _, channel := range *channelList {
		channelsByTeam[channel.TeamId] = append(channelsByTeam[channel.TeamId], channel)
	}

	for teamId, channelList := range channelsByTeam {
		allChannelMentions := make(map[string]bool)
		channelMentions := make(map[*model.Channel][]string, len(channelList))

		// Collect mentions across the channels so as to query just once for this team.
		for _, channel := range channelList {
			channelMentions[channel] = model.ChannelMentions(channel.Header)

			for _, channelMention := range channelMentions[channel] {
				allChannelMentions[channelMention] = true
			}
		}

		allChannelMentionNames := make([]string, 0, len(allChannelMentions))
		for channelName := range allChannelMentions {
			allChannelMentionNames = append(allChannelMentionNames, channelName)
		}

		if len(allChannelMentionNames) > 0 {
			mentionedChannels, err := a.GetChannelsByNames(allChannelMentionNames, teamId)
			if err != nil {
				return err
			}

			mentionedChannelsByName := make(map[string]*model.Channel)
			for _, channel := range mentionedChannels {
				mentionedChannelsByName[channel.Name] = channel
			}

			for _, channel := range channelList {
				channelMentionsProp := make(map[string]interface{}, len(channelMentions[channel]))
				for _, channelMention := range channelMentions[channel] {
					if mentioned, ok := mentionedChannelsByName[channelMention]; ok {
						if mentioned.Type == model.CHANNEL_OPEN {
							channelMentionsProp[mentioned.Name] = map[string]interface{}{
								"display_name": mentioned.DisplayName,
							}
						}
					}
				}

				if len(channelMentionsProp) > 0 {
					channel.AddProp("channel_mentions", channelMentionsProp)
				} else if channel.Props != nil {
					delete(channel.Props, "channel_mentions")
				}
			}
		}
	}

	return nil
}
