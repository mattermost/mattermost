# Status Transition Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all status transition logic into a centralized `StatusTransitionManager` that handles all status changes with consistent rules, DND restoration, logging, and broadcasting.

**Architecture:** Create a new `StatusTransitionManager` struct with a single `TransitionStatus()` method that encapsulates all status change rules. When `AccurateStatuses` is enabled, all status changes route through this manager. When disabled, existing code paths remain unchanged for backwards compatibility.

**Tech Stack:** Go, testify (assert/require)

---

## Background

### Current State (Duplicated Logic)

Status transitions are scattered across 6+ functions with duplicated logic:

| Function | File | DND Restoration | Manual Check | NoOffline | Logging |
|----------|------|-----------------|--------------|-----------|---------|
| `SetActiveChannel` | channel.go:2819 | ✓ | ✓ | ✓ | ✓ |
| `SetStatusOnline` | status.go:576 | ✓ | ✓ | ✗ | ✓ |
| `SetStatusOffline` | status.go:689 | ✗ | ✓ | ✗ | ✓ |
| `SetStatusAwayIfNeeded` | status.go:855 | ✓ (guard) | ✓ | ✗ | ✓ |
| `UpdateActivityFromManualAction` | status.go:328 | ✓ | ✓ | ✓ | ✓ |
| `UpdateActivityFromHeartbeat` | status.go:1033 | ✓ | ✓ | ✓ | ✓ |
| `SetOnlineIfNoOffline` | status.go:483 | ✓ | ✓ | ✓ | ✓ |

### Target State (Centralized)

All transitions go through `StatusTransitionManager.TransitionStatus()` which:
1. Validates the transition is allowed
2. Applies DND restoration rules
3. Handles NoOffline rules
4. Respects manual status settings
5. Updates LastActivityAt appropriately
6. Saves to cache and database
7. Broadcasts status change
8. Logs the transition

---

## Status Transition Rules

### Valid Transitions Matrix

```
From/To      | Online | Away | Offline | DND | OOO |
-------------|--------|------|---------|-----|-----|
Online       |   -    |  ✓   |    ✓    |  ✓  |  ✓  |
Away         |   ✓    |  -   |    ✓    |  ✓  |  ✓  |
Offline      |   ✓*   |  ✗** |    -    |  ✓* |  ✓  |
DND          |   ✓    |  ✗   |    ✓    |  -  |  ✓  |
OOO          |   ✓    |  ✗   |    ✓    |  ✓  |  -  |

* = May restore to DND if PrevStatus=DND
** = Blocked by our fix (preserves DND restoration)
```

### Priority Rules (in order)

1. **Manual trumps automatic** - If `status.Manual=true` and transition is automatic, reject
2. **DND restoration** - If `Offline+PrevStatus=DND` and transitioning to Online, restore DND instead
3. **NoOffline override** - If NoOffline enabled and going to Online from Offline, allow even if manual
4. **DND/OOO protection** - DND and OOO statuses can only be changed by explicit user action (manual=true)
5. **Away protection for DND-Offline** - Don't set Away when Offline+PrevStatus=DND

---

## Task 1: Create StatusTransitionManager Struct and Types

**Files:**
- Create: `server/channels/app/platform/status_transition_manager.go`
- Test: `server/channels/app/platform/status_transition_manager_test.go`

**Step 1: Create the types and struct**

