// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

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

	// Notification Rules API
	// GET /api/v4/status_logs/notification_rules - Get all notification rules
	api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules", api.APISessionRequired(getStatusNotificationRules)).Methods(http.MethodGet)

	// POST /api/v4/status_logs/notification_rules - Create a notification rule
	api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules", api.APISessionRequired(createStatusNotificationRule)).Methods(http.MethodPost)

	// GET /api/v4/status_logs/notification_rules/{rule_id} - Get a notification rule
	api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules/{rule_id:[A-Za-z0-9]+}", api.APISessionRequired(getStatusNotificationRule)).Methods(http.MethodGet)

	// PUT /api/v4/status_logs/notification_rules/{rule_id} - Update a notification rule
	api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules/{rule_id:[A-Za-z0-9]+}", api.APISessionRequired(updateStatusNotificationRule)).Methods(http.MethodPut)

	// DELETE /api/v4/status_logs/notification_rules/{rule_id} - Delete a notification rule
	api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules/{rule_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteStatusNotificationRule)).Methods(http.MethodDelete)
}

// getStatusLogs handles GET /api/v4/status_logs
// Query parameters:
//   - page: page number (0-indexed, default: 0)
//   - per_page: number of results per page (default: 100, max: 1000)
//   - user_id: filter by user ID (optional)
//   - username: filter by username, case-insensitive (optional)
//   - log_type: filter by log type ("status_change" or "activity", optional)
//   - status: filter by new_status value ("online", "away", "dnd", "offline", optional)
//   - since: filter logs after this timestamp in milliseconds (optional)
//   - until: filter logs before this timestamp in milliseconds (optional)
//   - search: text search across username, reason, and trigger fields (optional)
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
		Page:     page,
		PerPage:  perPage,
		UserID:   sanitizeQueryParam(query.Get("user_id")),
		Username: sanitizeQueryParam(query.Get("username")),
		LogType:  sanitizeQueryParam(query.Get("log_type")),
		Status:   sanitizeQueryParam(query.Get("status")),
		Search:   sanitizeQueryParam(query.Get("search")),
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
	pausedUsers := c.App.Srv().Platform().GetPausedUsernames()

	response := map[string]any{
		"logs":         logs,
		"stats":        stats,
		"total_count":  totalCount,
		"page":         page,
		"per_page":     perPage,
		"has_more":     int64((page+1)*perPage) < totalCount,
		"paused_users": pausedUsers,
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
		Page:     0,
		PerPage:  0, // 0 means no limit for export
		UserID:   sanitizeQueryParam(query.Get("user_id")),
		Username: sanitizeQueryParam(query.Get("username")),
		LogType:  sanitizeQueryParam(query.Get("log_type")),
		Status:   sanitizeQueryParam(query.Get("status")),
		Search:   sanitizeQueryParam(query.Get("search")),
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

// getStatusNotificationRules handles GET /api/v4/status_logs/notification_rules
// Returns all notification rules (non-deleted)
// System admin only
func getStatusNotificationRules(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if status logging is enabled (rules depend on status logging)
	if !*c.App.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		c.Err = model.NewAppError("getStatusNotificationRules", "api.status_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	rules, err := c.App.Srv().Store().StatusNotificationRule().GetAll()
	if err != nil {
		c.Err = model.NewAppError("getStatusNotificationRules", "api.status_notification_rule.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// Ensure we return an empty array instead of null
	if rules == nil {
		rules = []*model.StatusNotificationRule{}
	}

	if err := json.NewEncoder(w).Encode(rules); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// createStatusNotificationRule handles POST /api/v4/status_logs/notification_rules
// Creates a new notification rule
// System admin only
func createStatusNotificationRule(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if status logging is enabled
	if !*c.App.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		c.Err = model.NewAppError("createStatusNotificationRule", "api.status_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	var rule model.StatusNotificationRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		c.Err = model.NewAppError("createStatusNotificationRule", "api.status_notification_rule.decode.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	// Set the creator to the current user
	rule.CreatedBy = c.AppContext.Session().UserId

	// Validate the rule before saving (PreSave sets ID, timestamps)
	rule.PreSave()
	if appErr := rule.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	// Validate watched user and recipient exist
	if _, appErr := c.App.GetUser(rule.WatchedUserID); appErr != nil {
		c.Err = model.NewAppError("createStatusNotificationRule", "api.status_notification_rule.watched_user_not_found.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if _, appErr := c.App.GetUser(rule.RecipientUserID); appErr != nil {
		c.Err = model.NewAppError("createStatusNotificationRule", "api.status_notification_rule.recipient_not_found.app_error", nil, "", http.StatusBadRequest)
		return
	}

	savedRule, err := c.App.Srv().Store().StatusNotificationRule().Save(&rule)
	if err != nil {
		c.Err = model.NewAppError("createStatusNotificationRule", "api.status_notification_rule.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(savedRule); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// getStatusNotificationRule handles GET /api/v4/status_logs/notification_rules/{rule_id}
// Returns a single notification rule
// System admin only
func getStatusNotificationRule(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if status logging is enabled
	if !*c.App.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		c.Err = model.NewAppError("getStatusNotificationRule", "api.status_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequireRuleId()
	if c.Err != nil {
		return
	}

	rule, err := c.App.Srv().Store().StatusNotificationRule().Get(c.Params.RuleId)
	if err != nil {
		c.Err = model.NewAppError("getStatusNotificationRule", "api.status_notification_rule.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(rule); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// updateStatusNotificationRule handles PUT /api/v4/status_logs/notification_rules/{rule_id}
// Updates a notification rule
// System admin only
func updateStatusNotificationRule(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if status logging is enabled
	if !*c.App.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		c.Err = model.NewAppError("updateStatusNotificationRule", "api.status_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequireRuleId()
	if c.Err != nil {
		return
	}

	var rule model.StatusNotificationRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		c.Err = model.NewAppError("updateStatusNotificationRule", "api.status_notification_rule.decode.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	// Ensure the ID matches the URL parameter
	rule.Id = c.Params.RuleId

	// Fetch existing rule to preserve immutable fields (CreatedBy, CreateAt)
	existingRule, storeErr := c.App.Srv().Store().StatusNotificationRule().Get(rule.Id)
	if storeErr != nil {
		c.Err = model.NewAppError("updateStatusNotificationRule", "api.status_notification_rule.not_found.app_error", nil, "", http.StatusNotFound).Wrap(storeErr)
		return
	}
	rule.CreatedBy = existingRule.CreatedBy
	rule.CreateAt = existingRule.CreateAt

	// Validate watched user and recipient exist
	if _, appErr := c.App.GetUser(rule.WatchedUserID); appErr != nil {
		c.Err = model.NewAppError("updateStatusNotificationRule", "api.status_notification_rule.watched_user_not_found.app_error", nil, "", http.StatusBadRequest)
		return
	}
	if _, appErr := c.App.GetUser(rule.RecipientUserID); appErr != nil {
		c.Err = model.NewAppError("updateStatusNotificationRule", "api.status_notification_rule.recipient_not_found.app_error", nil, "", http.StatusBadRequest)
		return
	}

	updatedRule, err := c.App.Srv().Store().StatusNotificationRule().Update(&rule)
	if err != nil {
		c.Err = model.NewAppError("updateStatusNotificationRule", "api.status_notification_rule.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if err := json.NewEncoder(w).Encode(updatedRule); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// deleteStatusNotificationRule handles DELETE /api/v4/status_logs/notification_rules/{rule_id}
// Soft-deletes a notification rule
// System admin only
func deleteStatusNotificationRule(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if status logging is enabled
	if !*c.App.Config().MattermostExtendedSettings.Statuses.EnableStatusLogs {
		c.Err = model.NewAppError("deleteStatusNotificationRule", "api.status_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequireRuleId()
	if c.Err != nil {
		return
	}

	if err := c.App.Srv().Store().StatusNotificationRule().Delete(c.Params.RuleId); err != nil {
		c.Err = model.NewAppError("deleteStatusNotificationRule", "api.status_notification_rule.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	ReturnStatusOK(w)
}

func sanitizeQueryParam(s string) string {
	s = strings.ReplaceAll(s, "'", "")
	s = strings.ReplaceAll(s, "\"", "")
	s = strings.ReplaceAll(s, ";", "")
	s = strings.ReplaceAll(s, "--", "")
	s = strings.ReplaceAll(s, "/*", "")
	s = strings.ReplaceAll(s, "\\", "")
	return s
}
