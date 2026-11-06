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

func TestSaveStatus(t *testing.T) {
	th := Setup(t).InitBasic(t)

	user := th.BasicUser

	for _, statusString := range []string{
		model.StatusOnline,
		model.StatusAway,
		model.StatusDnd,
		model.StatusOffline,
	} {
		t.Run(statusString, func(t *testing.T) {
			status := &model.Status{
				UserId: user.Id,
				Status: statusString,
			}

			th.Service.SaveAndBroadcastStatus(status)

			after, err := th.Service.GetStatus(user.Id)
			require.Nil(t, err, "failed to get status after save: %v", err)
			require.Equal(t, statusString, after.Status, "failed to save status, got %v, expected %v", after.Status, statusString)
		})
	}
}

func TestTruncateDNDEndTime(t *testing.T) {
	// 2025-Jan-20 at 17:13:32 GMT becomes 17:13:00
	assert.Equal(t, int64(1737393180), truncateDNDEndTime(1737393212))

	// 2025-Jan-20 at 17:13:00 GMT remains unchanged
	assert.Equal(t, int64(1737393180), truncateDNDEndTime(1737393180))

	// 2025-Jan-20 at 00:00:10 GMT becomes 00:00:00
	assert.Equal(t, int64(1737331200), truncateDNDEndTime(1737331210))

	// 2025-Jan-20 at 00:00:10 GMT remains unchanged
	assert.Equal(t, int64(1737331200), truncateDNDEndTime(1737331200))
}

func TestQueueSetStatusOffline(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Create multiple user IDs
	userIDs := []string{
		th.BasicUser.Id,
		model.NewId(),
		model.NewId(),
		model.NewId(),
	}

	// Add duplicate user IDs to test duplicate handling
	// The second occurrence should override the first
	userIDs = append(userIDs, userIDs[0], userIDs[1])

	// Initially set all users to online
	for _, userID := range userIDs {
		th.Service.SetStatusOnline(userID, false)
		status, err := th.Service.GetStatus(userID)
		require.Nil(t, err, "Failed to get initial status")
		require.Equal(t, model.StatusOnline, status.Status, "User should be online initially")
	}

	// Queue status updates to offline
	for i, userID := range userIDs {
		// Set every other status as manual to test both cases
		manual := i%2 == 0
		th.Service.QueueSetStatusOffline(userID, manual)
	}

	// Wait for the background processor to handle the updates
	// Use eventually consistent approach with retries
	for idx, userID := range userIDs {
		var status *model.Status
		var err *model.AppError

		// Use poll-wait pattern to account for async processing
		require.Eventually(t, func() bool {
			status, err = th.Service.GetStatus(userID)
			return err == nil && status.Status == model.StatusOffline
		}, 5*time.Second, 100*time.Millisecond, "Status wasn't updated to offline")

		// For the duplicated user IDs, check that manual setting is based on the last call
		// User[0] and User[1] are duplicated at the end of the slice
		switch idx {
		case 0, 4: // first duplicated user
			// Last update for userIDs[0] was at index 4 (i%2 == 0, so manual = true)
			require.True(t, status.Manual, "User should have manual status (duplicate case)")
		case 1, 5:
			// Last update for userIDs[1] was at index 5 (i%2 == 1, so manual = false)
			require.False(t, status.Manual, "User should have automatic status (duplicate case)")
		default:
			require.Equal(t, idx%2 == 0, status.Manual, "Manual flag incorrect")
		}
	}

	// Verify all relevant status fields
	for _, userID := range model.RemoveDuplicateStrings(userIDs) {
		status, err := th.Service.GetStatus(userID)
		require.Nil(t, err, "Failed to get status")
		require.Equal(t, model.StatusOffline, status.Status, "User should be offline")
		require.Equal(t, "", status.ActiveChannel, "ActiveChannel should be empty")
	}

	// First shut down the test environment
	th.Shutdown(t)

	// Then verify that the status update processor has properly shut down
	// by checking that the done signal channel is closed
	select {
	case _, ok := <-th.Service.statusUpdateDoneSignal:
		// If channel is closed, ok will be false
		assert.False(t, ok, "statusUpdateDoneSignal channel should be closed after teardown")
	case <-time.After(5 * time.Second):
		require.Fail(t, "Timed out waiting for status update processor to shut down")
	}
}

func TestSetStatusOffline(t *testing.T) {
	th := Setup(t).InitBasic(t)

	user := th.BasicUser

	t.Run("when user statuses are disabled", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = false
		})

		// Set initial status to online
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Try to set offline
		th.Service.SetStatusOffline(user.Id, false, false)

		// Enable user statuses to see what is really in the database
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Status should remain unchanged
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("when setting status manually over manually set status", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Set initial status to dnd manually
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusDnd,
			Manual: true,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Try to set offline non-manually
		th.Service.SetStatusOffline(user.Id, false, false)

		// Status should remain unchanged because manual status takes precedence
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.True(t, after.Manual)
	})

	t.Run("when a manually pinned online status is disconnected", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Pin the user online
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: true,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// A disconnect arrives as a non-manual offline transition
		th.Service.SetStatusOffline(user.Id, false, false)

		// The pin overrides inactivity but must not survive disconnection, otherwise the
		// user would be shown as online indefinitely after their last device goes away.
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.False(t, after.Manual)
	})

	t.Run("when force flag is true over manually set status", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Set initial status to online manually
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: true,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Try to set offline with force flag
		th.Service.SetStatusOffline(user.Id, false, true)

		// Status should change despite being manual
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.False(t, after.Manual)
	})

	t.Run("when setting status normally", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Set initial status to online
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: false,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set offline
		th.Service.SetStatusOffline(user.Id, false, false)

		// Status should change
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.False(t, after.Manual)
	})

	t.Run("when setting status manually over normal status", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableUserStatuses = true
		})

		// Set initial status to online
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: false,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set offline manually
		th.Service.SetStatusOffline(user.Id, true, false)

		// Status should change and be marked as manual
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.True(t, after.Manual)
	})
}

