// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitChannel() {
	api.BaseRoutes.Channels.Handle("", api.ApiSessionRequired(createChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/direct", api.ApiSessionRequired(createDirectChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/group", api.ApiSessionRequired(createGroupChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/members/{user_id:[A-Za-z0-9]+}/view", api.ApiSessionRequired(viewChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/scheme", api.ApiSessionRequired(updateChannelScheme)).Methods("PUT")

	api.BaseRoutes.ChannelsForTeam.Handle("", api.ApiSessionRequired(getPublicChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/deleted", api.ApiSessionRequired(getDeletedChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/ids", api.ApiSessionRequired(getPublicChannelsByIdsForTeam)).Methods("POST")
	api.BaseRoutes.ChannelsForTeam.Handle("/search", api.ApiSessionRequired(searchChannelsForTeam)).Methods("POST")
	api.BaseRoutes.ChannelsForTeam.Handle("/autocomplete", api.ApiSessionRequired(autocompleteChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/search_autocomplete", api.ApiSessionRequired(autocompleteChannelsForTeamForSearch)).Methods("GET")
	api.BaseRoutes.User.Handle("/teams/{team_id:[A-Za-z0-9]+}/channels", api.ApiSessionRequired(getChannelsForTeamForUser)).Methods("GET")

	api.BaseRoutes.Channel.Handle("", api.ApiSessionRequired(getChannel)).Methods("GET")
	api.BaseRoutes.Channel.Handle("", api.ApiSessionRequired(updateChannel)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/patch", api.ApiSessionRequired(patchChannel)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/convert", api.ApiSessionRequired(convertChannelToPrivate)).Methods("POST")
	api.BaseRoutes.Channel.Handle("/restore", api.ApiSessionRequired(restoreChannel)).Methods("POST")
	api.BaseRoutes.Channel.Handle("", api.ApiSessionRequired(deleteChannel)).Methods("DELETE")
	api.BaseRoutes.Channel.Handle("/stats", api.ApiSessionRequired(getChannelStats)).Methods("GET")
	api.BaseRoutes.Channel.Handle("/pinned", api.ApiSessionRequired(getPinnedPosts)).Methods("GET")

	api.BaseRoutes.ChannelForUser.Handle("/unread", api.ApiSessionRequired(getChannelUnread)).Methods("GET")

	api.BaseRoutes.ChannelByName.Handle("", api.ApiSessionRequired(getChannelByName)).Methods("GET")
	api.BaseRoutes.ChannelByNameForTeamName.Handle("", api.ApiSessionRequired(getChannelByNameForTeamName)).Methods("GET")

	api.BaseRoutes.ChannelMembers.Handle("", api.ApiSessionRequired(getChannelMembers)).Methods("GET")
	api.BaseRoutes.ChannelMembers.Handle("/ids", api.ApiSessionRequired(getChannelMembersByIds)).Methods("POST")
	api.BaseRoutes.ChannelMembers.Handle("", api.ApiSessionRequired(addChannelMember)).Methods("POST")
	api.BaseRoutes.ChannelMembersForUser.Handle("", api.ApiSessionRequired(getChannelMembersForUser)).Methods("GET")
	api.BaseRoutes.ChannelMember.Handle("", api.ApiSessionRequired(getChannelMember)).Methods("GET")
	api.BaseRoutes.ChannelMember.Handle("", api.ApiSessionRequired(removeChannelMember)).Methods("DELETE")
	api.BaseRoutes.ChannelMember.Handle("/roles", api.ApiSessionRequired(updateChannelMemberRoles)).Methods("PUT")
	api.BaseRoutes.ChannelMember.Handle("/schemeRoles", api.ApiSessionRequired(updateChannelMemberSchemeRoles)).Methods("PUT")
	api.BaseRoutes.ChannelMember.Handle("/notify_props", api.ApiSessionRequired(updateChannelMemberNotifyProps)).Methods("PUT")
}

func createChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channel := model.ChannelFromJson(r.Body)
	if channel == nil {
		c.SetInvalidParam("channel")
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_CREATE_PUBLIC_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_PUBLIC_CHANNEL)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_CREATE_PRIVATE_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_PRIVATE_CHANNEL)
		return
	}

	sc, err := c.App.CreateChannelWithUser(channel, c.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name)
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(sc.ToJson()))
}

func updateChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel := model.ChannelFromJson(r.Body)

	if channel == nil {
		c.SetInvalidParam("channel")
		return
	}

	// The channel being updated in the payload must be the same one as indicated in the URL.
	if channel.Id != c.Params.ChannelId {
		c.SetInvalidParam("channel_id")
		return
	}

	var oldChannel *model.Channel
	if originalOldChannel, err := c.App.GetChannel(channel.Id); err != nil {
		c.Err = err
		return
	} else {
		oldChannel = originalOldChannel.DeepCopy()
	}

	switch oldChannel.Type {
	case model.CHANNEL_OPEN:
		if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES)
			return
		}

	case model.CHANNEL_PRIVATE:
		if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES)
			return
		}

	case model.CHANNEL_GROUP, model.CHANNEL_DIRECT:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		if _, err := c.App.GetChannelMember(channel.Id, c.Session.UserId); err != nil {
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

	if oldChannel.Name == model.DEFAULT_CHANNEL {
		if (len(channel.Name) > 0 && channel.Name != oldChannel.Name) || (len(channel.Type) > 0 && channel.Type != oldChannel.Type) {
			c.Err = model.NewAppError("updateChannel", "api.channel.update_channel.tried.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "", http.StatusBadRequest)
			return
		}
	}

	oldChannel.Header = channel.Header
	oldChannel.Purpose = channel.Purpose

	oldChannelDisplayName := oldChannel.DisplayName

	if len(channel.DisplayName) > 0 {
		oldChannel.DisplayName = channel.DisplayName
	}

	if len(channel.Name) > 0 {
		oldChannel.Name = channel.Name
	}

	if len(channel.Type) > 0 {
		oldChannel.Type = channel.Type
	}

	if _, err := c.App.UpdateChannel(oldChannel); err != nil {
		c.Err = err
		return
	}

	if oldChannelDisplayName != channel.DisplayName {
		if err := c.App.PostUpdateChannelDisplayNameMessage(c.Session.UserId, channel, oldChannelDisplayName, channel.DisplayName); err != nil {
			mlog.Error(err.Error())
		}
	}

	c.LogAudit("name=" + channel.Name)
	w.Write([]byte(oldChannel.ToJson()))
}

func convertChannelToPrivate(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	oldPublicChannel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, oldPublicChannel.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	if oldPublicChannel.Type == model.CHANNEL_PRIVATE {
		c.Err = model.NewAppError("convertChannelToPrivate", "api.channel.convert_channel_to_private.private_channel_error", nil, "", http.StatusBadRequest)
		return
	}

	if oldPublicChannel.Name == model.DEFAULT_CHANNEL {
		c.Err = model.NewAppError("convertChannelToPrivate", "api.channel.convert_channel_to_private.default_channel_error", nil, "", http.StatusBadRequest)
		return
	}

	var user *model.User
	if user, err = c.App.GetUser(c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	oldPublicChannel.Type = model.CHANNEL_PRIVATE

	rchannel, err := c.App.UpdateChannelPrivacy(oldPublicChannel, user)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + rchannel.Name)
	w.Write([]byte(rchannel.ToJson()))
}

func patchChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	patch := model.ChannelPatchFromJson(r.Body)
	if patch == nil {
		c.SetInvalidParam("channel")
		return
	}

	var oldChannel *model.Channel
	if originalOldChannel, err := c.App.GetChannel(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	} else {
		oldChannel = originalOldChannel.DeepCopy()
	}

	switch oldChannel.Type {
	case model.CHANNEL_OPEN:
		if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES)
			return
		}

	case model.CHANNEL_PRIVATE:
		if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES)
			return
		}

	case model.CHANNEL_GROUP, model.CHANNEL_DIRECT:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		if _, err := c.App.GetChannelMember(c.Params.ChannelId, c.Session.UserId); err != nil {
			c.Err = model.NewAppError("patchChannel", "api.channel.patch_update_channel.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("patchChannel", "api.channel.patch_update_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	rchannel, err := c.App.PatchChannel(oldChannel, patch, c.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.FillInChannelProps(rchannel)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	w.Write([]byte(rchannel.ToJson()))
}

func restoreChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	}
	teamId := channel.TeamId

	if !c.App.SessionHasPermissionToTeam(c.Session, teamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	channel, err = c.App.RestoreChannel(channel)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name)
	w.Write([]byte(channel.ToJson()))

}

func createDirectChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)
	allowed := false

	if len(userIds) != 2 {
		c.SetInvalidParam("user_ids")
		return
	}

	for _, id := range userIds {
		if len(id) != 26 {
			c.SetInvalidParam("user_id")
			return
		}
		if id == c.Session.UserId {
			allowed = true
		}
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_DIRECT_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_DIRECT_CHANNEL)
		return
	}

	if !allowed && !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	sc, err := c.App.CreateDirectChannel(userIds[0], userIds[1])
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(sc.ToJson()))
}

func createGroupChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	found := false
	for _, id := range userIds {
		if len(id) != 26 {
			c.SetInvalidParam("user_id")
			return
		}
		if id == c.Session.UserId {
			found = true
		}
	}

	if !found {
		userIds = append(userIds, c.Session.UserId)
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_GROUP_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_GROUP_CHANNEL)
		return
	}

	groupChannel, err := c.App.CreateGroupChannel(userIds, c.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(groupChannel.ToJson()))
}

func getChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN {
		if !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	err = c.App.FillInChannelProps(channel)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channel.ToJson()))
}

func getChannelUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	channelUnread, err := c.App.GetChannelUnread(c.Params.ChannelId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channelUnread.ToJson()))
}

func getChannelStats(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	memberCount, err := c.App.GetChannelMemberCount(c.Params.ChannelId)

	if err != nil {
		c.Err = err
		return
	}

	stats := model.ChannelStats{ChannelId: c.Params.ChannelId, MemberCount: memberCount}
	w.Write([]byte(stats.ToJson()))
}

func getPinnedPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	posts, err := c.App.GetPinnedPosts(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(posts.Etag(), "Get Pinned Posts", w, r) {
		return
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, posts.Etag())
	w.Write([]byte(c.App.PostListWithProxyAddedToImageURLs(posts).ToJson()))
}

func getPublicChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	channels, err := c.App.GetPublicChannelsForTeam(c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.FillInChannelsProps(channels)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channels.ToJson()))
}

func getDeletedChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	channels, err := c.App.GetDeletedChannels(c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.FillInChannelsProps(channels)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channels.ToJson()))
}

func getPublicChannelsByIdsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	channelIds := model.ArrayFromJson(r.Body)
	if len(channelIds) == 0 {
		c.SetInvalidParam("channel_ids")
		return
	}

	for _, cid := range channelIds {
		if len(cid) != 26 {
			c.SetInvalidParam("channel_id")
			return
		}
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	channels, err := c.App.GetPublicChannelsByIdsForTeam(c.Params.TeamId, channelIds)
	if err != nil {
		c.Err = err
		return
	}

	err = c.App.FillInChannelsProps(channels)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channels.ToJson()))
}

func getChannelsForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	channels, err := c.App.GetChannelsForUser(c.Params.TeamId, c.Params.UserId, false)
	if err != nil {
		c.Err = err
		return
	}

	if c.HandleEtag(channels.Etag(), "Get Channels", w, r) {
		return
	}

	err = c.App.FillInChannelsProps(channels)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, channels.Etag())
	w.Write([]byte(channels.ToJson()))
}

func autocompleteChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	name := r.URL.Query().Get("name")

	channels, err := c.App.AutocompleteChannels(c.Params.TeamId, name)
	if err != nil {
		c.Err = err
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	w.Write([]byte(channels.ToJson()))
}

func autocompleteChannelsForTeamForSearch(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	name := r.URL.Query().Get("name")

	channels, err := c.App.AutocompleteChannelsForSearch(c.Params.TeamId, c.Session.UserId, name)
	if err != nil {
		c.Err = err
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	w.Write([]byte(channels.ToJson()))
}

func searchChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	props := model.ChannelSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("channel_search")
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	channels, err := c.App.SearchChannels(c.Params.TeamId, props.Term)
	if err != nil {
		c.Err = err
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	w.Write([]byte(channels.ToJson()))
}

func deleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_DIRECT || channel.Type == model.CHANNEL_GROUP {
		c.Err = model.NewAppError("deleteChannel", "api.channel.delete_channel.type.invalid", nil, "", http.StatusBadRequest)
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_DELETE_PUBLIC_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_DELETE_PUBLIC_CHANNEL)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_DELETE_PRIVATE_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_DELETE_PRIVATE_CHANNEL)
		return
	}

	err = c.App.DeleteChannel(channel, c.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name)

	ReturnStatusOK(w)
}

func getChannelByName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireChannelName()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	var err *model.AppError

	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	if channel, err = c.App.GetChannelByName(c.Params.ChannelName, c.Params.TeamId, includeDeleted); err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN {
		if !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	err = c.App.FillInChannelProps(channel)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channel.ToJson()))
}

func getChannelByNameForTeamName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamName().RequireChannelName()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	var err *model.AppError

	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	if channel, err = c.App.GetChannelByNameForTeamName(c.Params.ChannelName, c.Params.TeamName, includeDeleted); err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	err = c.App.FillInChannelProps(channel)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channel.ToJson()))
}

func getChannelMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	members, err := c.App.GetChannelMembersPage(c.Params.ChannelId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(members.ToJson()))
}

func getChannelMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	userIds := model.ArrayFromJson(r.Body)
	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	members, err := c.App.GetChannelMembersByIds(c.Params.ChannelId, userIds)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(members.ToJson()))
}

func getChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	member, err := c.App.GetChannelMember(c.Params.ChannelId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(member.ToJson()))
}

func getChannelMembersForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if c.Session.UserId != c.Params.UserId && !c.App.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	members, err := c.App.GetChannelMembersForUser(c.Params.TeamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(members.ToJson()))
}

func viewChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	view := model.ChannelViewFromJson(r.Body)
	if view == nil {
		c.SetInvalidParam("channel_view")
		return
	}

	times, err := c.App.ViewChannel(view, c.Params.UserId, !c.Session.IsMobileApp())

	if err != nil {
		c.Err = err
		return
	}

	c.App.UpdateLastActivityAtIfNeeded(c.Session)

	// Returning {"status": "OK", ...} for backwards compatibility
	resp := &model.ChannelViewResponse{
		Status:            "OK",
		LastViewedAtTimes: times,
	}

	w.Write([]byte(resp.ToJson()))
}

func updateChannelMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJson(r.Body)

	newRoles := props["roles"]
	if !(model.IsValidUserRoles(newRoles)) {
		c.SetInvalidParam("roles")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_CHANNEL_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_CHANNEL_ROLES)
		return
	}

	if _, err := c.App.UpdateChannelMemberRoles(c.Params.ChannelId, c.Params.UserId, newRoles); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func updateChannelMemberSchemeRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	schemeRoles := model.SchemeRolesFromJson(r.Body)
	if schemeRoles == nil {
		c.SetInvalidParam("scheme_roles")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_CHANNEL_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_CHANNEL_ROLES)
		return
	}

	if _, err := c.App.UpdateChannelMemberSchemeRoles(c.Params.ChannelId, c.Params.UserId, schemeRoles.SchemeUser, schemeRoles.SchemeAdmin); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func updateChannelMemberNotifyProps(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("notify_props")
		return
	}

	if !c.App.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	_, err := c.App.UpdateChannelMemberNotifyProps(props, c.Params.ChannelId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func addChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJson(r.Body)
	userId, ok := props["user_id"].(string)
	if !ok || len(userId) != 26 {
		c.SetInvalidParam("user_id")
		return
	}

	member := &model.ChannelMember{
		ChannelId: c.Params.ChannelId,
		UserId:    userId,
	}

	postRootId, ok := props["post_root_id"].(string)
	if ok && len(postRootId) != 0 && len(postRootId) != 26 {
		c.SetInvalidParam("post_root_id")
		return
	}

	var err *model.AppError
	if ok && len(postRootId) == 26 {
		rootPost, err := c.App.GetSinglePost(postRootId)
		if err != nil {
			c.Err = err
			return
		}
		if rootPost.ChannelId != member.ChannelId {
			c.SetInvalidParam("post_root_id")
			return
		}
	}

	var channel *model.Channel
	if channel, err = c.App.GetChannel(member.ChannelId); err != nil {
		c.Err = err
		return
	}

	// Check join permission if adding yourself, otherwise check manage permission
	if channel.Type == model.CHANNEL_OPEN {
		if member.UserId == c.Session.UserId {
			if !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
				c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_CHANNELS)
				return
			}
		} else {
			if !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
				c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
				return
			}
		}
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
		return
	}

	if channel.Type == model.CHANNEL_DIRECT || channel.Type == model.CHANNEL_GROUP {
		c.Err = model.NewAppError("addUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	cm, err := c.App.AddChannelMember(member.UserId, channel, c.Session.UserId, postRootId, !c.Session.IsMobileApp())
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name + " user_id=" + cm.UserId)
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(cm.ToJson()))
}

func removeChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	}

	if !(channel.Type == model.CHANNEL_OPEN || channel.Type == model.CHANNEL_PRIVATE) {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_channel_member.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if c.Params.UserId != c.Session.UserId {
		if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
			return
		}

		if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
			return
		}
	}

	if err = c.App.RemoveUserFromChannel(c.Params.UserId, c.Session.UserId, channel); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name + " user_id=" + c.Params.UserId)

	ReturnStatusOK(w)
}

func updateChannelScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	schemeID := model.SchemeIDFromJson(r.Body)
	if schemeID == nil || len(*schemeID) != 26 {
		c.SetInvalidParam("scheme_id")
		return
	}

	if c.App.License() == nil {
		c.Err = model.NewAppError("Api4.UpdateChannelScheme", "api.channel.update_channel_scheme.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	scheme, err := c.App.GetScheme(*schemeID)
	if err != nil {
		c.Err = err
		return
	}

	if scheme.Scope != model.SCHEME_SCOPE_CHANNEL {
		c.Err = model.NewAppError("Api4.UpdateChannelScheme", "api.channel.update_channel_scheme.scheme_scope.error", nil, "", http.StatusBadRequest)
		return
	}

	channel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	channel.SchemeId = &scheme.Id

	_, err = c.App.UpdateChannelScheme(channel)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
