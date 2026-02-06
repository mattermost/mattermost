// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// Tests for Status Logs functionality
// - LogStatusChange: saves status changes to DB and broadcasts via WebSocket
// - LogActivityUpdate: saves activity updates without status changes
// - GetStatusLogs/GetStatusLogsWithOptions: retrieves logs with filtering
// - ClearStatusLogs: clears all logs
// - GetStatusLogStats: returns status statistics
// - CleanupOldStatusLogs: removes old logs based on retention
// - CheckDNDTimeouts: sets inactive DND users to Offline

func TestLogStatusChange(t *testing.T) {
	t.Run("should save status change when enabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Log a status change
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			th.BasicChannel.Id,
			false,
			"TestLogStatusChange",
			0,
		)

		// Verify the log was saved
		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, th.BasicUser.Id, logs[0].UserID)
		assert.Equal(t, th.BasicUser.Username, logs[0].Username)
		assert.Equal(t, model.StatusOnline, logs[0].OldStatus)
		assert.Equal(t, model.StatusAway, logs[0].NewStatus)
		assert.Equal(t, model.StatusLogReasonInactivity, logs[0].Reason)
		assert.Equal(t, model.StatusLogTypeStatusChange, logs[0].LogType)
		assert.Equal(t, "TestLogStatusChange", logs[0].Source)
	})

	t.Run("should NOT save when disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = false
		})

		// Log a status change
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestLogStatusChange",
			0,
		)

		// Verify no log was saved
		logs := th.Service.GetStatusLogs()
		assert.Len(t, logs, 0)
	})

	t.Run("should set default device when empty", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Log with empty device
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			"", // Empty device
			false,
			"",
			false,
			"TestLogStatusChange",
			0,
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, model.StatusLogDeviceUnknown, logs[0].Device)
	})

	t.Run("should generate trigger text for window focus", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusAway,
			model.StatusOnline,
			model.StatusLogReasonWindowFocus,
			model.StatusLogDeviceDesktop,
			true,
			"",
			false,
			"TestLogStatusChange",
			0,
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, model.StatusLogTriggerWindowActive, logs[0].Trigger)
	})

	t.Run("should include inactivity timeout in trigger text", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 10
		})

		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestLogStatusChange",
			0,
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, "Window Inactive for 10m", logs[0].Trigger)
	})

	t.Run("should track manual flag", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusDnd,
			"user_set",
			model.StatusLogDeviceDesktop,
			true,
			"",
			true, // Manual
			"TestLogStatusChange",
			0,
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.True(t, logs[0].Manual)
	})
}

