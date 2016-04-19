// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlPasswordRecoveryStore struct {
	*SqlStore
}

func NewSqlPasswordRecoveryStore(sqlStore *SqlStore) PasswordRecoveryStore {
	s := &SqlPasswordRecoveryStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.PasswordRecovery{}, "PasswordRecovery").SetKeys(false, "UserId")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Code").SetMaxSize(128)
	}

	return s
}

func (s SqlPasswordRecoveryStore) UpgradeSchemaIfNeeded() {
}

func (s SqlPasswordRecoveryStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_password_recovery_code", "PasswordRecovery", "Code")
}

func (s SqlPasswordRecoveryStore) SaveOrUpdate(recovery *model.PasswordRecovery) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		recovery.PreSave()
		if result.Err = recovery.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetReplica().SelectOne(&model.PasswordRecovery{}, "SELECT * FROM PasswordRecovery WHERE UserId = :UserId", map[string]interface{}{"UserId": recovery.UserId}); err == nil {
			if _, err := s.GetMaster().Update(recovery); err != nil {
				result.Err = model.NewLocAppError("SqlPasswordRecoveryStore.SaveOrUpdate", "store.sql_recover.update.app_error", nil, "")
			}
		} else {
			if err := s.GetMaster().Insert(recovery); err != nil {
				result.Err = model.NewLocAppError("SqlPasswordRecoveryStore.SaveOrUpdate", "store.sql_recover.save.app_error", nil, "")
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPasswordRecoveryStore) Delete(userId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec("DELETE FROM PasswordRecovery WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlPasswordRecoveryStore.Delete", "store.sql_recover.delete.app_error", nil, "")
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPasswordRecoveryStore) Get(userId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		recovery := model.PasswordRecovery{}

		if err := s.GetReplica().SelectOne(&recovery, "SELECT * FROM PasswordRecovery WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlPasswordRecoveryStore.Get", "store.sql_recover.get.app_error", nil, "")
		}

		result.Data = &recovery

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPasswordRecoveryStore) GetByCode(code string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		recovery := model.PasswordRecovery{}

		if err := s.GetReplica().SelectOne(&recovery, "SELECT * FROM PasswordRecovery WHERE Code = :Code", map[string]interface{}{"Code": code}); err != nil {
			result.Err = model.NewLocAppError("SqlPasswordRecoveryStore.GetByCode", "store.sql_recover.get_by_code.app_error", nil, "")
		}

		result.Data = &recovery

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
