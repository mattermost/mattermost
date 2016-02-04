// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlLicenseStore struct {
	*SqlStore
}

func NewSqlLicenseStore(sqlStore *SqlStore) LicenseStore {
	ls := &SqlLicenseStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.LicenseRecord{}, "Licenses").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Bytes").SetMaxSize(10000)
	}

	return ls
}

func (ls SqlLicenseStore) UpgradeSchemaIfNeeded() {
}

func (ls SqlLicenseStore) CreateIndexesIfNotExists() {
}

func (ls SqlLicenseStore) Save(license *model.LicenseRecord) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		license.PreSave()
		if result.Err = license.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		// Only insert if not exists
		if err := ls.GetReplica().SelectOne(&model.LicenseRecord{}, "SELECT * FROM Licenses WHERE Id = :Id", map[string]interface{}{"Id": license.Id}); err != nil {
			if err := ls.GetMaster().Insert(license); err != nil {
				result.Err = model.NewLocAppError("SqlLicenseStore.Save", "store.sql_license.save.app_error", nil, "license_id="+license.Id+", "+err.Error())
			} else {
				result.Data = license
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (ls SqlLicenseStore) Get(id string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := ls.GetReplica().Get(model.LicenseRecord{}, id); err != nil {
			result.Err = model.NewLocAppError("SqlLicenseStore.Get", "store.sql_license.get.app_error", nil, "license_id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewLocAppError("SqlLicenseStore.Get", "store.sql_license.get.missing.app_error", nil, "license_id="+id)
		} else {
			result.Data = obj.(*model.LicenseRecord)
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}
