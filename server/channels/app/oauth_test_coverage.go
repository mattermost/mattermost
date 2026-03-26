// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateOAuthApp_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		app := &model.OAuthApp{
			Name:         "test",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		
		_, err := th.App.CreateOAuthApp(app)
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.register_oauth_app.turn_off.app_error", err.Id)
	})

	t.Run("Duplicate app name for same creator", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		app := &model.OAuthApp{
			Name:         "duplicate-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		
		// Create first app
		createdApp, err := th.App.CreateOAuthApp(app)
		require.Nil(t, err)
		require.NotNil(t, createdApp)
		
		// Try to create duplicate
		app2 := &model.OAuthApp{
			Name:         "duplicate-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://different.com/callback"},
		}
		
		_, err = th.App.CreateOAuthApp(app2)
		assert.NotNil(t, err)
		assert.Equal(t, "app.oauth.save_app.existing.app_error", err.Id)
	})
}

func TestUpdateOAuthApp_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		oldApp := &model.OAuthApp{Id: model.NewId()}
		updatedApp := &model.OAuthApp{Name: "updated"}
		
		_, err := th.App.UpdateOAuthApp(oldApp, updatedApp)
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.turn_off.app_error", err.Id)
	})

	t.Run("Update non-existent app", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		oldApp := &model.OAuthApp{
			Id:        model.NewId(),
			CreatorId: th.BasicUser.Id,
		}
		updatedApp := &model.OAuthApp{
			Name:         "updated",
			CallbackUrls: []string{"https://example.com"},
		}
		
		_, err := th.App.UpdateOAuthApp(oldApp, updatedApp)
		assert.NotNil(t, err)
	})
}

func TestDeleteOAuthApp_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		err := th.App.DeleteOAuthApp(th.Context, model.NewId())
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.turn_off.app_error", err.Id)
	})

	t.Run("Delete non-existent app", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		err := th.App.DeleteOAuthApp(th.Context, model.NewId())
		// Store returns nil for non-existent deletes, so this should succeed
		assert.Nil(t, err)
	})
}

func TestGetOAuthApp_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		_, err := th.App.GetOAuthApp(model.NewId())
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.turn_off.app_error", err.Id)
	})

	t.Run("Non-existent app", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		_, err := th.App.GetOAuthApp(model.NewId())
		assert.NotNil(t, err)
		assert.Equal(t, "app.oauth.get_app.find.app_error", err.Id)
		assert.Equal(t, http.StatusNotFound, err.StatusCode)
	})
}

func TestGetOAuthApps_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		_, err := th.App.GetOAuthApps(0, 10)
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.turn_off.app_error", err.Id)
	})
}

