// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"fmt"
	"os"

	"github.com/mattermost/mattermost-server/model"
)

const (
	defaultMysqlHostname    = "dockerhost"
	defaultMysqlPort        = "3307"
	defaultPostgresHostname = "dockerhost"
	defaultPostgresPort     = "5433"
	defaultUsername         = "mmuser"
	defaultPassword         = "mostest"
	defaultName             = "mattermost_unittest"
)

func getEnv(name, defaultValue string) string {
	if value := os.Getenv(name); value != "" {
		return value
	} else {
		return defaultValue
	}
}

// MySQLSettings returns the database settings to connect to the MySQL unittesting database.
func MySQLSettings() *model.SqlSettings {
	hostname := getEnv("TEST_DATABASE_MYSQL_HOSTNAME", defaultMysqlHostname)
	port := getEnv("TEST_DATABASE_MYSQL_PORT", defaultMysqlPort)
	username := getEnv("TEST_DATABASE_USERNAME", defaultUsername)
	password := getEnv("TEST_DATABASE_PASSWORD", defaultPassword)
	name := getEnv("TEST_DATABASE_NAME", defaultName)

	return databaseSettings(
		"mysql",
		fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4,utf8", username, password, hostname, port, name),
	)
}

// PostgresSQLSettings returns the database settings to connect to the PostgreSQL unittesting database.
func PostgreSQLSettings() *model.SqlSettings {
	hostname := getEnv("TEST_DATABASE_POSTGRES_HOSTNAME", defaultPostgresHostname)
	port := getEnv("TEST_DATABASE_POSTGRES_PORT", defaultPostgresPort)
	username := getEnv("TEST_DATABASE_USERNAME", defaultUsername)
	password := getEnv("TEST_DATABASE_PASSWORD", defaultPassword)
	name := getEnv("TEST_DATABASE_NAME", defaultName)

	return databaseSettings(
		"postgres",
		fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", username, password, hostname, port, name),
	)
}

func databaseSettings(driver, dataSource string) *model.SqlSettings {
	settings := &model.SqlSettings{
		DriverName:                  &driver,
		DataSource:                  &dataSource,
		DataSourceReplicas:          []string{},
		DataSourceSearchReplicas:    []string{},
		MaxIdleConns:                new(int),
		ConnMaxLifetimeMilliseconds: new(int),
		MaxOpenConns:                new(int),
		Trace:                       false,
		AtRestEncryptKey:            model.NewRandomString(32),
		QueryTimeout:                new(int),
	}
	*settings.MaxIdleConns = 10
	*settings.ConnMaxLifetimeMilliseconds = 3600000
	*settings.MaxOpenConns = 100
	*settings.QueryTimeout = 10

	return settings
}
