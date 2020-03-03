// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"net/http"

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
func (ls SqlLicenseStore) Save(license *model.LicenseRecord) (*model.LicenseRecord, *model.AppError) {
	license.PreSave()
	if err := license.IsValid(); err != nil {
		return nil, err
	}

	var storedLicense model.LicenseRecord
	if err := ls.GetReplica().SelectOne(&storedLicense, "SELECT * FROM Licenses WHERE Id = :Id", map[string]interface{}{"Id": license.Id}); err != nil {
		// Only insert if not exists
		if err := ls.GetMaster().Insert(license); err != nil {
			return nil, model.NewAppError("SqlLicenseStore.Save", "store.sql_license.save.app_error", nil, "license_id="+license.Id+", "+err.Error(), http.StatusInternalServerError)
		}
		return license, nil
	}
	return &storedLicense, nil
}

// Get obtains the license with the provided id parameter from the database.
// If the license doesn't exist it returns a model.AppError with
// http.StatusNotFound in the StatusCode field.
func (ls SqlLicenseStore) Get(id string) (*model.LicenseRecord, *model.AppError) {
	obj, err := ls.GetReplica().Get(model.LicenseRecord{}, id)
	if err != nil {
		return nil, model.NewAppError("SqlLicenseStore.Get", "store.sql_license.get.app_error", nil, "license_id="+id+", "+err.Error(), http.StatusInternalServerError)
	}
	if obj == nil {
		return nil, model.NewAppError("SqlLicenseStore.Get", "store.sql_license.get.missing.app_error", nil, "license_id="+id, http.StatusNotFound)
	}
	return obj.(*model.LicenseRecord), nil
}
