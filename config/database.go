// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import (
	"bytes"
	"database/sql"
	"io"
	"io/ioutil"
	"net/url"
	"strings"
	"sync"

	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"

	// Load the MySQL driver
	_ "github.com/go-sql-driver/mysql"
	// Load the Postgres driver
	_ "github.com/lib/pq"
)

// DatabaseStore is a config store backed by a database.
type DatabaseStore struct {
	emitter

	config               *model.Config
	environmentOverrides map[string]interface{}
	configLock           sync.RWMutex
	originalDsn          string
	driverName           string
	dataSourceName       string
	db                   *sqlx.DB
}

// NewDatabaseStore creates a new instance of a config store backed by the given database.
func NewDatabaseStore(dsn string) (ds *DatabaseStore, err error) {
	driverName, dataSourceName, err := parseDSN(dsn)
	if err != nil {
		return nil, errors.Wrap(err, "invalid DSN")
	}

	// TODO: Retry logic?
	db, err := sqlx.Open(driverName, dataSourceName)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to connect to %s database", driverName)
	}

	ds = &DatabaseStore{
		driverName:     driverName,
		originalDsn:    dsn,
		dataSourceName: dataSourceName,
		db:             db,
	}
	if err = initializeConfigurationsTable(ds.db); err != nil {
		return nil, errors.Wrap(err, "failed to initialize")
	}

	if err = ds.Load(); err != nil {
		return nil, errors.Wrap(err, "failed to load")
	}

	return ds, nil
}

// parseDSN splits up a connection string into a driver name and data source name.
//
// For example:
//	mysql://mmuser:mostest@dockerhost:5432/mattermost_test
// returns
//	driverName = mysql
//	dataSourceName = mmuser:mostest@dockerhost:5432/mattermost_test
//
// By contrast, a Postgres DSN is returned unmodified.
func parseDSN(dsn string) (string, string, error) {
	// Treat the DSN as the URL that it is.
	u, err := url.Parse(dsn)
	if err != nil {
		return "", "", errors.Wrap(err, "failed to parse DSN as URL")
	}

	scheme := u.Scheme
	switch scheme {
	case "mysql":
		// Strip off the mysql:// for the dsn with which to connect.
		u.Scheme = ""
		dsn = strings.TrimPrefix(u.String(), "//")

	case "postgres":
		// No changes required

	default:
		return "", "", errors.Wrapf(err, "unsupported scheme %s", scheme)
	}

	return scheme, dsn, nil
}

// Get fetches the current, cached configuration.
func (ds *DatabaseStore) Get() *model.Config {
	ds.configLock.RLock()
	defer ds.configLock.RUnlock()

	return ds.config
}

// GetEnvironmentOverrides fetches the configuration fields overridden by environment variables.
func (ds *DatabaseStore) GetEnvironmentOverrides() map[string]interface{} {
	ds.configLock.RLock()
	defer ds.configLock.RUnlock()

	return ds.environmentOverrides
}

