// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

const maxListSize = 1000

func (api *API) InitChannel() {
	api.BaseRoutes.Channels.Handle("", api.APISessionRequired(getAllChannels)).Methods(http.MethodGet)
	api.BaseRoutes.Channels.Handle("", api.APISessionRequired(createChannel)).Methods(http.MethodPost)
	api.BaseRoutes.Channels.Handle("/direct", api.APISessionRequired(createDirectChannel)).Methods(http.MethodPost)
	api.BaseRoutes.Channels.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchAllChannels)).Methods(http.MethodPost)
	api.BaseRoutes.Channels.Handle("/group/search", api.APISessionRequiredDisableWhenBusy(searchGroupChannels)).Methods(http.MethodPost)
	api.BaseRoutes.Channels.Handle("/group", api.APISessionRequired(createGroupChannel)).Methods(http.MethodPost)
	api.BaseRoutes.Channels.Handle("/members/{user_id:[A-Za-z0-9]+}/view", api.APISessionRequired(viewChannel)).Methods(http.MethodPost)
	api.BaseRoutes.Channels.Handle("/members/{user_id:[A-Za-z0-9]+}/mark_read", api.APISessionRequired(readMultipleChannels)).Methods(http.MethodPost)
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/scheme", api.APISessionRequired(updateChannelScheme)).Methods(http.MethodPut)
	api.BaseRoutes.Channels.Handle("/stats/member_count", api.APISessionRequired(getChannelsMemberCount)).Methods(http.MethodPost)

	api.BaseRoutes.ChannelsForTeam.Handle("", api.APISessionRequired(getPublicChannelsForTeam)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelsForTeam.Handle("/deleted", api.APISessionRequired(getDeletedChannelsForTeam)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelsForTeam.Handle("/private", api.APISessionRequired(getPrivateChannelsForTeam)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelsForTeam.Handle("/ids", api.APISessionRequired(getPublicChannelsByIdsForTeam)).Methods(http.MethodPost)
	api.BaseRoutes.ChannelsForTeam.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchChannelsForTeam)).Methods(http.MethodPost)
	api.BaseRoutes.ChannelsForTeam.Handle("/search_archived", api.APISessionRequiredDisableWhenBusy(searchArchivedChannelsForTeam)).Methods(http.MethodPost)
	api.BaseRoutes.ChannelsForTeam.Handle("/autocomplete", api.APISessionRequired(autocompleteChannelsForTeam)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelsForTeam.Handle("/search_autocomplete", api.APISessionRequired(autocompleteChannelsForTeamForSearch)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/teams/{team_id:[A-Za-z0-9]+}/channels", api.APISessionRequired(getChannelsForTeamForUser)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/channels", api.APISessionRequired(getChannelsForUser)).Methods(http.MethodGet)

	api.BaseRoutes.ChannelCategories.Handle("", api.APISessionRequired(getCategoriesForTeamForUser)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelCategories.Handle("", api.APISessionRequired(createCategoryForTeamForUser)).Methods(http.MethodPost)
	api.BaseRoutes.ChannelCategories.Handle("", api.APISessionRequired(updateCategoriesForTeamForUser)).Methods(http.MethodPut)
	api.BaseRoutes.ChannelCategories.Handle("/order", api.APISessionRequired(getCategoryOrderForTeamForUser)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelCategories.Handle("/order", api.APISessionRequired(updateCategoryOrderForTeamForUser)).Methods(http.MethodPut)
	api.BaseRoutes.ChannelCategories.Handle("/{category_id:[A-Za-z0-9_-]+}", api.APISessionRequired(getCategoryForTeamForUser)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelCategories.Handle("/{category_id:[A-Za-z0-9_-]+}", api.APISessionRequired(updateCategoryForTeamForUser)).Methods(http.MethodPut)
	api.BaseRoutes.ChannelCategories.Handle("/{category_id:[A-Za-z0-9_-]+}", api.APISessionRequired(deleteCategoryForTeamForUser)).Methods(http.MethodDelete)

	api.BaseRoutes.Channel.Handle("", api.APISessionRequired(getChannel)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("", api.APISessionRequired(updateChannel)).Methods(http.MethodPut)
	api.BaseRoutes.Channel.Handle("/patch", api.APISessionRequired(patchChannel)).Methods(http.MethodPut)
	api.BaseRoutes.Channel.Handle("/privacy", api.APISessionRequired(updateChannelPrivacy)).Methods(http.MethodPut)
	api.BaseRoutes.Channel.Handle("/restore", api.APISessionRequired(restoreChannel)).Methods(http.MethodPost)
	api.BaseRoutes.Channel.Handle("", api.APISessionRequired(deleteChannel)).Methods(http.MethodDelete)
	api.BaseRoutes.Channel.Handle("/stats", api.APISessionRequired(getChannelStats)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/pinned", api.APISessionRequired(getPinnedPosts)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/timezones", api.APISessionRequired(getChannelMembersTimezones)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/members_minus_group_members", api.APISessionRequired(channelMembersMinusGroupMembers)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/move", api.APISessionRequired(moveChannel)).Methods(http.MethodPost)
	api.BaseRoutes.Channel.Handle("/member_counts_by_group", api.APISessionRequired(channelMemberCountsByGroup)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/common_teams", api.APISessionRequired(getGroupMessageMembersCommonTeams)).Methods(http.MethodGet)
	api.BaseRoutes.Channel.Handle("/convert_to_channel", api.APISessionRequired(convertGroupMessageToChannel)).Methods(http.MethodPost)

	api.BaseRoutes.ChannelForUser.Handle("/unread", api.APISessionRequired(getChannelUnread)).Methods(http.MethodGet)

	api.BaseRoutes.ChannelByName.Handle("", api.APISessionRequired(getChannelByName)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelByNameForTeamName.Handle("", api.APISessionRequired(getChannelByNameForTeamName)).Methods(http.MethodGet)

	api.BaseRoutes.ChannelMembers.Handle("", api.APISessionRequired(getChannelMembers)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelMembers.Handle("/ids", api.APISessionRequired(getChannelMembersByIds)).Methods(http.MethodPost)
	api.BaseRoutes.ChannelMembers.Handle("", api.APISessionRequired(addChannelMember)).Methods(http.MethodPost)
	api.BaseRoutes.ChannelMembersForUser.Handle("", api.APISessionRequired(getChannelMembersForTeamForUser)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelMember.Handle("", api.APISessionRequired(getChannelMember)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelMember.Handle("", api.APISessionRequired(removeChannelMember)).Methods(http.MethodDelete)
	api.BaseRoutes.ChannelMember.Handle("/roles", api.APISessionRequired(updateChannelMemberRoles)).Methods(http.MethodPut)
	api.BaseRoutes.ChannelMember.Handle("/schemeRoles", api.APISessionRequired(updateChannelMemberSchemeRoles)).Methods(http.MethodPut)
	api.BaseRoutes.ChannelMember.Handle("/notify_props", api.APISessionRequired(updateChannelMemberNotifyProps)).Methods(http.MethodPut)

	api.BaseRoutes.ChannelModerations.Handle("", api.APISessionRequired(getChannelModerations)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelModerations.Handle("/patch", api.APISessionRequired(patchChannelModerations)).Methods(http.MethodPut)
}

func createChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	var channel *model.Channel
	err := json.NewDecoder(r.Body).Decode(&channel)
	if err != nil || channel == nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	if channel.TeamId == "" {
		c.SetInvalidParamWithDetails("team_id", i18n.T("api.channel.create_channel.missing_team_id.error"))
		return
	}

	if channel.DisplayName == "" {
		c.SetInvalidParamWithDetails("display_name", i18n.T("api.channel.create_channel.missing_display_name.error"))
		return
	}

	auditRec := c.MakeAuditRecord("createChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "channel", channel)

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
	if err != nil || channel == nil {
		c.SetInvalidParamWithErr("channel", err)
		return
	}

	// The channel being updated in the payload must be the same one as indicated in the URL.
	if channel.Id != c.Params.ChannelId {
		c.SetInvalidParam("channel_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateChannel", audit.Fail)
	audit.AddEventParameterAuditable(auditRec, "channel", channel)
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
		if (channel.Name != "" && channel.Name != oldChannel.Name) || (channel.DisplayName != "" && channel.DisplayName != oldChannel.DisplayName) || (channel.Purpose != oldChannel.Purpose) {
			c.Err = model.NewAppError("updateChannel", "api.channel.update_channel.update_direct_or_group_messages_not_allowed.app_error", nil, "", http.StatusBadRequest)
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
		audit.AddEventParameter(auditRec, "new_channel_name", oldChannel.Name)
	}

	if channel.GroupConstrained != nil {
		oldChannel.GroupConstrained = channel.GroupConstrained
	}

	updatedChannel, appErr := c.App.UpdateChannel(c.AppContext, oldChannel)
	if appErr != nil {
		c.Err = appErr
		return
	}

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

	auditRec := c.MakeAuditRecord("updateChannelPrivacy", audit.Fail)
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
	defer c.LogAuditRec(auditRec)

	props := model.StringInterfaceFromJSON(r.Body)
	privacy, ok := props["privacy"].(string)
	if !ok || (model.ChannelType(privacy) != model.ChannelTypeOpen && model.ChannelType(privacy) != model.ChannelTypePrivate) {
		c.SetInvalidParam("privacy")
		return
	}

	audit.AddEventParameter(auditRec, "privacy", privacy)

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

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
	if err != nil || patch == nil {
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
	audit.AddEventParameterAuditable(auditRec, "channel", patch)
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
		if (patch.Name != nil && *patch.Name != oldChannel.Name) || (patch.DisplayName != nil && *patch.DisplayName != oldChannel.DisplayName) || (patch.Purpose != nil && *patch.Purpose != oldChannel.Purpose) {
			c.Err = model.NewAppError("patchChannel", "api.channel.patch_update_channel.update_direct_or_group_messages_not_allowed.app_error", nil, "", http.StatusBadRequest)
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamId, model.PermissionManageTeam) &&
		!c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementChannels) {
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
	userIds, err := model.NonSortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("createDirectChannel", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	allowed := false

	// single userId allowed if creating a self-channel
	// NonSortedArrayFromJSON will remove duplicates, so need to add back
	if len(userIds) == 1 && userIds[0] == c.AppContext.Session().UserId {
		userIds = append(userIds, userIds[0])
	}
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
	audit.AddEventParameter(auditRec, "user_ids", userIds)
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

	audit.AddEventParameter(auditRec, "user_id", otherUserId)

	canSee, appErr := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, otherUserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return
	}

	sc, appErr := c.App.GetOrCreateDirectChannel(c.AppContext, userIds[0], userIds[1])
	if appErr != nil {
		c.Err = appErr
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
	if err != nil || props == nil {
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
	userIds, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("createGroupChannel", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(userIds) == 0 {
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
	audit.AddEventParameter(auditRec, "user_ids", userIds)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateGroupChannel) {
		c.SetPermissionError(model.PermissionCreateGroupChannel)
		return
	}

	canSeeAll := true
	for _, id := range userIds {
		if c.AppContext.Session().UserId != id {
			canSee, err := c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, id)
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

	groupChannel, appErr := c.App.CreateGroupChannel(c.AppContext, userIds, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
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

func getChannelsMemberCount(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	channelIDs, sortErr := model.SortedArrayFromJSON(r.Body)
	if sortErr != nil {
		c.Err = model.NewAppError("getChannelsMemberCount", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(sortErr)
		return
	}

	channels, err := c.App.GetChannels(c.AppContext, channelIDs)
	if err != nil {
		c.Err = err
		return
	}

	for _, channel := range channels {
		if !c.App.HasPermissionToChannelMemberCount(c.AppContext, c.AppContext.Session().UserId, channel) {
			c.SetPermissionError(model.PermissionListTeamChannels)
			return
		}
	}

	channelsMemberCount, appErr := c.App.GetChannelsMemberCount(c.AppContext, channelIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(channelsMemberCount); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPinnedPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	if !c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel) {
		c.SetPermissionError(model.PermissionReadChannelContent)
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
		model.PermissionSysconsoleWriteUserManagementGroups,
		model.PermissionSysconsoleReadUserManagementChannels,
		model.PermissionSysconsoleReadComplianceDataRetentionPolicy,
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

	channels = sanitizeAllChannelsResponse(c, channels)

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

func sanitizeAllChannelsResponse(c *Context, channels model.ChannelListWithTeamData) model.ChannelListWithTeamData {
	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), []*model.Permission{
		model.PermissionSysconsoleReadComplianceDataRetentionPolicy,
		model.PermissionSysconsoleReadUserManagementChannels,
	}) {
		for _, channel := range channels {
			channel.Channel = channel.Channel.Sanitize()
		}
	}
	return channels
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

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		c.SetPermissionError(model.PermissionListTeamChannels)
		return
	}

	skipTeamMembershipCheck := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	channels, err := c.App.GetDeletedChannels(c.AppContext, c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage, c.AppContext.Session().UserId, skipTeamMembershipCheck)
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

	channelIds, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getPublicChannelsByIdsForTeam", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(channelIds) == 0 {
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

	channels, appErr := c.App.GetPublicChannelsByIdsForTeam(c.AppContext, c.Params.TeamId, channelIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	appErr = c.App.FillInChannelsProps(c.AppContext, channels)
	if appErr != nil {
		c.Err = appErr
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
	if _, err := w.Write([]byte(`[`)); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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
			if _, err := w.Write([]byte(`,`)); err != nil {
				c.Logger.Warn("Error while writing response", mlog.Err(err))
			}
		}

		for i, ch := range channels {
			if err := enc.Encode(ch); err != nil {
				c.Logger.Warn("Error while writing response", mlog.Err(err))
			}
			if i < len(channels)-1 {
				if _, err := w.Write([]byte(`,`)); err != nil {
					c.Logger.Warn("Error while writing response", mlog.Err(err))
				}
			}
		}

		if len(channels) < pageSize {
			break
		}

		fromChannelID = channels[len(channels)-1].Id
	}
	if _, err := w.Write([]byte(`]`)); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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
	if err != nil || props == nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	var channels model.ChannelList
	var appErr *model.AppError
	if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		channels, appErr = c.App.SearchChannels(c.AppContext, c.Params.TeamId, props.Term)
	} else {
		// If the user is not a team member, return a 404
		if _, appErr = c.App.GetTeamMember(c.AppContext, c.Params.TeamId, c.AppContext.Session().UserId); appErr != nil {
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
	if err != nil || props == nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	var channels model.ChannelList
	var appErr *model.AppError
	if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		channels, appErr = c.App.SearchArchivedChannels(c.AppContext, c.Params.TeamId, props.Term, c.AppContext.Session().UserId)
	} else {
		// If the user is not a team member, return a 404
		if _, appErr = c.App.GetTeamMember(c.AppContext, c.Params.TeamId, c.AppContext.Session().UserId); appErr != nil {
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
	if err != nil || props == nil {
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

	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(),
		[]*model.Permission{
			model.PermissionSysconsoleWriteUserManagementGroups,
			model.PermissionSysconsoleReadUserManagementChannels,
			model.PermissionSysconsoleReadComplianceDataRetentionPolicy,
		}) {
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
		ExcludeRemote:            props.ExcludeRemote,
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

	channels = sanitizeAllChannelsResponse(c, channels)

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
	audit.AddEventParameter(auditRec, "id", c.Params.ChannelId)
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

	if _, err := w.Write([]byte(model.ArrayToJSON(membersTimezones))); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getChannelMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	userIds, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("getChannelMembersByIds", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	members, appErr := c.App.GetChannelMembersByIds(c.AppContext, c.Params.ChannelId, userIds)
	if appErr != nil {
		c.Err = appErr
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

	c.AppContext = c.AppContext.With(app.RequestContextWithMaster)
	member, err := c.App.GetChannelMember(c.AppContext, c.Params.ChannelId, c.Params.UserId)
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

func readMultipleChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()

	channelIds, err := model.SortedArrayFromJSON(r.Body)
	if err != nil {
		c.Err = model.NewAppError("readMultipleChannels", model.PayloadParseError, nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if len(channelIds) == 0 {
		c.SetInvalidParam("channel_ids")
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	times, appErr := c.App.MarkChannelsAsViewed(c.AppContext, channelIds, c.Params.UserId, c.AppContext.Session().Id, true, c.App.IsCRTEnabledForUser(c.AppContext, c.Params.UserId))
	if appErr != nil {
		c.Err = appErr
		return
	}

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
	audit.AddEventParameter(auditRec, "props", props)
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)

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
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
	audit.AddEventParameterAuditable(auditRec, "roles", &schemeRoles)

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
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
	audit.AddEventParameter(auditRec, "props", props)

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

	var userIds []string
	interfaceIds, ok := props["user_ids"].([]any)
	if ok {
		if len(interfaceIds) > maxListSize {
			c.SetInvalidParam("user_ids")
			return
		}
		for _, userId := range interfaceIds {
			uid, isString := userId.(string)

			if !isString || !model.IsValidId(uid) {
				c.SetInvalidParam("user_id in user_ids")
				return
			}

			userIds = append(userIds, uid)
		}
	} else {
		userId, ok2 := props["user_id"].(string)
		if !ok2 || !model.IsValidId(userId) {
			c.SetInvalidParam("user_id or user_ids")
			return
		}
		userIds = append(userIds, userId)
	}

	postRootId, ok := props["post_root_id"].(string)
	if ok && postRootId != "" {
		if !model.IsValidId(postRootId) {
			c.SetInvalidParam("post_root_id")
			return
		}

		rootPost, err := c.App.GetSinglePost(c.AppContext, postRootId, false)
		if err != nil {
			c.Err = err
			return
		}
		if rootPost.ChannelId != c.Params.ChannelId {
			c.SetInvalidParam("post_root_id")
			return
		}
	} else if !ok {
		postRootId = ""
	}

	channel, err := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		c.Err = model.NewAppError("addUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	canAddSelf := false
	canAddOthers := false
	if channel.Type == model.ChannelTypeOpen {
		if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionJoinPublicChannels) {
			canAddSelf = true
		}
		if c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePublicChannelMembers) {
			canAddOthers = true
		}
	}

	if channel.Type == model.ChannelTypePrivate {
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channel.Id, model.PermissionManagePrivateChannelMembers) {
			c.SetPermissionError(model.PermissionManagePrivateChannelMembers)
			return
		}
	}

	if channel.IsGroupConstrained() {
		nonMembers, err := c.App.FilterNonGroupChannelMembers(userIds, channel)
		if err != nil {
			if v, ok2 := err.(*model.AppError); ok2 {
				c.Err = v
			} else {
				c.Err = model.NewAppError("addChannelMember", "api.channel.add_members.error", nil, "", http.StatusBadRequest).Wrap(err)
			}
			return
		}
		if len(nonMembers) > 0 {
			c.Err = model.NewAppError("addChannelMember", "api.channel.add_members.user_denied", map[string]any{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	var lastError *model.AppError
	var newChannelMembers []model.ChannelMember
	for _, userId := range userIds {
		if !model.IsValidId(userId) {
			c.Logger.Warn("Error adding channel member, invalid UserId", mlog.String("UserId", userId), mlog.String("ChannelId", channel.Id))
			c.SetInvalidParam("user_id")
			lastError = c.Err
			continue
		}

		auditRec := c.MakeAuditRecord("addChannelMember", audit.Fail)
		defer c.LogAuditRec(auditRec)
		audit.AddEventParameter(auditRec, "user_id", userId)
		audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
		audit.AddEventParameter(auditRec, "post_root_id", postRootId)

		member := &model.ChannelMember{
			ChannelId: c.Params.ChannelId,
			UserId:    userId,
		}

		existingMember, err := c.App.GetChannelMember(c.AppContext, member.ChannelId, member.UserId)
		if err != nil {
			if err.Id != app.MissingChannelMemberError {
				c.Logger.Warn("Error adding channel member, error getting channel member", mlog.String("UserId", userId), mlog.String("ChannelId", channel.Id), mlog.Err(err))
				lastError = err
				continue
			}
		} else {
			// user is already a member, go to next
			c.Logger.Warn("User is already a channel member, skipping", mlog.String("UserId", userId), mlog.String("ChannelId", channel.Id))
			newChannelMembers = append(newChannelMembers, *existingMember)
			continue
		}

		if channel.Type == model.ChannelTypeOpen {
			isSelfAdd := member.UserId == c.AppContext.Session().UserId
			if isSelfAdd && !canAddSelf {
				c.Logger.Warn("Error adding channel member, Invalid Permission to add self", mlog.String("UserId", userId), mlog.String("ChannelId", channel.Id))
				c.SetPermissionError(model.PermissionJoinPublicChannels)
				lastError = c.Err
				continue
			} else if !isSelfAdd && !canAddOthers {
				c.Logger.Warn("Error adding channel member, Invalid Permission to add others", mlog.String("UserId", userId), mlog.String("ChannelId", channel.Id))
				c.SetPermissionError(model.PermissionManagePublicChannelMembers)
				lastError = c.Err
				continue
			}
		}

		cm, err := c.App.AddChannelMember(c.AppContext, member.UserId, channel, app.ChannelMemberOpts{
			UserRequestorID: c.AppContext.Session().UserId,
			PostRootID:      postRootId,
		})
		if err != nil {
			c.Logger.Warn("Error adding channel member", mlog.String("UserId", userId), mlog.String("ChannelId", channel.Id), mlog.Err(err))
			lastError = err
			continue
		}
		newChannelMembers = append(newChannelMembers, *cm)

		if postRootId != "" {
			err := c.App.UpdateThreadFollowForUserFromChannelAdd(c.AppContext, cm.UserId, channel.TeamId, postRootId)
			if err != nil {
				c.Logger.Warn("Error adding channel member, error updating thread", mlog.String("UserId", userId), mlog.String("ChannelId", channel.Id), mlog.Err(err))
				lastError = err
				continue
			}
		}

		auditRec.Success()
		auditRec.AddEventResultState(cm)
		auditRec.AddEventObjectType("channel_member")
		auditRec.AddMeta("add_user_id", cm.UserId)
		c.LogAudit("name=" + channel.Name + " user_id=" + cm.UserId)
	}

	if lastError != nil && len(newChannelMembers) == 0 {
		c.Err = lastError
		return
	}

	w.WriteHeader(http.StatusCreated)
	userId, ok := props["user_id"]
	if ok && len(newChannelMembers) == 1 && newChannelMembers[0].UserId == userId {
		if err := json.NewEncoder(w).Encode(newChannelMembers[0]); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
	} else {
		if err := json.NewEncoder(w).Encode(newChannelMembers); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
	}
}

func removeChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("removeChannelMember", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
	audit.AddEventParameter(auditRec, "user_id", c.Params.UserId)

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

	auditRec := c.MakeAuditRecord("updateChannelScheme", audit.Fail)
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
	defer c.LogAuditRec(auditRec)

	var p model.SchemeIDPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&p); jsonErr != nil || p.SchemeID == nil || !model.IsValidId(*p.SchemeID) {
		c.SetInvalidParamWithErr("scheme_id", jsonErr)
		return
	}
	schemeID := p.SchemeID

	audit.AddEventParameter(auditRec, "scheme_id", *schemeID)

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

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	channelMemberCounts, appErr := c.App.GetMemberCountsByGroup(c.AppContext.With(app.RequestContextWithMaster), c.Params.ChannelId, includeTimezones)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(channelMemberCounts)
	if err != nil {
		c.Err = model.NewAppError("Api4.channelMemberCountsByGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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
	audit.AddEventParameterAuditable(auditRec, "channel", channel)

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
	audit.AddEventParameterAuditableArray(auditRec, "channel_moderations_patch", channelModerationsPatch)

	b, err := json.Marshal(channelModerations)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchChannelModerations", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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
	audit.AddEventParameter(auditRec, "channel_id", c.Params.ChannelId)
	audit.AddEventParameter(auditRec, "team_id", teamId)
	audit.AddEventParameter(auditRec, "force", force)
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

func getGroupMessageMembersCommonTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	user, err := c.App.GetUser(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}
	if user.IsGuest() {
		c.Err = model.NewAppError("Api4.getGroupMessageMembersCommonTeams", "api.channel.gm_to_channel_conversion.not_allowed_for_user.request_error", nil, "userId="+c.AppContext.Session().UserId, http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, model.PermissionReadChannel) {
		c.SetPermissionError(model.PermissionReadChannel)
		return
	}

	teams, appErr := c.App.GetGroupMessageMembersCommonTeams(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(teams); err != nil {
		c.Logger.Warn("Error while writing response from getGroupMessageMembersCommonTeams", mlog.Err(err))
	}
}

func convertGroupMessageToChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var gmConversionRequest *model.GroupMessageConversionRequestBody
	if err := json.NewDecoder(r.Body).Decode(&gmConversionRequest); err != nil || gmConversionRequest == nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}

	user, err := c.App.GetUser(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}
	if user.IsGuest() {
		c.Err = model.NewAppError("Api4.convertGroupMessageToChannel", "api.channel.gm_to_channel_conversion.not_allowed_for_user.request_error", nil, "userId="+c.AppContext.Session().UserId, http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), gmConversionRequest.TeamID, model.PermissionCreatePrivateChannel) {
		c.SetPermissionError(model.PermissionCreatePrivateChannel)
		return
	}

	// The channel id the payload must be the same one as indicated in the URL.
	if gmConversionRequest.ChannelID != c.Params.ChannelId {
		c.SetInvalidParam("channel_id")
		return
	}

	auditRec := c.MakeAuditRecord("convertGroupMessageToChannel", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "channel_id", gmConversionRequest.ChannelID)
	audit.AddEventParameter(auditRec, "team_id", gmConversionRequest.TeamID)
	audit.AddEventParameter(auditRec, "user_id", user.Id)

	updatedChannel, appErr := c.App.ConvertGroupMessageToChannel(c.AppContext, c.AppContext.Session().UserId, gmConversionRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	if err := json.NewEncoder(w).Encode(updatedChannel); err != nil {
		c.Logger.Warn("Error while writing response from convertGroupMessageToChannel", mlog.Err(err))
	}
}
