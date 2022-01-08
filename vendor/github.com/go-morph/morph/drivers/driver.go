package drivers

import (
	"github.com/go-morph/morph/models"
)

type Driver interface {
	Ping() error
	// Close closes the underlying db connection. If the driver is created via Open() function
	// this method will also going to call Close() on the sql.db instance.
	Close() error
	Lock() error
	Unlock() error
	Apply(migration *models.Migration, saveVersion bool) error
	AppliedMigrations() ([]*models.Migration, error)
	SetConfig(key string, value interface{}) error
}
