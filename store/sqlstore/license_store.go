// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/pkg/errors"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

// SqlLicenseStore encapsulates the database writes and reads for
// model.LicenseRecord objects.
type SqlLicenseStore struct {
	SqlStore
}

func newSqlLicenseStore(sqlStore SqlStore) store.LicenseStore {
	ls := &SqlLicenseStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.LicenseRecord{}, "Licenses").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Bytes").SetMaxSize(10000)
	}

	return ls
}

func (ls SqlLicenseStore) createIndexesIfNotExists() {
}

// Save validates and stores the license instance in the database. The Id
// and Bytes fields are mandatory. The Bytes field is limited to a maximum
// of 10000 bytes. If the license ID matches an existing license in the
// database it returns the license stored in the database. If not, it saves the
// new database and returns the created license with the CreateAt field
// updated.
func (ls SqlLicenseStore) Save(license *model.LicenseRecord) (*model.LicenseRecord, error) {
	license.PreSave()
	if err := license.IsValid(); err != nil {
		return nil, err
	}

	query := ls.getQueryBuilder().
		Select("*").
		From("Licenses").
		Where(sq.Eq{"Id": license.Id})
	var storedLicense model.LicenseRecord
	if err := ls.GetReplicaX().GetFromQuery(&storedLicense, query); err != nil {
		// Only insert if not exists
		insertQuery := ls.getQueryBuilder().
			Insert("Licenses").
			Columns("Id", "CreateAt", "Bytes").
			Values(license.Id, license.CreateAt, license.Bytes)
		if _, err := ls.GetMasterX().ExecFromQuery(insertQuery); err != nil {
			return nil, errors.Wrapf(err, "failed to save License with licenseId=%s", license.Id)
		}
		return license, nil
	}
	return &storedLicense, nil
}

// Get obtains the license with the provided id parameter from the database.
// If the license doesn't exist it returns a model.AppError with
// http.StatusNotFound in the StatusCode field.
func (ls SqlLicenseStore) Get(id string) (*model.LicenseRecord, error) {
	query := ls.getQueryBuilder().Select("*").From("Licenses").Where(sq.Eq{"Id": id})
	var obj model.LicenseRecord
	if err := ls.GetReplicaX().GetFromQuery(&obj, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("License", id)
		}
		return nil, errors.Wrapf(err, "failed to get License with licenseId=%s", id)
	}
	return &obj, nil
}
