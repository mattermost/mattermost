package sqlstore

import (
	"github.com/blang/semver"
	"github.com/pkg/errors"
)

const systemDatabaseVersionKey = "DatabaseVersion"

func LatestVersion() semver.Version {
	return migrations[len(migrations)-1].toVersion
}

func (sqlStore *SQLStore) GetCurrentVersion() (semver.Version, error) {
	currentVersionStr, err := sqlStore.getSystemValue(sqlStore.db, systemDatabaseVersionKey)

	if currentVersionStr == "" {
		return semver.Version{}, nil
	}

	if err != nil {
		return semver.Version{}, errors.Wrapf(err, "failed retrieving the DatabaseVersion key from the IR_System table")
	}

	currentSchemaVersion, err := semver.Parse(currentVersionStr)
	if err != nil {
		return semver.Version{}, errors.Wrapf(err, "unable to parse current schema version")
	}

	return currentSchemaVersion, nil
}

func (sqlStore *SQLStore) SetCurrentVersion(e queryExecer, currentVersion semver.Version) error {
	return sqlStore.setSystemValue(e, systemDatabaseVersionKey, currentVersion.String())
}