// Set replaces the current configuration in its entirety, without updating the backing store.
func (ds *DatabaseStore) Set(newCfg *model.Config) (*model.Config, error) {
	ds.configLock.Lock()
	var unlockOnce sync.Once
	defer unlockOnce.Do(ds.configLock.Unlock)

	oldCfg := ds.config

	// TODO: disallow attempting to save a directly modified config (comparing pointers). This
	// wouldn't be an exhaustive check, given the use of pointers throughout the data
	// structure, but might prevent common mistakes. Requires upstream changes first.
	// if newCfg == oldCfg {
	// 	return nil, errors.New("old configuration modified instead of cloning")
	// }

	newCfg = newCfg.Clone()
	newCfg.SetDefaults()

	// Sometimes the config is received with "fake" data in sensitive fields. Apply the real
	// data from the existing config as necessary.
	desanitize(oldCfg, newCfg)

	if err := newCfg.IsValid(); err != nil {
		return nil, errors.Wrap(err, "new configuration is invalid")
	}

	// Ideally, Set would persist automatically and abstract this completely away from the
	// client. Doing so requires a few upstream changes first, so for now an explicit Save()
	// remains required.
	// if err := ds.persist(newCfg); err != nil {
	// 	return nil, errors.Wrap(err, "failed to persist")
	// }

	ds.config = newCfg

	unlockOnce.Do(ds.configLock.Unlock)

	// Notify listeners synchronously. Ideally, this would be asynchronous, but existing code
	// assumes this and there would be increased complexity to avoid racing updates.
	ds.invokeConfigListeners(oldCfg, newCfg)

	return oldCfg, nil
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

// initializeConfigurationsTable ensures the requisite tables in place to form the backing store.
func initializeConfigurationsTable(db *sqlx.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS Configurations (
		    Id VARCHAR(26) PRIMARY KEY,
		    Value TEXT NOT NULL,
		    CreateAt BIGINT NOT NULL,
		    Active BOOLEAN NULL UNIQUE
		)
	`)
	if err != nil {
		return errors.Wrap(err, "failed to create Configurations table")
	}

	return nil
}

// Load updates the current configuration from the backing store.
func (ds *DatabaseStore) Load() (err error) {
	var f io.ReadCloser
	var needsSave bool
	var configurationData []byte

	row := ds.db.QueryRow("SELECT Value FROM Configurations WHERE Active")
	if err = row.Scan(&configurationData); err != nil && err != sql.ErrNoRows {
		return errors.Wrap(err, "failed to query active configuration")
	}

	// Initialize from the default config if no active configuration could be found.
	if len(configurationData) == 0 {
		needsSave = true

		defaultCfg := model.Config{}
		defaultCfg.SetDefaults()

		// Assume the database storing the config is also to be used for the application.
		// This can be overridden using environment variables on first start if necessary,
		// or changed from the system console afterwards.
		*defaultCfg.SqlSettings.DriverName = ds.driverName
		*defaultCfg.SqlSettings.DataSource = ds.dataSourceName

		configurationData, err = marshalConfig(&defaultCfg)
		if err != nil {
			return errors.Wrap(err, "failed to serialize default config")
		}
	}

	allowEnvironmentOverrides := true
	f = ioutil.NopCloser(bytes.NewReader(configurationData))
	loadedCfg, environmentOverrides, err := unmarshalConfig(f, allowEnvironmentOverrides)
	if err != nil {
		return errors.Wrapf(err, "failed to unmarshal config")
	}

	// SetDefaults generates various keys and salts if not previously configured. Determine if
	// such a change will be made before invoking. This method will not effect the save: that
	// remains the responsibility of the caller.
	needsSave = needsSave || loadedCfg.SqlSettings.AtRestEncryptKey == nil || len(*loadedCfg.SqlSettings.AtRestEncryptKey) == 0
	needsSave = needsSave || loadedCfg.FileSettings.PublicLinkSalt == nil || len(*loadedCfg.FileSettings.PublicLinkSalt) == 0
	needsSave = needsSave || loadedCfg.EmailSettings.InviteSalt == nil || len(*loadedCfg.EmailSettings.InviteSalt) == 0

	loadedCfg.SetDefaults()

	if err := loadedCfg.IsValid(); err != nil {
		return errors.Wrap(err, "invalid config")
	}

	if changed := fixConfig(loadedCfg); changed {
		needsSave = true
	}

	ds.configLock.Lock()
	var unlockOnce sync.Once
	defer unlockOnce.Do(ds.configLock.Unlock)

	if needsSave {
		if err = ds.persist(loadedCfg); err != nil {
			return errors.Wrap(err, "failed to persist required changes after load")
		}
	}

	oldCfg := ds.config
	ds.config = loadedCfg
	ds.environmentOverrides = environmentOverrides

	unlockOnce.Do(ds.configLock.Unlock)

	// Notify listeners synchronously. Ideally, this would be asynchronous, but existing code
	// assumes this and there would be increased complexity to avoid racing updates.
	ds.invokeConfigListeners(oldCfg, loadedCfg)

	return nil
}

// Save writes the current configuration to the backing store.
func (ds *DatabaseStore) Save() error {
	ds.configLock.RLock()
	defer ds.configLock.RUnlock()

	return ds.persist(ds.config)
}

// String returns the path to the database backing the config, masking the password.
func (ds *DatabaseStore) String() string {
	u, _ := url.Parse(ds.originalDsn)

	// Strip out the password to avoid leaking in logs.
	u.User = url.User(u.User.Username())

	return u.String()
}

// Close cleans up resources associated with the store.
func (ds *DatabaseStore) Close() error {
	return ds.db.Close()
}
