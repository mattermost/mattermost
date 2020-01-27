// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlRoleStore struct {
	SqlStore
}

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

func NewSqlRoleStore(sqlStore SqlStore) store.RoleStore {
	s := &SqlRoleStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(Role{}, "Roles").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Name").SetMaxSize(64).SetUnique(true)
		table.ColMap("DisplayName").SetMaxSize(128)
		table.ColMap("Description").SetMaxSize(1024)
		table.ColMap("Permissions").SetMaxSize(4096)
	}
	return s
}

func (s SqlRoleStore) CreateIndexesIfNotExists() {
}

func (s *SqlRoleStore) Save(role *model.Role) (*model.Role, *model.AppError) {
	// Check the role is valid before proceeding.
	if !role.IsValidWithoutId() {
		return nil, model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.invalid_role.app_error", nil, "", http.StatusBadRequest)
	}

	if len(role.Id) == 0 {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			return nil, model.NewAppError("SqlRoleStore.RoleSave", "store.sql_role.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		defer finalizeTransaction(transaction)
		createdRole, appErr := s.createRole(role, transaction)
		if appErr != nil {
			transaction.Rollback()
			return nil, appErr
		} else if err := transaction.Commit(); err != nil {
			return nil, model.NewAppError("SqlRoleStore.RoleSave", "store.sql_role.save_role.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return createdRole, nil
	}

	dbRole := NewRoleFromModel(role)
	dbRole.UpdateAt = model.GetMillis()
	if rowsChanged, err := s.GetMaster().Update(dbRole); err != nil {
		return nil, model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.update.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rowsChanged != 1 {
		return nil, model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.update.app_error", nil, "no record to update", http.StatusInternalServerError)
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) createRole(role *model.Role, transaction *gorp.Transaction) (*model.Role, *model.AppError) {
	// Check the role is valid before proceeding.
	if !role.IsValidWithoutId() {
		return nil, model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.invalid_role.app_error", nil, "", http.StatusBadRequest)
	}

	dbRole := NewRoleFromModel(role)

	dbRole.Id = model.NewId()
	dbRole.CreateAt = model.GetMillis()
	dbRole.UpdateAt = dbRole.CreateAt

	if err := transaction.Insert(dbRole); err != nil {
		return nil, model.NewAppError("SqlRoleStore.Save", "store.sql_role.save.insert.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) Get(roleId string) (*model.Role, *model.AppError) {
	var dbRole Role

	if err := s.GetReplica().SelectOne(&dbRole, "SELECT * from Roles WHERE Id = :Id", map[string]interface{}{"Id": roleId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlRoleStore.Get", "store.sql_role.get.app_error", nil, "Id="+roleId+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlRoleStore.Get", "store.sql_role.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) GetAll() ([]*model.Role, *model.AppError) {
	var dbRoles []Role

	if _, err := s.GetReplica().Select(&dbRoles, "SELECT * from Roles", map[string]interface{}{}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlRoleStore.GetAll", "store.sql_role.get_all.app_error", nil, err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlRoleStore.GetAll", "store.sql_role.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var roles []*model.Role
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToModel())
	}
	return roles, nil
}

func (s *SqlRoleStore) GetByName(name string) (*model.Role, *model.AppError) {
	var dbRole Role

	if err := s.GetReplica().SelectOne(&dbRole, "SELECT * from Roles WHERE Name = :Name", map[string]interface{}{"Name": name}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlRoleStore.GetByName", "store.sql_role.get_by_name.app_error", nil, "name="+name+",err="+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlRoleStore.GetByName", "store.sql_role.get_by_name.app_error", nil, "name="+name+",err="+err.Error(), http.StatusInternalServerError)
	}

	return dbRole.ToModel(), nil
}

func (s *SqlRoleStore) GetByNames(names []string) ([]*model.Role, *model.AppError) {
	var dbRoles []*Role

	if len(names) == 0 {
		return []*model.Role{}, nil
	}

	var searchPlaceholders []string
	var parameters = map[string]interface{}{}
	for i, value := range names {
		searchPlaceholders = append(searchPlaceholders, fmt.Sprintf(":Name%d", i))
		parameters[fmt.Sprintf("Name%d", i)] = value
	}

	searchTerm := "Name IN (" + strings.Join(searchPlaceholders, ", ") + ")"

	if _, err := s.GetReplica().Select(&dbRoles, "SELECT * from Roles WHERE "+searchTerm, parameters); err != nil {
		return nil, model.NewAppError("SqlRoleStore.GetByNames", "store.sql_role.get_by_names.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var roles []*model.Role
	for _, dbRole := range dbRoles {
		roles = append(roles, dbRole.ToModel())
	}

	return roles, nil
}

func (s *SqlRoleStore) Delete(roleId string) (*model.Role, *model.AppError) {
	// Get the role.
	var role *Role
	if err := s.GetReplica().SelectOne(&role, "SELECT * from Roles WHERE Id = :Id", map[string]interface{}{"Id": roleId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlRoleStore.Delete", "store.sql_role.get.app_error", nil, "Id="+roleId+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlRoleStore.Delete", "store.sql_role.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	time := model.GetMillis()
	role.DeleteAt = time
	role.UpdateAt = time

	if rowsChanged, err := s.GetMaster().Update(role); err != nil {
		return nil, model.NewAppError("SqlRoleStore.Delete", "store.sql_role.delete.update.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rowsChanged != 1 {
		return nil, model.NewAppError("SqlRoleStore.Delete", "store.sql_role.delete.update.app_error", nil, "no record to update", http.StatusInternalServerError)
	}
	return role.ToModel(), nil
}

func (s *SqlRoleStore) PermanentDeleteAll() *model.AppError {
	if _, err := s.GetMaster().Exec("DELETE FROM Roles"); err != nil {
		return model.NewAppError("SqlRoleStore.PermanentDeleteAll", "store.sql_role.permanent_delete_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}
