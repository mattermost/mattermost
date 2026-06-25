// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"io"
	"log"
	"path"

	"github.com/mattermost/mattermost/server/v8/channels/db"
	"github.com/mattermost/morph"
	ps "github.com/mattermost/morph/drivers/postgres"
	mbindata "github.com/mattermost/morph/sources/embedded"
)

// userPostDeliveryMigrationsDir is the embed-relative directory holding the
// migrations applied to the post-delivery-tracking database.
const userPostDeliveryMigrationsDir = "postgres_user_post_delivery"

// initUserPostDeliveryMorph builds a morph engine for the post-delivery-tracking
// schema. It is bound to the delivery pool, which is either a dedicated second DB
// or — on the fallback path — the primary DB. A distinct migration-version table
// and advisory lock keep this independent schema from contending with the main
// migration set, so it can safely coexist on the primary DB during fallback.
func (ss *SqlStore) initUserPostDeliveryMorph(enableLogging bool) (*morph.Morph, error) {
	assets := db.Assets()

	assetsList, err := assets.ReadDir(path.Join("migrations", userPostDeliveryMigrationsDir))
	if err != nil {
		return nil, err
	}

	assetNamesForDriver := make([]string, len(assetsList))
	for i, entry := range assetsList {
		assetNamesForDriver[i] = entry.Name()
	}

	src, err := mbindata.WithInstance(&mbindata.AssetSource{
		Names: assetNamesForDriver,
		AssetFunc: func(name string) ([]byte, error) {
			return assets.ReadFile(path.Join("migrations", userPostDeliveryMigrationsDir, name))
		},
	})
	if err != nil {
		return nil, err
	}

	driver, err := ps.WithInstance(ss.userPostDeliveryX.DB().DB)
	if err != nil {
		return nil, err
	}

	var logWriter io.Writer
	if enableLogging {
		logWriter = &morphWriter{}
	} else {
		logWriter = io.Discard
	}

	opts := []morph.EngineOption{
		morph.WithLogger(log.New(logWriter, "", log.Lshortfile)),
		// Independent schema: its own advisory lock and version table so it does
		// not collide with the main DB's migrations when running on the primary
		// pool (fallback) or contend with them on a shared cluster.
		morph.WithLock("mm-user-post-delivery-lock-key"),
		morph.SetMigrationTableName("db_migrations_user_post_delivery"),
		morph.SetStatementTimeoutInSeconds(*ss.settings.MigrationsStatementTimeoutSeconds),
		morph.SetDryRun(false),
	}

	return morph.New(context.Background(), driver, src, opts...)
}

func (ss *SqlStore) migrateUserPostDelivery(direction migrationDirection, enableMorphLogging bool) error {
	engine, err := ss.initUserPostDeliveryMorph(enableMorphLogging)
	if err != nil {
		return err
	}
	defer engine.Close()

	switch direction {
	case migrationsDirectionDown:
		_, err = engine.ApplyDown(-1)
		return err
	default:
		return engine.ApplyAll()
	}
}
