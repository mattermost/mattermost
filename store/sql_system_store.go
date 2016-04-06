// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlSystemStore struct {
	*SqlStore
}

func NewSqlSystemStore(sqlStore *SqlStore) SystemStore {
	s := &SqlSystemStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.System{}, "Systems").SetKeys(false, "Name")
		table.ColMap("Name").SetMaxSize(64)
		table.ColMap("Value").SetMaxSize(1024)
	}

	return s
}

func (s SqlSystemStore) UpgradeSchemaIfNeeded() {
}

func (s SqlSystemStore) CreateIndexesIfNotExists() {
}

func (s SqlSystemStore) Save(system *model.System) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if err := s.GetMaster().Insert(system); err != nil {
			result.Err = model.NewLocAppError("SqlSystemStore.Save", "store.sql_system.save.app_error", nil, "")
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlSystemStore) SaveOrUpdate(system *model.System) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if err := s.GetReplica().SelectOne(&model.System{}, "SELECT * FROM Systems WHERE Name = :Name", map[string]interface{}{"Name": system.Name}); err == nil {
			if _, err := s.GetMaster().Update(system); err != nil {
				result.Err = model.NewLocAppError("SqlSystemStore.SaveOrUpdate", "store.sql_system.update.app_error", nil, "")
			}
		} else {
			if err := s.GetMaster().Insert(system); err != nil {
				result.Err = model.NewLocAppError("SqlSystemStore.SaveOrUpdate", "store.sql_system.save.app_error", nil, "")
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlSystemStore) Update(system *model.System) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Update(system); err != nil {
			result.Err = model.NewLocAppError("SqlSystemStore.Update", "store.sql_system.update.app_error", nil, "")
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlSystemStore) Get() StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var systems []model.System
		props := make(model.StringMap)
		if _, err := s.GetReplica().Select(&systems, "SELECT * FROM Systems"); err != nil {
			result.Err = model.NewLocAppError("SqlSystemStore.Get", "store.sql_system.get.app_error", nil, "")
		} else {
			for _, prop := range systems {
				props[prop.Name] = prop.Value
			}

			result.Data = props
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlSystemStore) GetByName(name string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var system model.System
		if err := s.GetReplica().SelectOne(&system, "SELECT * FROM Systems WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewLocAppError("SqlSystemStore.GetByName", "store.sql_system.get_by_name.app_error", nil, "")
		}

		result.Data = &system

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
