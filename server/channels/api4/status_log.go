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

const (
	defaultStatusLogPerPage = 100
	maxStatusLogPerPage     = 1000
)

func (api *API) InitStatusLog() {
	// GET /api/v4/status_logs - Get status logs with pagination (system admin only)
	api.BaseRoutes.APIRoot.Handle("/status_logs", api.APISessionRequired(getStatusLogs)).Methods(http.MethodGet)

	// DELETE /api/v4/status_logs - Clear all status logs (system admin only)
	api.BaseRoutes.APIRoot.Handle("/status_logs", api.APISessionRequired(clearStatusLogs)).Methods(http.MethodDelete)

	// GET /api/v4/status_logs/export - Export status logs as JSON (system admin only)
	api.BaseRoutes.APIRoot.Handle("/status_logs/export", api.APISessionRequired(exportStatusLogs)).Methods(http.MethodGet)
}

// getStatusLogs handles GET /api/v4/status_logs
// Query parameters:
//   - page: page number (0-indexed, default: 0)
//   - per_page: number of results per page (default: 100, max: 1000)
//   - user_id: filter by user ID (optional)
//   - log_type: filter by log type ("status_change" or "activity", optional)
//   - since: filter logs after this timestamp in milliseconds (optional)
//   - until: filter logs before this timestamp in milliseconds (optional)
//
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

	// Parse query parameters
	query := r.URL.Query()

	page := 0
	if pageStr := query.Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p >= 0 {
			page = p
		}
	}

	perPage := defaultStatusLogPerPage
	if perPageStr := query.Get("per_page"); perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 {
			perPage = pp
			if perPage > maxStatusLogPerPage {
				perPage = maxStatusLogPerPage
			}
		}
	}

	options := model.StatusLogGetOptions{
		Page:    page,
		PerPage: perPage,
		UserID:  query.Get("user_id"),
		LogType: query.Get("log_type"),
	}

	if sinceStr := query.Get("since"); sinceStr != "" {
		if since, err := strconv.ParseInt(sinceStr, 10, 64); err == nil && since > 0 {
			options.Since = since
		}
	}

	if untilStr := query.Get("until"); untilStr != "" {
		if until, err := strconv.ParseInt(untilStr, 10, 64); err == nil && until > 0 {
			options.Until = until
		}
	}

	logs := c.App.Srv().Platform().GetStatusLogsWithOptions(options)
	totalCount := c.App.Srv().Platform().GetStatusLogCount(options)
	stats := c.App.Srv().Platform().GetStatusLogStatsWithOptions(options)

	response := map[string]any{
		"logs":        logs,
		"stats":       stats,
		"total_count": totalCount,
		"page":        page,
		"per_page":    perPage,
		"has_more":    int64((page+1)*perPage) < totalCount,
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

// exportStatusLogs handles GET /api/v4/status_logs/export
// Exports all status logs matching the filter criteria as JSON.
// Query parameters are the same as getStatusLogs except pagination is ignored.
// System admin only
func exportStatusLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if status logging is enabled
	if !*c.App.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		c.Err = model.NewAppError("exportStatusLogs", "api.status_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	// Parse query parameters (same as getStatusLogs but no pagination)
	query := r.URL.Query()

	options := model.StatusLogGetOptions{
		Page:    0,
		PerPage: 0, // 0 means no limit for export
		UserID:  query.Get("user_id"),
		LogType: query.Get("log_type"),
	}

	if sinceStr := query.Get("since"); sinceStr != "" {
		if since, err := strconv.ParseInt(sinceStr, 10, 64); err == nil && since > 0 {
			options.Since = since
		}
	}

	if untilStr := query.Get("until"); untilStr != "" {
		if until, err := strconv.ParseInt(untilStr, 10, 64); err == nil && until > 0 {
			options.Until = until
		}
	}

	logs := c.App.Srv().Platform().GetStatusLogsWithOptions(options)
	stats := c.App.Srv().Platform().GetStatusLogStatsWithOptions(options)

	// Set headers for file download
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=status_logs_export.json")

	response := map[string]any{
		"logs":        logs,
		"stats":       stats,
		"total_count": len(logs),
		"exported_at": model.GetMillis(),
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing export response", mlog.Err(err))
	}
}
