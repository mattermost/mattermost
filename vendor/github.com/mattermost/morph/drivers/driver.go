package drivers

import (
	"github.com/mattermost/morph/models"
)

type Config struct {
	MigrationsTable string
	// StatementTimeoutInSecs is used to set a timeout for each migration file.
	// Set below zero to disable timeout. Zero value will result in default value, which is 60 seconds.
	StatementTimeoutInSecs int
	MigrationMaxSize       int
}

type Driver interface {
	Ping() error
	// Close closes the underlying db connection. If the driver is created via Open() function
	// this method will also going to call Close() on the sql.db instance.
	Close() error
	Apply(migration *models.Migration, saveVersion bool) error
	AppliedMigrations() ([]*models.Migration, error)
	SetConfig(key string, value interface{}) error
}
