// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitChannel() {
	l4g.Debug(utils.T("api.channel.init.debug"))

	BaseRoutes.Channels.Handle("", ApiSessionRequired(createChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/direct", ApiSessionRequired(createDirectChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/group", ApiSessionRequired(createGroupChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/members/{user_id:[A-Za-z0-9]+}/view", ApiSessionRequired(viewChannel)).Methods("POST")

	BaseRoutes.ChannelsForTeam.Handle("", ApiSessionRequired(getPublicChannelsForTeam)).Methods("GET")
	BaseRoutes.ChannelsForTeam.Handle("/deleted", ApiSessionRequired(getDeletedChannelsForTeam)).Methods("GET")
	BaseRoutes.ChannelsForTeam.Handle("/ids", ApiSessionRequired(getPublicChannelsByIdsForTeam)).Methods("POST")
	BaseRoutes.ChannelsForTeam.Handle("/search", ApiSessionRequired(searchChannelsForTeam)).Methods("POST")
	BaseRoutes.User.Handle("/teams/{team_id:[A-Za-z0-9]+}/channels", ApiSessionRequired(getChannelsForTeamForUser)).Methods("GET")

	BaseRoutes.Channel.Handle("", ApiSessionRequired(getChannel)).Methods("GET")
	BaseRoutes.Channel.Handle("", ApiSessionRequired(updateChannel)).Methods("PUT")
	BaseRoutes.Channel.Handle("/patch", ApiSessionRequired(patchChannel)).Methods("PUT")
	BaseRoutes.Channel.Handle("/restore", ApiSessionRequired(restoreChannel)).Methods("POST")
	BaseRoutes.Channel.Handle("", ApiSessionRequired(deleteChannel)).Methods("DELETE")
	BaseRoutes.Channel.Handle("/stats", ApiSessionRequired(getChannelStats)).Methods("GET")
	BaseRoutes.Channel.Handle("/pinned", ApiSessionRequired(getPinnedPosts)).Methods("GET")

	BaseRoutes.ChannelForUser.Handle("/unread", ApiSessionRequired(getChannelUnread)).Methods("GET")

	BaseRoutes.ChannelByName.Handle("", ApiSessionRequired(getChannelByName)).Methods("GET")
	BaseRoutes.ChannelByNameForTeamName.Handle("", ApiSessionRequired(getChannelByNameForTeamName)).Methods("GET")

	BaseRoutes.ChannelMembers.Handle("", ApiSessionRequired(getChannelMembers)).Methods("GET")
	BaseRoutes.ChannelMembers.Handle("/ids", ApiSessionRequired(getChannelMembersByIds)).Methods("POST")
	BaseRoutes.ChannelMembers.Handle("", ApiSessionRequired(addChannelMember)).Methods("POST")
	BaseRoutes.ChannelMembersForUser.Handle("", ApiSessionRequired(getChannelMembersForUser)).Methods("GET")
	BaseRoutes.ChannelMember.Handle("", ApiSessionRequired(getChannelMember)).Methods("GET")
	BaseRoutes.ChannelMember.Handle("", ApiSessionRequired(removeChannelMember)).Methods("DELETE")
	BaseRoutes.ChannelMember.Handle("/roles", ApiSessionRequired(updateChannelMemberRoles)).Methods("PUT")
	BaseRoutes.ChannelMember.Handle("/notify_props", ApiSessionRequired(updateChannelMemberNotifyProps)).Methods("PUT")
}

func createChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channel := model.ChannelFromJson(r.Body)
	if channel == nil {
		c.SetInvalidParam("channel")
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_CREATE_PUBLIC_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_PUBLIC_CHANNEL)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_CREATE_PRIVATE_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_PRIVATE_CHANNEL)
		return
	}

	if sc, err := app.CreateChannelWithUser(channel, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("name=" + channel.Name)
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(sc.ToJson()))
	}
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

	var oldChannel *model.Channel
	var err *model.AppError
	if oldChannel, err = app.GetChannel(channel.Id); err != nil {
		c.Err = err
		return
	}

	if _, err = app.GetChannelMember(channel.Id, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	if !CanManageChannel(c, channel) {
		return
	}

	if oldChannel.DeleteAt > 0 {
		c.Err = model.NewLocAppError("updateChannel", "api.channel.update_channel.deleted.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if oldChannel.Name == model.DEFAULT_CHANNEL {
		if (len(channel.Name) > 0 && channel.Name != oldChannel.Name) || (len(channel.Type) > 0 && channel.Type != oldChannel.Type) {
			c.Err = model.NewLocAppError("updateChannel", "api.channel.update_channel.tried.app_error", map[string]interface{}{"Channel": model.DEFAULT_CHANNEL}, "")
			c.Err.StatusCode = http.StatusBadRequest
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

	if _, err := app.UpdateChannel(oldChannel); err != nil {
		c.Err = err
		return
	} else {
		if oldChannelDisplayName != channel.DisplayName {
			if err := app.PostUpdateChannelDisplayNameMessage(c.Session.UserId, channel.Id, c.Params.TeamId, oldChannelDisplayName, channel.DisplayName); err != nil {
				l4g.Error(err.Error())
			}
		}
		c.LogAudit("name=" + channel.Name)
		w.Write([]byte(oldChannel.ToJson()))
	}
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

	oldChannel, err := app.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if !CanManageChannel(c, oldChannel) {
		return
	}

	if rchannel, err := app.PatchChannel(oldChannel, patch, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("")
		w.Write([]byte(rchannel.ToJson()))
	}
}

func restoreChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = app.GetChannel(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	}
	teamId := channel.TeamId

	if !app.SessionHasPermissionToTeam(c.Session, teamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	channel, err = app.RestoreChannel(channel)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name)
	w.Write([]byte(channel.ToJson()))

}

func CanManageChannel(c *Context, channel *model.Channel) bool {
	if channel.Type == model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES)
		return false
	}

	if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES)
		return false
	}

	return true
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

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_DIRECT_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_DIRECT_CHANNEL)
		return
	}

	if !allowed && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if sc, err := app.CreateDirectChannel(userIds[0], userIds[1]); err != nil {
		c.Err = err
		return
	} else {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(sc.ToJson()))
	}
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

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_GROUP_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_GROUP_CHANNEL)
		return
	}

	if groupChannel, err := app.CreateGroupChannel(userIds, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(groupChannel.ToJson()))
	}
}

func getChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	channel, err := app.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN {
		if !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
			return
		}
	} else {
		if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
	}

	w.Write([]byte(channel.ToJson()))
	return
}

func getChannelUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	channelUnread, err := app.GetChannelUnread(c.Params.ChannelId, c.Params.UserId)
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

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	memberCount, err := app.GetChannelMemberCount(c.Params.ChannelId)

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

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if posts, err := app.GetPinnedPosts(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	} else if HandleEtag(posts.Etag(), "Get Pinned Posts", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, posts.Etag())
		w.Write([]byte(posts.ToJson()))
	}
}

func getPublicChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	if channels, err := app.GetPublicChannelsForTeam(c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channels.ToJson()))
		return
	}
}

func getDeletedChannelsForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	if channels, err := app.GetDeletedChannels(c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channels.ToJson()))
		return
	}
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

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if channels, err := app.GetPublicChannelsByIdsForTeam(c.Params.TeamId, channelIds); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channels.ToJson()))
	}
}

func getChannelsForTeamForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if channels, err := app.GetChannelsForUser(c.Params.TeamId, c.Params.UserId); err != nil {
		c.Err = err
		return
	} else if HandleEtag(channels.Etag(), "Get Channels", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, channels.Etag())
		w.Write([]byte(channels.ToJson()))
	}
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

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	if channels, err := app.SearchChannels(c.Params.TeamId, props.Term); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channels.ToJson()))
	}
}

func deleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = app.GetChannel(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_DELETE_PUBLIC_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_DELETE_PUBLIC_CHANNEL)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_DELETE_PRIVATE_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_DELETE_PRIVATE_CHANNEL)
		return
	}

	err = app.DeleteChannel(channel, c.Session.UserId)
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

	if channel, err = app.GetChannelByName(c.Params.ChannelName, c.Params.TeamId); err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN {
		if !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_READ_PUBLIC_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_PUBLIC_CHANNEL)
			return
		}
	} else {
		if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}
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

	if channel, err = app.GetChannelByNameForTeamName(c.Params.ChannelName, c.Params.TeamName); err != nil {
		c.Err = err
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	w.Write([]byte(channel.ToJson()))
	return
}

func getChannelMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if members, err := app.GetChannelMembersPage(c.Params.ChannelId, c.Params.Page, c.Params.PerPage); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(members.ToJson()))
	}
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

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if members, err := app.GetChannelMembersByIds(c.Params.ChannelId, userIds); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(members.ToJson()))
	}
}

func getChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if member, err := app.GetChannelMember(c.Params.ChannelId, c.Params.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(member.ToJson()))
	}
}

func getChannelMembersForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId().RequireTeamId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	if c.Session.UserId != c.Params.UserId && !app.SessionHasPermissionToTeam(c.Session, c.Params.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if members, err := app.GetChannelMembersForUser(c.Params.TeamId, c.Params.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(members.ToJson()))
	}
}

func viewChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	view := model.ChannelViewFromJson(r.Body)
	if view == nil {
		c.SetInvalidParam("channel_view")
		return
	}

	if err := app.ViewChannel(view, c.Params.UserId, !c.Session.IsMobileApp()); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
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

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_MANAGE_CHANNEL_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_CHANNEL_ROLES)
		return
	}

	if _, err := app.UpdateChannelMemberRoles(c.Params.ChannelId, c.Params.UserId, newRoles); err != nil {
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

	if !app.SessionHasPermissionToUser(c.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	_, err := app.UpdateChannelMemberNotifyProps(props, c.Params.ChannelId, c.Params.UserId)
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

	member := model.ChannelMemberFromJson(r.Body)
	if member == nil {
		c.SetInvalidParam("channel_member")
		return
	}

	if len(member.UserId) != 26 {
		c.SetInvalidParam("user_id")
		return
	}

	member.ChannelId = c.Params.ChannelId

	var channel *model.Channel
	var err *model.AppError
	if channel, err = app.GetChannel(member.ChannelId); err != nil {
		c.Err = err
		return
	}

	// Check join permission if adding yourself, otherwise check manage permission
	if channel.Type == model.CHANNEL_OPEN {
		if member.UserId == c.Session.UserId {
			if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
				c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_CHANNELS)
				return
			}
		} else {
			if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
				c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
				return
			}
		}
	}

	if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
		return
	}

	if cm, err := app.AddChannelMember(member.UserId, channel, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("name=" + channel.Name + " user_id=" + cm.UserId)
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(cm.ToJson()))
	}
}

func removeChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId().RequireUserId()
	if c.Err != nil {
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = app.GetChannel(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	}

	if c.Params.UserId != c.Session.UserId {
		if channel.Type == model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
			return
		}

		if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
			c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
			return
		}
	}

	if err = app.RemoveUserFromChannel(c.Params.UserId, c.Session.UserId, channel); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name + " user_id=" + c.Params.UserId)

	ReturnStatusOK(w)
}
