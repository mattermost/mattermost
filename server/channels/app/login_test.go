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
	license.Features.Cloud = new(true)
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
			config.EmailSettings.EnableSignInWithUsername = new(true)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, "", th.BasicUser.Username)
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
	})

	t.Run("Should not get user with username when sign in with username is disabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithUsername = new(false)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, "", th.BasicUser.Username)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.Nil(t, user)
	})

	t.Run("Should get user with email when sign in with email is enabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = new(true)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, "", th.BasicUser.Email)
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
	})

	t.Run("Should not user with email when sign in with email is disabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = new(false)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, "", th.BasicUser.Email)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.Nil(t, user)
	})

	t.Run("Should get user with user ID when sign in with email is enabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = new(true)
			config.EmailSettings.EnableSignInWithUsername = new(false)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, th.BasicUser.Id, "")
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
	})

	t.Run("Should get user with user ID when sign in with username is enabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = new(false)
			config.EmailSettings.EnableSignInWithUsername = new(true)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, th.BasicUser.Id, "")
		require.Nil(t, appErr)
		require.NotNil(t, user)
		require.Equal(t, th.BasicUser.Username, user.Username)
	})

	t.Run("Should not get user with user ID when both sign in with email and username are disabled", func(t *testing.T) {
		th.UpdateConfig(t, func(config *model.Config) {
			config.EmailSettings.EnableSignInWithEmail = new(false)
			config.EmailSettings.EnableSignInWithUsername = new(false)
		})

		user, appErr := th.App.GetUserForLogin(th.Context, th.BasicUser.Id, "")
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		require.Nil(t, user)
	})
}

