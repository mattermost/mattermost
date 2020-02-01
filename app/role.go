// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) GetRole(id string) (*model.Role, *model.AppError) {
	return a.Srv.Store.Role().Get(id)
}

func (a *App) GetAllRoles() ([]*model.Role, *model.AppError) {
	return a.Srv.Store.Role().GetAll()
}

func (a *App) GetRoleByName(name string) (*model.Role, *model.AppError) {
	role, err := a.Srv.Store.Role().GetByName(name)
	if err != nil {
		return nil, err
	}

	err = a.updateChannelRolesPermissions([]*model.Role{role})
	if err != nil {
		return nil, err
	}

	return role, nil
}

func (a *App) GetRolesByNames(names []string) ([]*model.Role, *model.AppError) {
	roles, err := a.Srv.Store.Role().GetByNames(names)
	if err != nil {
		return nil, err
	}

	err = a.updateChannelRolesPermissions(roles)
	if err != nil {
		return nil, err
	}

	return roles, nil
}

// updateChannelRolesPermissions updates the permissions based on the role type, whether the permission is
// moderated, and the value of the permission on the higher-scoped scheme.
func (a *App) updateChannelRolesPermissions(roles []*model.Role) *model.AppError {
	var higherScopeNamesToQuery []string

	for _, role := range roles {
		if !role.BuiltIn && role.SchemeManaged {
			higherScopeNamesToQuery = append(higherScopeNamesToQuery, role.Name)
		}
	}

	if len(higherScopeNamesToQuery) == 0 {
		return nil
	}

	higherScopedPermissionsMap, err := a.Srv.Store.Role().HigherScopedPermissions(higherScopeNamesToQuery)
	if err != nil {
		return err
	}

	// Note: If we start shipping with builtin channel schemes we need to include builtin roles in this branching
	// statement.
	for _, role := range roles {
		if !role.BuiltIn && role.SchemeManaged {
			if higherScopedPermissions, ok := higherScopedPermissionsMap[role.Name]; ok {
				role.MergeHigherScopedPermissions(higherScopedPermissions)
			}
		}
	}

	return nil
}

func (a *App) PatchRole(role *model.Role, patch *model.RolePatch) (*model.Role, *model.AppError) {
	// If patch is a no-op then short-circuit the store.
	if patch.Permissions != nil && reflect.DeepEqual(*patch.Permissions, role.Permissions) {
		return role, nil
	}

	role.Patch(patch)
	role, err := a.UpdateRole(role)
	if err != nil {
		return nil, err
	}

	return role, err
}

func (a *App) CreateRole(role *model.Role) (*model.Role, *model.AppError) {
	role.Id = ""
	role.CreateAt = 0
	role.UpdateAt = 0
	role.DeleteAt = 0
	role.BuiltIn = false
	role.SchemeManaged = false

	return a.Srv.Store.Role().Save(role)

}

func (a *App) UpdateRole(role *model.Role) (*model.Role, *model.AppError) {
	savedRole, err := a.Srv.Store.Role().Save(role)
	if err != nil {
		return nil, err
	}
	a.sendUpdatedRoleEvent(savedRole)

	return savedRole, nil

}

func (a *App) CheckRolesExist(roleNames []string) *model.AppError {
	roles, err := a.GetRolesByNames(roleNames)
	if err != nil {
		return err
	}

	for _, name := range roleNames {
		nameFound := false
		for _, role := range roles {
			if name == role.Name {
				nameFound = true
				break
			}
		}
		if !nameFound {
			return model.NewAppError("CheckRolesExist", "app.role.check_roles_exist.role_not_found", nil, "role="+name, http.StatusBadRequest)
		}
	}

	return nil
}

func (a *App) sendUpdatedRoleEvent(role *model.Role) {
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_ROLE_UPDATED, "", "", "", nil)
	message.Add("role", role.ToJson())

	a.Srv.Go(func() {
		a.Publish(message)
	})
}

func RemoveRoles(rolesToRemove []string, roles string) string {
	roleList := strings.Fields(roles)
	newRoles := make([]string, 0)

	for _, role := range roleList {
		shouldRemove := false
		for _, roleToRemove := range rolesToRemove {
			if role == roleToRemove {
				shouldRemove = true
				break
			}
		}
		if !shouldRemove {
			newRoles = append(newRoles, role)
		}
	}

	return strings.Join(newRoles, " ")
}
