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

// Tests for DND (Do Not Disturb) extended functionality
// - DND inactivity timeout (DND users go Offline after extended inactivity)
// - DND restoration (users who were DND before going offline restore to DND)
// - Timed DND with PrevStatus preservation

func TestDNDInactivityTimeout(t *testing.T) {
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

	t.Run("DND user should NOT go Offline before timeout", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 30
		})

		// Set DND status with LastActivityAt 20 minutes ago (before timeout)
		oldTime := model.GetMillis() - (20 * 60 * 1000)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window inactive
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, false, "", "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		// Should still be DND
		assert.Equal(t, model.StatusDnd, after.Status)
	})

	t.Run("DNDInactivityTimeout of 0 should disable DND->Offline transition", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 0 // Disabled
		})

		// Set DND status with very old LastActivityAt (1 hour ago)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: model.GetMillis() - (60 * 60 * 1000),
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

func TestDNDRestoration(t *testing.T) {
	t.Run("DND user that went Offline should restore to DND on heartbeat activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Set Offline status with PrevStatus = DND (user was DND, went offline due to inactivity)
		// ActiveChannel must be set for heartbeat to count as manual activity
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
			ActiveChannel:  th.BasicChannel.Id,
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

	t.Run("DND user that went Offline should restore to DND on manual action", func(t *testing.T) {
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

	t.Run("should restore DND when user was DND and went offline due to inactivity via SetStatusOnline", func(t *testing.T) {
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

	t.Run("should set Online normally when AccurateStatuses is disabled (no DND restoration)", func(t *testing.T) {
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

func TestSetStatusDoNotDisturbExtended(t *testing.T) {
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

	t.Run("should preserve LastActivityAt when setting DND", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		originalTime := model.GetMillis() - 5000
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: originalTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set DND
		th.Service.SetStatusDoNotDisturb(th.BasicUser.Id)

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		// LastActivityAt should be preserved or updated, not reset to 0
		assert.Greater(t, after.LastActivityAt, int64(0))
	})
}

func TestSetStatusDoNotDisturbTimedExtended(t *testing.T) {
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

	t.Run("timed DND from Away should save Away as PrevStatus", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Start with Away status
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis(),
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Set timed DND
		endTime := time.Now().Add(30 * time.Minute).Unix()
		th.Service.SetStatusDoNotDisturbTimed(th.BasicUser.Id, endTime)

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
		assert.Equal(t, model.StatusAway, after.PrevStatus)
	})
}

func TestSetStatusOutOfOfficeExtended(t *testing.T) {
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

	t.Run("Out of Office should not be changed by heartbeat activity", func(t *testing.T) {
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
}

func TestDNDWithNoOffline(t *testing.T) {
	t.Run("NoOffline should NOT change DND status", func(t *testing.T) {
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

	t.Run("NoOffline should restore DND if PrevStatus was DND", func(t *testing.T) {
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

func TestDNDOfflineDoesNotTransitionToAway(t *testing.T) {
	t.Run("DND user that went Offline should NOT transition to Away via SetStatusAwayIfNeeded", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.TeamSettings.UserStatusAwayTimeout = 1                              // 1 second
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
		// ActiveChannel is preserved so heartbeat activity detection works on return
		offlineStatus := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			PrevStatus:     model.StatusDnd,
			Manual:         false,
			LastActivityAt: model.GetMillis() - (2 * 60 * 1000), // 2 minutes ago
			ActiveChannel:  th.BasicChannel.Id,
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
