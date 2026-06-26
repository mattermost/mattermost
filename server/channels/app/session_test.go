// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetSessionIdleTimeoutInMinutes(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	session := &model.Session{
		UserId: model.NewId(),
	}

	session, _ = th.App.CreateSession(th.Context, session)

	th.App.Srv().SetLicense(model.NewTestLicense("compliance"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionIdleTimeoutInMinutes = 5 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExtendSessionLengthWithActivity = false })

	rsession, err := th.App.GetSession(session.Token)
	require.Nil(t, err)
	assert.Equal(t, rsession.Id, session.Id)

	// Test regular session, should timeout
	time := session.LastActivityAt - (1000 * 60 * 6)
	nErr := th.App.Srv().Store().Session().UpdateLastActivityAt(session.Id, time)
	require.NoError(t, nErr)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	rsession, err = th.App.GetSession(session.Token)
	require.NotNil(t, err)
	assert.Equal(t, "api.context.invalid_token.error", err.Id)
	assert.Equal(t, "idle timeout", err.DetailedError)
	assert.Nil(t, rsession)

	// Test oauth session, should not timeout
	session = &model.Session{
		UserId:  model.NewId(),
		IsOAuth: true,
	}

	session, _ = th.App.CreateSession(th.Context, session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	nErr = th.App.Srv().Store().Session().UpdateLastActivityAt(session.Id, time)
	require.NoError(t, nErr)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)

	// Test personal access token session, should not timeout
	session = &model.Session{
		UserId: model.NewId(),
	}
	session.AddProp(model.SessionPropType, model.SessionTypeUserAccessToken)

	session, _ = th.App.CreateSession(th.Context, session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	nErr = th.App.Srv().Store().Session().UpdateLastActivityAt(session.Id, time)
	require.NoError(t, nErr)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)

	th.App.Srv().SetLicense(model.NewTestLicense("compliance"))

	// Test regular session with timeout set to 0, should not timeout
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionIdleTimeoutInMinutes = 0 })

	session = &model.Session{
		UserId: model.NewId(),
	}

	session, _ = th.App.CreateSession(th.Context, session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	nErr = th.App.Srv().Store().Session().UpdateLastActivityAt(session.Id, time)
	require.NoError(t, nErr)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)
}

func TestUpdateSessionOnPromoteDemote(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("Promote Guest to User updates the session", func(t *testing.T) {
		guest := th.CreateGuest(t)

		session, err := th.App.CreateSession(th.Context, &model.Session{UserId: guest.Id, Props: model.StringMap{model.SessionPropIsGuest: "true"}})
		require.Nil(t, err)

		rsession, err := th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SessionPropIsGuest])

		err = th.App.PromoteGuestToUser(th.Context, guest, th.BasicUser.Id)
		require.Nil(t, err)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SessionPropIsGuest])

		th.App.ClearSessionCacheForUser(session.UserId)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SessionPropIsGuest])
	})

	t.Run("Demote User to Guest updates the session", func(t *testing.T) {
		user := th.CreateUser(t)

		session, err := th.App.CreateSession(th.Context, &model.Session{UserId: user.Id, Props: model.StringMap{model.SessionPropIsGuest: "false"}})
		require.Nil(t, err)

		rsession, err := th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SessionPropIsGuest])

		err = th.App.DemoteUserToGuest(th.Context, user)
		require.Nil(t, err)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SessionPropIsGuest])

		th.App.ClearSessionCacheForUser(session.UserId)
		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SessionPropIsGuest])
	})
}

const (
	hourMillis int64 = 60 * 60 * 1000
	dayMillis  int64 = 24 * hourMillis
)

func TestApp_GetSessionLengthInMillis(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthMobileInHours = 3 * 24 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthSSOInHours = 2 * 24 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthWebInHours = 24 })

	t.Run("get session length mobile", func(t *testing.T) {
		session := &model.Session{
			UserId:   model.NewId(),
			DeviceId: model.NewId(),
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*3, sessionLength)
	})

	t.Run("get session length mobile when isMobile in props is set", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
			Props: map[string]string{
				model.UserAuthServiceIsMobile: "true",
			},
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*3, sessionLength)
	})

	t.Run("get session length mobile when isMobile in props is set and takes priority over saml", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
			Props: map[string]string{
				model.UserAuthServiceIsMobile: "true",
				model.UserAuthServiceIsSaml:   "true",
			},
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*3, sessionLength)
	})

	t.Run("get session length SSO", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
			Props: map[string]string{
				model.UserAuthServiceIsOAuth: "true",
			},
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*2, sessionLength)
	})

	t.Run("get session length SSO using props", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
			Props: map[string]string{
				model.UserAuthServiceIsSaml: "true",
			},
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*2, sessionLength)
	})

	t.Run("get session length web/LDAP", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*1, sessionLength)
	})
}

