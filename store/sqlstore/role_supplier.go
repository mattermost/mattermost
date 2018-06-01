// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/gorp"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type Role struct {
	Id            string
	Name          string
	DisplayName   string
	Description   string
	CreateAt      int64
	UpdateAt      int64
	DeleteAt      int64
	Permissions   string
	SchemeManaged bool
	BuiltIn       bool
}

func NewRoleFromModel(role *model.Role) *Role {
	permissionsMap := make(map[string]bool)
	permissions := ""

	for _, permission := range role.Permissions {
		if !permissionsMap[permission] {
			permissions += fmt.Sprintf(" %v", permission)
			permissionsMap[permission] = true
		}
	}

	return &Role{
		Id:            role.Id,
		Name:          role.Name,
		DisplayName:   role.DisplayName,
		Description:   role.Description,
		CreateAt:      role.CreateAt,
		UpdateAt:      role.UpdateAt,
		DeleteAt:      role.DeleteAt,
		Permissions:   permissions,
		SchemeManaged: role.SchemeManaged,
		BuiltIn:       role.BuiltIn,
	}
}

func (role Role) ToModel() *model.Role {
	return &model.Role{
		Id:            role.Id,
		Name:          role.Name,
		DisplayName:   role.DisplayName,
		Description:   role.Description,
		CreateAt:      role.CreateAt,
		UpdateAt:      role.UpdateAt,
		DeleteAt:      role.DeleteAt,
		Permissions:   strings.Fields(role.Permissions),
		SchemeManaged: role.SchemeManaged,
		BuiltIn:       role.BuiltIn,
	}
}

func initSqlSupplierRoles(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(Role{}, "Roles").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Name").SetMaxSize(64).SetUnique(true)
		table.ColMap("DisplayName").SetMaxSize(128)
		table.ColMap("Description").SetMaxSize(1024)
		table.ColMap("Permissions").SetMaxSize(4096)
	}
}

func (s *SqlSupplier) RoleSave(ctx context.Context, role *model.Role, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	// Check the role is valid before proceeding.
	if !role.IsValidWithoutId() {
		result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.invalid_role.app_error", nil, "", http.StatusBadRequest)
		return result
	}

	if len(role.Id) == 0 {
		if transaction, err := s.GetMaster().Begin(); err != nil {
			result.Err = model.NewAppError("SqlRoleStore.RoleSave", "store.sql_role.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			return result
		} else {
			result = s.createRole(ctx, role, transaction, hints...)

			if result.Err != nil {
				transaction.Rollback()
			} else if err := transaction.Commit(); err != nil {
				result.Err = model.NewAppError("SqlRoleStore.RoleSave", "store.sql_role.save_role.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	} else {
		dbRole := NewRoleFromModel(role)

		dbRole.UpdateAt = model.GetMillis()
		if rowsChanged, err := s.GetMaster().Update(dbRole); err != nil {
			result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.update.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if rowsChanged != 1 {
			result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.update.app_error", nil, "no record to update", http.StatusInternalServerError)
		}

		result.Data = dbRole.ToModel()
	}

	return result
}

func (s *SqlSupplier) createRole(ctx context.Context, role *model.Role, transaction *gorp.Transaction, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	// Check the role is valid before proceeding.
	if !role.IsValidWithoutId() {
		result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.invalid_role.app_error", nil, "", http.StatusBadRequest)
		return result
	}

	dbRole := NewRoleFromModel(role)

	dbRole.Id = model.NewId()
	dbRole.CreateAt = model.GetMillis()
	dbRole.UpdateAt = dbRole.CreateAt

	if err := transaction.Insert(dbRole); err != nil {
		result.Err = model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.insert.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result.Data = dbRole.ToModel()

	return result
}

func (s *SqlSupplier) RoleGet(ctx context.Context, roleId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var dbRole Role

	if err := s.GetReplica().SelectOne(&dbRole, "SELECT * from Roles WHERE Id = :Id", map[string]interface{}{"Id": roleId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlRoleStore.Get", "store.sql_role.get.app_error", nil, "Id="+roleId+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlRoleStore.Get", "store.sql_role.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	result.Data = dbRole.ToModel()

	return result
}

func (s *SqlSupplier) RoleGetByName(ctx context.Context, name string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var dbRole Role

	if err := s.GetReplica().SelectOne(&dbRole, "SELECT * from Roles WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlRoleStore.GetByName", "store.sql_role.get_by_name.app_error", nil, "name="+name+",err="+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlRoleStore.GetByName", "store.sql_role.get_by_name.app_error", nil, "name="+name+",err="+err.Error(), http.StatusInternalServerError)
		}
	}

	result.Data = dbRole.ToModel()

	return result
}

func (s *SqlSupplier) RoleGetByNames(ctx context.Context, names []string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var dbRoles []*Role

	if len(names) == 0 {
		result.Data = []*model.Role{}
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

	var roles []*model.Role
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToModel())
	}

	result.Data = roles

	return result
}

func (s *SqlSupplier) RoleDelete(ctx context.Context, roleId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	// Get the role.
	var role *Role
	if err := s.GetReplica().SelectOne(&role, "SELECT * from Roles WHERE Id = :Id", map[string]interface{}{"Id": roleId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlRoleStore.Delete", "store.sql_role.get.app_error", nil, "Id="+roleId+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlRoleStore.Delete", "store.sql_role.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return result
	}

	time := model.GetMillis()
	role.DeleteAt = time
	role.UpdateAt = time

	if rowsChanged, err := s.GetMaster().Update(role); err != nil {
		result.Err = model.NewAppError("SqlRoleStore.Delete", "store.sql_role.delete.update.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rowsChanged != 1 {
		result.Err = model.NewAppError("SqlRoleStore.Delete", "store.sql_role.delete.update.app_error", nil, "no record to update", http.StatusInternalServerError)
	} else {
		result.Data = role.ToModel()
	}

	return result
}

func (s *SqlSupplier) RolePermanentDeleteAll(ctx context.Context, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if _, err := s.GetMaster().Exec("DELETE FROM Roles"); err != nil {
		result.Err = model.NewAppError("SqlRoleStore.PermanentDeleteAll", "store.sql_role.permanent_delete_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return result
}
