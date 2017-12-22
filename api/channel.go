// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (api *API) InitChannel() {
	api.BaseRoutes.Channels.Handle("/", api.ApiUserRequired(getChannels)).Methods("GET")
	api.BaseRoutes.Channels.Handle("/more/{offset:[0-9]+}/{limit:[0-9]+}", api.ApiUserRequired(getMoreChannelsPage)).Methods("GET")
	api.BaseRoutes.Channels.Handle("/more/search", api.ApiUserRequired(searchMoreChannels)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/counts", api.ApiUserRequired(getChannelCounts)).Methods("GET")
	api.BaseRoutes.Channels.Handle("/members", api.ApiUserRequired(getMyChannelMembers)).Methods("GET")
	api.BaseRoutes.Channels.Handle("/create", api.ApiUserRequired(createChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/view", api.ApiUserRequired(viewChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/create_direct", api.ApiUserRequired(createDirectChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/create_group", api.ApiUserRequired(createGroupChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/update", api.ApiUserRequired(updateChannel)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/update_header", api.ApiUserRequired(updateChannelHeader)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/update_purpose", api.ApiUserRequired(updateChannelPurpose)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/update_notify_props", api.ApiUserRequired(updateNotifyProps)).Methods("POST")
	api.BaseRoutes.Channels.Handle("/autocomplete", api.ApiUserRequired(autocompleteChannels)).Methods("GET")
	api.BaseRoutes.Channels.Handle("/name/{channel_name:[A-Za-z0-9_-]+}", api.ApiUserRequired(getChannelByName)).Methods("GET")

	api.BaseRoutes.NeedChannelName.Handle("/join", api.ApiUserRequired(join)).Methods("POST")

	api.BaseRoutes.NeedChannel.Handle("/", api.ApiUserRequired(getChannel)).Methods("GET")
	api.BaseRoutes.NeedChannel.Handle("/stats", api.ApiUserRequired(getChannelStats)).Methods("GET")
	api.BaseRoutes.NeedChannel.Handle("/members/{user_id:[A-Za-z0-9]+}", api.ApiUserRequired(getChannelMember)).Methods("GET")
	api.BaseRoutes.NeedChannel.Handle("/members/ids", api.ApiUserRequired(getChannelMembersByIds)).Methods("POST")
	api.BaseRoutes.NeedChannel.Handle("/pinned", api.ApiUserRequired(getPinnedPosts)).Methods("GET")
	api.BaseRoutes.NeedChannel.Handle("/join", api.ApiUserRequired(join)).Methods("POST")
	api.BaseRoutes.NeedChannel.Handle("/leave", api.ApiUserRequired(leave)).Methods("POST")
	api.BaseRoutes.NeedChannel.Handle("/delete", api.ApiUserRequired(deleteChannel)).Methods("POST")
	api.BaseRoutes.NeedChannel.Handle("/add", api.ApiUserRequired(addMember)).Methods("POST")
	api.BaseRoutes.NeedChannel.Handle("/remove", api.ApiUserRequired(removeMember)).Methods("POST")
	api.BaseRoutes.NeedChannel.Handle("/update_member_roles", api.ApiUserRequired(updateChannelMemberRoles)).Methods("POST")
}

func createChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	channel := model.ChannelFromJson(r.Body)
	if channel == nil {
		c.SetInvalidParam("createChannel", "channel")
		return
	}

	if len(channel.TeamId) == 0 {
		channel.TeamId = c.TeamId
	}

	if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_CREATE_PUBLIC_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_PUBLIC_CHANNEL)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_CREATE_PRIVATE_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_PRIVATE_CHANNEL)
		return
	}

	if sc, err := c.App.CreateChannelWithUser(channel, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("name=" + channel.Name)
		w.Write([]byte(sc.ToJson()))
	}
}

func createDirectChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_DIRECT_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_DIRECT_CHANNEL)
		return
	}

	data := model.MapFromJson(r.Body)

	userId := data["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("createDirectChannel", "user_id")
		return
	}

	if sc, err := c.App.CreateDirectChannel(c.Session.UserId, userId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(sc.ToJson()))
	}
}

func createGroupChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_GROUP_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_GROUP_CHANNEL)
		return
	}

	userIds := model.ArrayFromJson(r.Body)
	if len(userIds) == 0 {
		c.SetInvalidParam("createGroupChannel", "user_ids")
		return
	}

	found := false
	for _, id := range userIds {
		if id == c.Session.UserId {
			found = true
			break
		}
	}

	if !found {
		userIds = append(userIds, c.Session.UserId)
	}

	if sc, err := c.App.CreateGroupChannel(userIds, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(sc.ToJson()))
	}
}

func CanManageChannel(c *Context, channel *model.Channel) bool {
	if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES)
		return false
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES)
		return false
	}

	return true
}

func updateChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	channel := model.ChannelFromJson(r.Body)

	if channel == nil {
		c.SetInvalidParam("updateChannel", "channel")
		return
	}

	var oldChannel *model.Channel
	var err *model.AppError
	if oldChannel, err = c.App.GetChannel(channel.Id); err != nil {
		c.Err = err
		return
	}

	if _, err = c.App.GetChannelMember(channel.Id, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	if !CanManageChannel(c, channel) {
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
	} else {
		if oldChannelDisplayName != channel.DisplayName {
			if err := c.App.PostUpdateChannelDisplayNameMessage(c.Session.UserId, channel, oldChannelDisplayName, channel.DisplayName); err != nil {
				l4g.Error(err.Error())
			}
		}
		c.LogAudit("name=" + channel.Name)
		w.Write([]byte(oldChannel.ToJson()))
	}

}

func updateChannelHeader(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)
	channelId := props["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("updateChannelHeader", "channel_id")
		return
	}

	channelHeader := props["channel_header"]
	if len(channelHeader) > 1024 {
		c.SetInvalidParam("updateChannelHeader", "channel_header")
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(channelId); err != nil {
		c.Err = err
		return
	}

	if _, err = c.App.GetChannelMember(channelId, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	if !CanManageChannel(c, channel) {
		return
	}

	oldChannelHeader := channel.Header
	channel.Header = channelHeader

	if _, err := c.App.UpdateChannel(channel); err != nil {
		c.Err = err
		return
	} else {
		if err := c.App.PostUpdateChannelHeaderMessage(c.Session.UserId, channel, oldChannelHeader, channelHeader); err != nil {
			l4g.Error(err.Error())
		}
		c.LogAudit("name=" + channel.Name)
		w.Write([]byte(channel.ToJson()))
	}
}

func updateChannelPurpose(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)
	channelId := props["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("updateChannelPurpose", "channel_id")
		return
	}

	channelPurpose := props["channel_purpose"]
	if len(channelPurpose) > 1024 {
		c.SetInvalidParam("updateChannelPurpose", "channel_purpose")
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(channelId); err != nil {
		c.Err = err
		return
	}

	if _, err = c.App.GetChannelMember(channelId, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	if !CanManageChannel(c, channel) {
		return
	}

	oldChannelPurpose := channel.Purpose
	channel.Purpose = channelPurpose

	if _, err := c.App.UpdateChannel(channel); err != nil {
		c.Err = err
		return
	} else {
		if err := c.App.PostUpdateChannelPurposeMessage(c.Session.UserId, channel, oldChannelPurpose, channelPurpose); err != nil {
			l4g.Error(err.Error())
		}
		c.LogAudit("name=" + channel.Name)
		w.Write([]byte(channel.ToJson()))
	}
}

func getChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.TeamId == "" {
		c.Err = model.NewAppError("", "api.context.missing_teamid.app_error", nil, "TeamIdRequired", http.StatusBadRequest)
		return
	}
	// user is already in the team
	// Get's all channels the user is a member of

	if channels, err := c.App.GetChannelsForUser(c.TeamId, c.Session.UserId); err != nil {
		if err.Id == "store.sql_channel.get_channels.not_found.app_error" {
			// lets make sure the user is valid
			if _, err := c.App.GetUser(c.Session.UserId); err != nil {
				c.Err = err
				c.RemoveSessionCookie(w, r)
				l4g.Error(utils.T("api.channel.get_channels.error"), c.Session.UserId)
				return
			}
		}
		c.Err = err
		return
	} else if c.HandleEtag(channels.Etag(), "Get Channels", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, channels.Etag())
		w.Write([]byte(channels.ToJson()))
	}
}

