// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) GenerateAndSaveDesktopToken(expiryTime int64, user *model.User) (*string, *model.AppError) {
	token := model.NewRandomString(64)
	err := a.Srv().Store().DesktopTokens().Insert(token, expiryTime, user.Id)
	if err != nil {
		// Delete any other related tokens if there's an error
		a.Srv().Store().DesktopTokens().DeleteByUserId(user.Id)

		return nil, model.NewAppError("GenerateAndSaveDesktopToken", "app.desktop_token.generateServerToken.invalid_or_expired", nil, err.Error(), http.StatusBadRequest)
	}

	return &token, nil
}

func (a *App) ValidateDesktopToken(token string, expiryTime int64) (*model.User, *model.AppError) {
	// Check if token is valid
	userId, err := a.Srv().Store().DesktopTokens().GetUserId(token, expiryTime)
	if err != nil {
		// Delete the token if it is expired or invalid
		a.Srv().Store().DesktopTokens().Delete(token)

		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.invalid", nil, err.Error(), http.StatusUnauthorized)
	}

	// Get the user profile
	user, userErr := a.GetUser(*userId)
	if userErr != nil {
		// Delete the token if the user is invalid somehow
		a.Srv().Store().DesktopTokens().Delete(token)

		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.no_user", nil, userErr.Error(), http.StatusInternalServerError)
	}

	// Clean up other tokens if they exist
	a.Srv().Store().DesktopTokens().DeleteByUserId(*userId)

	return user, nil
}