```go
// server/channels/app/platform/status_transition_manager.go
package platform

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// StatusTransitionReason describes why a status transition is occurring
type StatusTransitionReason string

const (
	TransitionReasonManual           StatusTransitionReason = "manual"           // User explicitly set status
	TransitionReasonConnect          StatusTransitionReason = "connect"          // WebSocket connected
	TransitionReasonDisconnect       StatusTransitionReason = "disconnect"       // WebSocket disconnected
	TransitionReasonInactivity       StatusTransitionReason = "inactivity"       // Inactivity timeout
	TransitionReasonActivity         StatusTransitionReason = "activity"         // User showed activity
	TransitionReasonDNDExpired       StatusTransitionReason = "dnd_expired"      // Timed DND expired
	TransitionReasonDNDInactivity    StatusTransitionReason = "dnd_inactivity"   // DND user went inactive
	TransitionReasonChannelView      StatusTransitionReason = "channel_view"     // User viewed a channel
	TransitionReasonHeartbeat        StatusTransitionReason = "heartbeat"        // Heartbeat with activity
)

// StatusTransitionOptions configures a status transition request
type StatusTransitionOptions struct {
	UserID        string
	NewStatus     string                 // Target status (Online, Away, Offline, DND, OOO)
	Reason        StatusTransitionReason // Why the transition is happening
	Manual        bool                   // Is this an explicit user action?
	Force         bool                   // Force transition even if manual status is set
	Device        string                 // Device initiating the transition
	ChannelID     string                 // Active channel (if applicable)
	WindowActive  bool                   // Is the user's window active?
	DNDEndTime    int64                  // For timed DND (seconds, not milliseconds)
}

// StatusTransitionResult contains the outcome of a transition attempt
type StatusTransitionResult struct {
	Changed       bool           // Did the status actually change?
	OldStatus     string         // Previous status
	NewStatus     string         // New status (may differ from requested due to DND restoration)
	Status        *model.Status  // The updated status object
	Reason        string         // Reason for the outcome (for logging)
}

// StatusTransitionManager handles all status transitions with consistent rules
type StatusTransitionManager struct {
	ps *PlatformService
}

// NewStatusTransitionManager creates a new status transition manager
func NewStatusTransitionManager(ps *PlatformService) *StatusTransitionManager {
	return &StatusTransitionManager{ps: ps}
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status_transition_manager.go
git commit -m "feat: add StatusTransitionManager types and struct"
```

---

## Task 2: Implement Core TransitionStatus Method

**Files:**
- Modify: `server/channels/app/platform/status_transition_manager.go`

**Step 1: Implement TransitionStatus**