func TestSetStatusOnlineManual(t *testing.T) {
	th := Setup(t).InitBasic(t)

	user := th.BasicUser

	t.Run("persists the manual flag when set explicitly", func(t *testing.T) {
		th.Service.SetStatusOnline(user.Id, true)

		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
		assert.True(t, after.Manual, "an explicitly set online status should be marked manual")
	})

	t.Run("persists the manual flag to the database when only the flag changes", func(t *testing.T) {
		// Start from an automatic online status. Pinning from here leaves the status string
		// untouched, so the only thing that changes is the manual flag.
		th.Service.SaveAndBroadcastStatus(&model.Status{
			UserId:         user.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
		})

		th.Service.SetStatusOnline(user.Id, true)

		// Read straight from the store rather than through the cache. Because the status
		// string is unchanged, this write would otherwise take the cheaper path that only
		// updates the last activity column and the pin would be lost on the next cache miss.
		stored, storeErr := th.Service.Store.Status().Get(user.Id)
		require.NoError(t, storeErr)
		assert.Equal(t, model.StatusOnline, stored.Status)
		assert.True(t, stored.Manual, "the pin must reach the database, not just the cache")
	})

	t.Run("activity driven updates do not set the manual flag", func(t *testing.T) {
		th.Service.SaveAndBroadcastStatus(&model.Status{
			UserId: user.Id,
			Status: model.StatusOffline,
			Manual: false,
		})

		th.Service.SetStatusOnline(user.Id, false)

		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
		assert.False(t, after.Manual, "activity driven online must stay automatic")
	})

	t.Run("does not override a manually set away status", func(t *testing.T) {
		th.Service.SaveAndBroadcastStatus(&model.Status{
			UserId: user.Id,
			Status: model.StatusAway,
			Manual: true,
		})

		th.Service.SetStatusOnline(user.Id, false)

		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status, "activity must not clear a manual away")
	})
}

func TestManualOnlineSurvivesInactivity(t *testing.T) {
	th := Setup(t).InitBasic(t)

	user := th.BasicUser

	// A short away timeout keeps the test fast; isUserAway compares against LastActivityAt.
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.UserStatusAwayTimeout = 1
	})

	t.Run("pinned online is not moved to away by inactivity", func(t *testing.T) {
		th.Service.SaveAndBroadcastStatus(&model.Status{
			UserId:         user.Id,
			Status:         model.StatusOnline,
			Manual:         true,
			LastActivityAt: model.GetMillis() - (10 * 1000),
		})

		// This is the transition the inactivity path drives.
		th.Service.SetStatusAwayIfNeeded(user.Id, false)

		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status, "a pinned online must defeat inactivity")
		assert.True(t, after.Manual)
	})

	t.Run("automatic online is still moved to away by inactivity", func(t *testing.T) {
		th.Service.SaveAndBroadcastStatus(&model.Status{
			UserId:         user.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (10 * 1000),
		})

		th.Service.SetStatusAwayIfNeeded(user.Id, false)

		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status, "auto-away must still work for everyone else")
	})

	t.Run("user can still choose away over a pinned online", func(t *testing.T) {
		th.Service.SaveAndBroadcastStatus(&model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: true,
		})

		th.Service.SetStatusAwayIfNeeded(user.Id, true)

		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status, "an explicit choice must always win")
		assert.True(t, after.Manual)
	})
}

func TestManualOnlineClearedByDisconnect(t *testing.T) {
	th := Setup(t).InitBasic(t)

	user := th.BasicUser

	t.Run("queued offline clears a pinned online", func(t *testing.T) {
		th.Service.SaveAndBroadcastStatus(&model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: true,
		})

		// The hub queues a non-manual offline when a user's last connection goes away.
		th.Service.QueueSetStatusOffline(user.Id, false)

		var after *model.Status
		var err *model.AppError
		require.Eventually(t, func() bool {
			after, err = th.Service.GetStatus(user.Id)
			return err == nil && after.Status == model.StatusOffline
		}, 5*time.Second, 100*time.Millisecond, "a pinned online must not survive disconnection")

		assert.False(t, after.Manual, "the pin must be cleared, not converted into a manual offline")
	})

	t.Run("queued offline still respects a manual dnd", func(t *testing.T) {
		th.Service.SaveAndBroadcastStatus(&model.Status{
			UserId: user.Id,
			Status: model.StatusDnd,
			Manual: true,
		})

		th.Service.QueueSetStatusOffline(user.Id, false)

		// Give the batch processor a chance to run so this is not a vacuous pass.
		time.Sleep(time.Second)

		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status, "the carve-out must be scoped to online only")
		assert.True(t, after.Manual)
	})
}
