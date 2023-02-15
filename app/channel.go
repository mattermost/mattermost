// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
	"github.com/mattermost/mattermost-server/v6/utils"
)

// channelsWrapper provides an implementation of `product.ChannelService` to be used by products.
type channelsWrapper struct {
	app *App
}

func (s *channelsWrapper) GetDirectChannel(userID1, userID2 string) (*model.Channel, *model.AppError) {
	return s.app.getDirectChannel(request.EmptyContext(s.app.Log()), userID1, userID2)
}

// GetChannelByID gets a Channel by its ID.
func (s *channelsWrapper) GetChannelByID(channelID string) (*model.Channel, *model.AppError) {
	return s.app.GetChannel(request.EmptyContext(s.app.Log()), channelID)
}

// GetChannelMember gets a channel member by userID.
func (s *channelsWrapper) GetChannelMember(channelID string, userID string) (*model.ChannelMember, *model.AppError) {
	return s.app.GetChannelMember(request.EmptyContext(s.app.Log()), channelID, userID)
}

func (s *channelsWrapper) GetChannelsForTeamForUser(teamID string, userID string, opts *model.ChannelSearchOpts) (model.ChannelList, *model.AppError) {
	return s.app.GetChannelsForTeamForUser(request.EmptyContext(s.app.Log()), teamID, userID, opts)
}

func (s *channelsWrapper) GetChannelSidebarCategories(userID, teamID string) (*model.OrderedSidebarCategories, *model.AppError) {
	return s.app.GetSidebarCategoriesForTeamForUser(request.EmptyContext(s.app.Log()), userID, teamID)
}

func (s *channelsWrapper) GetChannelMembers(channelID string, page, perPage int) (model.ChannelMembers, *model.AppError) {
	return s.app.GetChannelMembersPage(request.EmptyContext(s.app.Log()), channelID, page, perPage)
}

func (s *channelsWrapper) CreateChannelSidebarCategory(userID, teamID string, newCategory *model.SidebarCategoryWithChannels) (*model.SidebarCategoryWithChannels, *model.AppError) {
	return s.app.CreateSidebarCategory(request.EmptyContext(s.app.Log()), userID, teamID, newCategory)
}

func (s *channelsWrapper) UpdateChannelSidebarCategories(userID, teamID string, categories []*model.SidebarCategoryWithChannels) ([]*model.SidebarCategoryWithChannels, *model.AppError) {
	return s.app.UpdateSidebarCategories(request.EmptyContext(s.app.Log()), userID, teamID, categories)
}

func (s *channelsWrapper) CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	return s.app.CreateChannel(request.EmptyContext(s.app.Log()), channel, false)
}

func (s *channelsWrapper) AddUserToChannel(channelID, userID, asUserID string) (*model.ChannelMember, *model.AppError) {
	ctx := request.EmptyContext(s.app.Log())
	channel, err := s.app.GetChannel(ctx, channelID)
	if err != nil {
		return nil, err
	}

	return s.app.AddChannelMember(ctx, userID, channel, ChannelMemberOpts{
		UserRequestorID: asUserID,
	})
}

func (s *channelsWrapper) UpdateChannelMemberRoles(channelID, userID, newRoles string) (*model.ChannelMember, *model.AppError) {
	return s.app.UpdateChannelMemberRoles(request.EmptyContext(s.app.Log()), channelID, userID, newRoles)
}

func (s *channelsWrapper) DeleteChannelMember(channelID, userID string) *model.AppError {
	return s.app.LeaveChannel(request.EmptyContext(s.app.Log()), channelID, userID)
}

func (s *channelsWrapper) AddChannelMember(channelID, userID string) (*model.ChannelMember, *model.AppError) {
	channel, err := s.GetChannelByID(channelID)
	if err != nil {
		return nil, err
	}

	return s.app.AddChannelMember(request.EmptyContext(s.app.Log()), userID, channel, ChannelMemberOpts{
		// For now, don't allow overriding these via the plugin API.
		UserRequestorID: "",
		PostRootID:      "",
	})
}

func (s *channelsWrapper) GetDirectChannelOrCreate(userID1, userID2 string) (*model.Channel, *model.AppError) {
	return s.app.GetOrCreateDirectChannel(request.EmptyContext(s.app.Log()), userID1, userID2)
}

// Ensure the wrapper implements the product service.
var _ product.ChannelService = (*channelsWrapper)(nil)

// DefaultChannelNames returns the list of system-wide default channel names.
//
// By default the list will be (not necessarily in this order):
//
//	['town-square', 'off-topic']
//
// However, if TeamSettings.ExperimentalDefaultChannels contains a list of channels then that list will replace
// 'off-topic' and be included in the return results in addition to 'town-square'. For example:
//
//	['town-square', 'game-of-thrones', 'wow']
func (a *App) DefaultChannelNames(c request.CTX) []string {
	names := []string{"town-square"}

	if len(a.Config().TeamSettings.ExperimentalDefaultChannels) == 0 {
		names = append(names, "off-topic")
	} else {
		seenChannels := map[string]bool{"town-square": true}
		for _, channelName := range a.Config().TeamSettings.ExperimentalDefaultChannels {
			if !seenChannels[channelName] {
				names = append(names, channelName)
				seenChannels[channelName] = true
			}
		}
	}

	return names
}

