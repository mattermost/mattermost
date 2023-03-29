// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
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
	b, appErr := getGroupsByChannelCommon(c, r)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.Write(b)
}

func getGroupsByTeamLocal(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	b, appError := getGroupsByTeamCommon(c, r)
	if appError != nil {
		c.Err = appError
		return
	}

	w.Write(b)
}
