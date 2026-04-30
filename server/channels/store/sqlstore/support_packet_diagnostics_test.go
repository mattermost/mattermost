// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type mockRow struct {
	err  error
	scan func(dest ...any) error
}

func (m mockRow) Scan(dest ...any) error {
	if m.err != nil {
		return m.err
	}
	if m.scan != nil {
		return m.scan(dest...)
	}
	return nil
}

type mockQueryRowScanner struct {
	rows map[string]mockRow
}

func (m mockQueryRowScanner) QueryRowContext(_ context.Context, query string, _ ...any) rowScanner {
	row, ok := m.rows[query]
	if !ok {
		return mockRow{err: errors.New("unexpected query")}
	}
	return row
}

func TestCollectPostgresDatabaseDiagnosticsWithQueryer(t *testing.T) {
	t.Run("collects aggregate postgres diagnostics", func(t *testing.T) {
		queryer := mockQueryRowScanner{
			rows: map[string]mockRow{
				pgStatDatabaseQuery: {
					scan: func(dest ...any) error {
						*dest[0].(*float64) = 0.998
						*dest[1].(*int64) = 2
						*dest[2].(*int64) = 3
						*dest[3].(*int64) = 5 * 1024 * 1024
						*dest[4].(*int64) = 4
						return nil
					},
				},
				pgStatActivityQuery: {
					scan: func(dest ...any) error {
						*dest[0].(*int64) = 1
						*dest[1].(*float64) = 12.5
						*dest[2].(*int64) = 6
						return nil
					},
				},
				pgStatUserTablesQuery: {
					scan: func(dest ...any) error {
						*dest[0].(*int64) = 42
						*dest[1].(*sql.NullTime) = sql.NullTime{Time: time.Date(2026, 4, 29, 7, 10, 0, 0, time.UTC), Valid: true}
						return nil
					},
				},
			},
		}

		diagnostics, err := collectPostgresDatabaseDiagnosticsWithQueryer(context.Background(), queryer)
		require.NoError(t, err)
		require.NotNil(t, diagnostics)

		require.NotNil(t, diagnostics.CacheHitRatio)
		assert.InDelta(t, 0.998, *diagnostics.CacheHitRatio, 0.0001)
		require.NotNil(t, diagnostics.Deadlocks)
		assert.Equal(t, int64(2), *diagnostics.Deadlocks)
		require.NotNil(t, diagnostics.TempFiles)
		assert.Equal(t, int64(3), *diagnostics.TempFiles)
		require.NotNil(t, diagnostics.TempBytesMB)
		assert.InDelta(t, 5.0, *diagnostics.TempBytesMB, 0.0001)
		require.NotNil(t, diagnostics.Rollbacks)
		assert.Equal(t, int64(4), *diagnostics.Rollbacks)
		require.NotNil(t, diagnostics.IdleInTransactionCount)
		assert.Equal(t, int64(1), *diagnostics.IdleInTransactionCount)
		require.NotNil(t, diagnostics.LongestQueryDurationSeconds)
		assert.InDelta(t, 12.5, *diagnostics.LongestQueryDurationSeconds, 0.0001)
		require.NotNil(t, diagnostics.WaitingForLockCount)
		assert.Equal(t, int64(6), *diagnostics.WaitingForLockCount)
		require.NotNil(t, diagnostics.PostsDeadTuples)
		assert.Equal(t, int64(42), *diagnostics.PostsDeadTuples)
		require.NotNil(t, diagnostics.PostsLastAutovacuum)
		assert.Equal(t, time.Date(2026, 4, 29, 7, 10, 0, 0, time.UTC), *diagnostics.PostsLastAutovacuum)
	})

	t.Run("ignores missing posts row", func(t *testing.T) {
		queryer := mockQueryRowScanner{
			rows: map[string]mockRow{
				pgStatDatabaseQuery: {
					scan: func(dest ...any) error {
						*dest[0].(*float64) = 1
						*dest[1].(*int64) = 0
						*dest[2].(*int64) = 0
						*dest[3].(*int64) = 0
						*dest[4].(*int64) = 0
						return nil
					},
				},
				pgStatActivityQuery: {
					scan: func(dest ...any) error {
						*dest[0].(*int64) = 0
						*dest[1].(*float64) = 0
						*dest[2].(*int64) = 0
						return nil
					},
				},
				pgStatUserTablesQuery: {
					err: sql.ErrNoRows,
				},
			},
		}

		diagnostics, err := collectPostgresDatabaseDiagnosticsWithQueryer(context.Background(), queryer)
		require.NoError(t, err)
		require.NotNil(t, diagnostics)
		assert.Nil(t, diagnostics.PostsDeadTuples)
		assert.Nil(t, diagnostics.PostsLastAutovacuum)
	})

	t.Run("returns wrapped warning when any pg_stat query fails", func(t *testing.T) {
		queryer := mockQueryRowScanner{
			rows: map[string]mockRow{
				pgStatDatabaseQuery: {
					err: errors.New("boom-db"),
				},
				pgStatActivityQuery: {
					err: errors.New("boom-activity"),
				},
				pgStatUserTablesQuery: {
					err: errors.New("boom-posts"),
				},
			},
		}

		diagnostics, err := collectPostgresDatabaseDiagnosticsWithQueryer(context.Background(), queryer)
		require.Error(t, err)
		require.NotNil(t, diagnostics)
		assert.ErrorContains(t, err, "postgres diagnostics query failed for pg_stat_database")
		assert.ErrorContains(t, err, "postgres diagnostics query failed for pg_stat_activity")
		assert.ErrorContains(t, err, "postgres diagnostics query failed for pg_stat_user_tables")
	})

	t.Run("returns error when one pg_stat query fails but preserves successful diagnostics", func(t *testing.T) {
		queryer := mockQueryRowScanner{
			rows: map[string]mockRow{
				pgStatDatabaseQuery: {
					scan: func(dest ...any) error {
						*dest[0].(*float64) = 0.995
						*dest[1].(*int64) = 1
						*dest[2].(*int64) = 2
						*dest[3].(*int64) = 10 * 1024 * 1024
						*dest[4].(*int64) = 3
						return nil
					},
				},
				pgStatActivityQuery: {
					err: errors.New("boom-activity"),
				},
				pgStatUserTablesQuery: {
					scan: func(dest ...any) error {
						*dest[0].(*int64) = 44
						*dest[1].(*sql.NullTime) = sql.NullTime{Time: time.Date(2026, 4, 30, 9, 0, 0, 0, time.UTC), Valid: true}
						return nil
					},
				},
			},
		}

		diagnostics, err := collectPostgresDatabaseDiagnosticsWithQueryer(context.Background(), queryer)
		require.Error(t, err)
		require.NotNil(t, diagnostics)
		assert.ErrorContains(t, err, "postgres diagnostics query failed for pg_stat_activity")
		assert.NotContains(t, err.Error(), "postgres diagnostics query failed for pg_stat_database")
		assert.NotContains(t, err.Error(), "postgres diagnostics query failed for pg_stat_user_tables")

		require.NotNil(t, diagnostics.CacheHitRatio)
		assert.InDelta(t, 0.995, *diagnostics.CacheHitRatio, 0.0001)
		require.NotNil(t, diagnostics.Deadlocks)
		assert.Equal(t, int64(1), *diagnostics.Deadlocks)
		require.NotNil(t, diagnostics.TempFiles)
		assert.Equal(t, int64(2), *diagnostics.TempFiles)
		require.NotNil(t, diagnostics.TempBytesMB)
		assert.InDelta(t, 10.0, *diagnostics.TempBytesMB, 0.0001)
		require.NotNil(t, diagnostics.Rollbacks)
		assert.Equal(t, int64(3), *diagnostics.Rollbacks)

		assert.Nil(t, diagnostics.IdleInTransactionCount)
		assert.Nil(t, diagnostics.LongestQueryDurationSeconds)
		assert.Nil(t, diagnostics.WaitingForLockCount)

		require.NotNil(t, diagnostics.PostsDeadTuples)
		assert.Equal(t, int64(44), *diagnostics.PostsDeadTuples)
		require.NotNil(t, diagnostics.PostsLastAutovacuum)
		assert.Equal(t, time.Date(2026, 4, 30, 9, 0, 0, 0, time.UTC), *diagnostics.PostsLastAutovacuum)
	})
}

func TestApplyDBPoolStats(t *testing.T) {
	diagnostics := &model.SupportPacketDatabaseDiagnostics{}
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
