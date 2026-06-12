// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// InitExperienceAPI registers the client experience endpoints.
// These are aggregate, client-optimized reads designed to minimize round trips —
// as opposed to the resource-oriented REST endpoints in the rest of the API.
func (api *API) InitExperienceAPI() {
	api.BaseRoutes.Users.Handle("/me/initial_load", api.APISessionRequired(getInitialLoad)).Methods(http.MethodGet)
	api.BaseRoutes.Users.Handle("/me/teams/{team_id:[A-Za-z0-9]+}/load", api.APISessionRequired(getTeamLoad)).Methods(http.MethodGet)
}

func getInitialLoad(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.Config().FeatureFlags.EnableExperienceAPI {
		http.NotFound(w, r)
		return
	}

	activeTeamID := r.URL.Query().Get("team_id")
	activeChannelID := r.URL.Query().Get("channel_id")

	var since int64
	if sinceStr := r.URL.Query().Get("since"); sinceStr != "" {
		v, err := strconv.ParseInt(sinceStr, 10, 64)
		if err != nil {
			c.SetInvalidURLParam("since")
			return
		}
		since = v
	}

	userID := c.AppContext.Session().UserId

	listPublic := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPublicTeams)
	listPrivate := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPrivateTeams)

	resp, appErr := c.App.GetInitialLoad(c.AppContext, userID, activeTeamID, activeChannelID, since, listPublic, listPrivate)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		c.Logger.Warn("Error writing initial_load response", mlog.Err(err))
	}
}

func getTeamLoad(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.Config().FeatureFlags.EnableExperienceAPI {
		http.NotFound(w, r)
		return
	}

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	teamID := c.Params.TeamId

	var since int64
	if sinceStr := r.URL.Query().Get("since"); sinceStr != "" {
		v, err := strconv.ParseInt(sinceStr, 10, 64)
		if err != nil {
			c.SetInvalidURLParam("since")
			return
		}
		since = v
	}

	userID := c.AppContext.Session().UserId

	resp, appErr := c.App.GetTeamLoad(c.AppContext, userID, teamID, since)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		c.Logger.Warn("Error writing team_load response", mlog.Err(err))
	}
}
