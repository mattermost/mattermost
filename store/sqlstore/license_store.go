// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlLicenseStore struct {
	SqlStore
}

func NewSqlLicenseStore(sqlStore SqlStore) store.LicenseStore {
	ls := &SqlLicenseStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.LicenseRecord{}, "Licenses").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Bytes").SetMaxSize(10000)
	}

	return ls
}

func (ls SqlLicenseStore) CreateIndexesIfNotExists() {
}

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
