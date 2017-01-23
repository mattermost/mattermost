// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitChannel() {
	l4g.Debug(utils.T("api.channel.init.debug"))

	BaseRoutes.Channels.Handle("/", ApiUserRequired(getChannels)).Methods("GET")
	BaseRoutes.Channels.Handle("/more/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequired(getMoreChannelsPage)).Methods("GET")
	BaseRoutes.Channels.Handle("/more/search", ApiUserRequired(searchMoreChannels)).Methods("POST")
	BaseRoutes.Channels.Handle("/counts", ApiUserRequired(getChannelCounts)).Methods("GET")
	BaseRoutes.Channels.Handle("/members", ApiUserRequired(getMyChannelMembers)).Methods("GET")
	BaseRoutes.Channels.Handle("/create", ApiUserRequired(createChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/view", ApiUserRequired(viewChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/create_direct", ApiUserRequired(createDirectChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/update", ApiUserRequired(updateChannel)).Methods("POST")
	BaseRoutes.Channels.Handle("/update_header", ApiUserRequired(updateChannelHeader)).Methods("POST")
	BaseRoutes.Channels.Handle("/update_purpose", ApiUserRequired(updateChannelPurpose)).Methods("POST")
	BaseRoutes.Channels.Handle("/update_notify_props", ApiUserRequired(updateNotifyProps)).Methods("POST")
	BaseRoutes.Channels.Handle("/autocomplete", ApiUserRequired(autocompleteChannels)).Methods("GET")
	BaseRoutes.Channels.Handle("/name/{channel_name:[A-Za-z0-9_-]+}", ApiUserRequired(getChannelByName)).Methods("GET")

	BaseRoutes.NeedChannelName.Handle("/join", ApiUserRequired(join)).Methods("POST")

	BaseRoutes.NeedChannel.Handle("/", ApiUserRequired(getChannel)).Methods("GET")
	BaseRoutes.NeedChannel.Handle("/stats", ApiUserRequired(getChannelStats)).Methods("GET")
	BaseRoutes.NeedChannel.Handle("/members/{user_id:[A-Za-z0-9]+}", ApiUserRequired(getChannelMember)).Methods("GET")
	BaseRoutes.NeedChannel.Handle("/members/ids", ApiUserRequired(getChannelMembersByIds)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/join", ApiUserRequired(join)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/leave", ApiUserRequired(leave)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/delete", ApiUserRequired(deleteChannel)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/add", ApiUserRequired(addMember)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/remove", ApiUserRequired(removeMember)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/update_member_roles", ApiUserRequired(updateChannelMemberRoles)).Methods("POST")
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

	if channel.Type == model.CHANNEL_DIRECT {
		c.Err = model.NewLocAppError("createDirectChannel", "api.channel.create_channel.direct_channel.app_error", nil, "")
		return
	}

	if strings.Index(channel.Name, "__") > 0 {
		c.Err = model.NewLocAppError("createDirectChannel", "api.channel.create_channel.invalid_character.app_error", nil, "")
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

	if channel.TeamId == c.TeamId {

		// Get total number of channels on current team
		if count, err := app.GetNumberOfChannelsOnTeam(channel.TeamId); err != nil {
			c.Err = model.NewLocAppError("createChannel", "api.channel.get_channels.error", nil, err.Error())
			return
		} else {
			if int64(count+1) > *utils.Cfg.TeamSettings.MaxChannelsPerTeam {
				c.Err = model.NewLocAppError("createChannel", "api.channel.create_channel.max_channel_limit.app_error", map[string]interface{}{"MaxChannelsPerTeam": *utils.Cfg.TeamSettings.MaxChannelsPerTeam}, "")
				return
			}
		}
	}

	channel.CreatorId = c.Session.UserId

	if sc, err := app.CreateChannel(channel, true); err != nil {
		c.Err = err
		return
	} else {
		c.LogAudit("name=" + channel.Name)
		w.Write([]byte(sc.ToJson()))
	}
}

func createDirectChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_DIRECT_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_CREATE_DIRECT_CHANNEL)
		return
	}

	data := model.MapFromJson(r.Body)

	userId := data["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("createDirectChannel", "user_id")
		return
	}

	if sc, err := app.CreateDirectChannel(c.Session.UserId, userId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(sc.ToJson()))
	}
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

func updateChannel(c *Context, w http.ResponseWriter, r *http.Request) {

	channel := model.ChannelFromJson(r.Body)

	if channel == nil {
		c.SetInvalidParam("updateChannel", "channel")
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
			if err := app.PostUpdateChannelDisplayNameMessage(c.Session.UserId, channel.Id, c.TeamId, oldChannelDisplayName, channel.DisplayName); err != nil {
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
	if channel, err = app.GetChannel(channelId); err != nil {
		c.Err = err
		return
	}

	if _, err = app.GetChannelMember(channelId, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	if !CanManageChannel(c, channel) {
		return
	}

	oldChannelHeader := channel.Header
	channel.Header = channelHeader

	if _, err := app.UpdateChannel(channel); err != nil {
		c.Err = err
		return
	} else {
		if err := app.PostUpdateChannelHeaderMessage(c.Session.UserId, channel.Id, c.TeamId, oldChannelHeader, channelHeader); err != nil {
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
	if channel, err = app.GetChannel(channelId); err != nil {
		c.Err = err
		return
	}

	if _, err = app.GetChannelMember(channelId, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	if !CanManageChannel(c, channel) {
		return
	}

	oldChannelPurpose := channel.Purpose
	channel.Purpose = channelPurpose

	if _, err := app.UpdateChannel(channel); err != nil {
		c.Err = err
		return
	} else {
		if err := app.PostUpdateChannelPurposeMessage(c.Session.UserId, channel.Id, c.TeamId, oldChannelPurpose, channelPurpose); err != nil {
			l4g.Error(err.Error())
		}
		c.LogAudit("name=" + channel.Name)
		w.Write([]byte(channel.ToJson()))
	}
}

func getChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.TeamId == "" {
		c.Err = model.NewLocAppError("", "api.context.missing_teamid.app_error", nil, "TeamIdRequired")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}
	// user is already in the team
	// Get's all channels the user is a member of

	if channels, err := app.GetChannelsForUser(c.TeamId, c.Session.UserId); err != nil {
		if err.Id == "store.sql_channel.get_channels.not_found.app_error" {
			// lets make sure the user is valid
			if _, err := app.GetUser(c.Session.UserId); err != nil {
				c.Err = err
				c.RemoveSessionCookie(w, r)
				l4g.Error(utils.T("api.channel.get_channels.error"), c.Session.UserId)
				return
			}
		}
		c.Err = err
		return
	} else if HandleEtag(channels.Etag(), "Get Channels", w, r) {
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
	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	if channels, err := app.GetChannelsUserNotIn(c.TeamId, c.Session.UserId, offset, limit); err != nil {
		c.Err = err
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, channels.Etag())
		w.Write([]byte(channels.ToJson()))
	}
}

func getChannelCounts(c *Context, w http.ResponseWriter, r *http.Request) {

	// user is already in the team

	if counts, err := app.GetChannelCounts(c.TeamId, c.Session.UserId); err != nil {
		c.Err = model.NewLocAppError("getChannelCounts", "api.channel.get_channel_counts.app_error", nil, err.Message)
		return
	} else if HandleEtag(counts.Etag(), "Get Channel Counts", w, r) {
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
		channel, err = app.GetChannel(channelId)
	} else if channelName != "" {
		channel, err = app.GetChannelByName(channelName, c.TeamId)
	} else {
		c.SetInvalidParam("join", "channel_id, channel_name")
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN {
		if !app.SessionHasPermissionToTeam(c.Session, channel.TeamId, model.PERMISSION_JOIN_PUBLIC_CHANNELS) {
			c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_CHANNELS)
			return
		}
	}

	if err = app.JoinChannel(channel, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channel.ToJson()))
}

func leave(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["channel_id"]

	err := app.LeaveChannel(id, c.Session.UserId)
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
	if channel, err = app.GetChannel(id); err != nil {
		c.Err = err
		return
	}

	var memberCount int64
	if memberCount, err = app.GetChannelMemberCount(id); err != nil {
		c.Err = err
		return
	}

	// Allow delete if user is the only member left in channel
	if memberCount > 1 {
		if channel.Type == model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_DELETE_PUBLIC_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_DELETE_PUBLIC_CHANNEL)
			return
		}

		if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_DELETE_PRIVATE_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_DELETE_PRIVATE_CHANNEL)
			return
		}
	}

	err = app.DeleteChannel(channel, c.Session.UserId)
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
	if channel, err = app.GetChannel(id); err != nil {
		c.Err = err
		return
	}

	if channel.TeamId != c.TeamId && channel.Type != model.CHANNEL_DIRECT {
		c.Err = model.NewLocAppError("getChannel", "api.channel.get_channel.wrong_team.app_error", map[string]interface{}{"ChannelId": id, "TeamId": c.TeamId}, "")
		return
	}

	var member *model.ChannelMember
	if member, err = app.GetChannelMember(id, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	data := &model.ChannelData{}
	data.Channel = channel
	data.Member = member

	if HandleEtag(data.Etag(), "Get Channel", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func getChannelByName(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	channelName := params["channel_name"]

	if channel, err := app.GetChannelByName(channelName, c.TeamId); err != nil {
		c.Err = err
		return
	} else {
		if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
			c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
			return
		}

		if channel.TeamId != c.TeamId && channel.Type != model.CHANNEL_DIRECT {
			c.Err = model.NewLocAppError("getChannel", "api.channel.get_channel.wrong_team.app_error", map[string]interface{}{"ChannelName": channelName, "TeamId": c.TeamId}, "")
			return
		}

		if HandleEtag(channel.Etag(), "Get Channel By Name", w, r) {
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
	if channel, err = app.GetChannel(id); err != nil {
		c.Err = err
		return
	}

	if channel.DeleteAt > 0 {
		c.Err = model.NewLocAppError("getChannelStats", "api.channel.get_channel_extra_info.deleted.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if memberCount, err := app.GetChannelMemberCount(id); err != nil {
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

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if member, err := app.GetChannelMember(channelId, userId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(member.ToJson()))
	}
}

func getMyChannelMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	if members, err := app.GetChannelMembersForUser(c.TeamId, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(members.ToJson()))
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
	if channel, err = app.GetChannel(id); err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
		return
	}

	var nUser *model.User
	if nUser, err = app.GetUser(userId); err != nil {
		c.Err = model.NewLocAppError("addMember", "api.channel.add_member.find_user.app_error", nil, err.Error())
		return
	}

	cm, err := app.AddUserToChannel(nUser, channel)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name + " user_id=" + userId)

	var oUser *model.User
	if oUser, err = app.GetUser(c.Session.UserId); err != nil {
		c.Err = model.NewLocAppError("addMember", "api.channel.add_member.user_adding.app_error", nil, err.Error())
		return
	}

	go app.PostUserAddRemoveMessage(c.Session.UserId, channel.Id, channel.TeamId, fmt.Sprintf(utils.T("api.channel.add_member.added"), nUser.Username, oUser.Username), model.POST_ADD_REMOVE)

	app.UpdateChannelLastViewedAt([]string{id}, oUser.Id)
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
	if channel, err = app.GetChannel(channelId); err != nil {
		c.Err = err
		return
	}

	if channel.Type == model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
		return
	}

	if _, err = app.GetChannelMember(channel.Id, c.Session.UserId); err != nil {
		c.Err = err
		return
	}

	if err = app.RemoveUserFromChannel(userIdToRemove, c.Session.UserId, channel); err != nil {
		c.Err = model.NewLocAppError("removeMember", "api.channel.remove_member.unable.app_error", nil, err.Message)
		return
	}

	c.LogAudit("name=" + channel.Name + " user_id=" + userIdToRemove)

	var user *model.User
	if user, err = app.GetUser(userIdToRemove); err != nil {
		c.Err = err
		return
	}

	go app.PostUserAddRemoveMessage(c.Session.UserId, channel.Id, channel.TeamId, fmt.Sprintf(utils.T("api.channel.remove_member.removed"), user.Username), model.POST_ADD_REMOVE)

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

	if !app.SessionHasPermissionToUser(c.Session, userId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	member, err := app.UpdateChannelMemberNotifyProps(data, channelId, userId)
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
		if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if len(props.Term) == 0 {
		c.SetInvalidParam("searchMoreChannels", "term")
		return
	}

	if channels, err := app.SearchChannelsUserNotIn(c.TeamId, c.Session.UserId, props.Term); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channels.ToJson()))
	}
}

func autocompleteChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	term := r.URL.Query().Get("term")

	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if channels, err := app.SearchChannels(c.TeamId, term); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channels.ToJson()))
	}

}

func viewChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	view := model.ChannelViewFromJson(r.Body)

	if err := app.SetActiveChannel(c.Session.UserId, view.ChannelId); err != nil {
		c.Err = err
		return
	}

	if len(view.ChannelId) == 0 {
		ReturnStatusOK(w)
		return
	}

	if err := app.ViewChannel(view, c.TeamId, c.Session.UserId, !c.Session.IsMobileApp()); err != nil {
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

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if members, err := app.GetChannelMembersByIds(channelId, userIds); err != nil {
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

	if !app.SessionHasPermissionToChannel(c.Session, channelId, model.PERMISSION_MANAGE_CHANNEL_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_CHANNEL_ROLES)
		return
	}

	newRoles := props["new_roles"]
	if !(model.IsValidUserRoles(newRoles)) {
		c.SetInvalidParam("updateChannelMemberRoles", "new_roles")
		return
	}

	if _, err := app.UpdateChannelMemberRoles(channelId, userId, newRoles); err != nil {
		c.Err = err
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}
