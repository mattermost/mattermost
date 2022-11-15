// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"fmt"
	"log"
	"path/filepath"

	"github.com/mattermost/mattermost-server/v6/db"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/morph"
	"github.com/mattermost/morph/drivers"
	ms "github.com/mattermost/morph/drivers/mysql"
	ps "github.com/mattermost/morph/drivers/postgres"
	"github.com/mattermost/morph/models"
	mbindata "github.com/mattermost/morph/sources/embedded"
)

func (ss *SqlStore) initMorph() (*morph.Morph, func() error, error) {
	assets := db.Assets()

	assetsList, err := assets.ReadDir(filepath.Join("migrations", ss.DriverName()))
	if err != nil {
		return nil, nil, err
	}

	assetNamesForDriver := make([]string, len(assetsList))
	for i, entry := range assetsList {
		assetNamesForDriver[i] = entry.Name()
	}

	src, err := mbindata.WithInstance(&mbindata.AssetSource{
		Names: assetNamesForDriver,
		AssetFunc: func(name string) ([]byte, error) {
			return assets.ReadFile(filepath.Join("migrations", ss.DriverName(), name))
		},
	})
	if err != nil {
		return nil, nil, err
	}

	var driver drivers.Driver
	switch ss.DriverName() {
	case model.DatabaseDriverMysql:
		dataSource, rErr := ResetReadTimeout(*ss.settings.DataSource)
		if rErr != nil {
			mlog.Fatal("Failed to reset read timeout from datasource.", mlog.Err(rErr), mlog.String("src", *ss.settings.DataSource))
			return nil, nil, rErr
		}
		dataSource, err = AppendMultipleStatementsFlag(dataSource)
		if err != nil {
			return nil, nil, err
		}
		db := setupConnection("master", dataSource, ss.settings)
		driver, err = ms.WithInstance(db)
		defer db.Close()
	case model.DatabaseDriverPostgres:
		driver, err = ps.WithInstance(ss.GetMasterX().DB.DB)
	default:
		err = fmt.Errorf("unsupported database type %s for migration", ss.DriverName())
	}
	if err != nil {
		return nil, nil, err
	}

	opts := []morph.EngineOption{
		morph.WithLogger(log.New(&morphWriter{}, "", log.Lshortfile)),
		morph.WithLock("mm-lock-key"),
		morph.SetStatementTimeoutInSeconds(*ss.settings.MigrationsStatementTimeoutSeconds),
	}
	engine, err := morph.New(context.Background(), driver, src, opts...)
	if err != nil {
		return nil, nil, err
	}

	return engine, engine.Close, nil
}

func (ss *SqlStore) migrate(direction migrationDirection) error {
	engine, close, err := ss.initMorph()
	if err != nil {
		return err
	}
	defer close()

	switch direction {
	case migrationsDirectionDown:
		_, err = engine.ApplyDown(-1)
		return err
	default:
		return engine.ApplyAll()
	}
}

// MigrateWithPlan migrates the database to the latest version using the provided plan.
func MigrateWithPlan(settings model.SqlSettings) error {
	ss := &SqlStore{
		rrCounter: 0,
		srCounter: 0,
		settings:  &settings,
	}
	defer ss.Close()

	ss.initConnection()

	ver, err := ss.GetDbVersion(true)
	if err != nil {
		mlog.Fatal("Error while getting DB version.", mlog.Err(err))
	}

	ok, err := ss.ensureMinimumDBVersion(ver)
	if !ok {
		mlog.Fatal("Error while checking DB version.", mlog.Err(err))
	}

	err = ss.ensureDatabaseCollation()
	if err != nil {
		mlog.Fatal("Error while checking DB collation.", mlog.Err(err))
	}

	engine, close, err := ss.initMorph()
	if err != nil {
		return err
	}
	defer close()

	diff, err := engine.Diff(models.Up)
	if err != nil {
		return err
	}

	plan, err := engine.GeneratePlan(diff)
	if err != nil {
		return err
	}

	return engine.ApplyPlan(plan)
}
