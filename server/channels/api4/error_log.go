// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitErrorLog() {
	// POST /api/v4/errors - Submit an error (authenticated users)
	api.BaseRoutes.APIRoot.Handle("/errors", api.APISessionRequired(reportError)).Methods(http.MethodPost)

	// GET /api/v4/errors - Get all errors (system admin only)
	api.BaseRoutes.APIRoot.Handle("/errors", api.APISessionRequired(getErrorLogs)).Methods(http.MethodGet)

	// DELETE /api/v4/errors - Clear all errors (system admin only)
	api.BaseRoutes.APIRoot.Handle("/errors", api.APISessionRequired(clearErrorLogs)).Methods(http.MethodDelete)
}

// reportError handles POST /api/v4/errors
// Any authenticated user can report errors from the client
func reportError(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if feature is enabled
	if !c.App.Config().FeatureFlags.ErrorLogDashboard {
		c.Err = model.NewAppError("reportError", "api.error_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	var report model.ErrorLogReport
	if jsonErr := json.NewDecoder(r.Body).Decode(&report); jsonErr != nil {
		c.SetInvalidParamWithErr("error_report", jsonErr)
		return
	}

	if appErr := report.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	userId := c.AppContext.Session().UserId
	user, err := c.App.GetUser(userId)
	username := ""
	if err == nil && user != nil {
		username = user.Username
	}

	// Create the error log entry
	errorLog := &model.ErrorLog{
		Id:             model.NewId(),
		CreateAt:       model.GetMillis(),
		Type:           report.Type,
		UserId:         userId,
		Username:       username,
		Message:        report.Message,
		Stack:          report.Stack,
		Url:            report.Url,
		UserAgent:      r.Header.Get("User-Agent"),
		ComponentStack: report.ComponentStack,
		Extra:          report.Extra,
		RequestPayload: redactRequestPayload(report.RequestPayload),
		ResponseBody:   report.ResponseBody,
	}

	// Parse extra data for API errors to extract method and status_code
	if report.Type == model.ErrorLogTypeAPI && report.Extra != "" {
		var extra map[string]any
		if err := json.Unmarshal([]byte(report.Extra), &extra); err == nil {
			if method, ok := extra["method"].(string); ok {
				errorLog.Method = method
			}
			if statusCode, ok := extra["status_code"].(float64); ok {
				errorLog.StatusCode = int(statusCode)
			}
		}
		// Use URL as endpoint for API errors
		errorLog.Endpoint = report.Url
	}

	// Log the error
	c.App.Srv().Platform().LogError(errorLog)

	ReturnStatusOK(w)
}

// getErrorLogs handles GET /api/v4/errors
// System admin only
func getErrorLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if feature is enabled
	if !c.App.Config().FeatureFlags.ErrorLogDashboard {
		c.Err = model.NewAppError("getErrorLogs", "api.error_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	errors := c.App.Srv().Platform().GetErrorLogs()
	stats := c.App.Srv().Platform().GetErrorLogStats()

	response := map[string]any{
		"errors": errors,
		"stats":  stats,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// clearErrorLogs handles DELETE /api/v4/errors
// System admin only
func clearErrorLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	// Check if feature is enabled
	if !c.App.Config().FeatureFlags.ErrorLogDashboard {
		c.Err = model.NewAppError("clearErrorLogs", "api.error_log.disabled", nil, "", http.StatusForbidden)
		return
	}

	// Check permission - system admin only
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.App.Srv().Platform().ClearErrorLogs()

	ReturnStatusOK(w)
}

func redactRequestPayload(payload string) string {
	if payload == "" {
		return ""
	}
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &data); err != nil {
		return payload
	}

	sensitiveFields := []string{"password", "token", "secret", "api_key", "authorization"}

	var redact func(m map[string]interface{})
	redact = func(m map[string]interface{}) {
		for k, v := range m {
			isSensitive := false
			for _, sensitive := range sensitiveFields {
				if strings.EqualFold(k, sensitive) {
					isSensitive = true
					break
				}
			}
			if isSensitive {
				m[k] = "[REDACTED]"
			} else if nested, ok := v.(map[string]interface{}); ok {
				redact(nested)
			}
		}
	}

	redact(data)

	res, err := json.Marshal(data)
	if err != nil {
		return payload
	}
	return string(res)
}