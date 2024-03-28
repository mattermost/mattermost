// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetSessionIdleTimeoutInMinutes(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("Promote Guest to User updates the session", func(t *testing.T) {
		guest := th.CreateGuest()

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
		user := th.CreateUser()

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

const hourMillis int64 = 60 * 60 * 1000
const dayMillis int64 = 24 * hourMillis

func TestApp_GetSessionLengthInMillis(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

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
			}}
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
	th := Setup(t)
	defer th.TearDown()

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

	var tests = []struct {
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
	defer func() {
		os.Unsetenv("MM_CLOUD_API_KEY")
		th.TearDown()
	}()

	t.Run("Matching environment variable and token should return non-nil session", func(t *testing.T) {
		os.Setenv("MM_CLOUD_API_KEY", "mytoken")
		session, err := th.App.GetCloudSession("mytoken")
		require.Nil(t, err)
		require.NotNil(t, session)
		require.Equal(t, "mytoken", session.Token)
	})

	t.Run("Empty environment variable should return error", func(t *testing.T) {
		os.Setenv("MM_CLOUD_API_KEY", "")
		session, err := th.App.GetCloudSession("mytoken")
		require.Nil(t, session)
		require.NotNil(t, err)
		require.Equal(t, "api.context.invalid_token.error", err.Id)
	})

	t.Run("Mismatched env variable and token should return error", func(t *testing.T) {
		os.Setenv("MM_CLOUD_API_KEY", "mytoken")
		session, err := th.App.GetCloudSession("myincorrecttoken")
		require.Nil(t, session)
		require.NotNil(t, err)
		require.Equal(t, "api.context.invalid_token.error", err.Id)
	})
}

func TestGetRemoteClusterSession(t *testing.T) {
	th := Setup(t)
	token := model.NewId()
	remoteID := model.NewId()

	rc := model.RemoteCluster{
		RemoteId:     remoteID,
		RemoteTeamId: model.NewId(),
		Name:         "test",
		Token:        token,
		CreatorId:    model.NewId(),
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := th.BasicUser
	var sessions []*model.Session

	r := &http.Request{}
	w := httptest.NewRecorder()
	for i := 0; i < maxSessionsLimit; i++ {
		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, "", false, false, false)
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
	for i := 0; i < 10; i++ {
		session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, "", false, false, false)
		require.Nil(t, err, "should not have an error creating user sessions")

		// Remove oldest, append newest.
		sessions = sessions[1:]
		sessions = append(sessions, session)
		time.Sleep(1 * time.Millisecond)
	}

	// Ensure that we still only have the max allowed.
	gotSessions, _ = th.App.GetSessions(th.Context, user.Id)
	require.Equal(t, maxSessionsLimit, len(gotSessions), "should have maxSessionsLimit number of sessions")

	// Ensure the the oldest sessions were removed first.
	slices.Reverse(gotSessions)
	for i, sess := range gotSessions {
		require.Equal(t, sessions[i].Id, sess.Id)
	}
}