func getMoreChannelsPage(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	offset, err := strconv.Atoi(params["offset"])
	if err != nil {
		c.SetInvalidParam("getProfiles", "offset")
		return
	}

	limit, err := strconv.Atoi(params["limit"])
	if err != nil {
		c.SetInvalidParam("getProfiles", "limit")
		return
	}

	// user is already in the team
	if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	if channels, err := c.App.GetChannelsUserNotIn(c.TeamId, c.Session.UserId, offset, limit); err != nil {
		c.Err = err
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, channels.Etag())
		w.Write([]byte(channels.ToJson()))
	}
}

func getChannelCounts(c *Context, w http.ResponseWriter, r *http.Request) {

	// user is already in the team

	if counts, err := c.App.GetChannelCounts(c.TeamId, c.Session.UserId); err != nil {
		c.Err = model.NewAppError("getChannelCounts", "api.channel.get_channel_counts.app_error", nil, err.Message, http.StatusInternalServerError)
		return
	} else if c.HandleEtag(counts.Etag(), "Get Channel Counts", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, counts.Etag())
		w.Write([]byte(counts.ToJson()))
	}
}

func join(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	channelId := params["channel_id"]
	channelName := params["channel_name"]

	var channel *model.Channel
	var err *model.AppError
	if channelId != "" {
		channel, err = c.App.GetChannel(channelId)
	} else if channelName != "" {
		channel, err = c.App.GetChannelByName(channelName, c.TeamId)
	} else {
		c.SetInvalidParam("join", "channel_id, channel_name")
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN {
		if !c.App.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
			c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_CHANNELS)
			return
		}
	}

	if err = c.App.JoinChannel(channel, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channel.ToJson()))
}

func leave(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["channel_id"]

	err := c.App.LeaveChannel(id, c.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	result := make(map[string]string)
	result["id"] = id
	w.Write([]byte(model.MapToJson(result)))
}

func deleteChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["channel_id"]

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(id); err != nil {
		c.Err = err
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

	result := make(map[string]string)
	result["id"] = channel.Id
	w.Write([]byte(model.MapToJson(result)))
}

func getChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["channel_id"]

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(id); err != nil {
		c.Err = err
		return
	}

	if channel.TeamId != c.TeamId && !channel.IsGroupOrDirect() {
		c.Err = model.NewAppError("getChannel", "api.channel.get_channel.wrong_team.app_error", map[string]interface{}{"ChannelId": id, "TeamId": c.TeamId}, "", http.StatusBadRequest)
		return
	}

	var member *model.ChannelMember
	if member, err = c.App.GetChannelMember(id, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	data := &model.ChannelData{}
	data.Channel = channel
	data.Member = member

	if c.HandleEtag(data.Etag(), "Get Channel", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func getChannelByName(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelName := params["channel_name"]

	if channel, err := c.App.GetChannelByName(channelName, c.TeamId); err != nil {
		c.Err = err
		return
	} else {
		if !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		if channel.TeamId != c.TeamId && !channel.IsGroupOrDirect() {
			c.Err = model.NewAppError("getChannel", "api.channel.get_channel.wrong_team.app_error", map[string]interface{}{"ChannelName": channelName, "TeamId": c.TeamId}, "", http.StatusBadRequest)
			return
		}

		if c.HandleEtag(channel.Etag(), "Get Channel By Name", w, r) {
			return
		} else {
			w.Header().Set(model.HEADER_ETAG_SERVER, channel.Etag())
			w.Write([]byte(channel.ToJson()))
		}
	}
}

func getChannelStats(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["channel_id"]

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(id); err != nil {
		c.Err = err
		return
	}

	if channel.DeleteAt > 0 {
		c.Err = model.NewAppError("getChannelStats", "api.channel.get_channel_extra_info.deleted.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if memberCount, err := c.App.GetChannelMemberCount(id); err != nil {
		c.Err = err
		return
	} else {
		stats := model.ChannelStats{ChannelId: channel.Id, MemberCount: memberCount}
		w.Write([]byte(stats.ToJson()))
	}
}

func getChannelMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]
	userId := params["user_id"]

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if member, err := c.App.GetChannelMember(channelId, userId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(member.ToJson()))
	}
}

func getMyChannelMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	if members, err := c.App.GetChannelMembersForUser(c.TeamId, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(members.ToJson()))
	}
}

func getPinnedPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]

	if result := <-c.App.Srv.Store.Channel().GetPinnedPosts(channelId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		posts := result.Data.(*model.PostList)
		w.Write([]byte(posts.ToJson()))
	}

}

func addMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["channel_id"]

	data := model.MapFromJson(r.Body)
	userId := data["user_id"]

	if len(userId) != 26 {
		c.SetInvalidParam("addMember", "user_id")
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(id); err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
		return
	}

	var nUser *model.User
	if nUser, err = c.App.GetUser(userId); err != nil {
		c.Err = model.NewAppError("addMember", "api.channel.add_member.find_user.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	cm, err := c.App.AddUserToChannel(nUser, channel)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name + " user_id=" + userId)

	var oUser *model.User
	if oUser, err = c.App.GetUser(c.Session.UserId); err != nil {
		c.Err = model.NewAppError("addMember", "api.channel.add_member.user_adding.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	c.App.Go(func() {
		c.App.PostAddToChannelMessage(oUser, nUser, channel, "")
	})

	c.App.UpdateChannelLastViewedAt([]string{id}, oUser.Id)
	w.Write([]byte(cm.ToJson()))
}

func removeMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]

	data := model.MapFromJson(r.Body)
	userIdToRemove := data["user_id"]

	if len(userIdToRemove) != 26 {
		c.SetInvalidParam("removeMember", "user_id")
		return
	}

	var channel *model.Channel
	var err *model.AppError
	if channel, err = c.App.GetChannel(channelId); err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !c.App.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
		return
	}

	if err = c.App.RemoveUserFromChannel(userIdToRemove, c.Session.UserId, channel); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name + " user_id=" + userIdToRemove)

	result := make(map[string]string)
	result["channel_id"] = channel.Id
	result["removed_user_id"] = userIdToRemove
	w.Write([]byte(model.MapToJson(result)))
}

func updateNotifyProps(c *Context, w http.ResponseWriter, r *http.Request) {
	data := model.MapFromJson(r.Body)

	userId := data["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updateNotifyProps", "user_id")
		return
	}

	channelId := data["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("updateNotifyProps", "channel_id")
		return
	}

	if !c.App.SessionHasPermissionToUser(c.Session, userId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	member, err := c.App.UpdateChannelMemberNotifyProps(data, channelId, userId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.MapToJson(member.NotifyProps)))
}

func searchMoreChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.ChannelSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("searchMoreChannels", "")
		return
	}

	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if len(props.Term) == 0 {
		c.SetInvalidParam("searchMoreChannels", "term")
		return
	}

	if channels, err := c.App.SearchChannelsUserNotIn(c.TeamId, c.Session.UserId, props.Term); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channels.ToJson()))
	}
}

func autocompleteChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("term")

	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if channels, err := c.App.SearchChannels(c.TeamId, term); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channels.ToJson()))
	}

}

func viewChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	view := model.ChannelViewFromJson(r.Body)
	if view == nil {
		c.SetInvalidParam("viewChannel", "channel_view")
		return
	}

	if _, err := c.App.ViewChannel(view, c.Session.UserId, !c.Session.IsMobileApp()); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getChannelMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]

	userIds := model.ArrayFromJson(r.Body)
	if len(userIds) == 0 {
		c.SetInvalidParam("getChannelMembersByIds", "user_ids")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if members, err := c.App.GetChannelMembersByIds(channelId, userIds); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(members.ToJson()))
	}
}

func updateChannelMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelId := params["channel_id"]

	props := model.MapFromJson(r.Body)

	userId := props["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updateChannelMemberRoles", "user_id")
		return
	}

	if !c.App.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_MANAGE_CHANNEL_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_CHANNEL_ROLES)
		return
	}

	newRoles := props["new_roles"]
	if !(model.IsValidUserRoles(newRoles)) {
		c.SetInvalidParam("updateChannelMemberRoles", "new_roles")
		return
	}

	if _, err := c.App.UpdateChannelMemberRoles(channelId, userId, newRoles); err != nil {
		c.Err = err
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}
