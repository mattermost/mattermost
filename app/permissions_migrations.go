// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/model"
)

type permissionTransformation struct {
	On     func(string, map[string]map[string]bool) bool
	Add    []string
	Remove []string
}
type permissionsMap []permissionTransformation

const (
	MIGRATION_KEY_APPLY_CHANNEL_MANAGE_DELETE_TO_CHANNEL_USER = "apply_channel_manage_delete_to_channel_user"
	MIGRATION_KEY_REMOVE_CHANNEL_MANAGE_DELETE_FROM_TEAM_USER = "remove_channel_manage_delete_from_team_user"

	PERMISSION_DELETE_PUBLIC_CHANNEL             = "delete_public_channel"
	PERMISSION_DELETE_PRIVATE_CHANNEL            = "delete_private_channel"
	PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES  = "manage_public_channel_properties"
	PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES = "manage_private_channel_properties"
)

func isRole(role string) func(string, map[string]map[string]bool) bool {
	return func(roleName string, permissionsMap map[string]map[string]bool) bool {
		return roleName == role
	}
}

func permissionExists(permission string) func(string, map[string]map[string]bool) bool {
	return func(roleName string, permissionsMap map[string]map[string]bool) bool {
		val, ok := permissionsMap[roleName][permission]
		return ok && val
	}
}

func permissionNotExists(permission string) func(string, map[string]map[string]bool) bool {
	return func(roleName string, permissionsMap map[string]map[string]bool) bool {
		val, ok := permissionsMap[roleName][permission]
		return !(ok && val)
	}
}

func onOtherRole(otherRole string, function func(string, map[string]map[string]bool) bool) func(string, map[string]map[string]bool) bool {
	return func(roleName string, permissionsMap map[string]map[string]bool) bool {
		return function(otherRole, permissionsMap)
	}
}

func permissionOr(funcs ...func(string, map[string]map[string]bool) bool) func(string, map[string]map[string]bool) bool {
	return func(roleName string, permissionsMap map[string]map[string]bool) bool {
		for _, f := range funcs {
			if f(roleName, permissionsMap) {
				return true
			}
		}
		return false
	}
}

func permissionAnd(funcs ...func(string, map[string]map[string]bool) bool) func(string, map[string]map[string]bool) bool {
	return func(roleName string, permissionsMap map[string]map[string]bool) bool {
		for _, f := range funcs {
			if !f(roleName, permissionsMap) {
				return false
			}
		}
		return true
	}
}

func applyPermissionsMap(roleName string, roleMap map[string]map[string]bool, migrationMap permissionsMap) []string {
	var result []string

	for _, transformation := range migrationMap {
		if transformation.On(roleName, roleMap) {
			for _, permission := range transformation.Add {
				roleMap[roleName][permission] = true
			}
			for _, permission := range transformation.Remove {
				roleMap[roleName][permission] = false
			}
		}
	}

	for key, active := range roleMap[roleName] {
		if active {
			result = append(result, key)
		}
	}
	return result
}

func (a *App) doPermissionsMigration(key string, migrationMap permissionsMap) *model.AppError {
	if result := <-a.Srv.Store.System().GetByName(key); result.Err == nil {
		return nil
	}

	roles, err := a.GetAllRoles()
	if err != nil {
		return err
	}

	roleMap := make(map[string]map[string]bool)
	for _, role := range roles {
		roleMap[role.Name] = make(map[string]bool)
		for _, permission := range role.Permissions {
			roleMap[role.Name][permission] = true
		}
	}

	for _, role := range roles {
		role.Permissions = applyPermissionsMap(role.Name, roleMap, migrationMap)
		if result := <-a.Srv.Store.Role().Save(role); result.Err != nil {
			return result.Err
		}
	}

	if result := <-a.Srv.Store.System().Save(&model.System{Name: key, Value: "true"}); result.Err != nil {
		return result.Err
	}
	return nil
}

func applyChannelManageDeleteToChannelUser() permissionsMap {
	return permissionsMap{
		permissionTransformation{
			On:  permissionAnd(isRole(model.CHANNEL_USER_ROLE_ID), onOtherRole(model.TEAM_USER_ROLE_ID, permissionExists(PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES))),
			Add: []string{PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.CHANNEL_USER_ROLE_ID), onOtherRole(model.TEAM_USER_ROLE_ID, permissionExists(PERMISSION_DELETE_PRIVATE_CHANNEL))),
			Add: []string{PERMISSION_DELETE_PRIVATE_CHANNEL},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.CHANNEL_USER_ROLE_ID), onOtherRole(model.TEAM_USER_ROLE_ID, permissionExists(PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES))),
			Add: []string{PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.CHANNEL_USER_ROLE_ID), onOtherRole(model.TEAM_USER_ROLE_ID, permissionExists(PERMISSION_DELETE_PUBLIC_CHANNEL))),
			Add: []string{PERMISSION_DELETE_PUBLIC_CHANNEL},
		},
	}
}

func removeChannelManageDeleteFromTeamUser() permissionsMap {
	return permissionsMap{
		permissionTransformation{
			On:     permissionAnd(isRole(model.TEAM_USER_ROLE_ID), permissionExists(PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES)),
			Remove: []string{PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TEAM_USER_ROLE_ID), permissionExists(PERMISSION_DELETE_PRIVATE_CHANNEL)),
			Remove: []string{model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TEAM_USER_ROLE_ID), permissionExists(PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES)),
			Remove: []string{PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TEAM_USER_ROLE_ID), permissionExists(PERMISSION_DELETE_PUBLIC_CHANNEL)),
			Remove: []string{PERMISSION_DELETE_PUBLIC_CHANNEL},
		},
	}
}

// DoPermissionsMigrations execute all the permissions migrations need by the current version.
func (a *App) DoPermissionsMigrations() *model.AppError {
	PermissionsMigrations := []struct {
		Key       string
		Migration func() permissionsMap
	}{
		{Key: MIGRATION_KEY_APPLY_CHANNEL_MANAGE_DELETE_TO_CHANNEL_USER, Migration: applyChannelManageDeleteToChannelUser},
		{Key: MIGRATION_KEY_REMOVE_CHANNEL_MANAGE_DELETE_FROM_TEAM_USER, Migration: removeChannelManageDeleteFromTeamUser},
	}

	for _, migration := range PermissionsMigrations {
		if err := a.doPermissionsMigration(migration.Key, migration.Migration()); err != nil {
			return err
		}
	}
	return nil
}
