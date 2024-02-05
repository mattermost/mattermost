// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/mattermost/mattermost/server/public/model"
)

var MaxUsersLimit string

func (a *App) GetUserLimits() (*model.UserLimits, *model.AppError) {
	userLimit, shouldShowLimits := a.shouldShowUserLimits()
	if !shouldShowLimits {
		return &model.UserLimits{}, nil
	}

	activeUserCount, appErr := a.Srv().Store().User().Count(model.UserCountOptions{})
	if appErr != nil {
		return nil, model.NewAppError("GetUsersLimits", "app.limits.get_user_limits.user_count.store_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	return &model.UserLimits{
		ActiveUserCount: activeUserCount,
		MaxUsersLimit:   userLimit,
	}, nil
}

func (a *App) shouldShowUserLimits() (int64, bool) {
	if strings.TrimSpace(MaxUsersLimit) == "" {
		return 0, false
	}

	userLimit, err := strconv.ParseInt(MaxUsersLimit, 10, 64)
	if err != nil {
		mlog.Debug("shouldShowUserLimits: failed to parse user limits", mlog.String("MaxUsersLimit", MaxUsersLimit), mlog.Err(err))
		return 0, false
	}

	if userLimit <= 0 {
		return 0, false
	}

	return userLimit, a.License() == nil
}
