// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"time"

	"github.com/hashicorp/go-multierror"
	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const pgDiagnosticsQueryTimeout = 10 * time.Second

func (ss *SqlStore) GetDiagnostics(ctx context.Context) (*store.DatabaseDiagnostics, error) {
	diagnostics := &store.DatabaseDiagnostics{}
	applyDBPoolStats(diagnostics, ss.MasterDBStats(), ss.ReplicaDBStats())

	if ss.DriverName() != model.DatabaseDriverPostgres {
		return diagnostics, nil
	}

	if err := collectPostgresDatabaseDiagnostics(ctx, ss.GetMaster().DB(), diagnostics); err != nil {
		return diagnostics, err
	}

	return diagnostics, nil
}

func collectPostgresDatabaseDiagnostics(ctx context.Context, db *sqlx.DB, diagnostics *store.DatabaseDiagnostics) error {
	if db == nil {
		return errors.New("postgres diagnostics query failed: no master database connection")
	}

	var rErr *multierror.Error

	if err := withDiagnosticsTimeout(ctx, func(ctx context.Context) error {
		return collectPGStatDatabaseDiagnostics(ctx, db, diagnostics)
	}); err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "postgres diagnostics query failed for pg_stat_database"))
	}

	if err := withDiagnosticsTimeout(ctx, func(ctx context.Context) error {
		return collectPGStatActivityDiagnostics(ctx, db, diagnostics)
	}); err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "postgres diagnostics query failed for pg_stat_activity"))
	}

	if err := withDiagnosticsTimeout(ctx, func(ctx context.Context) error {
		return collectPGStatUserTablesDiagnostics(ctx, db, diagnostics)
	}); err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "postgres diagnostics query failed for pg_stat_user_tables"))
	}

	return rErr.ErrorOrNil()
}

func withDiagnosticsTimeout(ctx context.Context, fn func(context.Context) error) error {
	ctx, cancel := context.WithTimeout(ctx, pgDiagnosticsQueryTimeout)
	defer cancel()
	return fn(ctx)
}

func applyDBPoolStats(diagnostics *store.DatabaseDiagnostics, masterDBStats, replicaDBStats sql.DBStats) {
	diagnostics.MasterConnectionsInUse = masterDBStats.InUse
	diagnostics.MasterConnectionsIdle = masterDBStats.Idle
	diagnostics.MasterPoolWaitCount = masterDBStats.WaitCount
	diagnostics.MasterPoolWaitDurationMs = masterDBStats.WaitDuration.Milliseconds()
	diagnostics.MasterConnectionsClosedMaxIdle = masterDBStats.MaxIdleClosed
	diagnostics.MasterConnectionsClosedMaxLifetime = masterDBStats.MaxLifetimeClosed

	diagnostics.ReplicaConnectionsInUse = replicaDBStats.InUse
	diagnostics.ReplicaConnectionsIdle = replicaDBStats.Idle
	diagnostics.ReplicaPoolWaitCount = replicaDBStats.WaitCount
	diagnostics.ReplicaPoolWaitDurationMs = replicaDBStats.WaitDuration.Milliseconds()
	diagnostics.ReplicaConnectionsClosedMaxIdle = replicaDBStats.MaxIdleClosed
	diagnostics.ReplicaConnectionsClosedMaxLifetime = replicaDBStats.MaxLifetimeClosed
}

func collectPGStatDatabaseDiagnostics(ctx context.Context, db *sqlx.DB, diagnostics *store.DatabaseDiagnostics) error {
	var row struct {
		CacheHitRatio float64 `db:"cache_hit_ratio"`
		Deadlocks     int64   `db:"deadlocks"`
		TempFiles     int64   `db:"temp_files"`
		TempBytes     int64   `db:"temp_bytes"`
		XactRollback  int64   `db:"xact_rollback"`
	}

	const query = `
SELECT
    COALESCE(blks_hit::double precision / NULLIF(blks_hit + blks_read, 0), 0) AS cache_hit_ratio,
    deadlocks,
    temp_files,
    temp_bytes,
    xact_rollback
FROM pg_stat_database
WHERE datname = current_database()`

	if err := db.GetContext(ctx, &row, query); err != nil {
		return err
	}

	tempBytesMB := float64(row.TempBytes) / (1024 * 1024)
	diagnostics.CacheHitRatio = &row.CacheHitRatio
	diagnostics.Deadlocks = &row.Deadlocks
	diagnostics.TempFiles = &row.TempFiles
	diagnostics.TempBytesMB = &tempBytesMB
	diagnostics.Rollbacks = &row.XactRollback

	return nil
}

func collectPGStatActivityDiagnostics(ctx context.Context, db *sqlx.DB, diagnostics *store.DatabaseDiagnostics) error {
	var row struct {
		IdleInTransactionCount      int64   `db:"idle_in_transaction_count"`
		LongestQueryDurationSeconds float64 `db:"longest_query_duration_seconds"`
		WaitingForLockCount         int64   `db:"waiting_for_lock_count"`
	}

	const query = `
SELECT
    COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction_count,
    EXTRACT(EPOCH FROM COALESCE(
        MAX(clock_timestamp() - query_start) FILTER (WHERE state = 'active' AND query_start IS NOT NULL),
        interval '0 second'
    )) AS longest_query_duration_seconds,
    COUNT(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting_for_lock_count
FROM pg_stat_activity
WHERE datname = current_database()`

	if err := db.GetContext(ctx, &row, query); err != nil {
		return err
	}

	diagnostics.IdleInTransactionCount = &row.IdleInTransactionCount
	diagnostics.LongestQueryDurationSeconds = &row.LongestQueryDurationSeconds
	diagnostics.WaitingForLockCount = &row.WaitingForLockCount

	return nil
}

func collectPGStatUserTablesDiagnostics(ctx context.Context, db *sqlx.DB, diagnostics *store.DatabaseDiagnostics) error {
	var row struct {
		NDeadTup       int64        `db:"n_dead_tup"`
		LastAutovacuum sql.NullTime `db:"last_autovacuum"`
	}

	const query = `
SELECT
    n_dead_tup,
    last_autovacuum
FROM pg_stat_user_tables
WHERE lower(relname) = 'posts'
  AND schemaname = current_schema()
LIMIT 1`

	if err := db.GetContext(ctx, &row, query); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	diagnostics.PostsDeadTuples = &row.NDeadTup
	if row.LastAutovacuum.Valid {
		ts := row.LastAutovacuum.Time.UTC()
		diagnostics.PostsLastAutovacuum = &ts
	}

	return nil
}
