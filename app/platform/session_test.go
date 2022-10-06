// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

const (
	dayInMillis = 86400000
	grace       = 5 * 1000
	thirtyDays  = dayInMillis * 30
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

	th.Service.sessionCache.SetWithExpiry(session.Token, session, 5*time.Minute)
	th.Service.sessionCache.SetWithExpiry(session2.Token, session2, 5*time.Minute)

	keys, err := th.Service.sessionCache.Keys()
	require.NoError(t, err)
	require.NotEmpty(t, keys)

	th.Service.ClearUserSessionCache(session.UserId)

	rkeys, err := th.Service.sessionCache.Keys()
	require.NoError(t, err)
	require.Lenf(t, rkeys, len(keys)-1, "should have one less: %d - %d != 1", len(keys), len(rkeys))
	require.NotEmpty(t, rkeys)

	th.Service.ClearAllUsersSessionCache()

	rkeys, err = th.Service.sessionCache.Keys()
	require.NoError(t, err)
	require.Empty(t, rkeys)
}

func TestSetSessionExpireInHours(t *testing.T) {
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
			th.Service.UpdateConfig(func(cfg *model.Config) {
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
			th.Service.SetSessionExpireInHours(session, tt.days*24)

			// must be within 5 seconds of expected time.
			require.GreaterOrEqual(t, session.ExpiresAt, tt.want-grace)
			require.LessOrEqual(t, session.ExpiresAt, tt.want+grace)
		})
	}
}

func TestOAuthRevokeAccessToken(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	err := th.Service.RevokeAccessToken(model.NewRandomString(16))
	require.Error(t, err, "Should have failed due to an incorrect token")

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.SystemUserRoleId
	th.Service.SetSessionExpireInHours(session, 24)

	session, _ = th.Service.CreateSession(session)
	err = th.Service.RevokeAccessToken(session.Token)
	require.Error(t, err, "Should have failed does not have an access token")

	accessData := &model.AccessData{}
	accessData.Token = session.Token
	accessData.UserId = session.UserId
	accessData.RedirectUri = "http://example.com"
	accessData.ClientId = model.NewId()
	accessData.ExpiresAt = session.ExpiresAt

	_, nErr := th.Service.Store.OAuth().SaveAccessData(accessData)
	require.NoError(t, nErr)

	err = th.Service.RevokeAccessToken(accessData.Token)
	require.NoError(t, err)
}

func TestRevokeSessionsForOAuthApp(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.SystemUserRoleId
	session.Props = model.StringMap{model.SessionPropOAuthAppID: "appID"}
	th.Service.SetSessionExpireInHours(session, 24)

	session, _ = th.Service.CreateSession(session)
	_, err := th.Service.GetSession(session.Token)
	require.NoError(t, err, "should have been created")

	session2 := &model.Session{}
	session2.CreateAt = model.GetMillis()
	session2.UserId = model.NewId()
	session2.Token = model.NewId()
	session2.Roles = model.SystemUserRoleId
	th.Service.SetSessionExpireInHours(session, 24)

	session2, _ = th.Service.CreateSession(session2)
	_, err = th.Service.GetSession(session2.Token)
	require.NoError(t, err, "should have been created")

	sessions, err := th.Service.Store.Session().GetSessionsForOAuthApp("appID")
	require.NoError(t, err, "should be able to get the sessions")
	require.Equal(t, 1, len(sessions), "should have the session just created")

	accessData := &model.AccessData{}
	accessData.Token = session.Token
	accessData.UserId = session.UserId
	accessData.RedirectUri = "http://example.com"
	accessData.ClientId = model.NewId()
	accessData.ExpiresAt = session.ExpiresAt

	_, nErr := th.Service.Store.OAuth().SaveAccessData(accessData)
	require.NoError(t, nErr)

	_, err = th.Service.Store.OAuth().GetAccessData(session.Token)
	require.NoError(t, err, "should have been created")

	err = th.Service.RevokeSessionsForOAuthApp("appID")
	require.NoError(t, err)

	_, err = th.Service.GetSession(session.Token)
	require.Error(t, err, "should have been deleted")

	_, err = th.Service.Store.OAuth().GetAccessData(session.Token)
	require.Error(t, err, "should have been deleted")
}
