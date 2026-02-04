# Remove WebSocket LastActivityAt Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove inaccurate LastActivityAt updates triggered by WebSocket connections - only explicit heartbeats and channel switches should update activity.

**Architecture:** Remove `UpdateLastActivityAtIfNeeded` calls from `NewWebConn` and `websocket_router.go` authentication handler. WebSocket connections themselves don't indicate real user activity - the AccurateStatuses heartbeat system handles activity tracking properly.

**Tech Stack:** Go, testify for assertions

---

### Task 1: Add failing test for NewWebConn not updating LastActivityAt

**Files:**
- Test: `server/channels/app/platform/accurate_statuses_test.go`

**Step 1: Write the failing test**

Add this test at the end of `accurate_statuses_test.go`:

```go
func TestWebSocketConnectionDoesNotUpdateLastActivityAt(t *testing.T) {
	t.Run("NewWebConn should NOT call UpdateLastActivityAtIfNeeded", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set a known LastActivityAt time in the past
		oldTime := model.GetMillis() - 60000 // 1 minute ago
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Create a session with old LastActivityAt
		session := &model.Session{
			Id:             model.NewId(),
			UserId:         th.BasicUser.Id,
			Token:          model.NewId(),
			LastActivityAt: oldTime,
		}
		err := th.Service.Store.Session().Save(request.EmptyContext(th.Service.Log()), session)
		require.NoError(t, err)

		// Create a new WebConn - this should NOT update LastActivityAt
		cfg := &WebConnConfig{
			WebSocket: &websocket.Conn{},
			Session:   *session,
		}
		_ = th.Service.NewWebConn(cfg, th.Suite, &hookRunner{})

		// Give async goroutine time to run (if it was going to)
		time.Sleep(100 * time.Millisecond)

		// Verify session LastActivityAt was NOT updated
		updatedSession, sessErr := th.Service.Store.Session().Get(request.EmptyContext(th.Service.Log()), session.Token)
		require.NoError(t, sessErr)

		// The session's LastActivityAt should still be the old time
		// (with some tolerance for the initial save operation)
		assert.LessOrEqual(t, updatedSession.LastActivityAt, oldTime+1000,
			"WebSocket connection should NOT update session LastActivityAt")
	})
}
```

**Step 2: Run test to verify it fails**

Run: `go test -v -run TestWebSocketConnectionDoesNotUpdateLastActivityAt ./server/channels/app/platform/...`

Expected: FAIL - session LastActivityAt gets updated because `NewWebConn` currently calls `UpdateLastActivityAtIfNeeded`

**Step 3: Commit failing test**

```bash
git add server/channels/app/platform/accurate_statuses_test.go
git commit -m "test: add failing test for WebSocket not updating LastActivityAt"
```

---

### Task 2: Remove UpdateLastActivityAtIfNeeded from NewWebConn

**Files:**
- Modify: `server/channels/app/platform/web_conn.go:204-209`

**Step 1: Remove the UpdateLastActivityAtIfNeeded call**

Change from:
```go
if cfg.Session.UserId != "" {
	ps.Go(func() {
		ps.SetStatusOnline(userID, false, device)
		ps.UpdateLastActivityAtIfNeeded(session)
	})
}
```

To:
```go
if cfg.Session.UserId != "" {
	ps.Go(func() {
		ps.SetStatusOnline(userID, false, device)
	})
}
```

**Step 2: Run test to verify it passes**

Run: `go test -v -run TestWebSocketConnectionDoesNotUpdateLastActivityAt ./server/channels/app/platform/...`

Expected: PASS

**Step 3: Commit**

```bash
git add server/channels/app/platform/web_conn.go
git commit -m "fix: remove inaccurate LastActivityAt update from NewWebConn

WebSocket connections don't indicate real user activity. The
AccurateStatuses heartbeat system properly tracks activity via
explicit window focus and channel switch events."
```

---

### Task 3: Remove UpdateLastActivityAtIfNeeded from WebSocket authentication handler

**Files:**
- Modify: `server/channels/app/platform/websocket_router.go:70-73`

**Step 1: Remove the UpdateLastActivityAtIfNeeded call**

Change from:
```go
conn.Platform.Go(func() {
	conn.Platform.SetStatusOnline(session.UserId, false, wsDevice)
	conn.Platform.UpdateLastActivityAtIfNeeded(*session)
})
```

To:
```go
conn.Platform.Go(func() {
	conn.Platform.SetStatusOnline(session.UserId, false, wsDevice)
})
```

**Step 2: Run all accurate statuses tests**

Run: `go test -v -run "TestUpdateActivity|TestWebSocket" ./server/channels/app/platform/...`

Expected: All PASS

**Step 3: Commit**

```bash
git add server/channels/app/platform/websocket_router.go
git commit -m "fix: remove inaccurate LastActivityAt update from WebSocket auth

WebSocket authentication challenge shouldn't update LastActivityAt.
Only explicit user actions (heartbeats with window focus, channel
switches) should be considered real activity."
```

---

### Task 4: Run full test suite and verify

**Step 1: Run platform tests**

Run: `go test -v ./server/channels/app/platform/...`

Expected: All PASS

**Step 2: Run status-related API tests**

Run: `go test -v -run Status ./server/channels/api4/...`

Expected: All PASS

**Step 3: Final commit if any cleanup needed**

If all tests pass, the implementation is complete.

---

## Summary

This plan removes `UpdateLastActivityAtIfNeeded` calls from:
1. `NewWebConn` in `web_conn.go` - called when creating a new WebSocket connection
2. WebSocket authentication handler in `websocket_router.go` - called when authenticating a WebSocket

After this change, LastActivityAt will only be updated by:
- Explicit heartbeats with `window_active=true` or channel changes (via `UpdateActivityFromHeartbeat`)
- Manual actions (via `UpdateActivityFromManualAction`)
- API calls that explicitly trigger activity updates