func TestLogActivityUpdate(t *testing.T) {
	t.Run("should save activity update when enabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		activityAt := model.GetMillis()
		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			th.BasicChannel.Id,
			th.BasicChannel.Name,
			string(model.ChannelTypeOpen),
			model.StatusLogTriggerChannelView,
			"TestLogActivityUpdate",
			activityAt,
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, th.BasicUser.Id, logs[0].UserID)
		assert.Equal(t, model.StatusLogTypeActivity, logs[0].LogType)
		assert.Equal(t, model.StatusOnline, logs[0].OldStatus)
		assert.Equal(t, model.StatusOnline, logs[0].NewStatus)
		assert.Equal(t, activityAt, logs[0].LastActivityAt)
	})

	t.Run("should NOT save when disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = false
		})

		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			th.BasicChannel.Id,
			th.BasicChannel.Name,
			string(model.ChannelTypeOpen),
			model.StatusLogTriggerChannelView,
			"TestLogActivityUpdate",
			model.GetMillis(),
		)

		logs := th.Service.GetStatusLogs()
		assert.Len(t, logs, 0)
	})

	t.Run("should format public channel with # prefix", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			th.BasicChannel.Id,
			"general",
			string(model.ChannelTypeOpen),
			model.StatusLogTriggerChannelView,
			"TestLogActivityUpdate",
			model.GetMillis(),
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, "Loaded #general", logs[0].Trigger)
	})

	t.Run("should format DM channel with @ prefix", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			"dm-channel-id",
			"john.doe",
			string(model.ChannelTypeDirect),
			model.StatusLogTriggerChannelView,
			"TestLogActivityUpdate",
			model.GetMillis(),
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, "Loaded @john.doe", logs[0].Trigger)
	})

	t.Run("should format group DM channel with @ prefix", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			"gm-channel-id",
			"john.doe, jane.smith",
			string(model.ChannelTypeGroup),
			model.StatusLogTriggerChannelView,
			"TestLogActivityUpdate",
			model.GetMillis(),
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, "Loaded @john.doe, jane.smith", logs[0].Trigger)
	})

	t.Run("should format fetch history trigger", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			th.BasicChannel.Id,
			"general",
			string(model.ChannelTypeOpen),
			model.StatusLogTriggerFetchHistory,
			"TestLogActivityUpdate",
			model.GetMillis(),
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, "Fetched history of #general", logs[0].Trigger)
	})

	t.Run("should format send message trigger", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			th.BasicChannel.Id,
			"general",
			string(model.ChannelTypeOpen),
			model.StatusLogTriggerSendMessage,
			"TestLogActivityUpdate",
			model.GetMillis(),
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, "Sent message in #general", logs[0].Trigger)
	})

	t.Run("should format active channel trigger", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			th.BasicChannel.Id,
			"general",
			string(model.ChannelTypeOpen),
			model.StatusLogTriggerActiveChannel,
			"TestLogActivityUpdate",
			model.GetMillis(),
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, "Active Channel set to #general", logs[0].Trigger)
	})

	t.Run("should include inactivity timeout in window inactive trigger", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
			*cfg.MattermostExtendedSettings.Statuses.InactivityTimeoutMinutes = 15
		})

		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			false,
			"",
			"",
			"",
			model.StatusLogTriggerWindowInactive,
			"TestLogActivityUpdate",
			model.GetMillis(),
		)

		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.Equal(t, "Window Inactive for 15m", logs[0].Trigger)
	})
}

func TestGetStatusLogs(t *testing.T) {
	t.Run("should return empty list when no logs", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		logs := th.Service.GetStatusLogs()
		assert.Len(t, logs, 0)
	})

	t.Run("should return logs with default pagination", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Create 5 status logs
		for i := 0; i < 5; i++ {
			th.Service.LogStatusChange(
				th.BasicUser.Id,
				th.BasicUser.Username,
				model.StatusOnline,
				model.StatusAway,
				model.StatusLogReasonInactivity,
				model.StatusLogDeviceDesktop,
				false,
				"",
				false,
				"TestGetStatusLogs",
				0,
			)
		}

		logs := th.Service.GetStatusLogs()
		assert.Len(t, logs, 5)
	})
}

