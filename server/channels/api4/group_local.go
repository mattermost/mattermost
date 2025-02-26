// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitGroupLocal() {
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/groups", api.APILocal(getGroupsByChannelLocal)).Methods(http.MethodGet)
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups", api.APILocal(getGroupsByTeamLocal)).Methods(http.MethodGet)
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

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
