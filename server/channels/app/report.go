// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"net/http"
)

func (a *App) GetUsersForReporting(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
	if appErr := filter.IsValid(); appErr != nil {
		return nil, appErr
	}

	return a.getUserReport(filter)
}

func (a *App) getUserReport(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError) {
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

func (a *App) GetChannelsReport(filter *model.ChannelReportOptions) ([]*model.ChannelReport, *model.AppError) {
	if appErr := filter.IsValid(); appErr != nil {
		return nil, appErr
	}

	channelReport, err := a.Srv().Store().Channel().GetChannelsReport(filter)
	if err != nil {
		return nil, model.NewAppError("GetChannelsReport", "app.channel.get_channel_report.store_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return channelReport, nil
}