func TestGetStatusLogsWithOptions(t *testing.T) {
	t.Run("should filter by user_id", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Log for user1
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestGetStatusLogsWithOptions",
			0,
		)

		// Log for user2
		th.Service.LogStatusChange(
			th.BasicUser2.Id,
			th.BasicUser2.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestGetStatusLogsWithOptions",
			0,
		)

		// Filter by user1
		logs := th.Service.GetStatusLogsWithOptions(model.StatusLogGetOptions{
			UserID:  th.BasicUser.Id,
			PerPage: 100,
		})
		require.Len(t, logs, 1)
		assert.Equal(t, th.BasicUser.Id, logs[0].UserID)
	})

	t.Run("should filter by log_type", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Log status change
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestGetStatusLogsWithOptions",
			0,
		)

		// Log activity
		th.Service.LogActivityUpdate(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusLogDeviceDesktop,
			true,
			th.BasicChannel.Id,
			th.BasicChannel.Name,
			string(model.ChannelTypeOpen),
			model.StatusLogTriggerChannelView,
			"TestGetStatusLogsWithOptions",
			model.GetMillis(),
		)

		// Filter by status_change
		logs := th.Service.GetStatusLogsWithOptions(model.StatusLogGetOptions{
			LogType: model.StatusLogTypeStatusChange,
			PerPage: 100,
		})
		require.Len(t, logs, 1)
		assert.Equal(t, model.StatusLogTypeStatusChange, logs[0].LogType)

		// Filter by activity
		logs = th.Service.GetStatusLogsWithOptions(model.StatusLogGetOptions{
			LogType: model.StatusLogTypeActivity,
			PerPage: 100,
		})
		require.Len(t, logs, 1)
		assert.Equal(t, model.StatusLogTypeActivity, logs[0].LogType)
	})

	t.Run("should filter by status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Log to Away
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestGetStatusLogsWithOptions",
			0,
		)

		// Log to DND
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusDnd,
			"user_set",
			model.StatusLogDeviceDesktop,
			false,
			"",
			true,
			"TestGetStatusLogsWithOptions",
			0,
		)

		// Filter by Away (NewStatus)
		logs := th.Service.GetStatusLogsWithOptions(model.StatusLogGetOptions{
			Status:  model.StatusAway,
			PerPage: 100,
		})
		require.Len(t, logs, 1)
		assert.Equal(t, model.StatusAway, logs[0].NewStatus)
	})

	t.Run("should paginate correctly", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Create 10 logs
		for i := 0; i < 10; i++ {
			th.Service.LogStatusChange(
				th.BasicUser.Id,
				th.BasicUser.Username,
				model.StatusOnline,
				model.StatusAway,
				model.StatusLogReasonInactivity,
				model.StatusLogDeviceDesktop,
				false,
				"",
				false,
				"TestGetStatusLogsWithOptions",
				0,
			)
		}

		// Get first page (3 per page)
		page1 := th.Service.GetStatusLogsWithOptions(model.StatusLogGetOptions{
			Page:    0,
			PerPage: 3,
		})
		assert.Len(t, page1, 3)

		// Get second page
		page2 := th.Service.GetStatusLogsWithOptions(model.StatusLogGetOptions{
			Page:    1,
			PerPage: 3,
		})
		assert.Len(t, page2, 3)

		// Get last page (partial)
		page4 := th.Service.GetStatusLogsWithOptions(model.StatusLogGetOptions{
			Page:    3,
			PerPage: 3,
		})
		assert.Len(t, page4, 1) // 10 total, 3*3=9, 1 remaining
	})
}

func TestGetStatusLogCount(t *testing.T) {
	t.Run("should return 0 when no logs", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		count := th.Service.GetStatusLogCount(model.StatusLogGetOptions{})
		assert.Equal(t, int64(0), count)
	})

	t.Run("should return correct count", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Create 5 logs
		for i := 0; i < 5; i++ {
			th.Service.LogStatusChange(
				th.BasicUser.Id,
				th.BasicUser.Username,
				model.StatusOnline,
				model.StatusAway,
				model.StatusLogReasonInactivity,
				model.StatusLogDeviceDesktop,
				false,
				"",
				false,
				"TestGetStatusLogCount",
				0,
			)
		}

		count := th.Service.GetStatusLogCount(model.StatusLogGetOptions{})
		assert.Equal(t, int64(5), count)
	})

	t.Run("should respect filters", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Log for user1
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestGetStatusLogCount",
			0,
		)

		// Log for user2
		th.Service.LogStatusChange(
			th.BasicUser2.Id,
			th.BasicUser2.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestGetStatusLogCount",
			0,
		)

		// Count for user1 only
		count := th.Service.GetStatusLogCount(model.StatusLogGetOptions{
			UserID: th.BasicUser.Id,
		})
		assert.Equal(t, int64(1), count)

		// Total count
		totalCount := th.Service.GetStatusLogCount(model.StatusLogGetOptions{})
		assert.Equal(t, int64(2), totalCount)
	})
}

