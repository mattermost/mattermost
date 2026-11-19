// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/password/hashers"
	"github.com/mattermost/mattermost/server/v8/channels/app/password/phcparser"
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

// countingCompareHasher counts CompareHashAndPassword calls for one password
// that actually ran the inner hasher's key derivation, so that parallel tests
// sharing the global test hasher do not affect the count.
type countingCompareHasher struct {
	inner    hashers.PasswordHasher
	password string
	compares atomic.Int64
}

func (h *countingCompareHasher) Hash(password string) (string, error) {
	return h.inner.Hash(password)
}

func (h *countingCompareHasher) IsPHCValid(phc phcparser.PHC) bool {
	return h.inner.IsPHCValid(phc)
}

func (h *countingCompareHasher) CompareHashAndPassword(phc phcparser.PHC, password string) error {
	err := h.inner.CompareHashAndPassword(phc, password)
	if password == h.password && (err == nil || errors.Is(err, hashers.ErrMismatchedHashAndPassword)) {
		h.compares.Add(1)
	}
	return err
}

func installCountingCompareHasher(t *testing.T, password string) *countingCompareHasher {
	t.Helper()
	previous := hashers.GetLatestHasher()
	h := &countingCompareHasher{inner: hashers.FastTestHasher(), password: password}
	hashers.SetTestHasher(h)
	t.Cleanup(func() { hashers.SetTestHasher(previous) })
	return h
}

func TestAuthenticateUserForLoginUnknownAccountHashes(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.EmailSettings.EnableSignInWithEmail = true
		*cfg.EmailSettings.EnableSignInWithUsername = true
		*cfg.ServiceSettings.MaximumLoginAttempts = 10
	})

	wrongPassword := "wrong-password-" + model.NewId()
	counter := installCountingCompareHasher(t, wrongPassword)

	user := th.CreateUser(t)

	testCases := []struct {
		name           string
		id             string
		loginID        string
		wantErrID      string
		wantStatusCode int
		wantCompare    bool
	}{
		{
			name:           "unknown username",
			loginID:        "unknown" + model.NewUsername(),
			wantErrID:      "store.sql_user.get_for_login.app_error",
			wantStatusCode: http.StatusBadRequest,
			wantCompare:    true,
		},
		{
			name:           "unknown email",
			loginID:        "unknown-" + model.NewId() + "@example.com",
			wantErrID:      "store.sql_user.get_for_login.app_error",
			wantStatusCode: http.StatusBadRequest,
			wantCompare:    true,
		},
		{
			name:           "unknown user id",
			id:             model.NewId(),
			wantErrID:      MissingAccountError,
			wantStatusCode: http.StatusBadRequest,
			wantCompare:    true,
		},
		{
			// checkUserPassword resolves the hasher from the stored PHC string and never
			// returns the installed test hasher, so the counter cannot observe this path.
			name:           "existing user with wrong password",
			loginID:        user.Username,
			wantErrID:      "api.user.check_user_password.invalid.app_error",
			wantStatusCode: http.StatusUnauthorized,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			before := counter.compares.Load()

			authUser, appErr := th.App.AuthenticateUserForLogin(th.Context, tc.id, tc.loginID, wrongPassword, "", "", false)
			require.NotNil(t, appErr)
			require.Nil(t, authUser)
			assert.Equal(t, tc.wantErrID, appErr.Id)
			assert.Equal(t, tc.wantStatusCode, appErr.StatusCode)

			if tc.wantCompare {
				assert.GreaterOrEqual(t, counter.compares.Load()-before, int64(1), "expected a password hash comparison for an unknown account")
			}
		})
	}
}

func TestAuthenticateUserForLoginNonPasswordAccountHashes(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.EmailSettings.EnableSignInWithEmail = true
		*cfg.EmailSettings.EnableSignInWithUsername = true
		*cfg.ServiceSettings.MaximumLoginAttempts = 10
		*cfg.LdapSettings.Enable = false
	})

	wrongPassword := "wrong-password-" + model.NewId()
	counter := installCountingCompareHasher(t, wrongPassword)

	testCases := []struct {
		name        string
		authService string
		wantErrID   string
	}{
		{
			name:        "gitlab account",
			authService: model.UserAuthServiceGitlab,
			wantErrID:   "api.user.login.use_auth_service.app_error",
		},
		{
			name:        "saml account",
			authService: model.UserAuthServiceSaml,
			wantErrID:   "api.user.login.use_auth_service.app_error",
		},
		{
			name:        "openid account",
			authService: model.ServiceOpenid,
			wantErrID:   "api.user.login.use_auth_service.app_error",
		},
		{
			name:        "ldap account with ldap unavailable",
			authService: model.UserAuthServiceLdap,
			wantErrID:   "api.user.login_ldap.not_available.app_error",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			authData := model.NewId()
			user, appErr := th.App.CreateUser(th.Context, &model.User{
				Email:         "success+" + model.NewId() + "@simulator.amazonses.com",
				Username:      "un_" + model.NewId(),
				EmailVerified: true,
				AuthService:   tc.authService,
				AuthData:      &authData,
			})
			require.Nil(t, appErr)

			for _, login := range []struct{ id, loginID string }{{loginID: user.Username}, {loginID: user.Email}, {id: user.Id}} {
				before := counter.compares.Load()

				authUser, appErr := th.App.AuthenticateUserForLogin(th.Context, login.id, login.loginID, wrongPassword, "", "", false)
				require.NotNil(t, appErr)
				require.Nil(t, authUser)
				assert.Equal(t, tc.wantErrID, appErr.Id)

				assert.GreaterOrEqual(t, counter.compares.Load()-before, int64(1), "expected a password hash comparison for an account that cannot sign in with a password")
			}
		})
	}
}
