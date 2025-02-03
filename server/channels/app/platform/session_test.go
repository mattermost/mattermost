// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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

	err := th.Service.sessionCache.SetWithExpiry(session.Token, session, 5*time.Minute)
	require.NoError(t, err)
	err = th.Service.sessionCache.SetWithExpiry(session2.Token, session2, 5*time.Minute)
	require.NoError(t, err)

	var keys []string
	err = th.Service.sessionCache.Scan(func(in []string) error {
		keys = append(keys, in...)
		return nil
	})
	require.NoError(t, err)
	require.NotEmpty(t, keys)

	th.Service.ClearUserSessionCache(session.UserId)

	var rkeys []string
	err = th.Service.sessionCache.Scan(func(in []string) error {
		rkeys = append(rkeys, in...)
		return nil
	})
	require.NoError(t, err)
	require.Lenf(t, rkeys, len(keys)-1, "should have one less: %d - %d != 1", len(keys), len(rkeys))
	require.NotEmpty(t, rkeys)
	clear(rkeys)
	rkeys = []string{}

	th.Service.ClearAllUsersSessionCache()

	err = th.Service.sessionCache.Scan(func(in []string) error {
		rkeys = append(rkeys, in...)
		return nil
	})
	require.NoError(t, err)
	require.Len(t, rkeys, 0)
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

	err := th.Service.RevokeAccessToken(th.Context, model.NewRandomString(16))
	require.Error(t, err, "Should have failed due to an incorrect token")

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.SystemUserRoleId
	th.Service.SetSessionExpireInHours(session, 24)

	session, _ = th.Service.CreateSession(th.Context, session)
	err = th.Service.RevokeAccessToken(th.Context, session.Token)
	require.Error(t, err, "Should have failed does not have an access token")

	accessData := &model.AccessData{}
	accessData.Token = session.Token
	accessData.UserId = session.UserId
	accessData.RedirectUri = "http://example.com"
	accessData.ClientId = model.NewId()
	accessData.ExpiresAt = session.ExpiresAt

	_, nErr := th.Service.Store.OAuth().SaveAccessData(accessData)
	require.NoError(t, nErr)

	err = th.Service.RevokeAccessToken(th.Context, accessData.Token)
	require.NoError(t, err)
}

func TestUpdateSessionsIsGuest(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("Test session is demoted", func(t *testing.T) {
		user := th.CreateUserOrGuest(false)

		session := &model.Session{}
		session.CreateAt = model.GetMillis()
		session.UserId = user.Id
		session.Token = model.NewId()
		session.Roles = "fake_role"
		th.Service.SetSessionExpireInHours(session, 24)

		session, _ = th.Service.CreateSession(th.Context, session)

		demotedUser, err := th.Service.Store.User().DemoteUserToGuest(user.Id)
		require.NoError(t, err)
		require.Equal(t, model.SystemGuestRoleId, demotedUser.Roles)

		err = th.Service.UpdateSessionsIsGuest(th.Context, demotedUser, true)
		require.NoError(t, err)

		session, err = th.Service.GetSession(th.Context, session.Id)
		require.NoError(t, err)
		require.Equal(t, model.SystemGuestRoleId, session.Roles)
		require.Equal(t, "true", session.Props[model.SessionPropIsGuest])
	})

	t.Run("Test session is promoted", func(t *testing.T) {
		user := th.CreateUserOrGuest(true)

		session := &model.Session{}
		session.CreateAt = model.GetMillis()
		session.UserId = user.Id
		session.Token = model.NewId()
		session.Roles = "fake_role"
		th.Service.SetSessionExpireInHours(session, 24)

		session, _ = th.Service.CreateSession(th.Context, session)

		err := th.Service.Store.User().PromoteGuestToUser(user.Id)
		require.NoError(t, err)

		promotedUser, err := th.Service.Store.User().Get(th.Context.Context(), user.Id)
		require.NoError(t, err)
		err = th.Service.UpdateSessionsIsGuest(th.Context, promotedUser, false)
		require.NoError(t, err)

		session, err = th.Service.GetSession(th.Context, session.Id)
		require.NoError(t, err)
		require.Equal(t, model.SystemUserRoleId, session.Roles)
		require.Equal(t, "false", session.Props[model.SessionPropIsGuest])
	})
}
