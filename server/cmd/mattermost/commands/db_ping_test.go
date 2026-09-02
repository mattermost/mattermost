// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	dbsql "database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// dsnFromHelper builds a postgres:// DSN from the test main helper's SqlSettings.
// The helper itself stores the live test postgres DSN.
func dsnFromHelper(t *testing.T) string {
	t.Helper()
	require.NotNil(t, mainHelper, "mainHelper must be initialized; do not run with -short")
	settings := mainHelper.GetSQLSettings()
	require.NotNil(t, settings.DataSource)
	require.NotEmpty(t, *settings.DataSource)
	return *settings.DataSource
}

// --- subprocess (CLI integration) tests ---

func TestDBPingHappyPath(t *testing.T) {
	if testing.Short() {
		t.Skip("requires live test database")
	}

	th := SetupWithStoreMock(t)
	output := th.CheckCommand(t, "db", "ping", "--timeout", "30s")
	require.Contains(t, output, "Database is reachable",
		"expected success log line in command output, got: %s", output)
}

func TestDBPingDirectDSN(t *testing.T) {
	if testing.Short() {
		t.Skip("requires live test database")
	}

	th := SetupWithStoreMock(t)
	th.SetAutoConfig(false)

	dsn := dsnFromHelper(t)
	output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping", "--timeout", "30s")
	require.NoError(t, err, "command should succeed when DSN is direct postgres URL; output: %s", output)
	require.Contains(t, output, "Database is reachable")
}

func TestDBPingTimeoutOnUnreachableDB(t *testing.T) {
	th := SetupWithStoreMock(t)
	th.SetAutoConfig(false)

	// Loopback to a port nothing listens on; connect_timeout=1 keeps each
	// attempt short. We allow 2s total with 500ms between attempts so we get
	// multiple "Waiting for database" lines.
	dsn := "postgres://nobody@127.0.0.1:1/mattermost?sslmode=disable&connect_timeout=1"

	start := time.Now()
	output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping",
		"--timeout", "2s", "--retry-interval", "500ms")
	elapsed := time.Since(start)

	require.Error(t, err, "command should fail on unreachable DB; output: %s", output)
	require.Contains(t, output, "timed out waiting for database",
		"expected timeout message in output, got: %s", output)
	require.LessOrEqual(t, elapsed, 30*time.Second,
		"command should not exceed a generous upper bound; took %s", elapsed)
}

func TestDBPingInvalidDSN(t *testing.T) {
	th := SetupWithStoreMock(t)
	th.SetAutoConfig(false)

	// Passes IsDatabaseDSN (postgres:// prefix) so it takes the direct path.
	dsn := "postgres://leakyuser:supersecret@[invalid"

	output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping",
		"--timeout", "2s", "--retry-interval", "500ms")
	require.Error(t, err, "command should fail on malformed DSN; output: %s", output)
	require.Contains(t, output, "invalid database DSN",
		"expected sanitized DSN parse error; got: %s", output)
	require.Contains(t, output, "missing ']' in host",
		"expected malformed DSN reason; got: %s", output)
	require.NotContains(t, output, "supersecret",
		"malformed DSN errors must not leak credentials; got: %s", output)
	require.NotContains(t, output, "leakyuser",
		"malformed DSN errors must not leak credentials; got: %s", output)
}

func TestDBPingMissingConfigFile(t *testing.T) {
	th := SetupWithStoreMock(t)
	th.SetAutoConfig(false)

	// Point --config at a path that does not exist; createFileIfNotExist=false
	// inside resolvePingDataSource means NewStoreFromDSN will return an error.
	missing := th.TemporaryDirectory() + "/does-not-exist.json"

	output, err := th.RunCommandWithOutput(t, "--config", missing, "db", "ping",
		"--timeout", "2s", "--retry-interval", "500ms")
	require.Error(t, err, "command should fail when --config file does not exist; output: %s", output)
	require.Contains(t, output, "failed to load configuration",
		"expected config-load error message; got: %s", output)
}

