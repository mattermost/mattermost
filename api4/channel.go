// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
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

	BaseRoutes.Channel.Handle("", ApiSessionRequired(getChannel)).Methods("GET")
	BaseRoutes.ChannelByName.Handle("", ApiSessionRequired(getChannelByName)).Methods("GET")
	BaseRoutes.ChannelByNameForTeamName.Handle("", ApiSessionRequired(getChannelByNameForTeamName)).Methods("GET")

	BaseRoutes.ChannelMembers.Handle("", ApiSessionRequired(getChannelMembers)).Methods("GET")
	BaseRoutes.ChannelMembersForUser.Handle("", ApiSessionRequired(getChannelMembersForUser)).Methods("GET")
	BaseRoutes.ChannelMember.Handle("", ApiSessionRequired(getChannelMember)).Methods("GET")
	BaseRoutes.ChannelMember.Handle("", ApiSessionRequired(removeChannelMember)).Methods("DELETE")
	BaseRoutes.ChannelMember.Handle("/roles", ApiSessionRequired(updateChannelMemberRoles)).Methods("PUT")
	BaseRoutes.Channels.Handle("/members/{user_id:[A-Za-z0-9]+}/view", ApiSessionRequired(viewChannel)).Methods("POST")
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

func getChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToChannel(c.Session, c.Params.ChannelId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if channel, err := app.GetChannel(c.Params.ChannelId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(channel.ToJson()))
		return
	}
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

	if !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	w.Write([]byte(channel.ToJson()))
	return
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

	if channel.Type == model.CHANNEL_OPEN && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS)
		return
	}

	if channel.Type == model.CHANNEL_PRIVATE && !app.SessionHasPermissionToChannel(c.Session, channel.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS) {
		c.SetPermissionError(model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS)
		return
	}

	if err = app.RemoveUserFromChannel(c.Params.UserId, c.Session.UserId, channel); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("name=" + channel.Name + " user_id=" + c.Params.UserId)

	ReturnStatusOK(w)
}
