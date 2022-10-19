// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitGroupLocal() {
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/groups", api.APILocal(getGroupsByChannelLocal)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups", api.APILocal(getGroupsByTeamLocal)).Methods("GET")
}

func getGroupsByChannelLocal(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupsByChannel", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	var permission *model.Permission
	if channel.Type == model.ChannelTypePrivate {
		permission = model.PermissionReadPrivateChannelGroups
	} else {
		permission = model.PermissionReadPublicChannelGroups
	}
	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, permission) {
		c.SetPermissionError(permission)
		return
	}

	opts := model.GroupSearchOpts{
		Q:                    c.Params.Q,
		IncludeMemberCount:   c.Params.IncludeMemberCount,
		FilterAllowReference: c.Params.FilterAllowReference,
	}
	if c.Params.Paginate == nil || *c.Params.Paginate {
		opts.PageOpts = &model.PageOpts{Page: c.Params.Page, PerPage: c.Params.PerPage}
	}

	groups, totalCount, appErr := c.App.GetGroupsByChannel(c.Params.ChannelId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(struct {
		Groups []*model.GroupWithSchemeAdmin `json:"groups"`
		Count  int                           `json:"total_group_count"`
	}{
		Groups: groups,
		Count:  totalCount,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupsByChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
}

func getGroupsByTeamLocal(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupsByTeam", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	opts := model.GroupSearchOpts{
		Q:                    c.Params.Q,
		IncludeMemberCount:   c.Params.IncludeMemberCount,
		FilterAllowReference: c.Params.FilterAllowReference,
	}
	if c.Params.Paginate == nil || *c.Params.Paginate {
		opts.PageOpts = &model.PageOpts{Page: c.Params.Page, PerPage: c.Params.PerPage}
	}

	groups, totalCount, appErr := c.App.GetGroupsByTeam(c.Params.TeamId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(struct {
		Groups []*model.GroupWithSchemeAdmin `json:"groups"`
		Count  int                           `json:"total_group_count"`
	}{
		Groups: groups,
		Count:  totalCount,
	})

	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupsByTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
}
