// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
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
	return &SqlLicenseStore{sqlStore}
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
		Select("Id, CreateAt, Bytes").
		From("Licenses").
		Where(sq.Eq{"Id": license.Id})
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "license_tosql")
	}
	var storedLicense model.LicenseRecord
	if err := ls.GetReplicaX().Get(&storedLicense, queryString, args...); err != nil {
		// Only insert if not exists
		query, args, err := ls.getQueryBuilder().
			Insert("Licenses").
			Columns("Id", "CreateAt", "Bytes").
			Values(license.Id, license.CreateAt, license.Bytes).
			ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "license_record_tosql")
		}
		if _, err := ls.GetMasterX().Exec(query, args...); err != nil {
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
	query := ls.getQueryBuilder().
		Select("Id, CreateAt, Bytes").
		From("Licenses").
		Where(sq.Eq{"Id": id})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "license_record_tosql")
	}

	license := &model.LicenseRecord{}
	if err := ls.GetReplicaX().Get(license, queryString, args...); err != nil {
		return nil, store.NewErrNotFound("License", id)
	}
	return license, nil
}

func (ls SqlLicenseStore) GetAll() ([]*model.LicenseRecord, error) {
	query := ls.getQueryBuilder().
		Select("Id, CreateAt, Bytes").
		From("Licenses")

	queryString, _, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "license_tosql")
	}

	licenses := []*model.LicenseRecord{}
	if err := ls.GetReplicaX().Select(&licenses, queryString); err != nil {
		return nil, errors.Wrap(err, "failed to fetch licenses")
	}

	return licenses, nil
}
