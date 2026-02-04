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
		th.Service.SetStatusOnline(userID, false, "")
		status, err := th.Service.GetStatus(userID)
		require.Nil(t, err, "Failed to get initial status")
		require.Equal(t, model.StatusOnline, status.Status, "User should be online initially")
	}

	// Queue status updates to offline
	for i, userID := range userIDs {
		// Set every other status as manual to test both cases
		manual := i%2 == 0
		th.Service.QueueSetStatusOffline(userID, manual, "")
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

// ============================================================================
// MATTERMOST EXTENDED TESTS - AccurateStatuses and NoOffline Features
// ============================================================================

func TestUpdateActivityFromHeartbeat(t *testing.T) {
	t.Run("when AccurateStatuses is disabled, should do nothing", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = false
		})

		// Set initial status to Away
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		// Since AccurateStatuses is disabled, the function returns early
		// Status should remain Away (function does nothing when disabled)
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		// Note: UpdateActivityFromHeartbeat only runs when AccurateStatuses is enabled
		// When disabled, it returns early without doing anything
		assert.Equal(t, model.StatusAway, after.Status)
	})

	t.Run("when window is active, should update LastActivityAt and set Online from Away", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 5
		})

		oldTime := model.GetMillis() - 10000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: oldTime,
			ActiveChannel:  "",
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
		assert.Greater(t, after.LastActivityAt, oldTime)
		assert.Equal(t, th.BasicChannel.Id, after.ActiveChannel)
	})

	t.Run("when window is inactive but channel changed, should update LastActivityAt and set Online from Away", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 5
		})

		channel2 := th.CreateChannel(t, th.BasicTeam)

		oldTime := model.GetMillis() - 10000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: oldTime,
			ActiveChannel:  th.BasicChannel.Id, // Was viewing BasicChannel
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window inactive but different channel
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, false, channel2.Id, "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
		assert.Greater(t, after.LastActivityAt, oldTime)
		assert.Equal(t, channel2.Id, after.ActiveChannel)
	})

	t.Run("when window is inactive and no channel change, should NOT update LastActivityAt", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 5
		})

		oldTime := model.GetMillis() - 10000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: oldTime,
			ActiveChannel:  th.BasicChannel.Id,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window inactive and same channel
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, false, th.BasicChannel.Id, "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		// LastActivityAt should NOT be updated since no manual activity
		assert.Equal(t, oldTime, after.LastActivityAt)
	})

	t.Run("when Online and inactive for longer than timeout, should set Away", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 5
		})

		// Set LastActivityAt to 6 minutes ago (past 5 min timeout)
		oldTime := model.GetMillis() - (6 * 60 * 1000)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: oldTime,
			ActiveChannel:  th.BasicChannel.Id,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window inactive (no manual activity)
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, false, th.BasicChannel.Id, "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status)
		// LastActivityAt should NOT change since no manual activity
		assert.Equal(t, oldTime, after.LastActivityAt)
	})

	t.Run("should NOT change manually set status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 5
		})

		// Set manual Away status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         true, // Manually set
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active - should NOT change manual status
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status)
		assert.True(t, after.Manual)
	})

	t.Run("should NOT auto-change DND status on activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set DND status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		// DND should NOT be changed to Online by activity
		assert.Equal(t, model.StatusDnd, after.Status)
	})

	t.Run("DND user should go Offline after extended inactivity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 30
		})

		// Set DND status with old LastActivityAt (31 minutes ago)
		oldTime := model.GetMillis() - (31 * 60 * 1000)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window inactive (no manual activity)
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, false, "", "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		// PrevStatus should be saved so we can restore DND later
		assert.Equal(t, model.StatusDnd, after.PrevStatus)
	})

	t.Run("DND user that went Offline should restore to DND on activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set Offline status with PrevStatus = DND (user was DND, went offline due to inactivity)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active (manual activity)
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		// Should restore DND, not go to Online
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.True(t, after.Manual)
		assert.Equal(t, "", after.PrevStatus) // PrevStatus should be cleared
	})
}