func TestDoLoginVoIPDeviceId(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	r := &http.Request{}
	w := httptest.NewRecorder()

	// sessionCount returns the number of live sessions for the user — used to
	// verify "no session created" on validation failures.
	sessionCount := func(t *testing.T) int {
		t.Helper()
		sessions, err := th.App.GetSessions(th.Context, th.BasicUser.Id)
		require.Nil(t, err)
		return len(sessions)
	}

	// Expiry is computed from time.Now() inside DoLogin, so assert duration
	// from now within a tolerance rather than against an absolute value.
	assertExpiryHours := func(t *testing.T, session *model.Session, hours int) {
		t.Helper()
		expected := model.GetMillis() + int64(hours)*60*60*1000
		assert.InDelta(t, expected, session.ExpiresAt, float64(10*1000))
	}

	mobileHours := 720
	webHours := 240
	th.UpdateConfig(t, func(cfg *model.Config) {
		cfg.ServiceSettings.SessionLengthMobileInHours = &mobileHours
		cfg.ServiceSettings.SessionLengthWebInHours = &webHours
	})

	t.Run("no device tokens produces a web-length session without IsMobile", func(t *testing.T) {
		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{})
		require.Nil(t, err)
		require.NotNil(t, session)

		assert.Empty(t, session.DeviceId)
		assert.Empty(t, session.VoIPDeviceId)
		assert.NotEqual(t, "true", session.Props[model.UserAuthServiceIsMobile],
			"absence of any device token must not flip IsMobile")
		assertExpiryHours(t, session, webHours)
	})

	t.Run("DeviceId-only login produces a mobile session with the standard token", func(t *testing.T) {
		token := "apple_rn:standardhappy"
		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			DeviceId: token,
		})
		require.Nil(t, err)
		require.NotNil(t, session)

		assert.Equal(t, token, session.DeviceId)
		assert.Empty(t, session.VoIPDeviceId)
		assert.Equal(t, "true", session.Props[model.UserAuthServiceIsMobile])
		assertExpiryHours(t, session, mobileHours)
	})

	t.Run("VoIPDeviceId-only login produces a mobile session with the VoIP token", func(t *testing.T) {
		token := "apple_rn:voiphappy"
		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			VoIPDeviceId: token,
		})
		require.Nil(t, err)
		require.NotNil(t, session)

		assert.Empty(t, session.DeviceId)
		assert.Equal(t, token, session.VoIPDeviceId)
		assert.Equal(t, "true", session.Props[model.UserAuthServiceIsMobile],
			"presence of VoIPDeviceId must imply IsMobile")
		assertExpiryHours(t, session, mobileHours)
	})

	t.Run("rejects malformed VoIP token without creating a session", func(t *testing.T) {
		before := sessionCount(t)

		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			VoIPDeviceId: "bogus",
		})

		require.NotNil(t, err)
		require.Nil(t, session)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
		assert.Equal(t, "api.user.attach_device_id.invalid_voip_device_id.app_error", err.Id)
		assert.Equal(t, before, sessionCount(t), "validation must reject before any session is built")
	})

	t.Run("rejects android_rn token in the VoIP slot (iOS-only allowlist)", func(t *testing.T) {
		// android_rn is valid for the standard allowlist but not VoIP. This
		// pins down that the two validators are genuinely distinct.
		before := sessionCount(t)

		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			VoIPDeviceId: "android_rn:abcdef0123",
		})

		require.NotNil(t, err)
		require.Nil(t, session)
		assert.Equal(t, "api.user.attach_device_id.invalid_voip_device_id.app_error", err.Id)
		assert.Equal(t, before, sessionCount(t))
	})

	t.Run("rejects malformed standard DeviceId even when VoIP token is valid", func(t *testing.T) {
		// Validation order must not short-circuit on the first valid field —
		// a bad standard token should fail the whole login.
		before := sessionCount(t)

		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			DeviceId:     "bogus",
			VoIPDeviceId: "apple_rn:abcdef0123",
		})

		require.NotNil(t, err)
		require.Nil(t, session)
		assert.Equal(t, "api.user.attach_device_id.invalid_device_id.app_error", err.Id)
		assert.Equal(t, before, sessionCount(t))
	})

	t.Run("revokes prior session that registered the same VoIP token", func(t *testing.T) {
		voIPToken := "apple_rn:revoke-by-voip"

		prior, appErr := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			VoIPDeviceId: voIPToken,
		})
		require.Nil(t, appErr)
		require.NotNil(t, prior)

		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			VoIPDeviceId: voIPToken,
		})
		require.Nil(t, err)
		require.NotNil(t, session)

		// Prior session matching the VoIP token must be gone; the new one stays.
		_, getErr := th.App.GetSessionById(th.Context, prior.Id)
		require.NotNil(t, getErr, "prior session with the same VoIP token must be revoked")

		fresh, getErr := th.App.GetSessionById(th.Context, session.Id)
		require.Nil(t, getErr)
		require.NotNil(t, fresh)
	})

	t.Run("dual-token login revokes by DeviceId and VoIPDeviceId independently", func(t *testing.T) {
		// Two prior sessions: one matched by standard DeviceId, one by VoIPDeviceId.
		// A dual-token login must revoke both.
		standardToken := "apple_rn:dual-standard"
		voIPToken := "apple_rn:dual-voip"

		priorStandard, appErr := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			DeviceId: standardToken,
		})
		require.Nil(t, appErr)

		priorVoIP, appErr := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			VoIPDeviceId: voIPToken,
		})
		require.Nil(t, appErr)

		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{
			DeviceId:     standardToken,
			VoIPDeviceId: voIPToken,
		})
		require.Nil(t, err)
		require.NotNil(t, session)

		assert.Equal(t, standardToken, session.DeviceId)
		assert.Equal(t, voIPToken, session.VoIPDeviceId)

		_, getErr := th.App.GetSessionById(th.Context, priorStandard.Id)
		require.NotNil(t, getErr, "prior session matched by DeviceId must be revoked")
		_, getErr = th.App.GetSessionById(th.Context, priorVoIP.Id)
		require.NotNil(t, getErr, "prior session matched by VoIPDeviceId must be revoked")
	})
}
