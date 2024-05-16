// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	maxUsersLimit     = 10000
	maxUsersHardLimit = 11000
)

func (a *App) GetUserLimits() (*model.UserLimits, *model.AppError) {
	if !a.shouldShowUserLimits() {
		return &model.UserLimits{}, nil
	}

	activeUserCount, appErr := a.Srv().Store().User().Count(model.UserCountOptions{})
	if appErr != nil {
		mlog.Error("Failed to get active user count from database", mlog.String("error", appErr.Error()))
		return nil, model.NewAppError("GetUsersLimits", "app.limits.get_user_limits.user_count.store_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	return &model.UserLimits{
		ActiveUserCount:   activeUserCount,
		MaxUsersLimit:     maxUsersLimit,
		MaxUsersHardLimit: maxUsersHardLimit,
	}, nil
}

func (a *App) shouldShowUserLimits() bool {
	if maxUsersLimit == 0 {
		return false
	}

	return a.License() == nil
}

func (a *App) isHardUserLimitExceeded() (bool, *model.AppError) {
	userLimits, appErr := a.GetUserLimits()
	if appErr != nil {
		return false, appErr
	}

	return userLimits.ActiveUserCount > userLimits.MaxUsersHardLimit, appErr
}
