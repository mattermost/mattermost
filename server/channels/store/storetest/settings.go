// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path"
	"strings"

	_ "github.com/lib/pq"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	defaultPostgresqlDSN = "postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10"
)

func getDefaultPostgresqlDSN() string {
	if os.Getenv("IS_CI") == "true" {
		return strings.ReplaceAll(defaultPostgresqlDSN, "localhost", "postgres")
	}
	return defaultPostgresqlDSN
}

// PostgresSQLSettings returns the database settings to connect to the PostgreSQL unittesting database.
// The database name is generated randomly and must be created before use.
func PostgreSQLSettings() *model.SqlSettings {
	dsn := os.Getenv("TEST_DATABASE_POSTGRESQL_DSN")
	if dsn == "" {
		dsn = getDefaultPostgresqlDSN()
	} else {
		mlog.Info("Using TEST_DATABASE_POSTGRESQL_DSN override", mlog.String("dsn", dsn))
	}

	dsnURL, err := url.Parse(dsn)
	if err != nil {
		panic("failed to parse dsn " + dsn + ": " + err.Error())
	}

	// Generate a random database name
	dsnURL.Path = "db" + model.NewId()

	return databaseSettings("postgres", dsnURL.String())
}

func postgreSQLRootDSN(dsn string) string {
	dsnURL, err := url.Parse(dsn)
	if err != nil {
		panic("failed to parse dsn " + dsn + ": " + err.Error())
	}

	// // Assume the unittesting database has the same password.
	// password := ""
	// if dsnUrl.User != nil {
	// 	password, _ = dsnUrl.User.Password()
	// }

	// dsnUrl.User = url.UserPassword("", password)
	dsnURL.Path = "postgres"

	return dsnURL.String()
}

func postgreSQLDSNDatabase(dsn string) string {
	dsnURL, err := url.Parse(dsn)
	if err != nil {
		panic("failed to parse dsn " + dsn + ": " + err.Error())
	}

	return path.Base(dsnURL.Path)
}

func databaseSettings(driver, dataSource string) *model.SqlSettings {
	settings := &model.SqlSettings{
		DriverName:                        &driver,
		DataSource:                        &dataSource,
		DataSourceReplicas:                []string{},
		DataSourceSearchReplicas:          []string{},
		MaxIdleConns:                      new(int),
		ConnMaxLifetimeMilliseconds:       new(int),
		ConnMaxIdleTimeMilliseconds:       new(int),
		MaxOpenConns:                      new(int),
		Trace:                             model.NewPointer(false),
		AtRestEncryptKey:                  model.NewPointer(model.NewRandomString(32)),
		QueryTimeout:                      new(int),
		MigrationsStatementTimeoutSeconds: new(int),
	}
	*settings.MaxIdleConns = 10
	*settings.ConnMaxLifetimeMilliseconds = 3600000
	*settings.ConnMaxIdleTimeMilliseconds = 300000
	*settings.MaxOpenConns = 100
	*settings.QueryTimeout = 60
	*settings.MigrationsStatementTimeoutSeconds = 60

	return settings
}

// execAsRoot executes the given sql as root against the testing database
func execAsRoot(settings *model.SqlSettings, sqlCommand string) error {
	var dsn string
	driver := *settings.DriverName

	switch driver {
	case model.DatabaseDriverPostgres:
		dsn = postgreSQLRootDSN(*settings.DataSource)
	default:
		return fmt.Errorf("unsupported driver %s", driver)
	}

	db, err := sql.Open(driver, dsn)
	if err != nil {
		return errors.Wrapf(err, "failed to connect to %s database as root", driver)
	}
	defer db.Close()
	if _, err = db.Exec(sqlCommand); err != nil {
		return errors.Wrapf(err, "failed to execute `%s` against %s database as root", sqlCommand, driver)
	}

	return nil
}

// MakeSqlSettings creates a randomly named database and returns the corresponding sql settings
func MakeSqlSettings(driver string) *model.SqlSettings {
	var settings *model.SqlSettings
	var dbName string

	switch driver {
	case model.DatabaseDriverPostgres:
		settings = PostgreSQLSettings()
		dbName = postgreSQLDSNDatabase(*settings.DataSource)
	default:
		panic("unsupported driver " + driver)
	}

	if err := execAsRoot(settings, "CREATE DATABASE "+dbName); err != nil {
		panic("failed to create temporary database " + dbName + ": " + err.Error())
	}

	switch driver {
	case model.DatabaseDriverPostgres:
		if err := execAsRoot(settings, "GRANT ALL PRIVILEGES ON DATABASE \""+dbName+"\" TO mmuser"); err != nil {
			panic("failed to grant mmuser permission to " + dbName + ":" + err.Error())
		}
	default:
		panic("unsupported driver " + driver)
	}

	settings.ReplicaMonitorIntervalSeconds = model.NewPointer(5)

	return settings
}

func CleanupSqlSettings(settings *model.SqlSettings) {
	driver := *settings.DriverName
	var dbName string

	switch driver {
	case model.DatabaseDriverPostgres:
		dbName = postgreSQLDSNDatabase(*settings.DataSource)
	default:
		panic("unsupported driver " + driver)
	}

	if err := execAsRoot(settings, "DROP DATABASE "+dbName); err != nil {
		panic("failed to drop temporary database " + dbName + ": " + err.Error())
	}
}