func TestApp_ExtendExpiryIfNeeded(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExtendSessionLengthWithActivity = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthMobileInHours = 3 * 24 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthSSOInHours = 2 * 24 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthWebInHours = 24 })

	t.Run("expired session should not be extended", func(t *testing.T) {
		expires := model.GetMillis() - hourMillis
		session := &model.Session{
			UserId:    model.NewId(),
			ExpiresAt: expires,
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		ok := th.App.ExtendSessionExpiryIfNeeded(th.Context, session)

		require.False(t, ok)
		require.Equal(t, expires, session.ExpiresAt)
		require.True(t, session.IsExpired())
	})

	t.Run("session within threshold should not be extended", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
		}
		session, err := th.App.CreateSession(th.Context, session)
		require.Nil(t, err)

		expires := model.GetMillis() + th.App.GetSessionLengthInMillis(session)
		session.ExpiresAt = expires

		ok := th.App.ExtendSessionExpiryIfNeeded(th.Context, session)

		require.False(t, ok)
		require.Equal(t, expires, session.ExpiresAt)
		require.False(t, session.IsExpired())
	})

	tests := []struct {
		enabled bool
		name    string
		session *model.Session
	}{
		{enabled: true, name: "mobile", session: &model.Session{UserId: model.NewId(), DeviceId: model.NewId(), Token: model.NewId()}},
		{enabled: true, name: "SSO", session: &model.Session{UserId: model.NewId(), IsOAuth: true, Token: model.NewId()}},
		{enabled: true, name: "web/LDAP", session: &model.Session{UserId: model.NewId(), Token: model.NewId()}},
		{enabled: false, name: "mobile", session: &model.Session{UserId: model.NewId(), DeviceId: model.NewId(), Token: model.NewId()}},
		{enabled: false, name: "SSO", session: &model.Session{UserId: model.NewId(), IsOAuth: true, Token: model.NewId()}},
		{enabled: false, name: "web/LDAP", session: &model.Session{UserId: model.NewId(), Token: model.NewId()}},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("%s session beyond threshold should update ExpiresAt based on feature enabled", test.name), func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExtendSessionLengthWithActivity = test.enabled })

			session, err := th.App.CreateSession(th.Context, test.session)
			require.Nil(t, err)

			expires := model.GetMillis() + th.App.GetSessionLengthInMillis(session) - hourMillis
			session.ExpiresAt = expires

			ok := th.App.ExtendSessionExpiryIfNeeded(th.Context, session)

			if !test.enabled {
				require.False(t, ok)
				require.Equal(t, expires, session.ExpiresAt)
				return
			}

			require.True(t, ok)
			require.Greater(t, session.ExpiresAt, expires)
			require.False(t, session.IsExpired())

			// check cache was updated
			cachedSession, errGet := th.App.ch.srv.platform.GetSession(th.Context, session.Token)
			require.NoError(t, errGet)
			require.Equal(t, session.ExpiresAt, cachedSession.ExpiresAt)

			// check database was updated.
			storedSession, nErr := th.App.Srv().Store().Session().Get(th.Context, session.Token)
			require.NoError(t, nErr)
			require.Equal(t, session.ExpiresAt, storedSession.ExpiresAt)
		})
	}
}

func TestGetCloudSession(t *testing.T) {
	th := Setup(t)

	t.Run("Matching environment variable and token should return non-nil session", func(t *testing.T) {
		// t.Setenv prevents t.Parallel — env var has no config equivalent
		t.Setenv("MM_CLOUD_API_KEY", "mytoken")
		session, err := th.App.GetCloudSession("mytoken")
		require.Nil(t, err)
		require.NotNil(t, session)
		require.Equal(t, "mytoken", session.Token)
	})

	t.Run("Empty environment variable should return error", func(t *testing.T) {
		// t.Setenv prevents t.Parallel — env var has no config equivalent
		t.Setenv("MM_CLOUD_API_KEY", "")
		session, err := th.App.GetCloudSession("mytoken")
		require.Nil(t, session)
		require.NotNil(t, err)
		require.Equal(t, "api.context.invalid_token.error", err.Id)
	})

	t.Run("Mismatched env variable and token should return error", func(t *testing.T) {
		// t.Setenv prevents t.Parallel — env var has no config equivalent
		t.Setenv("MM_CLOUD_API_KEY", "mytoken")
		session, err := th.App.GetCloudSession("myincorrecttoken")
		require.Nil(t, session)
		require.NotNil(t, err)
		require.Equal(t, "api.context.invalid_token.error", err.Id)
	})
}

