// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
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

func initSqlSupplierSchemes(sqlStore SqlStore) {
	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Scheme{}, "Schemes").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Name").SetMaxSize(model.SCHEME_NAME_MAX_LENGTH).SetUnique(true)
		table.ColMap("DisplayName").SetMaxSize(model.SCHEME_DISPLAY_NAME_MAX_LENGTH)
		table.ColMap("Description").SetMaxSize(model.SCHEME_DESCRIPTION_MAX_LENGTH)
		table.ColMap("Scope").SetMaxSize(32)
		table.ColMap("DefaultTeamAdminRole").SetMaxSize(64)
		table.ColMap("DefaultTeamUserRole").SetMaxSize(64)
		table.ColMap("DefaultChannelAdminRole").SetMaxSize(64)
		table.ColMap("DefaultChannelUserRole").SetMaxSize(64)
	}
}

func (s *SqlSupplier) SchemeSave(ctx context.Context, scheme *model.Scheme, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if len(scheme.Id) == 0 {
		if transaction, err := s.GetMaster().Begin(); err != nil {
			result.Err = model.NewAppError("SqlSchemeStore.SaveScheme", "store.sql_scheme.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result = s.createScheme(ctx, scheme, transaction, hints...)

			if result.Err != nil {
				transaction.Rollback()
			} else if err := transaction.Commit(); err != nil {
				result.Err = model.NewAppError("SqlSchemeStore.SchemeSave", "store.sql_scheme.save_scheme.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	} else {
		if !scheme.IsValid() {
			result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.invalid_scheme.app_error", nil, "schemeId="+scheme.Id, http.StatusBadRequest)
			return result
		}

		scheme.UpdateAt = model.GetMillis()

		if rowsChanged, err := s.GetMaster().Update(scheme); err != nil {
			result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.update.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if rowsChanged != 1 {
			result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.update.app_error", nil, "no record to update", http.StatusInternalServerError)
		}

		result.Data = scheme
	}

	return result
}

func (s *SqlSupplier) createScheme(ctx context.Context, scheme *model.Scheme, transaction *gorp.Transaction, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	// Fetch the default system scheme roles to populate default permissions.
	defaultRoleNames := []string{model.TEAM_ADMIN_ROLE_ID, model.TEAM_USER_ROLE_ID, model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID}
	defaultRoles := make(map[string]*model.Role)
	if rolesResult := s.RoleGetByNames(ctx, defaultRoleNames); rolesResult.Err != nil {
		result.Err = rolesResult.Err
		return result
	} else {
		for _, role := range rolesResult.Data.([]*model.Role) {
			switch role.Name {
			case model.TEAM_ADMIN_ROLE_ID:
				defaultRoles[model.TEAM_ADMIN_ROLE_ID] = role
			case model.TEAM_USER_ROLE_ID:
				defaultRoles[model.TEAM_USER_ROLE_ID] = role
			case model.CHANNEL_ADMIN_ROLE_ID:
				defaultRoles[model.CHANNEL_ADMIN_ROLE_ID] = role
			case model.CHANNEL_USER_ROLE_ID:
				defaultRoles[model.CHANNEL_USER_ROLE_ID] = role
			}
		}

		if len(defaultRoles) != 4 {
			result.Err = model.NewAppError("SqlSchemeStore.SaveScheme", "store.sql_scheme.save.retrieve_default_scheme_roles.app_error", nil, "", http.StatusInternalServerError)
			return result
		}
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

		if saveRoleResult := s.createRole(ctx, teamAdminRole, transaction); saveRoleResult.Err != nil {
			result.Err = saveRoleResult.Err
			return result
		} else {
			scheme.DefaultTeamAdminRole = saveRoleResult.Data.(*model.Role).Name
		}

		// Team User Role
		teamUserRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Team User Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.TEAM_USER_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		if saveRoleResult := s.createRole(ctx, teamUserRole, transaction); saveRoleResult.Err != nil {
			result.Err = saveRoleResult.Err
			return result
		} else {
			scheme.DefaultTeamUserRole = saveRoleResult.Data.(*model.Role).Name
		}
	}
	if scheme.Scope == model.SCHEME_SCOPE_TEAM || scheme.Scope == model.SCHEME_SCOPE_CHANNEL {
		// Channel Admin Role
		channelAdminRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Channel Admin Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.CHANNEL_ADMIN_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		if saveRoleResult := s.createRole(ctx, channelAdminRole, transaction); saveRoleResult.Err != nil {
			result.Err = saveRoleResult.Err
			return result
		} else {
			scheme.DefaultChannelAdminRole = saveRoleResult.Data.(*model.Role).Name
		}

		// Channel User Role
		channelUserRole := &model.Role{
			Name:          model.NewId(),
			DisplayName:   fmt.Sprintf("Channel User Role for Scheme %s", scheme.Name),
			Permissions:   defaultRoles[model.CHANNEL_USER_ROLE_ID].Permissions,
			SchemeManaged: true,
		}

		if saveRoleResult := s.createRole(ctx, channelUserRole, transaction); saveRoleResult.Err != nil {
			result.Err = saveRoleResult.Err
			return result
		} else {
			scheme.DefaultChannelUserRole = saveRoleResult.Data.(*model.Role).Name
		}
	}

	scheme.Id = model.NewId()
	if len(scheme.Name) == 0 {
		scheme.Name = model.NewId()
	}
	scheme.CreateAt = model.GetMillis()
	scheme.UpdateAt = scheme.CreateAt

	// Validate the scheme
	if !scheme.IsValidForCreate() {
		result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.invalid_scheme.app_error", nil, "", http.StatusBadRequest)
		return result
	}

	if err := transaction.Insert(scheme); err != nil {
		result.Err = model.NewAppError("SqlSchemeStore.Save", "store.sql_scheme.save.insert.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result.Data = scheme

	return result
}

func (s *SqlSupplier) SchemeGet(ctx context.Context, schemeId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var scheme model.Scheme

	if err := s.GetReplica().SelectOne(&scheme, "SELECT * from Schemes WHERE Id = :Id", map[string]interface{}{"Id": schemeId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlSchemeStore.Get", "store.sql_scheme.get.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlSchemeStore.Get", "store.sql_scheme.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	result.Data = &scheme

	return result
}

func (s *SqlSupplier) SchemeGetByName(ctx context.Context, schemeName string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var scheme model.Scheme

	if err := s.GetReplica().SelectOne(&scheme, "SELECT * from Schemes WHERE Name = :Name", map[string]interface{}{"Name": schemeName}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlSchemeStore.GetByName", "store.sql_scheme.get.app_error", nil, "Name="+schemeName+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlSchemeStore.GetByName", "store.sql_scheme.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	result.Data = &scheme

	return result
}

func (s *SqlSupplier) SchemeDelete(ctx context.Context, schemeId string, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	// Get the scheme
	var scheme model.Scheme
	if err := s.GetReplica().SelectOne(&scheme, "SELECT * from Schemes WHERE Id = :Id", map[string]interface{}{"Id": schemeId}); err != nil {
		if err == sql.ErrNoRows {
			result.Err = model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.get.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Err = model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.get.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
		}

		return result
	}

	// Update any teams or channels using this scheme to the default scheme.
	if scheme.Scope == model.SCHEME_SCOPE_TEAM {
		if _, err := s.GetMaster().Exec("UPDATE Teams SET SchemeId = '' WHERE SchemeId = :SchemeId", map[string]interface{}{"SchemeId": schemeId}); err != nil {
			result.Err = model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.reset_teams.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
			return result
		}
	} else if scheme.Scope == model.SCHEME_SCOPE_CHANNEL {
		if _, err := s.GetMaster().Exec("UPDATE Channels SET SchemeId = '' WHERE SchemeId = :SchemeId", map[string]interface{}{"SchemeId": schemeId}); err != nil {
			result.Err = model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.reset_channels.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
			return result
		}

		// Blow away the channel caches.
		s.Channel().ClearCaches()
	}

	// Delete the roles belonging to the scheme.
	roleNames := []string{scheme.DefaultChannelUserRole, scheme.DefaultChannelAdminRole}
	if scheme.Scope == model.SCHEME_SCOPE_TEAM {
		roleNames = append(roleNames, scheme.DefaultTeamUserRole, scheme.DefaultTeamAdminRole)
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
		result.Err = model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.delete.role_update.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	// Delete the scheme itself.
	scheme.UpdateAt = time
	scheme.DeleteAt = time

	if rowsChanged, err := s.GetMaster().Update(&scheme); err != nil {
		result.Err = model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.delete.update.app_error", nil, "Id="+schemeId+", "+err.Error(), http.StatusInternalServerError)
	} else if rowsChanged != 1 {
		result.Err = model.NewAppError("SqlSchemeStore.Delete", "store.sql_scheme.delete.update.app_error", nil, "no record to update", http.StatusInternalServerError)
	} else {
		result.Data = &scheme
	}

	return result
}

func (s *SqlSupplier) SchemeGetAllPage(ctx context.Context, scope string, offset int, limit int, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	var schemes []*model.Scheme

	scopeClause := ""
	if len(scope) > 0 {
		scopeClause = " AND Scope=:Scope "
	}

	if _, err := s.GetReplica().Select(&schemes, "SELECT * from Schemes WHERE DeleteAt = 0 "+scopeClause+" ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Limit": limit, "Offset": offset, "Scope": scope}); err != nil {
		result.Err = model.NewAppError("SqlSchemeStore.Get", "store.sql_scheme.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result.Data = schemes

	return result
}

func (s *SqlSupplier) SchemePermanentDeleteAll(ctx context.Context, hints ...store.LayeredStoreHint) *store.LayeredStoreSupplierResult {
	result := store.NewSupplierResult()

	if _, err := s.GetMaster().Exec("DELETE from Schemes"); err != nil {
		result.Err = model.NewAppError("SqlSchemeStore.PermanentDeleteAll", "store.sql_scheme.permanent_delete_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return result
}
