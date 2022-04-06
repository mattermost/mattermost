// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"bytes"
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"

	// Load the MySQL driver
	_ "github.com/go-sql-driver/mysql"
	// Load the Postgres driver
	_ "github.com/lib/pq"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/morph"

	"github.com/mattermost/morph/drivers"
	ms "github.com/mattermost/morph/drivers/mysql"
	ps "github.com/mattermost/morph/drivers/postgres"
	mbindata "github.com/mattermost/morph/sources/embedded"
)

//go:embed migrations
var assets embed.FS

// MaxWriteLength defines the maximum length accepted for write to the Configurations or
// ConfigurationFiles table.
//
// It is imposed by MySQL's default max_allowed_packet value of 4Mb.
const MaxWriteLength = 4 * 1024 * 1024

// We use the something different from the default migration table name of morph
const migrationsTableName = "db_config_migrations"

// The timeout value for each migration file to run.
const migrationsTimeoutInSeconds = 100000

// DatabaseStore is a config store backed by a database.
// Not to be used directly. Only to be used as a backing store for config.Store
type DatabaseStore struct {
	originalDsn    string
	driverName     string
	dataSourceName string
	db             *sqlx.DB
}

// NewDatabaseStore creates a new instance of a config store backed by the given database.
func NewDatabaseStore(dsn string) (ds *DatabaseStore, err error) {
	driverName, dataSourceName, err := parseDSN(dsn)
	if err != nil {
		return nil, errors.Wrap(err, "invalid DSN")
	}

	db, err := sqlx.Open(driverName, dataSourceName)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to connect to %s database", driverName)
	}
	// Set conservative connection configuration for configuration database.
	db.SetMaxIdleConns(0)
	db.SetMaxOpenConns(2)

	defer func() {
		if err != nil {
			db.Close()
		}
	}()

	ds = &DatabaseStore{
		driverName:     driverName,
		originalDsn:    dsn,
		dataSourceName: dataSourceName,
		db:             db,
	}
	if err = ds.initializeConfigurationsTable(); err != nil {
		err = errors.Wrap(err, "failed to initialize")
		return nil, err
	}

	return ds, nil
}

// initializeConfigurationsTable ensures the requisite tables in place to form the backing store.
//
// Uses MEDIUMTEXT on MySQL, and TEXT on sane databases.
func (ds *DatabaseStore) initializeConfigurationsTable() error {
	assetsList, err := assets.ReadDir(filepath.Join("migrations", ds.driverName))
	if err != nil {
		return err
	}

	assetNamesForDriver := make([]string, len(assetsList))
	for i, entry := range assetsList {
		assetNamesForDriver[i] = entry.Name()
	}

	src, err := mbindata.WithInstance(&mbindata.AssetSource{
		Names: assetNamesForDriver,
		AssetFunc: func(name string) ([]byte, error) {
			return assets.ReadFile(filepath.Join("migrations", ds.driverName, name))
		},
	})
	if err != nil {
		return err
	}

	cfg := drivers.Config{
		MigrationsTable:        migrationsTableName,
		StatementTimeoutInSecs: migrationsTimeoutInSeconds,
	}

	var driver drivers.Driver
	switch ds.driverName {
	case model.DatabaseDriverMysql:
		dataSource, rErr := resetReadTimeout(ds.dataSourceName)
		if rErr != nil {
			return fmt.Errorf("failed to reset read timeout from datasource: %w", rErr)
		}

		dataSource, err = appendMultipleStatementsFlag(dataSource)
		if err != nil {
			return err
		}

		var db *sqlx.DB
		db, err = sqlx.Open(ds.driverName, dataSource)
		if err != nil {
			return errors.Wrapf(err, "failed to connect to %s database", ds.driverName)
		}

		driver, err = ms.WithInstance(db.DB, &ms.Config{
			Config: cfg,
		})

		defer db.Close()
	case model.DatabaseDriverPostgres:
		driver, err = ps.WithInstance(ds.db.DB, &ps.Config{
			Config: cfg,
		})
	default:
		err = fmt.Errorf("unsupported database type %s for migration", ds.driverName)
	}
	if err != nil {
		return err
	}

	opts := []morph.EngineOption{
		morph.WithLock("mm-config-lock-key"),
	}
	engine, err := morph.New(context.Background(), driver, src, opts...)
	if err != nil {
		return err
	}
	defer engine.Close()

	return engine.ApplyAll()
}

// parseDSN splits up a connection string into a driver name and data source name.
//
// For example:
//	mysql://mmuser:mostest@localhost:5432/mattermost_test
// returns
//	driverName = mysql
//	dataSourceName = mmuser:mostest@localhost:5432/mattermost_test
//
// By contrast, a Postgres DSN is returned unmodified.
func parseDSN(dsn string) (string, string, error) {
	// Treat the DSN as the URL that it is.
	s := strings.SplitN(dsn, "://", 2)
	if len(s) != 2 {
		return "", "", errors.New("failed to parse DSN as URL")
	}

	scheme := s[0]
	switch scheme {
	case "mysql":
		// Strip off the mysql:// for the dsn with which to connect.
		dsn = s[1]

	case "postgres", "postgresql":
		// No changes required

	default:
		return "", "", errors.Errorf("unsupported scheme %s", scheme)
	}

	return scheme, dsn, nil
}

// Set replaces the current configuration in its entirety and updates the backing store.
func (ds *DatabaseStore) Set(newCfg *model.Config) error {
	return ds.persist(newCfg)
}