func TestGetRemoteClusterSession(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	token := model.NewId()
	remoteID := model.NewId()

	rc := model.RemoteCluster{
		RemoteId:  remoteID,
		Name:      "test",
		SiteURL:   "https://test.example.com",
		Token:     token,
		CreatorId: model.NewId(),
	}

	_, err := th.GetSqlStore().RemoteCluster().Save(&rc)
	require.NoError(t, err)

	t.Run("Valid remote token should return session", func(t *testing.T) {
		session, err := th.App.GetRemoteClusterSession(token, remoteID)
		require.Nil(t, err)
		require.NotNil(t, session)
		require.Equal(t, token, session.Token)
	})

	t.Run("Invalid remote token should return error", func(t *testing.T) {
		session, err := th.App.GetRemoteClusterSession(model.NewId(), remoteID)
		require.NotNil(t, err)
		require.Nil(t, session)
	})

	t.Run("Invalid remote id should return error", func(t *testing.T) {
		session, err := th.App.GetRemoteClusterSession(token, model.NewId())
		require.NotNil(t, err)
		require.Nil(t, session)
	})
}

func TestSessionsLimit(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	user := th.BasicUser
	var sessions []*model.Session

	r := &http.Request{}
	w := httptest.NewRecorder()
	for range maxSessionsLimit {
		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{})
		require.Nil(t, err)
		sessions = append(sessions, session)
		time.Sleep(1 * time.Millisecond)
	}

	gotSessions, _ := th.App.GetSessions(th.Context, user.Id)
	require.Equal(t, maxSessionsLimit, len(gotSessions), "should have maxSessionsLimit number of sessions")

	// Ensure we are retrieving the same sessions.
	slices.Reverse(gotSessions)
	for i, sess := range gotSessions {
		require.Equal(t, sessions[i].Id, sess.Id)
	}

	// Now add 10 more.
	for range 10 {
		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{})
		require.Nil(t, err, "should not have an error creating user sessions")

		// Remove oldest, append newest.
		sessions = sessions[1:]
		sessions = append(sessions, session)
		time.Sleep(1 * time.Millisecond)
	}

	// Ensure that we still only have the max allowed.
	gotSessions, _ = th.App.GetSessions(th.Context, user.Id)
	require.Equal(t, maxSessionsLimit, len(gotSessions), "should have maxSessionsLimit number of sessions")

	// Ensure the oldest sessions were removed first.
	slices.Reverse(gotSessions)
	for i, sess := range gotSessions {
		require.Equal(t, sessions[i].Id, sess.Id)
	}
}

func TestSetExtraSessionProps(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	r := &http.Request{}
	w := httptest.NewRecorder()
	session, _ := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{})

	resetSession := func(session *model.Session) {
		session.AddProp("testProp", "")
		err := th.Server.Store().Session().UpdateProps(session)
		require.NoError(t, err)
		th.App.ClearSessionCacheForUser(session.UserId)
	}
	t.Run("do not update the session if there are no props", func(t *testing.T) {
		defer resetSession(session)
		appErr := th.App.SetExtraSessionProps(session, map[string]string{})
		require.Nil(t, appErr)
		updatedSession, _ := th.App.GetSession(session.Token)
		storeSession, _ := th.Server.Store().Session().Get(th.Context, session.Id)
		assert.Equal(t, session, updatedSession)
		assert.Equal(t, session, storeSession)
	})
	t.Run("update the session with the selected prop", func(t *testing.T) {
		defer resetSession(session)
		appErr := th.App.SetExtraSessionProps(session, map[string]string{"testProp": "true"})
		require.Nil(t, appErr)
		updatedSession, _ := th.App.GetSession(session.Token)
		storeSession, _ := th.Server.Store().Session().Get(th.Context, session.Id)
		assert.Equal(t, "true", updatedSession.Props["testProp"])
		assert.Equal(t, "true", storeSession.Props["testProp"])
	})
	t.Run("do not update the session if the prop is the same", func(t *testing.T) {
		defer resetSession(session)
		session.AddProp("testProp", "true")
		err := th.Server.Store().Session().UpdateProps(session)
		require.NoError(t, err)
		th.App.ClearSessionCacheForUser(session.UserId)

		appErr := th.App.SetExtraSessionProps(session, map[string]string{"testProp": "true"})
		require.Nil(t, appErr)
		updatedSession, _ := th.App.GetSession(session.Token)
		storeSession, _ := th.Server.Store().Session().Get(th.Context, session.Id)
		assert.Equal(t, session, updatedSession)
		assert.Equal(t, session, storeSession)
		assert.Equal(t, "true", updatedSession.Props["testProp"])
		assert.Equal(t, "true", storeSession.Props["testProp"])
	})
}

