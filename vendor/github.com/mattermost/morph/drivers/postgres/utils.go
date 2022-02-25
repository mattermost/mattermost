package postgres

import (
	"net/url"

	"github.com/mattermost/morph/drivers"
)

func extractDatabaseNameFromURL(URL string) (string, error) {
	uri, err := url.Parse(URL)
	if err != nil {
		return "", err
	}

	return uri.Path[1:], nil
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
