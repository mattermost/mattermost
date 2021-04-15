// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestCache(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	session := &model.Session{
		Id:     model.NewId(),
		Token:  model.NewId(),
		UserId: model.NewId(),
	}

	session2 := &model.Session{
		Id:     model.NewId(),
		Token:  model.NewId(),
		UserId: model.NewId(),
	}

	th.App.Srv().sessionCache.SetWithExpiry(session.Token, session, 5*time.Minute)
	th.App.Srv().sessionCache.SetWithExpiry(session2.Token, session2, 5*time.Minute)

	keys, err := th.App.Srv().sessionCache.Keys()
	require.NoError(t, err)
	require.NotEmpty(t, keys)

	th.App.ClearSessionCacheForUser(session.UserId)

	rkeys, err := th.App.Srv().sessionCache.Keys()
	require.NoError(t, err)
	require.Lenf(t, rkeys, len(keys)-1, "should have one less: %d - %d != 1", len(keys), len(rkeys))
	require.NotEmpty(t, rkeys)

	th.App.ClearSessionCacheForAllUsers()

	rkeys, err = th.App.Srv().sessionCache.Keys()
	require.NoError(t, err)
	require.Empty(t, rkeys)
}

func TestGetSessionIdleTimeoutInMinutes(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	session := &model.Session{
		UserId: model.NewId(),
	}

	session, _ = th.App.CreateSession(session)

	th.App.Srv().SetLicense(model.NewTestLicense("compliance"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionIdleTimeoutInMinutes = 5 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExtendSessionLengthWithActivity = false })

	rsession, err := th.App.GetSession(session.Token)
	require.Nil(t, err)
	assert.Equal(t, rsession.Id, session.Id)

	// Test regular session, should timeout
	time := session.LastActivityAt - (1000 * 60 * 6)
	nErr := th.App.Srv().Store.Session().UpdateLastActivityAt(session.Id, time)
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

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	nErr = th.App.Srv().Store.Session().UpdateLastActivityAt(session.Id, time)
	require.NoError(t, nErr)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)

	// Test personal access token session, should not timeout
	session = &model.Session{
		UserId: model.NewId(),
	}
	session.AddProp(model.SESSION_PROP_TYPE, model.SESSION_TYPE_USER_ACCESS_TOKEN)

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	nErr = th.App.Srv().Store.Session().UpdateLastActivityAt(session.Id, time)
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

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	nErr = th.App.Srv().Store.Session().UpdateLastActivityAt(session.Id, time)
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

		session, err := th.App.CreateSession(&model.Session{UserId: guest.Id, Props: model.StringMap{model.SESSION_PROP_IS_GUEST: "true"}})
		require.Nil(t, err)

		rsession, err := th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SESSION_PROP_IS_GUEST])

		err = th.App.PromoteGuestToUser(guest, th.BasicUser.Id)
		require.Nil(t, err)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SESSION_PROP_IS_GUEST])

		th.App.ClearSessionCacheForUser(session.UserId)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SESSION_PROP_IS_GUEST])
	})

	t.Run("Demote User to Guest updates the session", func(t *testing.T) {
		user := th.CreateUser()

		session, err := th.App.CreateSession(&model.Session{UserId: user.Id, Props: model.StringMap{model.SESSION_PROP_IS_GUEST: "false"}})
		require.Nil(t, err)

		rsession, err := th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SESSION_PROP_IS_GUEST])

		err = th.App.DemoteUserToGuest(user)
		require.Nil(t, err)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SESSION_PROP_IS_GUEST])

		th.App.ClearSessionCacheForUser(session.UserId)
		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SESSION_PROP_IS_GUEST])
	})
}

const hourMillis int64 = 60 * 60 * 1000
const dayMillis int64 = 24 * hourMillis

func TestApp_GetSessionLengthInMillis(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthMobileInDays = 3 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthSSOInDays = 2 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthWebInDays = 1 })

	t.Run("get session length mobile", func(t *testing.T) {
		session := &model.Session{
			UserId:   model.NewId(),
			DeviceId: model.NewId(),
		}
		session, err := th.App.CreateSession(session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*3, sessionLength)
	})

	t.Run("get session length mobile when isMobile in props is set", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
			Props: map[string]string{
				model.USER_AUTH_SERVICE_IS_MOBILE: "true",
			},
		}
		session, err := th.App.CreateSession(session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*3, sessionLength)
	})

	t.Run("get session length mobile when isMobile in props is set and takes priority over saml", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
			Props: map[string]string{
				model.USER_AUTH_SERVICE_IS_MOBILE: "true",
				model.USER_AUTH_SERVICE_IS_SAML:   "true",
			},
		}
		session, err := th.App.CreateSession(session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*3, sessionLength)
	})

	t.Run("get session length SSO", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
			Props: map[string]string{
				model.USER_AUTH_SERVICE_IS_OAUTH: "true",
			},
		}
		session, err := th.App.CreateSession(session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*2, sessionLength)
	})

	t.Run("get session length SSO using props", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
			Props: map[string]string{
				model.USER_AUTH_SERVICE_IS_SAML: "true",
			}}
		session, err := th.App.CreateSession(session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*2, sessionLength)
	})

	t.Run("get session length web/LDAP", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
		}
		session, err := th.App.CreateSession(session)
		require.Nil(t, err)

		sessionLength := th.App.GetSessionLengthInMillis(session)
		require.Equal(t, dayMillis*1, sessionLength)
	})
}

