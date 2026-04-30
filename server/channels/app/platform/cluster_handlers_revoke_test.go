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

// TestRevokeSessionsFromAllUsersInvalidatesWebConnSession is the
// end-to-end regression contract for MM-68543, sitting one layer above
// Phase 1's TestClearSessionCacheInvalidatesWebConnSession.
//
// Phase 1 directly invoked the internal helper
// PlatformService.ClearSessionCacheForAllUsersSkipClusterSend, which is
// only reached by remote nodes via the
// ClusterEventClearSessionCacheForAllUsers handler. The Phase 2
// candidate fix correctly wires the new
// invalidateWebConnSessionCacheForAllUsersSkipClusterSend helper into
// that *SkipClusterSend* entry point.
//
// However, the production caller behind
// POST /api/v4/users/sessions/revoke/all is
// PlatformService.RevokeSessionsFromAllUsers, which calls
// PlatformService.ClearAllUsersSessionCache (cluster-aware wrapper).
// That wrapper:
//
//  1. Calls ClearAllUsersSessionCacheLocal (purges the in-memory
//     session cache only, does NOT invoke the new fan-out helper); and
//  2. Broadcasts ClusterEventClearSessionCacheForAllUsers so remote
//     nodes' handlers can run ClearSessionCacheForAllUsersSkipClusterSend
//     (which DOES invoke the new fan-out).
//
// The originating node — the one whose admin actually called the API
// — therefore never runs the new helper. In single-node deployments
// (clusterIFace == nil) it is also never run anywhere. Every live
// WebConn on the originating node retains its cached session token and
// expiry, and IsBasicAuthenticated keeps short-circuiting on the
// in-memory expiry check until the original session would have
// expired — exactly the bypass MM-68543 was opened against.
//
// Secure contract this test pins down: after
// RevokeSessionsFromAllUsers returns, every live WebConn on this node
// must observably be in the same authenticated-as-no-one state that
// Phase 2 produces on the *SkipClusterSend* path — Session==nil,
// SessionExpiresAt==0, and SessionToken cleared — across multiple
// users (which naturally distribute across multiple hubs because hubs
// are sharded by hash(userID) mod runtime.NumCPU()) and across
// multiple WebConns per user (multi-device / multi-tab).
//
// Expected to FAIL today: the local node never invokes the fan-out
// helper, so the cached session state survives the revoke and
// Eventually times out reporting the still-populated state.
func TestRevokeSessionsFromAllUsersInvalidatesWebConnSession(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	// Use multiple distinct user IDs so the connections naturally
	// distribute across more than one hub via GetHubForUserId's
	// hash(userID) mod len(hubs) sharding. With the default
	// runtime.NumCPU() hubs (>=2 on every realistic test host) this
	// gives us coverage of the "iterate every hub" guarantee of the
	// fan-out helper. We also register multiple WebConns per user to
	// exercise the multi-device case (laptop + mobile + tab).
	type userConns struct {
		userID string
		wcs    []*WebConn
	}
	users := []*userConns{
		{userID: th.BasicUser.Id},
		{userID: th.BasicUser2.Id},
	}
	// Add synthetic users to widen hub coverage. We don't need real
	// User rows because CreateSession stores by UserId without an
	// FK round-trip on the cache path we exercise here.
	for range 4 {
		users = append(users, &userConns{userID: model.NewId()})
	}

	// Pre-warm every user's status to online before any WebConn is
	// created. NewWebConn fires off an async SetStatusOnline +
	// UpdateLastActivityAtIfNeeded goroutine; if SetStatusOnline finds
	// the user offline it broadcasts a status-change event that races
	// with the eventual hub.InvalidateAll signal. When the broadcast
	// lands AFTER invalidation, the hub's broadcast loop calls
	// WebConn.ShouldSendEvent -> IsAuthenticated -> IsBasicAuthenticated,
	// which calls Suite.GetSession on the now-invalidated WebConn and
	// re-populates an empty session through the test's mockSuite. That
	// flips GetSession() back to non-nil and breaks the secure-end-state
	// check below. Pre-warming forces SetStatusOnline down the
	// "no broadcast" branch so the race cannot happen, without changing
	// the contract being tested.
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

			// Pin the cached expiry well into the future. Without
			// this, IsBasicAuthenticated falls through the
			// short-circuit path and re-validates against the store,
			// masking the bug. With it, the bug is observable: the
			// in-memory cached session is what gates auth, and unless
			// the hub explicitly invalidates the WebConn it stays
			// authenticated.
			session.ExpiresAt = model.GetMillis() + time.Hour.Milliseconds()

			wc := registerDummyWebConn(t, th, s.Listener.Addr(), session)
			t.Cleanup(func() { wc.Close() })
			u.wcs = append(u.wcs, wc)

			waitForWebConnRegistered(t, th, session)
		}
	}

	// Preconditions: every WebConn starts with a populated cached
	// session, future expiry, and non-empty token. Without these the
	// rest of the test cannot distinguish "fix worked" from "we
	// never had cached state to begin with".
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

	// Production trigger. Note we deliberately exercise the public
	// PlatformService surface — the same one the API4 handler hits —
	// not the internal *SkipClusterSend variant Phase 1 uses.
	require.NoError(t, th.Service.RevokeSessionsFromAllUsers(),
		"RevokeSessionsFromAllUsers should not error")

	// The hub's invalidateAll arm runs asynchronously on the hub
	// goroutine, so we poll for the secure end state instead of
	// sleeping (mirrors Phase 1's pattern). If the fan-out is
	// correctly invoked from the production caller, this converges
	// within a few hundred milliseconds across all hubs. With the
	// current Phase 2 candidate fix the helper is never invoked from
	// this code path, so the loop times out and reports the first
	// still-populated WebConn — which is exactly the bug.
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
		"RevokeSessionsFromAllUsers must invalidate every live WebConn on every hub "+
			"and across multiple connections per user; first webconn still showing "+
			"cached auth state means the fan-out helper was not invoked on the originating node")
}