```go
// TransitionStatus attempts to transition a user's status according to the rules.
// This is the single entry point for ALL status changes when AccurateStatuses is enabled.
func (m *StatusTransitionManager) TransitionStatus(opts StatusTransitionOptions) StatusTransitionResult {
	result := StatusTransitionResult{
		Changed: false,
		Reason:  "no_change",
	}

	// Check if statuses are enabled
	if !*m.ps.Config().ServiceSettings.EnableUserStatuses {
		result.Reason = "statuses_disabled"
		return result
	}

	// Get current status
	now := model.GetMillis()
	status, err := m.ps.GetStatus(opts.UserID)
	if err != nil {
		// Create new status for user
		status = &model.Status{
			UserId:         opts.UserID,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: now,
			ActiveChannel:  opts.ChannelID,
		}
	}

	result.OldStatus = status.Status
	result.Status = status

	// Determine the actual new status (may be modified by rules)
	actualNewStatus := opts.NewStatus

	// Rule 1: DND Restoration - If going to Online from Offline+PrevStatus=DND, restore DND
	if opts.NewStatus == model.StatusOnline &&
	   status.Status == model.StatusOffline &&
	   status.PrevStatus == model.StatusDnd &&
	   !opts.Manual {
		actualNewStatus = model.StatusDnd
		status.Manual = true
		status.PrevStatus = ""
		result.Reason = "dnd_restored"
	}

	// Rule 2: Manual status protection (unless force or NoOffline applies)
	if status.Manual && !opts.Manual && !opts.Force {
		// Check NoOffline exception
		if m.ps.Config().FeatureFlags.NoOffline &&
		   status.Status == model.StatusOffline &&
		   opts.NewStatus == model.StatusOnline {
			// NoOffline overrides manual for Offline->Online
		} else {
			result.Reason = "manual_status_protected"
			return result
		}
	}

	// Rule 3: Away protection for DND-Offline users
	if opts.NewStatus == model.StatusAway &&
	   status.Status == model.StatusOffline &&
	   status.PrevStatus == model.StatusDnd {
		result.Reason = "away_blocked_dnd_offline"
		return result
	}

	// Rule 4: DND/OOO can only be changed by manual action
	if (status.Status == model.StatusDnd || status.Status == model.StatusOutOfOffice) &&
	   !opts.Manual &&
	   opts.NewStatus != model.StatusOffline { // DND inactivity->Offline is allowed
		result.Reason = "dnd_ooo_protected"
		return result
	}

	// Check if status actually changes
	if status.Status == actualNewStatus {
		// Update activity time even if status doesn't change
		if opts.WindowActive || opts.ChannelID != "" {
			status.LastActivityAt = now
		}
		if opts.ChannelID != "" {
			status.ActiveChannel = opts.ChannelID
		}
		result.Reason = "no_change"
		return result
	}

	// Apply the transition
	status.Status = actualNewStatus
	status.LastActivityAt = now

	if opts.ChannelID != "" {
		status.ActiveChannel = opts.ChannelID
	}

	// Set manual flag based on transition type
	if opts.Manual {
		status.Manual = true
	} else if actualNewStatus == model.StatusOnline {
		status.Manual = false // Online is never manual
	} else if actualNewStatus == model.StatusDnd && result.Reason == "dnd_restored" {
		status.Manual = true // Restored DND is manual
	}

	// Handle DND-specific fields
	if actualNewStatus == model.StatusDnd && opts.DNDEndTime > 0 {
		status.DNDEndTime = opts.DNDEndTime
		status.PrevStatus = result.OldStatus
	} else if actualNewStatus == model.StatusOffline && result.OldStatus == model.StatusDnd {
		// Going offline from DND - preserve for restoration
		status.PrevStatus = model.StatusDnd
		status.Manual = false
	} else if actualNewStatus != model.StatusDnd {
		status.DNDEndTime = 0
	}

	result.Changed = true
	result.NewStatus = actualNewStatus

	// Save and broadcast
	m.saveAndBroadcast(status, result.OldStatus, opts)

	return result
}

// saveAndBroadcast saves the status to cache/DB and broadcasts the change
func (m *StatusTransitionManager) saveAndBroadcast(status *model.Status, oldStatus string, opts StatusTransitionOptions) {
	// Add to cache
	m.ps.AddStatusCache(status)

	// Save to database
	if err := m.ps.Store.Status().SaveOrUpdate(status); err != nil {
		m.ps.Log().Warn("Failed to save status", mlog.String("user_id", status.UserId), mlog.Err(err))
	}

	// Broadcast
	m.ps.BroadcastStatus(status)
	if m.ps.sharedChannelService != nil {
		m.ps.sharedChannelService.NotifyUserStatusChanged(status)
	}

	// Log the change
	username := ""
	if user, userErr := m.ps.Store.User().Get(context.Background(), status.UserId); userErr == nil {
		username = user.Username
	}

	reason := m.mapTransitionReasonToLogReason(opts.Reason, oldStatus, status.Status)
	m.ps.LogStatusChange(status.UserId, username, oldStatus, status.Status, reason, opts.Device, opts.WindowActive, opts.ChannelID, opts.Manual, "StatusTransitionManager")
}

// mapTransitionReasonToLogReason converts transition reason to log reason constant
func (m *StatusTransitionManager) mapTransitionReasonToLogReason(reason StatusTransitionReason, oldStatus, newStatus string) string {
	switch reason {
	case TransitionReasonManual:
		return model.StatusLogReasonManual
	case TransitionReasonConnect:
		return model.StatusLogReasonConnect
	case TransitionReasonDisconnect:
		return model.StatusLogReasonDisconnect
	case TransitionReasonInactivity:
		return model.StatusLogReasonInactivity
	case TransitionReasonDNDExpired:
		return model.StatusLogReasonDNDExpired
	case TransitionReasonDNDInactivity:
		return model.StatusLogReasonDNDExpired
	case TransitionReasonActivity, TransitionReasonChannelView, TransitionReasonHeartbeat:
		if oldStatus == model.StatusOffline && newStatus == model.StatusDnd {
			return model.StatusLogReasonDNDRestored
		}
		if oldStatus == model.StatusAway {
			return model.StatusLogReasonWindowFocus
		}
		return model.StatusLogReasonHeartbeat
	default:
		return model.StatusLogReasonHeartbeat
	}
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status_transition_manager.go
git commit -m "feat: implement StatusTransitionManager.TransitionStatus"
```

