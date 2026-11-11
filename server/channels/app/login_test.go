// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCWSLogin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	license := model.NewTestLicense()
	license.Features.Cloud = model.NewPointer(true)
	th.App.Srv().SetLicense(license)

	t.Run("Should authenticate user when CWS login is enabled and tokens are equal", func(t *testing.T) {
		token := model.NewToken(model.TokenTypeCWSAccess, "")
		defer func() {
			appErr := th.App.DeleteToken(token)
			require.Nil(t, appErr)
		}()

		th.App.Srv().SetCWSTokenOverride(token.Token)
		t.Cleanup(func() { th.App.Srv().SetCWSTokenOverride("") })
		user, appErr := th.App.AuthenticateUserForLogin(th.Context, "", th.BasicUser.Username, "", "", token.Token, false)
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
		_, err := th.App.Srv().Store().Token().GetByToken(token.Token)
		require.NoError(t, err)
		appErr = th.App.DeleteToken(token)
		require.Nil(t, appErr)
	})

	t.Run("Should not authenticate the user when CWS token was used", func(t *testing.T) {
		token := model.NewToken(model.TokenTypeCWSAccess, "")
		th.App.Srv().SetCWSTokenOverride(token.Token)
		t.Cleanup(func() { th.App.Srv().SetCWSTokenOverride("") })
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer func() {
			appErr := th.App.DeleteToken(token)
			require.Nil(t, appErr)
		}()

		user, err := th.App.AuthenticateUserForLogin(th.Context, "", th.BasicUser.Username, "", "", token.Token, false)
		require.NotNil(t, err)
		require.Nil(t, user)
	})
}

func TestGetUserForLogin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("Should get user with username when sign in with username is enabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithUsername = model.NewPointer(true)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, "", th.BasicUser.Username)
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
	})

	t.Run("Should not get user with username when sign in with username is disabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithUsername = model.NewPointer(false)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, "", th.BasicUser.Username)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.Nil(t, user)
	})

	t.Run("Should get user with email when sign in with email is enabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = model.NewPointer(true)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, "", th.BasicUser.Email)
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
	})

	t.Run("Should not user with email when sign in with email is disabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = model.NewPointer(false)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, "", th.BasicUser.Email)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.Nil(t, user)
	})

	t.Run("Should get user with user ID when sign in with email is enabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = model.NewPointer(true)
			config.EmailSettings.EnableSignInWithUsername = model.NewPointer(false)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, th.BasicUser.Id, "")
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
	})

	t.Run("Should get user with user ID when sign in with username is enabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = model.NewPointer(false)
			config.EmailSettings.EnableSignInWithUsername = model.NewPointer(true)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, th.BasicUser.Id, "")
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
	})

	t.Run("Should not get user with user ID when both sign in with email and username are disabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = model.NewPointer(false)
			config.EmailSettings.EnableSignInWithUsername = model.NewPointer(false)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, th.BasicUser.Id, "")
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.Nil(t, user)
	})
}

func TestDoLogin_RespectsUserDeleteAt(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) UserWillLogIn(c *plugin.Context, user *model.User) string {
			_ = p.API.KVSet(user.Id, []byte("called"))
			return ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.Len(t, pluginIDs, 1)
	require.NoError(t, activationErrors[0])
	pluginID := pluginIDs[0]

	r := &http.Request{}

	for _, tc := range []struct {
		name       string
		kind       string
		deactivate bool
		wantErrID  string
		wantStatus int
	}{
		{name: "DeleteAt zero", kind: "user"},
		{
			name:       "DeleteAt set",
			kind:       "user",
			deactivate: true,
			wantErrID:  "api.user.login.inactive.app_error",
			wantStatus: http.StatusUnauthorized,
		},
		{name: "guest DeleteAt zero", kind: "guest"},
		{
			name:       "guest DeleteAt set",
			kind:       "guest",
			deactivate: true,
			wantErrID:  "api.user.login.inactive.app_error",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "system admin DeleteAt set",
			kind:       "admin",
			deactivate: true,
			wantErrID:  "api.user.login.inactive.app_error",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "bot DeleteAt zero",
			kind:       "bot",
			wantErrID:  "api.user.login.bot_login_forbidden.app_error",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "bot DeleteAt set",
			kind:       "bot",
			deactivate: true,
			wantErrID:  "api.user.login.inactive.app_error",
			wantStatus: http.StatusUnauthorized,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			var user *model.User
			switch tc.kind {
			case "guest":
				user = th.CreateGuest(t)
			case "admin":
				user = th.CreateUser(t)
				_, appErr := th.App.UpdateUserRoles(th.Context, user.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
				require.Nil(t, appErr)
				var getErr *model.AppError
				user, getErr = th.App.GetUser(user.Id)
				require.Nil(t, getErr)
			case "bot":
				bot := th.CreateBot(t)
				var getErr *model.AppError
				user, getErr = th.App.GetUser(bot.UserId)
				require.Nil(t, getErr)
			default:
				user = th.CreateUser(t)
			}
			if tc.deactivate {
				var appErr *model.AppError
				user, appErr = th.App.UpdateActive(th.Context, user, false)
				require.Nil(t, appErr)
			}

			sessionsBefore, getErr := th.App.GetSessions(th.Context, user.Id)
			require.Nil(t, getErr)

			// Checks that DoLogin consults user DeleteAt and IsBot before creating a session.
			session, err := th.App.DoLogin(th.Context, w, r, user, "", false, false, false)
			hookValue, kvErr := th.App.GetPluginKey(pluginID, user.Id)
			require.Nil(t, kvErr)
			if tc.wantErrID == "" {
				require.Nil(t, err)
				require.NotNil(t, session)
				assert.Equal(t, user.Id, session.UserId)
				assert.Equal(t, "called", string(hookValue))
				return
			}

			require.NotNil(t, err)
			require.Nil(t, session)
			assert.Equal(t, tc.wantStatus, err.StatusCode)
			assert.Equal(t, tc.wantErrID, err.Id)
			assert.Nil(t, hookValue, "UserWillLogIn must not run for a rejected user")

			sessionsAfter, getErr := th.App.GetSessions(th.Context, user.Id)
			require.Nil(t, getErr)
			assert.Equal(t, len(sessionsBefore), len(sessionsAfter))
		})
	}
}
