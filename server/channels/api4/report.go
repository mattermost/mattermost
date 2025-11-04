// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitReports() {
	api.BaseRoutes.Reports.Handle("/users", api.APISessionRequired(getUsersForReporting)).Methods(http.MethodGet)
	api.BaseRoutes.Reports.Handle("/users/count", api.APISessionRequired(getUserCountForReporting)).Methods(http.MethodGet)
	api.BaseRoutes.Reports.Handle("/users/export", api.APISessionRequired(startUsersBatchExport)).Methods(http.MethodPost)
	api.BaseRoutes.Reports.Handle("/posts", api.APISessionRequired(getPostsForReporting)).Methods(http.MethodPost)
}

func getUsersForReporting(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementUsers) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementUsers)
		return
	}

	baseOptions := fillReportingBaseOptions(r.URL.Query())
	options, err := fillUserReportOptions(r.URL.Query())

	if err != nil {
		c.Err = err
		return
	}
	options.ReportingBaseOptions = baseOptions

	// Don't allow fetching more than 100 users at a time from the normal query endpoint
	if options.PageSize <= 0 || options.PageSize > model.ReportingMaxPageSize {
		c.Err = model.NewAppError("getUsersForReporting", "api.getUsersForReporting.invalid_page_size", nil, "", http.StatusBadRequest)
		return
	}

	userReports, err := c.App.GetUsersForReporting(options)
	if err != nil {
		c.Err = err
		return
	}

	if jsonErr := json.NewEncoder(w).Encode(userReports); jsonErr != nil {
		c.Logger.Warn("Error writing response", mlog.Err(jsonErr))
	}
}

func getUserCountForReporting(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementUsers) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementUsers)
		return
	}

	options, err := fillUserReportOptions(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	count, err := c.App.GetUserCountForReport(options)
	if err != nil {
		c.Err = err
		return
	}

	if jsonErr := json.NewEncoder(w).Encode(count); jsonErr != nil {
		c.Logger.Warn("Error writing response", mlog.Err(jsonErr))
	}
}

func startUsersBatchExport(c *Context, w http.ResponseWriter, r *http.Request) {
	if !(c.IsSystemAdmin()) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	baseOptions := fillReportingBaseOptions(r.URL.Query())
	options, err := fillUserReportOptions(r.URL.Query())

	if err != nil {
		c.Err = err
		return
	}
	options.ReportingBaseOptions = baseOptions
	dateRange := options.ReportingBaseOptions.DateRange
	if dateRange == "" {
		dateRange = "all_time"
	}

	startAt, endAt := model.GetReportDateRange(dateRange, time.Now())
	if err := c.App.StartUsersBatchExport(c.AppContext, options, startAt, endAt); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func fillReportingBaseOptions(values url.Values) model.ReportingBaseOptions {
	sortColumn := "Username"
	if values.Get("sort_column") != "" {
		sortColumn = values.Get("sort_column")
	}

	direction := "next"
	if values.Get("direction") == "prev" {
		direction = "prev"
	}

	pageSize := 50
	if pageSizeStr, err := strconv.ParseInt(values.Get("page_size"), 10, 64); err == nil {
		pageSize = int(pageSizeStr)
	}

	options := model.ReportingBaseOptions{
		Direction:       direction,
		SortColumn:      sortColumn,
		SortDesc:        values.Get("sort_direction") == "desc",
		PageSize:        pageSize,
		FromColumnValue: values.Get("from_column_value"),
		FromId:          values.Get("from_id"),
		DateRange:       values.Get("date_range"),
	}
	options.PopulateDateRange(time.Now())
	return options
}

func fillUserReportOptions(values url.Values) (*model.UserReportOptions, *model.AppError) {
	teamFilter := values.Get("team_filter")
	if !(teamFilter == "" || model.IsValidId(teamFilter)) {
		return nil, model.NewAppError("getUsersForReporting", "api.getUsersForReporting.invalid_team_filter", nil, "", http.StatusBadRequest)
	}

	hideActive := values.Get("hide_active") == "true"
	hideInactive := values.Get("hide_inactive") == "true"
	if hideActive && hideInactive {
		return nil, model.NewAppError("getUsersForReporting", "api.getUsersForReporting.invalid_active_filter", nil, "", http.StatusBadRequest)
	}

	return &model.UserReportOptions{
		Team:         teamFilter,
		Role:         values.Get("role_filter"),
		HasNoTeam:    values.Get("has_no_team") == "true",
		HideActive:   hideActive,
		HideInactive: hideInactive,
		SearchTerm:   values.Get("search_term"),
	}, nil
}

// getPostsForReporting retrieves posts for reporting purposes with cursor-based pagination.
//
// API Endpoint: POST /api/v4/reports/posts
//
// Cursor Behavior:
//   - The cursor is opaque and self-contained (base64-encoded)
//   - When a cursor is provided, it contains all query parameters from the initial request
//   - Query parameters in the request body (time_field, sort_direction, include_deleted, exclude_system_posts)
//     are IGNORED when a cursor is present - the cursor's parameters take precedence
//   - This allows clients to keep sending the same parameters on every request without causing errors
//   - For the first page or to start a new query, omit the cursor or send an empty string
//
// Required permissions: System Admin (PERMISSION_MANAGE_SYSTEM)
func getPostsForReporting(c *Context, w http.ResponseWriter, r *http.Request) {
	// Require system admin permission for accessing posts reporting
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	// Request body contains both options and cursor
	var request struct {
		model.ReportPostOptions
		model.ReportPostOptionsCursor
	}
	if jsonErr := json.NewDecoder(r.Body).Decode(&request); jsonErr != nil {
		c.SetInvalidParamWithErr("body", jsonErr)
		return
	}

	// Validate required parameters
	if request.ChannelId == "" {
		c.SetInvalidParam("channel_id")
		return
	}
	if !model.IsValidId(request.ChannelId) {
		c.SetInvalidParam("channel_id")
		return
	}

	// Verify channel exists before querying posts
	// This provides a better error message than returning an empty result set
	channel, appErr := c.App.GetChannel(c.AppContext, request.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if channel == nil {
		c.Err = model.NewAppError("getPostsForReporting", "api.post.get_posts_for_reporting.channel_not_found", nil, fmt.Sprintf("channel_id=%s", request.ChannelId), http.StatusNotFound)
		return
	}

	// Set defaults
	if request.TimeField == "" {
		request.TimeField = "create_at"
	}
	if request.TimeField != "create_at" && request.TimeField != "update_at" {
		c.SetInvalidParam("time_field")
		return
	}

	if request.SortDirection == "" {
		request.SortDirection = "asc"
	}
	if request.SortDirection != "asc" && request.SortDirection != "desc" {
		c.SetInvalidParam("sort_direction")
		return
	}

	if request.PerPage <= 0 {
		request.PerPage = 100
	}
	if request.PerPage > model.MaxReportingPerPage {
		c.Err = model.NewAppError("getPostsForReporting", "api.post.get_posts_for_reporting.invalid_per_page", nil, fmt.Sprintf("Maximum per_page is %d", model.MaxReportingPerPage), http.StatusBadRequest)
		return
	}

	// Split into options and cursor
	options := request.ReportPostOptions
	cursor := request.ReportPostOptionsCursor

	response, appErr := c.App.GetPostsForReporting(c.AppContext, options, cursor)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if jsonErr := json.NewEncoder(w).Encode(response); jsonErr != nil {
		c.Logger.Warn("Error writing response", mlog.Err(jsonErr))
	}
}
