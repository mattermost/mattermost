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

type SqlSchemeStore struct {
	SqlStore
}

func NewSqlSchemeStore(sqlStore SqlStore) store.SchemeStore {
	s := &SqlSchemeStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Scheme{}, "Schemes").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Name").SetMaxSize(model.SCHEME_NAME_MAX_LENGTH).SetUnique(true)
		table.ColMap("DisplayName").SetMaxSize(model.SCHEME_DISPLAY_NAME_MAX_LENGTH)
		table.ColMap("Description").SetMaxSize(model.SCHEME_DESCRIPTION_MAX_LENGTH)
		table.ColMap("Scope").SetMaxSize(32)
		table.ColMap("DefaultTeamAdminRole").SetMaxSize(64)
		table.ColMap("DefaultTeamUserRole").SetMaxSize(64)
		table.ColMap("DefaultTeamGuestRole").SetMaxSize(64)
		table.ColMap("DefaultChannelAdminRole").SetMaxSize(64)
		table.ColMap("DefaultChannelUserRole").SetMaxSize(64)
		table.ColMap("DefaultChannelGuestRole").SetMaxSize(64)
	}

	return s
}

func (s SqlSchemeStore) CreateIndexesIfNotExists() {
}

func (s *SqlSchemeStore) Save(scheme *model.Scheme) (*model.Scheme, *model.AppError) {
	if len(scheme.Id) == 0 {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			return nil, model.NewAppError("SqlSchemeStore.SaveScheme", "store.sql_scheme.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		defer finalizeTransaction(transaction)

		newScheme, appErr := s.createScheme(scheme, transaction)
		if appErr != nil {
			return nil, appErr
		}
		if err := transaction.Commit(); err != nil {
			return nil, model.NewAppError("SqlSchemeStore.SchemeSave", "store.sql_scheme.save_scheme.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return newScheme, nil
	}

	if !scheme.IsValid() {
		return nil, model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.invalid_scheme.app_error", nil, "schemeId="+scheme.Id, http.StatusBadRequest)
	}

	scheme.UpdateAt = model.GetMillis()

	rowsChanged, err := s.GetMaster().Update(scheme)
	if err != nil {
		return nil, model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.update.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if rowsChanged != 1 {
		return nil, model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.update.app_error", nil, "no record to update", http.StatusInternalServerError)
	}

	return scheme, nil
}

func (s *SqlSchemeStore) createScheme(scheme *model.Scheme, transaction *gorp.Transaction) (*model.Scheme, *model.AppError) {
	// Fetch the default system scheme roles to populate default permissions.
	defaultRoleNames := []string{model.TEAM_ADMIN_ROLE_ID, model.TEAM_USER_ROLE_ID, model.TEAM_GUEST_ROLE_ID, model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID, model.CHANNEL_GUEST_ROLE_ID}
	defaultRoles := make(map[string]*model.Role)
	roles, err := s.SqlStore.Role().GetByNames(defaultRoleNames)
	if err != nil {
		return nil, err
	}

	for _, role := range roles {
		switch role.Name {
		case model.TEAM_ADMIN_ROLE_ID:
			defaultRoles[model.TEAM_ADMIN_ROLE_ID] = role
		case model.TEAM_USER_ROLE_ID:
			defaultRoles[model.TEAM_USER_ROLE_ID] = role
		case model.TEAM_GUEST_ROLE_ID:
			defaultRoles[model.TEAM_GUEST_ROLE_ID] = role
		case model.CHANNEL_ADMIN_ROLE_ID:
			defaultRoles[model.CHANNEL_ADMIN_ROLE_ID] = role
		case model.CHANNEL_USER_ROLE_ID:
			defaultRoles[model.CHANNEL_USER_ROLE_ID] = role
		case model.CHANNEL_GUEST_ROLE_ID:
			defaultRoles[model.CHANNEL_GUEST_ROLE_ID] = role
		}
	}

	if len(defaultRoles) != 6 {
		return nil, model.NewAppError("SqlSchemeStore.SaveScheme", "store.sql_scheme.save.retrieve_default_scheme_roles.app_error", nil, "", http.StatusInternalServerError)
	}

	// Create the appropriate default roles for the scheme.
	if scheme.Scope == model.SCHEME_SCOPE_TEAM {
		// Team Admin Role
		teamAdminRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Team Admin Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.TEAM_ADMIN_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		savedRole, err := s.SqlStore.Role().(*SqlRoleStore).createRole(teamAdminRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultTeamAdminRole = savedRole.Name

		// Team User Role
		teamUserRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Team User Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.TEAM_USER_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(teamUserRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultTeamUserRole = savedRole.Name

		// Team Guest Role
		teamGuestRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Team Guest Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.TEAM_GUEST_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(teamGuestRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultTeamGuestRole = savedRole.Name
	}
	if scheme.Scope == model.SCHEME_SCOPE_TEAM || scheme.Scope == model.SCHEME_SCOPE_CHANNEL {
		// Channel Admin Role
		channelAdminRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Channel Admin Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.CHANNEL_ADMIN_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		savedRole, err := s.SqlStore.Role().(*SqlRoleStore).createRole(channelAdminRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultChannelAdminRole = savedRole.Name

		// Channel User Role
		channelUserRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Channel User Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.CHANNEL_USER_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(channelUserRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultChannelUserRole = savedRole.Name

		// Channel Guest Role
		channelGuestRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Channel Guest Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.CHANNEL_GUEST_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		savedRole, err = s.SqlStore.Role().(*SqlRoleStore).createRole(channelGuestRole, transaction)
		if err != nil {
			return nil, err
		}
		scheme.DefaultChannelGuestRole = savedRole.Name
	}

	scheme.Id = model.NewId()
	if len(scheme.Name) == 0 {
		scheme.Name = model.NewId()
	}
	scheme.CreateAt = model.GetMillis()
	scheme.UpdateAt = scheme.CreateAt

	// Validate the scheme
	if !scheme.IsValidForCreate() {
		return nil, model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.invalid_scheme.app_error", nil, "", http.StatusBadRequest)
	}

	if err := transaction.Insert(scheme); err != nil {
		return nil, model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.insert.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return scheme, nil
}

func (s *SqlSchemeStore) Get(schemeId string) (*model.Scheme, *model.AppError) {
	var scheme model.Scheme
	if err := s.GetReplica().SelectOne(&scheme, "SELECT * from Schemes WHERE Id = :Id", map[string]interface{}{"Id": schemeId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlSchemeStore.Get", "store.sql_scheme.get.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlSchemeStore.Get", "store.sql_scheme.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return &scheme, nil
}

func (s *SqlSchemeStore) GetByName(schemeName string) (*model.Scheme, *model.AppError) {
	var scheme model.Scheme

	if err := s.GetReplica().SelectOne(&scheme, "SELECT * from Schemes WHERE Name = :Name", map[string]interface{}{"Name": schemeName}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlSchemeStore.GetByName", "store.sql_scheme.get.app_error", nil, "Name="+schemeName+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlSchemeStore.GetByName", "store.sql_scheme.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return &scheme, nil
}

func (s *SqlSchemeStore) Delete(schemeId string) (*model.Scheme, *model.AppError) {
	// Get the scheme
	var scheme model.Scheme
	if err := s.GetReplica().SelectOne(&scheme, "SELECT * from Schemes WHERE Id = :Id", map[string]interface{}{"Id": schemeId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.get.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.get.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
	}

	// Update any teams or channels using this scheme to the default scheme.
	if scheme.Scope == model.SCHEME_SCOPE_TEAM {
		if _, err := s.GetMaster().Exec("UPDATE Teams SET SchemeId = '' WHERE SchemeId = :SchemeId", map[string]interface{}{"SchemeId": schemeId}); err != nil {
			return nil, model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.reset_teams.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
		}
	} else if scheme.Scope == model.SCHEME_SCOPE_CHANNEL {
		if _, err := s.GetMaster().Exec("UPDATE Channels SET SchemeId = '' WHERE SchemeId = :SchemeId", map[string]interface{}{"SchemeId": schemeId}); err != nil {
			return nil, model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.reset_channels.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
		}

		// Blow away the channel caches.
		s.Channel().ClearCaches()
	}

	// Delete the roles belonging to the scheme.
	roleNames := []string{scheme.DefaultChannelGuestRole, scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole}
	if scheme.Scope == model.SCHEME_SCOPE_TEAM {
		roleNames = append(roleNames, scheme.DefaultTeamGuestRole, scheme.DefaultTeamUserRole, scheme.DefaultTeamAdminRole)
	}

	var inQueryList []string
	queryArgs := make(map[string]interface{})
	for i, roleId := range roleNames {
		inQueryList = append(inQueryList, fmt.Sprintf(":RoleName%v", i))
		queryArgs[fmt.Sprintf("RoleName%v", i)] = roleId
	}
	inQuery := strings.Join(inQueryList, ", ")

	time := model.GetMillis()
	queryArgs["UpdateAt"] = time
	queryArgs["DeleteAt"] = time

	if _, err := s.GetMaster().Exec("UPDATE Roles SET UpdateAt = :UpdateAt, DeleteAt = :DeleteAt WHERE Name IN ("+inQuery+")", queryArgs); err != nil {
		return nil, model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.delete.role_update.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
	}

	// Delete the scheme itself.
	scheme.UpdateAt = time
	scheme.DeleteAt = time

	rowsChanged, err := s.GetMaster().Update(&scheme)
	if err != nil {
		return nil, model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.delete.update.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
	}
	if rowsChanged != 1 {
		return nil, model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.delete.update.app_error", nil, "no record to update", http.StatusInternalServerError)
	}
	return &scheme, nil
}

func (s *SqlSchemeStore) GetAllPage(scope string, offset int, limit int) ([]*model.Scheme, *model.AppError) {
	var schemes []*model.Scheme

	scopeClause := ""
	if len(scope) > 0 {
		scopeClause = " AND Scope=:Scope "
	}

	if _, err := s.GetReplica().Select(&schemes, "SELECT * from Schemes WHERE DeleteAt = 0 "+scopeClause+" ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Limit": limit, "Offset": offset, "Scope": scope}); err != nil {
		return nil, model.NewAppError("SqlSchemeStore.Get", "store.sql_scheme.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return schemes, nil
}

func (s *SqlSchemeStore) PermanentDeleteAll() *model.AppError {
	if _, err := s.GetMaster().Exec("DELETE from Schemes"); err != nil {
		return model.NewAppError("SqlSchemeStore.PermanentDeleteAll", "store.sql_scheme.permanent_delete_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}
