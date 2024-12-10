// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (a *App) GenerateAndSaveDesktopToken(createAt int64, user *model.User) (*string, *model.AppError) {
	token := model.NewRandomString(64)
	err := a.Srv().Store().DesktopTokens().Insert(token, createAt, user.Id)
	if err != nil {
		// Delete any other related tokens if there's an error
		if deleteErr := a.Srv().Store().DesktopTokens().DeleteByUserId(user.Id); deleteErr != nil {
			a.Log().Error("Unable to delete desktop token", mlog.Err(deleteErr))
		}
		return nil, model.NewAppError("GenerateAndSaveDesktopToken", "app.desktop_token.generateServerToken.invalid_or_expired", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return &token, nil
}

func (a *App) ValidateDesktopToken(token string, expiryTime int64) (*model.User, *model.AppError) {
	// Check if token is valid
	userId, err := a.Srv().Store().DesktopTokens().GetUserId(token, expiryTime)
	if err != nil {
		// Delete the token if it is expired or invalid
		if deleteErr := a.Srv().Store().DesktopTokens().Delete(token); deleteErr != nil {
			a.Log().Error("Unable to delete desktop token", mlog.Err(deleteErr))
		}
		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.invalid", nil, "", http.StatusUnauthorized).Wrap(err)
	}

	// Get the user profile
	user, userErr := a.GetUser(*userId)
	if userErr != nil {
		// Delete the token if the user is invalid somehow
		if deleteErr := a.Srv().Store().DesktopTokens().Delete(token); deleteErr != nil {
			a.Log().Error("Unable to delete desktop token", mlog.Err(deleteErr))
		}
		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.no_user", nil, "", http.StatusInternalServerError).Wrap(userErr)
	}

	// Clean up other tokens if they exist
	if deleteErr := a.Srv().Store().DesktopTokens().DeleteByUserId(*userId); deleteErr != nil {
		a.Log().Error("Unable to delete desktop token", mlog.Err(deleteErr))
	}

	return user, nil
}
