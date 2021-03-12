// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"reflect"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const EmojisPermissionsMigrationKey = "EmojisPermissionsMigrationComplete"
const GuestRolesCreationMigrationKey = "GuestRolesCreationMigrationComplete"
const SystemConsoleRolesCreationMigrationKey = "SystemConsoleRolesCreationMigrationComplete"
const ContentExtractionConfigMigrationKey = "ContentExtractionConfigMigrationComplete"
const usersLimitToAutoEnableContentExtraction = 500

// This function migrates the default built in roles from code/config to the database.
func (a *App) DoAdvancedPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := a.Srv().Store.System().GetByName(model.ADVANCED_PERMISSIONS_MIGRATION_KEY); err == nil {
		return
	}

	mlog.Info("Migrating roles to database.")
	roles := model.MakeDefaultRoles()
	roles = utils.SetRolePermissionsFromConfig(roles, a.Config(), a.Srv().License() != nil)

	allSucceeded := true

	for _, role := range roles {
		_, err := a.Srv().Store.Role().Save(role)
		if err == nil {
			continue
		}

		// If this failed for reasons other than the role already existing, don't mark the migration as done.
		fetchedRole, err := a.Srv().Store.Role().GetByName(role.Name)
		if err != nil {
			mlog.Critical("Failed to migrate role to database.", mlog.Err(err))
			allSucceeded = false
			continue
		}

		// If the role already existed, check it is the same and update if not.
		if !reflect.DeepEqual(fetchedRole.Permissions, role.Permissions) ||
			fetchedRole.DisplayName != role.DisplayName ||
			fetchedRole.Description != role.Description ||
			fetchedRole.SchemeManaged != role.SchemeManaged {
			role.Id = fetchedRole.Id
			if _, err = a.Srv().Store.Role().Save(role); err != nil {
				// Role is not the same, but failed to update.
				mlog.Critical("Failed to migrate role to database.", mlog.Err(err))
				allSucceeded = false
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
			mlog.Error("Failed to update config in Advanced Permissions Phase 1 Migration.", mlog.Err(err))
		}
	}

	system := model.System{
		Name:  model.ADVANCED_PERMISSIONS_MIGRATION_KEY,
		Value: "true",
	}

	if err := a.Srv().Store.System().Save(&system); err != nil {
		mlog.Critical("Failed to mark advanced permissions migration as completed.", mlog.Err(err))
	}
}

func (a *App) SetPhase2PermissionsMigrationStatus(isComplete bool) error {
	if !isComplete {
		if _, err := a.Srv().Store.System().PermanentDeleteByName(model.MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2); err != nil {
			return err
		}
	}
	a.Srv().phase2PermissionsMigrationComplete = isComplete
	return nil
}

func (a *App) DoEmojisPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := a.Srv().Store.System().GetByName(EmojisPermissionsMigrationKey); err == nil {
		return
	}

	var role *model.Role
	var systemAdminRole *model.Role
	var err *model.AppError

	mlog.Info("Migrating emojis config to database.")
	switch *a.Config().ServiceSettings.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation {
	case model.RESTRICT_EMOJI_CREATION_ALL:
		role, err = a.GetRoleByName(model.SYSTEM_USER_ROLE_ID)
		if err != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(err))
			return
		}
	case model.RESTRICT_EMOJI_CREATION_ADMIN:
		role, err = a.GetRoleByName(model.TEAM_ADMIN_ROLE_ID)
		if err != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(err))
			return
		}
	case model.RESTRICT_EMOJI_CREATION_SYSTEM_ADMIN:
		role = nil
	default:
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config. Invalid restrict emoji creation setting")
		return
	}

	if role != nil {
		role.Permissions = append(role.Permissions, model.PERMISSION_CREATE_EMOJIS.Id, model.PERMISSION_DELETE_EMOJIS.Id)
		if _, nErr := a.Srv().Store.Role().Save(role); nErr != nil {
			mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(nErr))
			return
		}
	}

	systemAdminRole, err = a.GetRoleByName(model.SYSTEM_ADMIN_ROLE_ID)
	if err != nil {
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(err))
		return
	}

	systemAdminRole.Permissions = append(systemAdminRole.Permissions,
		model.PERMISSION_CREATE_EMOJIS.Id,
		model.PERMISSION_DELETE_EMOJIS.Id,
		model.PERMISSION_DELETE_OTHERS_EMOJIS.Id,
	)
	if _, err := a.Srv().Store.Role().Save(systemAdminRole); err != nil {
		mlog.Critical("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(err))
		return
	}

	system := model.System{
		Name:  EmojisPermissionsMigrationKey,
		Value: "true",
	}

	if err := a.Srv().Store.System().Save(&system); err != nil {
		mlog.Critical("Failed to mark emojis permissions migration as completed.", mlog.Err(err))
	}
}

func (a *App) DoGuestRolesCreationMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := a.Srv().Store.System().GetByName(GuestRolesCreationMigrationKey); err == nil {
		return
	}

	roles := model.MakeDefaultRoles()

	allSucceeded := true
	if _, err := a.Srv().Store.Role().GetByName(model.CHANNEL_GUEST_ROLE_ID); err != nil {
		if _, err := a.Srv().Store.Role().Save(roles[model.CHANNEL_GUEST_ROLE_ID]); err != nil {
			mlog.Critical("Failed to create new guest role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}
	if _, err := a.Srv().Store.Role().GetByName(model.TEAM_GUEST_ROLE_ID); err != nil {
		if _, err := a.Srv().Store.Role().Save(roles[model.TEAM_GUEST_ROLE_ID]); err != nil {
			mlog.Critical("Failed to create new guest role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}
	if _, err := a.Srv().Store.Role().GetByName(model.SYSTEM_GUEST_ROLE_ID); err != nil {
		if _, err := a.Srv().Store.Role().Save(roles[model.SYSTEM_GUEST_ROLE_ID]); err != nil {
			mlog.Critical("Failed to create new guest role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}

	schemes, err := a.Srv().Store.Scheme().GetAllPage("", 0, 1000000)
	if err != nil {
		mlog.Critical("Failed to get all schemes.", mlog.Err(err))
		allSucceeded = false
	}
	for _, scheme := range schemes {
		if scheme.DefaultTeamGuestRole == "" || scheme.DefaultChannelGuestRole == "" {
			// Team Guest Role
			teamGuestRole := &model.Role{
				Name:          model.NewId(),
				DisplayName:   fmt.Sprintf("Team Guest Role for Scheme %s", scheme.Name),
				Permissions:   roles[model.TEAM_GUEST_ROLE_ID].Permissions,
				SchemeManaged: true,
			}

			if savedRole, err := a.Srv().Store.Role().Save(teamGuestRole); err != nil {
				mlog.Critical("Failed to create new guest role for custom scheme.", mlog.Err(err))
				allSucceeded = false
			} else {
				scheme.DefaultTeamGuestRole = savedRole.Name
			}

			// Channel Guest Role
			channelGuestRole := &model.Role{
				Name:          model.NewId(),
				DisplayName:   fmt.Sprintf("Channel Guest Role for Scheme %s", scheme.Name),
				Permissions:   roles[model.CHANNEL_GUEST_ROLE_ID].Permissions,
				SchemeManaged: true,
			}

			if savedRole, err := a.Srv().Store.Role().Save(channelGuestRole); err != nil {
				mlog.Critical("Failed to create new guest role for custom scheme.", mlog.Err(err))
				allSucceeded = false
			} else {
				scheme.DefaultChannelGuestRole = savedRole.Name
			}

			_, err := a.Srv().Store.Scheme().Save(scheme)
			if err != nil {
				mlog.Critical("Failed to update custom scheme.", mlog.Err(err))
				allSucceeded = false
			}
		}
	}

	if !allSucceeded {
		return
	}

	system := model.System{
		Name:  GuestRolesCreationMigrationKey,
		Value: "true",
	}

	if err := a.Srv().Store.System().Save(&system); err != nil {
		mlog.Critical("Failed to mark guest roles creation migration as completed.", mlog.Err(err))
	}
}

func (a *App) DoSystemConsoleRolesCreationMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := a.Srv().Store.System().GetByName(SystemConsoleRolesCreationMigrationKey); err == nil {
		return
	}

	roles := model.MakeDefaultRoles()

	allSucceeded := true
	if _, err := a.Srv().Store.Role().GetByName(model.SYSTEM_MANAGER_ROLE_ID); err != nil {
		if _, err := a.Srv().Store.Role().Save(roles[model.SYSTEM_MANAGER_ROLE_ID]); err != nil {
			mlog.Critical("Failed to create new role.", mlog.Err(err), mlog.String("role", model.SYSTEM_MANAGER_ROLE_ID))
			allSucceeded = false
		}
	}
	if _, err := a.Srv().Store.Role().GetByName(model.SYSTEM_READ_ONLY_ADMIN_ROLE_ID); err != nil {
		if _, err := a.Srv().Store.Role().Save(roles[model.SYSTEM_READ_ONLY_ADMIN_ROLE_ID]); err != nil {
			mlog.Critical("Failed to create new role.", mlog.Err(err), mlog.String("role", model.SYSTEM_READ_ONLY_ADMIN_ROLE_ID))
			allSucceeded = false
		}
	}
	if _, err := a.Srv().Store.Role().GetByName(model.SYSTEM_USER_MANAGER_ROLE_ID); err != nil {
		if _, err := a.Srv().Store.Role().Save(roles[model.SYSTEM_USER_MANAGER_ROLE_ID]); err != nil {
			mlog.Critical("Failed to create new role.", mlog.Err(err), mlog.String("role", model.SYSTEM_USER_MANAGER_ROLE_ID))
			allSucceeded = false
		}
	}

	if !allSucceeded {
		return
	}

	system := model.System{
		Name:  SystemConsoleRolesCreationMigrationKey,
		Value: "true",
	}

	if err := a.Srv().Store.System().Save(&system); err != nil {
		mlog.Critical("Failed to mark system console roles creation migration as completed.", mlog.Err(err))
	}
}

func (a *App) doContentExtractionConfigMigration() {
	if !a.Config().FeatureFlags.FilesSearch {
		return
	}
	// If the migration is already marked as completed, don't do it again.
	if _, err := a.Srv().Store.System().GetByName(ContentExtractionConfigMigrationKey); err == nil {
		return
	}

	if usersCount, err := a.Srv().Store.User().Count(model.UserCountOptions{}); err != nil {
		mlog.Critical("Failed to get the users count for migrating the content extraction, using default value", mlog.Err(err))
	} else {
		if usersCount < usersLimitToAutoEnableContentExtraction {
			a.UpdateConfig(func(config *model.Config) {
				config.FileSettings.ExtractContent = model.NewBool(true)
			})
		}
	}

	system := model.System{
		Name:  ContentExtractionConfigMigrationKey,
		Value: "true",
	}

	if err := a.Srv().Store.System().Save(&system); err != nil {
		mlog.Critical("Failed to mark content extraction config migration as completed.", mlog.Err(err))
	}
}

func (a *App) DoAppMigrations() {
	a.DoAdvancedPermissionsMigration()
	a.DoEmojisPermissionsMigration()
	a.DoGuestRolesCreationMigration()
	a.DoSystemConsoleRolesCreationMigration()
	// This migration always must be the last, because can be based on previous
	// migrations. For example, it needs the guest roles migration.
	err := a.DoPermissionsMigrations()
	if err != nil {
		mlog.Critical("(app.App).DoPermissionsMigrations failed", mlog.Err(err))
	}
	a.doContentExtractionConfigMigration()
}