func TestSetOnlineIfNoOffline(t *testing.T) {
	t.Run("when NoOffline is disabled, should do nothing", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = false
		})

		// Set status to Offline
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetOnlineIfNoOffline
		th.Service.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test")

		// Status should remain Offline
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
	})

	t.Run("when NoOffline is enabled, should set Offline user to Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		oldTime := model.GetMillis() - 10000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetOnlineIfNoOffline
		th.Service.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test")

		// Status should change to Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
		assert.Equal(t, th.BasicChannel.Id, after.ActiveChannel)
		assert.Greater(t, after.LastActivityAt, oldTime)
	})

	t.Run("when NoOffline is enabled, should set Away user to Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetOnlineIfNoOffline
		th.Service.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test")

		// Status should change to Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("when NoOffline is enabled, should NOT change DND status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetOnlineIfNoOffline
		th.Service.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test")

		// DND should NOT be changed
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
	})

	t.Run("when NoOffline is enabled, should restore DND if PrevStatus was DND", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		// User was DND, went offline due to inactivity
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetOnlineIfNoOffline
		th.Service.SetOnlineIfNoOffline(th.BasicUser.Id, th.BasicChannel.Id, "test")

		// Should restore DND, not go to Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.True(t, after.Manual)
		assert.Equal(t, "", after.PrevStatus)
	})
}

func TestUpdateActivityFromManualAction(t *testing.T) {
	t.Run("when AccurateStatuses is disabled, should do nothing", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = false
		})

		oldTime := model.GetMillis() - 10000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call UpdateActivityFromManualAction
		th.Service.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, "test_action")

		// Status should remain unchanged
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status)
		assert.Equal(t, oldTime, after.LastActivityAt)
	})

	t.Run("when AccurateStatuses is enabled, should update LastActivityAt", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		oldTime := model.GetMillis() - 10000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call UpdateActivityFromManualAction
		th.Service.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, "test_action")

		// LastActivityAt should be updated
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Greater(t, after.LastActivityAt, oldTime)
		assert.Equal(t, th.BasicChannel.Id, after.ActiveChannel)
	})

	t.Run("when AccurateStatuses is enabled, should set Away user to Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call UpdateActivityFromManualAction
		th.Service.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, "test_action")

		// Status should change to Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("when AccurateStatuses is enabled, should set Offline user to Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call UpdateActivityFromManualAction
		th.Service.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, "test_action")

		// Status should change to Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("should NOT change DND status on manual action", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		oldTime := model.GetMillis() - 10000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call UpdateActivityFromManualAction
		th.Service.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, "test_action")

		// DND should NOT change, but LastActivityAt should update
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.Greater(t, after.LastActivityAt, oldTime)
	})

	t.Run("should restore DND if user was DND and went offline", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// User was DND, went offline due to inactivity
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call UpdateActivityFromManualAction
		th.Service.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, "test_action")

		// Should restore DND, not go to Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.True(t, after.Manual)
		assert.Equal(t, "", after.PrevStatus)
	})

	t.Run("should NOT change manually set Away status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		oldTime := model.GetMillis() - 10000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         true, // Manually set Away
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call UpdateActivityFromManualAction
		th.Service.UpdateActivityFromManualAction(th.BasicUser.Id, th.BasicChannel.Id, "test_action")

		// Manually set status should NOT change, but LastActivityAt should update
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status)
		assert.True(t, after.Manual)
		assert.Greater(t, after.LastActivityAt, oldTime)
	})
}

func TestSetStatusOnlineWithDNDRestore(t *testing.T) {
	t.Run("should restore DND when user was DND and went offline due to inactivity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// User was DND, went offline due to inactivity
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetStatusOnline (non-manual, like WS reconnect)
		th.Service.SetStatusOnline(th.BasicUser.Id, false, "desktop")

		// Should restore DND, not go to Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.True(t, after.Manual)
		assert.Equal(t, "", after.PrevStatus)
	})

	t.Run("should set Online normally when AccurateStatuses is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = false
		})

		// User was DND, went offline (even with PrevStatus set)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetStatusOnline
		th.Service.SetStatusOnline(th.BasicUser.Id, false, "desktop")

		// Should go to Online since AccurateStatuses is disabled
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})
}