---

## Task 3: Add Tests for StatusTransitionManager

**Files:**
- Create: `server/channels/app/platform/status_transition_manager_test.go`

**Step 1: Write comprehensive tests**

```go
// server/channels/app/platform/status_transition_manager_test.go
package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestStatusTransitionManager(t *testing.T) {
	t.Run("basic Online transition from Offline", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set initial offline status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonConnect,
			Manual:    false,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusOffline, result.OldStatus)
		assert.Equal(t, model.StatusOnline, result.NewStatus)
	})

	t.Run("DND restoration from Offline", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// User was DND, went offline
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline, // Requesting Online
			Reason:    TransitionReasonActivity,
			Manual:    false,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusOffline, result.OldStatus)
		assert.Equal(t, model.StatusDnd, result.NewStatus) // Should restore DND, not Online
		assert.True(t, result.Status.Manual)
		assert.Equal(t, "", result.Status.PrevStatus)
	})

	t.Run("Away blocked for DND-Offline user", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// User was DND, went offline
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusAway,
			Reason:    TransitionReasonInactivity,
			Manual:    false,
		})

		require.False(t, result.Changed)
		assert.Equal(t, "away_blocked_dnd_offline", result.Reason)
	})

	t.Run("manual status protected from automatic change", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// User manually set Away
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonActivity,
			Manual:    false, // Automatic
		})

		require.False(t, result.Changed)
		assert.Equal(t, "manual_status_protected", result.Reason)
	})

	t.Run("NoOffline overrides manual for Offline->Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.FeatureFlags.NoOffline = true
		})

		// User manually set Offline (somehow)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonActivity,
			Manual:    false,
		})

		require.True(t, result.Changed) // NoOffline allows this
		assert.Equal(t, model.StatusOnline, result.NewStatus)
	})

	t.Run("DND cannot be changed by automatic action", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonActivity,
			Manual:    false,
		})

		require.False(t, result.Changed)
		assert.Equal(t, "dnd_ooo_protected", result.Reason)
	})

	t.Run("DND inactivity to Offline is allowed", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:    th.BasicUser.Id,
			NewStatus: model.StatusOffline,
			Reason:    TransitionReasonDNDInactivity,
			Manual:    false,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusOffline, result.NewStatus)
		assert.Equal(t, model.StatusDnd, result.Status.PrevStatus) // Preserved for restoration
	})

	t.Run("timed DND sets DNDEndTime and PrevStatus", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
		}
		th.Service.SaveAndBroadcastStatus(status)

		endTime := model.GetMillis()/1000 + 3600 // 1 hour from now in seconds
		manager := NewStatusTransitionManager(th.Service)
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:     th.BasicUser.Id,
			NewStatus:  model.StatusDnd,
			Reason:     TransitionReasonManual,
			Manual:     true,
			DNDEndTime: endTime,
		})

		require.True(t, result.Changed)
		assert.Equal(t, model.StatusDnd, result.NewStatus)
		assert.Equal(t, endTime, result.Status.DNDEndTime)
		assert.Equal(t, model.StatusOnline, result.Status.PrevStatus)
	})
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status_transition_manager_test.go
git commit -m "test: add comprehensive tests for StatusTransitionManager"
```

---

## Task 4: Wire StatusTransitionManager into PlatformService

**Files:**
- Modify: `server/channels/app/platform/service.go` (add manager field)
- Modify: `server/channels/app/platform/status.go` (add getter method)

**Step 1: Add manager to PlatformService**

