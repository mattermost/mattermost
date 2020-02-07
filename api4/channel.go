// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func (api *API) InitChannel() {
	api.BaseRoutes.Channels.Handle("", api.ApiSessionRequired(getAllChannels)).Methods("GET")
	api.BaseRoutes.Channels.Handle("", api.ApiSessionRequired(createChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/direct", api.ApiSessionRequired(createDirectChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/search", api.ApiSessionRequiredDisableWhenBusy(searchAllChannels)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/group/search", api.ApiSessionRequiredDisableWhenBusy(searchGroupChannels)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/group", api.ApiSessionRequired(createGroupChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/members/{user_id:[A-Za-z0-9]+}/view", api.ApiSessionRequired(viewChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/scheme", api.ApiSessionRequired(updateChannelScheme)).Methods("PUT")

	api.BaseRoutes.ChannelsForTeam.Handle("", api.ApiSessionRequired(getPublicChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/deleted", api.ApiSessionRequired(getDeletedChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/ids", api.ApiSessionRequired(getPublicChannelsByIdsForTeam)).Methods("POST")
	api.BaseRoutes.ChannelsForTeam.Handle("/search", api.ApiSessionRequiredDisableWhenBusy(searchChannelsForTeam)).Methods("POST")
	api.BaseRoutes.ChannelsForTeam.Handle("/search_archived", api.ApiSessionRequiredDisableWhenBusy(searchArchivedChannelsForTeam)).Methods("POST")
	api.BaseRoutes.ChannelsForTeam.Handle("/autocomplete", api.ApiSessionRequired(autocompleteChannelsForTeam)).Methods("GET")
	api.BaseRoutes.ChannelsForTeam.Handle("/search_autocomplete", api.ApiSessionRequired(autocompleteChannelsForTeamForSearch)).Methods("GET")
	api.BaseRoutes.User.Handle("/teams/{team_id:[A-Za-z0-9]+}/channels", api.ApiSessionRequired(getChannelsForTeamForUser)).Methods("GET")

	api.BaseRoutes.Channel.Handle("", api.ApiSessionRequired(getChannel)).Methods("GET")
	api.BaseRoutes.Channel.Handle("", api.ApiSessionRequired(updateChannel)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/patch", api.ApiSessionRequired(patchChannel)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/convert", api.ApiSessionRequired(convertChannelToPrivate)).Methods("POST")
	api.BaseRoutes.Channel.Handle("/privacy", api.ApiSessionRequired(updateChannelPrivacy)).Methods("PUT")
	api.BaseRoutes.Channel.Handle("/restore", api.ApiSessionRequired(restoreChannel)).Methods("POST")
	api.BaseRoutes.Channel.Handle("", api.ApiSessionRequired(deleteChannel)).Methods("DELETE")
	api.BaseRoutes.Channel.Handle("/stats", api.ApiSessionRequired(getChannelStats)).Methods("GET")
	api.BaseRoutes.Channel.Handle("/pinned", api.ApiSessionRequired(getPinnedPosts)).Methods("GET")
	api.BaseRoutes.Channel.Handle("/timezones", api.ApiSessionRequired(getChannelMembersTimezones)).Methods("GET")
	api.BaseRoutes.Channel.Handle("/members_minus_group_members", api.ApiSessionRequired(channelMembersMinusGroupMembers)).Methods("GET")
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

	if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToTeam(c.App.Session, channel.TeamId, model.PERMISSION_CREATE_PUBLIC_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_PUBLIC_CHANNEL)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToTeam(c.App.Session, channel.TeamId, model.PERMISSION_CREATE_PRIVATE_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_PRIVATE_CHANNEL)
		return
	}

	sc, err := c.App.CreateChannelWithUser(channel, c.App.Session.UserId)
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

	originalOldChannel, err := c.App.GetChannel(channel.Id)
	if err != nil {
		c.Err = err
		return
	}
	oldChannel := originalOldChannel.DeepCopy()

	switch oldChannel.Type {
	case model.CHANNEL_OPEN:
		if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES)
			return
		}

	case model.CHANNEL_PRIVATE:
		if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES)
			return
		}

	case model.CHANNEL_GROUP, model.CHANNEL_DIRECT:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		if _, err := c.App.GetChannelMember(channel.Id, c.App.Session.UserId); err != nil {
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

	if len(channel.Type) > 0 && channel.Type != oldChannel.Type {
		c.Err = model.NewAppError("updateChannel", "api.channel.update_channel.typechange.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if oldChannel.Name == model.DEFAULT_CHANNEL {
		if len(channel.Name) > 0 && channel.Name != oldChannel.Name {
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

	if channel.GroupConstrained != nil {
		oldChannel.GroupConstrained = channel.GroupConstrained
	}

	if _, err := c.App.UpdateChannel(oldChannel); err != nil {
		c.Err = err
		return
	}

	if oldChannelDisplayName != channel.DisplayName {
		if err := c.App.PostUpdateChannelDisplayNameMessage(c.App.Session.UserId, channel, oldChannelDisplayName, channel.DisplayName); err != nil {
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

	if !c.App.SessionHasPermissionToTeam(c.App.Session, oldPublicChannel.TeamId, model.PERMISSION_MANAGE_TEAM) {
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

	user, err := c.App.GetUser(c.App.Session.UserId)
	if err != nil {
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

func updateChannelPrivacy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJson(r.Body)
	privacy, ok := props["privacy"].(string)
	if !ok || (privacy != model.CHANNEL_OPEN && privacy != model.CHANNEL_PRIVATE) {
		c.SetInvalidParam("privacy")
		return
	}

	channel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.App.Session, channel.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	if channel.Name == model.DEFAULT_CHANNEL && privacy == model.CHANNEL_PRIVATE {
		c.Err = model.NewAppError("updateChannelPrivacy", "api.channel.update_channel_privacy.default_channel_error", nil, "", http.StatusBadRequest)
		return
	}

	user, err := c.App.GetUser(c.App.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	channel.Type = privacy

	updatedChannel, err := c.App.UpdateChannelPrivacy(channel, user)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + updatedChannel.Name)

	w.Write([]byte(updatedChannel.ToJson()))
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

	originalOldChannel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	oldChannel := originalOldChannel.DeepCopy()

	switch oldChannel.Type {
	case model.CHANNEL_OPEN:
		if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES)
			return
		}

	case model.CHANNEL_PRIVATE:
		if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES)
			return
		}

	case model.CHANNEL_GROUP, model.CHANNEL_DIRECT:
		// Modifying the header is not linked to any specific permission for group/dm channels, so just check for membership.
		if _, err = c.App.GetChannelMember(c.Params.ChannelId, c.App.Session.UserId); err != nil {
			c.Err = model.NewAppError("patchChannel", "api.channel.patch_update_channel.forbidden.app_error", nil, "", http.StatusForbidden)
			return
		}

	default:
		c.Err = model.NewAppError("patchChannel", "api.channel.patch_update_channel.forbidden.app_error", nil, "", http.StatusForbidden)
		return
	}

	rchannel, err := c.App.PatchChannel(oldChannel, patch, c.App.Session.UserId)
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

	channel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	teamId := channel.TeamId

	if !c.App.SessionHasPermissionToTeam(c.App.Session, teamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	channel, err = c.App.RestoreChannel(channel, c.App.Session.UserId)
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
		if id == c.App.Session.UserId {
			allowed = true
		}
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_CREATE_DIRECT_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_DIRECT_CHANNEL)
		return
	}

	if !allowed && !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	otherUserId := userIds[0]
	if c.App.Session.UserId == otherUserId {
		otherUserId = userIds[1]
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session.UserId, otherUserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	sc, err := c.App.GetOrCreateDirectChannel(userIds[0], userIds[1])
	if err != nil {
		c.Err = err
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(sc.ToJson()))
}

func searchGroupChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.ChannelSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("channel_search")
		return
	}

	groupChannels, err := c.App.SearchGroupChannels(c.App.Session.UserId, props.Term)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(groupChannels.ToJson()))
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
		if id == c.App.Session.UserId {
			found = true
		}
	}

	if !found {
		userIds = append(userIds, c.App.Session.UserId)
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_CREATE_GROUP_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_GROUP_CHANNEL)
		return
	}

	canSeeAll := true
	for _, id := range userIds {
		if c.App.Session.UserId != id {
			canSee, err := c.App.UserCanSeeOtherUser(c.App.Session.UserId, id)
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
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	groupChannel, err := c.App.CreateGroupChannel(userIds, c.App.Session.UserId)
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
		if !c.App.SessionHasPermissionToTeam(c.App.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) && !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
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

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
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

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	memberCount, err := c.App.GetChannelMemberCount(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	guestCount, err := c.App.GetChannelGuestCount(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	pinnedPostCount, err := c.App.GetChannelPinnedPostCount(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	stats := model.ChannelStats{ChannelId: c.Params.ChannelId, MemberCount: memberCount, GuestCount: guestCount, PinnedPostCount: pinnedPostCount}
	w.Write([]byte(stats.ToJson()))
}

func getPinnedPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
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

	clientPostList := c.App.PreparePostListForClient(posts)

	w.Header().Set(model.HEADER_ETAG_SERVER, clientPostList.Etag())
	w.Write([]byte(clientPostList.ToJson()))
}

func getAllChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	opts := model.ChannelSearchOpts{
		NotAssociatedToGroup:   c.Params.NotAssociatedToGroup,
		ExcludeDefaultChannels: c.Params.ExcludeDefaultChannels,
	}

	channels, err := c.App.GetAllChannels(c.Params.Page, c.Params.PerPage, opts)
	if err != nil {
		c.Err = err
		return
	}

	var payload []byte
	if c.Params.IncludeTotalCount {
		totalCount, err := c.App.GetAllChannelsCount(opts)
		if err != nil {
			c.Err = err
			return
		}
		cwc := &model.ChannelsWithCount{
			Channels:   channels,
			TotalCount: totalCount,
		}
		payload = cwc.ToJson()
	} else {
		payload = []byte(channels.ToJson())
	}

	w.Write(payload)
}

func getPublicChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
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

	channels, err := c.App.GetDeletedChannels(c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage, c.App.Session.UserId)
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

	if !c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
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

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if !c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
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

	if !c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
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

	if !c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	name := r.URL.Query().Get("name")

	channels, err := c.App.AutocompleteChannelsForSearch(c.Params.TeamId, c.App.Session.UserId, name)
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

	var channels *model.ChannelList
	var err *model.AppError
	if c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		channels, err = c.App.SearchChannels(c.Params.TeamId, props.Term)
	} else {
		// If the user is not a team member, return a 404
		if _, err = c.App.GetTeamMember(c.Params.TeamId, c.App.Session.UserId); err != nil {
			c.Err = err
			return
		}

		channels, err = c.App.SearchChannelsForUser(c.App.Session.UserId, c.Params.TeamId, props.Term)
	}

	if err != nil {
		c.Err = err
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	w.Write([]byte(channels.ToJson()))
}

func searchArchivedChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	props := model.ChannelSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("channel_search")
		return
	}

	var channels *model.ChannelList
	var err *model.AppError
	if c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		channels, err = c.App.SearchArchivedChannels(c.Params.TeamId, props.Term, c.App.Session.UserId)
	} else {
		// If the user is not a team member, return a 404
		if _, err = c.App.GetTeamMember(c.Params.TeamId, c.App.Session.UserId); err != nil {
			c.Err = err
			return
		}

		channels, err = c.App.SearchArchivedChannels(c.Params.TeamId, props.Term, c.App.Session.UserId)
	}

	if err != nil {
		c.Err = err
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	w.Write([]byte(channels.ToJson()))
}

func searchAllChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.ChannelSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("channel_search")
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	opts := model.ChannelSearchOpts{
		NotAssociatedToGroup:   props.NotAssociatedToGroup,
		ExcludeDefaultChannels: props.ExcludeDefaultChannels,
		IncludeDeleted:         r.URL.Query().Get("include_deleted") == "true",
		Page:                   props.Page,
		PerPage:                props.PerPage,
	}

	channels, totalCount, err := c.App.SearchAllChannels(props.Term, opts)
	if err != nil {
		c.Err = err
		return
	}

	// Don't fill in channels props, since unused by client and potentially expensive.

	var payload []byte

	if props.Page != nil && props.PerPage != nil {
		data := model.ChannelsWithCount{Channels: channels, TotalCount: totalCount}
		payload = data.ToJson()
	} else {
		payload = []byte(channels.ToJson())
	}

	w.Write(payload)
}

func deleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_DIRECT || channel.Type == model.CHANNEL_GROUP {
		c.Err = model.NewAppError("deleteChannel", "api.channel.delete_channel.type.invalid", nil, "", http.StatusBadRequest)
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_DELETE_PUBLIC_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_DELETE_PUBLIC_CHANNEL)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_DELETE_PRIVATE_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_DELETE_PRIVATE_CHANNEL)
		return
	}

	err = c.App.DeleteChannel(channel, c.App.Session.UserId)
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

	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	channel, err := c.App.GetChannelByName(c.Params.ChannelName, c.Params.TeamId, includeDeleted)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN {
		if !c.App.SessionHasPermissionToTeam(c.App.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) && !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
			c.Err = model.NewAppError("getChannelByName", store.MISSING_CHANNEL_ERROR, nil, "teamId="+channel.TeamId+", "+"name="+channel.Name+"", http.StatusNotFound)
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

	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	channel, err := c.App.GetChannelByNameForTeamName(c.Params.ChannelName, c.Params.TeamName, includeDeleted)
	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.Err = model.NewAppError("getChannelByNameForTeamName", store.MISSING_CHANNEL_ERROR, nil, "teamId="+channel.TeamId+", "+"name="+channel.Name+"", http.StatusNotFound)
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

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
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

func getChannelMembersTimezones(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	membersTimezones, err := c.App.GetChannelMembersTimezones(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.ArrayToJson(membersTimezones)))
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

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
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

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
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

	if !c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if c.App.Session.UserId != c.Params.UserId && !c.App.SessionHasPermissionToTeam(c.App.Session, c.Params.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
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

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	view := model.ChannelViewFromJson(r.Body)
	if view == nil {
		c.SetInvalidParam("channel_view")
		return
	}

	// Validate view struct
	// Check IDs are valid or blank. Blank IDs are used to denote focus loss or inital channel view.
	if view.ChannelId != "" && !model.IsValidId(view.ChannelId) {
		c.SetInvalidParam("channel_view.channel_id")
		return
	}
	if view.PrevChannelId != "" && !model.IsValidId(view.PrevChannelId) {
		c.SetInvalidParam("channel_view.prev_channel_id")
		return
	}

	times, err := c.App.ViewChannel(view, c.Params.UserId, c.App.Session.Id)
	if err != nil {
		c.Err = err
		return
	}

	c.App.UpdateLastActivityAtIfNeeded(c.App.Session)

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

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_CHANNEL_ROLES) {
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

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_CHANNEL_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_CHANNEL_ROLES)
		return
	}

	if _, err := c.App.UpdateChannelMemberSchemeRoles(c.Params.ChannelId, c.Params.UserId, schemeRoles.SchemeGuest, schemeRoles.SchemeUser, schemeRoles.SchemeAdmin); err != nil {
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

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
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

	channel, err := c.App.GetChannel(member.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_DIRECT || channel.Type == model.CHANNEL_GROUP {
		c.Err = model.NewAppError("addUserToChannel", "api.channel.add_user_to_channel.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	isNewMembership := false
	if _, err = c.App.GetChannelMember(member.ChannelId, member.UserId); err != nil {
		if err.Id == store.MISSING_CHANNEL_MEMBER_ERROR {
			isNewMembership = true
		} else {
			c.Err = err
			return
		}
	}

	isSelfAdd := member.UserId == c.App.Session.UserId

	if channel.Type == model.CHANNEL_OPEN {
		if isSelfAdd && isNewMembership {
			if !c.App.SessionHasPermissionToTeam(c.App.Session, channel.TeamId, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
				c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_CHANNELS)
				return
			}
		} else if isSelfAdd && !isNewMembership {
			// nothing to do, since already in the channel
		} else if !isSelfAdd {
			if !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
				c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
				return
			}
		}
	}

	if channel.Type == model.CHANNEL_PRIVATE {
		if isSelfAdd && isNewMembership {
			if !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
				c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
				return
			}
		} else if isSelfAdd && !isNewMembership {
			// nothing to do, since already in the channel
		} else if !isSelfAdd {
			if !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
				c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
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
			c.Err = model.NewAppError("addChannelMember", "api.channel.add_members.user_denied", map[string]interface{}{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	cm, err := c.App.AddChannelMember(member.UserId, channel, c.App.Session.UserId, postRootId)
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

	channel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !(channel.Type == model.CHANNEL_OPEN || channel.Type == model.CHANNEL_PRIVATE) {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_channel_member.type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if channel.IsGroupConstrained() && (c.Params.UserId != c.App.Session.UserId) && !user.IsBot {
		c.Err = model.NewAppError("removeChannelMember", "api.channel.remove_member.group_constrained.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if c.Params.UserId != c.App.Session.UserId {
		if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
			return
		}

		if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToChannel(c.App.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
			return
		}
	}

	if err = c.App.RemoveUserFromChannel(c.Params.UserId, c.App.Session.UserId, channel); err != nil {
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

	if !c.App.SessionHasPermissionToChannel(c.App.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_SYSTEM) {
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
		if len(gid) != 26 {
			c.SetInvalidParam("group_ids")
			return
		}
		groupIDs = append(groupIDs, gid)
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	users, totalCount, err := c.App.ChannelMembersMinusGroupMembers(
		c.Params.ChannelId,
		groupIDs,
		c.Params.Page,
		c.Params.PerPage,
	)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(&model.UsersWithGroupsAndCount{
		Users: users,
		Count: totalCount,
	})
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.channelMembersMinusGroupMembers", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}
