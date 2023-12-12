// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	pUtils "github.com/mattermost/mattermost/server/public/utils"
	"net/http"
)

const (
	ReportingMaxPageSize = 100
)

func (a *App) GetUsersForReporting(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
	// Don't allow fetching more than 100 users at a time from the normal query endpoint
	if filter.PageSize <= 0 || filter.PageSize > ReportingMaxPageSize {
		return nil, model.NewAppError("GetUsersForReporting", "app.user.get_users_for_reporting.invalid_page_size", nil, "", http.StatusBadRequest)
	}

	// Validate date range
	if filter.EndAt > 0 && filter.StartAt > filter.EndAt {
		return nil, model.NewAppError("GetUsersForReporting", "app.user.get_users_for_reporting.bad_date_range", nil, "", http.StatusBadRequest)
	}

	return a.getUserReport(filter)
}

func (a *App) getUserReport(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
	// Validate against the columns we allow sorting for
	if !pUtils.Contains(model.UserReportSortColumns, filter.SortColumn) {
		return nil, model.NewAppError("GetUsersForReporting", "app.user.get_user_report.invalid_sort_column", nil, "", http.StatusBadRequest)
	}

	userReportQuery, err := a.Srv().Store().User().GetUserReport(filter)
	if err != nil {
		return nil, model.NewAppError("GetUsersForReporting", "app.user.get_user_report.store_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	userReports := make([]*model.UserReport, len(userReportQuery))
	for i, user := range userReportQuery {
		userReports[i] = user.ToReport()
	}

	return userReports, nil
}

//func (a *App) basicReportingValidation(filter)
//
//func (a *App) GetChannelsReport(filter *model.ChannelReportOptions) ([]*model.ChannelReport, *model.AppError) {
//
//}
