// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) GetUsersForReporting(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
	if appErr := filter.IsValid(); appErr != nil {
		return nil, appErr
	}

	userReportQuery, err := a.Srv().Store().User().GetUserReport(filter)
	if err != nil {
		return nil, model.NewAppError("GetUsersForReporting", "app.report.get_user_report.store_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	userReports := make([]*model.UserReport, len(userReportQuery))
	for i, user := range userReportQuery {
		userReports[i] = user.ToReport()
	}

	return userReports, nil
}

func (a *App) GetUserCountForReport(filter *model.UserReportOptions) (*int64, *model.AppError) {
	count, err := a.Srv().Store().User().GetUserCountForReport(filter)
	if err != nil {
		return nil, model.NewAppError("GetUserCountForReport", "app.report.get_user_count_for_report.store_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &count, nil
}
