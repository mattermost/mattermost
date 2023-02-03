// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"reflect"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const EmojisPermissionsMigrationKey = "EmojisPermissionsMigrationComplete"
const GuestRolesCreationMigrationKey = "GuestRolesCreationMigrationComplete"
const SystemConsoleRolesCreationMigrationKey = "SystemConsoleRolesCreationMigrationComplete"
const CustomGroupAdminRoleCreationMigrationKey = "CustomGroupAdminRoleCreationMigrationComplete"
const ContentExtractionConfigDefaultTrueMigrationKey = "ContentExtractionConfigDefaultTrueMigrationComplete"
const PlaybookRolesCreationMigrationKey = "PlaybookRolesCreationMigrationComplete"
const FirstAdminSetupCompleteKey = model.SystemFirstAdminSetupComplete
const remainingSchemaMigrationsKey = "RemainingSchemaMigrations"
const PostPriorityConfigDefaultTrueMigrationKey = "PostPriorityConfigDefaultTrueMigrationComplete"

// This function migrates the default built in roles from code/config to the database.
func (a *App) DoAdvancedPermissionsMigration() {
	a.Srv().doAdvancedPermissionsMigration()
}

func (s *Server) doAdvancedPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(model.AdvancedPermissionsMigrationKey); err == nil {
		return
	}

	mlog.Info("Migrating roles to database.")
	roles := model.MakeDefaultRoles()

	allSucceeded := true

	for _, role := range roles {
		_, err := s.Store().Role().Save(role)
		if err == nil {
			continue
		}

		// If this failed for reasons other than the role already existing, don't mark the migration as done.
		fetchedRole, err := s.Store().Role().GetByName(context.Background(), role.Name)
		if err != nil {
			mlog.Fatal("Failed to migrate role to database.", mlog.Err(err))
			allSucceeded = false
			continue
		}

		// If the role already existed, check it is the same and update if not.
		if !reflect.DeepEqual(fetchedRole.Permissions, role.Permissions) ||
			fetchedRole.DisplayName != role.DisplayName ||
			fetchedRole.Description != role.Description ||
			fetchedRole.SchemeManaged != role.SchemeManaged {
			role.Id = fetchedRole.Id
			if _, err = s.Store().Role().Save(role); err != nil {
				// Role is not the same, but failed to update.
				mlog.Fatal("Failed to migrate role to database.", mlog.Err(err))
				allSucceeded = false
			}
		}
	}

	if !allSucceeded {
		return
	}

	config := s.platform.Config()
	*config.ServiceSettings.PostEditTimeLimit = -1
	if _, _, err := s.platform.SaveConfig(config, true); err != nil {
		mlog.Error("Failed to update config in Advanced Permissions Phase 1 Migration.", mlog.Err(err))
	}

	system := model.System{
		Name:  model.AdvancedPermissionsMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark advanced permissions migration as completed.", mlog.Err(err))
	}
}

func (a *App) SetPhase2PermissionsMigrationStatus(isComplete bool) error {
	if !isComplete {
		if _, err := a.Srv().Store().System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2); err != nil {
			return err
		}
	}
	a.Srv().phase2PermissionsMigrationComplete = isComplete
	return nil
}

func (a *App) DoEmojisPermissionsMigration() {
	a.Srv().doEmojisPermissionsMigration()
}