In `service.go`, add the field to the struct and initialize it:

```go
// In PlatformService struct, add:
statusTransitionManager *StatusTransitionManager

// In NewPlatformService or init, add:
ps.statusTransitionManager = NewStatusTransitionManager(ps)
```

**Step 2: Add getter in status.go**

```go
// StatusTransitionManager returns the status transition manager
// This is only used when AccurateStatuses is enabled
func (ps *PlatformService) StatusTransitionManager() *StatusTransitionManager {
	return ps.statusTransitionManager
}
```

**Step 3: Commit**

```bash
git add server/channels/app/platform/service.go server/channels/app/platform/status.go
git commit -m "feat: wire StatusTransitionManager into PlatformService"
```

---

## Task 5: Refactor SetStatusOnline to Use Manager

**Files:**
- Modify: `server/channels/app/platform/status.go:576-687`

**Step 1: Update SetStatusOnline**

Replace the AccurateStatuses-specific logic with a call to the manager:

```go
func (ps *PlatformService) SetStatusOnline(userID string, manual bool, device string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// When AccurateStatuses is enabled, use the centralized transition manager
	if ps.Config().FeatureFlags.AccurateStatuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusOnline,
			Reason:    TransitionReasonConnect,
			Manual:    manual,
			Device:    device,
		})
		_ = result // Logging handled by manager
		return
	}

	// Original logic for when AccurateStatuses is disabled
	// ... (keep existing code for backwards compatibility)
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status.go
git commit -m "refactor: SetStatusOnline uses StatusTransitionManager when AccurateStatuses enabled"
```

---

## Task 6: Refactor SetStatusOffline to Use Manager

**Files:**
- Modify: `server/channels/app/platform/status.go:689-732`

**Step 1: Update SetStatusOffline**

```go
func (ps *PlatformService) SetStatusOffline(userID string, manual bool, force bool, device string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// When AccurateStatuses is enabled, use the centralized transition manager
	if ps.Config().FeatureFlags.AccurateStatuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusOffline,
			Reason:    TransitionReasonDisconnect,
			Manual:    manual,
			Force:     force,
			Device:    device,
		})
		_ = result
		return
	}

	// Original logic for when AccurateStatuses is disabled
	// ... (keep existing code)
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status.go
git commit -m "refactor: SetStatusOffline uses StatusTransitionManager when AccurateStatuses enabled"
```

---

## Task 7: Refactor SetStatusAwayIfNeeded to Use Manager

**Files:**
- Modify: `server/channels/app/platform/status.go:855-912`

**Step 1: Update SetStatusAwayIfNeeded**

```go
func (ps *PlatformService) SetStatusAwayIfNeeded(userID string, manual bool) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// When AccurateStatuses is enabled, use the centralized transition manager
	if ps.Config().FeatureFlags.AccurateStatuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusAway,
			Reason:    TransitionReasonInactivity,
			Manual:    manual,
		})
		_ = result
		return
	}

	// Original logic for when AccurateStatuses is disabled
	// ... (keep existing code, including the DND-Offline guard we added)
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status.go
git commit -m "refactor: SetStatusAwayIfNeeded uses StatusTransitionManager when AccurateStatuses enabled"
```

---

## Task 8: Refactor SetStatusDoNotDisturb Methods to Use Manager

**Files:**
- Modify: `server/channels/app/platform/status.go:916-994`

**Step 1: Update SetStatusDoNotDisturbTimed**

```go
func (ps *PlatformService) SetStatusDoNotDisturbTimed(userID string, endtime int64) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// When AccurateStatuses is enabled, use the centralized transition manager
	if ps.Config().FeatureFlags.AccurateStatuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:     userID,
			NewStatus:  model.StatusDnd,
			Reason:     TransitionReasonManual,
			Manual:     true,
			DNDEndTime: truncateDNDEndTime(endtime),
		})
		_ = result
		return
	}

	// Original logic...
}

func (ps *PlatformService) SetStatusDoNotDisturb(userID string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// When AccurateStatuses is enabled, use the centralized transition manager
	if ps.Config().FeatureFlags.AccurateStatuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusDnd,
			Reason:    TransitionReasonManual,
			Manual:    true,
		})
		_ = result
		return
	}

	// Original logic...
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status.go
git commit -m "refactor: SetStatusDoNotDisturb methods use StatusTransitionManager"
```

