// mattermost-extended-test
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// Tests for the NoOffline feature flag
// This feature prevents users from being/staying offline when they show manual activity

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

	t.Run("when NoOffline is enabled but channelID is empty, should NOT set Online", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		// Set status to Away
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call SetOnlineIfNoOffline with empty channel - user is idle
		th.Service.SetOnlineIfNoOffline(th.BasicUser.Id, "", "test")

		// Status should remain Away (not set to Online)
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status)
	})
}

func TestNoOfflineWithAccurateStatuses(t *testing.T) {
	t.Run("NoOffline should work with AccurateStatuses heartbeat", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.FeatureFlags.NoOffline = true
		})

		// Set user to Offline but with an active channel (simulates user returning)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
			ActiveChannel:  th.BasicChannel.Id, // User has active channel
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		// Should be Online due to NoOffline + manual activity
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("NoOffline should prevent Away users from staying Away on activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.FeatureFlags.NoOffline = true
		})

		// Set user to Away but with an active channel (user is engaged)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusAway,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
			ActiveChannel:  th.BasicChannel.Id, // User has active channel
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window active (manual activity)
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, true, th.BasicChannel.Id, "desktop")

		// Should be Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})

	t.Run("NoOffline with AccurateStatuses should still allow Away on inactivity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			cfg.FeatureFlags.NoOffline = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 5
		})

		// Set user to Online with old LastActivityAt (6 minutes ago)
		oldTime := model.GetMillis() - (6 * 60 * 1000)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOnline,
			Manual:         false,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Call heartbeat with window inactive (no manual activity)
		th.Service.UpdateActivityFromHeartbeat(th.BasicUser.Id, false, th.BasicChannel.Id, "desktop")

		// Should go Away due to inactivity - NoOffline doesn't prevent Away
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusAway, after.Status)
	})
}

func TestNoOfflineOnWebSocketConnect(t *testing.T) {
	t.Run("SetStatusOnline should bring offline user online when NoOffline is enabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.NoOffline = true
		})

		// User is offline
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusOffline,
			Manual:         false,
			LastActivityAt: model.GetMillis() - 10000,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Simulate WebSocket connect by calling SetStatusOnline
		th.Service.SetStatusOnline(th.BasicUser.Id, false, "desktop")

		// Should be Online
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOnline, after.Status)
	})
}
