// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func (s *SuiteService) GetRole(id string) (*model.Role, *model.AppError) {
	role, err := s.platform.Store.Role().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetRole", "app.role.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	appErr := s.mergeChannelHigherScopedPermissions([]*model.Role{role})
	if appErr != nil {
		return nil, appErr
	}

	return role, nil
}

func (s *SuiteService) GetAllRoles() ([]*model.Role, *model.AppError) {
	roles, err := s.platform.Store.Role().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetAllRoles", "app.role.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	appErr := s.mergeChannelHigherScopedPermissions(roles)
	if appErr != nil {
		return nil, appErr
	}

	return roles, nil
}

func (s *SuiteService) GetRoleByName(ctx context.Context, name string) (*model.Role, *model.AppError) {
	role, nErr := s.platform.Store.Role().GetByName(ctx, name)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("GetRoleByName", "app.role.get_by_name.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("GetRoleByName", "app.role.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	err := s.mergeChannelHigherScopedPermissions([]*model.Role{role})
	if err != nil {
		return nil, err
	}

	return role, nil
}

func (s *SuiteService) GetRolesByNames(names []string) ([]*model.Role, *model.AppError) {
	roles, nErr := s.platform.Store.Role().GetByNames(names)
	if nErr != nil {
		return nil, model.NewAppError("GetRolesByNames", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	err := s.mergeChannelHigherScopedPermissions(roles)
	if err != nil {
		return nil, err
	}

	return roles, nil
}

// mergeChannelHigherScopedPermissions updates the permissions based on the role type, whether the permission is
// moderated, and the value of the permission on the higher-scoped scheme.
func (s *SuiteService) mergeChannelHigherScopedPermissions(roles []*model.Role) *model.AppError {
	var higherScopeNamesToQuery []string

	for _, role := range roles {
		if role.SchemeManaged {
			higherScopeNamesToQuery = append(higherScopeNamesToQuery, role.Name)
		}
	}

	if len(higherScopeNamesToQuery) == 0 {
		return nil
	}

	higherScopedPermissionsMap, err := s.platform.Store.Role().ChannelHigherScopedPermissions(higherScopeNamesToQuery)
	if err != nil {
		return model.NewAppError("mergeChannelHigherScopedPermissions", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, role := range roles {
		if role.SchemeManaged {
			if higherScopedPermissions, ok := higherScopedPermissionsMap[role.Name]; ok {
				role.MergeChannelHigherScopedPermissions(higherScopedPermissions)
			}
		}
	}

	return nil
}

func (s *SuiteService) PatchRole(role *model.Role, patch *model.RolePatch) (*model.Role, *model.AppError) {
	// If patch is a no-op then short-circuit the store.
	if patch.Permissions != nil && reflect.DeepEqual(*patch.Permissions, role.Permissions) {
		return role, nil
	}

	role.Patch(patch)
	role, err := s.UpdateRole(role)
	if err != nil {
		return nil, err
	}

	if appErr := s.SendUpdatedRoleEvent(role); appErr != nil {
		return nil, appErr
	}

	return role, err
}

func (s *SuiteService) CreateRole(role *model.Role) (*model.Role, *model.AppError) {
	role.Id = ""
	role.CreateAt = 0
	role.UpdateAt = 0
	role.DeleteAt = 0
	role.BuiltIn = false
	role.SchemeManaged = false

	var err error
	role, err = s.platform.Store.Role().Save(role)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateRole", "app.role.save.invalid_role.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateRole", "app.role.save.insert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return role, nil
}

func (s *SuiteService) UpdateRole(role *model.Role) (*model.Role, *model.AppError) {
	savedRole, err := s.platform.Store.Role().Save(role)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateRole", "app.role.save.invalid_role.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateRole", "app.role.save.insert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	builtInChannelRoles := []string{
		model.ChannelGuestRoleId,
		model.ChannelUserRoleId,
		model.ChannelAdminRoleId,
	}

	builtInRolesMinusChannelRoles := append(utils.RemoveStringsFromSlice(model.BuiltInSchemeManagedRoleIDs, builtInChannelRoles...), model.NewSystemRoleIDs...)

	if utils.StringInSlice(savedRole.Name, builtInRolesMinusChannelRoles) {
		return savedRole, nil
	}

	var roleRetrievalFunc func() ([]*model.Role, *model.AppError)

	if utils.StringInSlice(savedRole.Name, builtInChannelRoles) {
		roleRetrievalFunc = func() ([]*model.Role, *model.AppError) {
			roles, nErr := s.platform.Store.Role().AllChannelSchemeRoles()
			if nErr != nil {
				return nil, model.NewAppError("UpdateRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}

			return roles, nil
		}
	} else {
		roleRetrievalFunc = func() ([]*model.Role, *model.AppError) {
			roles, nErr := s.platform.Store.Role().ChannelRolesUnderTeamRole(savedRole.Name)
			if nErr != nil {
				return nil, model.NewAppError("UpdateRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}

			return roles, nil
		}
	}

	impactedRoles, appErr := roleRetrievalFunc()
	if appErr != nil {
		return nil, appErr
	}
	impactedRoles = append(impactedRoles, role)

	appErr = s.mergeChannelHigherScopedPermissions(impactedRoles)
	if appErr != nil {
		return nil, appErr
	}

	for _, ir := range impactedRoles {
		if ir.Name != role.Name {
			appErr = s.SendUpdatedRoleEvent(ir)
			if appErr != nil {
				return nil, appErr
			}
		}
	}

	return savedRole, nil
}

func (s *SuiteService) CheckRolesExist(roleNames []string) *model.AppError {
	roles, err := s.GetRolesByNames(roleNames)
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

func (s *SuiteService) SendUpdatedRoleEvent(role *model.Role) *model.AppError {
	message := model.NewWebSocketEvent(model.WebsocketEventRoleUpdated, "", "", "", nil, "")
	roleJSON, jsonErr := json.Marshal(role)
	if jsonErr != nil {
		return model.NewAppError("sendUpdatedRoleEvent", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("role", string(roleJSON))
	s.platform.Publish(message)
	return nil
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