func (s *Server) doEmojisPermissionsMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(EmojisPermissionsMigrationKey); err == nil {
		return
	}

	var role *model.Role
	var systemAdminRole *model.Role
	var err *model.AppError

	mlog.Info("Migrating emojis config to database.")

	// Emoji creation is set to all by default
	role, err = s.GetRoleByName(context.Background(), model.SystemUserRoleId)
	if err != nil {
		mlog.Fatal("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(err))
		return
	}

	if role != nil {
		role.Permissions = append(role.Permissions, model.PermissionCreateEmojis.Id, model.PermissionDeleteEmojis.Id)
		if _, nErr := s.Store().Role().Save(role); nErr != nil {
			mlog.Fatal("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(nErr))
			return
		}
	}

	systemAdminRole, err = s.GetRoleByName(context.Background(), model.SystemAdminRoleId)
	if err != nil {
		mlog.Fatal("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(err))
		return
	}

	systemAdminRole.Permissions = append(systemAdminRole.Permissions,
		model.PermissionCreateEmojis.Id,
		model.PermissionDeleteEmojis.Id,
		model.PermissionDeleteOthersEmojis.Id,
	)
	if _, err := s.Store().Role().Save(systemAdminRole); err != nil {
		mlog.Fatal("Failed to migrate emojis creation permissions from mattermost config.", mlog.Err(err))
		return
	}

	system := model.System{
		Name:  EmojisPermissionsMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark emojis permissions migration as completed.", mlog.Err(err))
	}
}

func (a *App) DoGuestRolesCreationMigration() {
	a.Srv().doGuestRolesCreationMigration()
}

func (s *Server) doGuestRolesCreationMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(GuestRolesCreationMigrationKey); err == nil {
		return
	}

	roles := model.MakeDefaultRoles()

	allSucceeded := true
	if _, err := s.Store().Role().GetByName(context.Background(), model.ChannelGuestRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.ChannelGuestRoleId]); err != nil {
			mlog.Fatal("Failed to create new guest role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.TeamGuestRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.TeamGuestRoleId]); err != nil {
			mlog.Fatal("Failed to create new guest role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemGuestRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemGuestRoleId]); err != nil {
			mlog.Fatal("Failed to create new guest role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}

	schemes, err := s.Store().Scheme().GetAllPage("", 0, 1000000)
	if err != nil {
		mlog.Fatal("Failed to get all schemes.", mlog.Err(err))
		allSucceeded = false
	}
	for _, scheme := range schemes {
		if scheme.DefaultTeamGuestRole == "" || scheme.DefaultChannelGuestRole == "" {
			if scheme.Scope == model.SchemeScopeTeam {
				// Team Guest Role
				teamGuestRole := &model.Role{
					Name:          model.NewId(),
					DisplayName:   fmt.Sprintf("Team Guest Role for Scheme %s", scheme.Name),
					Permissions:   roles[model.TeamGuestRoleId].Permissions,
					SchemeManaged: true,
				}

				if savedRole, err := s.Store().Role().Save(teamGuestRole); err != nil {
					mlog.Fatal("Failed to create new guest role for custom scheme.", mlog.Err(err))
					allSucceeded = false
				} else {
					scheme.DefaultTeamGuestRole = savedRole.Name
				}
			}

			// Channel Guest Role
			channelGuestRole := &model.Role{
				Name:          model.NewId(),
				DisplayName:   fmt.Sprintf("Channel Guest Role for Scheme %s", scheme.Name),
				Permissions:   roles[model.ChannelGuestRoleId].Permissions,
				SchemeManaged: true,
			}

			if savedRole, err := s.Store().Role().Save(channelGuestRole); err != nil {
				mlog.Fatal("Failed to create new guest role for custom scheme.", mlog.Err(err))
				allSucceeded = false
			} else {
				scheme.DefaultChannelGuestRole = savedRole.Name
			}

			_, err := s.Store().Scheme().Save(scheme)
			if err != nil {
				mlog.Fatal("Failed to update custom scheme.", mlog.Err(err))
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

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark guest roles creation migration as completed.", mlog.Err(err))
	}
}

func (a *App) DoSystemConsoleRolesCreationMigration() {
	a.Srv().doSystemConsoleRolesCreationMigration()
}

func (s *Server) doSystemConsoleRolesCreationMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(SystemConsoleRolesCreationMigrationKey); err == nil {
		return
	}

	roles := model.MakeDefaultRoles()

	allSucceeded := true
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemManagerRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemManagerRoleId]); err != nil {
			mlog.Fatal("Failed to create new role.", mlog.Err(err), mlog.String("role", model.SystemManagerRoleId))
			allSucceeded = false
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemReadOnlyAdminRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemReadOnlyAdminRoleId]); err != nil {
			mlog.Fatal("Failed to create new role.", mlog.Err(err), mlog.String("role", model.SystemReadOnlyAdminRoleId))
			allSucceeded = false
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemUserManagerRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemUserManagerRoleId]); err != nil {
			mlog.Fatal("Failed to create new role.", mlog.Err(err), mlog.String("role", model.SystemUserManagerRoleId))
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

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark system console roles creation migration as completed.", mlog.Err(err))
	}
}

func (s *Server) doCustomGroupAdminRoleCreationMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(CustomGroupAdminRoleCreationMigrationKey); err == nil {
		return
	}

	roles := model.MakeDefaultRoles()

	allSucceeded := true
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemCustomGroupAdminRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemCustomGroupAdminRoleId]); err != nil {
			mlog.Fatal("Failed to create new role.", mlog.Err(err), mlog.String("role", model.SystemCustomGroupAdminRoleId))
			allSucceeded = false
		}
	}

	if !allSucceeded {
		return
	}

	system := model.System{
		Name:  CustomGroupAdminRoleCreationMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark custom group admin role creation migration as completed.", mlog.Err(err))
	}
}

