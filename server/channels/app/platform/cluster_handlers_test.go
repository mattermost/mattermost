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

// waitForWebConnRegistered ensures the hub goroutine has processed the
// WebConn registration before the test issues invalidation signals.
// Without this, a fast-scheduled test can race past the async register
// channel and the invalidation arm will walk an empty connIndex,
// observably looking like "the fix did not invalidate the WebConn".
func waitForWebConnRegistered(t *testing.T, th *TestHelper, session *model.Session) {
	t.Helper()
	require.Eventually(t, func() bool {
		return th.Service.SessionIsRegistered(*session)
	}, 2*time.Second, 10*time.Millisecond,
		"WebConn for session %q (user %q) was not registered with the hub in time",
		session.Id, session.UserId)
}

// preWarmStatusOnline seeds the status cache so the asynchronous
// SetStatusOnline goroutine that NewWebConn fires off does not broadcast
// a "user is now online" event. That broadcast otherwise races with the
// hub's InvalidateUser handler: if the broadcast lands AFTER the
// post-invalidate WebConn state, the hub's broadcast loop calls
// WebConn.ShouldSendEvent -> IsAuthenticated -> IsBasicAuthenticated,
// which in turn calls Suite.GetSession on the now-invalidated WebConn
// and re-populates an empty session via the test's mockSuite. That
// makes the test's secure-end-state condition (GetSession()==nil and
// GetSessionExpiresAt()==0) flap to non-nil. By marking the user
// already-online before NewWebConn runs, SetStatusOnline takes the
// "no broadcast" branch and the race goes away. This does not weaken
// the contract being tested: invalidation is still the only signal
// that clears the cached session state.
func preWarmStatusOnline(th *TestHelper, userID string) {
	th.Service.AddStatusCacheSkipClusterSend(&model.Status{
		UserId:         userID,
		Status:         model.StatusOnline,
		LastActivityAt: model.GetMillis(),
	})
}

// TestClearSessionCacheInvalidatesWebConnSession is a regression contract test
// for MM-68543.
//
// Contract: after PlatformService.ClearSessionCacheForAllUsersSkipClusterSend
// is invoked (the global session-revocation path used by
// POST /api/v4/users/sessions/revoke/all), every active WebSocket connection
// across all hubs must have its cached authentication state invalidated —
// i.e. the same observable end state that the per-user revocation path
// produces today: WebConn.GetSession() returns nil and
// WebConn.GetSessionExpiresAt() is reset to 0.
//
// The per-user case is included as a parallel sanity check: it exercises the
// known-good code path and is expected to PASS today, which makes it obvious
// in the failure output that the global path is the one breaking the contract.
func TestClearSessionCacheInvalidatesWebConnSession(t *testing.T) {
	mainHelper.Parallel(t)

	tests := []struct {
		name   string
		revoke func(ps *PlatformService, userID string)
	}{
		{
			// Secure baseline. Should pass today.
			name: "PerUserRevokeInvalidatesWebConnSession",
			revoke: func(ps *PlatformService, userID string) {
				ps.ClearSessionCacheForUserSkipClusterSend(userID)
			},
		},
		{
			// Reproduces MM-68543. Should fail today: the global path
			// only purges the in-memory session cache and never signals
			// the websocket hubs, so live WebConns keep their cached
			// session state and continue to authenticate against the
			// (now-deleted) cached session.
			name: "GlobalRevokeInvalidatesWebConnSession",
			revoke: func(ps *PlatformService, _ string) {
				ps.ClearSessionCacheForAllUsersSkipClusterSend()
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

			// Make the cached session look "fresh" so that
			// WebConn.IsBasicAuthenticated would short-circuit on the
			// in-memory expiry check and never re-validate against the
			// store. This is the precondition that turns the missing
			// hub-side invalidation into a real authentication bypass.
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

			// Hub processing of InvalidateUser is async (the hub
			// goroutine reads from h.invalidateUser and then runs
			// webConn.InvalidateCache() on each matching connection),
			// so poll for the secure end state instead of sleeping.
			//
			// For the per-user path the hub is signaled, so this
			// converges within a few hundred milliseconds. For the
			// buggy global path the hub is never signaled, so this
			// times out and we report the still-cached state — which
			// is exactly the bug.
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
