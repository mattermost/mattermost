// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitContentFlagging() {
	if !api.srv.Config().FeatureFlags.ContentFlagging {
		return
	}

	api.BaseRoutes.ContentFlagging.Handle("/flag/config", api.APISessionRequired(getFlaggingConfiguration)).Methods(http.MethodGet)
	api.BaseRoutes.ContentFlagging.Handle("/team/{team_id:[A-Za-z0-9]+}/status", api.APISessionRequired(getTeamPostFlaggingFeatureStatus)).Methods(http.MethodGet)
}

func requireContentFlaggingEnabled(c *Context) {
	if !model.MinimumEnterpriseAdvancedLicense(c.App.License()) {
		c.Err = model.NewAppError("requireContentFlaggingEnabled", "api.content_flagging.error.license", nil, "", http.StatusNotImplemented)
		return
	}

	contentFlaggingEnabled := c.App.Config().ContentFlaggingSettings.EnableContentFlagging
	if contentFlaggingEnabled == nil || !*contentFlaggingEnabled {
		c.Err = model.NewAppError("requireContentFlaggingEnabled", "api.content_flagging.error.disabled", nil, "", http.StatusNotImplemented)
		return
	}
}

func getFlaggingConfiguration(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	config := getFlaggingConfig(c.App.Config().ContentFlaggingSettings)

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(config); err != nil {
		mlog.Error("failed to encode content flagging configuration to return API response", mlog.Err(err))
		return
	}
}

func getTeamPostFlaggingFeatureStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	requireContentFlaggingEnabled(c)
	if c.Err != nil {
		return
	}

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	teamID := c.Params.TeamId
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	enabled := app.ContentFlaggingEnabledForTeam(c.App.Config(), teamID)

	payload := map[string]bool{
		"enabled": enabled,
	}
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		mlog.Error("failed to encode content flagging configuration to return API response", mlog.Err(err))
		return
	}
}

func getFlaggingConfig(contentFlaggingSettings model.ContentFlaggingSettings) *model.ContentFlaggingReportingConfig {
	return &model.ContentFlaggingReportingConfig{
		Reasons:                 contentFlaggingSettings.AdditionalSettings.Reasons,
		ReporterCommentRequired: contentFlaggingSettings.AdditionalSettings.ReporterCommentRequired,
	}
}
