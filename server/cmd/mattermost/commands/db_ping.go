// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	dbsql "database/sql"
	stdErrors "errors"
	"net/url"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/config"
)

const (
	dbPingDefaultTimeout       = 5 * time.Minute
	dbPingDefaultRetryInterval = 2 * time.Second
	// dbPingAttemptTimeout caps a single PingContext call so a hung connection
	// doesn't block the whole timeout budget on one attempt.
	dbPingAttemptTimeout = 10 * time.Second
)

var DBPingCmd = &cobra.Command{
	Use:   "ping",
	Short: "Wait for the database to become reachable",
	Long: `Pings the configured Mattermost database, retrying until --timeout expires.
Exits 0 once the database accepts a ping. Exits non-zero on timeout or fatal error.

Intended for use as a readiness probe (e.g. a Kubernetes init container).
Resolves the DSN exactly like 'mattermost db migrate' / 'mattermost db init':
the --config flag, then MM_CONFIG, then config.json (which is then loaded as
a config store and SqlSettings.DataSource is used).`,
	Example: `  # Database DSN passed via --config (preferred for readiness probes)
  $ mattermost db ping --config postgres://mmuser:mostest@localhost/mattermost --timeout 2m

  # Or via MM_CONFIG
  $ MM_CONFIG=postgres://localhost/mattermost mattermost db ping`,
	Args: cobra.NoArgs,
	RunE: dbPingCmdF,
}

func init() {
	DBPingCmd.Flags().Duration("timeout", dbPingDefaultTimeout,
		"Maximum total time to wait for the DB to become reachable.")
	DBPingCmd.Flags().Duration("retry-interval", dbPingDefaultRetryInterval,
		"Sleep between ping attempts.")
	DbCmd.AddCommand(DBPingCmd)
}

func dbPingCmdF(command *cobra.Command, _ []string) error {
	logger := mlog.CreateConsoleLogger()
	defer func() {
		_ = logger.Shutdown()
	}()

	timeout, _ := command.Flags().GetDuration("timeout")
	retryInterval, _ := command.Flags().GetDuration("retry-interval")
	if timeout <= 0 {
		return errors.New("--timeout must be > 0")
	}
	if retryInterval <= 0 {
		return errors.New("--retry-interval must be > 0")
	}

	dsn, err := resolvePingDataSource(command)
	if err != nil {
		return err
	}

	sanitized, err := sanitizePingDataSource(dsn)
	if err != nil {
		return err
	}

	db, err := dbsql.Open(model.DatabaseDriverPostgres, dsn)
	if err != nil {
		return errors.Wrap(err, "failed to open SQL connection")
	}
	defer db.Close()

	// Minimal pool — this is a one-shot readiness probe.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	ctx, cancel := context.WithTimeout(command.Context(), timeout)
	defer cancel()

	return pingWithRetry(ctx, db, retryInterval, logger.With(
		mlog.String("dataSource", sanitized),
	))
}

func sanitizePingDataSource(dsn string) (string, error) {
	sanitized, err := model.SanitizeDataSource(model.DatabaseDriverPostgres, dsn)
	if err != nil {
		return "", safeDataSourceSanitizationError(err)
	}

	return sanitized, nil
}

func safeDataSourceSanitizationError(err error) error {
	var urlErr *url.Error
	if stdErrors.As(err, &urlErr) {
		if urlErr.Err != nil {
			return errors.Errorf("invalid database DSN: %v", urlErr.Err)
		}
		return errors.New("invalid database DSN")
	}

	return errors.New("invalid database DSN")
}

// resolvePingDataSource returns a postgres DSN to ping.
//
// If the configured DSN is a postgres:// / postgresql:// URL it is returned as-is
// (fast path: no config store load required). Otherwise it is treated as a file
// path: a config.Store is loaded read-only (createFileIfNotExist=false so the
// command never has a side effect of creating a config file) and
// SqlSettings.DataSource is returned.
func resolvePingDataSource(command *cobra.Command) (string, error) {
	cfgDSN := getConfigDSN(command, config.GetEnvironment())

	if config.IsDatabaseDSN(cfgDSN) {
		return cfgDSN, nil
	}

	cfgStore, err := config.NewStoreFromDSN(cfgDSN, true /*readOnly*/, nil /*customDefaults*/, false /*createFileIfNotExist*/)
	if err != nil {
		return "", errors.Wrapf(err, "failed to load configuration from %q", cfgDSN)
	}
	defer cfgStore.Close()

	sqlSettings := cfgStore.Get().SqlSettings
	if sqlSettings.DataSource == nil || *sqlSettings.DataSource == "" {
		return "", errors.New("no database DSN configured: set --config or MM_CONFIG to a postgres:// URL, or ensure SqlSettings.DataSource is set in your configuration")
	}
	if !config.IsDatabaseDSN(*sqlSettings.DataSource) {
		// Defensive: the loaded config has a non-postgres DataSource. Mattermost is postgres-only.
		return "", errors.New("configured SqlSettings.DataSource is not a postgres DSN")
	}
	return *sqlSettings.DataSource, nil
}

// pingWithRetry pings db every retryInterval until it succeeds or ctx is done.
// Each individual PingContext call is capped at dbPingAttemptTimeout so a hung
// network connection cannot consume the entire timeout budget on a single try.
func pingWithRetry(ctx context.Context, db *dbsql.DB, retryInterval time.Duration, logger mlog.LoggerIFace) error {
	attempt := 0
	for {
		attempt++
		attemptCtx, cancel := context.WithTimeout(ctx, dbPingAttemptTimeout)
		err := db.PingContext(attemptCtx)
		cancel()
		if err == nil {
			logger.Info("Database is reachable", mlog.Int("attempt", attempt))
			return nil
		}

		// Surface progress on every attempt so operators can see the probe is alive.
		// Intentionally omit the raw error: lib/pq error strings can echo DSN fragments.
		logger.Info("Waiting for database",
			mlog.Int("attempt", attempt),
			mlog.Duration("retry_interval", retryInterval),
			mlog.String("status", "ping_failed"),
		)

		// Wait retryInterval, but bail early if ctx is done.
		select {
		case <-ctx.Done():
			return errors.Wrapf(ctx.Err(), "timed out waiting for database after %d attempts", attempt)
		case <-time.After(retryInterval):
		}
	}
}
