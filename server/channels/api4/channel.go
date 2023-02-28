// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v6/channels/app"
	"github.com/mattermost/mattermost-server/v6/channels/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func (api *API) InitChannel() {
	api.BaseRoutes.Channels.Handle("", api.APISessionRequired(getAllChannels)).Methods("GET")
	api.BaseRoutes.Channels.Handle("", api.APISessionRequired(createChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/direct", api.APISessionRequired(createDirectChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchAllChannels)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/group/search", api.APISessionRequiredDisableWhenBusy(searchGroupChannels)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/group", api.APISessionRequired(createGroupChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/members/{user_id:[A-Za-z0-9]+}/view", api.APISessionRequired(viewChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/scheme", api.APISessionRequired(updateChannelScheme)).Methods("PUT")

	api.BaseRoutes.ChannelsForTeam.Handle("", api.APISessionRequired(getPublicChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/deleted", api.APISessionRequired(getDeletedChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/private", api.APISessionRequired(getPrivateChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/ids", api.APISessionRequired(getPublicChannelsByIdsForTeam)).Methods("POST")
	api.BaseRoutes.ChannelsForTeam.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchChannelsForTeam)).Methods("POST")
	api.BaseRoutes.ChannelsForTeam.Handle("/search_archived", api.APISessionRequiredDisableWhenBusy(searchArchivedChannelsForTeam)).Methods("POST")
	api.BaseRoutes.ChannelsForTeam.Handle("/autocomplete", api.APISessionRequired(autocompleteChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/search_autocomplete", api.APISessionRequired(autocompleteChannelsForTeamForSearch)).Methods("GET")
	api.BaseRoutes.User.Handle("/teams/{team_id:[A-Za-z0-9]+}/channels", api.APISessionRequired(getChannelsForTeamForUser)).Methods("GET")
	api.BaseRoutes.User.Handle("/channels", api.APISessionRequired(getChannelsForUser)).Methods("GET")

	api.BaseRoutes.ChannelCategories.Handle("", api.APISessionRequired(getCategoriesForTeamForUser)).Methods("GET")
	api.BaseRoutes.ChannelCategories.Handle("", api.APISessionRequired(createCategoryForTeamForUser)).Methods("POST")
	api.BaseRoutes.ChannelCategories.Handle("", api.APISessionRequired(updateCategoriesForTeamForUser)).Methods("PUT")
	api.BaseRoutes.ChannelCategories.Handle("/order", api.APISessionRequired(getCategoryOrderForTeamForUser)).Methods("GET")
	api.BaseRoutes.ChannelCategories.Handle("/order", api.APISessionRequired(updateCategoryOrderForTeamForUser)).Methods("PUT")
	api.BaseRoutes.ChannelCategories.Handle("/{category_id:[A-Za-z0-9_-]+}", api.APISessionRequired(getCategoryForTeamForUser)).Methods("GET")
	api.BaseRoutes.ChannelCategories.Handle("/{category_id:[A-Za-z0-9_-]+}", api.APISessionRequired(updateCategoryForTeamForUser)).Methods("PUT")
	api.BaseRoutes.ChannelCategories.Handle("/{category_id:[A-Za-z0-9_-]+}", api.APISessionRequired(deleteCategoryForTeamForUser)).Methods("DELETE")

	api.BaseRoutes.Channel.Handle("", api.APISessionRequired(getChannel)).Methods("GET")
	api.BaseRoutes.Channel.Handle("", api.APISessionRequired(updateChannel)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/patch", api.APISessionRequired(patchChannel)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/privacy", api.APISessionRequired(updateChannelPrivacy)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/restore", api.APISessionRequired(restoreChannel)).Methods("POST")
	api.BaseRoutes.Channel.Handle("", api.APISessionRequired(deleteChannel)).Methods("DELETE")
	api.BaseRoutes.Channel.Handle("/stats", api.APISessionRequired(getChannelStats)).Methods("GET")
	api.BaseRoutes.Channel.Handle("/pinned", api.APISessionRequired(getPinnedPosts)).Methods("GET")
	api.BaseRoutes.Channel.Handle("/timezones", api.APISessionRequired(getChannelMembersTimezones)).Methods("GET")
	api.BaseRoutes.Channel.Handle("/members_minus_group_members", api.APISessionRequired(channelMembersMinusGroupMembers)).Methods("GET")
	api.BaseRoutes.Channel.Handle("/move", api.APISessionRequired(moveChannel)).Methods("POST")
	api.BaseRoutes.Channel.Handle("/member_counts_by_group", api.APISessionRequired(channelMemberCountsByGroup)).Methods("GET")

	api.BaseRoutes.ChannelForUser.Handle("/unread", api.APISessionRequired(getChannelUnread)).Methods("GET")

	api.BaseRoutes.ChannelByName.Handle("", api.APISessionRequired(getChannelByName)).Methods("GET")
	api.BaseRoutes.ChannelByNameForTeamName.Handle("", api.APISessionRequired(getChannelByNameForTeamName)).Methods("GET")

	api.BaseRoutes.ChannelMembers.Handle("", api.APISessionRequired(getChannelMembers)).Methods("GET")
	api.BaseRoutes.ChannelMembers.Handle("/ids", api.APISessionRequired(getChannelMembersByIds)).Methods("POST")
	api.BaseRoutes.ChannelMembers.Handle("", api.APISessionRequired(addChannelMember)).Methods("POST")
	api.BaseRoutes.ChannelMembersForUser.Handle("", api.APISessionRequired(getChannelMembersForTeamForUser)).Methods("GET")
	api.BaseRoutes.ChannelMember.Handle("", api.APISessionRequired(getChannelMember)).Methods("GET")
	api.BaseRoutes.ChannelMember.Handle("", api.APISessionRequired(removeChannelMember)).Methods("DELETE")
	api.BaseRoutes.ChannelMember.Handle("/roles", api.APISessionRequired(updateChannelMemberRoles)).Methods("PUT")
	api.BaseRoutes.ChannelMember.Handle("/schemeRoles", api.APISessionRequired(updateChannelMemberSchemeRoles)).Methods("PUT")
	api.BaseRoutes.ChannelMember.Handle("/notify_props", api.APISessionRequired(updateChannelMemberNotifyProps)).Methods("PUT")

	api.BaseRoutes.ChannelModerations.Handle("", api.APISessionRequired(getChannelModerations)).Methods("GET")
	api.BaseRoutes.ChannelModerations.Handle("/patch", api.APISessionRequired(patchChannelModerations)).Methods("PUT")
}

func createChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	var channel *model.Channel
	err := json.NewDecoder(r.Body).Decode(&channel)
	if err != nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	auditRec := c.MakeAuditRecord("createChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel", channel)

	if channel.Type == model.ChannelTypeOpen && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePublicChannel) {
		c.SetPermissionError(model.PermissionCreatePublicChannel)
		return
	}

	if channel.Type == model.ChannelTypePrivate && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePrivateChannel) {
		c.SetPermissionError(model.PermissionCreatePrivateChannel)
		return
	}

	sc, appErr := c.App.CreateChannelWithUser(c.AppContext, channel, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(sc)
	auditRec.AddEventObjectType("channel")
	c.LogAudit("name=" + channel.Name)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(sc); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	err := json.NewDecoder(r.Body).Decode(&channel)
	if err != nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	// The channel being updated in the payload must be the same one as indicated in the URL.
	if channel.Id != c.Params.ChannelId {
		c.SetInvalidParam("channel_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateChannel", audit.Fail)
	auditRec.AddEventParameter("channel", channel)
	defer c.LogAuditRec(auditRec)

	originalOldChannel, appErr := c.App.GetChannel(c.AppContext, channel.Id)
	if appErr != nil {
		c.Err = appErr
		return
	}
	oldChannel := originalOldChannel.DeepCopy()

	auditRec.AddEventPriorState(oldChannel)

	switch oldChannel.Type {
	case model.ChannelTypeOpen:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManagePublicChannelProperties) {
			c.SetPermissionError(model.PermissionManagePublicChannelProperties)
			return
		}

	case model.ChannelTypePrivate:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManagePrivateChannelProperties) {
			c.SetPermissionError(model.PermissionManagePrivateChannelProperties)
			return
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		if _, errGet := c.App.GetChannelMember(c.AppContext, channel.Id, c.AppContext.Session().UserId); errGet != nil {
			c.Err = model.NewAppError("updateChannel", "api.channel.patch_update_channel.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("updateChannel", "api.channel.patch_update_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	if oldChannel.DeleteAt > 0 {
		c.Err = model.NewAppError("updateChannel", "api.channel.update_channel.deleted.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if channel.Type != "" && channel.Type != oldChannel.Type {
		c.Err = model.NewAppError("updateChannel", "api.channel.update_channel.typechange.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if oldChannel.Name == model.DefaultChannelName {
		if channel.Name != "" && channel.Name != oldChannel.Name {
			c.Err = model.NewAppError("updateChannel", "api.channel.update_channel.tried.app_error", map[string]any{"Channel": model.DefaultChannelName}, "", http.StatusBadRequest)
			return
		}
	}

	oldChannel.Header = channel.Header
	oldChannel.Purpose = channel.Purpose

	oldChannelDisplayName := oldChannel.DisplayName

	if channel.DisplayName != "" {
		oldChannel.DisplayName = channel.DisplayName
	}

	if channel.Name != "" {
		oldChannel.Name = channel.Name
		auditRec.AddMeta("new_channel_name", oldChannel.Name)
	}

	if channel.GroupConstrained != nil {
		oldChannel.GroupConstrained = channel.GroupConstrained
	}

	updatedChannel, appErr := c.App.UpdateChannel(c.AppContext, oldChannel)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddMeta("update", updatedChannel)

	if oldChannelDisplayName != channel.DisplayName {
		if err := c.App.PostUpdateChannelDisplayNameMessage(c.AppContext, c.AppContext.Session().UserId, channel, oldChannelDisplayName, channel.DisplayName); err != nil {
			c.Logger.Warn("Error while posting channel display name message", mlog.Err(err))
		}
	}

	auditRec.AddEventResultState(updatedChannel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("name=" + channel.Name)

	if err := json.NewEncoder(w).Encode(oldChannel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateChannelPrivacy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	privacy, ok := props["privacy"].(string)
	if !ok || (model.ChannelType(privacy) != model.ChannelTypeOpen && model.ChannelType(privacy) != model.ChannelTypePrivate) {
		c.SetInvalidParam("privacy")
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("updateChannelPrivacy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("props", props)
	auditRec.AddEventPriorState(channel)

	if model.ChannelType(privacy) == model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionConvertPrivateChannelToPublic) {
		c.SetPermissionError(model.PermissionConvertPrivateChannelToPublic)
		return
	}

	if model.ChannelType(privacy) == model.ChannelTypePrivate && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionConvertPublicChannelToPrivate) {
		c.SetPermissionError(model.PermissionConvertPublicChannelToPrivate)
		return
	}

	if channel.Name == model.DefaultChannelName && model.ChannelType(privacy) == model.ChannelTypePrivate {
		c.Err = model.NewAppError("updateChannelPrivacy", "api.channel.update_channel_privacy.default_channel_error", nil, "", http.StatusBadRequest)
		return
	}

	user, err := c.App.GetUser(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	channel.Type = model.ChannelType(privacy)

	updatedChannel, err := c.App.UpdateChannelPrivacy(c.AppContext, channel, user)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(updatedChannel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("name=" + updatedChannel.Name)

	if err := json.NewEncoder(w).Encode(updatedChannel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}
	var patch *model.ChannelPatch
	err := json.NewDecoder(r.Body).Decode(&patch)
	if err != nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	originalOldChannel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	oldChannel := originalOldChannel.DeepCopy()

	auditRec := c.MakeAuditRecord("patchChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel", patch)
	auditRec.AddEventPriorState(oldChannel)

	switch oldChannel.Type {
	case model.ChannelTypeOpen:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManagePublicChannelProperties) {
			c.SetPermissionError(model.PermissionManagePublicChannelProperties)
			return
		}

	case model.ChannelTypePrivate:
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManagePrivateChannelProperties) {
			c.SetPermissionError(model.PermissionManagePrivateChannelProperties)
			return
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		if _, appErr = c.App.GetChannelMember(c.AppContext, c.Params.ChannelId, c.AppContext.Session().UserId); appErr != nil {
			c.Err = model.NewAppError("patchChannel", "api.channel.patch_update_channel.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("patchChannel", "api.channel.patch_update_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	if oldChannel.Name == model.DefaultChannelName {
		if patch.Name != nil && *patch.Name != oldChannel.Name {
			c.Err = model.NewAppError("patchChannel", "api.channel.update_channel.tried.app_error", map[string]any{"Channel": model.DefaultChannelName}, "", http.StatusBadRequest)
			return
		}
	}

	rchannel, appErr := c.App.PatchChannel(c.AppContext, oldChannel, patch, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	appErr = c.App.FillInChannelProps(c.AppContext, rchannel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(rchannel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(rchannel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func restoreChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	teamId := channel.TeamId

	auditRec := c.MakeAuditRecord("restoreChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventPriorState(channel)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	channel, err = c.App.RestoreChannel(c.AppContext, channel, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()
	c.LogAudit("name=" + channel.Name)

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createDirectChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJSON(r.Body)
	allowed := false

	if len(userIds) != 2 {
		c.SetInvalidParam("user_ids")
		return
	}

	for _, id := range userIds {
		if !model.IsValidId(id) {
			c.SetInvalidParam("user_id")
			return
		}
		if id == c.AppContext.Session().UserId {
			allowed = true
		}
	}

	auditRec := c.MakeAuditRecord("createDirectChannel", audit.Fail)
	auditRec.AddEventParameter("user_ids", userIds)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateDirectChannel) {
		c.SetPermissionError(model.PermissionCreateDirectChannel)
		return
	}

	if !allowed && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	otherUserId := userIds[0]
	if c.AppContext.Session().UserId == otherUserId {
		otherUserId = userIds[1]
	}

	auditRec.AddEventParameter("user_id", otherUserId)

	canSee, err := c.App.UserCanSeeOtherUser(c.AppContext.Session().UserId, otherUserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return
	}

	sc, err := c.App.GetOrCreateDirectChannel(c.AppContext, userIds[0], userIds[1])
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(sc)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(sc); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchGroupChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	var props *model.ChannelSearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	groupChannels, appErr := c.App.SearchGroupChannels(c.AppContext, c.AppContext.Session().UserId, props.Term)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(groupChannels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createGroupChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJSON(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	found := false
	for _, id := range userIds {
		if !model.IsValidId(id) {
			c.SetInvalidParam("user_id")
			return
		}
		if id == c.AppContext.Session().UserId {
			found = true
		}
	}

	if !found {
		userIds = append(userIds, c.AppContext.Session().UserId)
	}

	auditRec := c.MakeAuditRecord("createGroupChannel", audit.Fail)
	auditRec.AddEventParameter("user_ids", userIds)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateGroupChannel) {
		c.SetPermissionError(model.PermissionCreateGroupChannel)
		return
	}

	canSeeAll := true
	for _, id := range userIds {
		if c.AppContext.Session().UserId != id {
			canSee, err := c.App.UserCanSeeOtherUser(c.AppContext.Session().UserId, id)
			if err != nil {
				c.Err = err
				return
			}
			if !canSee {
				canSeeAll = false
			}
		}
	}

	if !canSeeAll {
		c.SetPermissionError(model.PermissionViewMembers)
		return
	}

	groupChannel, err := c.App.CreateGroupChannel(c.AppContext, userIds, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(groupChannel)
	auditRec.AddEventObjectType("channel")
	auditRec.Success()

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(groupChannel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.ChannelTypeOpen {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionReadPublicChannel) && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadPublicChannel)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadChannel)
			return
		}
	}

	err = c.App.FillInChannelProps(c.AppContext, channel)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	channelUnread, err := c.App.GetChannelUnread(c.AppContext, c.Params.ChannelId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(channelUnread); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelStats(c *Context, w http.ResponseWriter, r *http.Request) {
	excludeFilesCount := r.URL.Query().Get("exclude_files_count")
	excludeFilesCountBool, _ := strconv.ParseBool(excludeFilesCount)

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	memberCount, err := c.App.GetChannelMemberCount(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	guestCount, err := c.App.GetChannelGuestCount(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	pinnedPostCount, err := c.App.GetChannelPinnedPostCount(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	filesCount := int64(-1)
	if !excludeFilesCountBool {
		filesCount, err = c.App.GetChannelFileCount(c.AppContext, c.Params.ChannelId)
		if err != nil {
			c.Err = err
			return
		}
	}

	stats := model.ChannelStats{
		ChannelId:       c.Params.ChannelId,
		MemberCount:     memberCount,
		GuestCount:      guestCount,
		PinnedPostCount: pinnedPostCount,
		FilesCount:      filesCount,
	}
	if err := json.NewEncoder(w).Encode(stats); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPinnedPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	posts, err := c.App.GetPinnedPosts(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(posts.Etag(), "Get Pinned Posts", w, r) {
		return
	}

	clientPostList := c.App.PreparePostListForClient(c.AppContext, posts)
	clientPostList, err = c.App.SanitizePostListMetadataForUser(c.AppContext, clientPostList, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set(model.HeaderEtagServer, clientPostList.Etag())
	if err := clientPostList.EncodeJSON(w); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAllChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	permissions := []*model.Permission{
		model.PermissionSysconsoleReadUserManagementGroups,
		model.PermissionSysconsoleReadUserManagementChannels,
	}
	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), permissions) {
		c.SetPermissionError(permissions...)
		return
	}
	// Only system managers may use the ExcludePolicyConstrained parameter
	if c.Params.ExcludePolicyConstrained && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	opts := model.ChannelSearchOpts{
		NotAssociatedToGroup:     c.Params.NotAssociatedToGroup,
		ExcludeDefaultChannels:   c.Params.ExcludeDefaultChannels,
		IncludeDeleted:           c.Params.IncludeDeleted,
		ExcludePolicyConstrained: c.Params.ExcludePolicyConstrained,
	}
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		opts.IncludePolicyID = true
	}

	channels, err := c.App.GetAllChannels(c.AppContext, c.Params.Page, c.Params.PerPage, opts)
	if err != nil {
		c.Err = err
		return
	}

	if c.Params.IncludeTotalCount {
		totalCount, err := c.App.GetAllChannelsCount(c.AppContext, opts)
		if err != nil {
			c.Err = err
			return
		}
		cwc := &model.ChannelsWithCount{
			Channels:   channels,
			TotalCount: totalCount,
		}
		if err := json.NewEncoder(w).Encode(cwc); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPublicChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		c.SetPermissionError(model.PermissionListTeamChannels)
		return
	}

	channels, err := c.App.GetPublicChannelsForTeam(c.AppContext, c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.FillInChannelsProps(c.AppContext, channels)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getDeletedChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	channels, err := c.App.GetDeletedChannels(c.AppContext, c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.FillInChannelsProps(c.AppContext, channels)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPrivateChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	channels, err := c.App.GetPrivateChannelsForTeam(c.AppContext, c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.FillInChannelsProps(c.AppContext, channels)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPublicChannelsByIdsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	channelIds := model.ArrayFromJSON(r.Body)
	if len(channelIds) == 0 {
		c.SetInvalidParam("channel_ids")
		return
	}

	for _, cid := range channelIds {
		if !model.IsValidId(cid) {
			c.SetInvalidParam("channel_id")
			return
		}
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	channels, err := c.App.GetPublicChannelsByIdsForTeam(c.AppContext, c.Params.TeamId, channelIds)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.FillInChannelsProps(c.AppContext, channels)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelsForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	query := r.URL.Query()
	lastDeleteAt, nErr := strconv.Atoi(query.Get("last_delete_at"))
	if nErr != nil {
		lastDeleteAt = 0
	}
	if lastDeleteAt < 0 {
		c.SetInvalidURLParam("last_delete_at")
		return
	}

	channels, err := c.App.GetChannelsForTeamForUser(c.AppContext, c.Params.TeamId, c.Params.UserId, &model.ChannelSearchOpts{
		IncludeDeleted: c.Params.IncludeDeleted,
		LastDeleteAt:   lastDeleteAt,
	})
	if err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(channels.Etag(), "Get Channels", w, r) {
		return
	}

	err = c.App.FillInChannelsProps(c.AppContext, channels)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set(model.HeaderEtagServer, channels.Etag())
	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	query := r.URL.Query()
	lastDeleteAt, nErr := strconv.Atoi(query.Get("last_delete_at"))
	if nErr != nil {
		lastDeleteAt = 0
	}
	if lastDeleteAt < 0 {
		c.SetInvalidURLParam("last_delete_at")
		return
	}

	pageSize := 100
	fromChannelID := ""
	// We have to write `[` and `]` separately because we want to stream the response.
	// The internal API is paginated, but the client always needs to get the full data.
	// Therefore, to avoid forcing the client to go through all the pages,
	// we stream the full data from server side itself.
	//
	// Note that this means if an error occurs in mid-stream, the response won't be
	// fully JSON.
	w.Write([]byte(`[`))
	enc := json.NewEncoder(w)
	for {
		channels, err := c.App.GetChannelsForUser(c.AppContext, c.Params.UserId, c.Params.IncludeDeleted, lastDeleteAt, pageSize, fromChannelID)
		if err != nil {
			// If the page size was a perfect multiple of the total number of results,
			// then the last query will always return zero results.
			if fromChannelID != "" && err.Id == "app.channel.get_channels.not_found.app_error" {
				break
			}
			c.Err = err
			return
		}

		err = c.App.FillInChannelsProps(c.AppContext, channels)
		if err != nil {
			c.Err = err
			return
		}

		// intermediary comma between sets
		if fromChannelID != "" {
			w.Write([]byte(`,`))
		}

		for i, ch := range channels {
			if err := enc.Encode(ch); err != nil {
				c.Logger.Warn("Error while writing response", mlog.Err(err))
			}
			if i < len(channels)-1 {
				w.Write([]byte(`,`))
			}
		}

		if len(channels) < pageSize {
			break
		}

		fromChannelID = channels[len(channels)-1].Id
	}
	w.Write([]byte(`]`))
}

func autocompleteChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		c.SetPermissionError(model.PermissionListTeamChannels)
		return
	}

	name := r.URL.Query().Get("name")

	channels, err := c.App.AutocompleteChannelsForTeam(c.AppContext, c.Params.TeamId, c.AppContext.Session().UserId, name)
	if err != nil {
		c.Err = err
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func autocompleteChannelsForTeamForSearch(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	name := r.URL.Query().Get("name")

	channels, err := c.App.AutocompleteChannelsForSearch(c.AppContext, c.Params.TeamId, c.AppContext.Session().UserId, name)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var props *model.ChannelSearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	var channels model.ChannelList
	var appErr *model.AppError
	if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		channels, appErr = c.App.SearchChannels(c.AppContext, c.Params.TeamId, props.Term)
	} else {
		// If the user is not a team member, return a 404
		if _, appErr = c.App.GetTeamMember(c.Params.TeamId, c.AppContext.Session().UserId); appErr != nil {
			c.Err = appErr
			return
		}

		channels, appErr = c.App.SearchChannelsForUser(c.AppContext, c.AppContext.Session().UserId, c.Params.TeamId, props.Term)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchArchivedChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var props *model.ChannelSearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	var channels model.ChannelList
	var appErr *model.AppError
	if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		channels, appErr = c.App.SearchArchivedChannels(c.AppContext, c.Params.TeamId, props.Term, c.AppContext.Session().UserId)
	} else {
		// If the user is not a team member, return a 404
		if _, appErr = c.App.GetTeamMember(c.Params.TeamId, c.AppContext.Session().UserId); appErr != nil {
			c.Err = appErr
			return
		}

		channels, appErr = c.App.SearchArchivedChannels(c.AppContext, c.Params.TeamId, props.Term, c.AppContext.Session().UserId)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchAllChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	var props *model.ChannelSearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	fromSysConsole := true
	if val := r.URL.Query().Get("system_console"); val != "" {
		fromSysConsole, err = strconv.ParseBool(val)
		if err != nil {
			c.SetInvalidParam("system_console")
			return
		}
	}

	if !fromSysConsole {
		// If the request is not coming from system_console, only show the user level channels
		// from all teams.
		channels, err := c.App.AutocompleteChannels(c.AppContext, c.AppContext.Session().UserId, props.Term)
		if err != nil {
			c.Err = err
			return
		}

		if err := json.NewEncoder(w).Encode(channels); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	// Only system managers may use the ExcludePolicyConstrained field
	if props.ExcludePolicyConstrained && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementChannels) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementChannels)
		return
	}

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	includeDeleted = includeDeleted || props.IncludeDeleted
	opts := model.ChannelSearchOpts{
		NotAssociatedToGroup:     props.NotAssociatedToGroup,
		ExcludeDefaultChannels:   props.ExcludeDefaultChannels,
		TeamIds:                  props.TeamIds,
		GroupConstrained:         props.GroupConstrained,
		ExcludeGroupConstrained:  props.ExcludeGroupConstrained,
		ExcludePolicyConstrained: props.ExcludePolicyConstrained,
		IncludeSearchById:        props.IncludeSearchById,
		Public:                   props.Public,
		Private:                  props.Private,
		IncludeDeleted:           includeDeleted,
		Deleted:                  props.Deleted,
		Page:                     props.Page,
		PerPage:                  props.PerPage,
	}
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		opts.IncludePolicyID = true
	}

	channels, totalCount, appErr := c.App.SearchAllChannels(c.AppContext, props.Term, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.
	if props.Page != nil && props.PerPage != nil {
		data := model.ChannelsWithCount{Channels: channels, TotalCount: totalCount}

		if err := json.NewEncoder(w).Encode(data); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("deleteChannel", audit.Fail)
	auditRec.AddEventParameter("id", c.Params.ChannelId)
	auditRec.AddEventPriorState(channel)
	defer c.LogAuditRec(auditRec)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("deleteChannel", "api.channel.delete_channel.type.invalid", nil, "", http.StatusBadRequest)
		return
	}

	if channel.Type == model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionDeletePublicChannel) {
		c.SetPermissionError(model.PermissionDeletePublicChannel)
		return
	}

	if channel.Type == model.ChannelTypePrivate && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionDeletePrivateChannel) {
		c.SetPermissionError(model.PermissionDeletePrivateChannel)
		return
	}

	if c.Params.Permanent {
		if *c.App.Config().ServiceSettings.EnableAPIChannelDeletion {
			err = c.App.PermanentDeleteChannel(c.AppContext, channel)
		} else {
			err = model.NewAppError("deleteChannel", "api.user.delete_channel.not_enabled.app_error", nil, "channelId="+c.Params.ChannelId, http.StatusUnauthorized)
		}
	} else {
		err = c.App.DeleteChannel(c.AppContext, channel, c.AppContext.Session().UserId)
	}
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("name=" + channel.Name)

	ReturnStatusOK(w)
}

func getChannelByName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireChannelName()
	if c.Err != nil {
		return
	}

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	channel, appErr := c.App.GetChannelByName(c.AppContext, c.Params.ChannelName, c.Params.TeamId, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if channel.Type == model.ChannelTypeOpen {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionReadPublicChannel) && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannel) {
			c.SetPermissionError(model.PermissionReadPublicChannel)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannel) {
			c.Err = model.NewAppError("getChannelByName", "app.channel.get_by_name.missing.app_error", nil, "teamId="+channel.TeamId+", "+"name="+channel.Name+"", http.StatusNotFound)
			return
		}
	}

	appErr = c.App.FillInChannelProps(c.AppContext, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelByNameForTeamName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamName().RequireChannelName()
	if c.Err != nil {
		return
	}

	includeDeleted, _ := strconv.ParseBool(r.URL.Query().Get("include_deleted"))
	channel, appErr := c.App.GetChannelByNameForTeamName(c.AppContext, c.Params.ChannelName, c.Params.TeamName, includeDeleted)
	if appErr != nil {
		c.Err = appErr
		return
	}

	teamOk := c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionReadPublicChannel)
	channelOk := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionReadChannel)

	if channel.Type == model.ChannelTypeOpen {
		if !teamOk && !channelOk {
			c.SetPermissionError(model.PermissionReadPublicChannel)
			return
		}
	} else if !channelOk {
		c.Err = model.NewAppError("getChannelByNameForTeamName", "app.channel.get_by_name.missing.app_error", nil, "teamId="+channel.TeamId+", "+"name="+channel.Name+"", http.StatusNotFound)
		return
	}

	appErr = c.App.FillInChannelProps(c.AppContext, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	members, err := c.App.GetChannelMembersPage(c.AppContext, c.Params.ChannelId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(members); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelMembersTimezones(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	membersTimezones, err := c.App.GetChannelMembersTimezones(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.ArrayToJSON(membersTimezones)))
}

func getChannelMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	userIds := model.ArrayFromJSON(r.Body)
	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	members, err := c.App.GetChannelMembersByIds(c.AppContext, c.Params.ChannelId, userIds)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(members); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	ctx := c.AppContext
	ctx.SetContext(app.WithMaster(ctx.Context()))
	member, err := c.App.GetChannelMember(ctx, c.Params.ChannelId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(member); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelMembersForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	if c.AppContext.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	members, err := c.App.GetChannelMembersForUser(c.AppContext, c.Params.TeamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(members); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func viewChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	var view model.ChannelView
	if jsonErr := json.NewDecoder(r.Body).Decode(&view); jsonErr != nil {
		c.SetInvalidParamWithErr("channel_view", jsonErr)
		return
	}

	// Validate view struct
	// Check IDs are valid or blank. Blank IDs are used to denote focus loss or initial channel view.
	if view.ChannelId != "" && !model.IsValidId(view.ChannelId) {
		c.SetInvalidParam("channel_view.channel_id")
		return
	}
	if view.PrevChannelId != "" && !model.IsValidId(view.PrevChannelId) {
		c.SetInvalidParam("channel_view.prev_channel_id")
		return
	}

	times, err := c.App.ViewChannel(c.AppContext, &view, c.Params.UserId, c.AppContext.Session().Id, view.CollapsedThreadsSupported)
	if err != nil {
		c.Err = err
		return
	}

	c.App.Srv().Platform().UpdateLastActivityAtIfNeeded(*c.AppContext.Session())
	c.ExtendSessionExpiryIfNeeded(w, r)

	// Returning {"status": "OK", ...} for backwards compatibility
	resp := &model.ChannelViewResponse{
		Status:            "OK",
		LastViewedAtTimes: times,
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateChannelMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJSON(r.Body)

	newRoles := props["roles"]
	if !(model.IsValidUserRoles(newRoles)) {
		c.SetInvalidParam("roles")
		return
	}

	auditRec := c.MakeAuditRecord("updateChannelMemberRoles", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("props", props)
	auditRec.AddEventParameter("channel_id", c.Params.ChannelId)

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManageChannelRoles) {
		c.SetPermissionError(model.PermissionManageChannelRoles)
		return
	}

	if _, err := c.App.UpdateChannelMemberRoles(c.AppContext, c.Params.ChannelId, c.Params.UserId, newRoles); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func updateChannelMemberSchemeRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	var schemeRoles model.SchemeRoles
	if jsonErr := json.NewDecoder(r.Body).Decode(&schemeRoles); jsonErr != nil {
		c.SetInvalidParamWithErr("scheme_roles", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("updateChannelMemberSchemeRoles", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel_id", c.Params.ChannelId)
	auditRec.AddEventParameter("roles", schemeRoles)

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionManageChannelRoles) {
		c.SetPermissionError(model.PermissionManageChannelRoles)
		return
	}

	if _, err := c.App.UpdateChannelMemberSchemeRoles(c.AppContext, c.Params.ChannelId, c.Params.UserId, schemeRoles.SchemeGuest, schemeRoles.SchemeUser, schemeRoles.SchemeAdmin); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func updateChannelMemberNotifyProps(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJSON(r.Body)
	if props == nil {
		c.SetInvalidParam("notify_props")
		return
	}

	auditRec := c.MakeAuditRecord("updateChannelMemberNotifyProps", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel_id", c.Params.ChannelId)
	auditRec.AddEventParameter("props", props)

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	_, err := c.App.UpdateChannelMemberNotifyProps(c.AppContext, props, c.Params.ChannelId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func addChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	userId, ok := props["user_id"].(string)
	if !ok || !model.IsValidId(userId) {
		c.SetInvalidParam("user_id")
		return
	}

	auditRec := c.MakeAuditRecord("addChannelMember", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("props", props)

	member := &model.ChannelMember{
		ChannelId: c.Params.ChannelId,
		UserId:    userId,
	}

	postRootId, ok := props["post_root_id"].(string)
	if ok && postRootId != "" && !model.IsValidId(postRootId) {
		c.SetInvalidParam("post_root_id")
		return
	}

	if ok && len(postRootId) == 26 {
		rootPost, err := c.App.GetSinglePost(postRootId, false)
		if err != nil {
			c.Err = err
			return
		}
		if rootPost.ChannelId != member.ChannelId {
			c.SetInvalidParam("post_root_id")
			return
		}
	}

	channel, err := c.App.GetChannel(c.AppContext, member.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventParameter("channel_id", member.ChannelId)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("addUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	isNewMembership := false
	if _, err = c.App.GetChannelMember(c.AppContext, member.ChannelId, member.UserId); err != nil {
		if err.Id == app.MissingChannelMemberError {
			isNewMembership = true
		} else {
			c.Err = err
			return
		}
	}

	isSelfAdd := member.UserId == c.AppContext.Session().UserId

	if channel.Type == model.ChannelTypeOpen {
		if isSelfAdd && isNewMembership {
			if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionJoinPublicChannels) {
				c.SetPermissionError(model.PermissionJoinPublicChannels)
				return
			}
		} else if isSelfAdd && !isNewMembership {
			// nothing to do, since already in the channel
		} else if !isSelfAdd {
			if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePublicChannelMembers) {
				c.SetPermissionError(model.PermissionManagePublicChannelMembers)
				return
			}
		}
	}

	if channel.Type == model.ChannelTypePrivate {
		if isSelfAdd && isNewMembership {
			if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePrivateChannelMembers) {
				c.SetPermissionError(model.PermissionManagePrivateChannelMembers)
				return
			}
		} else if isSelfAdd && !isNewMembership {
			// nothing to do, since already in the channel
		} else if !isSelfAdd {
			if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePrivateChannelMembers) {
				c.SetPermissionError(model.PermissionManagePrivateChannelMembers)
				return
			}
		}
	}

	if channel.IsGroupConstrained() {
		nonMembers, err := c.App.FilterNonGroupChannelMembers([]string{member.UserId}, channel)
		if err != nil {
			if v, ok := err.(*model.AppError); ok {
				c.Err = v
			} else {
				c.Err = model.NewAppError("addChannelMember", "api.channel.add_members.error", nil, err.Error(), http.StatusBadRequest)
			}
			return
		}
		if len(nonMembers) > 0 {
			c.Err = model.NewAppError("addChannelMember", "api.channel.add_members.user_denied", map[string]any{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	cm, err := c.App.AddChannelMember(c.AppContext, member.UserId, channel, app.ChannelMemberOpts{
		UserRequestorID: c.AppContext.Session().UserId,
		PostRootID:      postRootId,
	})
	if err != nil {
		c.Err = err
		return
	}

	if postRootId != "" {
		err := c.App.UpdateThreadFollowForUserFromChannelAdd(c.AppContext, cm.UserId, channel.TeamId, postRootId)
		if err != nil {
			c.Err = err
			return
		}
	}

	auditRec.Success()
	auditRec.AddEventResultState(cm)
	auditRec.AddEventObjectType("channel_member")
	auditRec.AddMeta("add_user_id", cm.UserId)
	c.LogAudit("name=" + channel.Name + " user_id=" + cm.UserId)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(cm); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func removeChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("removeChannelMember", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel_id", channel.Id)
	auditRec.AddEventParameter("user_id", user.Id)

	if !(channel.Type == model.ChannelTypeOpen || channel.Type == model.ChannelTypePrivate) {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_channel_member.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if channel.IsGroupConstrained() && (c.Params.UserId != c.AppContext.Session().UserId) && !user.IsBot {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_member.group_constrained.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if c.Params.UserId != c.AppContext.Session().UserId {
		if channel.Type == model.ChannelTypeOpen && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePublicChannelMembers) {
			c.SetPermissionError(model.PermissionManagePublicChannelMembers)
			return
		}

		if channel.Type == model.ChannelTypePrivate && !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePrivateChannelMembers) {
			c.SetPermissionError(model.PermissionManagePrivateChannelMembers)
			return
		}
	}

	if err = c.App.RemoveUserFromChannel(c.AppContext, c.Params.UserId, c.AppContext.Session().UserId, channel); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("name=" + channel.Name + " user_id=" + c.Params.UserId)

	ReturnStatusOK(w)
}

func updateChannelScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var p model.SchemeIDPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&p); jsonErr != nil || p.SchemeID == nil || !model.IsValidId(*p.SchemeID) {
		c.SetInvalidParamWithErr("scheme_id", jsonErr)
		return
	}
	schemeID := p.SchemeID

	auditRec := c.MakeAuditRecord("updateChannelScheme", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("scheme_id", *schemeID)

	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("Api4.UpdateChannelScheme", "api.channel.update_channel_scheme.license.error", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	scheme, err := c.App.GetScheme(*schemeID)
	if err != nil {
		c.Err = err
		return
	}

	if scheme.Scope != model.SchemeScopeChannel {
		c.Err = model.NewAppError("Api4.UpdateChannelScheme", "api.channel.update_channel_scheme.scheme_scope.error", nil, "", http.StatusBadRequest)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventPriorState(channel)

	channel.SchemeId = &scheme.Id

	updatedChannel, err := c.App.UpdateChannelScheme(c.AppContext, channel)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(updatedChannel)
	auditRec.AddEventObjectType("channel")

	auditRec.Success()

	ReturnStatusOK(w)
}

func channelMembersMinusGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	groupIDsParam := groupIDsQueryParamRegex.ReplaceAllString(c.Params.GroupIDs, "")

	if len(groupIDsParam) < 26 {
		c.SetInvalidParam("group_ids")
		return
	}

	groupIDs := []string{}
	for _, gid := range strings.Split(c.Params.GroupIDs, ",") {
		if !model.IsValidId(gid) {
			c.SetInvalidParam("group_ids")
			return
		}
		groupIDs = append(groupIDs, gid)
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementChannels) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementChannels)
		return
	}

	users, totalCount, appErr := c.App.ChannelMembersMinusGroupMembers(
		c.Params.ChannelId,
		groupIDs,
		c.Params.Page,
		c.Params.PerPage,
	)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(&model.UsersWithGroupsAndCount{
		Users: users,
		Count: totalCount,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.channelMembersMinusGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
}

func channelMemberCountsByGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("Api4.channelMemberCountsByGroup", "api.channel.channel_member_counts_by_group.license.error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	includeTimezones := r.URL.Query().Get("include_timezones") == "true"

	channelMemberCounts, appErr := c.App.GetMemberCountsByGroup(app.WithMaster(context.Background()), c.Params.ChannelId, includeTimezones)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(channelMemberCounts)
	if err != nil {
		c.Err = model.NewAppError("Api4.channelMemberCountsByGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
}

func getChannelModerations(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("Api4.GetChannelModerations", "api.channel.get_channel_moderations.license.error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementChannels) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementChannels)
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channelModerations, appErr := c.App.GetChannelModerationsForChannel(c.AppContext, channel)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(channelModerations)
	if err != nil {
		c.Err = model.NewAppError("Api4.getChannelModerations", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
}

func patchChannelModerations(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("Api4.patchChannelModerations", "api.channel.patch_channel_moderations.license.error", nil, "", http.StatusForbidden)
		return
	}

	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("patchChannelModerations", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementChannels) {
		c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementChannels)
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddMeta("channel", channel)

	var channelModerationsPatch []*model.ChannelModerationPatch
	err := json.NewDecoder(r.Body).Decode(&channelModerationsPatch)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchChannelModerations", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	channelModerations, appErr := c.App.PatchChannelModerationsForChannel(c.AppContext, channel, channelModerationsPatch)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventParameter("patch", channelModerationsPatch)

	b, err := json.Marshal(channelModerations)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchChannelModerations", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	w.Write(b)
}

func moveChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	teamId, ok := props["team_id"].(string)
	if !ok {
		c.SetInvalidParam("team_id")
		return
	}

	force, ok := props["force"].(bool)
	if !ok {
		c.SetInvalidParam("force")
		return
	}

	team, err := c.App.GetTeam(teamId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("moveChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("channel_id", c.Params.ChannelId)
	auditRec.AddEventParameter("props", props)
	auditRec.AddEventPriorState(channel)

	// TODO check and verify if the below three things are parameters or prior state if any
	auditRec.AddMeta("channel_name", channel.Name)
	auditRec.AddMeta("team_id", team.Id)
	auditRec.AddMeta("team_name", team.Name)

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("moveChannel", "api.channel.move_channel.type.invalid", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	user, err := c.App.GetUser(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.RemoveAllDeactivatedMembersFromChannel(c.AppContext, channel)
	if err != nil {
		c.Err = err
		return
	}

	if force {
		err = c.App.RemoveUsersFromChannelNotMemberOfTeam(c.AppContext, user, channel, team)
		if err != nil {
			c.Err = err
			return
		}
	}

	err = c.App.MoveChannel(c.AppContext, team, channel, user)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(channel)
	auditRec.AddEventObjectType("channel")

	auditRec.Success()
	c.LogAudit("channel=" + channel.Name)
	c.LogAudit("team=" + team.Name)

	if err := json.NewEncoder(w).Encode(channel); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
