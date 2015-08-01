// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"strings"
)

type SqlAccessDataStore struct {
	*SqlStore
}

func NewSqlAccessDataStore(sqlStore *SqlStore) AccessDataStore {
	as := &SqlAccessDataStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.AccessData{}, "AccessData").SetKeys(false, "Token")
		table.ColMap("AuthCode").SetMaxSize(128)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Token").SetMaxSize(128)
		table.ColMap("RefreshToken").SetMaxSize(128)
		table.ColMap("RedirectUri").SetMaxSize(256)
		table.ColMap("Scope").SetMaxSize(128)
	}

	return as
}

func (as SqlAccessDataStore) UpgradeSchemaIfNeeded() {
}

func (as SqlAccessDataStore) CreateIndexesIfNotExists() {
	as.CreateIndexIfNotExists("idx_auth_code", "AccessData", "AuthCode")
}

func (as SqlAccessDataStore) Save(accessData *model.AccessData) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		accessData.PreSave(utils.Cfg.ServiceSettings.TokenSalt)
		if result.Err = accessData.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := as.GetMaster().Insert(accessData); err != nil {
			result.Err = model.NewAppError("SqlAccessDataStore.Save", "We couldn't save the access token.", err.Error())
		} else {
			result.Data = accessData
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlAccessDataStore) Get(token string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		encryptedToken := model.Md5Encrypt(utils.Cfg.ServiceSettings.TokenSalt, token)

		accessData := model.AccessData{}

		if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM AccessData WHERE Token= ? OR Token = ?", token, encryptedToken); err != nil {
			result.Err = model.NewAppError("SqlAccessDataStore.Get", "We encounted an error finding the access token", err.Error())
		} else {
			result.Data = &accessData
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (as SqlAccessDataStore) GetByAuthCode(authCode string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		accessData := model.AccessData{}

		if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM AccessData WHERE AuthCode=?", authCode); err != nil {
			if strings.Contains(err.Error(), "no rows") {
				result.Data = nil
			} else {
				result.Err = model.NewAppError("SqlAccessDataStore.GetByAuthCode", "We encountered an error finding the access token", err.Error())
			}
		} else {
			result.Data = &accessData
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (as SqlAccessDataStore) Remove(token string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		encryptedToken := model.Md5Encrypt(utils.Cfg.ServiceSettings.TokenSalt, token)

		if _, err := as.GetMaster().Exec("DELETE FROM AccessData WHERE Token = ? OR Token = ?", token, encryptedToken); err != nil {
			result.Err = model.NewAppError("SqlAccessDataStore.Remove", "We couldn't remove the access token", "err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
