// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestGetDiagnostics(t *testing.T) {
	StoreTest(t, func(t *testing.T, _ request.CTX, ss store.Store) {
		sqlStore := ss.(*SqlStore)

		diagnostics, err := sqlStore.GetDiagnostics(context.Background())
		require.NoError(t, err)
		require.NotNil(t, diagnostics)

		// Pool stats are populated for every supported driver.
		assert.GreaterOrEqual(t, diagnostics.MasterConnectionsInUse, 0)
		assert.GreaterOrEqual(t, diagnostics.MasterConnectionsIdle, 0)

		if sqlStore.DriverName() != model.DatabaseDriverPostgres {
			assert.Nil(t, diagnostics.CacheHitRatio)
			return
		}

		require.NotNil(t, diagnostics.CacheHitRatio)
		assert.GreaterOrEqual(t, *diagnostics.CacheHitRatio, 0.0)
		assert.LessOrEqual(t, *diagnostics.CacheHitRatio, 1.0)
		require.NotNil(t, diagnostics.Deadlocks)
		require.NotNil(t, diagnostics.TempFiles)
		require.NotNil(t, diagnostics.TempBytesMB)
		require.NotNil(t, diagnostics.Rollbacks)
		require.NotNil(t, diagnostics.IdleInTransactionCount)
		require.NotNil(t, diagnostics.LongestQueryDurationSeconds)
		require.NotNil(t, diagnostics.WaitingForLockCount)
	})
}

func TestApplyDBPoolStats(t *testing.T) {
	diagnostics := &store.DatabaseDiagnostics{}
	applyDBPoolStats(
		diagnostics,
		sql.DBStats{
			InUse:             3,
			Idle:              7,
			WaitCount:         11,
			WaitDuration:      2*time.Second + 25*time.Millisecond,
			MaxIdleClosed:     13,
			MaxLifetimeClosed: 17,
		},
		sql.DBStats{
			InUse:             5,
			Idle:              9,
			WaitCount:         19,
			WaitDuration:      4*time.Second + 90*time.Millisecond,
			MaxIdleClosed:     23,
			MaxLifetimeClosed: 29,
		},
	)

	assert.Equal(t, 3, diagnostics.MasterConnectionsInUse)
	assert.Equal(t, 7, diagnostics.MasterConnectionsIdle)
	assert.Equal(t, int64(11), diagnostics.MasterPoolWaitCount)
	assert.Equal(t, int64(2025), diagnostics.MasterPoolWaitDurationMs)
	assert.Equal(t, int64(13), diagnostics.MasterConnectionsClosedMaxIdle)
	assert.Equal(t, int64(17), diagnostics.MasterConnectionsClosedMaxLifetime)
	assert.Equal(t, 5, diagnostics.ReplicaConnectionsInUse)
	assert.Equal(t, 9, diagnostics.ReplicaConnectionsIdle)
	assert.Equal(t, int64(19), diagnostics.ReplicaPoolWaitCount)
	assert.Equal(t, int64(4090), diagnostics.ReplicaPoolWaitDurationMs)
	assert.Equal(t, int64(23), diagnostics.ReplicaConnectionsClosedMaxIdle)
	assert.Equal(t, int64(29), diagnostics.ReplicaConnectionsClosedMaxLifetime)
}
