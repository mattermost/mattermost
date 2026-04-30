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
