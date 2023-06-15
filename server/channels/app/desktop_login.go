package app

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	desktopTokenTTL = 3 * time.Minute
)

func (a *App) CreateDesktopToken(token string) *model.AppError {
	// Check if the token already exists in the database somehow
	// If so return an error
	_, getErr := a.Srv().Store().DesktopTokens().GetUserId(token, 0)
	if getErr == nil {
		return model.NewAppError("CreateDesktopToken", "app.desktop_token.create.collision", nil, "", http.StatusInternalServerError)
	}

	// Create token in the database
	err := a.Srv().Store().DesktopTokens().Insert(token, time.Now().Unix(), nil)
	if err != nil {
		return model.NewAppError("CreateDesktopToken", "app.desktop_token.create.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) AuthenticateDesktopToken(token string, user *model.User) *model.AppError {
	// Check if token is expired
	expiryTime := time.Now().Add(-desktopTokenTTL).Unix()
	_, err := a.Srv().Store().DesktopTokens().GetUserId(token, expiryTime)
	if err != nil {
		// Delete the token if it is expired
		defer a.Srv().Store().DesktopTokens().Delete(token)

		return model.NewAppError("AuthenticateDesktopToken", "app.desktop_token.authenticate.invalid_or_expired", nil, err.Error(), http.StatusUnauthorized)
	}

	err = a.Srv().Store().DesktopTokens().SetUserId(token, expiryTime, user.Id)
	if err != nil {
		defer a.Srv().Store().DesktopTokens().Delete(token)

		return model.NewAppError("AuthenticateDesktopToken", "app.desktop_token.authenticate.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) ValidateDesktopToken(token string) (*model.User, *model.AppError) {
	// Check if token is expired
	expiryTime := time.Now().Add(-desktopTokenTTL).Unix()
	userId, err := a.Srv().Store().DesktopTokens().GetUserId(token, expiryTime)
	if err != nil {
		// Delete the token if it is expired
		defer a.Srv().Store().DesktopTokens().Delete(token)

		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.expired", nil, err.Error(), http.StatusUnauthorized)
	}

	// If there's no user id, it's not authenticated yet
	if userId == "" {
		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.invalid", nil, "", http.StatusUnauthorized)
	}

	// Get the user profile
	user, userErr := a.GetUser(userId)
	if userErr != nil {
		// Delete the token if the user is invalid somehow
		defer a.Srv().Store().DesktopTokens().Delete(token)

		return nil, model.NewAppError("ValidateDesktopToken", "app.desktop_token.validate.no_user", nil, userErr.Error(), http.StatusInternalServerError)
	}

	// Clean up other tokens if they exist
	defer a.Srv().Store().DesktopTokens().DeleteByUserId(userId)

	return user, nil
}
