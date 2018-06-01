// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlSystemStore struct {
	SqlStore
}

func NewSqlSystemStore(sqlStore SqlStore) store.SystemStore {
	s := &SqlSystemStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.System{}, "Systems").SetKeys(false, "Name")
		table.ColMap("Name").SetMaxSize(64)
		table.ColMap("Value").SetMaxSize(1024)
	}

	return s
}

func (s SqlSystemStore) CreateIndexesIfNotExists() {
}

func (s SqlSystemStore) Save(system *model.System) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if err := s.GetMaster().Insert(system); err != nil {
			result.Err = model.NewAppError("SqlSystemStore.Save", "store.sql_system.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlSystemStore) SaveOrUpdate(system *model.System) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if err := s.GetReplica().SelectOne(&model.System{}, "SELECT * FROM Systems WHERE Name = :Name", map[string]interface{}{"Name": system.Name}); err == nil {
			if _, err := s.GetMaster().Update(system); err != nil {
				result.Err = model.NewAppError("SqlSystemStore.SaveOrUpdate", "store.sql_system.update.app_error", nil, "", http.StatusInternalServerError)
			}
		} else {
			if err := s.GetMaster().Insert(system); err != nil {
				result.Err = model.NewAppError("SqlSystemStore.SaveOrUpdate", "store.sql_system.save.app_error", nil, "", http.StatusInternalServerError)
			}
		}
	})
}

func (s SqlSystemStore) Update(system *model.System) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Update(system); err != nil {
			result.Err = model.NewAppError("SqlSystemStore.Update", "store.sql_system.update.app_error", nil, "", http.StatusInternalServerError)
		}
	})
}

func (s SqlSystemStore) Get() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var systems []model.System
		props := make(model.StringMap)
		if _, err := s.GetReplica().Select(&systems, "SELECT * FROM Systems"); err != nil {
			result.Err = model.NewAppError("SqlSystemStore.Get", "store.sql_system.get.app_error", nil, "", http.StatusInternalServerError)
		} else {
			for _, prop := range systems {
				props[prop.Name] = prop.Value
			}

			result.Data = props
		}
	})
}

func (s SqlSystemStore) GetByName(name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var system model.System
		if err := s.GetReplica().SelectOne(&system, "SELECT * FROM Systems WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewAppError("SqlSystemStore.GetByName", "store.sql_system.get_by_name.app_error", nil, "", http.StatusInternalServerError)
		}

		result.Data = &system
	})
}

func (s SqlSystemStore) PermanentDeleteByName(name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var system model.System
		if _, err := s.GetMaster().Exec("DELETE FROM Systems WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewAppError("SqlSystemStore.PermanentDeleteByName", "store.sql_system.permanent_delete_by_name.app_error", nil, "", http.StatusInternalServerError)
		}

		result.Data = &system
	})
}
