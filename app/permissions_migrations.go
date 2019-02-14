// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import "github.com/mattermost/mattermost-server/model"

type permissionTransformation struct {
	On     func(map[string]bool) bool
	Add    []string
	Remove []string
}
type permissionsMap []permissionTransformation

const (
	MIGRATION_KEY_EMOJI_PERMISSIONS_SPLIT   = "emoji_permissions_split"
	MIGRATION_KEY_WEBHOOK_PERMISSIONS_SPLIT = "webhook_permissions_split"

	PERMISSION_MANAGE_EMOJIS                   = "manage_emojis"
	PERMISSION_MANAGE_OTHERS_EMOJIS            = "manage_others_emojis"
	PERMISSION_CREATE_EMOJIS                   = "create_emojis"
	PERMISSION_DELETE_EMOJIS                   = "delete_emojis"
	PERMISSION_DELETE_OTHERS_EMOJIS            = "delete_others_emojis"
	PERMISSION_MANAGE_WEBHOOKS                 = "manage_webhooks"
	PERMISSION_MANAGE_OTHERS_WEBHOOKS          = "manage_others_webhooks"
	PERMISSION_MANAGE_INCOMING_WEBHOOKS        = "manage_incoming_webhooks"
	PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS = "manage_others_incoming_webhooks"
	PERMISSION_MANAGE_OUTGOING_WEBHOOKS        = "manage_outgoing_webhooks"
	PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS = "manage_others_outgoing_webhooks"
)

func permissionExists(permission string) func(map[string]bool) bool {
	return func(permissions map[string]bool) bool {
		val, ok := permissions[permission]
		return ok && val
	}
}

func permissionNotExists(permission string) func(map[string]bool) bool {
	return func(permissions map[string]bool) bool {
		val, ok := permissions[permission]
		return !(ok && val)
	}
}

func permissionOr(funcs ...func(map[string]bool) bool) func(map[string]bool) bool {
	return func(permissions map[string]bool) bool {
		for _, f := range funcs {
			if f(permissions) {
				return true
			}
		}
		return false
	}
}

func permissionAnd(funcs ...func(map[string]bool) bool) func(map[string]bool) bool {
	return func(permissions map[string]bool) bool {
		for _, f := range funcs {
			if !f(permissions) {
				return false
			}
		}
		return true
	}
}

func applyPermissionsMap(permissions []string, migrationMap permissionsMap) []string {
	finalMap := make(map[string]bool)
	var result []string
	for _, permission := range permissions {
		finalMap[permission] = true
	}

	for _, transformation := range migrationMap {
		if transformation.On(finalMap) {
			for _, add := range transformation.Add {
				finalMap[add] = true
			}
			for _, remove := range transformation.Remove {
				finalMap[remove] = false
			}
		}
	}

	for key, active := range finalMap {
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

	for _, role := range roles {
		role.Permissions = applyPermissionsMap(role.Permissions, migrationMap)
		if result := <-a.Srv.Store.Role().Save(role); result.Err != nil {
			return result.Err
		}
	}

	if result := <-a.Srv.Store.System().Save(&model.System{Name: key, Value: "true"}); result.Err != nil {
		return result.Err
	}
	return nil
}

func getEmojisPermissionsSplitMigration() permissionsMap {
	return permissionsMap{
		permissionTransformation{
			On:     permissionExists(PERMISSION_MANAGE_EMOJIS),
			Add:    []string{PERMISSION_CREATE_EMOJIS, PERMISSION_DELETE_EMOJIS},
			Remove: []string{PERMISSION_MANAGE_EMOJIS},
		},
		permissionTransformation{
			On:     permissionExists(PERMISSION_MANAGE_OTHERS_EMOJIS),
			Add:    []string{PERMISSION_DELETE_OTHERS_EMOJIS},
			Remove: []string{PERMISSION_MANAGE_OTHERS_EMOJIS},
		},
	}
}

func getWebhooksPermissionsSplitMigration() permissionsMap {
	return permissionsMap{
		permissionTransformation{
			On:     permissionExists(PERMISSION_MANAGE_WEBHOOKS),
			Add:    []string{PERMISSION_MANAGE_INCOMING_WEBHOOKS, PERMISSION_MANAGE_OUTGOING_WEBHOOKS},
			Remove: []string{PERMISSION_MANAGE_WEBHOOKS},
		},
		permissionTransformation{
			On:     permissionExists(PERMISSION_MANAGE_OTHERS_WEBHOOKS),
			Add:    []string{PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS, PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS},
			Remove: []string{PERMISSION_MANAGE_OTHERS_WEBHOOKS},
		},
	}
}

// DoPermissionsMigrations execute all the permissions migrations need by the current version.
func (a *App) DoPermissionsMigrations() *model.AppError {
	PermissionsMigrations := []struct {
		Key       string
		Migration func() permissionsMap
	}{
		{Key: MIGRATION_KEY_EMOJI_PERMISSIONS_SPLIT, Migration: getEmojisPermissionsSplitMigration},
		{Key: MIGRATION_KEY_WEBHOOK_PERMISSIONS_SPLIT, Migration: getWebhooksPermissionsSplitMigration},
	}

	for _, migration := range PermissionsMigrations {
		if err := a.doPermissionsMigration(migration.Key, migration.Migration()); err != nil {
			return err
		}
	}
	return nil
}
