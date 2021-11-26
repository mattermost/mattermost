// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"github.com/blang/semver"
	"github.com/pkg/errors"
)

func (sqlStore *SQLStore) Migrate(originalSchemaVersion semver.Version) error {
	currentSchemaVersion := originalSchemaVersion
	for _, migration := range migrations {
		if !currentSchemaVersion.EQ(migration.fromVersion) {
			continue
		}

		if err := sqlStore.migrate(migration); err != nil {
			return err
		}

		currentSchemaVersion = migration.toVersion
	}

	return nil
}

func (sqlStore *SQLStore) migrate(migration Migration) (err error) {
	tx, err := sqlStore.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer sqlStore.finalizeTransaction(tx)

	if err := migration.migrationFunc(tx, sqlStore); err != nil {
		return errors.Wrapf(err, "error executing migration from version %s to version %s", migration.fromVersion.String(), migration.toVersion.String())
	}

	if err := sqlStore.SetCurrentVersion(tx, migration.toVersion); err != nil {
		return errors.Wrapf(err, "failed to set the current version to %s", migration.toVersion.String())
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit transaction")
	}
	return nil
}

// RunMigrations will run the migrations (if any). The caller should hold a cluster mutex if there
// is a danger of this being run on multiple servers at once.
func (sqlStore *SQLStore) RunMigrations() error {
	currentSchemaVersion, err := sqlStore.GetCurrentVersion()
	if err != nil {
		return errors.Wrapf(err, "failed to get the current schema version")
	}

	if currentSchemaVersion.LT(LatestVersion()) {
		if err := sqlStore.Migrate(currentSchemaVersion); err != nil {
			return errors.Wrapf(err, "failed to complete migrations")
		}
	}

	return nil
}
