// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	maxUsersLimit     = 2_500
	maxUsersHardLimit = 5_000
)

func (a *App) GetServerLimits() (*model.ServerLimits, *model.AppError) {
	limits := &model.ServerLimits{}
	license := a.License()

	if license == nil && maxUsersLimit > 0 {
		// Enforce hard-coded limits for unlicensed servers (no grace period).
		limits.MaxUsersLimit = maxUsersLimit
		limits.MaxUsersHardLimit = maxUsersHardLimit
	} else if license != nil && license.IsSeatCountEnforced && license.Features != nil && license.Features.Users != nil {
		// Enforce license limits as required by the license with configurable extra users.
		licenseUserLimit := int64(*license.Features.Users)
		limits.MaxUsersLimit = licenseUserLimit

		// Use ExtraUsers if configured, otherwise default to 0 (no extra users)
		extraUsers := 0
		if license.ExtraUsers != nil {
			extraUsers = *license.ExtraUsers
		}

		limits.MaxUsersHardLimit = licenseUserLimit + int64(extraUsers)
	}

	activeUserCount, appErr := a.Srv().Store().User().Count(model.UserCountOptions{})
	if appErr != nil {
		return nil, model.NewAppError("GetServerLimits", "app.limits.get_app_limits.user_count.store_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}
	limits.ActiveUserCount = activeUserCount

	return limits, nil
}

func (a *App) isAtUserLimit() (bool, *model.AppError) {
	userLimits, appErr := a.GetServerLimits()
	if appErr != nil {
		return false, appErr
	}

	if userLimits.MaxUsersHardLimit == 0 {
		return false, nil
	}

	return userLimits.ActiveUserCount >= userLimits.MaxUsersHardLimit, appErr
}
