// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (ch *Channels) loadPluginPermissionCatalog() {
	if ch.srv == nil || ch.srv.Store() == nil {
		return
	}
	permissions, err := ch.srv.Store().Role().GetPluginPermissions()
	if err != nil {
		ch.srv.Log().Warn("Failed to load plugin permission catalog", mlog.Err(err))
		return
	}
	for _, p := range permissions {
		model.RegisterPluginPermissionInMemory(p)
	}
}

func (a *App) LoadPluginPermissionCatalog() {
	a.ch.loadPluginPermissionCatalog()
}

func (a *App) RegisterManifestPluginRBAC(rctx request.CTX, manifest *model.Manifest) *model.AppError {
	if manifest == nil {
		return nil
	}
	for _, p := range manifest.Permissions {
		if p == nil {
			continue
		}
		if appErr := a.RegisterPluginPermission(rctx, manifest.Id, &model.PluginPermission{
			Id:           p.Id,
			Name:         p.Name,
			Description:  p.Description,
			Scope:        p.Scope,
			DefaultRoles: p.DefaultRoles,
		}); appErr != nil {
			return appErr
		}
	}
	for _, r := range manifest.Roles {
		if r == nil {
			continue
		}
		if _, appErr := a.RegisterPluginRole(rctx, manifest.Id, &model.PluginRole{
			Name:        r.Name,
			DisplayName: r.DisplayName,
			Description: r.Description,
			Permissions: r.Permissions,
		}); appErr != nil {
			return appErr
		}
	}
	return nil
}