func TestAllowOAuthAppAccessToUser_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		authRequest := &model.AuthorizeRequest{
			ClientId:    model.NewId(),
			RedirectURI: "https://example.com/callback",
		}
		
		_, err := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.turn_off.app_error", err.Id)
	})

	t.Run("Non-existent app", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		authRequest := &model.AuthorizeRequest{
			ClientId:     model.NewId(),
			RedirectURI:  "https://example.com/callback",
			ResponseType: model.AuthCodeResponseType,
			State:        "test-state",
		}
		
		_, err := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		assert.NotNil(t, err)
		assert.Equal(t, "app.oauth.get_app.find.app_error", err.Id)
	})

	t.Run("Invalid redirect URI", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		// Create OAuth app
		app := &model.OAuthApp{
			Name:         "test-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		createdApp, err := th.App.CreateOAuthApp(app)
		require.Nil(t, err)
		
		authRequest := &model.AuthorizeRequest{
			ClientId:     createdApp.Id,
			RedirectURI:  "https://evil.com/callback", // Different from registered
			ResponseType: model.AuthCodeResponseType,
			State:        "test-state",
		}
		
		_, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		assert.NotNil(t, appErr)
		assert.Equal(t, "api.oauth.allow_oauth.redirect_callback.app_error", appErr.Id)
	})

	t.Run("Public client without PKCE", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		// Create public OAuth app (no client secret)
		app := &model.OAuthApp{
			Name:         "public-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		createdApp, _ := th.App.CreateOAuthAppInternal(app, false) // Don't generate secret
		require.Empty(t, createdApp.ClientSecret)
		
		authRequest := &model.AuthorizeRequest{
			ClientId:      createdApp.Id,
			RedirectURI:   "https://example.com/callback",
			ResponseType:  model.AuthCodeResponseType,
			State:         "test-state",
			CodeChallenge: "", // Missing PKCE challenge
		}
		
		_, err := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.pkce_required_public.app_error", err.Id)
	})

	t.Run("Unsupported response type", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		app := &model.OAuthApp{
			Name:         "test-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		createdApp, err := th.App.CreateOAuthApp(app)
		require.Nil(t, err)
		
		authRequest := &model.AuthorizeRequest{
			ClientId:     createdApp.Id,
			RedirectURI:  "https://example.com/callback",
			ResponseType: "unsupported_type",
			State:        "test-state",
		}
		
		redirectURI, appErr := th.App.AllowOAuthAppAccessToUser(th.Context, th.BasicUser.Id, authRequest)
		assert.Nil(t, appErr)
		assert.Contains(t, redirectURI, "error=unsupported_response_type")
		assert.Contains(t, redirectURI, "state=test-state")
	})
}

func TestDeauthorizeOAuthAppForUser_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		err := th.App.DeauthorizeOAuthAppForUser(th.Context, th.BasicUser.Id, model.NewId())
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.turn_off.app_error", err.Id)
	})

	t.Run("Non-existent authorization", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		// This should succeed even if preference doesn't exist
		err := th.App.DeauthorizeOAuthAppForUser(th.Context, th.BasicUser.Id, model.NewId())
		assert.Nil(t, err)
	})
}

func TestGetOAuthAccessTokenForCodeFlow_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		_, err := th.App.GetOAuthAccessTokenForCodeFlow(th.Context, "clientId", model.AccessTokenGrantType, "https://example.com", "code", "secret", "", "", "")
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.get_access_token.disabled.app_error", err.Id)
	})

	t.Run("Invalid grant type", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		app := &model.OAuthApp{
			Name:         "test-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		createdApp, err := th.App.CreateOAuthApp(app)
		require.Nil(t, err)
		
		_, appErr := th.App.GetOAuthAccessTokenForCodeFlow(th.Context, createdApp.Id, "invalid_grant", "https://example.com", "code", createdApp.ClientSecret, "", "", "")
		assert.NotNil(t, appErr)
		assert.Equal(t, "api.oauth.get_access_token.bad_grant.app_error", appErr.Id)
	})

	t.Run("Non-existent client", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		_, err := th.App.GetOAuthAccessTokenForCodeFlow(th.Context, model.NewId(), model.AccessTokenGrantType, "https://example.com", "code", "secret", "", "", "")
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.get_access_token.credentials.app_error", err.Id)
	})

	t.Run("Invalid auth code", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		app := &model.OAuthApp{
			Name:         "test-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		createdApp, err := th.App.CreateOAuthApp(app)
		require.Nil(t, err)
		
		_, appErr := th.App.GetOAuthAccessTokenForCodeFlow(th.Context, createdApp.Id, model.AccessTokenGrantType, "https://example.com/callback", "invalid_code", createdApp.ClientSecret, "", "", "")
		assert.NotNil(t, appErr)
		assert.Equal(t, "api.oauth.get_access_token.expired_code.app_error", appErr.Id)
	})

	t.Run("Wrong client secret", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		app := &model.OAuthApp{
			Name:         "test-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		createdApp, err := th.App.CreateOAuthApp(app)
		require.Nil(t, err)
		
		// Create auth code
		authData := &model.AuthData{
			UserId:      th.BasicUser.Id,
			ClientId:    createdApp.Id,
			CreateAt:    model.GetMillis(),
			RedirectUri: "https://example.com/callback",
			State:       "test",
			Scope:       model.DefaultScope,
			Code:        model.NewId() + model.NewId(),
		}
		_, nErr := th.App.Srv().Store().OAuth().SaveAuthData(authData)
		require.NoError(t, nErr)
		
		_, appErr := th.App.GetOAuthAccessTokenForCodeFlow(th.Context, createdApp.Id, model.AccessTokenGrantType, authData.RedirectUri, authData.Code, "wrong_secret", "", "", "")
		assert.NotNil(t, appErr)
		assert.Equal(t, "api.oauth.get_access_token.credentials.app_error", appErr.Id)
	})
}