func (a *App) JoinDefaultChannels(c request.CTX, teamID string, user *model.User, shouldBeAdmin bool, userRequestorId string) *model.AppError {
	var requestor *model.User
	var nErr error
	if userRequestorId != "" {
		requestor, nErr = a.Srv().Store().User().Get(context.Background(), userRequestorId)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return model.NewAppError("JoinDefaultChannels", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
			default:
				return model.NewAppError("JoinDefaultChannels", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
	}

	for _, channelName := range a.DefaultChannelNames(c) {
		channel, channelErr := a.Srv().Store().Channel().GetByName(teamID, channelName, true)
		if channelErr != nil {
			c.Logger().Warn("No default channel with this name", mlog.String("channelName", channelName), mlog.String("teamID", teamID), mlog.Err(channelErr))
			continue
		}

		if channel.Type != model.ChannelTypeOpen {
			continue
		}

		cm := &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			SchemeGuest: user.IsGuest(),
			SchemeUser:  !user.IsGuest(),
			SchemeAdmin: shouldBeAdmin,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}

		_, nErr = a.Srv().Store().Channel().SaveMember(cm)
		if histErr := a.Srv().Store().ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()); histErr != nil {
			return model.NewAppError("JoinDefaultChannels", "app.channel_member_history.log_join_event.internal_error", nil, "", http.StatusInternalServerError).Wrap(histErr)
		}

		if *a.Config().ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages {
			if aErr := a.postJoinMessageForDefaultChannel(c, user, requestor, channel); aErr != nil {
				c.Logger().Warn("Failed to post join/leave message", mlog.Err(aErr))
			}
		}

		a.invalidateCacheForChannelMembers(channel.Id)

		options := a.Config().GetSanitizeOptions()
		user.SanitizeProfile(options)

		message := model.NewWebSocketEvent(model.WebsocketEventUserAdded, "", channel.Id, "", nil, "")
		message.Add("user", user)
		message.Add("team_id", channel.TeamId)
		a.Publish(message)

		// A/B Test on the welcome post
		if a.Config().FeatureFlags.SendWelcomePost && channelName == model.DefaultChannelName {
			nbTeams, err := a.Srv().Store().Team().AnalyticsTeamCount(&model.TeamSearch{
				IncludeDeleted: model.NewBool(true),
			})
			if err != nil {
				c.Logger().Warn("unable to get number of teams", logr.Err(err))
				return nil
			}

			if nbTeams == 1 && a.IsFirstAdmin(user) {
				// Post the welcome message
				if _, err := a.CreatePost(c, &model.Post{
					ChannelId: channel.Id,
					Type:      model.PostTypeWelcomePost,
					UserId:    user.Id,
				}, channel, false, false); err != nil {
					c.Logger().Warn("unable to post welcome message", logr.Err(err))
					return nil
				}
				ts := a.Srv().GetTelemetryService()
				if ts != nil {
					ts.SendTelemetry("welcome-message-sent", map[string]any{
						"category": "growth",
					})
				}
			}
		}
	}

	if nErr != nil {
		var appErr *model.AppError
		var cErr *store.ErrConflict
		switch {
		case errors.As(nErr, &cErr):
			if cErr.Resource == "ChannelMembers" {
				return model.NewAppError("JoinDefaultChannels", "app.channel.save_member.exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			}
		case errors.As(nErr, &appErr):
			return appErr
		default:
			return model.NewAppError("JoinDefaultChannels", "app.channel.create_direct_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	return nil
}

func (a *App) postJoinMessageForDefaultChannel(c request.CTX, user *model.User, requestor *model.User, channel *model.Channel) *model.AppError {
	if channel.Name == model.DefaultChannelName {
		if requestor == nil {
			if err := a.postJoinTeamMessage(c, user, channel); err != nil {
				return err
			}
		} else {
			if err := a.postAddToTeamMessage(c, requestor, user, channel, ""); err != nil {
				return err
			}
		}
	} else {
		if requestor == nil {
			if err := a.postJoinChannelMessage(c, user, channel); err != nil {
				return err
			}
		} else {
			if err := a.PostAddToChannelMessage(c, requestor, user, channel, ""); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) CreateChannelWithUser(c request.CTX, channel *model.Channel, userID string) (*model.Channel, *model.AppError) {
	if channel.IsGroupOrDirect() {
		return nil, model.NewAppError("CreateChannelWithUser", "api.channel.create_channel.direct_channel.app_error", nil, "", http.StatusBadRequest)
	}

	if channel.TeamId == "" {
		return nil, model.NewAppError("CreateChannelWithUser", "app.channel.create_channel.no_team_id.app_error", nil, "", http.StatusBadRequest)
	}

	// Get total number of channels on current team
	count, err := a.GetNumberOfChannelsOnTeam(c, channel.TeamId)
	if err != nil {
		return nil, err
	}

	if int64(count+1) > *a.Config().TeamSettings.MaxChannelsPerTeam {
		return nil, model.NewAppError("CreateChannelWithUser", "api.channel.create_channel.max_channel_limit.app_error", map[string]any{"MaxChannelsPerTeam": *a.Config().TeamSettings.MaxChannelsPerTeam}, "", http.StatusBadRequest)
	}

	channel.CreatorId = userID

	rchannel, err := a.CreateChannel(c, channel, true)
	if err != nil {
		return nil, err
	}

	var user *model.User
	if user, err = a.GetUser(userID); err != nil {
		return nil, err
	}

	a.postJoinChannelMessage(c, user, channel)

	message := model.NewWebSocketEvent(model.WebsocketEventChannelCreated, "", "", userID, nil, "")
	message.Add("channel_id", channel.Id)
	message.Add("team_id", channel.TeamId)
	a.Publish(message)

	return rchannel, nil
}

// RenameChannel is used to rename the channel Name and the DisplayName fields
func (a *App) RenameChannel(c request.CTX, channel *model.Channel, newChannelName string, newDisplayName string) (*model.Channel, *model.AppError) {
	if channel.Type == model.ChannelTypeDirect {
		return nil, model.NewAppError("RenameChannel", "api.channel.rename_channel.cant_rename_direct_messages.app_error", nil, "", http.StatusBadRequest)
	}

	if channel.Type == model.ChannelTypeGroup {
		return nil, model.NewAppError("RenameChannel", "api.channel.rename_channel.cant_rename_group_messages.app_error", nil, "", http.StatusBadRequest)
	}

	channel.Name = newChannelName
	if newDisplayName != "" {
		channel.DisplayName = newDisplayName
	}

	newChannel, err := a.UpdateChannel(c, channel)
	if err != nil {
		return nil, err
	}

	return newChannel, nil
}

func (a *App) CreateChannel(c request.CTX, channel *model.Channel, addMember bool) (*model.Channel, *model.AppError) {
	channel.DisplayName = strings.TrimSpace(channel.DisplayName)
	sc, nErr := a.Srv().Store().Channel().Save(channel, *a.Config().TeamSettings.MaxChannelsPerTeam)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		var cErr *store.ErrConflict
		var ltErr *store.ErrLimitExceeded
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &invErr):
			switch {
			case invErr.Entity == "Channel" && invErr.Field == "DeleteAt":
				return nil, model.NewAppError("CreateChannel", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			case invErr.Entity == "Channel" && invErr.Field == "Type":
				return nil, model.NewAppError("CreateChannel", "store.sql_channel.save.direct_channel.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			case invErr.Entity == "Channel" && invErr.Field == "Id":
				return nil, model.NewAppError("CreateChannel", "store.sql_channel.save_channel.existing.app_error", nil, "id="+invErr.Value.(string), http.StatusBadRequest).Wrap(nErr)
			}
		case errors.As(nErr, &cErr):
			return sc, model.NewAppError("CreateChannel", store.ChannelExistsError, nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &ltErr):
			return nil, model.NewAppError("CreateChannel", "store.sql_channel.save_channel.limit.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appErr): // in case we haven't converted to plain error.
			return nil, appErr
		default: // last fallback in case it doesn't map to an existing app error.
			return nil, model.NewAppError("CreateChannel", "app.channel.create_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if addMember {
		user, nErr := a.Srv().Store().User().Get(context.Background(), channel.CreatorId)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return nil, model.NewAppError("CreateChannel", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
			default:
				return nil, model.NewAppError("CreateChannel", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}

		cm := &model.ChannelMember{
			ChannelId:   sc.Id,
			UserId:      user.Id,
			SchemeGuest: user.IsGuest(),
			SchemeUser:  !user.IsGuest(),
			SchemeAdmin: true,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}

		if _, nErr := a.Srv().Store().Channel().SaveMember(cm); nErr != nil {
			var appErr *model.AppError
			var cErr *store.ErrConflict
			switch {
			case errors.As(nErr, &cErr):
				switch cErr.Resource {
				case "ChannelMembers":
					return nil, model.NewAppError("CreateChannel", "app.channel.save_member.exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
				}
			case errors.As(nErr, &appErr):
				return nil, appErr
			default:
				return nil, model.NewAppError("CreateChannel", "app.channel.create_direct_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}

		if err := a.Srv().Store().ChannelMemberHistory().LogJoinEvent(channel.CreatorId, sc.Id, model.GetMillis()); err != nil {
			return nil, model.NewAppError("CreateChannel", "app.channel_member_history.log_join_event.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		a.InvalidateCacheForUser(channel.CreatorId)
	}

	a.Srv().Go(func() {
		pluginContext := pluginContext(c)
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.ChannelHasBeenCreated(pluginContext, sc)
			return true
		}, plugin.ChannelHasBeenCreatedID)
	})

	return sc, nil
}

func (a *App) GetOrCreateDirectChannel(c request.CTX, userID, otherUserID string, channelOptions ...model.ChannelOption) (*model.Channel, *model.AppError) {
	channel, nErr := a.getDirectChannel(c, userID, otherUserID)
	if nErr != nil {
		return nil, nErr
	}

	if channel != nil {
		return channel, nil
	}

	if *a.Config().TeamSettings.RestrictDirectMessage == model.DirectMessageTeam &&
		!a.SessionHasPermissionTo(*c.Session(), model.PermissionManageSystem) {
		users, err := a.GetUsersByIds([]string{userID, otherUserID}, &store.UserGetByIdsOpts{})
		if err != nil {
			return nil, err
		}
		var isBot bool
		for _, user := range users {
			if user.IsBot {
				isBot = true
				break
			}
		}
		// if one of the users is a bot, don't restrict to team members
		if !isBot {
			commonTeamIDs, err := a.GetCommonTeamIDsForTwoUsers(userID, otherUserID)
			if err != nil {
				return nil, err
			}
			if len(commonTeamIDs) == 0 {
				return nil, model.NewAppError("createDirectChannel", "api.channel.create_channel.direct_channel.team_restricted_error", nil, "", http.StatusForbidden)
			}
		}
	}

	channel, err := a.createDirectChannel(c, userID, otherUserID, channelOptions...)
	if err != nil {
		if err.Id == store.ChannelExistsError {
			return channel, nil
		}
		return nil, err
	}

	a.handleCreationEvent(c, userID, otherUserID, channel)
	return channel, nil
}

func (a *App) getOrCreateDirectChannelWithUser(c request.CTX, user, otherUser *model.User) (*model.Channel, *model.AppError) {
	channel, nErr := a.getDirectChannel(c, user.Id, otherUser.Id)
	if nErr != nil {
		return nil, nErr
	}

	if channel != nil {
		return channel, nil
	}

	channel, err := a.createDirectChannelWithUser(c, user, otherUser)
	if err != nil {
		if err.Id == store.ChannelExistsError {
			return channel, nil
		}
		return nil, err
	}

	a.handleCreationEvent(c, user.Id, otherUser.Id, channel)
	return channel, nil
}

func (a *App) handleCreationEvent(c request.CTX, userID, otherUserID string, channel *model.Channel) {
	a.InvalidateCacheForUser(userID)
	a.InvalidateCacheForUser(otherUserID)

	a.Srv().Go(func() {
		pluginContext := pluginContext(c)
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.ChannelHasBeenCreated(pluginContext, channel)
			return true
		}, plugin.ChannelHasBeenCreatedID)
	})

	message := model.NewWebSocketEvent(model.WebsocketEventDirectAdded, "", channel.Id, "", nil, "")
	message.Add("creator_id", userID)
	message.Add("teammate_id", otherUserID)
	a.Publish(message)
}

func (a *App) createDirectChannel(c request.CTX, userID string, otherUserID string, channelOptions ...model.ChannelOption) (*model.Channel, *model.AppError) {
	users, err := a.Srv().Store().User().GetMany(context.Background(), []string{userID, otherUserID})
	if err != nil {
		return nil, model.NewAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if len(users) == 0 {
		return nil, model.NewAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, fmt.Sprintf("No users found for ids: %s. %s", userID, otherUserID), http.StatusBadRequest)
	}

	// We are doing this because we allow a user to create a direct channel with themselves
	if userID == otherUserID {
		users = append(users, users[0])
	}

	// After we counted for direct channels with the same user, if we do not have two users then we failed to find one
	if len(users) != 2 {
		return nil, model.NewAppError("CreateDirectChannel", "api.channel.create_direct_channel.invalid_user.app_error", nil, fmt.Sprintf("No users found for ids: %s. %s", userID, otherUserID), http.StatusBadRequest)
	}

	// The potential swap dance below is necessary in order to guarantee determinism when creating a direct channel.
	// When we query the database for some given user ids, the database result is not deterministic, meaning we can get
	// the same results but in different order. In order to conform the contract of Channel.CreateDirectChannel method
	// below we need to identify which user is who.
	user := users[0]
	otherUser := users[1]
	if user.Id != userID {
		user = users[1]
		otherUser = users[0]
	}
	return a.createDirectChannelWithUser(c, user, otherUser, channelOptions...)
}

func (a *App) createDirectChannelWithUser(c request.CTX, user, otherUser *model.User, channelOptions ...model.ChannelOption) (*model.Channel, *model.AppError) {
	channel, nErr := a.Srv().Store().Channel().CreateDirectChannel(user, otherUser, channelOptions...)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		var cErr *store.ErrConflict
		var ltErr *store.ErrLimitExceeded
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &invErr):
			switch {
			case invErr.Entity == "Channel" && invErr.Field == "DeleteAt":
				return nil, model.NewAppError("createDirectChannelWithUser", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			case invErr.Entity == "Channel" && invErr.Field == "Type":
				return nil, model.NewAppError("createDirectChannelWithUser", "store.sql_channel.save_direct_channel.not_direct.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			case invErr.Entity == "Channel" && invErr.Field == "Id":
				return nil, model.NewAppError("SqlChannelStore.Save", "store.sql_channel.save_channel.existing.app_error", nil, "id="+invErr.Value.(string), http.StatusBadRequest).Wrap(nErr)
			}
		case errors.As(nErr, &cErr):
			switch cErr.Resource {
			case "Channel":
				return channel, model.NewAppError("createDirectChannelWithUser", store.ChannelExistsError, nil, "", http.StatusBadRequest).Wrap(nErr)
			case "ChannelMembers":
				return nil, model.NewAppError("createDirectChannelWithUser", "app.channel.save_member.exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			}
		case errors.As(nErr, &ltErr):
			return nil, model.NewAppError("createDirectChannelWithUser", "store.sql_channel.save_channel.limit.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appErr): // in case we haven't converted to plain error.
			return nil, appErr
		default: // last fallback in case it doesn't map to an existing app error.
			return nil, model.NewAppError("createDirectChannelWithUser", "app.channel.create_direct_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if err := a.Srv().Store().ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()); err != nil {
		return nil, model.NewAppError("createDirectChannelWithUser", "app.channel_member_history.log_join_event.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if user.Id != otherUser.Id {
		if err := a.Srv().Store().ChannelMemberHistory().LogJoinEvent(otherUser.Id, channel.Id, model.GetMillis()); err != nil {
			return nil, model.NewAppError("createDirectChannelWithUser", "app.channel_member_history.log_join_event.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// When the newly created channel is shared and the creator is local
	// create a local shared channel record
	if channel.IsShared() && !user.IsRemote() {
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			TeamId:           channel.TeamId,
			Home:             true,
			ReadOnly:         false,
			ShareName:        channel.Name,
			ShareDisplayName: channel.DisplayName,
			SharePurpose:     channel.Purpose,
			ShareHeader:      channel.Header,
			CreatorId:        user.Id,
			Type:             channel.Type,
		}

		if _, err := a.SaveSharedChannel(c, sc); err != nil {
			return nil, model.NewAppError("CreateDirectChannel", "app.sharedchannel.dm_channel_creation.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return channel, nil
}

func (a *App) CreateGroupChannel(c request.CTX, userIDs []string, creatorId string) (*model.Channel, *model.AppError) {
	channel, err := a.createGroupChannel(c, userIDs)
	if err != nil {
		if err.Id == store.ChannelExistsError {
			return channel, nil
		}
		return nil, err
	}

	for _, userID := range userIDs {
		a.InvalidateCacheForUser(userID)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventGroupAdded, "", channel.Id, "", nil, "")
	message.Add("teammate_ids", model.ArrayToJSON(userIDs))
	a.Publish(message)

	return channel, nil
}

func (a *App) createGroupChannel(c request.CTX, userIDs []string) (*model.Channel, *model.AppError) {
	if len(userIDs) > model.ChannelGroupMaxUsers || len(userIDs) < model.ChannelGroupMinUsers {
		return nil, model.NewAppError("CreateGroupChannel", "api.channel.create_group.bad_size.app_error", nil, "", http.StatusBadRequest)
	}

	users, err := a.Srv().Store().User().GetProfileByIds(context.Background(), userIDs, nil, true)
	if err != nil {
		return nil, model.NewAppError("createGroupChannel", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(users) != len(userIDs) {
		return nil, model.NewAppError("CreateGroupChannel", "api.channel.create_group.bad_user.app_error", nil, "user_ids="+model.ArrayToJSON(userIDs), http.StatusBadRequest)
	}

	group := &model.Channel{
		Name:        model.GetGroupNameFromUserIds(userIDs),
		DisplayName: model.GetGroupDisplayNameFromUsers(users, true),
		Type:        model.ChannelTypeGroup,
	}

	channel, nErr := a.Srv().Store().Channel().Save(group, *a.Config().TeamSettings.MaxChannelsPerTeam)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		var cErr *store.ErrConflict
		var ltErr *store.ErrLimitExceeded
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &invErr):
			switch {
			case invErr.Entity == "Channel" && invErr.Field == "DeleteAt":
				return nil, model.NewAppError("CreateChannel", "store.sql_channel.save.archived_channel.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			case invErr.Entity == "Channel" && invErr.Field == "Type":
				return nil, model.NewAppError("CreateChannel", "store.sql_channel.save.direct_channel.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			case invErr.Entity == "Channel" && invErr.Field == "Id":
				return nil, model.NewAppError("CreateChannel", "store.sql_channel.save_channel.existing.app_error", nil, "id="+invErr.Value.(string), http.StatusBadRequest).Wrap(nErr)
			}
		case errors.As(nErr, &cErr):
			return channel, model.NewAppError("CreateChannel", store.ChannelExistsError, nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &ltErr):
			return nil, model.NewAppError("CreateChannel", "store.sql_channel.save_channel.limit.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appErr): // in case we haven't converted to plain error.
			return nil, appErr
		default: // last fallback in case it doesn't map to an existing app error.
			return nil, model.NewAppError("CreateChannel", "app.channel.create_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	for _, user := range users {
		cm := &model.ChannelMember{
			UserId:      user.Id,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeGuest: user.IsGuest(),
			SchemeUser:  !user.IsGuest(),
		}

		if _, nErr = a.Srv().Store().Channel().SaveMember(cm); nErr != nil {
			var appErr *model.AppError
			var cErr *store.ErrConflict
			switch {
			case errors.As(nErr, &cErr):
				switch cErr.Resource {
				case "ChannelMembers":
					return nil, model.NewAppError("createGroupChannel", "app.channel.save_member.exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
				}
			case errors.As(nErr, &appErr):
				return nil, appErr
			default:
				return nil, model.NewAppError("createGroupChannel", "app.channel.create_direct_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
		if err := a.Srv().Store().ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()); err != nil {
			return nil, model.NewAppError("createGroupChannel", "app.channel_member_history.log_join_event.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return channel, nil
}

func (a *App) GetGroupChannel(c request.CTX, userIDs []string) (*model.Channel, *model.AppError) {
	if len(userIDs) > model.ChannelGroupMaxUsers || len(userIDs) < model.ChannelGroupMinUsers {
		return nil, model.NewAppError("GetGroupChannel", "api.channel.create_group.bad_size.app_error", nil, "", http.StatusBadRequest)
	}

	users, err := a.Srv().Store().User().GetProfileByIds(context.Background(), userIDs, nil, true)
	if err != nil {
		return nil, model.NewAppError("GetGroupChannel", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(users) != len(userIDs) {
		return nil, model.NewAppError("GetGroupChannel", "api.channel.create_group.bad_user.app_error", nil, "user_ids="+model.ArrayToJSON(userIDs), http.StatusBadRequest)
	}

	channel, appErr := a.GetChannelByName(c, model.GetGroupNameFromUserIds(userIDs), "", true)
	if appErr != nil {
		return nil, appErr
	}

	return channel, nil
}

// UpdateChannel updates a given channel by its Id. It also publishes the CHANNEL_UPDATED event.
func (a *App) UpdateChannel(c request.CTX, channel *model.Channel) (*model.Channel, *model.AppError) {
	_, err := a.Srv().Store().Channel().Update(channel)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateChannel", "app.channel.update.bad_id", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UpdateChannel", "app.channel.update_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.Srv().Platform().InvalidateCacheForChannel(channel)

	messageWs := model.NewWebSocketEvent(model.WebsocketEventChannelUpdated, "", channel.Id, "", nil, "")
	channelJSON, jsonErr := json.Marshal(channel)
	if jsonErr != nil {
		return nil, model.NewAppError("UpdateChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	messageWs.Add("channel", string(channelJSON))
	a.Publish(messageWs)

	return channel, nil
}

// CreateChannelScheme creates a new Scheme of scope channel and assigns it to the channel.
func (a *App) CreateChannelScheme(c request.CTX, channel *model.Channel) (*model.Scheme, *model.AppError) {
	scheme, err := a.CreateScheme(&model.Scheme{
		Name:        model.NewId(),
		DisplayName: model.NewId(),
		Scope:       model.SchemeScopeChannel,
	})
	if err != nil {
		return nil, err
	}

	channel.SchemeId = &scheme.Id
	if _, err := a.UpdateChannelScheme(c, channel); err != nil {
		return nil, err
	}
	return scheme, nil
}

// DeleteChannelScheme deletes a channels scheme and sets its SchemeId to nil.
func (a *App) DeleteChannelScheme(c request.CTX, channel *model.Channel) (*model.Channel, *model.AppError) {
	if channel.SchemeId != nil && *channel.SchemeId != "" {
		if _, err := a.DeleteScheme(*channel.SchemeId); err != nil {
			return nil, err
		}
	}
	channel.SchemeId = nil
	return a.UpdateChannelScheme(c, channel)
}

// UpdateChannelScheme saves the new SchemeId of the channel passed.
func (a *App) UpdateChannelScheme(c request.CTX, channel *model.Channel) (*model.Channel, *model.AppError) {
	var oldChannel *model.Channel
	var err *model.AppError
	if oldChannel, err = a.GetChannel(c, channel.Id); err != nil {
		return nil, err
	}

	oldChannel.SchemeId = channel.SchemeId
	return a.UpdateChannel(c, oldChannel)
}

func (a *App) UpdateChannelPrivacy(c request.CTX, oldChannel *model.Channel, user *model.User) (*model.Channel, *model.AppError) {
	channel, err := a.UpdateChannel(c, oldChannel)
	if err != nil {
		return channel, err
	}

	if err := a.postChannelPrivacyMessage(c, user, channel); err != nil {
		if channel.Type == model.ChannelTypeOpen {
			channel.Type = model.ChannelTypePrivate
		} else {
			channel.Type = model.ChannelTypeOpen
		}
		// revert to previous channel privacy
		a.UpdateChannel(c, channel)
		return channel, err
	}

	a.Srv().Platform().InvalidateCacheForChannel(channel)

	messageWs := model.NewWebSocketEvent(model.WebsocketEventChannelConverted, channel.TeamId, "", "", nil, "")
	messageWs.Add("channel_id", channel.Id)
	a.Publish(messageWs)

	return channel, nil
}

func (a *App) postChannelPrivacyMessage(c request.CTX, user *model.User, channel *model.Channel) *model.AppError {
	var authorId string
	var authorUsername string
	if user != nil {
		authorId = user.Id
		authorUsername = user.Username
	} else {
		systemBot, err := a.GetSystemBot()
		if err != nil {
			return model.NewAppError("postChannelPrivacyMessage", "api.channel.post_channel_privacy_message.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		authorId = systemBot.UserId
		authorUsername = systemBot.Username
	}

	message := (map[model.ChannelType]string{
		model.ChannelTypeOpen:    i18n.T("api.channel.change_channel_privacy.private_to_public"),
		model.ChannelTypePrivate: i18n.T("api.channel.change_channel_privacy.public_to_private"),
	})[channel.Type]
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		Type:      model.PostTypeChangeChannelPrivacy,
		UserId:    authorId,
		Props: model.StringInterface{
			"username": authorUsername,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postChannelPrivacyMessage", "api.channel.post_channel_privacy_message.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) RestoreChannel(c request.CTX, channel *model.Channel, userID string) (*model.Channel, *model.AppError) {
	if channel.DeleteAt == 0 {
		return nil, model.NewAppError("restoreChannel", "api.channel.restore_channel.restored.app_error", nil, "", http.StatusBadRequest)
	}

	if err := a.Srv().Store().Channel().Restore(channel.Id, model.GetMillis()); err != nil {
		return nil, model.NewAppError("RestoreChannel", "app.channel.restore.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	channel.DeleteAt = 0
	a.Srv().Platform().InvalidateCacheForChannel(channel)

	message := model.NewWebSocketEvent(model.WebsocketEventChannelRestored, channel.TeamId, "", "", nil, "")
	message.Add("channel_id", channel.Id)
	a.Publish(message)

	var user *model.User
	if userID != "" {
		var nErr error
		user, nErr = a.Srv().Store().User().Get(context.Background(), userID)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return nil, model.NewAppError("RestoreChannel", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
			default:
				return nil, model.NewAppError("RestoreChannel", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
	}

	if user != nil {
		T := i18n.GetUserTranslations(user.Locale)

		post := &model.Post{
			ChannelId: channel.Id,
			Message:   T("api.channel.restore_channel.unarchived", map[string]any{"Username": user.Username}),
			Type:      model.PostTypeChannelRestored,
			UserId:    userID,
			Props: model.StringInterface{
				"username": user.Username,
			},
		}

		if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
			c.Logger().Warn("Failed to post unarchive message", mlog.Err(err))
		}
	} else {
		a.Srv().Go(func() {
			systemBot, err := a.GetSystemBot()
			if err != nil {
				c.Logger().Error("Failed to post unarchive message", mlog.Err(err))
				return
			}

			post := &model.Post{
				ChannelId: channel.Id,
				Message:   i18n.T("api.channel.restore_channel.unarchived", map[string]any{"Username": systemBot.Username}),
				Type:      model.PostTypeChannelRestored,
				UserId:    systemBot.UserId,
				Props: model.StringInterface{
					"username": systemBot.Username,
				},
			}

			if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
				c.Logger().Error("Failed to post unarchive message", mlog.Err(err))
			}
		})
	}

	return channel, nil
}

func (a *App) PatchChannel(c request.CTX, channel *model.Channel, patch *model.ChannelPatch, userID string) (*model.Channel, *model.AppError) {
	oldChannelDisplayName := channel.DisplayName
	oldChannelHeader := channel.Header
	oldChannelPurpose := channel.Purpose

	channel.Patch(patch)
	channel, err := a.UpdateChannel(c, channel)
	if err != nil {
		return nil, err
	}

	if oldChannelDisplayName != channel.DisplayName {
		if err = a.PostUpdateChannelDisplayNameMessage(c, userID, channel, oldChannelDisplayName, channel.DisplayName); err != nil {
			c.Logger().Warn(err.Error())
		}
	}

	if channel.Header != oldChannelHeader {
		if err = a.PostUpdateChannelHeaderMessage(c, userID, channel, oldChannelHeader, channel.Header); err != nil {
			c.Logger().Warn(err.Error())
		}
	}

	if channel.Purpose != oldChannelPurpose {
		if err = a.PostUpdateChannelPurposeMessage(c, userID, channel, oldChannelPurpose, channel.Purpose); err != nil {
			c.Logger().Warn(err.Error())
		}
	}

	return channel, nil
}

// GetSchemeRolesForChannel Checks if a channel or its team has an override scheme for channel roles and returns the scheme roles or default channel roles.
func (a *App) GetSchemeRolesForChannel(c request.CTX, channelID string) (guestRoleName, userRoleName, adminRoleName string, err *model.AppError) {
	channel, err := a.GetChannel(c, channelID)
	if err != nil {
		return
	}

	if channel.SchemeId != nil && *channel.SchemeId != "" {
		var scheme *model.Scheme
		scheme, err = a.GetScheme(*channel.SchemeId)
		if err != nil {
			return
		}

		guestRoleName = scheme.DefaultChannelGuestRole
		userRoleName = scheme.DefaultChannelUserRole
		adminRoleName = scheme.DefaultChannelAdminRole

		return
	}

	return a.GetTeamSchemeChannelRoles(c, channel.TeamId)
}

// GetTeamSchemeChannelRoles Checks if a team has an override scheme and returns the scheme channel role names or default channel role names.
func (a *App) GetTeamSchemeChannelRoles(c request.CTX, teamID string) (guestRoleName, userRoleName, adminRoleName string, err *model.AppError) {
	team, err := a.GetTeam(teamID)
	if err != nil {
		return
	}

	if team.SchemeId != nil && *team.SchemeId != "" {
		var scheme *model.Scheme
		scheme, err = a.GetScheme(*team.SchemeId)
		if err != nil {
			return
		}

		guestRoleName = scheme.DefaultChannelGuestRole
		userRoleName = scheme.DefaultChannelUserRole
		adminRoleName = scheme.DefaultChannelAdminRole
	} else {
		guestRoleName = model.ChannelGuestRoleId
		userRoleName = model.ChannelUserRoleId
		adminRoleName = model.ChannelAdminRoleId
	}

	return
}

// GetChannelModerationsForChannel Gets a channels ChannelModerations from either the higherScoped roles or from the channel scheme roles.
func (a *App) GetChannelModerationsForChannel(c request.CTX, channel *model.Channel) ([]*model.ChannelModeration, *model.AppError) {
	guestRoleName, memberRoleName, _, err := a.GetSchemeRolesForChannel(c, channel.Id)
	if err != nil {
		return nil, err
	}

	memberRole, err := a.GetRoleByName(context.Background(), memberRoleName)
	if err != nil {
		return nil, err
	}

	var guestRole *model.Role
	if guestRoleName != "" {
		guestRole, err = a.GetRoleByName(context.Background(), guestRoleName)
		if err != nil {
			return nil, err
		}
	}

	higherScopedGuestRoleName, higherScopedMemberRoleName, _, err := a.GetTeamSchemeChannelRoles(c, channel.TeamId)
	if err != nil {
		return nil, err
	}
	higherScopedMemberRole, err := a.GetRoleByName(context.Background(), higherScopedMemberRoleName)
	if err != nil {
		return nil, err
	}

	var higherScopedGuestRole *model.Role
	if higherScopedGuestRoleName != "" {
		higherScopedGuestRole, err = a.GetRoleByName(context.Background(), higherScopedGuestRoleName)
		if err != nil {
			return nil, err
		}
	}

	return buildChannelModerations(c, channel.Type, memberRole, guestRole, higherScopedMemberRole, higherScopedGuestRole), nil
}

// PatchChannelModerationsForChannel Updates a channels scheme roles based on a given ChannelModerationPatch, if the permissions match the higher scoped role the scheme is deleted.
func (a *App) PatchChannelModerationsForChannel(c request.CTX, channel *model.Channel, channelModerationsPatch []*model.ChannelModerationPatch) ([]*model.ChannelModeration, *model.AppError) {
	higherScopedGuestRoleName, higherScopedMemberRoleName, _, err := a.GetTeamSchemeChannelRoles(c, channel.TeamId)
	if err != nil {
		return nil, err
	}

	ctx := sqlstore.WithMaster(context.Background())
	higherScopedMemberRole, err := a.GetRoleByName(ctx, higherScopedMemberRoleName)
	if err != nil {
		return nil, err
	}

	var higherScopedGuestRole *model.Role
	if higherScopedGuestRoleName != "" {
		higherScopedGuestRole, err = a.GetRoleByName(ctx, higherScopedGuestRoleName)
		if err != nil {
			return nil, err
		}
	}

	higherScopedMemberPermissions := higherScopedMemberRole.GetChannelModeratedPermissions(channel.Type)

	var higherScopedGuestPermissions map[string]bool
	if higherScopedGuestRole != nil {
		higherScopedGuestPermissions = higherScopedGuestRole.GetChannelModeratedPermissions(channel.Type)
	}

	for _, moderationPatch := range channelModerationsPatch {
		if moderationPatch.Roles.Members != nil && *moderationPatch.Roles.Members && !higherScopedMemberPermissions[*moderationPatch.Name] {
			return nil, &model.AppError{Message: "Cannot add a permission that is restricted by the team or system permission scheme"}
		}
		if moderationPatch.Roles.Guests != nil && *moderationPatch.Roles.Guests && !higherScopedGuestPermissions[*moderationPatch.Name] {
			return nil, &model.AppError{Message: "Cannot add a permission that is restricted by the team or system permission scheme"}
		}
	}

	var scheme *model.Scheme
	// Channel has no scheme so create one
	if channel.SchemeId == nil || *channel.SchemeId == "" {
		scheme, err = a.CreateChannelScheme(c, channel)
		if err != nil {
			return nil, err
		}

		// Send a websocket event about this new role. The other new roles—member and guest—get emitted when they're updated.
		var adminRole *model.Role
		adminRole, err = a.GetRoleByName(ctx, scheme.DefaultChannelAdminRole)
		if err != nil {
			return nil, err
		}
		if appErr := a.sendUpdatedRoleEvent(adminRole); appErr != nil {
			return nil, appErr
		}

		message := model.NewWebSocketEvent(model.WebsocketEventChannelSchemeUpdated, "", channel.Id, "", nil, "")
		a.Publish(message)
		c.Logger().Info("Permission scheme created.", mlog.String("channel_id", channel.Id), mlog.String("channel_name", channel.Name))
	} else {
		scheme, err = a.GetScheme(*channel.SchemeId)
		if err != nil {
			return nil, err
		}
	}

	guestRoleName := scheme.DefaultChannelGuestRole
	memberRoleName := scheme.DefaultChannelUserRole
	memberRole, err := a.GetRoleByName(ctx, memberRoleName)
	if err != nil {
		return nil, err
	}

	var guestRole *model.Role
	if guestRoleName != "" {
		guestRole, err = a.GetRoleByName(ctx, guestRoleName)
		if err != nil {
			return nil, err
		}
	}

	memberRolePatch := memberRole.RolePatchFromChannelModerationsPatch(channelModerationsPatch, "members")
	var guestRolePatch *model.RolePatch
	if guestRole != nil {
		guestRolePatch = guestRole.RolePatchFromChannelModerationsPatch(channelModerationsPatch, "guests")
	}

	for _, channelModerationPatch := range channelModerationsPatch {
		permissionModified := *channelModerationPatch.Name
		if channelModerationPatch.Roles.Guests != nil && utils.StringInSlice(permissionModified, model.ChannelModeratedPermissionsChangedByPatch(guestRole, guestRolePatch)) {
			if *channelModerationPatch.Roles.Guests {
				c.Logger().Info("Permission enabled for guests.", mlog.String("permission", permissionModified), mlog.String("channel_id", channel.Id), mlog.String("channel_name", channel.Name))
			} else {
				c.Logger().Info("Permission disabled for guests.", mlog.String("permission", permissionModified), mlog.String("channel_id", channel.Id), mlog.String("channel_name", channel.Name))
			}
		}

		if channelModerationPatch.Roles.Members != nil && utils.StringInSlice(permissionModified, model.ChannelModeratedPermissionsChangedByPatch(memberRole, memberRolePatch)) {
			if *channelModerationPatch.Roles.Members {
				c.Logger().Info("Permission enabled for members.", mlog.String("permission", permissionModified), mlog.String("channel_id", channel.Id), mlog.String("channel_name", channel.Name))
			} else {
				c.Logger().Info("Permission disabled for members.", mlog.String("permission", permissionModified), mlog.String("channel_id", channel.Id), mlog.String("channel_name", channel.Name))
			}
		}
	}

	memberRolePermissionsUnmodified := len(model.ChannelModeratedPermissionsChangedByPatch(higherScopedMemberRole, memberRolePatch)) == 0
	guestRolePermissionsUnmodified := len(model.ChannelModeratedPermissionsChangedByPatch(higherScopedGuestRole, guestRolePatch)) == 0
	if memberRolePermissionsUnmodified && guestRolePermissionsUnmodified {
		// The channel scheme matches the permissions of its higherScoped scheme so delete the scheme
		if _, err = a.DeleteChannelScheme(c, channel); err != nil {
			return nil, err
		}

		message := model.NewWebSocketEvent(model.WebsocketEventChannelSchemeUpdated, "", channel.Id, "", nil, "")
		a.Publish(message)

		memberRole = higherScopedMemberRole
		guestRole = higherScopedGuestRole
		c.Logger().Info("Permission scheme deleted.", mlog.String("channel_id", channel.Id), mlog.String("channel_name", channel.Name))
	} else {
		memberRole, err = a.PatchRole(memberRole, memberRolePatch)
		if err != nil {
			return nil, err
		}
		guestRole, err = a.PatchRole(guestRole, guestRolePatch)
		if err != nil {
			return nil, err
		}
	}

	cErr := a.forEachChannelMember(c, channel.Id, func(channelMember model.ChannelMember) error {
		a.Srv().Store().Channel().InvalidateAllChannelMembersForUser(channelMember.UserId)

		evt := model.NewWebSocketEvent(model.WebsocketEventChannelMemberUpdated, "", "", channelMember.UserId, nil, "")
		memberJSON, jsonErr := json.Marshal(channelMember)
		if jsonErr != nil {
			return jsonErr
		}
		evt.Add("channelMember", string(memberJSON))
		a.Publish(evt)

		return nil
	})
	if cErr != nil {
		return nil, model.NewAppError("PatchChannelModerationsForChannel", "api.channel.patch_channel_moderations.cache_invalidation.error", nil, "", http.StatusInternalServerError).Wrap(cErr)
	}

	return buildChannelModerations(c, channel.Type, memberRole, guestRole, higherScopedMemberRole, higherScopedGuestRole), nil
}

func buildChannelModerations(c request.CTX, channelType model.ChannelType, memberRole *model.Role, guestRole *model.Role, higherScopedMemberRole *model.Role, higherScopedGuestRole *model.Role) []*model.ChannelModeration {
	var memberPermissions, guestPermissions, higherScopedMemberPermissions, higherScopedGuestPermissions map[string]bool
	if memberRole != nil {
		memberPermissions = memberRole.GetChannelModeratedPermissions(channelType)
	}
	if guestRole != nil {
		guestPermissions = guestRole.GetChannelModeratedPermissions(channelType)
	}
	if higherScopedMemberRole != nil {
		higherScopedMemberPermissions = higherScopedMemberRole.GetChannelModeratedPermissions(channelType)
	}
	if higherScopedGuestRole != nil {
		higherScopedGuestPermissions = higherScopedGuestRole.GetChannelModeratedPermissions(channelType)
	}

	var channelModerations []*model.ChannelModeration
	for _, permissionKey := range model.ChannelModeratedPermissions {
		roles := &model.ChannelModeratedRoles{}

		roles.Members = &model.ChannelModeratedRole{
			Value:   memberPermissions[permissionKey],
			Enabled: higherScopedMemberPermissions[permissionKey],
		}

		if permissionKey == "manage_members" {
			roles.Guests = nil
		} else {
			roles.Guests = &model.ChannelModeratedRole{
				Value:   guestPermissions[permissionKey],
				Enabled: higherScopedGuestPermissions[permissionKey],
			}
		}

		moderation := &model.ChannelModeration{
			Name:  permissionKey,
			Roles: roles,
		}

		channelModerations = append(channelModerations, moderation)
	}

	return channelModerations
}

func (a *App) UpdateChannelMemberRoles(c request.CTX, channelID string, userID string, newRoles string) (*model.ChannelMember, *model.AppError) {
	var member *model.ChannelMember
	var err *model.AppError
	if member, err = a.GetChannelMember(c, channelID, userID); err != nil {
		return nil, err
	}

	schemeGuestRole, schemeUserRole, schemeAdminRole, err := a.GetSchemeRolesForChannel(c, channelID)
	if err != nil {
		return nil, err
	}

	prevSchemeGuestValue := member.SchemeGuest

	var newExplicitRoles []string
	member.SchemeGuest = false
	member.SchemeUser = false
	member.SchemeAdmin = false

	for _, roleName := range strings.Fields(newRoles) {
		var role *model.Role
		role, err = a.GetRoleByName(context.Background(), roleName)
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
			case schemeGuestRole:
				member.SchemeGuest = true
			default:
				// If not part of the scheme for this channel, then it is not allowed to apply it as an explicit role.
				return nil, model.NewAppError("UpdateChannelMemberRoles", "api.channel.update_channel_member_roles.scheme_role.app_error", nil, "role_name="+roleName, http.StatusBadRequest)
			}
		}
	}

	if member.SchemeUser && member.SchemeGuest {
		return nil, model.NewAppError("UpdateChannelMemberRoles", "api.channel.update_channel_member_roles.guest_and_user.app_error", nil, "", http.StatusBadRequest)
	}

	if prevSchemeGuestValue != member.SchemeGuest {
		return nil, model.NewAppError("UpdateChannelMemberRoles", "api.channel.update_channel_member_roles.changing_guest_role.app_error", nil, "", http.StatusBadRequest)
	}

	member.ExplicitRoles = strings.Join(newExplicitRoles, " ")

	return a.updateChannelMember(c, member)
}

func (a *App) UpdateChannelMemberSchemeRoles(c request.CTX, channelID string, userID string, isSchemeGuest bool, isSchemeUser bool, isSchemeAdmin bool) (*model.ChannelMember, *model.AppError) {
	member, err := a.GetChannelMember(c, channelID, userID)
	if err != nil {
		return nil, err
	}

	member.SchemeAdmin = isSchemeAdmin
	member.SchemeUser = isSchemeUser
	member.SchemeGuest = isSchemeGuest

	if member.SchemeUser && member.SchemeGuest {
		return nil, model.NewAppError("UpdateChannelMemberSchemeRoles", "api.channel.update_channel_member_roles.guest_and_user.app_error", nil, "", http.StatusBadRequest)
	}

	// If the migration is not completed, we also need to check the default channel_admin/channel_user roles are not present in the roles field.
	if err = a.IsPhase2MigrationCompleted(); err != nil {
		member.ExplicitRoles = RemoveRoles([]string{model.ChannelGuestRoleId, model.ChannelUserRoleId, model.ChannelAdminRoleId}, member.ExplicitRoles)
	}

	return a.updateChannelMember(c, member)
}

func (a *App) UpdateChannelMemberNotifyProps(c request.CTX, data map[string]string, channelID string, userID string) (*model.ChannelMember, *model.AppError) {
	filteredProps := make(map[string]string)

	// update whichever notify properties have been provided, but don't change the others
	if markUnread, exists := data[model.MarkUnreadNotifyProp]; exists {
		filteredProps[model.MarkUnreadNotifyProp] = markUnread
	}

	if desktop, exists := data[model.DesktopNotifyProp]; exists {
		filteredProps[model.DesktopNotifyProp] = desktop
	}

	if desktop_threads, exists := data[model.DesktopThreadsNotifyProp]; exists {
		filteredProps[model.DesktopThreadsNotifyProp] = desktop_threads
	}

	if email, exists := data[model.EmailNotifyProp]; exists {
		filteredProps[model.EmailNotifyProp] = email
	}

	if push, exists := data[model.PushNotifyProp]; exists {
		filteredProps[model.PushNotifyProp] = push
	}

	if push_threads, exists := data[model.PushThreadsNotifyProp]; exists {
		filteredProps[model.PushThreadsNotifyProp] = push_threads
	}

	if ignoreChannelMentions, exists := data[model.IgnoreChannelMentionsNotifyProp]; exists {
		filteredProps[model.IgnoreChannelMentionsNotifyProp] = ignoreChannelMentions
	}

	member, err := a.Srv().Store().Channel().UpdateMemberNotifyProps(channelID, userID, filteredProps)
	if err != nil {
		var appErr *model.AppError
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("updateMemberNotifyProps", MissingChannelMemberError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("updateMemberNotifyProps", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.InvalidateCacheForUser(member.UserId)
	a.invalidateCacheForChannelMembersNotifyProps(member.ChannelId)

	// Notify the clients that the member notify props changed
	evt := model.NewWebSocketEvent(model.WebsocketEventChannelMemberUpdated, "", "", member.UserId, nil, "")
	memberJSON, jsonErr := json.Marshal(member)
	if jsonErr != nil {
		return nil, model.NewAppError("UpdateChannelMemberNotifyProps", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	evt.Add("channelMember", string(memberJSON))
	a.Publish(evt)

	return member, nil
}

func (a *App) updateChannelMember(c request.CTX, member *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	member, err := a.Srv().Store().Channel().UpdateMember(member)
	if err != nil {
		var appErr *model.AppError
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("updateChannelMember", MissingChannelMemberError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("updateChannelMember", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.InvalidateCacheForUser(member.UserId)

	// Notify the clients that the member notify props changed
	evt := model.NewWebSocketEvent(model.WebsocketEventChannelMemberUpdated, "", "", member.UserId, nil, "")
	memberJSON, jsonErr := json.Marshal(member)
	if jsonErr != nil {
		return nil, model.NewAppError("updateChannelMember", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	evt.Add("channelMember", string(memberJSON))
	a.Publish(evt)

	return member, nil
}

func (a *App) DeleteChannel(c request.CTX, channel *model.Channel, userID string) *model.AppError {
	ihc := make(chan store.StoreResult, 1)
	ohc := make(chan store.StoreResult, 1)

	go func() {
		webhooks, err := a.Srv().Store().Webhook().GetIncomingByChannel(channel.Id)
		ihc <- store.StoreResult{Data: webhooks, NErr: err}
		close(ihc)
	}()

	go func() {
		outgoingHooks, err := a.Srv().Store().Webhook().GetOutgoingByChannel(channel.Id, -1, -1)
		ohc <- store.StoreResult{Data: outgoingHooks, NErr: err}
		close(ohc)
	}()

	var user *model.User
	if userID != "" {
		var nErr error
		user, nErr = a.Srv().Store().User().Get(context.Background(), userID)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return model.NewAppError("DeleteChannel", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
			default:
				return model.NewAppError("DeleteChannel", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
	}

	ihcresult := <-ihc
	if ihcresult.NErr != nil {
		return model.NewAppError("DeleteChannel", "app.webhooks.get_incoming_by_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(ihcresult.NErr)
	}

	ohcresult := <-ohc
	if ohcresult.NErr != nil {
		return model.NewAppError("DeleteChannel", "app.webhooks.get_outgoing_by_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(ohcresult.NErr)
	}

	incomingHooks := ihcresult.Data.([]*model.IncomingWebhook)
	outgoingHooks := ohcresult.Data.([]*model.OutgoingWebhook)

	if channel.DeleteAt > 0 {
		err := model.NewAppError("deleteChannel", "api.channel.delete_channel.deleted.app_error", nil, "", http.StatusBadRequest)
		return err
	}

	if channel.Name == model.DefaultChannelName {
		err := model.NewAppError("deleteChannel", "api.channel.delete_channel.cannot.app_error", map[string]any{"Channel": model.DefaultChannelName}, "", http.StatusBadRequest)
		return err
	}

	if user != nil {
		T := i18n.GetUserTranslations(user.Locale)

		post := &model.Post{
			ChannelId: channel.Id,
			Message:   fmt.Sprintf(T("api.channel.delete_channel.archived"), user.Username),
			Type:      model.PostTypeChannelDeleted,
			UserId:    userID,
			Props: model.StringInterface{
				"username": user.Username,
			},
		}

		if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
			c.Logger().Warn("Failed to post archive message", mlog.Err(err))
		}
	} else {
		systemBot, err := a.GetSystemBot()
		if err != nil {
			c.Logger().Warn("Failed to post archive message", mlog.Err(err))
		} else {
			post := &model.Post{
				ChannelId: channel.Id,
				Message:   fmt.Sprintf(i18n.T("api.channel.delete_channel.archived"), systemBot.Username),
				Type:      model.PostTypeChannelDeleted,
				UserId:    systemBot.UserId,
				Props: model.StringInterface{
					"username": systemBot.Username,
				},
			}

			if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
				c.Logger().Warn("Failed to post archive message", mlog.Err(err))
			}
		}
	}

	now := model.GetMillis()
	for _, hook := range incomingHooks {
		if err := a.Srv().Store().Webhook().DeleteIncoming(hook.Id, now); err != nil {
			c.Logger().Warn("Encountered error deleting incoming webhook", mlog.String("hook_id", hook.Id), mlog.Err(err))
		}
		a.Srv().Platform().InvalidateCacheForWebhook(hook.Id)
	}

	for _, hook := range outgoingHooks {
		if err := a.Srv().Store().Webhook().DeleteOutgoing(hook.Id, now); err != nil {
			c.Logger().Warn("Encountered error deleting outgoing webhook", mlog.String("hook_id", hook.Id), mlog.Err(err))
		}
	}

	deleteAt := model.GetMillis()

	if err := a.Srv().Store().Channel().Delete(channel.Id, deleteAt); err != nil {
		return model.NewAppError("DeleteChannel", "app.channel.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	a.Srv().Platform().InvalidateCacheForChannel(channel)

	message := model.NewWebSocketEvent(model.WebsocketEventChannelDeleted, channel.TeamId, "", "", nil, "")
	message.Add("channel_id", channel.Id)
	message.Add("delete_at", deleteAt)
	a.Publish(message)

	return nil
}

func (a *App) addUserToChannel(c request.CTX, user *model.User, channel *model.Channel) (*model.ChannelMember, *model.AppError) {
	if channel.Type != model.ChannelTypeOpen && channel.Type != model.ChannelTypePrivate {
		return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusBadRequest)
	}

	channelMember, nErr := a.Srv().Store().Channel().GetMember(context.Background(), channel.Id, user.Id)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(nErr, &nfErr) {
			return nil, model.NewAppError("AddUserToChannel", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	} else {
		return channelMember, nil
	}

	if channel.IsGroupConstrained() {
		nonMembers, err := a.FilterNonGroupChannelMembers([]string{user.Id}, channel)
		if err != nil {
			return nil, model.NewAppError("addUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusInternalServerError)
		}
		if len(nonMembers) > 0 {
			return nil, model.NewAppError("addUserToChannel", "api.channel.add_members.user_denied", map[string]any{"UserIDs": nonMembers}, "", http.StatusBadRequest)
		}
	}

	newMember := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: user.IsGuest(),
		SchemeUser:  !user.IsGuest(),
	}

	if !user.IsGuest() {
		var userShouldBeAdmin bool
		userShouldBeAdmin, appErr := a.UserIsInAdminRoleGroup(user.Id, channel.Id, model.GroupSyncableTypeChannel)
		if appErr != nil {
			return nil, appErr
		}
		newMember.SchemeAdmin = userShouldBeAdmin
	}

	newMember, nErr = a.Srv().Store().Channel().SaveMember(newMember)
	if nErr != nil {
		return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.app_error", nil,
			fmt.Sprintf("failed to add member: %v, user_id: %s, channel_id: %s", nErr, user.Id, channel.Id), http.StatusInternalServerError)
	}

	if nErr := a.Srv().Store().ChannelMemberHistory().LogJoinEvent(user.Id, channel.Id, model.GetMillis()); nErr != nil {
		return nil, model.NewAppError("AddUserToChannel", "app.channel_member_history.log_join_event.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	a.InvalidateCacheForUser(user.Id)
	a.invalidateCacheForChannelMembers(channel.Id)

	return newMember, nil
}

// AddUserToChannel adds a user to a given channel.
func (a *App) AddUserToChannel(c request.CTX, user *model.User, channel *model.Channel, skipTeamMemberIntegrityCheck bool) (*model.ChannelMember, *model.AppError) {
	if !skipTeamMemberIntegrityCheck {
		teamMember, nErr := a.Srv().Store().Team().GetMember(context.Background(), channel.TeamId, user.Id)
		if nErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(nErr, &nfErr):
				return nil, model.NewAppError("AddUserToChannel", "app.team.get_member.missing.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
			default:
				return nil, model.NewAppError("AddUserToChannel", "app.team.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}

		if teamMember.DeleteAt > 0 {
			return nil, model.NewAppError("AddUserToChannel", "api.channel.add_user.to.channel.failed.deleted.app_error", nil, "", http.StatusBadRequest)
		}
	}

	newMember, err := a.addUserToChannel(c, user, channel)
	if err != nil {
		return nil, err
	}

	options := a.Config().GetSanitizeOptions()
	user.SanitizeProfile(options)

	message := model.NewWebSocketEvent(model.WebsocketEventUserAdded, "", channel.Id, "", nil, "")
	message.Add("user", user)
	message.Add("team_id", channel.TeamId)
	a.Publish(message)

	return newMember, nil
}

type ChannelMemberOpts struct {
	UserRequestorID string
	PostRootID      string
	// SkipTeamMemberIntegrityCheck is used to indicate whether it should be checked
	// that a user has already been removed from that team or not.
	// This is useful to avoid in scenarios when we just added the team member,
	// and thereby know that there is no need to check this.
	SkipTeamMemberIntegrityCheck bool
}

// AddChannelMember adds a user to a channel. It is a wrapper over AddUserToChannel.
func (a *App) AddChannelMember(c request.CTX, userID string, channel *model.Channel, opts ChannelMemberOpts) (*model.ChannelMember, *model.AppError) {
	if member, err := a.Srv().Store().Channel().GetMember(context.Background(), channel.Id, userID); err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return nil, model.NewAppError("AddChannelMember", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		return member, nil
	}

	var user *model.User
	var err *model.AppError

	if user, err = a.GetUser(userID); err != nil {
		return nil, err
	}

	var userRequestor *model.User
	if opts.UserRequestorID != "" {
		if userRequestor, err = a.GetUser(opts.UserRequestorID); err != nil {
			return nil, err
		}
	}

	cm, err := a.AddUserToChannel(c, user, channel, opts.SkipTeamMemberIntegrityCheck)
	if err != nil {
		return nil, err
	}

	a.Srv().Go(func() {
		pluginContext := pluginContext(c)
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.UserHasJoinedChannel(pluginContext, cm, userRequestor)
			return true
		}, plugin.UserHasJoinedChannelID)
	})

	if opts.UserRequestorID == "" || userID == opts.UserRequestorID {
		if err := a.postJoinChannelMessage(c, user, channel); err != nil {
			return nil, err
		}
	} else {
		a.Srv().Go(func() {
			a.PostAddToChannelMessage(c, userRequestor, user, channel, opts.PostRootID)
		})
	}

	return cm, nil
}

func (a *App) AddDirectChannels(c request.CTX, teamID string, user *model.User) *model.AppError {
	var profiles []*model.User
	options := &model.UserGetOptions{InTeamId: teamID, Page: 0, PerPage: 100}
	profiles, err := a.Srv().Store().User().GetProfiles(options)
	if err != nil {
		return model.NewAppError("AddDirectChannels", "api.user.add_direct_channels_and_forget.failed.error", map[string]any{"UserId": user.Id, "TeamId": teamID, "Error": err.Error()}, "", http.StatusInternalServerError)
	}

	var preferences model.Preferences

	for _, profile := range profiles {
		if profile.Id == user.Id {
			continue
		}

		preference := model.Preference{
			UserId:   user.Id,
			Category: model.PreferenceCategoryDirectChannelShow,
			Name:     profile.Id,
			Value:    "true",
		}

		preferences = append(preferences, preference)

		if len(preferences) >= 10 {
			break
		}
	}

	if err := a.Srv().Store().Preference().Save(preferences); err != nil {
		return model.NewAppError("AddDirectChannels", "api.user.add_direct_channels_and_forget.failed.error", map[string]any{"UserId": user.Id, "TeamId": teamID, "Error": err.Error()}, "", http.StatusInternalServerError)
	}

	return nil
}

func (a *App) PostUpdateChannelHeaderMessage(c request.CTX, userID string, channel *model.Channel, oldChannelHeader, newChannelHeader string) *model.AppError {
	user, err := a.Srv().Store().User().Get(context.Background(), userID)
	if err != nil {
		return model.NewAppError("PostUpdateChannelHeaderMessage", "api.channel.post_update_channel_header_message_and_forget.retrieve_user.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	var message string
	if oldChannelHeader == "" {
		message = fmt.Sprintf(i18n.T("api.channel.post_update_channel_header_message_and_forget.updated_to"), user.Username, newChannelHeader)
	} else if newChannelHeader == "" {
		message = fmt.Sprintf(i18n.T("api.channel.post_update_channel_header_message_and_forget.removed"), user.Username, oldChannelHeader)
	} else {
		message = fmt.Sprintf(i18n.T("api.channel.post_update_channel_header_message_and_forget.updated_from"), user.Username, oldChannelHeader, newChannelHeader)
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		Type:      model.PostTypeHeaderChange,
		UserId:    userID,
		Props: model.StringInterface{
			"username":   user.Username,
			"old_header": oldChannelHeader,
			"new_header": newChannelHeader,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("", "api.channel.post_update_channel_header_message_and_forget.post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) PostUpdateChannelPurposeMessage(c request.CTX, userID string, channel *model.Channel, oldChannelPurpose string, newChannelPurpose string) *model.AppError {
	user, err := a.Srv().Store().User().Get(context.Background(), userID)
	if err != nil {
		return model.NewAppError("PostUpdateChannelPurposeMessage", "app.channel.post_update_channel_purpose_message.retrieve_user.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	var message string
	if oldChannelPurpose == "" {
		message = fmt.Sprintf(i18n.T("app.channel.post_update_channel_purpose_message.updated_to"), user.Username, newChannelPurpose)
	} else if newChannelPurpose == "" {
		message = fmt.Sprintf(i18n.T("app.channel.post_update_channel_purpose_message.removed"), user.Username, oldChannelPurpose)
	} else {
		message = fmt.Sprintf(i18n.T("app.channel.post_update_channel_purpose_message.updated_from"), user.Username, oldChannelPurpose, newChannelPurpose)
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		Type:      model.PostTypePurposeChange,
		UserId:    userID,
		Props: model.StringInterface{
			"username":    user.Username,
			"old_purpose": oldChannelPurpose,
			"new_purpose": newChannelPurpose,
		},
	}
	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("", "app.channel.post_update_channel_purpose_message.post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) PostUpdateChannelDisplayNameMessage(c request.CTX, userID string, channel *model.Channel, oldChannelDisplayName, newChannelDisplayName string) *model.AppError {
	user, err := a.Srv().Store().User().Get(context.Background(), userID)
	if err != nil {
		return model.NewAppError("PostUpdateChannelDisplayNameMessage", "api.channel.post_update_channel_displayname_message_and_forget.retrieve_user.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	message := fmt.Sprintf(i18n.T("api.channel.post_update_channel_displayname_message_and_forget.updated_from"), user.Username, oldChannelDisplayName, newChannelDisplayName)

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		Type:      model.PostTypeDisplaynameChange,
		UserId:    userID,
		Props: model.StringInterface{
			"username":        user.Username,
			"old_displayname": oldChannelDisplayName,
			"new_displayname": newChannelDisplayName,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("PostUpdateChannelDisplayNameMessage", "api.channel.post_update_channel_displayname_message_and_forget.create_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) GetChannel(c request.CTX, channelID string) (*model.Channel, *model.AppError) {
	return a.Srv().getChannel(c, channelID)
}

func (s *Server) getChannel(c request.CTX, channelID string) (*model.Channel, *model.AppError) {
	channel, err := s.Store().Channel().Get(channelID, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetChannel", "app.channel.get.existing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetChannel", "app.channel.get.find.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return channel, nil
}

func (a *App) GetChannels(c request.CTX, channelIDs []string) ([]*model.Channel, *model.AppError) {
	channels, err := a.Srv().Store().Channel().GetMany(channelIDs, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetChannel", "app.channel.get.existing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetChannel", "app.channel.get.find.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return channels, nil
}

func (a *App) GetChannelByName(c request.CTX, channelName, teamID string, includeDeleted bool) (*model.Channel, *model.AppError) {
	var channel *model.Channel
	var err error

	if includeDeleted {
		channel, err = a.Srv().Store().Channel().GetByNameIncludeDeleted(teamID, channelName, false)
	} else {
		channel, err = a.Srv().Store().Channel().GetByName(teamID, channelName, false)
	}

	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetChannelByName", "app.channel.get_by_name.missing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetChannelByName", "app.channel.get_by_name.existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return channel, nil
}

func (a *App) GetChannelsByNames(c request.CTX, channelNames []string, teamID string) ([]*model.Channel, *model.AppError) {
	channels, err := a.Srv().Store().Channel().GetByNames(teamID, channelNames, true)
	if err != nil {
		return nil, model.NewAppError("GetChannelsByNames", "app.channel.get_by_name.existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return channels, nil
}

func (a *App) GetChannelByNameForTeamName(c request.CTX, channelName, teamName string, includeDeleted bool) (*model.Channel, *model.AppError) {
	var team *model.Team

	team, err := a.Srv().Store().Team().GetByName(teamName)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetChannelByNameForTeamName", "app.team.get_by_name.missing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetChannelByNameForTeamName", "app.team.get_by_name.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
	}

	var result *model.Channel

	var nErr error
	if includeDeleted {
		result, nErr = a.Srv().Store().Channel().GetByNameIncludeDeleted(team.Id, channelName, false)
	} else {
		result, nErr = a.Srv().Store().Channel().GetByName(team.Id, channelName, false)
	}

	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("GetChannelByNameForTeamName", "app.channel.get_by_name.missing.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("GetChannelByNameForTeamName", "app.channel.get_by_name.existing.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	return result, nil
}

func (s *Server) getChannelsForTeamForUser(c request.CTX, teamID string, userID string, opts *model.ChannelSearchOpts) (model.ChannelList, *model.AppError) {
	list, err := s.Store().Channel().GetChannels(teamID, userID, opts)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetChannelsForUser", "app.channel.get_channels.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetChannelsForUser", "app.channel.get_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return list, nil
}

func (a *App) GetChannelsForTeamForUser(c request.CTX, teamID string, userID string, opts *model.ChannelSearchOpts) (model.ChannelList, *model.AppError) {
	return a.Srv().getChannelsForTeamForUser(c, teamID, userID, opts)
}

func (a *App) GetChannelsForTeamForUserWithCursor(c request.CTX, teamID string, userID string, opts *model.ChannelSearchOpts, afterChannelID string) (model.ChannelList, *model.AppError) {
	list, err := a.Srv().Store().Channel().GetChannelsWithCursor(teamID, userID, opts, afterChannelID)
	if err != nil {
		return nil, model.NewAppError("GetChannelsForUser", "app.channel.get_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, nil
}

func (a *App) GetChannelsForUser(c request.CTX, userID string, includeDeleted bool, lastDeleteAt, pageSize int, fromChannelID string) (model.ChannelList, *model.AppError) {
	list, err := a.Srv().Store().Channel().GetChannelsByUser(userID, includeDeleted, lastDeleteAt, pageSize, fromChannelID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetChannelsForUser", "app.channel.get_channels.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetChannelsForUser", "app.channel.get_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return list, nil
}

func (a *App) GetAllChannels(c request.CTX, page, perPage int, opts model.ChannelSearchOpts) (model.ChannelListWithTeamData, *model.AppError) {
	if opts.ExcludeDefaultChannels {
		opts.ExcludeChannelNames = a.DefaultChannelNames(c)
	}
	storeOpts := store.ChannelSearchOpts{
		ExcludeChannelNames:      opts.ExcludeChannelNames,
		NotAssociatedToGroup:     opts.NotAssociatedToGroup,
		IncludeDeleted:           opts.IncludeDeleted,
		ExcludePolicyConstrained: opts.ExcludePolicyConstrained,
		IncludePolicyID:          opts.IncludePolicyID,
	}
	channels, err := a.Srv().Store().Channel().GetAllChannels(page*perPage, perPage, storeOpts)
	if err != nil {
		return nil, model.NewAppError("GetAllChannels", "app.channel.get_all_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channels, nil
}

func (a *App) GetAllChannelsCount(c request.CTX, opts model.ChannelSearchOpts) (int64, *model.AppError) {
	if opts.ExcludeDefaultChannels {
		opts.ExcludeChannelNames = a.DefaultChannelNames(c)
	}
	storeOpts := store.ChannelSearchOpts{
		ExcludeChannelNames:  opts.ExcludeChannelNames,
		NotAssociatedToGroup: opts.NotAssociatedToGroup,
		IncludeDeleted:       opts.IncludeDeleted,
	}
	count, err := a.Srv().Store().Channel().GetAllChannelsCount(storeOpts)
	if err != nil {
		return 0, model.NewAppError("GetAllChannelsCount", "app.channel.get_all_channels_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return count, nil
}

func (a *App) GetDeletedChannels(c request.CTX, teamID string, offset int, limit int, userID string) (model.ChannelList, *model.AppError) {
	list, err := a.Srv().Store().Channel().GetDeleted(teamID, offset, limit, userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetDeletedChannels", "app.channel.get_deleted.missing.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetDeletedChannels", "app.channel.get_deleted.existing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return list, nil
}

func (a *App) GetChannelsUserNotIn(c request.CTX, teamID string, userID string, offset int, limit int) (model.ChannelList, *model.AppError) {
	channels, err := a.Srv().Store().Channel().GetMoreChannels(teamID, userID, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetChannelsUserNotIn", "app.channel.get_more_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return channels, nil
}

func (a *App) GetPublicChannelsByIdsForTeam(c request.CTX, teamID string, channelIDs []string) (model.ChannelList, *model.AppError) {
	list, err := a.Srv().Store().Channel().GetPublicChannelsByIdsForTeam(teamID, channelIDs)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetPublicChannelsByIdsForTeam", "app.channel.get_channels_by_ids.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetPublicChannelsByIdsForTeam", "app.channel.get_channels_by_ids.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return list, nil
}

func (a *App) GetPublicChannelsForTeam(c request.CTX, teamID string, offset int, limit int) (model.ChannelList, *model.AppError) {
	list, err := a.Srv().Store().Channel().GetPublicChannelsForTeam(teamID, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetPublicChannelsForTeam", "app.channel.get_public_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return list, nil
}

func (a *App) GetPrivateChannelsForTeam(c request.CTX, teamID string, offset int, limit int) (model.ChannelList, *model.AppError) {
	list, err := a.Srv().Store().Channel().GetPrivateChannelsForTeam(teamID, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetPrivateChannelsForTeam", "app.channel.get_private_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return list, nil
}

func (a *App) GetChannelMember(c request.CTX, channelID string, userID string) (*model.ChannelMember, *model.AppError) {
	return a.Srv().getChannelMember(c, channelID, userID)
}

func (s *Server) getChannelMember(c request.CTX, channelID string, userID string) (*model.ChannelMember, *model.AppError) {
	channelMember, err := s.Store().Channel().GetMember(c.Context(), channelID, userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetChannelMember", MissingChannelMemberError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetChannelMember", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return channelMember, nil
}

func (a *App) GetChannelMembersPage(c request.CTX, channelID string, page, perPage int) (model.ChannelMembers, *model.AppError) {
	channelMembers, err := a.Srv().Store().Channel().GetMembers(channelID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetChannelMembersPage", "app.channel.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelMembers, nil
}

func (a *App) GetChannelMembersTimezones(c request.CTX, channelID string) ([]string, *model.AppError) {
	membersTimezones, err := a.Srv().Store().Channel().GetChannelMembersTimezones(channelID)
	if err != nil {
		return nil, model.NewAppError("GetChannelMembersTimezones", "app.channel.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var timezones []string
	for _, membersTimezone := range membersTimezones {
		if membersTimezone["automaticTimezone"] == "" && membersTimezone["manualTimezone"] == "" {
			continue
		}
		timezones = append(timezones, model.GetPreferredTimezone(membersTimezone))
	}

	return model.RemoveDuplicateStrings(timezones), nil
}

func (a *App) GetChannelMembersByIds(c request.CTX, channelID string, userIDs []string) (model.ChannelMembers, *model.AppError) {
	members, err := a.Srv().Store().Channel().GetMembersByIds(channelID, userIDs)
	if err != nil {
		return nil, model.NewAppError("GetChannelMembersByIds", "app.channel.get_members_by_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return members, nil
}

func (a *App) GetChannelMembersForUser(c request.CTX, teamID string, userID string) (model.ChannelMembers, *model.AppError) {
	channelMembers, err := a.Srv().Store().Channel().GetMembersForUser(teamID, userID)
	if err != nil {
		return nil, model.NewAppError("GetChannelMembersForUser", "app.channel.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelMembers, nil
}

func (a *App) GetChannelMembersForUserWithPagination(c request.CTX, userID string, page, perPage int) ([]*model.ChannelMember, *model.AppError) {
	m, err := a.Srv().Store().Channel().GetMembersForUserWithPagination(userID, page, perPage)
	if err != nil {
		return nil, model.NewAppError("GetChannelMembersForUserWithPagination", "app.channel.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	members := make([]*model.ChannelMember, 0, len(m))
	for _, member := range m {
		member := member
		members = append(members, &member.ChannelMember)
	}
	return members, nil
}

func (a *App) GetChannelMembersWithTeamDataForUserWithPagination(c request.CTX, userID string, page, perPage int) (model.ChannelMembersWithTeamData, *model.AppError) {
	m, err := a.Srv().Store().Channel().GetMembersForUserWithPagination(userID, page, perPage)
	if err != nil {
		return nil, model.NewAppError("GetChannelMembersForUserWithPagination", "app.channel.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return m, nil
}

func (a *App) GetChannelMemberCount(c request.CTX, channelID string) (int64, *model.AppError) {
	count, err := a.Srv().Store().Channel().GetMemberCount(channelID, true)
	if err != nil {
		return 0, model.NewAppError("GetChannelMemberCount", "app.channel.get_member_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return count, nil
}

func (a *App) GetChannelFileCount(c request.CTX, channelID string) (int64, *model.AppError) {
	count, err := a.Srv().Store().Channel().GetFileCount(channelID)
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GetFileCount", "app.channel.get_file_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return count, nil
}

func (a *App) GetChannelGuestCount(c request.CTX, channelID string) (int64, *model.AppError) {
	count, err := a.Srv().Store().Channel().GetGuestCount(channelID, true)
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GetGuestCount", "app.channel.get_member_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return count, nil
}

func (a *App) GetChannelPinnedPostCount(c request.CTX, channelID string) (int64, *model.AppError) {
	count, err := a.Srv().Store().Channel().GetPinnedPostCount(channelID, true)
	if err != nil {
		return 0, model.NewAppError("GetChannelPinnedPostCount", "app.channel.get_pinnedpost_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return count, nil
}

func (a *App) GetChannelCounts(c request.CTX, teamID string, userID string) (*model.ChannelCounts, *model.AppError) {
	counts, err := a.Srv().Store().Channel().GetChannelCounts(teamID, userID)
	if err != nil {
		return nil, model.NewAppError("SqlChannelStore.GetChannelCounts", "app.channel.get_channel_counts.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return counts, nil
}

func (a *App) GetChannelUnread(c request.CTX, channelID, userID string) (*model.ChannelUnread, *model.AppError) {
	channelUnread, err := a.Srv().Store().Channel().GetChannelUnread(channelID, userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetChannelUnread", "app.channel.get_unread.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetChannelUnread", "app.channel.get_unread.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if channelUnread.NotifyProps[model.MarkUnreadNotifyProp] == model.ChannelMarkUnreadMention {
		channelUnread.MsgCount = 0
		channelUnread.MsgCountRoot = 0
	}
	return channelUnread, nil
}

func (a *App) JoinChannel(c request.CTX, channel *model.Channel, userID string) *model.AppError {
	userChan := make(chan store.StoreResult, 1)
	memberChan := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), userID)
		userChan <- store.StoreResult{Data: user, NErr: err}
		close(userChan)
	}()
	go func() {
		member, err := a.Srv().Store().Channel().GetMember(context.Background(), channel.Id, userID)
		memberChan <- store.StoreResult{Data: member, NErr: err}
		close(memberChan)
	}()

	uresult := <-userChan
	if uresult.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(uresult.NErr, &nfErr):
			return model.NewAppError("CreateChannel", MissingAccountError, nil, "", http.StatusNotFound).Wrap(uresult.NErr)
		default:
			return model.NewAppError("CreateChannel", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(uresult.NErr)
		}
	}

	mresult := <-memberChan
	if mresult.NErr == nil && mresult.Data != nil {
		// user is already in the channel
		return nil
	}

	user := uresult.Data.(*model.User)

	if channel.Type != model.ChannelTypeOpen {
		return model.NewAppError("JoinChannel", "api.channel.join_channel.permissions.app_error", nil, "", http.StatusBadRequest)
	}

	cm, err := a.AddUserToChannel(c, user, channel, false)
	if err != nil {
		return err
	}

	a.Srv().Go(func() {
		pluginContext := pluginContext(c)
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.UserHasJoinedChannel(pluginContext, cm, nil)
			return true
		}, plugin.UserHasJoinedChannelID)
	})

	if err := a.postJoinChannelMessage(c, user, channel); err != nil {
		return err
	}

	return nil
}

func (a *App) postJoinChannelMessage(c request.CTX, user *model.User, channel *model.Channel) *model.AppError {
	message := fmt.Sprintf(i18n.T("api.channel.join_channel.post_and_forget"), user.Username)
	postType := model.PostTypeJoinChannel

	if user.IsGuest() {
		message = fmt.Sprintf(i18n.T("api.channel.guest_join_channel.post_and_forget"), user.Username)
		postType = model.PostTypeGuestJoinChannel
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		Type:      postType,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postJoinChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) postJoinTeamMessage(c request.CTX, user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(i18n.T("api.team.join_team.post_and_forget"), user.Username),
		Type:      model.PostTypeJoinTeam,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postJoinTeamMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) LeaveChannel(c request.CTX, channelID string, userID string) *model.AppError {
	sc := make(chan store.StoreResult, 1)
	go func() {
		channel, err := a.Srv().Store().Channel().Get(channelID, true)
		sc <- store.StoreResult{Data: channel, NErr: err}
		close(sc)
	}()

	uc := make(chan store.StoreResult, 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), userID)
		uc <- store.StoreResult{Data: user, NErr: err}
		close(uc)
	}()

	mcc := make(chan store.StoreResult, 1)
	go func() {
		count, err := a.Srv().Store().Channel().GetMemberCount(channelID, false)
		mcc <- store.StoreResult{Data: count, NErr: err}
		close(mcc)
	}()

	cresult := <-sc
	if cresult.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(cresult.NErr, &nfErr):
			return model.NewAppError("LeaveChannel", "app.channel.get.existing.app_error", nil, "", http.StatusNotFound).Wrap(cresult.NErr)
		default:
			return model.NewAppError("LeaveChannel", "app.channel.get.find.app_error", nil, "", http.StatusInternalServerError).Wrap(cresult.NErr)
		}
	}
	uresult := <-uc
	if uresult.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(uresult.NErr, &nfErr):
			return model.NewAppError("LeaveChannel", MissingAccountError, nil, "", http.StatusNotFound).Wrap(uresult.NErr)
		default:
			return model.NewAppError("LeaveChannel", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(uresult.NErr)
		}
	}
	ccresult := <-mcc
	if ccresult.NErr != nil {
		return model.NewAppError("LeaveChannel", "app.channel.get_member_count.app_error", nil, "", http.StatusInternalServerError).Wrap(ccresult.NErr)
	}

	channel := cresult.Data.(*model.Channel)
	user := uresult.Data.(*model.User)
	membersCount := ccresult.Data.(int64)

	if channel.IsGroupOrDirect() {
		err := model.NewAppError("LeaveChannel", "api.channel.leave.direct.app_error", nil, "", http.StatusBadRequest)
		return err
	}

	if channel.Type == model.ChannelTypePrivate && membersCount == 1 {
		err := model.NewAppError("LeaveChannel", "api.channel.leave.last_member.app_error", nil, "userId="+user.Id, http.StatusBadRequest)
		return err
	}

	if err := a.removeUserFromChannel(c, userID, userID, channel); err != nil {
		return err
	}

	if channel.Name == model.DefaultChannelName && !*a.Config().ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages {
		return nil
	}

	a.Srv().Go(func() {
		a.postLeaveChannelMessage(c, user, channel)
	})

	return nil
}

func (a *App) postLeaveChannelMessage(c request.CTX, user *model.User, channel *model.Channel) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		// Message here embeds `@username`, not just `username`, to ensure that mentions
		// treat this as a username mention even though the user has now left the channel.
		// The client renders its own system message, ignoring this value altogether.
		Message: fmt.Sprintf(i18n.T("api.channel.leave.left"), fmt.Sprintf("@%s", user.Username)),
		Type:    model.PostTypeLeaveChannel,
		UserId:  user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postLeaveChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) PostAddToChannelMessage(c request.CTX, user *model.User, addedUser *model.User, channel *model.Channel, postRootId string) *model.AppError {
	message := fmt.Sprintf(i18n.T("api.channel.add_member.added"), addedUser.Username, user.Username)
	postType := model.PostTypeAddToChannel

	if addedUser.IsGuest() {
		message = fmt.Sprintf(i18n.T("api.channel.add_guest.added"), addedUser.Username, user.Username)
		postType = model.PostTypeAddGuestToChannel
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		Type:      postType,
		UserId:    user.Id,
		RootId:    postRootId,
		Props: model.StringInterface{
			"userId":                   user.Id,
			"username":                 user.Username,
			model.PostPropsAddedUserId: addedUser.Id,
			"addedUsername":            addedUser.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postAddToChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) postAddToTeamMessage(c request.CTX, user *model.User, addedUser *model.User, channel *model.Channel, postRootId string) *model.AppError {
	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(i18n.T("api.team.add_user_to_team.added"), addedUser.Username, user.Username),
		Type:      model.PostTypeAddToTeam,
		UserId:    user.Id,
		RootId:    postRootId,
		Props: model.StringInterface{
			"userId":                   user.Id,
			"username":                 user.Username,
			model.PostPropsAddedUserId: addedUser.Id,
			"addedUsername":            addedUser.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postAddToTeamMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) postRemoveFromChannelMessage(c request.CTX, removerUserId string, removedUser *model.User, channel *model.Channel) *model.AppError {
	messageUserId := removerUserId
	if messageUserId == "" {
		systemBot, err := a.GetSystemBot()
		if err != nil {
			return model.NewAppError("postRemoveFromChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		messageUserId = systemBot.UserId
	}

	post := &model.Post{
		ChannelId: channel.Id,
		// Message here embeds `@username`, not just `username`, to ensure that mentions
		// treat this as a username mention even though the user has now left the channel.
		// The client renders its own system message, ignoring this value altogether.
		Message: fmt.Sprintf(i18n.T("api.channel.remove_member.removed"), fmt.Sprintf("@%s", removedUser.Username)),
		Type:    model.PostTypeRemoveFromChannel,
		UserId:  messageUserId,
		Props: model.StringInterface{
			"removedUserId":   removedUser.Id,
			"removedUsername": removedUser.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postRemoveFromChannelMessage", "api.channel.post_user_add_remove_message_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) removeUserFromChannel(c request.CTX, userIDToRemove string, removerUserId string, channel *model.Channel) *model.AppError {
	user, nErr := a.Srv().Store().User().Get(context.Background(), userIDToRemove)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return model.NewAppError("removeUserFromChannel", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return model.NewAppError("removeUserFromChannel", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}
	isGuest := user.IsGuest()

	if channel.Name == model.DefaultChannelName {
		if !isGuest {
			return model.NewAppError("RemoveUserFromChannel", "api.channel.remove.default.app_error", map[string]any{"Channel": model.DefaultChannelName}, "", http.StatusBadRequest)
		}
	}

	if channel.IsGroupConstrained() && userIDToRemove != removerUserId && !user.IsBot {
		nonMembers, err := a.FilterNonGroupChannelMembers([]string{userIDToRemove}, channel)
		if err != nil {
			return model.NewAppError("removeUserFromChannel", "api.channel.remove_user_from_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if len(nonMembers) == 0 {
			return model.NewAppError("removeUserFromChannel", "api.channel.remove_members.denied", map[string]any{"UserIDs": nonMembers}, "", http.StatusBadRequest)
		}
	}

	cm, err := a.GetChannelMember(c, channel.Id, userIDToRemove)
	if err != nil {
		return err
	}

	if err := a.Srv().Store().Channel().RemoveMember(channel.Id, userIDToRemove); err != nil {
		return model.NewAppError("removeUserFromChannel", "app.channel.remove_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := a.Srv().Store().ChannelMemberHistory().LogLeaveEvent(userIDToRemove, channel.Id, model.GetMillis()); err != nil {
		return model.NewAppError("removeUserFromChannel", "app.channel_member_history.log_leave_event.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if isGuest {
		currentMembers, err := a.GetChannelMembersForUser(c, channel.TeamId, userIDToRemove)
		if err != nil {
			return err
		}
		if len(currentMembers) == 0 {
			teamMember, err := a.GetTeamMember(channel.TeamId, userIDToRemove)
			if err != nil {
				return model.NewAppError("removeUserFromChannel", "api.team.remove_user_from_team.missing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}

			if err := a.ch.srv.teamService.RemoveTeamMember(teamMember); err != nil {
				return model.NewAppError("removeUserFromChannel", "api.team.remove_user_from_team.missing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}

			if err = a.postProcessTeamMemberLeave(c, teamMember, removerUserId); err != nil {
				return err
			}
		}
	}

	a.InvalidateCacheForUser(userIDToRemove)
	a.invalidateCacheForChannelMembers(channel.Id)

	var actorUser *model.User
	if removerUserId != "" {
		actorUser, _ = a.GetUser(removerUserId)
	}

	a.Srv().Go(func() {
		pluginContext := pluginContext(c)
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			hooks.UserHasLeftChannel(pluginContext, cm, actorUser)
			return true
		}, plugin.UserHasLeftChannelID)
	})

	message := model.NewWebSocketEvent(model.WebsocketEventUserRemoved, "", channel.Id, "", nil, "")
	message.Add("user_id", userIDToRemove)
	message.Add("remover_id", removerUserId)
	a.Publish(message)

	// because the removed user no longer belongs to the channel we need to send a separate websocket event
	userMsg := model.NewWebSocketEvent(model.WebsocketEventUserRemoved, "", "", userIDToRemove, nil, "")
	userMsg.Add("channel_id", channel.Id)
	userMsg.Add("remover_id", removerUserId)
	a.Publish(userMsg)

	return nil
}

func (a *App) RemoveUserFromChannel(c request.CTX, userIDToRemove string, removerUserId string, channel *model.Channel) *model.AppError {
	var err *model.AppError

	if err = a.removeUserFromChannel(c, userIDToRemove, removerUserId, channel); err != nil {
		return err
	}

	var user *model.User
	if user, err = a.GetUser(userIDToRemove); err != nil {
		return err
	}

	if userIDToRemove == removerUserId {
		if err := a.postLeaveChannelMessage(c, user, channel); err != nil {
			return err
		}
	} else {
		if err := a.postRemoveFromChannelMessage(c, removerUserId, user, channel); err != nil {
			c.Logger().Error("Failed to post user removal message", mlog.Err(err))
		}
	}

	return nil
}

func (a *App) GetNumberOfChannelsOnTeam(c request.CTX, teamID string) (int, *model.AppError) {
	// Get total number of channels on current team
	list, err := a.Srv().Store().Channel().GetTeamChannels(teamID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return 0, model.NewAppError("GetNumberOfChannelsOnTeam", "app.channel.get_channels.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return 0, model.NewAppError("GetNumberOfChannelsOnTeam", "app.channel.get_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return len(list), nil
}

func (a *App) SetActiveChannel(c request.CTX, userID string, channelID string) *model.AppError {
	status, err := a.Srv().Platform().GetStatus(userID)

	oldStatus := model.StatusOffline

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOnline, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: channelID}
	} else {
		oldStatus = status.Status
		status.ActiveChannel = channelID
		if !status.Manual && channelID != "" {
			status.Status = model.StatusOnline
		}
		status.LastActivityAt = model.GetMillis()
	}

	a.Srv().Platform().AddStatusCache(status)

	if status.Status != oldStatus {
		a.Srv().Platform().BroadcastStatus(status)
	}

	return nil
}

func (a *App) IsCRTEnabledForUser(c request.CTX, userID string) bool {
	appCRT := *a.Config().ServiceSettings.CollapsedThreads
	if appCRT == model.CollapsedThreadsDisabled {
		return false
	}
	if appCRT == model.CollapsedThreadsAlwaysOn {
		return true
	}
	threadsEnabled := appCRT == model.CollapsedThreadsDefaultOn
	// check if a participant has overridden collapsed threads settings
	if preference, err := a.Srv().Store().Preference().Get(userID, model.PreferenceCategoryDisplaySettings, model.PreferenceNameCollapsedThreadsEnabled); err == nil {
		threadsEnabled = preference.Value == "on"
	}
	return threadsEnabled
}

// ValidateUserPermissionsOnChannels filters channelIds based on whether userId is authorized to manage channel members. Unauthorized channels are removed from the returned list.
func (a *App) ValidateUserPermissionsOnChannels(c request.CTX, userId string, channelIds []string) []string {
	var allowedChannelIds []string

	for _, channelId := range channelIds {
		channel, err := a.GetChannel(c, channelId)
		if err != nil {
			mlog.Info("Invite users to team - couldn't get channel " + channelId)
			continue
		}

		if channel.Type == model.ChannelTypePrivate && a.HasPermissionToChannel(c, userId, channelId, model.PermissionManagePrivateChannelMembers) {
			allowedChannelIds = append(allowedChannelIds, channelId)
		} else if channel.Type == model.ChannelTypeOpen && a.HasPermissionToChannel(c, userId, channelId, model.PermissionManagePublicChannelMembers) {
			allowedChannelIds = append(allowedChannelIds, channelId)
		} else {
			mlog.Info("Invite users to team - no permission to add members to that channel. UserId: " + userId + " ChannelId: " + channelId)
		}
	}
	return allowedChannelIds
}

// MarkChanelAsUnreadFromPost will take a post and set the channel as unread from that one.
func (a *App) MarkChannelAsUnreadFromPost(c request.CTX, postID string, userID string, collapsedThreadsSupported bool) (*model.ChannelUnreadAt, *model.AppError) {
	if !collapsedThreadsSupported || !a.IsCRTEnabledForUser(c, userID) {
		return a.markChannelAsUnreadFromPostCRTUnsupported(c, postID, userID)
	}
	post, err := a.GetSinglePost(postID, false)
	if err != nil {
		return nil, err
	}

	user, err := a.GetUser(userID)
	if err != nil {
		return nil, err
	}

	unreadMentions, unreadMentionsRoot, urgentMentions, err := a.countMentionsFromPost(c, user, post)
	if err != nil {
		return nil, err
	}

	channelUnread, nErr := a.Srv().Store().Channel().UpdateLastViewedAtPost(post, userID, unreadMentions, unreadMentionsRoot, urgentMentions, true)
	if nErr != nil {
		return channelUnread, model.NewAppError("MarkChannelAsUnreadFromPost", "app.channel.update_last_viewed_at_post.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	a.sendWebSocketPostUnreadEvent(c, channelUnread, postID, false)
	a.UpdateMobileAppBadge(userID)

	return channelUnread, nil
}

func (a *App) markChannelAsUnreadFromPostCRTUnsupported(c request.CTX, postID string, userID string) (*model.ChannelUnreadAt, *model.AppError) {
	post, appErr := a.GetSinglePost(postID, false)
	if appErr != nil {
		return nil, appErr
	}

	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return nil, appErr
	}

	threadId := post.RootId
	if post.RootId == "" {
		threadId = post.Id
	}

	unreadMentions, unreadMentionsRoot, urgentMentions, appErr := a.countMentionsFromPost(c, user, post)
	if appErr != nil {
		return nil, appErr
	}

	// if root post,
	// In CRT Supported Client: badge on channel only sums mentions in root posts including and below the post that was marked.
	// In CRT Unsupported Client: badge on channel sums mentions in all posts (root & replies) including and below the post that was marked unread.
	if post.RootId == "" {
		channelUnread, nErr := a.Srv().Store().Channel().UpdateLastViewedAtPost(post, userID, unreadMentions, unreadMentionsRoot, urgentMentions, true)
		if nErr != nil {
			return channelUnread, model.NewAppError("MarkChannelAsUnreadFromPost", "app.channel.update_last_viewed_at_post.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}

		a.sendWebSocketPostUnreadEvent(c, channelUnread, postID, true)
		a.UpdateMobileAppBadge(userID)
		return channelUnread, nil
	}

	// if reply post, autofollow thread and
	// In CRT Supported Client: Mark the specific thread as unread but not the channel where the thread exists.
	//                          If there are replies with mentions below the marked reply in the thread, then sum the mentions for the threads mention badge.
	// In CRT Unsupported Client: Channel is marked as unread and new messages line inserted above the marked post.
	//                            Badge on channel sums mentions in all posts (root & replies) including and below the post that was marked unread.
	rootPost, appErr := a.GetSinglePost(post.RootId, false)
	if appErr != nil {
		return nil, appErr
	}

	channel, nErr := a.Srv().Store().Channel().Get(post.ChannelId, true)
	if nErr != nil {
		return nil, model.NewAppError("MarkChannelAsUnreadFromPost", "app.channel.update_last_viewed_at_post.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	if *a.Config().ServiceSettings.ThreadAutoFollow {
		threadMembership, mErr := a.Srv().Store().Thread().GetMembershipForUser(user.Id, threadId)
		var errNotFound *store.ErrNotFound
		if mErr != nil && !errors.As(mErr, &errNotFound) {
			return nil, model.NewAppError("MarkChannelAsUnreadFromPost", "app.channel.update_last_viewed_at_post.app_error", nil, "", http.StatusInternalServerError).Wrap(mErr)
		}
		// Follow thread if we're not already following it
		if threadMembership == nil {
			opts := store.ThreadMembershipOpts{
				Following:             true,
				IncrementMentions:     false,
				UpdateFollowing:       true,
				UpdateViewedTimestamp: false,
				UpdateParticipants:    false,
			}
			threadMembership, mErr = a.Srv().Store().Thread().MaintainMembership(user.Id, threadId, opts)
			if mErr != nil {
				return nil, model.NewAppError("MarkChannelAsUnreadFromPost", "app.channel.update_last_viewed_at_post.app_error", nil, "", http.StatusInternalServerError).Wrap(mErr)
			}
		}
		// If threadmembership already exists but user had previously unfollowed the thread, then follow the thread again.
		threadMembership.Following = true
		threadMembership.LastViewed = post.CreateAt - 1
		threadMembership.UnreadMentions, appErr = a.countThreadMentions(c, user, rootPost, channel.TeamId, post.CreateAt-1)
		if appErr != nil {
			return nil, appErr
		}
		threadMembership, mErr = a.Srv().Store().Thread().UpdateMembership(threadMembership)
		if mErr != nil {
			return nil, model.NewAppError("MarkChannelAsUnreadFromPost", "app.channel.update_last_viewed_at_post.app_error", nil, "", http.StatusInternalServerError).Wrap(mErr)
		}
		thread, mErr := a.Srv().Store().Thread().GetThreadForUser(threadMembership, true, a.isPostPriorityEnabled())
		if mErr != nil {
			return nil, model.NewAppError("MarkChannelAsUnreadFromPost", "app.channel.update_last_viewed_at_post.app_error", nil, "", http.StatusInternalServerError).Wrap(mErr)
		}
		a.sanitizeProfiles(thread.Participants, false)
		thread.Post.SanitizeProps()

		if a.IsCRTEnabledForUser(c, userID) {
			payload, jsonErr := json.Marshal(thread)
			if jsonErr != nil {
				return nil, model.NewAppError("MarkChannelAsUnreadFromPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
			}
			message := model.NewWebSocketEvent(model.WebsocketEventThreadUpdated, channel.TeamId, "", userID, nil, "")
			message.Add("thread", string(payload))
			a.Publish(message)
		}
	}

	channelUnread, nErr := a.Srv().Store().Channel().UpdateLastViewedAtPost(post, userID, unreadMentions, 0, 0, false)
	if nErr != nil {
		return channelUnread, model.NewAppError("MarkChannelAsUnreadFromPost", "app.channel.update_last_viewed_at_post.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	a.sendWebSocketPostUnreadEvent(c, channelUnread, postID, false)
	a.UpdateMobileAppBadge(userID)
	return channelUnread, nil
}

func (a *App) sendWebSocketPostUnreadEvent(c request.CTX, channelUnread *model.ChannelUnreadAt, postID string, withMsgCountRoot bool) {
	message := model.NewWebSocketEvent(model.WebsocketEventPostUnread, channelUnread.TeamId, channelUnread.ChannelId, channelUnread.UserId, nil, "")
	message.Add("msg_count", channelUnread.MsgCount)
	if withMsgCountRoot {
		message.Add("msg_count_root", channelUnread.MsgCountRoot)
	}
	message.Add("mention_count", channelUnread.MentionCount)
	message.Add("mention_count_root", channelUnread.MentionCountRoot)
	message.Add("urgent_mention_count", channelUnread.UrgentMentionCount)
	message.Add("last_viewed_at", channelUnread.LastViewedAt)
	message.Add("post_id", postID)
	a.Publish(message)
}

func (a *App) AutocompleteChannels(c request.CTX, userID, term string) (model.ChannelListWithTeamData, *model.AppError) {
	includeDeleted := *a.Config().TeamSettings.ExperimentalViewArchivedChannels
	term = strings.TrimSpace(term)

	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return nil, appErr
	}

	channelList, err := a.Srv().Store().Channel().Autocomplete(userID, term, includeDeleted, user.IsGuest())
	if err != nil {
		return nil, model.NewAppError("AutocompleteChannels", "app.channel.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelList, nil
}

func (a *App) AutocompleteChannelsForTeam(c request.CTX, teamID, userID, term string) (model.ChannelList, *model.AppError) {
	includeDeleted := *a.Config().TeamSettings.ExperimentalViewArchivedChannels
	term = strings.TrimSpace(term)

	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return nil, appErr
	}

	channelList, err := a.Srv().Store().Channel().AutocompleteInTeam(teamID, userID, term, includeDeleted, user.IsGuest())
	if err != nil {
		return nil, model.NewAppError("AutocompleteChannels", "app.channel.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelList, nil
}

func (a *App) AutocompleteChannelsForSearch(c request.CTX, teamID string, userID string, term string) (model.ChannelList, *model.AppError) {
	includeDeleted := *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	term = strings.TrimSpace(term)

	channelList, err := a.Srv().Store().Channel().AutocompleteInTeamForSearch(teamID, userID, term, includeDeleted)
	if err != nil {
		return nil, model.NewAppError("AutocompleteChannelsForSearch", "app.channel.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelList, nil
}

// SearchAllChannels returns a list of channels, the total count of the results of the search (if the paginate search option is true), and an error.
func (a *App) SearchAllChannels(c request.CTX, term string, opts model.ChannelSearchOpts) (model.ChannelListWithTeamData, int64, *model.AppError) {
	if opts.ExcludeDefaultChannels {
		opts.ExcludeChannelNames = a.DefaultChannelNames(c)
	}
	storeOpts := store.ChannelSearchOpts{
		ExcludeChannelNames:      opts.ExcludeChannelNames,
		NotAssociatedToGroup:     opts.NotAssociatedToGroup,
		IncludeDeleted:           opts.IncludeDeleted,
		Deleted:                  opts.Deleted,
		TeamIds:                  opts.TeamIds,
		GroupConstrained:         opts.GroupConstrained,
		ExcludeGroupConstrained:  opts.ExcludeGroupConstrained,
		PolicyID:                 opts.PolicyID,
		IncludePolicyID:          opts.IncludePolicyID,
		IncludeSearchById:        opts.IncludeSearchById,
		ExcludePolicyConstrained: opts.ExcludePolicyConstrained,
		Public:                   opts.Public,
		Private:                  opts.Private,
		Page:                     opts.Page,
		PerPage:                  opts.PerPage,
	}

	term = strings.TrimSpace(term)

	channelList, totalCount, err := a.Srv().Store().Channel().SearchAllChannels(term, storeOpts)
	if err != nil {
		return nil, 0, model.NewAppError("SearchAllChannels", "app.channel.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelList, totalCount, nil
}

func (a *App) SearchChannels(c request.CTX, teamID string, term string) (model.ChannelList, *model.AppError) {
	includeDeleted := *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	term = strings.TrimSpace(term)

	channelList, err := a.Srv().Store().Channel().SearchInTeam(teamID, term, includeDeleted)
	if err != nil {
		return nil, model.NewAppError("SearchChannels", "app.channel.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelList, nil
}

func (a *App) SearchArchivedChannels(c request.CTX, teamID string, term string, userID string) (model.ChannelList, *model.AppError) {
	term = strings.TrimSpace(term)

	channelList, err := a.Srv().Store().Channel().SearchArchivedInTeam(teamID, term, userID)
	if err != nil {
		return nil, model.NewAppError("SearchArchivedChannels", "app.channel.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelList, nil
}

func (a *App) SearchChannelsForUser(c request.CTX, userID, teamID, term string) (model.ChannelList, *model.AppError) {
	includeDeleted := *a.Config().TeamSettings.ExperimentalViewArchivedChannels

	term = strings.TrimSpace(term)

	channelList, err := a.Srv().Store().Channel().SearchForUserInTeam(userID, teamID, term, includeDeleted)
	if err != nil {
		return nil, model.NewAppError("SearchChannelsForUser", "app.channel.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelList, nil
}

func (a *App) SearchGroupChannels(c request.CTX, userID, term string) (model.ChannelList, *model.AppError) {
	if term == "" {
		return model.ChannelList{}, nil
	}

	channelList, err := a.Srv().Store().Channel().SearchGroupChannels(userID, term)
	if err != nil {
		return nil, model.NewAppError("SearchGroupChannels", "app.channel.search_group_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return channelList, nil
}

func (a *App) SearchChannelsUserNotIn(c request.CTX, teamID string, userID string, term string) (model.ChannelList, *model.AppError) {
	term = strings.TrimSpace(term)
	channelList, err := a.Srv().Store().Channel().SearchMore(userID, teamID, term)
	if err != nil {
		return nil, model.NewAppError("SearchChannelsUserNotIn", "app.channel.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelList, nil
}

func (a *App) MarkChannelsAsViewed(c request.CTX, channelIDs []string, userID string, currentSessionId string, collapsedThreadsSupported bool) (map[string]int64, *model.AppError) {
	// I start looking for channels with notifications before I mark it as read, to clear the push notifications if needed
	channelsToClearPushNotifications := []string{}
	if a.canSendPushNotifications() {
		for _, channelID := range channelIDs {
			channel, errCh := a.Srv().Store().Channel().Get(channelID, true)
			if errCh != nil {
				c.Logger().Warn("Failed to get channel", mlog.Err(errCh))
				continue
			}

			member, err := a.Srv().Store().Channel().GetMember(context.Background(), channelID, userID)
			if err != nil {
				c.Logger().Warn("Failed to get membership", mlog.Err(err))
				continue
			}

			notify := member.NotifyProps[model.PushNotifyProp]
			if notify == model.ChannelNotifyDefault {
				user, err := a.GetUser(userID)
				if err != nil {
					c.Logger().Warn("Failed to get user", mlog.String("user_id", userID), mlog.Err(err))
					continue
				}
				notify = user.NotifyProps[model.PushNotifyProp]
			}
			if notify == model.UserNotifyAll {
				if count, err := a.Srv().Store().User().GetAnyUnreadPostCountForChannel(userID, channelID); err == nil {
					if count > 0 {
						channelsToClearPushNotifications = append(channelsToClearPushNotifications, channelID)
					}
				}
			} else if notify == model.UserNotifyMention || channel.Type == model.ChannelTypeDirect {
				if count, err := a.Srv().Store().User().GetUnreadCountForChannel(userID, channelID); err == nil {
					if count > 0 {
						channelsToClearPushNotifications = append(channelsToClearPushNotifications, channelID)
					}
				}
			}
		}
	}

	var err error
	updateThreads := *a.Config().ServiceSettings.ThreadAutoFollow && (!collapsedThreadsSupported || !a.IsCRTEnabledForUser(c, userID))
	if updateThreads {
		err = a.Srv().Store().Thread().MarkAllAsReadByChannels(userID, channelIDs)
		if err != nil {
			return nil, model.NewAppError("MarkChannelsAsViewed", "app.channel.update_last_viewed_at.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	times, err := a.Srv().Store().Channel().UpdateLastViewedAt(channelIDs, userID)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("MarkChannelsAsViewed", "app.channel.update_last_viewed_at.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("MarkChannelsAsViewed", "app.channel.update_last_viewed_at.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if *a.Config().ServiceSettings.EnableChannelViewedMessages {
		for _, channelID := range channelIDs {
			message := model.NewWebSocketEvent(model.WebsocketEventChannelViewed, "", "", userID, nil, "")
			message.Add("channel_id", channelID)
			a.Publish(message)
		}
	}
	for _, channelID := range channelsToClearPushNotifications {
		a.clearPushNotification(currentSessionId, userID, channelID, "")
	}

	if updateThreads && a.IsCRTEnabledForUser(c, userID) {
		timestamp := model.GetMillis()
		for _, channelID := range channelIDs {
			message := model.NewWebSocketEvent(model.WebsocketEventThreadReadChanged, "", channelID, userID, nil, "")
			message.Add("timestamp", timestamp)
			a.Publish(message)
		}
	}

	return times, nil
}

func (a *App) ViewChannel(c request.CTX, view *model.ChannelView, userID string, currentSessionId string, collapsedThreadsSupported bool) (map[string]int64, *model.AppError) {
	if err := a.SetActiveChannel(c, userID, view.ChannelId); err != nil {
		return nil, err
	}

	channelIDs := []string{}

	if view.ChannelId != "" {
		channelIDs = append(channelIDs, view.ChannelId)
	}

	if view.PrevChannelId != "" {
		channelIDs = append(channelIDs, view.PrevChannelId)
	}

	if len(channelIDs) == 0 {
		return map[string]int64{}, nil
	}

	return a.MarkChannelsAsViewed(c, channelIDs, userID, currentSessionId, collapsedThreadsSupported)
}

func (a *App) PermanentDeleteChannel(c request.CTX, channel *model.Channel) *model.AppError {
	if err := a.Srv().Store().Post().PermanentDeleteByChannel(channel.Id); err != nil {
		return model.NewAppError("PermanentDeleteChannel", "app.post.permanent_delete_by_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Channel().PermanentDeleteMembersByChannel(channel.Id); err != nil {
		return model.NewAppError("PermanentDeleteChannel", "app.channel.remove_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Webhook().PermanentDeleteIncomingByChannel(channel.Id); err != nil {
		return model.NewAppError("PermanentDeleteChannel", "app.webhooks.permanent_delete_incoming_by_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Webhook().PermanentDeleteOutgoingByChannel(channel.Id); err != nil {
		return model.NewAppError("PermanentDeleteChannel", "app.webhooks.permanent_delete_outgoing_by_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	deleteAt := model.GetMillis()

	if nErr := a.Srv().Store().Channel().PermanentDelete(channel.Id); nErr != nil {
		return model.NewAppError("PermanentDeleteChannel", "app.channel.permanent_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	a.Srv().Platform().InvalidateCacheForChannel(channel)
	message := model.NewWebSocketEvent(model.WebsocketEventChannelDeleted, channel.TeamId, "", "", nil, "")

	message.Add("channel_id", channel.Id)
	message.Add("delete_at", deleteAt)
	a.Publish(message)

	return nil
}

func (a *App) RemoveAllDeactivatedMembersFromChannel(c request.CTX, channel *model.Channel) *model.AppError {
	err := a.Srv().Store().Channel().RemoveAllDeactivatedMembers(channel.Id)
	if err != nil {
		return model.NewAppError("RemoveAllDeactivatedMembersFromChannel", "app.channel.remove_all_deactivated_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// MoveChannel method is prone to data races if someone joins to channel during the move process. However this
// function is only exposed to sysadmins and the possibility of this edge case is relatively small.
func (a *App) MoveChannel(c request.CTX, team *model.Team, channel *model.Channel, user *model.User) *model.AppError {
	// Check that all channel members are in the destination team.
	channelMembers, err := a.GetChannelMembersPage(c, channel.Id, 0, 10000000)
	if err != nil {
		return err
	}

	channelMemberIds := []string{}
	for _, channelMember := range channelMembers {
		channelMemberIds = append(channelMemberIds, channelMember.UserId)
	}

	if len(channelMemberIds) > 0 {
		teamMembers, err2 := a.GetTeamMembersByIds(team.Id, channelMemberIds, nil)
		if err2 != nil {
			return err2
		}

		if len(teamMembers) != len(channelMembers) {
			teamMembersMap := make(map[string]*model.TeamMember, len(teamMembers))
			for _, teamMember := range teamMembers {
				teamMembersMap[teamMember.UserId] = teamMember
			}
			for _, channelMember := range channelMembers {
				if _, ok := teamMembersMap[channelMember.UserId]; !ok {
					c.Logger().Warn("Not member of the target team", mlog.String("userId", channelMember.UserId))
				}
			}
			return model.NewAppError("MoveChannel", "app.channel.move_channel.members_do_not_match.error", nil, "", http.StatusInternalServerError)
		}
	}

	// keep instance of the previous team
	previousTeam, nErr := a.Srv().Store().Team().Get(channel.TeamId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return model.NewAppError("MoveChannel", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return model.NewAppError("MoveChannel", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if nErr := a.Srv().Store().Channel().UpdateSidebarChannelCategoryOnMove(channel, team.Id); nErr != nil {
		return model.NewAppError("MoveChannel", "app.channel.sidebar_categories.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	channel.TeamId = team.Id
	if _, err := a.Srv().Store().Channel().Update(channel); err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return model.NewAppError("MoveChannel", "app.channel.update.bad_id", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &appErr):
			return appErr
		default:
			return model.NewAppError("MoveChannel", "app.channel.update_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if incomingWebhooks, err := a.GetIncomingWebhooksForTeamPage(previousTeam.Id, 0, 10000000); err != nil {
		c.Logger().Warn("Failed to get incoming webhooks", mlog.Err(err))
	} else {
		for _, webhook := range incomingWebhooks {
			if webhook.ChannelId == channel.Id {
				webhook.TeamId = team.Id
				if _, err := a.Srv().Store().Webhook().UpdateIncoming(webhook); err != nil {
					c.Logger().Warn("Failed to move incoming webhook to new team", mlog.String("webhook id", webhook.Id))
				}
			}
		}
	}

	if outgoingWebhooks, err := a.GetOutgoingWebhooksForTeamPage(previousTeam.Id, 0, 10000000); err != nil {
		c.Logger().Warn("Failed to get outgoing webhooks", mlog.Err(err))
	} else {
		for _, webhook := range outgoingWebhooks {
			if webhook.ChannelId == channel.Id {
				webhook.TeamId = team.Id
				if _, err := a.Srv().Store().Webhook().UpdateOutgoing(webhook); err != nil {
					c.Logger().Warn("Failed to move outgoing webhook to new team.", mlog.String("webhook id", webhook.Id))
				}
			}
		}
	}

	if err := a.RemoveUsersFromChannelNotMemberOfTeam(c, user, channel, team); err != nil {
		c.Logger().Warn("error while removing non-team member users", mlog.Err(err))
	}

	if user != nil {
		if err := a.postChannelMoveMessage(c, user, channel, previousTeam); err != nil {
			c.Logger().Warn("error while posting move channel message", mlog.Err(err))
		}
	}

	return nil
}

func (a *App) postChannelMoveMessage(c request.CTX, user *model.User, channel *model.Channel, previousTeam *model.Team) *model.AppError {

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   fmt.Sprintf(i18n.T("api.team.move_channel.success"), previousTeam.Name),
		Type:      model.PostTypeMoveChannel,
		UserId:    user.Id,
		Props: model.StringInterface{
			"username": user.Username,
		},
	}

	if _, err := a.CreatePost(c, post, channel, false, true); err != nil {
		return model.NewAppError("postChannelMoveMessage", "api.team.move_channel.post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) RemoveUsersFromChannelNotMemberOfTeam(c request.CTX, remover *model.User, channel *model.Channel, team *model.Team) *model.AppError {
	channelMembers, err := a.GetChannelMembersPage(c, channel.Id, 0, 10000000)
	if err != nil {
		return err
	}

	channelMemberIds := []string{}
	channelMemberMap := make(map[string]struct{})
	for _, channelMember := range channelMembers {
		channelMemberMap[channelMember.UserId] = struct{}{}
		channelMemberIds = append(channelMemberIds, channelMember.UserId)
	}

	if len(channelMemberIds) > 0 {
		teamMembers, err := a.GetTeamMembersByIds(team.Id, channelMemberIds, nil)
		if err != nil {
			return err
		}

		if len(teamMembers) != len(channelMembers) {
			for _, teamMember := range teamMembers {
				delete(channelMemberMap, teamMember.UserId)
			}

			var removerId string
			if remover != nil {
				removerId = remover.Id
			}
			for userID := range channelMemberMap {
				if err := a.removeUserFromChannel(c, userID, removerId, channel); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func (a *App) GetPinnedPosts(c request.CTX, channelID string) (*model.PostList, *model.AppError) {
	posts, err := a.Srv().Store().Channel().GetPinnedPosts(channelID)
	if err != nil {
		return nil, model.NewAppError("GetPinnedPosts", "app.channel.pinned_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if appErr := a.filterInaccessiblePosts(posts, filterPostOptions{assumeSortedCreatedAt: true}); appErr != nil {
		return nil, appErr
	}

	return posts, nil
}

func (a *App) ToggleMuteChannel(c request.CTX, channelID, userID string) (*model.ChannelMember, *model.AppError) {
	member, nErr := a.Srv().Store().Channel().GetMember(context.Background(), channelID, userID)
	if nErr != nil {
		var appErr *model.AppError
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("ToggleMuteChannel", MissingChannelMemberError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("ToggleMuteChannel", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	member.SetChannelMuted(!member.IsChannelMuted())

	member, err := a.updateChannelMember(c, member)
	if err != nil {
		return nil, err
	}

	a.invalidateCacheForChannelMembersNotifyProps(member.ChannelId)

	return member, nil
}

func (a *App) setChannelsMuted(c request.CTX, channelIDs []string, userID string, muted bool) ([]*model.ChannelMember, *model.AppError) {
	members, err := a.Srv().Store().Channel().GetMembersByChannelIds(channelIDs, userID)
	if err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("setChannelsMuted", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	var membersToUpdate []*model.ChannelMember
	for _, member := range members {
		if muted == member.IsChannelMuted() {
			continue
		}

		updatedMember := member
		updatedMember.SetChannelMuted(muted)

		membersToUpdate = append(membersToUpdate, &updatedMember)
	}

	if len(membersToUpdate) == 0 {
		return nil, nil
	}

	updated, err := a.Srv().Store().Channel().UpdateMultipleMembers(membersToUpdate)
	if err != nil {
		var appErr *model.AppError
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("setChannelsMuted", MissingChannelMemberError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("setChannelsMuted", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	for _, member := range updated {
		a.invalidateCacheForChannelMembersNotifyProps(member.ChannelId)

		evt := model.NewWebSocketEvent(model.WebsocketEventChannelMemberUpdated, "", "", member.UserId, nil, "")

		memberJSON, jsonErr := json.Marshal(member)
		if jsonErr != nil {
			return nil, model.NewAppError("setChannelsMuted", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		}

		evt.Add("channelMember", string(memberJSON))
		a.Publish(evt)
	}

	return updated, nil
}

func (a *App) FillInChannelProps(c request.CTX, channel *model.Channel) *model.AppError {
	return a.FillInChannelsProps(c, model.ChannelList{channel})
}

func (a *App) FillInChannelsProps(c request.CTX, channelList model.ChannelList) *model.AppError {
	// Group the channels by team and call GetChannelsByNames just once per team.
	channelsByTeam := make(map[string]model.ChannelList)
	for _, channel := range channelList {
		channelsByTeam[channel.TeamId] = append(channelsByTeam[channel.TeamId], channel)
	}

	for teamID, channelList := range channelsByTeam {
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
			mentionedChannels, err := a.GetChannelsByNames(c, allChannelMentionNames, teamID)
			if err != nil {
				return err
			}

			mentionedChannelsByName := make(map[string]*model.Channel)
			for _, channel := range mentionedChannels {
				mentionedChannelsByName[channel.Name] = channel
			}

			for _, channel := range channelList {
				channelMentionsProp := make(map[string]any, len(channelMentions[channel]))
				for _, channelMention := range channelMentions[channel] {
					if mentioned, ok := mentionedChannelsByName[channelMention]; ok {
						if mentioned.Type == model.ChannelTypeOpen {
							channelMentionsProp[mentioned.Name] = map[string]any{
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

func (a *App) forEachChannelMember(c request.CTX, channelID string, f func(model.ChannelMember) error) error {
	perPage := 100
	page := 0

	for {
		channelMembers, err := a.Srv().Store().Channel().GetMembers(channelID, page*perPage, perPage)
		if err != nil {
			return err
		}

		for _, channelMember := range channelMembers {
			if err = f(channelMember); err != nil {
				return err
			}
		}

		length := len(channelMembers)
		if length < perPage {
			break
		}

		page++
	}

	return nil
}

func (a *App) ClearChannelMembersCache(c request.CTX, channelID string) error {
	clearSessionCache := func(channelMember model.ChannelMember) error {
		a.ClearSessionCacheForUser(channelMember.UserId)
		message := model.NewWebSocketEvent(model.WebsocketEventChannelMemberUpdated, "", "", channelMember.UserId, nil, "")
		memberJSON, jsonErr := json.Marshal(channelMember)
		if jsonErr != nil {
			return jsonErr
		}
		message.Add("channelMember", string(memberJSON))
		a.Publish(message)
		return nil
	}
	if err := a.forEachChannelMember(c, channelID, clearSessionCache); err != nil {
		return fmt.Errorf("error clearing cache for channel members: channel_id: %s, error: %w", channelID, err)
	}
	return nil
}

func (a *App) GetMemberCountsByGroup(ctx context.Context, channelID string, includeTimezones bool) ([]*model.ChannelMemberCountByGroup, *model.AppError) {
	channelMemberCounts, err := a.Srv().Store().Channel().GetMemberCountsByGroup(ctx, channelID, includeTimezones)
	if err != nil {
		return nil, model.NewAppError("GetMemberCountsByGroup", "app.channel.get_member_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelMemberCounts, nil
}

func (a *App) getDirectChannel(c request.CTX, userID, otherUserID string) (*model.Channel, *model.AppError) {
	return a.Srv().getDirectChannel(c, userID, otherUserID)
}

func (s *Server) getDirectChannel(c request.CTX, userID, otherUserID string) (*model.Channel, *model.AppError) {
	channel, nErr := s.Store().Channel().GetByName("", model.GetDMNameFromIds(userID, otherUserID), true)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(nErr, &nfErr) {
			return nil, nil
		}

		return nil, model.NewAppError("GetOrCreateDirectChannel", "web.incoming_webhook.channel.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return channel, nil
}

func (a *App) GetTopChannelsForTeamSince(c request.CTX, teamID, userID string, opts *model.InsightsOpts) (*model.TopChannelList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopChannelsForTeamSince", "api.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	topChannels, err := a.Srv().Store().Channel().GetTopChannelsForTeamSince(teamID, userID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopChannelsForTeamSince", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topChannels, nil
}

func (a *App) GetTopChannelsForUserSince(c request.CTX, userID, teamID string, opts *model.InsightsOpts) (*model.TopChannelList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopChannelsForUserSince", "api.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	topChannels, err := a.Srv().Store().Channel().GetTopChannelsForUserSince(userID, teamID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopChannelsForUserSince", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topChannels, nil
}

// PostCountsByDuration returns the post counts for the given channels, grouped by day, starting at the given time.
// Unless one is specifically itending to omit results from part of the calendar day, it will typically makes the most sense to
// use a sinceUnixMillis parameter value as returned by model.GetStartOfDayMillis.
//
// WARNING: PostCountsByDuration PERFORMS NO AUTHORIZATION CHECKS ON THE GIVEN CHANNELS.
func (a *App) PostCountsByDuration(c request.CTX, channelIDs []string, sinceUnixMillis int64, userID *string, grouping model.PostCountGrouping, groupingLocation *time.Location) ([]*model.DurationPostCount, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("PostCountsByDuration", "api.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}
	postCountByDay, err := a.Srv().Store().Channel().PostCountsByDuration(channelIDs, sinceUnixMillis, userID, grouping, groupingLocation)
	if err != nil {
		return nil, model.NewAppError("PostCountsByDuration", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return postCountByDay, nil
}

func (a *App) GetTopInactiveChannelsForTeamSince(c request.CTX, teamID, userID string, opts *model.InsightsOpts) (*model.TopInactiveChannelList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopChannelsForTeamSince", "api.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}
	topChannels, err := a.Srv().Store().Channel().GetTopInactiveChannelsForTeamSince(teamID, userID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopInactiveChannelsForTeamSince", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topChannels, nil
}

func (a *App) GetTopInactiveChannelsForUserSince(c request.CTX, teamID, userID string, opts *model.InsightsOpts) (*model.TopInactiveChannelList, *model.AppError) {
	if !a.Config().FeatureFlags.InsightsEnabled {
		return nil, model.NewAppError("GetTopChannelsForUserSince", "api.insights.feature_disabled", nil, "", http.StatusNotImplemented)
	}

	topChannels, err := a.Srv().Store().Channel().GetTopInactiveChannelsForUserSince(teamID, userID, opts.StartUnixMilli, opts.Page*opts.PerPage, opts.PerPage)
	if err != nil {
		return nil, model.NewAppError("GetTopInactiveChannelsForUserSince", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topChannels, nil
}
