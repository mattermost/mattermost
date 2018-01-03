// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"context"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"fmt"
)

type Role struct {
	Id            string
	Name          string
	DisplayName   string
	Description   string
	Permissions   string
	SchemeManaged bool
}

func FromRole(role *model.Role) *Role {
	return &Role{
		Id:            role.Id,
		Name:          role.Name,
		DisplayName:   role.DisplayName,
		Description:   role.Description,
		Permissions:   strings.Join(role.Permissions, " "),
		SchemeManaged: role.SchemeManaged,
	}
}

func (role Role) ToRole() *model.Role {
	return &model.Role{
		Id:            role.Id,
		Name:          role.Name,
		DisplayName:   role.DisplayName,
		Description:   role.Description,
		Permissions:   strings.Fields(role.Permissions),
		SchemeManaged: role.SchemeManaged,
	}
}

func initSqlSupplierRoles(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(Role{}, "Roles").SetKeys(false, "Id")
		table.ColMap("Name").SetMaxSize(64).SetUnique(true)
		table.ColMap("DisplayName").SetMaxSize(128)
		table.ColMap("Description").SetMaxSize(1024)
		table.ColMap("Permissions").SetMaxSize(4096)
	}
}

func (s *SqlSupplier) RoleSave(ctx context.Context, role *model.Role, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	dbRole := FromRole(role)
	if len(dbRole.Id) == 0 {
		dbRole.Id = model.NewId()
		if _, err := s.GetMaster().Update(dbRole); err != nil {
			result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.update.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	} else {
		if err := s.GetMaster().Insert(dbRole); err != nil {
			result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.insert.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	result.Data = dbRole.ToRole()

	return result
}

func (s *SqlSupplier) RoleGet(ctx context.Context, roleId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var dbRole Role

	if err := s.GetReplica().SelectOne(&dbRole, "SELECT * from Roles WHERE Id = :Id", map[string]interface{}{"Id": roleId}); err != nil {
		result.Err = model.NewAppError("SqlRoleStore.Get", "store.sql_role.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result.Data = dbRole.ToRole()

	return result
}

func (s *SqlSupplier) RoleGetByName(ctx context.Context, name string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var dbRole Role

	if err := s.GetReplica().SelectOne(&dbRole, "SELECT * from Roles WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
		result.Err = model.NewAppError("SqlRoleStore.GetByName", "store.sql_role.get_by_name.app_error", nil, "name="+name+",err="+err.Error(), http.StatusInternalServerError)
	}

	result.Data = dbRole.ToRole()

	return result
}

func (s *SqlSupplier) RoleGetByNames(ctx context.Context, names []string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var dbRoles []*Role

	if len(names) == 0 {
		result.Data = model.Roles{}
		return result
	}

	var searchPlaceholders []string
	var parameters = map[string]interface{}{}
	for i, value := range names {
		searchPlaceholders = append(searchPlaceholders, fmt.Sprintf(":Name%d", i))
		parameters[fmt.Sprintf("Name%d", i)] = value
	}

	searchTerm := "Name IN (" + strings.Join(searchPlaceholders, ", ") + ")"

	if _, err := s.GetReplica().Select(&dbRoles, "SELECT * from Roles WHERE "+searchTerm, parameters); err != nil {
		result.Err = model.NewAppError("SqlRoleStore.GetByNames", "store.sql_role.get_by_names.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var roles model.Roles
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToRole())
	}

	result.Data = roles

	return result
}
