package sqlstore

import (
	"errors"
	"os"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/mysql"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	bindata "github.com/golang-migrate/migrate/v4/source/go_bindata"

	"github.com/mattermost/mattermost-server/v5/model"
	mysqlmigrations "github.com/mattermost/mattermost-server/v5/store/sqlstore/migrations/mysql"
	pgmigrations "github.com/mattermost/mattermost-server/v5/store/sqlstore/migrations/postgres"
)

// Migrate executes the database migrations from you current database state up to the last version.
func (ss *SqlSupplier) Migrate() error {
	var bresource *bindata.AssetSource
	var driver database.Driver
	var err error

	if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		driver, err = mysql.WithInstance(ss.GetMaster().Db, &mysql.Config{})
		if err != nil {
			return err
		}
		bresource = bindata.Resource(mysqlmigrations.AssetNames(), mysqlmigrations.Asset)
	}

	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		driver, err = postgres.WithInstance(ss.GetMaster().Db, &postgres.Config{})
		if err != nil {
			return err
		}
		bresource = bindata.Resource(pgmigrations.AssetNames(), pgmigrations.Asset)
	}

	d, err := bindata.WithInstance(bresource)
	if err != nil {
		return err
	}

	m, err := migrate.NewWithInstance("go-bindata", d, ss.DriverName(), driver)
	if err != nil {
		return err
	}

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	return nil
}
