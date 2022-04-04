package mysql

import (
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/mattermost/morph/drivers"
)

func ExtractMysqlDSNParams(conn string) (map[string]string, error) {
	cfg, err := mysqlDriver.ParseDSN(conn)
	if err != nil {
		return nil, err
	}

	return cfg.Params, nil
}

func extractDatabaseNameFromURL(conn string) (string, error) {
	cfg, err := mysqlDriver.ParseDSN(conn)
	if err != nil {
		return "", err
	}

	return cfg.DBName, nil
}

func getDefaultConfig() *Config {
	return &Config{
		Config: drivers.Config{
			MigrationsTable:        "db_migrations",
			StatementTimeoutInSecs: 60,
			MigrationMaxSize:       defaultMigrationMaxSize,
		},
	}
}
