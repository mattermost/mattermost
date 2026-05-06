// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"time"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	pgDiagnosticsQueryTimeout = 10 * time.Second

	pgStatDatabaseQuery = `
SELECT
    COALESCE(blks_hit::double precision / NULLIF(blks_hit + blks_read, 0), 0) AS cache_hit_ratio,
    deadlocks,
    temp_files,
    temp_bytes,
    xact_rollback
FROM pg_stat_database
WHERE datname = current_database()`

	pgStatActivityQuery = `
SELECT
    COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction_count,
    EXTRACT(EPOCH FROM COALESCE(
        MAX(clock_timestamp() - query_start) FILTER (WHERE state = 'active' AND query_start IS NOT NULL),
        interval '0 second'
    )) AS longest_query_duration_seconds,
    COUNT(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting_for_lock_count
FROM pg_stat_activity
WHERE datname = current_database()`

	pgStatUserTablesQuery = `
SELECT
    n_dead_tup,
    last_autovacuum
FROM pg_stat_user_tables
WHERE lower(relname) = 'posts'
ORDER BY CASE WHEN schemaname = 'public' THEN 0 ELSE 1 END, relid
LIMIT 1`
)

type queryRowScanner interface {
	QueryRowContext(ctx context.Context, query string, args ...any) rowScanner
}

type rowScanner interface {
	Scan(dest ...any) error
}

type sqlQueryRowScanner struct {
	db *sql.DB
}

func (s sqlQueryRowScanner) QueryRowContext(ctx context.Context, query string, args ...any) rowScanner {
	return s.db.QueryRowContext(ctx, query, args...)
}

func (ss *SqlStore) GetSupportPacketDatabaseDiagnostics(ctx context.Context) (*store.SupportPacketDatabaseDiagnostics, error) {
	diagnostics := &store.SupportPacketDatabaseDiagnostics{}
	applyDBPoolStats(diagnostics, ss.MasterDBStats(), ss.ReplicaDBStats())

	if ss.DriverName() != model.DatabaseDriverPostgres {
		return diagnostics, nil
	}

	pgDiagnostics, err := collectPostgresDatabaseDiagnostics(ctx, ss.GetInternalMasterDB())
	if pgDiagnostics != nil {
		mergePostgresDiagnostics(diagnostics, pgDiagnostics)
	}

	return diagnostics, err
}

func collectPostgresDatabaseDiagnostics(ctx context.Context, db *sql.DB) (*store.SupportPacketDatabaseDiagnostics, error) {
	if db == nil {
		return nil, errors.New("postgres diagnostics query failed: no master database connection")
	}
	return collectPostgresDatabaseDiagnosticsWithQueryer(ctx, sqlQueryRowScanner{db: db})
}

func collectPostgresDatabaseDiagnosticsWithQueryer(ctx context.Context, queryer queryRowScanner) (*store.SupportPacketDatabaseDiagnostics, error) {
	if queryer == nil {
		return nil, errors.New("postgres diagnostics query failed: no master database connection")
	}

	if ctx == nil {
		ctx = context.Background()
	}

	diagnostics := &store.SupportPacketDatabaseDiagnostics{}
	var rErr *multierror.Error

	databaseCtx, cancelDatabase := context.WithTimeout(ctx, pgDiagnosticsQueryTimeout)
	if err := collectPGStatDatabaseDiagnostics(databaseCtx, queryer, diagnostics); err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "postgres diagnostics query failed for pg_stat_database"))
	}
	cancelDatabase()

	activityCtx, cancelActivity := context.WithTimeout(ctx, pgDiagnosticsQueryTimeout)
	if err := collectPGStatActivityDiagnostics(activityCtx, queryer, diagnostics); err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "postgres diagnostics query failed for pg_stat_activity"))
	}
	cancelActivity()

	userTablesCtx, cancelUserTables := context.WithTimeout(ctx, pgDiagnosticsQueryTimeout)
	if err := collectPGStatUserTablesDiagnostics(userTablesCtx, queryer, diagnostics); err != nil {
		rErr = multierror.Append(rErr, errors.Wrap(err, "postgres diagnostics query failed for pg_stat_user_tables"))
	}
	cancelUserTables()

	return diagnostics, rErr.ErrorOrNil()
}

func applyDBPoolStats(diagnostics *store.SupportPacketDatabaseDiagnostics, masterDBStats, replicaDBStats sql.DBStats) {
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

func mergePostgresDiagnostics(target, source *store.SupportPacketDatabaseDiagnostics) {
	target.CacheHitRatio = source.CacheHitRatio
	target.Deadlocks = source.Deadlocks
	target.TempFiles = source.TempFiles
	target.TempBytesMB = source.TempBytesMB
	target.Rollbacks = source.Rollbacks
	target.IdleInTransactionCount = source.IdleInTransactionCount
	target.LongestQueryDurationSeconds = source.LongestQueryDurationSeconds
	target.WaitingForLockCount = source.WaitingForLockCount
	target.PostsDeadTuples = source.PostsDeadTuples
	target.PostsLastAutovacuum = source.PostsLastAutovacuum
}

func collectPGStatDatabaseDiagnostics(ctx context.Context, queryer queryRowScanner, diagnostics *store.SupportPacketDatabaseDiagnostics) error {
	var (
		cacheHitRatio float64
		deadlocks     int64
		tempFiles     int64
		tempBytes     int64
		rollbacks     int64
	)

	if err := queryer.QueryRowContext(ctx, pgStatDatabaseQuery).Scan(&cacheHitRatio, &deadlocks, &tempFiles, &tempBytes, &rollbacks); err != nil {
		return err
	}

	tempBytesMB := float64(tempBytes) / (1024 * 1024)
	diagnostics.CacheHitRatio = &cacheHitRatio
	diagnostics.Deadlocks = &deadlocks
	diagnostics.TempFiles = &tempFiles
	diagnostics.TempBytesMB = &tempBytesMB
	diagnostics.Rollbacks = &rollbacks

	return nil
}

func collectPGStatActivityDiagnostics(ctx context.Context, queryer queryRowScanner, diagnostics *store.SupportPacketDatabaseDiagnostics) error {
	var (
		idleInTransactionCount      int64
		longestQueryDurationSeconds float64
		waitingForLockCount         int64
	)

	if err := queryer.QueryRowContext(ctx, pgStatActivityQuery).Scan(&idleInTransactionCount, &longestQueryDurationSeconds, &waitingForLockCount); err != nil {
		return err
	}

	diagnostics.IdleInTransactionCount = &idleInTransactionCount
	diagnostics.LongestQueryDurationSeconds = &longestQueryDurationSeconds
	diagnostics.WaitingForLockCount = &waitingForLockCount

	return nil
}

func collectPGStatUserTablesDiagnostics(ctx context.Context, queryer queryRowScanner, diagnostics *store.SupportPacketDatabaseDiagnostics) error {
	var (
		postsDeadTuples int64
		lastAutovacuum  sql.NullTime
	)

	if err := queryer.QueryRowContext(ctx, pgStatUserTablesQuery).Scan(&postsDeadTuples, &lastAutovacuum); err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	diagnostics.PostsDeadTuples = &postsDeadTuples
	if lastAutovacuum.Valid {
		ts := lastAutovacuum.Time.UTC()
		diagnostics.PostsLastAutovacuum = &ts
	}

	return nil
}