func (s *Server) doContentExtractionConfigDefaultTrueMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(ContentExtractionConfigDefaultTrueMigrationKey); err == nil {
		return
	}

	s.platform.UpdateConfig(func(config *model.Config) {
		config.FileSettings.ExtractContent = model.NewBool(true)
	})

	system := model.System{
		Name:  ContentExtractionConfigDefaultTrueMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark content extraction config migration as completed.", mlog.Err(err))
	}
}

func (s *Server) doPlaybooksRolesCreationMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(PlaybookRolesCreationMigrationKey); err == nil {
		return
	}

	roles := model.MakeDefaultRoles()

	allSucceeded := true
	if _, err := s.Store().Role().GetByName(context.Background(), model.PlaybookAdminRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.PlaybookAdminRoleId]); err != nil {
			mlog.Fatal("Failed to create new playbook admin role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.PlaybookMemberRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.PlaybookMemberRoleId]); err != nil {
			mlog.Fatal("Failed to create new playbook member role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.RunAdminRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.RunAdminRoleId]); err != nil {
			mlog.Fatal("Failed to create new run admin role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.RunMemberRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.RunMemberRoleId]); err != nil {
			mlog.Fatal("Failed to create new run member role to database.", mlog.Err(err))
			allSucceeded = false
		}
	}
	schemes, err := s.Store().Scheme().GetAllPage(model.SchemeScopeTeam, 0, 1000000)
	if err != nil {
		mlog.Fatal("Failed to get all schemes.", mlog.Err(err))
		allSucceeded = false
	}

	for _, scheme := range schemes {
		if scheme.Scope == model.SchemeScopeTeam {
			if scheme.DefaultPlaybookAdminRole == "" {
				playbookAdminRole := &model.Role{
					Name:          model.NewId(),
					DisplayName:   fmt.Sprintf("Playbook Admin Role for Scheme %s", scheme.Name),
					Permissions:   roles[model.PlaybookAdminRoleId].Permissions,
					SchemeManaged: true,
				}

				if savedRole, err := s.Store().Role().Save(playbookAdminRole); err != nil {
					mlog.Fatal("Failed to create new playbook admin role for existing custom scheme.", mlog.Err(err))
					allSucceeded = false
				} else {
					scheme.DefaultPlaybookAdminRole = savedRole.Name
				}
			}
			if scheme.DefaultPlaybookMemberRole == "" {
				playbookMember := &model.Role{
					Name:          model.NewId(),
					DisplayName:   fmt.Sprintf("Playbook Member Role for Scheme %s", scheme.Name),
					Permissions:   roles[model.PlaybookMemberRoleId].Permissions,
					SchemeManaged: true,
				}

				if savedRole, err := s.Store().Role().Save(playbookMember); err != nil {
					mlog.Fatal("Failed to create new playbook member role for existing custom scheme.", mlog.Err(err))
					allSucceeded = false
				} else {
					scheme.DefaultPlaybookMemberRole = savedRole.Name
				}
			}

			if scheme.DefaultRunAdminRole == "" {
				runAdminRole := &model.Role{
					Name:          model.NewId(),
					DisplayName:   fmt.Sprintf("Run Admin Role for Scheme %s", scheme.Name),
					Permissions:   roles[model.RunAdminRoleId].Permissions,
					SchemeManaged: true,
				}

				if savedRole, err := s.Store().Role().Save(runAdminRole); err != nil {
					mlog.Fatal("Failed to create new run admin role for existing custom scheme.", mlog.Err(err))
					allSucceeded = false
				} else {
					scheme.DefaultRunAdminRole = savedRole.Name
				}
			}

			if scheme.DefaultRunMemberRole == "" {
				runMemberRole := &model.Role{
					Name:          model.NewId(),
					DisplayName:   fmt.Sprintf("Run Member Role for Scheme %s", scheme.Name),
					Permissions:   roles[model.RunMemberRoleId].Permissions,
					SchemeManaged: true,
				}

				if savedRole, err := s.Store().Role().Save(runMemberRole); err != nil {
					mlog.Fatal("Failed to create new run member role for existing custom scheme.", mlog.Err(err))
					allSucceeded = false
				} else {
					scheme.DefaultRunMemberRole = savedRole.Name
				}
			}
			_, err := s.Store().Scheme().Save(scheme)
			if err != nil {
				mlog.Fatal("Failed to update custom scheme.", mlog.Err(err))
				allSucceeded = false
			}
		}
	}

	if !allSucceeded {
		return
	}

	system := model.System{
		Name:  PlaybookRolesCreationMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark playbook roles creation migration as completed.", mlog.Err(err))
	}

}

// arbitrary choice, though if there is an longstanding installation with less than 10 messages,
// putting the first admin through onboarding shouldn't be very disruptive.
const existingInstallationPostsThreshold = 10

func (s *Server) doFirstAdminSetupCompleteMigration() {
	// Don't run the migration until the flag is turned on.

	if !s.platform.Config().FeatureFlags.UseCaseOnboarding {
		return
	}

	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(FirstAdminSetupCompleteKey); err == nil {
		return
	}

	teams, err := s.Store().Team().GetAll()
	if err != nil {
		// can not confirm that admin has started in this case.
		return
	}

	if len(teams) == 0 {
		// No teams, and no existing preference. This is most likely a new instance.
		// So do not mark that the admin has already done the first time setup.
		return
	}

	// if there are teams, then if this isn't a new installation, there should be posts
	postCount, err := s.Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
	if err != nil || postCount < existingInstallationPostsThreshold {
		return
	}

	system := model.System{
		Name:  FirstAdminSetupCompleteKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark first admin setup migration as completed.", mlog.Err(err))
	}
}

func (s *Server) doRemainingSchemaMigrations() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(remainingSchemaMigrationsKey); err == nil {
		return
	}

	if teams, err := s.Store().Team().GetByEmptyInviteID(); err != nil {
		mlog.Error("Error fetching Teams without InviteID", mlog.Err(err))
	} else {
		for _, team := range teams {
			team.InviteId = model.NewId()
			if _, err := s.Store().Team().Update(team); err != nil {
				mlog.Error("Error updating Team InviteIDs", mlog.String("team_id", team.Id), mlog.Err(err))
			}
		}
	}

	system := model.System{
		Name:  remainingSchemaMigrationsKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark the remaining schema migrations as completed.", mlog.Err(err))
	}
}

