// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	maxUsersLimit     = 10_000
	maxUsersHardLimit = 11_000

	maxPostLimit = 5_000_000
)

func (a *App) GetServerLimits() (*model.ServerLimits, *model.AppError) {
	var limits = &model.ServerLimits{}

	if a.shouldShowUserLimits() {
		activeUserCount, appErr := a.Srv().Store().User().Count(model.UserCountOptions{})
		if appErr != nil {
			mlog.Error("Failed to get active user count from database", mlog.String("error", appErr.Error()))
			return nil, model.NewAppError("GetServerLimits", "app.limits.get_app_limits.user_count.store_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		}

		limits.ActiveUserCount = activeUserCount
		limits.MaxUsersLimit = maxUsersLimit
		limits.MaxUsersHardLimit = maxUsersHardLimit
	}

	if a.shouldShowPostLimits() {
		postCount, appErr := a.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeDeleted: true})
		if appErr != nil {
			mlog.Error("Failed to get post count from database", mlog.String("error", appErr.Error()))
			return nil, model.NewAppError("GetServerLimits", "app.limits.get_server_limits.post_count.store_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		}

		limits.MaxPostLimit = maxPostLimit
		limits.PostCount = postCount
	}

	return limits, nil
}

func (a *App) shouldShowUserLimits() bool {
	if maxUsersLimit == 0 {
		return false
	}

	return a.License() == nil
}

func (a *App) shouldShowPostLimits() bool {
	if maxPostLimit == 0 {
		return false
	}

	return a.License() == nil
}

func (a *App) isHardUserLimitExceeded() (bool, *model.AppError) {
	userLimits, appErr := a.GetServerLimits()
	if appErr != nil {
		return false, appErr
	}

	return userLimits.ActiveUserCount > userLimits.MaxUsersHardLimit, appErr
}
