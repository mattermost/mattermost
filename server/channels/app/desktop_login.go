// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) SaveClientDesktopToken(token string, createdAt int64) *model.AppError {
	// Create token in the database
	err := a.Srv().Store().DesktopTokens().Insert(token, createdAt, nil)
	if err != nil {
		return model.NewAppError("SaveClientDesktopToken", "app.desktop_token.create.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) AuthenticateClientDesktopToken(token string, expiryTime int64, user *model.User) *model.AppError {
	// Throw an error if the token is expired
	err := a.Srv().Store().DesktopTokens().SetUserId(token, expiryTime, user.Id)
	if err != nil {
		// Delete the token if it is expired
		a.Srv().Store().DesktopTokens().Delete(token)

		return model.NewAppError("AuthenticateClientDesktopToken", "app.desktop_token.authenticate.invalid_or_expired", nil, err.Error(), http.StatusBadRequest)
	}

	return nil
}

func (a *App) GenerateAndSaveServerDesktopToken(clientToken string, expiryTime int64) (*string, *model.AppError) {
	serverToken := model.NewRandomString(64)
	err := a.Srv().Store().DesktopTokens().SetServerToken(clientToken, expiryTime, serverToken)
	if err != nil {
		// Delete the token if it is expired
		a.Srv().Store().DesktopTokens().Delete(clientToken)

		return nil, model.NewAppError("GenerateAndSaveServerDesktopToken", "app.desktop_token.generateServerToken.invalid_or_expired", nil, err.Error(), http.StatusBadRequest)
	}

	return &serverToken, nil
}

func (a *App) ValidateDesktopToken(clientToken, serverToken string, expiryTime int64) (*model.User, *model.AppError) {
	// Check if token is valid
	userId, err := a.Srv().Store().DesktopTokens().GetUserId(clientToken, serverToken, expiryTime)
	if err != nil {
		// Delete the token if it is expired or invalid
		a.Srv().Store().DesktopTokens().Delete(clientToken)

		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.invalid", nil, err.Error(), http.StatusUnauthorized)
	}

	// Get the user profile
	user, userErr := a.GetUser(*userId)
	if userErr != nil {
		// Delete the token if the user is invalid somehow
		a.Srv().Store().DesktopTokens().Delete(clientToken)

		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.no_user", nil, userErr.Error(), http.StatusInternalServerError)
	}

	// Clean up other tokens if they exist
	a.Srv().Store().DesktopTokens().DeleteByUserId(*userId)

	return user, nil
}
