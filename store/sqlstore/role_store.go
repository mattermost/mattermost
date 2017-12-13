// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlRoleStore struct {
	SqlStore
}

func NewSqlRoleStore(sqlStore SqlStore) store.RoleStore {
	s := &SqlRoleStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Role{}, "Roles").SetKeys(true, "Id")
		table.ColMap("Name").SetMaxSize(64).SetUnique(true)
		table.ColMap("DisplayName").SetMaxSize(128)
		table.ColMap("Description").SetMaxSize(1024)
		table.ColMap("Permissions").SetMaxSize(4096)
	}

	return s
}

func (s SqlRoleStore) CreateIndexesIfNotExists() {

}

func (s SqlRoleStore) Save(role *model.Role) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if role.Id > 0 {
			if _, err := s.GetMaster().Update(role); err != nil {
				result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.update.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		} else {
			if err := s.GetMaster().Insert(role); err != nil {
				result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.insert.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		result.Data = role
	})
}

func (s SqlRoleStore) Get(roleId int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var role model.Role

		if err := s.GetReplica().SelectOne(&role, "SELECT * from Roles WHERE Id = :Id", map[string]interface{}{"Id": roleId}); err != nil {
			result.Err = model.NewAppError("SqlRoleStore.Get", "store.sql_role.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = &role
	})
}

func (s SqlRoleStore) GetByName(name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var role model.Role

		if err := s.GetReplica().SelectOne(&role, "SELECT * from Roles WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewAppError("SqlRoleStore.GetByName", "store.sql_role.get_by_name.app_error", nil, "name="+name+",err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = &role
	})
}

func (s SqlRoleStore) GetByNames(names []string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var roles []*model.Role

		var searchPlaceholders []string
		var parameters = map[string]interface{}{}
		for i, value := range names {
			searchPlaceholders = append(searchPlaceholders, fmt.Sprintf(":Name%d", i))
			parameters[fmt.Sprintf("Name%d", i)] = value
		}

		searchTerm := "Name IN (" + strings.Join(searchPlaceholders, ", ") + ")"

		if _, err := s.GetReplica().Select(&roles, "SELECT * from Roles WHERE "+searchTerm, parameters); err != nil {
			result.Err = model.NewAppError("SqlRoleStore.GetByNames", "store.sql_role.get_by_names.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = &roles
	})
}
