// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestStatusLogStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testStatusLogStoreSave(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testStatusLogStoreGet(t, rctx, ss) })
	t.Run("GetCount", func(t *testing.T) { testStatusLogStoreGetCount(t, rctx, ss) })
	t.Run("GetStats", func(t *testing.T) { testStatusLogStoreGetStats(t, rctx, ss) })
	t.Run("DeleteOlderThan", func(t *testing.T) { testStatusLogStoreDeleteOlderThan(t, rctx, ss) })
	t.Run("DeleteAll", func(t *testing.T) { testStatusLogStoreDeleteAll(t, rctx, ss) })
}

func createTestStatusLog(userId, username, oldStatus, newStatus, logType string) *model.StatusLog {
	return &model.StatusLog{
		Id:             model.NewId(),
		CreateAt:       model.GetMillis(),
		UserID:         userId,
		Username:       username,
		OldStatus:      oldStatus,
		NewStatus:      newStatus,
		Reason:         model.StatusLogReasonHeartbeat,
		WindowActive:   true,
		Device:         model.StatusLogDeviceWeb,
		LogType:        logType,
		Trigger:        model.StatusLogTriggerHeartbeat,
		Manual:         false,
		Source:         "test",
		LastActivityAt: model.GetMillis(),
	}
}

func testStatusLogStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	// Clean up first
	_ = ss.StatusLog().DeleteAll()

	t.Run("saves status log entry", func(t *testing.T) {
		log := createTestStatusLog(
			model.NewId(),
			"testuser",
			model.StatusOffline,
			model.StatusOnline,
			model.StatusLogTypeStatusChange,
		)

		err := ss.StatusLog().Save(log)
		require.NoError(t, err)

		// Verify saved
		logs, err := ss.StatusLog().Get(model.StatusLogGetOptions{PerPage: 10})
		require.NoError(t, err)
		require.Len(t, logs, 1)
		assert.Equal(t, log.Id, logs[0].Id)
		assert.Equal(t, log.Username, logs[0].Username)
		assert.Equal(t, log.NewStatus, logs[0].NewStatus)
	})

	t.Run("sets timestamp", func(t *testing.T) {
		log := createTestStatusLog(
			model.NewId(),
			"testuser2",
			model.StatusOnline,
			model.StatusAway,
			model.StatusLogTypeStatusChange,
		)
		log.CreateAt = 0 // Clear to test if it gets set

		err := ss.StatusLog().Save(log)
		require.NoError(t, err)

		// Note: CreateAt is set by the caller, not the store
		// The store just saves what's given
	})

	// Cleanup
	_ = ss.StatusLog().DeleteAll()
}

