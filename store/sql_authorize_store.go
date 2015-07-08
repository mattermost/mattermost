// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlAuthDataStore struct {
	*SqlStore
}

func NewSqlAuthDataStore(sqlStore *SqlStore) AuthDataStore {
	as := &SqlAuthDataStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.AuthData{}, "AuthData").SetKeys(false, "Code")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("ClientId").SetMaxSize(26)
		table.ColMap("Code").SetMaxSize(128)
		table.ColMap("RedirectUri").SetMaxSize(256)
		table.ColMap("State").SetMaxSize(128)
		table.ColMap("Scope").SetMaxSize(128)
	}

	return as
}

func (as SqlAuthDataStore) UpgradeSchemaIfNeeded() {
}

func (as SqlAuthDataStore) CreateIndexesIfNotExists() {
	as.CreateIndexIfNotExists("idx_client_id", "AuthData", "ClientId")
}

func (as SqlAuthDataStore) Save(authData *model.AuthData) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		authData.PreSave()
		if result.Err = authData.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := as.GetMaster().Insert(authData); err != nil {
			result.Err = model.NewAppError("SqlAuthDataStore.Save", "We couldn't save the authorization code.", err.Error())
		} else {
			result.Data = authData
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlAuthDataStore) Get(code string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := as.GetReplica().Get(model.AuthData{}, code); err != nil {
			result.Err = model.NewAppError("SqlAuthDataStore.Get", "We encounted an error finding the authorization code", err.Error())
		} else if obj == nil {
			result.Err = model.NewAppError("SqlAuthDataStore.Get", "We couldn't find the existing authorization code", "")
		} else {
			result.Data = obj.(*model.AuthData)
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}
