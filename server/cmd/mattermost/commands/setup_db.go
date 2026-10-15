// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"

	// Postgres driver for the setup connection. The server is postgres-only.
	_ "github.com/lib/pq"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/db"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/config"
)

const (
	setupDBTimeout = 30 * time.Second
	// activeConfigQuery reads the active row. It does not insert or update.
	activeConfigQuery    = "SELECT value FROM configurations WHERE active"
	peersQuery           = "SELECT hostname, gossipport, port FROM clusterdiscovery WHERE type = $1 AND clustername = $2 AND lastpingat >= $3"
	privilegeProbeTable  = "db_check"
	privilegeProbeCreate = "CREATE TABLE db_check (id integer)"
	privilegeProbeDrop   = "DROP TABLE db_check"
)

type dbInspection struct {
	version          int
	encoding         string
	hasMigrations    bool
	schemaVersion    int
	probedCreate     bool
	probeDropWarning string
}

func openPostgres(dsn string) (*sql.DB, error) {
	handle, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, redactError(err, dsn)
	}
	handle.SetMaxOpenConns(2)
	handle.SetMaxIdleConns(0)
	handle.SetConnMaxLifetime(time.Minute)
	return handle, nil
}

func redactError(err error, dsn string) error {
	if err == nil {
		return nil
	}
	return errors.New(redactDSN(err, dsn))
}

func redactDSN(err error, dsn string) string {
	msg := err.Error()
	if dsn != "" {
		if sanitized, sErr := model.SanitizeDataSource(model.DatabaseDriverPostgres, dsn); sErr == nil {
			msg = strings.ReplaceAll(msg, dsn, sanitized)
		}
	}
	parsed, pErr := url.Parse(dsn)
	if pErr == nil && parsed.User != nil {
		if password, ok := parsed.User.Password(); ok && password != "" {
			msg = strings.ReplaceAll(msg, password, "****")
		}
	}
	return msg
}

func inspectDatabase(dsn string) (dbInspection, error) {
	handle, err := openPostgres(dsn)
	if err != nil {
		return dbInspection{}, err
	}
	defer handle.Close()

	ctx, cancel := context.WithTimeout(context.Background(), setupDBTimeout)
	defer cancel()

	if err := handle.PingContext(ctx); err != nil {
		return dbInspection{}, errors.Errorf("database is not reachable: %s", redactDSN(err, dsn))
	}

	var versionText, encoding string
	if err := handle.QueryRowContext(ctx, "SHOW server_version_num").Scan(&versionText); err != nil {
		return dbInspection{}, errors.Errorf("cannot read PostgreSQL version: %s", redactDSN(err, dsn))
	}
	version, err := strconv.Atoi(strings.TrimSpace(versionText))
	if err != nil {
		return dbInspection{}, errors.Wrap(err, "cannot parse PostgreSQL version")
	}
	if err := handle.QueryRowContext(ctx, "SHOW server_encoding").Scan(&encoding); err != nil {
		return dbInspection{}, errors.Errorf("cannot read database encoding: %s", redactDSN(err, dsn))
	}

	hasMigrations, err := setupTableExists(ctx, handle, "db_migrations")
	if err != nil {
		return dbInspection{}, redactError(err, dsn)
	}
	info := dbInspection{
		version:       version,
		encoding:      strings.TrimSpace(encoding),
		hasMigrations: hasMigrations,
	}
	if hasMigrations {
		var max sql.NullInt64
		if err := handle.QueryRowContext(ctx, "SELECT MAX(version) FROM db_migrations").Scan(&max); err != nil {
			return dbInspection{}, errors.Errorf("cannot read db_migrations: %s", redactDSN(err, dsn))
		}
		if max.Valid {
			info.schemaVersion = int(max.Int64)
		}
		return info, nil
	}

	warning, err := probeCreateTable(ctx, handle)
	if err != nil {
		return dbInspection{}, errors.Errorf("cannot create a table in the current schema: %s", redactDSN(err, dsn))
	}
	info.probedCreate = true
	info.probeDropWarning = warning
	return info, nil
}

func probeCreateTable(ctx context.Context, handle *sql.DB) (string, error) {
	if _, err := handle.ExecContext(ctx, privilegeProbeCreate); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return "", errors.Errorf("table %s already exists. Drop it and run setup again", privilegeProbeTable)
		}
		return "", err
	}
	if _, err := handle.ExecContext(context.Background(), privilegeProbeDrop); err != nil {
		return fmt.Sprintf("Could not delete table %s. Drop it before starting Mattermost.", privilegeProbeTable), nil
	}
	return "", nil
}