func setupPushServer(t *testing.T, th *TestHelper) *testPushNotificationHandler {
	t.Helper()
	handler := &testPushNotificationHandler{t: t, behavior: "simple"}
	pushServer := httptest.NewServer(http.HandlerFunc(handler.handleReq))
	t.Cleanup(pushServer.Close)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendPushNotifications = true
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
		*cfg.MobileEphemeralModeSettings.Enable = true
	})
	return handler
}

func TestSendMobileWipeSignal(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("do not send push when MobileEphemeralMode is disabled", func(t *testing.T) {
		handler := &testPushNotificationHandler{t: t, behavior: "simple"}
		pushServer := httptest.NewServer(http.HandlerFunc(handler.handleReq))
		defer pushServer.Close()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.SendPushNotifications = true
			*cfg.EmailSettings.PushNotificationServer = pushServer.URL
			*cfg.MobileEphemeralModeSettings.Enable = false
		})

		session := &model.Session{UserId: th.BasicUser.Id, DeviceId: "android:testdevice", ExpiresAt: model.GetMillis() + 100000}
		th.App.sendMobileWipeSignal(th.Context, session)
		require.Equal(t, 0, handler.numReqs())
	})

	t.Run("do not send push when push notifications are disabled", func(t *testing.T) {
		handler := &testPushNotificationHandler{t: t, behavior: "simple"}
		pushServer := httptest.NewServer(http.HandlerFunc(handler.handleReq))
		defer pushServer.Close()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.SendPushNotifications = false
			*cfg.EmailSettings.PushNotificationServer = pushServer.URL
			*cfg.MobileEphemeralModeSettings.Enable = true
		})

		session := &model.Session{UserId: th.BasicUser.Id, DeviceId: "android:testdevice", ExpiresAt: model.GetMillis() + 100000}
		th.App.sendMobileWipeSignal(th.Context, session)
		require.Equal(t, 0, handler.numReqs())
	})

	t.Run("do not send push for sessions without a device ID", func(t *testing.T) {
		handler := setupPushServer(t, th)

		// plain desktop session
		session := &model.Session{UserId: th.BasicUser.Id, ExpiresAt: model.GetMillis() + 100000}
		th.App.sendMobileWipeSignal(th.Context, session)

		// mobile-web session: isMobile prop set but no push token
		mobileWebSession := &model.Session{UserId: th.BasicUser.Id, ExpiresAt: model.GetMillis() + 100000}
		mobileWebSession.AddProp(model.UserAuthServiceIsMobile, "true")
		th.App.sendMobileWipeSignal(th.Context, mobileWebSession)

		require.Equal(t, 0, handler.numReqs())
	})

	t.Run("do not send push when device was already removed by the push proxy", func(t *testing.T) {
		handler := setupPushServer(t, th)

		session := &model.Session{UserId: th.BasicUser.Id, DeviceId: "android:testdevice", ExpiresAt: model.GetMillis() + 100000}
		session.AddProp(model.SessionPropLastRemovedDeviceId, "android:testdevice")
		th.App.sendMobileWipeSignal(th.Context, session)

		require.Equal(t, 0, handler.numReqs())
	})

	t.Run("send silent wipe push for mobile sessions", func(t *testing.T) {
		handler := setupPushServer(t, th)

		activeSession := &model.Session{UserId: th.BasicUser.Id, DeviceId: "android:testdevice", ExpiresAt: model.GetMillis() + 100000}
		th.App.sendMobileWipeSignal(th.Context, activeSession)

		expiredSession := &model.Session{UserId: th.BasicUser.Id, DeviceId: "android:testdevice", ExpiresAt: model.GetMillis() - 100000}
		th.App.sendMobileWipeSignal(th.Context, expiredSession)

		require.Equal(t, 2, handler.numReqs())
		n := handler.notifications()[0]
		require.Equal(t, model.PushTypeSession, n.Type)
		require.Equal(t, 1, n.ContentAvailable)
		require.Equal(t, model.PushSoundNone, n.Sound)
		require.Empty(t, n.Message)
	})

	t.Run("continues to remaining sessions when proxy returns PushStatusRemove", func(t *testing.T) {
		handler := &testPushNotificationHandler{t: t} // alternates: req 1 → REMOVE, req 2 → OK
		pushServer := httptest.NewServer(http.HandlerFunc(handler.handleReq))
		t.Cleanup(pushServer.Close)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.SendPushNotifications = true
			*cfg.EmailSettings.PushNotificationServer = pushServer.URL
			*cfg.MobileEphemeralModeSettings.Enable = true
		})

		session1 := &model.Session{UserId: th.BasicUser.Id, DeviceId: "android:device1", ExpiresAt: model.GetMillis() + 100000}
		session2 := &model.Session{UserId: th.BasicUser.Id, DeviceId: "apple:device2", ExpiresAt: model.GetMillis() + 100000}
		th.App.sendMobileWipeSignal(th.Context, session1, session2)

		require.Equal(t, 2, handler.numReqs())
	})

	t.Run("continues to remaining sessions when proxy returns PushStatusFail", func(t *testing.T) {
		handler := &testPushNotificationHandler{t: t, behavior: "fail"}
		pushServer := httptest.NewServer(http.HandlerFunc(handler.handleReq))
		t.Cleanup(pushServer.Close)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.SendPushNotifications = true
			*cfg.EmailSettings.PushNotificationServer = pushServer.URL
			*cfg.MobileEphemeralModeSettings.Enable = true
		})

		session1 := &model.Session{UserId: th.BasicUser.Id, DeviceId: "android:device1", ExpiresAt: model.GetMillis() + 100000}
		session2 := &model.Session{UserId: th.BasicUser.Id, DeviceId: "apple:device2", ExpiresAt: model.GetMillis() + 100000}
		th.App.sendMobileWipeSignal(th.Context, session1, session2)

		require.Equal(t, 2, handler.numReqs())
	})
}