func (s *Server) doPostPriorityConfigDefaultTrueMigration() {
	// If the migration is already marked as completed, don't do it again.
	if _, err := s.Store().System().GetByName(PostPriorityConfigDefaultTrueMigrationKey); err == nil {
		return
	}

	s.platform.UpdateConfig(func(config *model.Config) {
		config.ServiceSettings.PostPriority = model.NewBool(true)
	})

	system := model.System{
		Name:  PostPriorityConfigDefaultTrueMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		mlog.Fatal("Failed to mark post priority config migration as completed.", mlog.Err(err))
	}
}

func (a *App) DoAppMigrations() {
	a.Srv().doAppMigrations()
}

func (s *Server) doAppMigrations() {
	s.doAdvancedPermissionsMigration()
	s.doEmojisPermissionsMigration()
	s.doGuestRolesCreationMigration()
	s.doSystemConsoleRolesCreationMigration()
	s.doCustomGroupAdminRoleCreationMigration()
	// This migration always must be the last, because can be based on previous
	// migrations. For example, it needs the guest roles migration.
	err := s.doPermissionsMigrations()
	if err != nil {
		mlog.Fatal("(app.App).DoPermissionsMigrations failed", mlog.Err(err))
	}
	s.doContentExtractionConfigDefaultTrueMigration()
	s.doPlaybooksRolesCreationMigration()
	s.doFirstAdminSetupCompleteMigration()
	s.doRemainingSchemaMigrations()
	s.doPostPriorityConfigDefaultTrueMigration()
}
