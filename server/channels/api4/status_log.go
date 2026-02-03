// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitStatusLog() {
	// GET /api/v4/status_logs - Get all status logs (system admin only)
	api.BaseRoutes.APIRoot.Handle("/status_logs", api.APISessionRequired(getStatusLogs)).Methods(http.MethodGet)

	// DELETE /api/v4/status_logs - Clear all status logs (system admin only)
	api.BaseRoutes.APIRoot.Handle("/status_logs", api.APISessionRequired(clearStatusLogs)).Methods(http.MethodDelete)
}

// getStatusLogs handles GET /api/v4/status_logs
// System admin only
func getStatusLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if status logging is enabled
	if !*c.App.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		c.Err = model.NewAppError("getStatusLogs", "api.status_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	logs := c.App.Srv().Platform().GetStatusLogs()
	stats := c.App.Srv().Platform().GetStatusLogStats()

	response := map[string]any{
		"logs":  logs,
		"stats": stats,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// clearStatusLogs handles DELETE /api/v4/status_logs
// System admin only
func clearStatusLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if status logging is enabled
	if !*c.App.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		c.Err = model.NewAppError("clearStatusLogs", "api.status_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.App.Srv().Platform().ClearStatusLogs()

	ReturnStatusOK(w)
}