---

## Task 9: Refactor SetStatusOutOfOffice to Use Manager

**Files:**
- Modify: `server/channels/app/platform/status.go:996-1024`

**Step 1: Update SetStatusOutOfOffice**

```go
func (ps *PlatformService) SetStatusOutOfOffice(userID string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	// When AccurateStatuses is enabled, use the centralized transition manager
	if ps.Config().FeatureFlags.AccurateStatuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:    userID,
			NewStatus: model.StatusOutOfOffice,
			Reason:    TransitionReasonManual,
			Manual:    true,
		})
		_ = result
		return
	}

	// Original logic...
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status.go
git commit -m "refactor: SetStatusOutOfOffice uses StatusTransitionManager"
```

---

## Task 10: Refactor SetActiveChannel to Use Manager

**Files:**
- Modify: `server/channels/app/channel.go:2819-2907`

**Step 1: Update SetActiveChannel**

```go
func (a *App) SetActiveChannel(rctx request.CTX, userID string, channelID string, device string) *model.AppError {
	// When AccurateStatuses is enabled, use the centralized transition manager
	if a.Config().FeatureFlags.AccurateStatuses {
		manager := a.Srv().Platform().StatusTransitionManager()
		result := manager.TransitionStatus(StatusTransitionOptions{
			UserID:       userID,
			NewStatus:    model.StatusOnline,
			Reason:       TransitionReasonChannelView,
			Manual:       false,
			Device:       device,
			ChannelID:    channelID,
			WindowActive: true,
		})

		// NoOffline handling is done inside the manager
		_ = result
		return nil
	}

	// Original logic for when AccurateStatuses is disabled
	// ... (keep existing code)
}
```

**Step 2: Commit**

```bash
git add server/channels/app/channel.go
git commit -m "refactor: SetActiveChannel uses StatusTransitionManager when AccurateStatuses enabled"
```

---

## Task 11: Refactor UpdateActivityFromHeartbeat to Use Manager

**Files:**
- Modify: `server/channels/app/platform/status.go:1033-1247`

**Step 1: Simplify UpdateActivityFromHeartbeat**

This function has complex logic for determining the new status. With the manager, it becomes simpler:

```go
func (ps *PlatformService) UpdateActivityFromHeartbeat(userID string, windowActive bool, channelID string, device string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	if !ps.Config().FeatureFlags.AccurateStatuses {
		return
	}

	now := model.GetMillis()
	status, err := ps.GetStatus(userID)
	if err != nil {
		status = &model.Status{
			UserId:         userID,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: now,
			ActiveChannel:  channelID,
		}
	}

	// Determine if this is manual activity
	channelChanged := channelID != "" && status.ActiveChannel != "" && channelID != status.ActiveChannel
	isManualActivity := windowActive || channelChanged

	// Calculate timeouts
	inactivityTimeout := int64(*ps.Config().MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes) * 60 * 1000
	dndInactivityTimeout := int64(*ps.Config().MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes) * 60 * 1000
	timeSinceLastActivity := now - status.LastActivityAt

	// Determine what status transition to attempt
	var newStatus string
	var reason StatusTransitionReason

	if status.Status == model.StatusDnd {
		if dndInactivityTimeout > 0 && timeSinceLastActivity >= dndInactivityTimeout {
			newStatus = model.StatusOffline
			reason = TransitionReasonDNDInactivity
		} else {
			// No transition needed for active DND
			return
		}
	} else if isManualActivity {
		if status.Status == model.StatusAway || status.Status == model.StatusOffline {
			newStatus = model.StatusOnline
			reason = TransitionReasonActivity
		} else {
			// Just update activity, no status change
			// ... handle activity logging
			return
		}
	} else if status.Status == model.StatusOnline && inactivityTimeout > 0 && timeSinceLastActivity >= inactivityTimeout {
		newStatus = model.StatusAway
		reason = TransitionReasonInactivity
	} else {
		return // No transition needed
	}

	// Use the manager for the transition
	result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
		UserID:       userID,
		NewStatus:    newStatus,
		Reason:       reason,
		Manual:       false,
		Device:       device,
		ChannelID:    channelID,
		WindowActive: windowActive,
	})
	_ = result
}
```

