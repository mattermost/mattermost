// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"reflect"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const ADVANCED_PERMISSIONS_MIGRATION_KEY = "AdvancedPermissionsMigrationComplete"
const EMOJIS_PERMISSIONS_MIGRATION_KEY = "EmojisPermissionsMigrationComplete"

// This function migrates the default built in roles from code/config to the database.
func (a *App) DoAdvancedPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if result := <-a.Srv.Store.System().GetByName(ADVANCED_PERMISSIONS_MIGRATION_KEY); result.Err == nil {
		return
	}

	mlog.Info("Migrating roles to database.")
	roles := model.MakeDefaultRoles()
	roles = utils.SetRolePermissionsFromConfig(roles, a.Config(), a.License() != nil)

	allSucceeded := true

	for _, role := range roles {
		if result := <-a.Srv.Store.Role().Save(role); result.Err != nil {
			// If this failed for reasons other than the role already existing, don't mark the migration as done.
			if result2 := <-a.Srv.Store.Role().GetByName(role.Name); result2.Err != nil {
				mlog.Critical("Failed to migrate role to database.")
				mlog.Critical(fmt.Sprint(result.Err))
				allSucceeded = false
			} else {
				// If the role already existed, check it is the same and update if not.
				fetchedRole := result.Data.(*model.Role)
				if !reflect.DeepEqual(fetchedRole.Permissions, role.Permissions) ||
					fetchedRole.DisplayName != role.DisplayName ||
					fetchedRole.Description != role.Description ||
					fetchedRole.SchemeManaged != role.SchemeManaged {
					role.Id = fetchedRole.Id
					if result := <-a.Srv.Store.Role().Save(role); result.Err != nil {
						// Role is not the same, but failed to update.
						mlog.Critical("Failed to migrate role to database.")
						mlog.Critical(fmt.Sprint(result.Err))
						allSucceeded = false
					}
				}
			}
		}
	}

	if !allSucceeded {
		return
	}

	config := a.Config()
	if *config.ServiceSettings.DEPRECATED_DO_NOT_USE_AllowEditPost == model.ALLOW_EDIT_POST_ALWAYS {
		*config.ServiceSettings.PostEditTimeLimit = -1
		if err := a.SaveConfig(config, true); err != nil {
			mlog.Error("Failed to update config in Advanced Permissions Phase 1 Migration.", mlog.String("error", err.Error()))
		}
	}

	system := model.System{
		Name:  ADVANCED_PERMISSIONS_MIGRATION_KEY,
		Value: "true",
	}

	if result := <-a.Srv.Store.System().Save(&system); result.Err != nil {
		mlog.Critical("Failed to mark advanced permissions migration as completed.")
		mlog.Critical(fmt.Sprint(result.Err))
	}
}

func (a *App) SetPhase2PermissionsMigrationStatus(isComplete bool) error {
	if !isComplete {
		res := <-a.Srv.Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2)
		if res.Err != nil {
			return res.Err
		}
	}
	a.Srv.phase2PermissionsMigrationComplete = isComplete
	return nil
}

func (a *App) DoEmojisPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if result := <-a.Srv.Store.System().GetByName(EMOJIS_PERMISSIONS_MIGRATION_KEY); result.Err == nil {
		return
	}

	var role *model.Role = nil
	var systemAdminRole *model.Role = nil
	var err *model.AppError = nil

	mlog.Info("Migrating emojis config to database.")
	switch *a.Config().ServiceSettings.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation {
	case model.RESTRICT_EMOJI_CREATION_ALL:
		role, err = a.GetRoleByName(model.SYSTEM_USER_ROLE_ID)
		if err != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
			mlog.Critical(err.Error())
			return
		}
	case model.RESTRICT_EMOJI_CREATION_ADMIN:
		role, err = a.GetRoleByName(model.TEAM_ADMIN_ROLE_ID)
		if err != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
			mlog.Critical(err.Error())
			return
		}
	case model.RESTRICT_EMOJI_CREATION_SYSTEM_ADMIN:
		role = nil
	default:
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
		mlog.Critical("Invalid restrict emoji creation setting")
		return
	}

	if role != nil {
		role.Permissions = append(role.Permissions, model.PERMISSION_CREATE_EMOJIS.Id, model.PERMISSION_DELETE_EMOJIS.Id)
		if result := <-a.Srv.Store.Role().Save(role); result.Err != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
			mlog.Critical(result.Err.Error())
			return
		}
	}

	systemAdminRole, err = a.GetRoleByName(model.SYSTEM_ADMIN_ROLE_ID)
	if err != nil {
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
		mlog.Critical(err.Error())
		return
	}

	systemAdminRole.Permissions = append(systemAdminRole.Permissions, model.PERMISSION_CREATE_EMOJIS.Id, model.PERMISSION_DELETE_EMOJIS.Id)
	systemAdminRole.Permissions = append(systemAdminRole.Permissions, model.PERMISSION_DELETE_OTHERS_EMOJIS.Id)
	if result := <-a.Srv.Store.Role().Save(systemAdminRole); result.Err != nil {
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.")
		mlog.Critical(result.Err.Error())
		return
	}

	system := model.System{
		Name:  EMOJIS_PERMISSIONS_MIGRATION_KEY,
		Value: "true",
	}

	if result := <-a.Srv.Store.System().Save(&system); result.Err != nil {
		mlog.Critical("Failed to mark emojis permissions migration as completed.")
		mlog.Critical(fmt.Sprint(result.Err))
	}
}
