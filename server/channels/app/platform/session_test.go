// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	dayInMillis = 86400000
	grace       = 5 * 1000
	thirtyDays  = dayInMillis * 30
)

func TestCache(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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

	err = th.Service.ClearAllUsersSessionCache()
	require.NoError(t, err)
	err = th.Service.sessionCache.Scan(func(in []string) error {
		rkeys = append(rkeys, in...)
		return nil
	})
	require.NoError(t, err)
	require.Len(t, rkeys, 0)
}

func TestSetSessionExpireInHours(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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
	mainHelper.Parallel(t)
	th := Setup(t)

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
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("Test session is demoted", func(t *testing.T) {
		user := th.CreateUserOrGuest(t, false)

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
		user := th.CreateUserOrGuest(t, true)

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

func TestRevokeSessionsForDeviceTokens(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Both revoke variants are structurally identical (one matches DeviceId,
	// the other VoIPDeviceId), and the invariants they must hold are the
	// same. Drive them through a single table.
	type variant struct {
		name          string
		setToken      func(s *model.Session, token string)
		revoke        func(userID, token, currentSessionID string) error
		emptyTokenErr error
	}

	variants := []variant{
		{
			name:     "RevokeOtherSessionsForDeviceId",
			setToken: func(s *model.Session, token string) { s.DeviceId = token },
			revoke: func(userID, token, currentSessionID string) error {
				return th.Service.RevokeOtherSessionsForDeviceId(th.Context, userID, token, currentSessionID)
			},
			emptyTokenErr: ErrEmptyDeviceId,
		},
		{
			name:     "RevokeOtherSessionsForVoIPDeviceId",
			setToken: func(s *model.Session, token string) { s.VoIPDeviceId = token },
			revoke: func(userID, token, currentSessionID string) error {
				return th.Service.RevokeOtherSessionsForVoIPDeviceId(th.Context, userID, token, currentSessionID)
			},
			emptyTokenErr: ErrEmptyVoIPDeviceId,
		},
	}

	createSession := func(t *testing.T, v variant, userID, token string) *model.Session {
		t.Helper()
		s := &model.Session{UserId: userID, Roles: model.SystemUserRoleId}
		v.setToken(s, token)
		saved, err := th.Service.CreateSession(th.Context, s)
		require.NoError(t, err)
		return saved
	}

	sessionExists := func(t *testing.T, id string) bool {
		t.Helper()
		_, err := th.Service.GetSessionByID(th.Context, id)
		return err == nil
	}

	for _, v := range variants {
		t.Run(v.name, func(t *testing.T) {
			t.Run("revokes the matching session", func(t *testing.T) {
				token := "apple_rn:revokes-matching-" + v.name
				target := createSession(t, v, th.BasicUser.Id, token)

				require.NoError(t, v.revoke(th.BasicUser.Id, token, ""))
				assert.False(t, sessionExists(t, target.Id), "matching session must be revoked")
			})

			t.Run("does not revoke the session passed as currentSessionId", func(t *testing.T) {
				// Self-skip: a session re-attaching its own token must not
				// revoke itself.
				token := "apple_rn:self-skip-" + v.name
				self := createSession(t, v, th.BasicUser.Id, token)

				require.NoError(t, v.revoke(th.BasicUser.Id, token, self.Id))
				assert.True(t, sessionExists(t, self.Id), "currentSessionId must be exempt from revocation")
			})

			t.Run("does not revoke sessions belonging to other users", func(t *testing.T) {
				// The function scopes by userID — a session with a matching
				// token on a different user must stay alive.
				token := "apple_rn:cross-user-" + v.name
				otherUserSession := createSession(t, v, th.BasicUser2.Id, token)

				require.NoError(t, v.revoke(th.BasicUser.Id, token, ""))
				assert.True(t, sessionExists(t, otherUserSession.Id),
					"session on a different user must not be revoked")
			})

			t.Run("empty token returns an error and revokes nothing", func(t *testing.T) {
				webSession := createSession(t, v, th.BasicUser.Id, "")

				err := v.revoke(th.BasicUser.Id, "", "")
				require.ErrorIs(t, err, v.emptyTokenErr)
				assert.True(t, sessionExists(t, webSession.Id),
					"empty-token revoke must not match sessions with no token in this slot")
			})

			t.Run("leaves siblings of the same user with different tokens alone", func(t *testing.T) {
				targetToken := "apple_rn:target-" + v.name
				siblingToken := "apple_rn:sibling-" + v.name

				target := createSession(t, v, th.BasicUser.Id, targetToken)
				sibling := createSession(t, v, th.BasicUser.Id, siblingToken)

				require.NoError(t, v.revoke(th.BasicUser.Id, targetToken, ""))
				assert.False(t, sessionExists(t, target.Id))
				assert.True(t, sessionExists(t, sibling.Id),
					"session with a different token must stay alive")
			})
		})
	}
}