func setupTableExists(ctx context.Context, handle *sql.DB, table string) (bool, error) {
	var exists bool
	err := handle.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE LOWER(table_name) = $1
			AND table_schema = current_schema()
		)`, strings.ToLower(table)).Scan(&exists)
	return exists, err
}

func readActiveConfig(dsn string) (*model.Config, bool, error) {
	handle, err := openPostgres(dsn)
	if err != nil {
		return nil, false, err
	}
	defer handle.Close()

	ctx, cancel := context.WithTimeout(context.Background(), setupDBTimeout)
	defer cancel()

	exists, err := setupTableExists(ctx, handle, "configurations")
	if err != nil {
		return nil, false, redactError(err, dsn)
	}
	if !exists {
		return nil, false, nil
	}

	var value string
	err = handle.QueryRowContext(ctx, activeConfigQuery).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, redactError(err, dsn)
	}
	cfg := model.ConfigFromJSON(strings.NewReader(value))
	if cfg == nil {
		return nil, false, errors.New("active configuration row is not valid JSON")
	}
	cfg.SetDefaults()
	return cfg, true, nil
}

func listClusterPeers(dsn, clusterName string, sinceMillis int64) ([]clusterPeer, error) {
	handle, err := openPostgres(dsn)
	if err != nil {
		return nil, err
	}
	defer handle.Close()

	ctx, cancel := context.WithTimeout(context.Background(), setupDBTimeout)
	defer cancel()

	exists, err := setupTableExists(ctx, handle, "clusterdiscovery")
	if err != nil {
		return nil, redactError(err, dsn)
	}
	if !exists {
		return nil, nil
	}

	rows, err := handle.QueryContext(ctx, peersQuery, model.CDSTypeApp, clusterName, sinceMillis)
	if err != nil {
		return nil, redactError(err, dsn)
	}
	defer rows.Close()

	var peers []clusterPeer
	for rows.Next() {
		var peer clusterPeer
		if err := rows.Scan(&peer.Hostname, &peer.GossipPort, &peer.Port); err != nil {
			return nil, redactError(err, dsn)
		}
		peers = append(peers, peer)
	}
	if err := rows.Err(); err != nil {
		return nil, redactError(err, dsn)
	}
	return peers, nil
}

func readConfigFile(path string) (*model.Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	cfg := model.ConfigFromJSON(strings.NewReader(string(data)))
	if cfg == nil {
		return nil, errors.Errorf("could not parse configuration file %s", path)
	}
	cfg.SetDefaults()
	return cfg, nil
}

func seedDatabase(dsn, migrateFrom, siteURL string, newInstallPaths bool, paths statePaths) error {
	if migrateFrom != "" {
		if err := config.Migrate(migrateFrom, dsn); err != nil {
			return redactError(err, dsn)
		}
	}
	store, err := config.NewStoreFromDSN(dsn, false, nil, true)
	if err != nil {
		return redactError(err, dsn)
	}
	defer store.Close()

	cfg := store.Get().Clone()
	cfg.SqlSettings.DriverName = model.NewPointer(model.DatabaseDriverPostgres)
	cfg.SqlSettings.DataSource = model.NewPointer(dsn)
	if siteURL != "" {
		cfg.ServiceSettings.SiteURL = model.NewPointer(siteURL)
	}
	if newInstallPaths {
		applyNewInstallPaths(cfg, paths)
	}
	if _, _, err := store.Set(cfg); err != nil {
		return redactError(err, dsn)
	}
	return nil
}

func updateStoredDataSource(dsn string) error {
	store, err := config.NewStoreFromDSN(dsn, false, nil, false)
	if err != nil {
		return redactError(err, dsn)
	}
	defer store.Close()

	cfg := store.Get().Clone()
	cfg.SqlSettings.DataSource = model.NewPointer(dsn)
	if _, _, err := store.Set(cfg); err != nil {
		return redactError(err, dsn)
	}
	return nil
}

func initSchema(dsn string) error {
	logger := mlog.CreateConsoleLogger()
	defer func() { _ = logger.Shutdown() }()

	settings := model.SqlSettings{}
	settings.SetDefaults(false)
	settings.DriverName = model.NewPointer(model.DatabaseDriverPostgres)
	settings.DataSource = model.NewPointer(dsn)

	store, err := sqlstore.New(settings, logger, nil, sqlstore.DisableMorphLogging())
	if err != nil {
		return redactError(err, dsn)
	}
	store.Close()
	return nil
}

func binaryLatestMigration() (int, error) {
	entries, err := db.Assets().ReadDir("migrations/postgres")
	if err != nil {
		return 0, err
	}
	latest := 0
	found := false
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		prefix, _, ok := strings.Cut(name, "_")
		if !ok {
			continue
		}
		n, convErr := strconv.Atoi(prefix)
		if convErr != nil {
			continue
		}
		found = true
		if n > latest {
			latest = n
		}
	}
	if !found {
		return 0, errors.New("no postgres migrations are embedded in this binary")
	}
	return latest, nil
}

func writeFileConfig(path, dsn, siteURL string, uid, gid int, paths statePaths) error {
	cfg := &model.Config{}
	cfg.SetDefaults()
	applyNewInstallPaths(cfg, paths)
	cfg.SqlSettings.DriverName = model.NewPointer(model.DatabaseDriverPostgres)
	cfg.SqlSettings.DataSource = model.NewPointer(dsn)
	if siteURL != "" {
		cfg.ServiceSettings.SiteURL = model.NewPointer(siteURL)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	store, err := config.NewStoreFromDSN(path, false, nil, true)
	if err != nil {
		return err
	}
	defer store.Close()
	if _, _, err := store.Set(cfg); err != nil {
		return err
	}
	if err := os.Chmod(path, 0600); err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		if err := os.Chown(path, uid, gid); err != nil {
			return err
		}
	}
	return nil
}