func TestApp_ExtendExpiryIfNeeded(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ExtendSessionLengthWithActivity = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthMobileInDays = 3 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthSSOInDays = 2 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionLengthWebInDays = 1 })

	t.Run("expired session should not be extended", func(t *testing.T) {
		expires := model.GetMillis() - hourMillis
		session := &model.Session{
			UserId:    model.NewId(),
			ExpiresAt: expires,
		}
		session, err := th.App.CreateSession(session)
		require.Nil(t, err)

		ok := th.App.ExtendSessionExpiryIfNeeded(session)

		require.False(t, ok)
		require.Equal(t, expires, session.ExpiresAt)
		require.True(t, session.IsExpired())
	})

	t.Run("session within threshold should not be extended", func(t *testing.T) {
		session := &model.Session{
			UserId: model.NewId(),
		}
		session, err := th.App.CreateSession(session)
		require.Nil(t, err)

		expires := model.GetMillis() + th.App.GetSessionLengthInMillis(session)
		session.ExpiresAt = expires

		ok := th.App.ExtendSessionExpiryIfNeeded(session)

		require.False(t, ok)
		require.Equal(t, expires, session.ExpiresAt)
		require.False(t, session.IsExpired())
	})

	var tests = []struct {
		name    string
		session *model.Session
	}{
		{name: "mobile", session: &model.Session{UserId: model.NewId(), DeviceId: model.NewId(), Token: model.NewId()}},
		{name: "SSO", session: &model.Session{UserId: model.NewId(), IsOAuth: true, Token: model.NewId()}},
		{name: "web/LDAP", session: &model.Session{UserId: model.NewId(), Token: model.NewId()}},
	}
	for _, test := range tests {
		t.Run(fmt.Sprintf("%s session beyond threshold should update ExpiresAt", test.name), func(t *testing.T) {
			session, err := th.App.CreateSession(test.session)
			require.Nil(t, err)

			expires := model.GetMillis() + th.App.GetSessionLengthInMillis(session) - hourMillis
			session.ExpiresAt = expires

			ok := th.App.ExtendSessionExpiryIfNeeded(session)

			require.True(t, ok)
			require.Greater(t, session.ExpiresAt, expires)
			require.False(t, session.IsExpired())

			// check cache was updated
			var cachedSession *model.Session
			errGet := th.App.Srv().sessionCache.Get(session.Token, &cachedSession)
			require.NoError(t, errGet)
			require.Equal(t, session.ExpiresAt, cachedSession.ExpiresAt)

			// check database was updated.
			storedSession, nErr := th.App.Srv().Store.Session().Get(context.Background(), session.Token)
			require.NoError(t, nErr)
			require.Equal(t, session.ExpiresAt, storedSession.ExpiresAt)
		})
	}

}

const (
	dayInMillis = 86400000
	grace       = 5 * 1000
	thirtyDays  = dayInMillis * 30
)

func TestApp_SetSessionExpireInDays(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	now := model.GetMillis()
	createAt := now - (dayInMillis * 20)

	tests := []struct {
		name   string
		extend bool
		create bool
		days   int
		want   int64
	}{
		{name: "zero days, extend", extend: true, create: true, days: 0, want: now},
		{name: "zero days, extend", extend: true, create: false, days: 0, want: now},
		{name: "zero days, no extend", extend: false, create: true, days: 0, want: createAt},
		{name: "zero days, no extend", extend: false, create: false, days: 0, want: now},
		{name: "thirty days, extend", extend: true, create: true, days: 30, want: now + thirtyDays},
		{name: "thirty days, extend", extend: true, create: false, days: 30, want: now + thirtyDays},
		{name: "thirty days, no extend", extend: false, create: true, days: 30, want: createAt + thirtyDays},
		{name: "thirty days, no extend", extend: false, create: false, days: 30, want: now + thirtyDays},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.ExtendSessionLengthWithActivity = tt.extend
			})
			var create int64
			if tt.create {
				create = createAt
			}

			session := &model.Session{
				CreateAt:  create,
				ExpiresAt: model.GetMillis() + dayInMillis,
			}
			th.App.SetSessionExpireInDays(session, tt.days)

			// must be within 5 seconds of expected time.
			require.GreaterOrEqual(t, session.ExpiresAt, tt.want-grace)
			require.LessOrEqual(t, session.ExpiresAt, tt.want+grace)
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
	remoteId := model.NewId()

	rc := model.RemoteCluster{
		RemoteId:     remoteId,
		RemoteTeamId: model.NewId(),
		Name:         "test",
		Token:        token,
		CreatorId:    model.NewId(),
	}

	_, err := th.GetSqlStore().RemoteCluster().Save(&rc)
	require.NoError(t, err)

	t.Run("Valid remote token should return session", func(t *testing.T) {
		session, err := th.App.GetRemoteClusterSession(token, remoteId)
		require.Nil(t, err)
		require.NotNil(t, session)
		require.Equal(t, token, session.Token)
	})

	t.Run("Invalid remote token should return error", func(t *testing.T) {
		session, err := th.App.GetRemoteClusterSession(model.NewId(), remoteId)
		require.NotNil(t, err)
		require.Nil(t, session)
	})

	t.Run("Invalid remote id should return error", func(t *testing.T) {
		session, err := th.App.GetRemoteClusterSession(token, model.NewId())
		require.NotNil(t, err)
		require.Nil(t, session)
	})
}