// maxLength identifies the maximum length of a configuration or configuration file
func (ds *DatabaseStore) checkLength(length int) error {
	if ds.db.DriverName() == "mysql" && length > MaxWriteLength {
		return errors.Errorf("value is too long: %d > %d bytes", length, MaxWriteLength)
	}

	return nil
}

// persist writes the configuration to the configured database.
func (ds *DatabaseStore) persist(cfg *model.Config) error {
	b, err := marshalConfig(cfg)
	if err != nil {
		return errors.Wrap(err, "failed to serialize")
	}

	id := model.NewId()
	value := string(b)
	createAt := model.GetMillis()

	err = ds.checkLength(len(value))
	if err != nil {
		return errors.Wrap(err, "marshalled configuration failed length check")
	}

	tx, err := ds.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "failed to begin transaction")
	}
	defer func() {
		// Rollback after Commit just returns sql.ErrTxDone.
		if err := tx.Rollback(); err != nil && err != sql.ErrTxDone {
			mlog.Error("Failed to rollback configuration transaction", mlog.Err(err))
		}
	}()

	params := map[string]interface{}{
		"id":        id,
		"value":     value,
		"create_at": createAt,
		"key":       "ConfigurationId",
	}

	// Skip the persist altogether if we're effectively writing the same configuration.
	var oldValue []byte
	row := ds.db.QueryRow("SELECT Value FROM Configurations WHERE Active")
	if err := row.Scan(&oldValue); err != nil && err != sql.ErrNoRows {
		return errors.Wrap(err, "failed to query active configuration")
	}
	if bytes.Equal(oldValue, b) {
		return nil
	}

	if _, err := tx.Exec("UPDATE Configurations SET Active = NULL WHERE Active"); err != nil {
		return errors.Wrap(err, "failed to deactivate current configuration")
	}

	if _, err := tx.NamedExec("INSERT INTO Configurations (Id, Value, CreateAt, Active) VALUES (:id, :value, :create_at, TRUE)", params); err != nil {
		return errors.Wrap(err, "failed to record new configuration")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit transaction")
	}

	return nil
}

// Load updates the current configuration from the backing store.
func (ds *DatabaseStore) Load() ([]byte, error) {
	var configurationData []byte

	row := ds.db.QueryRow("SELECT Value FROM Configurations WHERE Active")
	if err := row.Scan(&configurationData); err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to query active configuration")
	}

	// Initialize from the default config if no active configuration could be found.
	if len(configurationData) == 0 {
		configWithDB := model.Config{}
		configWithDB.SqlSettings.DriverName = model.NewString(ds.driverName)
		configWithDB.SqlSettings.DataSource = model.NewString(ds.dataSourceName)
		return json.Marshal(configWithDB)
	}

	return configurationData, nil
}

// GetFile fetches the contents of a previously persisted configuration file.
func (ds *DatabaseStore) GetFile(name string) ([]byte, error) {
	query, args, err := sqlx.Named("SELECT Data FROM ConfigurationFiles WHERE Name = :name", map[string]interface{}{
		"name": name,
	})
	if err != nil {
		return nil, err
	}

	var data []byte
	row := ds.db.QueryRowx(ds.db.Rebind(query), args...)
	if err = row.Scan(&data); err != nil {
		return nil, errors.Wrapf(err, "failed to scan data from row for %s", name)
	}

	return data, nil
}

// SetFile sets or replaces the contents of a configuration file.
func (ds *DatabaseStore) SetFile(name string, data []byte) error {
	err := ds.checkLength(len(data))
	if err != nil {
		return errors.Wrap(err, "file data failed length check")
	}
	params := map[string]interface{}{
		"name":      name,
		"data":      data,
		"create_at": model.GetMillis(),
		"update_at": model.GetMillis(),
	}

	result, err := ds.db.NamedExec("UPDATE ConfigurationFiles SET Data = :data, UpdateAt = :update_at WHERE Name = :name", params)
	if err != nil {
		return errors.Wrapf(err, "failed to update row for %s", name)
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "failed to count rows affected for %s", name)
	} else if count > 0 {
		return nil
	}

	_, err = ds.db.NamedExec("INSERT INTO ConfigurationFiles (Name, Data, CreateAt, UpdateAt) VALUES (:name, :data, :create_at, :update_at)", params)
	if err != nil {
		return errors.Wrapf(err, "failed to insert row for %s", name)
	}

	return nil
}

// HasFile returns true if the given file was previously persisted.
func (ds *DatabaseStore) HasFile(name string) (bool, error) {
	query, args, err := sqlx.Named("SELECT COUNT(*) FROM ConfigurationFiles WHERE Name = :name", map[string]interface{}{
		"name": name,
	})
	if err != nil {
		return false, err
	}

	var count int64
	row := ds.db.QueryRowx(ds.db.Rebind(query), args...)
	if err = row.Scan(&count); err != nil {
		return false, errors.Wrapf(err, "failed to scan count of rows for %s", name)
	}

	return count != 0, nil
}

// RemoveFile remoevs a previously persisted configuration file.
func (ds *DatabaseStore) RemoveFile(name string) error {
	_, err := ds.db.NamedExec("DELETE FROM ConfigurationFiles WHERE Name = :name", map[string]interface{}{
		"name": name,
	})
	if err != nil {
		return errors.Wrapf(err, "failed to remove row for %s", name)
	}

	return nil
}

// String returns the path to the database backing the config, masking the password.
func (ds *DatabaseStore) String() string {
	return stripPassword(ds.originalDsn, ds.driverName)
}

// Close cleans up resources associated with the store.
func (ds *DatabaseStore) Close() error {
	return ds.db.Close()
}
