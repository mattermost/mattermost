package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// UserService exposes methods to manipulate OAuth Apps.
type OAuthService struct {
	api plugin.API
}

// Create creates a new OAuth App.
//
// Minimum server version: 5.38
func (o *OAuthService) Create(app *model.OAuthApp) error {
	createdApp, appErr := o.api.CreateOAuthApp(app)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*app = *createdApp

	return nil
}

// Get gets an existing OAuth App by id.
//
// Minimum server version: 5.38
func (o *OAuthService) Get(appID string) (*model.OAuthApp, error) {
	app, appErr := o.api.GetOAuthApp(appID)

	return app, normalizeAppErr(appErr)
}

// Update updates an existing OAuth App.
//
// Minimum server version: 5.38
func (o *OAuthService) Update(app *model.OAuthApp) error {
	updatedApp, appErr := o.api.UpdateOAuthApp(app)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	*app = *updatedApp

	return nil
}

// Delete deletes an existing OAuth App by id.
//
// Minimum server version: 5.38
func (o *OAuthService) Delete(appID string) error {
	return normalizeAppErr(o.api.DeleteOAuthApp(appID))
}