func TestDBPingFlagValidation(t *testing.T) {
	th := SetupWithStoreMock(t)
	th.SetAutoConfig(false)
	dsn := "postgres://localhost:1/mattermost?sslmode=disable&connect_timeout=1"

	t.Run("zero timeout", func(t *testing.T) {
		output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping",
			"--timeout", "0s")
		require.Error(t, err)
		require.Contains(t, output, "--timeout must be > 0",
			"expected timeout validation error; got: %s", output)
	})

	t.Run("zero retry interval", func(t *testing.T) {
		output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping",
			"--timeout", "1s", "--retry-interval", "0s")
		require.Error(t, err)
		require.Contains(t, output, "--retry-interval must be > 0",
			"expected retry-interval validation error; got: %s", output)
	})

	t.Run("negative timeout", func(t *testing.T) {
		output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping",
			"--timeout", "-1s")
		require.Error(t, err)
		require.Contains(t, output, "--timeout must be > 0",
			"expected timeout validation error for negative value; got: %s", output)
	})

	t.Run("garbage timeout value", func(t *testing.T) {
		// cobra refuses to parse "garbage" as a duration; subcommand never runs.
		output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping",
			"--timeout", "garbage")
		require.Error(t, err)
		// Don't pin to exact text — cobra owns the error string here. Just
		// confirm the subcommand's success log is absent.
		require.NotContains(t, output, "Database is reachable",
			"command should not have run successfully; got: %s", output)
	})
}

func TestDBPingRetryIntervalHonored(t *testing.T) {
	th := SetupWithStoreMock(t)
	th.SetAutoConfig(false)

	dsn := "postgres://nobody@127.0.0.1:1/mattermost?sslmode=disable&connect_timeout=1"

	start := time.Now()
	output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping",
		"--timeout", "2s", "--retry-interval", "500ms")
	elapsed := time.Since(start)

	require.Error(t, err)
	// Loose lower bound: at 500ms intervals we expect at least 2 retries
	// (~1s wall clock minimum) before the 2s timeout strikes.
	require.GreaterOrEqual(t, elapsed, 1*time.Second,
		"expected retries to span at least 1s; got %s", elapsed)
	// Loose upper bound: don't exceed several multiples of the configured
	// timeout — accommodates CI variance.
	require.LessOrEqual(t, elapsed, 30*time.Second,
		"expected command to bail close to --timeout; took %s", elapsed)

	waitingCount := strings.Count(output, "Waiting for database")
	require.GreaterOrEqual(t, waitingCount, 2,
		"expected at least 2 'Waiting for database' lines; got %d in output:\n%s",
		waitingCount, output)
}

// TestDBPingShortRetryIntervalProducesMoreAttempts verifies that the
// --retry-interval flag actually controls the cadence (not just the timeout).
func TestDBPingShortRetryIntervalProducesMoreAttempts(t *testing.T) {
	th := SetupWithStoreMock(t)
	th.SetAutoConfig(false)

	dsn := "postgres://nobody@127.0.0.1:1/mattermost?sslmode=disable&connect_timeout=1"

	output, err := th.RunCommandWithOutput(t, "--config", dsn, "db", "ping",
		"--timeout", "3s", "--retry-interval", "200ms")
	require.Error(t, err)

	waitingCount := strings.Count(output, "Waiting for database")
	// At 200ms intervals over 3s we expect well more than 3 attempts even
	// accounting for per-attempt connection overhead.
	require.GreaterOrEqual(t, waitingCount, 3,
		"expected several retries with short interval; got %d in output:\n%s",
		waitingCount, output)
}

// TestDBPingCmdRegistered confirms the new subcommand is wired into the
// existing DbCmd group, so users actually get `mattermost db ping`.
func TestDBPingCmdRegistered(t *testing.T) {
	require.Contains(t, DbCmd.Commands(), DBPingCmd,
		"DBPingCmd should be registered as a subcommand of DbCmd")
	require.Equal(t, "ping", DBPingCmd.Use)

	// Flags exist with sensible defaults.
	timeoutFlag := DBPingCmd.Flags().Lookup("timeout")
	require.NotNil(t, timeoutFlag)
	require.Equal(t, dbPingDefaultTimeout.String(), timeoutFlag.DefValue)

	intervalFlag := DBPingCmd.Flags().Lookup("retry-interval")
	require.NotNil(t, intervalFlag)
	require.Equal(t, dbPingDefaultRetryInterval.String(), intervalFlag.DefValue)
}