// ============================================================================
// END MATTERMOST EXTENDED TESTS
// ============================================================================

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
		th.Service.SetStatusOffline(user.Id, false, false, "")

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

		// Set initial status to online manually
		status := &model.Status{
			UserId: user.Id,
			Status: model.StatusOnline,
			Manual: true,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Try to set offline non-manually
		th.Service.SetStatusOffline(user.Id, false, false, "")

		// Status should remain unchanged because manual status takes precedence
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
		assert.True(t, after.Manual)
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
		th.Service.SetStatusOffline(user.Id, false, true, "")

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
		th.Service.SetStatusOffline(user.Id, false, false, "")

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
		th.Service.SetStatusOffline(user.Id, true, false, "")

		// Status should change and be marked as manual
		after, err := th.Service.GetStatus(user.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.True(t, after.Manual)
	})
}

// ============================================================================
// ADDITIONAL MATTERMOST EXTENDED TESTS
// ============================================================================

func TestSetStatusDoNotDisturb(t *testing.T) {
	t.Run("should set DND status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Start with Online status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set DND
		th.Service.SetStatusDoNotDisturb(th.BasicUser.Id)

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.True(t, after.Manual)
	})
}

func TestSetStatusDoNotDisturbTimed(t *testing.T) {
	t.Run("should set timed DND status with PrevStatus", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Start with Online status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set timed DND (30 minutes from now)
		endTime := time.Now().Add(30 * time.Minute).Unix()
		th.Service.SetStatusDoNotDisturbTimed(th.BasicUser.Id, endTime)

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.True(t, after.Manual)
		assert.Equal(t, model.StatusOnline, after.PrevStatus)
		assert.Greater(t, after.DNDEndTime, int64(0))
	})
}

func TestSetStatusOutOfOffice(t *testing.T) {
	t.Run("should set Out of Office status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Start with Online status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set Out of Office
		th.Service.SetStatusOutOfOffice(th.BasicUser.Id)

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOutOfOffice, after.Status)
		assert.True(t, after.Manual)
	})
}

func TestSetStatusAwayIfNeeded(t *testing.T) {
	t.Run("should set Away when inactive", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set config for short timeout
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.UserStatusAwayTimeout = 1 // 1 second
		})

		// Set status with old LastActivityAt
		oldTime := model.GetMillis() - 5000 // 5 seconds ago
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetStatusAwayIfNeeded
		th.Service.SetStatusAwayIfNeeded(th.BasicUser.Id, false)

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status)
	})

	t.Run("should NOT set Away when recently active", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set config for longer timeout
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.UserStatusAwayTimeout = 300 // 5 minutes
		})

		// Set status with recent LastActivityAt
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetStatusAwayIfNeeded
		th.Service.SetStatusAwayIfNeeded(th.BasicUser.Id, false)

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("should NOT change manual status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set config for short timeout
		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.UserStatusAwayTimeout = 1 // 1 second
		})

		// Set manual Online status with old LastActivityAt
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 5000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetStatusAwayIfNeeded (non-manual)
		th.Service.SetStatusAwayIfNeeded(th.BasicUser.Id, false)

		// Should remain Online because it was manually set
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
		assert.True(t, after.Manual)
	})
}

func TestNoOfflineWithAccurateStatuses(t *testing.T) {
	t.Run("NoOffline should work with AccurateStatuses heartbeat", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.FeatureFlags.NoOffline = true
		})

		// Set user to Offline
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		// Should be Online due to NoOffline + manual activity
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})
}

func TestUpdateActivityFromHeartbeatEdgeCases(t *testing.T) {
	t.Run("should create new status for user without existing status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Create a new user that doesn't have a status yet
		newUser := th.CreateUserOrGuest(t, false)

		// Call heartbeat - should create new status
		th.Service.UpdateActivityFromHeartbeat(newUser.Id, true, th.BasicChannel.Id, "desktop")

		// Should have Online status now
		after, err := th.Service.GetStatus(newUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("should respect Out of Office status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set Out of Office status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOutOfOffice,
			Manual:         true,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		// Should remain Out of Office
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOutOfOffice, after.Status)
	})

	t.Run("should update ActiveChannel on heartbeat", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set Online status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
			ActiveChannel:  "",
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with channel
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		// ActiveChannel should be updated
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, th.BasicChannel.Id, after.ActiveChannel)
	})

	t.Run("DNDInactivityTimeout of 0 should disable DND->Offline transition", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 0 // Disabled
		})

		// Set DND status with very old LastActivityAt
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - (60 * 60 * 1000), // 1 hour ago
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window inactive
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, false, "", "desktop")

		// Should remain DND because timeout is disabled
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
	})
}