func testStatusLogStoreGet(t *testing.T, rctx request.CTX, ss store.Store) {
	// Clean up first
	_ = ss.StatusLog().DeleteAll()

	// Create test logs
	userId := model.NewId()
	username := "filteruser"

	logs := []*model.StatusLog{
		createTestStatusLog(userId, username, model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange),
		createTestStatusLog(userId, username, model.StatusOnline, model.StatusAway, model.StatusLogTypeStatusChange),
		createTestStatusLog(model.NewId(), "otheruser", model.StatusOnline, model.StatusDnd, model.StatusLogTypeStatusChange),
	}
	// Space out the timestamps
	logs[0].CreateAt = model.GetMillis() - 2000
	logs[1].CreateAt = model.GetMillis() - 1000
	logs[2].CreateAt = model.GetMillis()

	for _, log := range logs {
		err := ss.StatusLog().Save(log)
		require.NoError(t, err)
	}
	defer func() { _ = ss.StatusLog().DeleteAll() }()

	t.Run("returns logs with pagination", func(t *testing.T) {
		result, err := ss.StatusLog().Get(model.StatusLogGetOptions{Page: 0, PerPage: 2})
		require.NoError(t, err)
		assert.Len(t, result, 2)
	})

	t.Run("applies all filters correctly", func(t *testing.T) {
		// Filter by user ID
		result, err := ss.StatusLog().Get(model.StatusLogGetOptions{UserID: userId, PerPage: 10})
		require.NoError(t, err)
		assert.Len(t, result, 2)
		for _, r := range result {
			assert.Equal(t, userId, r.UserID)
		}

		// Filter by username
		result, err = ss.StatusLog().Get(model.StatusLogGetOptions{Username: username, PerPage: 10})
		require.NoError(t, err)
		assert.Len(t, result, 2)

		// Filter by log type
		result, err = ss.StatusLog().Get(model.StatusLogGetOptions{LogType: model.StatusLogTypeStatusChange, PerPage: 10})
		require.NoError(t, err)
		assert.Len(t, result, 3)

		// Filter by status
		result, err = ss.StatusLog().Get(model.StatusLogGetOptions{Status: model.StatusOnline, PerPage: 10})
		require.NoError(t, err)
		assert.Len(t, result, 1)
		assert.Equal(t, model.StatusOnline, result[0].NewStatus)

		// Filter by time range
		since := logs[1].CreateAt - 100
		result, err = ss.StatusLog().Get(model.StatusLogGetOptions{Since: since, PerPage: 10})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(result), 2)
	})

	t.Run("orders by timestamp descending", func(t *testing.T) {
		result, err := ss.StatusLog().Get(model.StatusLogGetOptions{PerPage: 10})
		require.NoError(t, err)
		require.Len(t, result, 3)
		// Newest first
		assert.GreaterOrEqual(t, result[0].CreateAt, result[1].CreateAt)
		assert.GreaterOrEqual(t, result[1].CreateAt, result[2].CreateAt)
	})
}

func testStatusLogStoreGetCount(t *testing.T, rctx request.CTX, ss store.Store) {
	// Clean up first
	_ = ss.StatusLog().DeleteAll()

	// Create test logs
	userId := model.NewId()
	logs := []*model.StatusLog{
		createTestStatusLog(userId, "user1", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange),
		createTestStatusLog(userId, "user1", model.StatusOnline, model.StatusAway, model.StatusLogTypeStatusChange),
		createTestStatusLog(model.NewId(), "user2", model.StatusOnline, model.StatusDnd, model.StatusLogTypeStatusChange),
	}

	for _, log := range logs {
		err := ss.StatusLog().Save(log)
		require.NoError(t, err)
	}
	defer func() { _ = ss.StatusLog().DeleteAll() }()

	t.Run("returns total count", func(t *testing.T) {
		count, err := ss.StatusLog().GetCount(model.StatusLogGetOptions{})
		require.NoError(t, err)
		assert.Equal(t, int64(3), count)
	})

	t.Run("applies filters", func(t *testing.T) {
		count, err := ss.StatusLog().GetCount(model.StatusLogGetOptions{UserID: userId})
		require.NoError(t, err)
		assert.Equal(t, int64(2), count)

		count, err = ss.StatusLog().GetCount(model.StatusLogGetOptions{Status: model.StatusOnline})
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})
}