**Step 2: Commit**

```bash
git add server/channels/app/platform/status.go
git commit -m "refactor: UpdateActivityFromHeartbeat uses StatusTransitionManager"
```

---

## Task 12: Refactor Remaining Functions

**Files:**
- Modify: `server/channels/app/platform/status.go` (UpdateActivityFromManualAction, SetOnlineIfNoOffline)

**Step 1: Update UpdateActivityFromManualAction**

```go
func (ps *PlatformService) UpdateActivityFromManualAction(userID string, channelID string, trigger string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	if !ps.Config().FeatureFlags.AccurateStatuses {
		return
	}

	// Get current status to check if transition is needed
	status, _ := ps.GetStatus(userID)

	var newStatus string
	if status == nil || status.Status == model.StatusAway || status.Status == model.StatusOffline {
		newStatus = model.StatusOnline
	} else {
		// Just activity update, no status change
		// ... handle via manager's activity tracking
		return
	}

	result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
		UserID:       userID,
		NewStatus:    newStatus,
		Reason:       TransitionReasonActivity,
		Manual:       false,
		ChannelID:    channelID,
		WindowActive: true,
	})
	_ = result
}
```

**Step 2: Update SetOnlineIfNoOffline**

This function can be simplified since NoOffline logic is now in the manager:

```go
func (ps *PlatformService) SetOnlineIfNoOffline(userID string, channelID string, trigger string) {
	if !*ps.Config().ServiceSettings.EnableUserStatuses {
		return
	}

	if !ps.Config().FeatureFlags.NoOffline {
		return
	}

	// When AccurateStatuses is enabled, the manager handles NoOffline
	if ps.Config().FeatureFlags.AccurateStatuses {
		result := ps.statusTransitionManager.TransitionStatus(StatusTransitionOptions{
			UserID:       userID,
			NewStatus:    model.StatusOnline,
			Reason:       TransitionReasonActivity,
			Manual:       false,
			ChannelID:    channelID,
			WindowActive: true,
		})
		_ = result
		return
	}

	// Original logic for when AccurateStatuses is disabled
	// ... (keep existing code)
}
```

**Step 3: Commit**

```bash
git add server/channels/app/platform/status.go
git commit -m "refactor: remaining status functions use StatusTransitionManager"
```

---

## Task 13: Run Tests and Push

**Step 1: Run tests locally (if possible) or push to trigger CI**

```bash
git push origin master
```

**Step 2: Monitor GitHub Actions**

Check: https://github.com/stalecontext/mattermost-extended/actions

---

## Summary of Changes

| File | Change |
|------|--------|
| `server/channels/app/platform/status_transition_manager.go` | NEW: Centralized status transition logic |
| `server/channels/app/platform/status_transition_manager_test.go` | NEW: Comprehensive tests |
| `server/channels/app/platform/service.go` | Add StatusTransitionManager field |
| `server/channels/app/platform/status.go` | Refactor all Set* functions to use manager |
| `server/channels/app/channel.go` | Refactor SetActiveChannel to use manager |

## Benefits

1. **Single source of truth** - All status rules in one place
2. **Consistent behavior** - No more duplicated logic that can drift
3. **Easier testing** - One function to test instead of 6+
4. **Backwards compatible** - Original code remains when AccurateStatuses is disabled
5. **DND restoration guaranteed** - Cannot be bypassed by any code path