func TestClearStatusLogs(t *testing.T) {
	t.Run("should clear all logs", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Create logs
		for i := 0; i < 5; i++ {
			th.Service.LogStatusChange(
				th.BasicUser.Id,
				th.BasicUser.Username,
				model.StatusOnline,
				model.StatusAway,
				model.StatusLogReasonInactivity,
				model.StatusLogDeviceDesktop,
				false,
				"",
				false,
				"TestClearStatusLogs",
				0,
			)
		}

		// Verify logs exist
		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 5)

		// Clear logs
		th.Service.ClearStatusLogs()

		// Verify logs are gone
		logs = th.Service.GetStatusLogs()
		assert.Len(t, logs, 0)
	})
}

func TestGetStatusLogStats(t *testing.T) {
	t.Run("should return zero stats when no logs", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		stats := th.Service.GetStatusLogStats()
		assert.Equal(t, 0, stats["total"])
		assert.Equal(t, 0, stats["online"])
		assert.Equal(t, 0, stats["away"])
		assert.Equal(t, 0, stats["dnd"])
		assert.Equal(t, 0, stats["offline"])
	})

	t.Run("should return correct stats", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
		})

		// Log to Online
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOffline,
			model.StatusOnline,
			model.StatusLogReasonWindowFocus,
			model.StatusLogDeviceDesktop,
			true,
			"",
			false,
			"TestGetStatusLogStats",
			0,
		)

		// Log to Away
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestGetStatusLogStats",
			0,
		)

		// Log to DND
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusAway,
			model.StatusDnd,
			"user_set",
			model.StatusLogDeviceDesktop,
			true,
			"",
			true,
			"TestGetStatusLogStats",
			0,
		)

		// Log to Offline
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusDnd,
			model.StatusOffline,
			model.StatusLogReasonDNDExpired,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestGetStatusLogStats",
			0,
		)

		stats := th.Service.GetStatusLogStats()
		assert.Equal(t, 4, stats["total"])
		assert.Equal(t, 1, stats["online"])
		assert.Equal(t, 1, stats["away"])
		assert.Equal(t, 1, stats["dnd"])
		assert.Equal(t, 1, stats["offline"])
	})
}

