// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

const (
	dayInMillis    = 86400000
	minuteInMillis = 60000
	grace          = 5 * 1000
	thirtyDays     = dayInMillis * 30
	thirtyMinutes  = minuteInMillis * 30
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

	th.service.sessionCache.SetWithExpiry(session.Token, session, 5*time.Minute)
	th.service.sessionCache.SetWithExpiry(session2.Token, session2, 5*time.Minute)

	keys, err := th.service.sessionCache.Keys()
	require.NoError(t, err)
	require.NotEmpty(t, keys)

	th.service.ClearUserSessionCache(session.UserId)

	rkeys, err := th.service.sessionCache.Keys()
	require.NoError(t, err)
	require.Lenf(t, rkeys, len(keys)-1, "should have one less: %d - %d != 1", len(keys), len(rkeys))
	require.NotEmpty(t, rkeys)

	th.service.ClearAllUsersSessionCache()

	rkeys, err = th.service.sessionCache.Keys()
	require.NoError(t, err)
	require.Empty(t, rkeys)
}

func TestSetSessionExpireInMinutes(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	now := model.GetMillis()
	createAt := now - (dayInMillis * 20)

	tests := []struct {
		name    string
		extend  bool
		create  bool
		minutes int
		want    int64
	}{
		{name: "zero minutes, extend", extend: true, create: true, minutes: 0, want: now},
		{name: "zero minutes, extend", extend: true, create: false, minutes: 0, want: now},
		{name: "zero minutes, no extend", extend: false, create: true, minutes: 0, want: createAt},
		{name: "zero minutes, no extend", extend: false, create: false, minutes: 0, want: now},
		{name: "thirty minutes, extend", extend: true, create: true, minutes: 30, want: now + thirtyMinutes},
		{name: "thirty minutes, extend", extend: true, create: false, minutes: 30, want: now + thirtyMinutes},
		{name: "thirty minutes, no extend", extend: false, create: true, minutes: 30, want: createAt + thirtyMinutes},
		{name: "thirty minutes, no extend", extend: false, create: false, minutes: 30, want: now + thirtyMinutes},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			th.UpdateConfig(func(cfg *model.Config) {
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
			th.service.SetSessionExpireInMinutes(session, tt.minutes)

			// must be within 5 seconds of expected time.
			require.GreaterOrEqual(t, session.ExpiresAt, tt.want-grace)
			require.LessOrEqual(t, session.ExpiresAt, tt.want+grace)
		})
	}
}

func TestOAuthRevokeAccessToken(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	err := th.service.RevokeAccessToken(model.NewRandomString(16))
	require.Error(t, err, "Should have failed due to an incorrect token")

	session := &model.Session{}
	session.CreateAt = model.GetMillis()
	session.UserId = model.NewId()
	session.Token = model.NewId()
	session.Roles = model.SystemUserRoleId
	th.service.SetSessionExpireInMinutes(session, 1)

	session, _ = th.service.CreateSession(session)
	err = th.service.RevokeAccessToken(session.Token)
	require.Error(t, err, "Should have failed does not have an access token")

	accessData := &model.AccessData{}
	accessData.Token = session.Token
	accessData.UserId = session.UserId
	accessData.RedirectUri = "http://example.com"
	accessData.ClientId = model.NewId()
	accessData.ExpiresAt = session.ExpiresAt

	_, nErr := th.service.oAuthStore.SaveAccessData(accessData)
	require.NoError(t, nErr)

	err = th.service.RevokeAccessToken(accessData.Token)
	require.NoError(t, err)
}