func (a *App) RegisterPluginPermission(rctx request.CTX, pluginID string, permission *model.PluginPermission) *model.AppError {
	if permission == nil {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.invalid.app_error", nil, "permission is nil", http.StatusBadRequest)
	}
	if !model.IsValidPluginId(pluginID) {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.invalid.app_error", nil, "invalid plugin id", http.StatusBadRequest)
	}
	if !model.IsValidPluginPermissionLocalID(permission.Id) {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.invalid.app_error", nil, "invalid permission id", http.StatusBadRequest)
	}
	if strings.TrimSpace(permission.Name) == "" {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.invalid.app_error", nil, "name is required", http.StatusBadRequest)
	}
	if !model.IsValidPluginPermissionScope(permission.Scope) {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.invalid.app_error", nil, "invalid scope", http.StatusBadRequest)
	}

	permissionID := model.PluginPermissionId(pluginID, permission.Id)
	if _, _, ok := model.SplitPluginPermissionId(permissionID); !ok {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.invalid.app_error", nil, "invalid namespaced permission id", http.StatusBadRequest)
	}

	existing, err := a.Srv().Store().Role().GetPluginPermission(pluginID, permission.Id)
	var nfErr *store.ErrNotFound
	isNew := errors.As(err, &nfErr)
	if err != nil && !isNew {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if isNew {
		count, countErr := a.Srv().Store().Role().GetPluginPermissionsByPlugin(pluginID)
		if countErr != nil {
			return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.save.app_error", nil, "", http.StatusInternalServerError).Wrap(countErr)
		}
		if len(count) >= model.MaxPluginPermissionsPerPlugin {
			return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.limit.app_error", nil, "", http.StatusBadRequest)
		}
	}

	for _, roleName := range permission.DefaultRoles {
		if !model.IsValidRoleName(roleName) || !model.IsBuiltInRole(roleName) {
			return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.invalid.app_error", nil, "invalid default role "+roleName, http.StatusBadRequest)
		}
	}

	toSave := &model.PluginPermission{
		PluginId:        pluginID,
		Id:              permission.Id,
		PermissionId:    permissionID,
		Name:            permission.Name,
		Description:     permission.Description,
		Scope:           permission.Scope,
		DefaultRoles:    append([]string(nil), permission.DefaultRoles...),
		Active:          true,
		DefaultsApplied: existing != nil && existing.DefaultsApplied,
	}

	if err := a.Srv().Store().Role().SavePluginPermission(toSave); err != nil {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	saved, err := a.Srv().Store().Role().GetPluginPermission(pluginID, permission.Id)
	if err != nil {
		return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	saved.Active = true
	model.RegisterPluginPermissionInMemory(saved)

	if appErr := a.ensurePluginPermissionOnSystemAdmin(rctx, saved.PermissionId); appErr != nil {
		return appErr
	}

	if !saved.DefaultsApplied {
		if appErr := a.applyPluginPermissionDefaults(rctx, saved); appErr != nil {
			return appErr
		}
		if err := a.Srv().Store().Role().MarkPluginPermissionDefaultsApplied(pluginID, permission.Id); err != nil {
			return model.NewAppError("RegisterPluginPermission", "app.plugin.permission.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		saved.DefaultsApplied = true
		model.RegisterPluginPermissionInMemory(saved)
	}

	permission.PermissionId = saved.PermissionId
	permission.PluginId = pluginID
	permission.Active = true
	return nil
}

func (a *App) ensurePluginPermissionOnSystemAdmin(rctx request.CTX, permissionID string) *model.AppError {
	role, appErr := a.GetRoleByName(rctx, model.SystemAdminRoleId)
	if appErr != nil {
		return appErr
	}
	if slices.Contains(role.Permissions, permissionID) {
		return nil
	}
	role.Permissions = append(role.Permissions, permissionID)
	updated, appErr := a.UpdateRole(role)
	if appErr != nil {
		return appErr
	}
	return a.sendUpdatedRoleEvent(updated)
}

func (a *App) applyPluginPermissionDefaults(rctx request.CTX, permission *model.PluginPermission) *model.AppError {
	for _, roleName := range permission.DefaultRoles {
		if roleName == model.SystemAdminRoleId {
			continue
		}
		role, appErr := a.GetRoleByName(rctx, roleName)
		if appErr != nil {
			return appErr
		}
		if slices.Contains(role.Permissions, permission.PermissionId) {
			continue
		}
		role.Permissions = append(role.Permissions, permission.PermissionId)
		updated, appErr := a.UpdateRole(role)
		if appErr != nil {
			return appErr
		}
		if appErr := a.sendUpdatedRoleEvent(updated); appErr != nil {
			return appErr
		}
	}
	return nil
}

func (a *App) SetPluginPermissionsActive(pluginID string, active bool) *model.AppError {
	if err := a.Srv().Store().Role().SetPluginPermissionsActive(pluginID, active); err != nil {
		return model.NewAppError("SetPluginPermissionsActive", "app.plugin.permission.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	model.SetPluginPermissionsActiveInMemory(pluginID, active)
	return nil
}

func (a *App) GetPluginPermissions() ([]*model.PluginPermission, *model.AppError) {
	permissions, err := a.Srv().Store().Role().GetPluginPermissions()
	if err != nil {
		return nil, model.NewAppError("GetPluginPermissions", "app.plugin.permission.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	nameByID := map[string]string{}
	if plugins, appErr := a.GetPlugins(); appErr == nil {
		for _, p := range plugins.Active {
			nameByID[p.Id] = p.Name
		}
		for _, p := range plugins.Inactive {
			nameByID[p.Id] = p.Name
		}
	}
	for _, p := range permissions {
		p.PluginName = nameByID[p.PluginId]
	}
	return permissions, nil
}

func (a *App) RegisterPluginRole(rctx request.CTX, pluginID string, pluginRole *model.PluginRole) (*model.Role, *model.AppError) {
	if pluginRole == nil {
		return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.invalid.app_error", nil, "role is nil", http.StatusBadRequest)
	}
	if !model.IsValidPluginId(pluginID) {
		return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.invalid.app_error", nil, "invalid plugin id", http.StatusBadRequest)
	}
	if !model.IsValidPluginRoleLocalName(pluginRole.Name) {
		return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.invalid.app_error", nil, "invalid role name", http.StatusBadRequest)
	}
	if strings.TrimSpace(pluginRole.DisplayName) == "" {
		return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.invalid.app_error", nil, "display name is required", http.StatusBadRequest)
	}

	existingOwnership, err := a.Srv().Store().Role().GetPluginRoleOwnership(pluginID, pluginRole.Name)
	var nfErr *store.ErrNotFound
	isNew := errors.As(err, &nfErr)
	if err != nil && !isNew {
		return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if isNew {
		owned, countErr := a.Srv().Store().Role().GetPluginRoleOwnershipsByPlugin(pluginID)
		if countErr != nil {
			return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(countErr)
		}
		if len(owned) >= model.MaxPluginRolesPerPlugin {
			return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.limit.app_error", nil, "", http.StatusBadRequest)
		}
	}

	permissions, appErr := a.namespacePluginRolePermissions(pluginID, pluginRole.Permissions)
	if appErr != nil {
		return nil, appErr
	}

	roleName := model.PluginRoleName(pluginID, pluginRole.Name)
	if existingOwnership != nil {
		roleName = existingOwnership.RoleName
	}

	displayName := model.PluginRoleNameI18nKey(roleName)
	description := model.PluginRoleDescriptionI18nKey(roleName)
	if pluginRole.DisplayName != "" {
		displayName = pluginRole.DisplayName
	}
	if pluginRole.Description != "" {
		description = pluginRole.Description
	}

	existingRole, getErr := a.GetRoleByName(rctx, roleName)
	if getErr != nil && getErr.StatusCode != http.StatusNotFound {
		return nil, getErr
	}

	if existingRole != nil {
		existingRole.DeleteAt = 0
		existingRole.DisplayName = displayName
		existingRole.Description = description
		if isNew {
			existingRole.Permissions = permissions
		}
		updated, updateErr := a.UpdateRole(existingRole)
		if updateErr != nil {
			return nil, updateErr
		}
		if err := a.Srv().Store().Role().SavePluginRoleOwnership(&model.PluginRoleOwnership{
			PluginId:  pluginID,
			LocalName: pluginRole.Name,
			RoleName:  roleName,
		}); err != nil {
			return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return updated, nil
	}

	created, createErr := a.CreateRole(&model.Role{
		Name:        roleName,
		DisplayName: displayName,
		Description: description,
		Permissions: permissions,
	})
	if createErr != nil {
		return nil, createErr
	}
	if err := a.Srv().Store().Role().SavePluginRoleOwnership(&model.PluginRoleOwnership{
		PluginId:  pluginID,
		LocalName: pluginRole.Name,
		RoleName:  roleName,
	}); err != nil {
		return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return created, nil
}

func (a *App) namespacePluginRolePermissions(pluginID string, permissions []string) ([]string, *model.AppError) {
	out := make([]string, 0, len(permissions))
	for _, p := range permissions {
		namespaced := p
		if owner, _, ok := model.SplitPluginPermissionId(p); ok {
			if owner != pluginID {
				return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.invalid.app_error", nil, "permission does not belong to this plugin", http.StatusBadRequest)
			}
		} else {
			if !model.IsValidPluginPermissionLocalID(p) {
				return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.invalid.app_error", nil, "invalid permission "+p, http.StatusBadRequest)
			}
			namespaced = model.PluginPermissionId(pluginID, p)
		}
		if !model.IsRegisteredPluginPermission(namespaced) {
			return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.invalid.app_error", nil, "unknown plugin permission "+p, http.StatusBadRequest)
		}
		registered := model.GetRegisteredPluginPermission(namespaced)
		if registered == nil || registered.PluginId != pluginID {
			return nil, model.NewAppError("RegisterPluginRole", "app.plugin.role.invalid.app_error", nil, "permission does not belong to this plugin", http.StatusBadRequest)
		}
		out = append(out, namespaced)
	}
	return out, nil
}

func (a *App) PatchPluginRole(rctx request.CTX, pluginID, localName string, patch *model.RolePatch) (*model.Role, *model.AppError) {
	ownership, err := a.Srv().Store().Role().GetPluginRoleOwnership(pluginID, localName)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("PatchPluginRole", "app.plugin.role.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("PatchPluginRole", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	role, appErr := a.GetRoleByName(rctx, ownership.RoleName)
	if appErr != nil {
		return nil, appErr
	}
	if patch != nil && patch.Permissions != nil {
		namespaced, nsErr := a.namespacePluginRolePermissions(pluginID, *patch.Permissions)
		if nsErr != nil {
			return nil, nsErr
		}
		patch.Permissions = &namespaced
	}
	return a.PatchRole(role, patch)
}

func (a *App) AssignPluginRole(rctx request.CTX, pluginID, userID, localName string) (*model.User, *model.AppError) {
	ownership, err := a.Srv().Store().Role().GetPluginRoleOwnership(pluginID, localName)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("AssignPluginRole", "app.plugin.role.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("AssignPluginRole", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return nil, appErr
	}
	roles := user.GetRoles()
	if slices.Contains(roles, ownership.RoleName) {
		return user, nil
	}
	roles = append(roles, ownership.RoleName)
	return a.UpdateUserRolesWithUser(rctx, user, strings.Join(roles, " "), true)
}

func (a *App) RemovePluginRole(rctx request.CTX, pluginID, userID, localName string) (*model.User, *model.AppError) {
	ownership, err := a.Srv().Store().Role().GetPluginRoleOwnership(pluginID, localName)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("RemovePluginRole", "app.plugin.role.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("RemovePluginRole", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return nil, appErr
	}
	roles := user.GetRoles()
	filtered := make([]string, 0, len(roles))
	for _, role := range roles {
		if role != ownership.RoleName {
			filtered = append(filtered, role)
		}
	}
	if len(filtered) == len(roles) {
		return user, nil
	}
	return a.UpdateUserRolesWithUser(rctx, user, strings.Join(filtered, " "), true)
}

func (a *App) PurgePluginRBAC(rctx request.CTX, pluginID string) *model.AppError {
	permissions, err := a.Srv().Store().Role().GetPluginPermissionsByPlugin(pluginID)
	if err != nil {
		return model.NewAppError("PurgePluginRBAC", "app.plugin.permission.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	permissionIDs := make([]string, 0, len(permissions))
	for _, p := range permissions {
		permissionIDs = append(permissionIDs, p.PermissionId)
	}

	if len(permissionIDs) > 0 {
		if appErr := a.stripPermissionsFromAllRoles(permissionIDs); appErr != nil {
			return appErr
		}
	}

	ownerships, err := a.Srv().Store().Role().GetPluginRoleOwnershipsByPlugin(pluginID)
	if err != nil {
		return model.NewAppError("PurgePluginRBAC", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, ownership := range ownerships {
		role, getErr := a.GetRoleByName(rctx, ownership.RoleName)
		if getErr != nil {
			if getErr.StatusCode == http.StatusNotFound {
				continue
			}
			return getErr
		}
		if _, delErr := a.DeleteRole(role.Id); delErr != nil {
			return delErr
		}
	}

	if err := a.Srv().Store().Role().DeletePluginRoleOwnerships(pluginID); err != nil {
		return model.NewAppError("PurgePluginRBAC", "app.plugin.role.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := a.Srv().Store().Role().DeletePluginPermissions(pluginID); err != nil {
		return model.NewAppError("PurgePluginRBAC", "app.plugin.permission.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	model.UnregisterPluginPermissionsInMemory(pluginID)
	return nil
}

func (a *App) stripPermissionsFromAllRoles(permissionIDs []string) *model.AppError {
	remove := make(map[string]bool, len(permissionIDs))
	for _, id := range permissionIDs {
		remove[id] = true
	}
	roles, appErr := a.GetAllRoles()
	if appErr != nil {
		return appErr
	}
	for _, role := range roles {
		filtered := make([]string, 0, len(role.Permissions))
		changed := false
		for _, p := range role.Permissions {
			if remove[p] {
				changed = true
				continue
			}
			filtered = append(filtered, p)
		}
		if !changed {
			continue
		}
		role.Permissions = filtered
		updated, updateErr := a.UpdateRole(role)
		if updateErr != nil {
			return updateErr
		}
		if sendErr := a.sendUpdatedRoleEvent(updated); sendErr != nil {
			return sendErr
		}
	}
	return nil
}

func (ch *Channels) setPluginPermissionsActive(pluginID string, active bool) *model.AppError {
	return New(ServerConnector(ch)).SetPluginPermissionsActive(pluginID, active)
}

func (ch *Channels) purgePluginRBAC(pluginID string) *model.AppError {
	return New(ServerConnector(ch)).PurgePluginRBAC(request.EmptyContext(ch.srv.Log()), pluginID)
}
