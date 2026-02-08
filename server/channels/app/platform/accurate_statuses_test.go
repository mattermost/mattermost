// mattermost-extended-test
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Tests for the AccurateStatuses feature flag
// This feature enables heartbeat-based status tracking where:
// - LastActivityAt is only updated on manual activity (window focus, channel switch)
// - Users go Away after inactivity timeout
// - DND users go Offline after extended inactivity

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
		assert.Equal(t, model.StatusAway, after.Status)
	})

	t.Run("when window is active and has active channel, should update LastActivityAt and set Online from Away", func(t *testing.T) {
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
			ActiveChannel:  th.BasicChannel.Id, // User has an active channel (not idle)
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active - user is engaged
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

	t.Run("when window is active but no active channel in status, should NOT update LastActivityAt", func(t *testing.T) {
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
			ActiveChannel:  "", // User is idle / no active channel (set via SetActiveChannel(""))
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active but no channel in heartbeat
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, "", "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		// LastActivityAt should NOT be updated since status has no active channel
		assert.Equal(t, oldTime, after.LastActivityAt)
	})

	t.Run("when heartbeat sends stale channelID but status.ActiveChannel is empty, should NOT update LastActivityAt", func(t *testing.T) {
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
			ActiveChannel:  "", // User went idle via SetActiveChannel("")
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Heartbeat sends stale channelID (client hasn't caught up yet)
		// but status.ActiveChannel is empty (authoritative state)
		// This simulates: user went idle, SetActiveChannel("") was called,
		// but heartbeat still has old channelID cached
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		// LastActivityAt should NOT be updated because status.ActiveChannel is empty
		// (the authoritative state) even though heartbeat sent a channelID
		assert.Equal(t, oldTime, after.LastActivityAt)
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
}

func TestSetStatusAwayIfNeededExtended(t *testing.T) {
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
}

func TestWebSocketConnectionDoesNotUpdateLastActivityAt(t *testing.T) {
	t.Run("NewWebConn should NOT call UpdateLastActivityAtIfNeeded", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
		})

		// Create a session first (it will have current time as LastActivityAt)
		session, err := th.Service.CreateSession(request.EmptyContext(th.Service.Log()), &model.Session{
			UserId: th.BasicUser.Id,
		})
		require.NoError(t, err)

		// Set LastActivityAt to old time (past the SessionActivityTimeout threshold)
		// SessionActivityTimeout is 5 minutes (300000 ms), so set it to 10 minutes ago
		oldTime := model.GetMillis() - 600000
		err = th.Service.Store.Session().UpdateLastActivityAt(session.Id, oldTime)
		require.NoError(t, err)

		// Fetch the session to confirm the old time
		session, err = th.Service.Store.Session().Get(request.EmptyContext(th.Service.Log()), session.Token)
		require.NoError(t, err)
		require.Equal(t, oldTime, session.LastActivityAt)

		// Create a new WebConn - this should NOT update LastActivityAt
		cfg := &WebConnConfig{
			WebSocket: &websocket.Conn{},
			Session:   *session,
		}
		_ = th.Service.NewWebConn(cfg, th.Suite, &hookRunner{})

		// Give async goroutine time to run (if it was going to)
		time.Sleep(200 * time.Millisecond)

		// Verify session LastActivityAt was NOT updated
		updatedSession, sessErr := th.Service.Store.Session().Get(request.EmptyContext(th.Service.Log()), session.Token)
		require.NoError(t, sessErr)

		// The session's LastActivityAt should still be the old time
		assert.Equal(t, oldTime, updatedSession.LastActivityAt,
			"WebSocket connection should NOT update session LastActivityAt")
	})
}