func TestRevokeAllSessionsSendsWipeSignal(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	handler := setupPushServer(t, th)

	// active mobile session — should receive a wipe push
	_, appErr := th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  "android:testdevice",
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, appErr)

	// expired mobile session — must also receive a wipe push to clear stale local data
	_, appErr = th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  "apple:expireddevice",
		ExpiresAt: model.GetMillis() - 100000,
	})
	require.Nil(t, appErr)

	// desktop session — no push expected
	_, appErr = th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, appErr)

	appErr = th.App.RevokeAllSessions(th.Context, th.BasicUser.Id)
	require.Nil(t, appErr)

	require.Eventually(t, func() bool { return handler.numReqs() == 2 }, 5*time.Second, 100*time.Millisecond)
}

func TestRevokeSessionsFromAllUsersSendsWipeSignal(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	handler := setupPushServer(t, th)

	_, appErr := th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  "apple:device1",
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, appErr)

	_, appErr = th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser2.Id,
		DeviceId:  "android:device2",
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, appErr)

	// expired mobile session — must also receive a wipe push to clear stale local data
	_, appErr = th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  "android:expireddevice",
		ExpiresAt: model.GetMillis() - 100000,
	})
	require.Nil(t, appErr)

	appErr = th.App.RevokeSessionsFromAllUsers(th.Context)
	require.Nil(t, appErr)

	require.Eventually(t, func() bool { return handler.numReqs() == 3 }, 5*time.Second, 100*time.Millisecond)
}

func TestRevokeSessionsFromAllUsersNoWipeWhenMobileEphemeralModeDisabled(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	handler := &testPushNotificationHandler{t: t, behavior: "simple"}
	pushServer := httptest.NewServer(http.HandlerFunc(handler.handleReq))
	t.Cleanup(pushServer.Close)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendPushNotifications = true
		*cfg.EmailSettings.PushNotificationServer = pushServer.URL
		*cfg.MobileEphemeralModeSettings.Enable = false
	})

	_, appErr := th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  "apple:device1",
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, appErr)

	appErr = th.App.RevokeSessionsFromAllUsers(th.Context)
	require.Nil(t, appErr)

	require.Never(t, func() bool { return handler.numReqs() > 0 }, time.Second, 100*time.Millisecond)
}

func TestRevokeSessionSendsWipeSignal(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	handler := setupPushServer(t, th)

	session, appErr := th.App.CreateSession(th.Context, &model.Session{
		UserId:    th.BasicUser.Id,
		DeviceId:  "apple:device1",
		ExpiresAt: model.GetMillis() + 100000,
	})
	require.Nil(t, appErr)

	appErr = th.App.RevokeSession(th.Context, session)
	require.Nil(t, appErr)

	require.Eventually(t, func() bool { return handler.numReqs() == 1 }, 5*time.Second, 100*time.Millisecond)
}
