// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestRevokeSessionsFromAllUsersInvalidatesWebConnSession asserts that
// after the public RevokeSessionsFromAllUsers entry point returns,
// every live WebConn on this node — across multiple users (hashed to
// different hubs) and multiple connections per user — has its cached
// session reset to the authenticated-as-no-one state.
func TestRevokeSessionsFromAllUsersInvalidatesWebConnSession(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	// Spread connections across multiple hubs via GetHubForUserId's
	// hash(userID) mod len(hubs) sharding, and use multiple conns per
	// user to cover the multi-device case.
	type userConns struct {
		userID string
		wcs    []*WebConn
	}
	users := []*userConns{
		{userID: th.BasicUser.Id},
		{userID: th.BasicUser2.Id},
	}
	for range 4 {
		users = append(users, &userConns{userID: model.NewId()})
	}

	for _, u := range users {
		preWarmStatusOnline(th, u.userID)
	}

	const connsPerUser = 2
	for _, u := range users {
		for range connsPerUser {
			session, err := th.Service.CreateSession(th.Context, &model.Session{
				UserId: u.userID,
			})
			require.NoError(t, err)

			session.ExpiresAt = model.GetMillis() + time.Hour.Milliseconds()

			wc := registerDummyWebConn(t, th, s.Listener.Addr(), session)
			t.Cleanup(func() { wc.Close() })
			u.wcs = append(u.wcs, wc)

			waitForWebConnRegistered(t, th, session)
		}
	}

	for _, u := range users {
		for _, wc := range u.wcs {
			require.NotNil(t, wc.GetSession(),
				"precondition: webconn for user %q must have a cached session before revoke", u.userID)
			require.Greater(t, wc.GetSessionExpiresAt(), model.GetMillis(),
				"precondition: cached expiry for user %q must be in the future before revoke", u.userID)
			require.NotEmpty(t, wc.GetSessionToken(),
				"precondition: webconn for user %q must have a cached session token before revoke", u.userID)
		}
	}

	require.NoError(t, th.Service.RevokeSessionsFromAllUsers(),
		"RevokeSessionsFromAllUsers should not error")

	require.Eventually(t, func() bool {
		for _, u := range users {
			for _, wc := range u.wcs {
				if wc.GetSession() != nil {
					return false
				}
				if wc.GetSessionExpiresAt() != 0 {
					return false
				}
				if wc.GetSessionToken() != "" {
					return false
				}
			}
		}
		return true
	}, 5*time.Second, 25*time.Millisecond,
		"RevokeSessionsFromAllUsers did not invalidate every live WebConn across all hubs")
}