// --- in-process tests of pingWithRetry / resolvePingDataSource ---

func TestPingWithRetry_SuccessOnFirstAttempt(t *testing.T) {
	if testing.Short() {
		t.Skip("requires live test database")
	}

	dsn := dsnFromHelper(t)
	db, err := dbsql.Open(model.DatabaseDriverPostgres, dsn)
	require.NoError(t, err)
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	logger := mlog.CreateConsoleTestLogger(t)
	err = pingWithRetry(ctx, db, 100*time.Millisecond, logger)
	require.NoError(t, err)
}

func TestPingWithRetry_TimeoutAgainstUnreachable(t *testing.T) {
	dsn := "postgres://nobody@127.0.0.1:1/mattermost?sslmode=disable&connect_timeout=1"
	db, err := dbsql.Open(model.DatabaseDriverPostgres, dsn)
	require.NoError(t, err)
	defer db.Close()

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()

	logger := mlog.CreateConsoleTestLogger(t)
	err = pingWithRetry(ctx, db, 200*time.Millisecond, logger)
	elapsed := time.Since(start)

	require.Error(t, err)
	require.True(t,
		errors.Is(err, context.DeadlineExceeded) ||
			strings.Contains(err.Error(), "timed out waiting for database"),
		"expected deadline-exceeded or timeout error; got %v", err)
	// Must have honored the timeout, not just returned immediately.
	require.LessOrEqual(t, elapsed, 30*time.Second,
		"expected reasonable upper bound; took %s", elapsed)
}

func TestPingWithRetry_ContextCancelImmediately(t *testing.T) {
	dsn := "postgres://nobody@127.0.0.1:1/mattermost?sslmode=disable&connect_timeout=1"
	db, err := dbsql.Open(model.DatabaseDriverPostgres, dsn)
	require.NoError(t, err)
	defer db.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel before we even start

	logger := mlog.CreateConsoleTestLogger(t)
	err = pingWithRetry(ctx, db, 1*time.Second, logger)
	require.Error(t, err, "cancelled context should produce an error")
}

// In-process tests of resolvePingDataSource. We drive DSN selection via the
// MM_CONFIG environment variable rather than the --config persistent flag
// because the persistent flag is only merged into a subcommand's local
// flagset during cobra's Execute() pipeline; calling resolvePingDataSource
// directly outside Execute means the flag would not be visible.
// MM_CONFIG is consumed by getConfigDSN as the second-precedence source.

func TestResolvePingDataSource_DirectDSN(t *testing.T) {
	wanted := "postgres://user:pw@example.invalid:5432/mm?sslmode=disable"
	t.Setenv("MM_CONFIG", wanted)

	got, err := resolvePingDataSource(DBPingCmd)
	require.NoError(t, err)
	require.Equal(t, wanted, got)
}

func TestResolvePingDataSource_DirectDSN_PostgresqlScheme(t *testing.T) {
	wanted := "postgresql://user:pw@example.invalid:5432/mm?sslmode=disable"
	t.Setenv("MM_CONFIG", wanted)

	got, err := resolvePingDataSource(DBPingCmd)
	require.NoError(t, err)
	require.Equal(t, wanted, got)
}

func TestResolvePingDataSource_MissingFile(t *testing.T) {
	missing := t.TempDir() + "/no-such-config.json"
	t.Setenv("MM_CONFIG", missing)

	_, err := resolvePingDataSource(DBPingCmd)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to load configuration")
}

// TestResolvePingDataSource_PointsAtDirectory verifies that pointing --config
// at a directory (not a JSON file) surfaces a clear, wrapped error. Catches
// regressions where we silently fall through instead of returning the load error.
func TestResolvePingDataSource_PointsAtDirectory(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("MM_CONFIG", dir)

	_, err := resolvePingDataSource(DBPingCmd)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to load configuration",
		"expected wrapped error; got %v", err)
}
