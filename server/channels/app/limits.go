// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	lowerBandUsersLimit = 500
	upperBandUsersLimit = 9000
	maxUsersLimit       = 10000
)

func (a *App) GetUserLimits() (*model.UserLimits, *model.AppError) {
	if !a.shouldShowUserLimits() {
		return &model.UserLimits{}, nil
	}

	activeUserCount, appErr := a.Srv().Store().User().Count(model.UserCountOptions{})
	if appErr != nil {
		return nil, model.NewAppError("GetUsersLimits", "", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	return &model.UserLimits{
		ActiveUserCount:    activeUserCount,
		LowerBandUserLimit: lowerBandUsersLimit,
		UpperBandUserLimit: upperBandUsersLimit,
		MaxUsersLimit:      maxUsersLimit,
	}, nil
}

func (a *App) shouldShowUserLimits() bool {
	license := a.License()

	if license == nil {
		return true
	}

	if maxUsersLimit == 0 {
		return false
	}

	return false
}
