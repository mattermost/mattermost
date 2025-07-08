// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"net/http"
)

func (api *API) InitContentFlagging() {
	if !api.srv.Config().FeatureFlags.ContentFlagging {
		return
	}

	api.BaseRoutes.ContentFlagging.Handle("/report/config", api.APISessionRequired(getReportingConfiguration)).Methods(http.MethodGet)
	api.BaseRoutes.ContentFlagging.Handle("/team/{team_id:[A-Za-z0-9]+}/status", api.APISessionRequired(getTeamPostReportingFeatureStatus)).Methods(http.MethodGet)
}

func getReportingConfiguration(c *Context, w http.ResponseWriter, r *http.Request) {
	reportingConfig := c.App.GetReportingConfiguration()

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(reportingConfig); err != nil {
		mlog.Error("failed to encode content flagging reporting configuration to return API response", mlog.Err(err))
		return
	}
}

func getTeamPostReportingFeatureStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	teamID := c.Params.TeamId
	enabled := c.App.GetTeamPostReportingFeatureStatus(teamID)

	paylaod := map[string]interface{}{
		"enabled": enabled,
	}
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(paylaod); err != nil {
		mlog.Error("failed to encode content flagging reporting configuration to return API response", mlog.Err(err))
		return
	}
}
