// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitReports() {
	api.BaseRoutes.Reports.Handle("/users", api.APISessionRequired(getUsersForReporting)).Methods("GET")
	api.BaseRoutes.Reports.Handle("/users/count", api.APISessionRequired(getUserCountForReporting)).Methods("GET")
	api.BaseRoutes.Reports.Handle("/users/export", api.APISessionRequired(startUsersBatchExport)).Methods("POST")
}

func getUsersForReporting(c *Context, w http.ResponseWriter, r *http.Request) {
	if !(c.IsSystemAdmin()) {
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
	if !(c.IsSystemAdmin()) {
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
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementUsers)
		return
	}

	dateRange := r.URL.Query().Get("date_range")
	if dateRange == "" {
		dateRange = "all_time"
	}

	startAt, endAt := model.GetReportDateRange(dateRange, time.Now())
	if err := c.App.StartUsersBatchExport(c.AppContext, dateRange, startAt, endAt); err != nil {
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
