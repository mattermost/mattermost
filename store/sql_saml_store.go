// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlSamlStore struct {
	*SqlStore
}

func NewSqlSamlStore(sqlStore *SqlStore) SamlStore {
	ss := &SqlSamlStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.SamlRecord{}, "Saml").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Bytes").SetMaxSize(10000)
	}

	return ss
}

func (ss SqlSamlStore) UpgradeSchemaIfNeeded() {
}

func (ss SqlSamlStore) CreateIndexesIfNotExists() {
}

func (ss SqlSamlStore) Save(saml *model.SamlRecord) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		saml.PreSave()
		if result.Err = saml.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		var oldRecord *model.SamlRecord

		// Insert or update depending if it exists or not
		if err := ss.GetReplica().SelectOne(&oldRecord, "SELECT * FROM Saml WHERE Type = :Type", map[string]interface{}{"Type": saml.Type}); err != nil {
			if err := ss.GetMaster().Insert(saml); err != nil {
				var certType string
				if saml.Type == model.SAML_IDP_CERTIFICATE {
					certType = "SAML IDP CERTIFICATE"
				} else {
					certType = "SAML PRIVATE KEY"
				}
				result.Err = model.NewLocAppError("SqlSamlStore.Save", "store.sql_saml.save.app_error", nil, "saml_type="+certType+", "+err.Error())
			} else {
				result.Data = saml
			}
		} else {
			saml.Id = oldRecord.Id
			if count, err := ss.GetMaster().Update(saml); err != nil {
				result.Err = model.NewLocAppError("SqlSamlStore.Save", "store.sql_saml.update_app.updating.app_error", nil, "app_id="+saml.Id+", "+err.Error())
			} else if count != 1 {
				result.Err = model.NewLocAppError("SqlSamlStore.Save", "store.sql_saml.update_app.update.app_error", nil, "app_id="+saml.Id)
			} else {
				result.Data = saml
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (ss SqlSamlStore) Get(certType int) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var samlRecord *model.SamlRecord
		var certTypeStr string
		if certType == model.SAML_IDP_CERTIFICATE {
			certTypeStr = "SAML IDP CERTIFICATE"
		} else {
			certTypeStr = "SAML PRIVATE KEY"
		}

		if err := ss.GetReplica().SelectOne(&samlRecord, "SELECT * FROM Saml WHERE Type = :Type", map[string]interface{}{"Type": certType}); err != nil {
			result.Err = model.NewLocAppError("SqlSamlStore.Get", "store.sql_saml.get.app_error", nil, "cert="+certTypeStr+", "+err.Error())
		} else {
			result.Data = samlRecord
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}