func TestCleanupOldStatusLogs(t *testing.T) {
	t.Run("should delete logs older than retention period", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
			*cfg.MattermostExtendedSettings.Statuses.StatusLogRetentionDays = 7
		})

		// Create a log directly in the store with old timestamp
		oldLog := &model.StatusLog{
			Id:        model.NewId(),
			CreateAt:  model.GetMillis() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
			UserID:    th.BasicUser.Id,
			Username:  th.BasicUser.Username,
			OldStatus: model.StatusOnline,
			NewStatus: model.StatusAway,
			LogType:   model.StatusLogTypeStatusChange,
			Source:    "TestCleanupOldStatusLogs",
		}
		err := th.Service.Store.StatusLog().Save(oldLog)
		require.NoError(t, err)

		// Create a recent log
		th.Service.LogStatusChange(
			th.BasicUser.Id,
			th.BasicUser.Username,
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogReasonInactivity,
			model.StatusLogDeviceDesktop,
			false,
			"",
			false,
			"TestCleanupOldStatusLogs",
			0,
		)

		// Verify both logs exist
		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 2)

		// Run cleanup
		th.Service.CleanupOldStatusLogs()

		// Verify old log was deleted, recent remains
		logs = th.Service.GetStatusLogs()
		require.Len(t, logs, 1)
		assert.NotEqual(t, oldLog.Id, logs[0].Id)
	})

	t.Run("should NOT delete when retention is 0 (disabled)", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
			*cfg.MattermostExtendedSettings.Statuses.StatusLogRetentionDays = 0 // Disabled
		})

		// Create an old log directly
		oldLog := &model.StatusLog{
			Id:        model.NewId(),
			CreateAt:  model.GetMillis() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
			UserID:    th.BasicUser.Id,
			Username:  th.BasicUser.Username,
			OldStatus: model.StatusOnline,
			NewStatus: model.StatusAway,
			LogType:   model.StatusLogTypeStatusChange,
			Source:    "TestCleanupOldStatusLogs",
		}
		err := th.Service.Store.StatusLog().Save(oldLog)
		require.NoError(t, err)

		// Verify log exists
		logs := th.Service.GetStatusLogs()
		require.Len(t, logs, 1)

		// Run cleanup
		th.Service.CleanupOldStatusLogs()

		// Log should still exist (retention disabled)
		logs = th.Service.GetStatusLogs()
		assert.Len(t, logs, 1)
	})

	t.Run("should NOT delete when retention is negative", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
			*cfg.MattermostExtendedSettings.Statuses.StatusLogRetentionDays = -1 // Invalid
		})

		// Create an old log directly
		oldLog := &model.StatusLog{
			Id:        model.NewId(),
			CreateAt:  model.GetMillis() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
			UserID:    th.BasicUser.Id,
			Username:  th.BasicUser.Username,
			OldStatus: model.StatusOnline,
			NewStatus: model.StatusAway,
			LogType:   model.StatusLogTypeStatusChange,
			Source:    "TestCleanupOldStatusLogs",
		}
		err := th.Service.Store.StatusLog().Save(oldLog)
		require.NoError(t, err)

		// Run cleanup
		th.Service.CleanupOldStatusLogs()

		// Log should still exist
		logs := th.Service.GetStatusLogs()
		assert.Len(t, logs, 1)
	})
}

func TestCheckDNDTimeouts(t *testing.T) {
	t.Run("should set inactive DND users to Offline", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 30
			*cfg.MattermostExtendedSettings.Statuses.EnableStatusLogs = true
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

		// Run DND timeout check
		th.Service.CheckDNDTimeouts()

		// User should now be Offline
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusOffline, after.Status)
		assert.Equal(t, model.StatusDnd, after.PrevStatus)
	})

	t.Run("should NOT affect DND users within timeout", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 30
		})

		// Set DND status with recent LastActivityAt (20 minutes ago)
		recentTime := model.GetMillis() - (20 * 60 * 1000)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: recentTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Run DND timeout check
		th.Service.CheckDNDTimeouts()

		// User should still be DND
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
	})

	t.Run("should skip when AccurateStatuses is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = false
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 30
		})

		// Set DND status with old LastActivityAt
		oldTime := model.GetMillis() - (31 * 60 * 1000)
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Run DND timeout check
		th.Service.CheckDNDTimeouts()

		// User should still be DND (feature disabled)
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
	})

	t.Run("should skip when DNDInactivityTimeoutMinutes is 0", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AccurateStatuses = true
			*cfg.MattermostExtendedSettings.Statuses.DNDInactivityTimeoutMinutes = 0 // Disabled
		})

		// Set DND status with old LastActivityAt
		oldTime := model.GetMillis() - (60 * 60 * 1000) // 1 hour ago
		status := &model.Status{
			UserId:         th.BasicUser.Id,
			Status:         model.StatusDnd,
			Manual:         true,
			LastActivityAt: oldTime,
		}
		th.Service.SaveAndBroadcastStatus(status)

		// Run DND timeout check
		th.Service.CheckDNDTimeouts()

		// User should still be DND (timeout disabled)
		after, err := th.Service.GetStatus(th.BasicUser.Id)
		require.Nil(t, err)
		assert.Equal(t, model.StatusDnd, after.Status)
	})
}

