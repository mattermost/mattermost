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

// waitForWebConnRegistered blocks until the hub has processed the
// WebConn registration. Without it, a test can race past the async
// register channel and signal invalidation against an empty connIndex.
func waitForWebConnRegistered(t *testing.T, th *TestHelper, session *model.Session) {
	t.Helper()
	require.Eventually(t, func() bool {
		return th.Service.SessionIsRegistered(*session)
	}, 2*time.Second, 10*time.Millisecond,
		"WebConn for session %q (user %q) was not registered with the hub in time",
		session.Id, session.UserId)
}

// preWarmStatusOnline marks the user online before any WebConn is
// created so the async SetStatusOnline goroutine in NewWebConn skips
// the broadcast path. Otherwise the broadcast can race with the
// invalidation and re-populate the WebConn's cached session via
// IsBasicAuthenticated, flipping the post-invalidate assertions.
func preWarmStatusOnline(th *TestHelper, userID string) {
	th.Service.AddStatusCacheSkipClusterSend(&model.Status{
		UserId:         userID,
		Status:         model.StatusOnline,
		LastActivityAt: model.GetMillis(),
	})
}

// TestClearSessionCacheInvalidatesWebConnSession asserts that after either
// the per-user or the global session-cache clear runs, every matching
// active WebSocket connection has its cached session reset to the
// authenticated-as-no-one state (GetSession() == nil and
// GetSessionExpiresAt() == 0).
func TestClearSessionCacheInvalidatesWebConnSession(t *testing.T) {
	mainHelper.Parallel(t)

	tests := []struct {
		name   string
		revoke func(ps *PlatformService, userID string)
	}{
		{
			name: "PerUserRevokeInvalidatesWebConnSession",
			revoke: func(ps *PlatformService, userID string) {
				ps.ClearSessionCacheForUserSkipClusterSend(userID)
			},
		},
		{
			name: "GlobalRevokeInvalidatesWebConnSession",
			revoke: func(ps *PlatformService, _ string) {
				_ = ps.ClearSessionCacheForAllUsersSkipClusterSend()
			},
		},
		{
			name: "InvalidateAllCachesInvalidatesWebConnSession",
			revoke: func(ps *PlatformService, _ string) {
				_ = ps.InvalidateAllCachesSkipSend()
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			s := httptest.NewServer(dummyWebsocketHandler(t))
			defer s.Close()

			session, err := th.Service.CreateSession(th.Context, &model.Session{
				UserId: th.BasicUser.Id,
			})
			require.NoError(t, err)

			// Pin a future expiry so IsBasicAuthenticated trusts the
			// cached session and doesn't re-validate against the store.
			session.ExpiresAt = model.GetMillis() + time.Hour.Milliseconds()

			preWarmStatusOnline(th, th.BasicUser.Id)

			wc := registerDummyWebConn(t, th, s.Listener.Addr(), session)
			defer wc.Close()

			waitForWebConnRegistered(t, th, session)

			require.NotNil(t, wc.GetSession(),
				"precondition: webconn must have a cached session before revoke")
			require.Greater(t, wc.GetSessionExpiresAt(), model.GetMillis(),
				"precondition: webconn cached session expiry must be in the future before revoke")

			tt.revoke(th.Service, th.BasicUser.Id)

			// Hub invalidation is async, so poll for the end state.
			require.Eventually(t, func() bool {
				return wc.GetSession() == nil && wc.GetSessionExpiresAt() == 0
			}, 2*time.Second, 25*time.Millisecond,
				"webconn cached session was not invalidated after %s; "+
					"expected GetSession()==nil and GetSessionExpiresAt()==0, "+
					"but got GetSession()!=nil=%t, GetSessionExpiresAt()=%d, GetSessionToken()=%q",
				tt.name,
				wc.GetSession() != nil,
				wc.GetSessionExpiresAt(),
				wc.GetSessionToken(),
			)
		})
	}
}

// TestInvalidateAllCachesDoesNotPermanentlyBreakUnrelatedSessions asserts
// that InvalidateAllCachesSkipSend (used e.g. by routine, non-revocation
// admin actions such as OAuth app deletion or license changes) forces
// WebConns to re-validate their cached session against the store, but
// preserves the underlying session token. As a result, a WebConn whose
// session is still valid in the store must be able to successfully
// re-authenticate afterwards, unlike a genuine "revoke all sessions for all
// users" call which intentionally and permanently deauthenticates every
// WebConn by clearing its session token too.
func TestInvalidateAllCachesDoesNotPermanentlyBreakUnrelatedSessions(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	session, err := th.Service.CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser.Id,
	})
	require.NoError(t, err)

	// Pin a future expiry so IsBasicAuthenticated trusts the cached
	// session and doesn't re-validate against the store yet.
	session.ExpiresAt = model.GetMillis() + time.Hour.Milliseconds()

	preWarmStatusOnline(th, th.BasicUser.Id)

	wc := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	defer wc.Close()

	waitForWebConnRegistered(t, th, session)

	require.NotNil(t, wc.GetSession(),
		"precondition: webconn must have a cached session before invalidation")
	require.NotEmpty(t, wc.GetSessionToken(),
		"precondition: webconn must have a session token before invalidation")

	_ = th.Service.InvalidateAllCachesSkipSend()

	// Hub invalidation is async, so poll for the cached session to be
	// reset, forcing the next IsBasicAuthenticated call to re-validate
	// against the store.
	require.Eventually(t, func() bool {
		return wc.GetSession() == nil && wc.GetSessionExpiresAt() == 0
	}, 2*time.Second, 25*time.Millisecond,
		"webconn cached session was not invalidated after InvalidateAllCachesSkipSend")

	// Unlike a genuine mass session revocation, the underlying session
	// token must be preserved, since this session was never actually
	// revoked in the store.
	require.Equal(t, session.Token, wc.GetSessionToken(),
		"InvalidateAllCachesSkipSend must not clear the session token of unrelated, still-valid sessions")

	// Because the token survived, the WebConn must be able to
	// successfully re-validate against the store and resume being
	// treated as authenticated.
	require.True(t, wc.IsBasicAuthenticated(),
		"webconn with a still-valid session must re-authenticate after InvalidateAllCachesSkipSend")
	require.NotNil(t, wc.GetSession(),
		"webconn must have repopulated its cached session after re-authenticating")
}