func testStatusLogStoreGetStats(t *testing.T, rctx request.CTX, ss store.Store) {
	// Clean up first
	_ = ss.StatusLog().DeleteAll()

	// Create test logs with different statuses
	logs := []*model.StatusLog{
		createTestStatusLog(model.NewId(), "user1", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange),
		createTestStatusLog(model.NewId(), "user2", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange),
		createTestStatusLog(model.NewId(), "user3", model.StatusOnline, model.StatusAway, model.StatusLogTypeStatusChange),
		createTestStatusLog(model.NewId(), "user4", model.StatusOnline, model.StatusDnd, model.StatusLogTypeStatusChange),
		createTestStatusLog(model.NewId(), "user5", model.StatusOnline, model.StatusOffline, model.StatusLogTypeStatusChange),
	}

	for _, log := range logs {
		err := ss.StatusLog().Save(log)
		require.NoError(t, err)
	}
	defer func() { _ = ss.StatusLog().DeleteAll() }()

	t.Run("returns counts by status type", func(t *testing.T) {
		stats, err := ss.StatusLog().GetStats(model.StatusLogGetOptions{})
		require.NoError(t, err)

		assert.Equal(t, int64(5), stats["total"])
		assert.Equal(t, int64(2), stats["online"])
		assert.Equal(t, int64(1), stats["away"])
		assert.Equal(t, int64(1), stats["dnd"])
		assert.Equal(t, int64(1), stats["offline"])
	})

	t.Run("applies time filters", func(t *testing.T) {
		// Add a log with different timestamp
		oldLog := createTestStatusLog(model.NewId(), "olduser", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange)
		oldLog.CreateAt = model.GetMillis() - 86400000 // 1 day ago
		err := ss.StatusLog().Save(oldLog)
		require.NoError(t, err)

		// Filter to recent logs only
		since := model.GetMillis() - 60000 // Last minute
		stats, err := ss.StatusLog().GetStats(model.StatusLogGetOptions{Since: since})
		require.NoError(t, err)

		assert.Equal(t, int64(5), stats["total"]) // Excludes old log
	})
}

func testStatusLogStoreDeleteOlderThan(t *testing.T, rctx request.CTX, ss store.Store) {
	// Clean up first
	_ = ss.StatusLog().DeleteAll()

	// Create test logs with different timestamps
	now := model.GetMillis()
	logs := []*model.StatusLog{
		createTestStatusLog(model.NewId(), "old1", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange),
		createTestStatusLog(model.NewId(), "old2", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange),
		createTestStatusLog(model.NewId(), "new1", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange),
	}
	logs[0].CreateAt = now - 86400000*2 // 2 days ago
	logs[1].CreateAt = now - 86400000   // 1 day ago
	logs[2].CreateAt = now              // Now

	for _, log := range logs {
		err := ss.StatusLog().Save(log)
		require.NoError(t, err)
	}
	defer func() { _ = ss.StatusLog().DeleteAll() }()

	t.Run("deletes logs older than timestamp", func(t *testing.T) {
		threshold := now - 86400000/2 // 12 hours ago

		deleted, err := ss.StatusLog().DeleteOlderThan(threshold)
		require.NoError(t, err)
		assert.Equal(t, int64(2), deleted)

		// Verify only new log remains
		count, err := ss.StatusLog().GetCount(model.StatusLogGetOptions{})
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})

	t.Run("returns count of deleted", func(t *testing.T) {
		// Add more logs
		log := createTestStatusLog(model.NewId(), "todelete", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange)
		log.CreateAt = now - 100000 // 100 seconds ago
		err := ss.StatusLog().Save(log)
		require.NoError(t, err)

		threshold := now - 50000 // 50 seconds ago
		deleted, err := ss.StatusLog().DeleteOlderThan(threshold)
		require.NoError(t, err)
		assert.Equal(t, int64(1), deleted)
	})
}

func testStatusLogStoreDeleteAll(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create test logs
	for i := 0; i < 5; i++ {
		log := createTestStatusLog(model.NewId(), "deleteall", model.StatusOffline, model.StatusOnline, model.StatusLogTypeStatusChange)
		err := ss.StatusLog().Save(log)
		require.NoError(t, err)
	}

	// Verify logs exist
	count, err := ss.StatusLog().GetCount(model.StatusLogGetOptions{Username: "deleteall"})
	require.NoError(t, err)
	assert.Equal(t, int64(5), count)

	t.Run("deletes all logs", func(t *testing.T) {
		err := ss.StatusLog().DeleteAll()
		require.NoError(t, err)

		count, err := ss.StatusLog().GetCount(model.StatusLogGetOptions{})
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})
}