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

	BaseRoutes.ChannelMembers.Handle("", ApiSessionRequired(getChannelMembers)).Methods("GET")
	BaseRoutes.ChannelMembersForUser.Handle("", ApiSessionRequired(getChannelMembersForUser)).Methods("GET")
	BaseRoutes.ChannelMember.Handle("", ApiSessionRequired(getChannelMember)).Methods("GET")
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