func TestBuildStatusNotificationMessage(t *testing.T) {
	t.Run("should build correct message for Online status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username:  "testuser",
			NewStatus: model.StatusOnline,
			LogType:   model.StatusLogTypeStatusChange,
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser is now online", message)
	})

	t.Run("should build correct message for Away status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username:  "testuser",
			NewStatus: model.StatusAway,
			LogType:   model.StatusLogTypeStatusChange,
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser is now away", message)
	})

	t.Run("should build correct message for DND status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username:  "testuser",
			NewStatus: model.StatusDnd,
			LogType:   model.StatusLogTypeStatusChange,
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser is now on Do Not Disturb", message)
	})

	t.Run("should build correct message for Offline status", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username:  "testuser",
			NewStatus: model.StatusOffline,
			LogType:   model.StatusLogTypeStatusChange,
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser is now offline", message)
	})

	t.Run("should build message for sent message in channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Sent message in #general",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser messaged #general", message)
	})

	t.Run("should build message for sent message in DM", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Sent message in @bob",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser messaged @bob", message)
	})

	t.Run("should build message for channel view activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Loaded #general",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser opened #general", message)
	})

	t.Run("should build message for DM view activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Loaded @bob",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser opened chat with @bob", message)
	})

	t.Run("should build message for active channel set", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Active Channel set to #devops",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser is viewing #devops", message)
	})

	t.Run("should build message for active channel set to DM", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Active Channel set to @alice",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser is viewing @alice", message)
	})

	t.Run("should build message for fetch history in channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Fetched history of #general",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser scrolled in #general", message)
	})

	t.Run("should build message for fetch history in DM", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Fetched history of @bob",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser scrolled in @bob", message)
	})

	t.Run("should build message for window focus activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Reason:   model.StatusLogReasonWindowFocus,
			Trigger:  "Window Active",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser is active", message)
	})

	t.Run("should return empty for unknown log type", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  "unknown",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "", message)
	})

	t.Run("should fallback to trigger text for unknown activity", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Some custom trigger",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser: Some custom trigger", message)
	})

	t.Run("should fallback to generic message when no trigger", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "",
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser had activity", message)
	})

	t.Run("should handle sent message without channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		log := &model.StatusLog{
			Username: "testuser",
			LogType:  model.StatusLogTypeActivity,
			Trigger:  "Sent message in ", // No channel name
		}

		message := th.Service.buildStatusNotificationMessage(log)
		assert.Equal(t, "testuser sent a message", message)
	})
}

func TestExtractChannelOrDMTarget(t *testing.T) {
	t.Run("should extract channel name with #", func(t *testing.T) {
		result := extractChannelOrDMTarget("Sent message in #general")
		assert.Equal(t, "#general", result)
	})

	t.Run("should extract DM name with @", func(t *testing.T) {
		result := extractChannelOrDMTarget("Loaded @bob")
		assert.Equal(t, "@bob", result)
	})

	t.Run("should return empty for no target", func(t *testing.T) {
		result := extractChannelOrDMTarget("Window Active")
		assert.Equal(t, "", result)
	})

	t.Run("should handle channel name with special chars", func(t *testing.T) {
		result := extractChannelOrDMTarget("Active Channel set to #dev-ops_team")
		assert.Equal(t, "#dev-ops_team", result)
	})

	t.Run("should handle DM with dots in username", func(t *testing.T) {
		result := extractChannelOrDMTarget("Fetched history of @john.doe")
		assert.Equal(t, "@john.doe", result)
	})

	t.Run("should prefer last # if multiple present", func(t *testing.T) {
		result := extractChannelOrDMTarget("Some text with # and #actual-channel")
		assert.Equal(t, "#actual-channel", result)
	})

	t.Run("should handle empty string", func(t *testing.T) {
		result := extractChannelOrDMTarget("")
		assert.Equal(t, "", result)
	})

	t.Run("should handle group DM format", func(t *testing.T) {
		result := extractChannelOrDMTarget("Loaded @john, jane, bob")
		assert.Equal(t, "@john, jane, bob", result)
	})
}
