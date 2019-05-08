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
const GUEST_ROLES_CREATION_MIGRATION_KEY = "GuestRolesCreationMigrationComplete"

// This function migrates the default built in roles from code/config to the database.
func (a *App) DoAdvancedPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := a.Srv.Store.System().GetByName(ADVANCED_PERMISSIONS_MIGRATION_KEY); err == nil {
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

	if err := a.Srv.Store.System().Save(&system); err != nil {
		mlog.Critical("Failed to mark advanced permissions migration as completed.")
		mlog.Critical(fmt.Sprint(err))
	}
}

func (a *App) SetPhase2PermissionsMigrationStatus(isComplete bool) error {
	if !isComplete {
		if _, err := a.Srv.Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2); err != nil {
			return err
		}
	}
	a.Srv.phase2PermissionsMigrationComplete = isComplete
	return nil
}

func (a *App) DoEmojisPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := a.Srv.Store.System().GetByName(EMOJIS_PERMISSIONS_MIGRATION_KEY); err == nil {
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

	if err := a.Srv.Store.System().Save(&system); err != nil {
		mlog.Critical("Failed to mark emojis permissions migration as completed.")
		mlog.Critical(fmt.Sprint(err))
	}
}

func (a *App) DoGuestRolesCreationMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := a.Srv.Store.System().GetByName(GUEST_ROLES_CREATION_MIGRATION_KEY); err == nil {
		return
	}

	roles := model.MakeDefaultRoles()

	allSucceeded := true
	if result := <-a.Srv.Store.Role().GetByName(model.CHANNEL_GUEST_ROLE_ID); result.Err != nil {
		if result := <-a.Srv.Store.Role().Save(roles[model.CHANNEL_GUEST_ROLE_ID]); result.Err != nil {
			mlog.Critical("Failed to create new guest role to database.")
			mlog.Critical(fmt.Sprint(result.Err))
			allSucceeded = false
		}
	}
	if result := <-a.Srv.Store.Role().GetByName(model.TEAM_GUEST_ROLE_ID); result.Err != nil {
		if result := <-a.Srv.Store.Role().Save(roles[model.TEAM_GUEST_ROLE_ID]); result.Err != nil {
			mlog.Critical("Failed to create new guest role to database.")
			mlog.Critical(fmt.Sprint(result.Err))
			allSucceeded = false
		}
	}
	if result := <-a.Srv.Store.Role().GetByName(model.SYSTEM_GUEST_ROLE_ID); result.Err != nil {
		if result := <-a.Srv.Store.Role().Save(roles[model.SYSTEM_GUEST_ROLE_ID]); result.Err != nil {
			mlog.Critical("Failed to create new guest role to database.")
			mlog.Critical(fmt.Sprint(result.Err))
			allSucceeded = false
		}
	}

	resultSchemes := <-a.Srv.Store.Scheme().GetAllPage("", 0, 1000000)
	if resultSchemes.Err != nil {
		mlog.Critical("Failed to get all schemes.")
		mlog.Critical(fmt.Sprint(resultSchemes.Err))
		allSucceeded = false
	}
	schemes := resultSchemes.Data.([]*model.Scheme)
	for _, scheme := range schemes {
		if scheme.DefaultTeamGuestRole == "" || scheme.DefaultChannelGuestRole == "" {
			// Team Guest Role
			teamGuestRole := &model.Role{
				Name:          model.NewId(),
				DisplayName:   fmt.Sprintf("Team Guest Role for Scheme %s", scheme.Name),
				Permissions:   roles[model.TEAM_GUEST_ROLE_ID].Permissions,
				SchemeManaged: true,
			}

			if saveRoleResult := <-a.Srv.Store.Role().Save(teamGuestRole); saveRoleResult.Err != nil {
				mlog.Critical("Failed to create new guest role for custom scheme.")
				mlog.Critical(fmt.Sprint(saveRoleResult.Err))
				allSucceeded = false
			} else {
				scheme.DefaultTeamGuestRole = saveRoleResult.Data.(*model.Role).Name
			}

			// Channel Guest Role
			channelGuestRole := &model.Role{
				Name:          model.NewId(),
				DisplayName:   fmt.Sprintf("Channel Guest Role for Scheme %s", scheme.Name),
				Permissions:   roles[model.CHANNEL_GUEST_ROLE_ID].Permissions,
				SchemeManaged: true,
			}

			if saveRoleResult := <-a.Srv.Store.Role().Save(channelGuestRole); saveRoleResult.Err != nil {
				mlog.Critical("Failed to create new guest role for custom scheme.")
				mlog.Critical(fmt.Sprint(saveRoleResult.Err))
				allSucceeded = false
			} else {
				scheme.DefaultChannelGuestRole = saveRoleResult.Data.(*model.Role).Name
			}

			result := <-a.Srv.Store.Scheme().Save(scheme)
			if result.Err != nil {
				mlog.Critical("Failed to update custom scheme.")
				mlog.Critical(fmt.Sprint(result.Err))
				allSucceeded = false
			}
		}
	}

	if !allSucceeded {
		return
	}

	system := model.System{
		Name:  GUEST_ROLES_CREATION_MIGRATION_KEY,
		Value: "true",
	}

	if err := a.Srv.Store.System().Save(&system); err != nil {
		mlog.Critical("Failed to mark guest roles creation migration as completed.")
		mlog.Critical(fmt.Sprint(err))
	}
}

func (a *App) DoAppMigrations() {
	a.DoAdvancedPermissionsMigration()
	a.DoEmojisPermissionsMigration()
	a.DoGuestRolesCreationMigration()
	// This migration always must be the last, because can be based on previous
	// migrations. For example, it needs the guest roles migration.
	a.DoPermissionsMigrations()
}