func TestRegenerateOAuthAppSecret_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		app := &model.OAuthApp{Id: model.NewId()}
		_, err := th.App.RegenerateOAuthAppSecret(app)
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.turn_off.app_error", err.Id)
	})
}

func TestRevokeAccessToken_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Invalid token", func(t *testing.T) {
		err := th.App.RevokeAccessToken(th.Context, "invalid_token")
		// Returns nil even if token not found
		assert.Nil(t, err)
	})
}

func TestGetOAuthCodeRedirect_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Invalid redirect URI", func(t *testing.T) {
		authRequest := &model.AuthorizeRequest{
			ClientId:    model.NewId(),
			RedirectURI: "://invalid-uri", // Invalid URI format
			State:       "test-state",
		}
		
		redirectURI, err := th.App.GetOAuthCodeRedirect(th.BasicUser.Id, authRequest)
		assert.Nil(t, err)
		assert.Contains(t, redirectURI, "error=redirect_uri_parse_error")
		assert.Contains(t, redirectURI, "state=test-state")
	})

	t.Run("Store save failure", func(t *testing.T) {
		// This test would require mocking the store to simulate a failure
		// Since we're using real stores, we can't easily simulate this error path
		// The code handles it properly by returning an error query parameter
	})
}

func TestGetAuthorizedAppsForUser_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Invalid user", func(t *testing.T) {
		apps, err := th.App.GetAuthorizedAppsForUser(model.NewId(), 0, 10)
		// Should return empty list, not error
		assert.Nil(t, err)
		assert.Empty(t, apps)
	})

	t.Run("Store error handling", func(t *testing.T) {
		// Create an OAuth app and authorize it
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = true })
		
		app := &model.OAuthApp{
			Name:         "test-app",
			CreatorId:    th.BasicUser.Id,
			CallbackUrls: []string{"https://example.com/callback"},
		}
		createdApp, err := th.App.CreateOAuthApp(app)
		require.Nil(t, err)
		
		// Authorize the app
		pref := model.Preference{
			UserId:   th.BasicUser.Id,
			Category: model.PreferenceCategoryAuthorizedOAuthApp,
			Name:     createdApp.Id,
			Value:    model.DefaultScope,
		}
		nErr := th.App.Srv().Store().Preference().Save(model.Preferences{pref})
		require.NoError(t, nErr)
		
		// Get authorized apps
		apps, appErr := th.App.GetAuthorizedAppsForUser(th.BasicUser.Id, 0, 10)
		assert.Nil(t, appErr)
		assert.Len(t, apps, 1)
		
		// Delete the app to simulate orphaned preference
		appErr = th.App.DeleteOAuthApp(th.Context, createdApp.Id)
		require.Nil(t, appErr)
		
		// Should handle missing app gracefully
		apps, appErr = th.App.GetAuthorizedAppsForUser(th.BasicUser.Id, 0, 10)
		assert.Nil(t, appErr)
		assert.Empty(t, apps)
	})
}

func TestGetOAuthAppsByCreator_ErrorPaths(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("OAuth disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOAuthServiceProvider = false })
		
		_, err := th.App.GetOAuthAppsByCreator(th.BasicUser.Id, 0, 10)
		assert.NotNil(t, err)
		assert.Equal(t, "api.oauth.allow_oauth.turn_off.app_error", err.Id)
	})
}