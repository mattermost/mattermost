// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

// SqlLicenseStore encapsulates the database writes and reads for
// model.LicenseRecord objects.
type SqlLicenseStore struct {
	*SqlStore
}

func newSqlLicenseStore(sqlStore *SqlStore) store.LicenseStore {
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
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "license_tosql")
	}
	var storedLicense model.LicenseRecord
	if err := ls.GetReplicaX().Get(&storedLicense, queryString, args...); err != nil {
		// Only insert if not exists
		insertLicense, insertArgs, err := ls.getQueryBuilder().Insert("Licenses").Columns("Id", "CreateAt", "Bytes").Values(license).ToSql()
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get licenseId=%s", license.Id)
		}
		if _, err = ls.GetMasterX().NamedExec(insertLicense, insertArgs); err != nil {
			return nil, errors.Wrapf(err, "failed to get License with licenseId=%s", license.Id)
		}
		return license, nil
	}
	return &storedLicense, nil
}

// Get obtains the license with the provided id parameter from the database.
// If the license doesn't exist it returns a model.AppError with
// http.StatusNotFound in the StatusCode field.
func (ls SqlLicenseStore) Get(id string) (*model.LicenseRecord, error) {
	var storedLicense model.LicenseRecord
	queryString, args, err := ls.getQueryBuilder().
		Select("Id", "CreateAt", "Bytes").
		From("Licenses").
		Where(sq.Eq{"Id": id}).ToSql()

	if err != nil {
		return nil, errors.Wrapf(err, "license_tosql with licenseId=%s", id)
	}

	if err := ls.GetReplicaX().Get(&storedLicense, queryString, args...); err != nil {
		return nil, store.NewErrNotFound("License", id)
	}

	return &storedLicense, nil
}

func (ls SqlLicenseStore) GetAll() ([]*model.LicenseRecord, error) {
	queryString, args, err := ls.getQueryBuilder().
		Select("*").
		From("Licenses").ToSql()

	if err != nil {
		return nil, errors.Wrap(err, "license_tosql")
	}

	var licenses []*model.LicenseRecord
	if err := ls.GetReplicaX().Select(&licenses, queryString, args); err != nil {
		return nil, errors.Wrap(err, "failed to fetch licenses")
	}

	return licenses, nil
}
