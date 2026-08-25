// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func (a *App) GetRole(id string) (*model.Role, *model.AppError) {
	role, err := a.Srv().Store().Role().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetRole", "app.role.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	appErr := a.Srv().mergeChannelHigherScopedPermissions([]*model.Role{role})
	if appErr != nil {
		return nil, appErr
	}

	return role, nil
}

func (a *App) GetAllRoles() ([]*model.Role, *model.AppError) {
	roles, err := a.Srv().Store().Role().GetAll()
	if err != nil {
		return nil, model.NewAppError("GetAllRoles", "app.role.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	appErr := a.Srv().mergeChannelHigherScopedPermissions(roles)
	if appErr != nil {
		return nil, appErr
	}

	return roles, nil
}

func (s *Server) GetRoleByName(rctx request.CTX, name string) (*model.Role, *model.AppError) {
	role, nErr := s.Store().Role().GetByName(rctx, name)
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

func (a *App) GetRoleByName(rctx request.CTX, name string) (*model.Role, *model.AppError) {
	return a.Srv().GetRoleByName(rctx, name)
}

func (a *App) GetRolesByNames(names []string) ([]*model.Role, *model.AppError) {
	roles, nErr := a.Srv().Store().Role().GetByNames(names)
	if nErr != nil {
		return nil, model.NewAppError("GetRolesByNames", "app.role.get_by_names.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	err := a.mergeChannelHigherScopedPermissions(roles)
	if err != nil {
		return nil, err
	}

	return roles, nil
}

func (a *App) DeleteRole(id string) (*model.Role, *model.AppError) {
	role, err := a.Srv().Store().Role().Delete(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeleteRole", "app.role.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("DeleteRole", "app.role.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return role, nil
}

// mergeChannelHigherScopedPermissions updates the permissions based on the role type, whether the permission is
// moderated, and the value of the permission on the higher-scoped scheme.
func (s *Server) mergeChannelHigherScopedPermissions(roles []*model.Role) *model.AppError {
	var higherScopeNamesToQuery []string

	for _, role := range roles {
		if role.SchemeManaged {
			higherScopeNamesToQuery = append(higherScopeNamesToQuery, role.Name)
		}
	}

	if len(higherScopeNamesToQuery) == 0 {
		return nil
	}

	higherScopedPermissionsMap, err := s.Store().Role().ChannelHigherScopedPermissions(higherScopeNamesToQuery)
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

// mergeChannelHigherScopedPermissions updates the permissions based on the role type, whether the permission is
// moderated, and the value of the permission on the higher-scoped scheme.
func (a *App) mergeChannelHigherScopedPermissions(roles []*model.Role) *model.AppError {
	return a.Srv().mergeChannelHigherScopedPermissions(roles)
}

func (a *App) PatchRole(role *model.Role, patch *model.RolePatch) (*model.Role, *model.AppError) {
	// checkSpacePermissionScope refuses these roles on the write path regardless;
	// repeated here only because the no-op short-circuit below would otherwise
	// return a 200 that a caller could read as permission.
	if model.IsSpaceCapabilityRole(role.Name) {
		return nil, model.NewAppError("PatchRole", "app.role.save.space_capability_role.app_error",
			map[string]any{"RoleName": role.Name}, "", http.StatusBadRequest)
	}

	// If patch is a no-op then short-circuit the store.
	if patch.Permissions != nil && reflect.DeepEqual(*patch.Permissions, role.Permissions) {
		return role, nil
	}

	// In PatchRole rather than only in the REST handler, so every entry point
	// applies the blocklist, the channel moderation writes included.
	if patch.Permissions != nil {
		for _, permission := range model.PermissionsChangedByPatch(role, patch) {
			if slices.Contains(model.RolePatchDeniedPermissionIDs, permission) {
				return nil, model.NewAppError("PatchRole", "api.roles.patch_roles.not_allowed_permission.error", nil, "Cannot add or remove permission: "+permission, http.StatusNotImplemented)
			}
		}
	}

	role.Patch(patch)
	role, err := a.UpdateRole(role)
	if err != nil {
		return nil, err
	}

	if appErr := a.sendUpdatedRoleEvent(role); appErr != nil {
		return nil, appErr
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
	// Resetting SchemeId closes the guard's scheme-based bypass: a
	// caller-supplied id pointing at a space preset would otherwise let a
	// created role borrow that scheme's scope and pass unrejected.
	role.SchemeId = nil

	// On the create path there is no stored role, so every guarded permission
	// in the incoming set counts as an add.
	if appErr := a.checkSpacePermissionScope(role, nil); appErr != nil {
		return nil, appErr
	}

	var err error
	role, err = a.Srv().Store().Role().Save(role)
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

func (a *App) UpdateRole(role *model.Role) (*model.Role, *model.AppError) {
	// UpdateRole receives no prior permission set, so re-read the stored role to diff
	// against before saving: only an *add* of a guarded permission is rejected, never
	// a removal. Only a write carrying one of them needs a baseline at all, which
	// keeps every ordinary role write at its previous cost.
	var storedPermissions []string
	if hasSpaceChannelScopedPermission(role.Permissions) {
		storedRole, appErr := a.storedRoleForSpaceGuard(role)
		if appErr != nil {
			return nil, appErr
		}
		if storedRole != nil {
			storedPermissions = storedRole.Permissions
		}
	}
	if appErr := a.checkSpacePermissionScope(role, storedPermissions); appErr != nil {
		return nil, appErr
	}

	savedRole, err := a.Srv().Store().Role().Save(role)
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

	if slices.Contains(builtInRolesMinusChannelRoles, savedRole.Name) {
		return savedRole, nil
	}

	var roleRetrievalFunc func() ([]*model.Role, *model.AppError)

	if slices.Contains(builtInChannelRoles, savedRole.Name) {
		roleRetrievalFunc = func() ([]*model.Role, *model.AppError) {
			roles, nErr := a.Srv().Store().Role().AllChannelSchemeRoles()
			if nErr != nil {
				return nil, model.NewAppError("UpdateRole", "app.role.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}

			return roles, nil
		}
	} else {
		roleRetrievalFunc = func() ([]*model.Role, *model.AppError) {
			roles, nErr := a.Srv().Store().Role().ChannelRolesUnderTeamRole(savedRole.Name)
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

	appErr = a.mergeChannelHigherScopedPermissions(impactedRoles)
	if appErr != nil {
		return nil, appErr
	}

	for _, ir := range impactedRoles {
		if ir.Name != role.Name {
			appErr = a.sendUpdatedRoleEvent(ir)
			if appErr != nil {
				return nil, appErr
			}
		}
	}

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

func (a *App) sendUpdatedRoleEvent(role *model.Role) *model.AppError {
	roleJSON, jsonErr := json.Marshal(role)
	if jsonErr != nil {
		return model.NewAppError("sendUpdatedRoleEvent", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}

	publishEvent := func(teamID, channelID string) {
		message := model.NewWebSocketEvent(model.WebsocketEventRoleUpdated, teamID, channelID, "", nil, "")
		message.Add("role", string(roleJSON))
		a.Publish(message)
	}

	// Built-in system roles apply to all users; broadcast globally without a DB lookup.
	if role.BuiltIn {
		publishEvent("", "")
		return nil
	}

	// Scheme-managed roles: use SchemeId to look up the owning scheme.
	if role.SchemeId == nil {
		// No owning scheme — treat as global (e.g. custom non-scheme role).
		publishEvent("", "")
		return nil
	}
	scheme, err := a.Srv().Store().Scheme().Get(*role.SchemeId)
	if err != nil {
		a.Log().Error("Failed to look up scheme for role event; skipping broadcast",
			mlog.String("role_id", role.Id),
			mlog.String("scheme_id", *role.SchemeId),
			mlog.Err(err))
		return nil
	}

	const pageSize = 1000
	const maxBroadcasts = 100000
	switch scheme.Scope {
	case model.SchemeScopeTeam:
		totalBroadcasts := 0
		offset := 0
		for {
			teams, storeErr := a.Srv().Store().Team().GetTeamsByScheme(scheme.Id, offset, pageSize)
			if storeErr != nil {
				return model.NewAppError("sendUpdatedRoleEvent", "app.role.send_updated_role_event.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
			}
			for _, team := range teams {
				publishEvent(team.Id, "")
			}
			totalBroadcasts += len(teams)
			if len(teams) < pageSize {
				break
			}
			if totalBroadcasts >= maxBroadcasts {
				a.Log().Error("sendUpdatedRoleEvent: hit broadcast limit for team scheme",
					mlog.String("scheme_id", scheme.Id),
					mlog.Int("total_broadcasts", totalBroadcasts))
				break
			}
			offset += pageSize
		}
	case model.SchemeScopeChannel:
		// Space backing channels are excluded from GetChannelsByScheme, so a scheme
		// that governs one has no channel to address and the loop below would
		// broadcast to nobody, leaving every client's cached permissions stale.
		// Broadcast globally instead, the way the playbook and run scopes do.
		spaceCount, sErr := a.Srv().Store().Channel().CountSpaceChannelsByScheme(scheme.Id)
		if sErr != nil {
			return model.NewAppError("sendUpdatedRoleEvent", "app.channel.count_space_channels_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(sErr)
		}
		if spaceCount > 0 {
			publishEvent("", "")
			return nil
		}

		totalBroadcasts := 0
		offset := 0
		for {
			channels, storeErr := a.Srv().Store().Channel().GetChannelsByScheme(scheme.Id, offset, pageSize)
			if storeErr != nil {
				return model.NewAppError("sendUpdatedRoleEvent", "app.role.send_updated_role_event.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
			}
			for _, channel := range channels {
				publishEvent("", channel.Id)
			}
			totalBroadcasts += len(channels)
			if len(channels) < pageSize {
				break
			}
			if totalBroadcasts >= maxBroadcasts {
				a.Log().Error("sendUpdatedRoleEvent: hit broadcast limit for channel scheme",
					mlog.String("scheme_id", scheme.Id),
					mlog.Int("total_broadcasts", totalBroadcasts))
				break
			}
			offset += pageSize
		}
	case model.SchemeScopePlaybook, model.SchemeScopeRun:
		// Playbook/run schemes don't map to teams or channels; broadcast globally.
		publishEvent("", "")
	default:
		return model.NewAppError("sendUpdatedRoleEvent", "app.role.send_updated_role_event.unknown_scope", nil, fmt.Sprintf("unknown scheme scope: %s", scheme.Scope), http.StatusInternalServerError)
	}
	return nil
}

func removeRoles(rolesToRemove []string, roles string) string {
	roleList := strings.Fields(roles)
	newRoles := make([]string, 0)

	for _, role := range roleList {
		shouldRemove := slices.Contains(rolesToRemove, role)
		if !shouldRemove {
			newRoles = append(newRoles, role)
		}
	}

	return strings.Join(newRoles, " ")
}
