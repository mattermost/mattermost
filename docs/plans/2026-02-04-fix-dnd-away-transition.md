# Fix DND→Offline→Away Bug Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where DND users who go Offline (due to DND inactivity timeout) incorrectly transition to Away status, losing their DND restoration.

**Architecture:** Add a guard in `SetStatusAwayIfNeeded` to skip the Away transition when user is Offline with `PrevStatus=dnd`. This preserves the DND restoration mechanism.

**Tech Stack:** Go, testify (assert/require)

---

## Background

When AccurateStatuses is enabled:
1. DND user goes inactive → DND inactivity timeout triggers → set to Offline with `prevStatus=dnd`
2. BUG: `SetStatusAwayIfNeeded` runs → sets user to Away (losing `prevStatus`)
3. User becomes active → goes to Online instead of restoring DND

Expected behavior:
1. DND user goes inactive → set to Offline with `prevStatus=dnd`
2. User stays Offline indefinitely (notifications still suppressed via prevStatus)
3. User becomes active → restore to DND

---

## Task 1: Add Failing Test for SetStatusAwayIfNeeded

**Files:**
- Modify: `server/channels/app/platform/accurate_statuses_test.go:441-519`

**Step 1: Write the failing test**

Add this test case to `TestSetStatusAwayIfNeededExtended`:

```go
	t.Run("should NOT set Away when Offline with PrevStatus=DND", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set config for short timeout
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.UserStatusAwayTimeout = 1 // 1 second
		})

		// User was DND, went offline due to DND inactivity (prevStatus preserved)
		oldTime := model.GetMillis() - 5000 // 5 seconds ago (past 1 second timeout)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd, // KEY: was DND before going offline
			Manual:         false,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetStatusAwayIfNeeded
		th.Service.SetStatusAwayIfNeeded(th.BasicUser.Id, false)

		// Should remain Offline (NOT Away) to preserve DND restoration
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.Equal(t, model.StatusDnd, after.PrevStatus) // PrevStatus should be preserved
	})
```

**Step 2: Verify test location**

The test should be added at the end of `TestSetStatusAwayIfNeededExtended` function (after line 518, before the closing brace on line 519).

---

## Task 2: Add Failing Test for Full DND→Offline→Activity Flow

**Files:**
- Modify: `server/channels/app/platform/dnd_extended_test.go`

**Step 1: Write the failing test**

Add this test at the end of the file (after `TestDNDWithNoOffline`):

```go
func TestDNDOfflineDoesNotTransitionToAway(t *testing.T) {
	t.Run("DND user that went Offline should NOT transition to Away via SetStatusAwayIfNeeded", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.TeamSettings.UserStatusAwayTimeout = 1                             // 1 second
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 1 // 1 minute
		})

		// Step 1: User sets DND
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis(),
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Step 2: Simulate DND inactivity timeout - user goes offline
		// This is what happens in UpdateActivityFromHeartbeat when DND user is inactive too long
		offlineStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (2 * 60 * 1000), // 2 minutes ago
		}
		th.Service.SaveAndBroadcastStatus(offlineStatus)

		// Step 3: SetStatusAwayIfNeeded is called (e.g., from WebSocket disconnect handler)
		// This should NOT change the status to Away
		th.Service.SetStatusAwayIfNeeded(th.BasicUser.Id, false)

		// Verify user is still Offline (not Away)
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status, "User should remain Offline, not transition to Away")
		assert.Equal(t, model.StatusDnd, after.PrevStatus, "PrevStatus should be preserved for DND restoration")

		// Step 4: User shows activity - should restore DND
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		restored, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, restored.Status, "User should be restored to DND")
		assert.True(t, restored.Manual, "Restored DND should be manual")
		assert.Equal(t, "", restored.PrevStatus, "PrevStatus should be cleared after restoration")
	})
}
```

---

## Task 3: Implement the Fix in SetStatusAwayIfNeeded

**Files:**
- Modify: `server/channels/app/platform/status.go:855-907`

**Step 1: Add the guard clause**

In `SetStatusAwayIfNeeded`, add a check after the existing `status.Manual` check (around line 868):

```go
func (ps *PlatformService) SetStatusAwayIfNeeded(userID string, manual bool) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	status, err := ps.GetStatus(userID)

	if err != nil {
		status = &model.Status{UserId: userID, Status: model.StatusOffline, Manual: manual, LastActivityAt: 0, ActiveChannel: ""}
	}

	if !manual && status.Manual {
		return // manually set status always overrides non-manual one
	}

	// Don't set Away if user was DND and went Offline due to DND inactivity timeout.
	// They should stay Offline (preserving notification suppression via PrevStatus)
	// until they show activity, at which point DND will be restored.
	if status.Status == model.StatusOffline && status.PrevStatus == model.StatusDnd {
		return
	}

	if !manual {
		if status.Status == model.StatusAway {
			return
		}

		if !ps.isUserAway(status.LastActivityAt) {
			return
		}
	}

	// ... rest of function unchanged
```

The complete fix is adding these 5 lines after line 868:

```go
	// Don't set Away if user was DND and went Offline due to DND inactivity timeout.
	// They should stay Offline (preserving notification suppression via PrevStatus)
	// until they show activity, at which point DND will be restored.
	if status.Status == model.StatusOffline && status.PrevStatus == model.StatusDnd {
		return
	}
```

---

## Task 4: Commit Changes

**Step 1: Stage all changes**

```bash
git add server/channels/app/platform/status.go server/channels/app/platform/accurate_statuses_test.go server/channels/app/platform/dnd_extended_test.go
```

**Step 2: Commit**

```bash
git commit -m "fix: prevent DND users from transitioning Offline→Away

When a DND user goes Offline due to DND inactivity timeout, they should
stay Offline until they show activity, at which point their DND status
is restored. Previously, SetStatusAwayIfNeeded would incorrectly set
them to Away, losing the PrevStatus=dnd marker needed for restoration.

This adds a guard clause to skip the Away transition when the user is
Offline with PrevStatus=dnd."
```

---

## Task 5: Push and Trigger Tests

**Step 1: Push to trigger GitHub Actions**

```bash
git push origin master
```

**Step 2: Monitor test results**

Check: https://github.com/stalecontext/mattermost-extended/actions

The custom tests (`test.yml`) will run automatically and verify the fix.

---

## Summary of Changes

| File | Change |
|------|--------|
| `server/channels/app/platform/status.go` | Add guard clause in `SetStatusAwayIfNeeded` (5 lines) |
| `server/channels/app/platform/accurate_statuses_test.go` | Add test case for Offline+PrevStatus=DND scenario |
| `server/channels/app/platform/dnd_extended_test.go` | Add integration test for full DND→Offline→Activity flow |

## Expected Test Output

After implementing the fix, all tests should pass:

```
=== RUN   TestSetStatusAwayIfNeededExtended
=== RUN   TestSetStatusAwayIfNeededExtended/should_NOT_set_Away_when_Offline_with_PrevStatus=DND
--- PASS: TestSetStatusAwayIfNeededExtended/should_NOT_set_Away_when_Offline_with_PrevStatus=DND
...
=== RUN   TestDNDOfflineDoesNotTransitionToAway
=== RUN   TestDNDOfflineDoesNotTransitionToAway/DND_user_that_went_Offline_should_NOT_transition_to_Away_via_SetStatusAwayIfNeeded
--- PASS: TestDNDOfflineDoesNotTransitionToAway/DND_user_that_went_Offline_should_NOT_transition_to_Away_via_SetStatusAwayIfNeeded
```
