// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const EmojisPermissionsMigrationKey = "EmojisPermissionsMigrationComplete"
const GuestRolesCreationMigrationKey = "GuestRolesCreationMigrationComplete"
const SystemConsoleRolesCreationMigrationKey = "SystemConsoleRolesCreationMigrationComplete"
const CustomGroupAdminRoleCreationMigrationKey = "CustomGroupAdminRoleCreationMigrationComplete"
const ContentExtractionConfigDefaultTrueMigrationKey = "ContentExtractionConfigDefaultTrueMigrationComplete"
const PlaybookRolesCreationMigrationKey = "PlaybookRolesCreationMigrationComplete"
const FirstAdminSetupCompleteKey = model.SystemFirstAdminSetupComplete
const remainingSchemaMigrationsKey = "RemainingSchemaMigrations"
const postPriorityConfigDefaultTrueMigrationKey = "PostPriorityConfigDefaultTrueMigrationComplete"

// This function migrates the default built in roles from code/config to the database.
func (a *App) DoAdvancedPermissionsMigration() error {
	return a.Srv().doAdvancedPermissionsMigration()
}

func (s *Server) doAdvancedPermissionsMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(model.AdvancedPermissionsMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	mlog.Info("Migrating roles to database.")
	roles := model.MakeDefaultRoles()

	var multiErr *multierror.Error
	for _, role := range roles {
		_, err := s.Store().Role().Save(role)
		if err == nil {
			continue
		}
		mlog.Info("Couldn't save the role for advanced permissions migration, this can be an expected case", mlog.Err(err))

		// If this failed for reasons other than the role already existing, don't mark the migration as done.
		fetchedRole, err := s.Store().Role().GetByName(context.Background(), role.Name)
		if err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to migrate role to database: %w", err))
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
				multiErr = multierror.Append(multiErr, fmt.Errorf("failed to migrate role to database: %w", err))
			}
		}
	}

	if multiErr != nil {
		return multiErr
	}

	config := s.platform.Config()
	*config.ServiceSettings.PostEditTimeLimit = -1
	if _, _, err := s.platform.SaveConfig(config, true); err != nil {
		return fmt.Errorf("failed to update config in Advanced Permissions Phase 1 Migration: %w", err)
	}

	system := model.System{
		Name:  model.AdvancedPermissionsMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark advanced permissions migration as completed: %w", err)
	}

	return nil
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

func (s *Server) doEmojisPermissionsMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(EmojisPermissionsMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	var role *model.Role
	var systemAdminRole *model.Role
	var err *model.AppError

	mlog.Info("Migrating emojis config to database.")

	// Emoji creation is set to all by default
	role, err = s.GetRoleByName(context.Background(), model.SystemUserRoleId)
	if err != nil {
		return fmt.Errorf("failed to get role for system user: %w", err)
	}

	if role != nil {
		role.Permissions = append(role.Permissions, model.PermissionCreateEmojis.Id, model.PermissionDeleteEmojis.Id)
		if _, nErr := s.Store().Role().Save(role); nErr != nil {
			return fmt.Errorf("failed to save role: %w", nErr)
		}
	}

	systemAdminRole, err = s.GetRoleByName(context.Background(), model.SystemAdminRoleId)
	if err != nil {
		return fmt.Errorf("failed to get role for system admin: %w", err)
	}

	systemAdminRole.Permissions = append(systemAdminRole.Permissions,
		model.PermissionCreateEmojis.Id,
		model.PermissionDeleteEmojis.Id,
		model.PermissionDeleteOthersEmojis.Id,
	)
	if _, err := s.Store().Role().Save(systemAdminRole); err != nil {
		return fmt.Errorf("failed to save role: %w", err)
	}

	system := model.System{
		Name:  EmojisPermissionsMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark emojis permissions migration as completed: %w", err)
	}

	return nil
}

func (a *App) DoGuestRolesCreationMigration() {
	a.Srv().doGuestRolesCreationMigration()
}

func (s *Server) doGuestRolesCreationMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(GuestRolesCreationMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	roles := model.MakeDefaultRoles()
	var multiErr *multierror.Error
	if _, err := s.Store().Role().GetByName(context.Background(), model.ChannelGuestRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.ChannelGuestRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new guest role to database: %w", err))
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.TeamGuestRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.TeamGuestRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new guest role to database: %w", err))
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemGuestRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemGuestRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new guest role to database: %w", err))
		}
	}

	schemes, err := s.Store().Scheme().GetAllPage("", 0, 1000000)
	if err != nil {
		multiErr = multierror.Append(multiErr, fmt.Errorf("failed to get all schemes: %w", err))
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
					multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new guest role for custom scheme: %w", err))
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
				multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new guest role for custom scheme: %w", err))
			} else {
				scheme.DefaultChannelGuestRole = savedRole.Name
			}

			_, err := s.Store().Scheme().Save(scheme)
			if err != nil {
				multiErr = multierror.Append(multiErr, fmt.Errorf("failed to update custom scheme: %w", err))
			}
		}
	}

	if multiErr != nil {
		return multiErr
	}

	system := model.System{
		Name:  GuestRolesCreationMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark guest roles creation migration as completed: %w", err)
	}

	return nil
}

func (a *App) DoSystemConsoleRolesCreationMigration() error {
	return a.Srv().doSystemConsoleRolesCreationMigration()
}

func (s *Server) doSystemConsoleRolesCreationMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(SystemConsoleRolesCreationMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	roles := model.MakeDefaultRoles()
	var multiErr *multierror.Error
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemManagerRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemManagerRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new role %q: %w", model.SystemManagerRoleId, err))
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemReadOnlyAdminRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemReadOnlyAdminRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new role %q: %w", model.SystemReadOnlyAdminRoleId, err))
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemUserManagerRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemUserManagerRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new role %q: %w", model.SystemUserManagerRoleId, err))
		}
	}

	if multiErr != nil {
		return multiErr
	}

	system := model.System{
		Name:  SystemConsoleRolesCreationMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark system console roles creation migration as completed: %w", err)
	}

	return nil
}

func (s *Server) doCustomGroupAdminRoleCreationMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(CustomGroupAdminRoleCreationMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	roles := model.MakeDefaultRoles()
	if _, err := s.Store().Role().GetByName(context.Background(), model.SystemCustomGroupAdminRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.SystemCustomGroupAdminRoleId]); err != nil {
			return fmt.Errorf("failed to create new role %s: %w", model.SystemCustomGroupAdminRoleId, err)
		}
	}

	system := model.System{
		Name:  CustomGroupAdminRoleCreationMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark custom group admin role creation migration as completed: %w", err)
	}

	return nil
}

func (s *Server) doContentExtractionConfigDefaultTrueMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(ContentExtractionConfigDefaultTrueMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	s.platform.UpdateConfig(func(config *model.Config) {
		config.FileSettings.ExtractContent = model.NewBool(true)
	})

	system := model.System{
		Name:  ContentExtractionConfigDefaultTrueMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark content extraction config migration as completed: %w", err)
	}

	return nil
}

func (s *Server) doPlaybooksRolesCreationMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(PlaybookRolesCreationMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	roles := model.MakeDefaultRoles()
	var multiErr *multierror.Error
	if _, err := s.Store().Role().GetByName(context.Background(), model.PlaybookAdminRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.PlaybookAdminRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new playbook %q role to database: %w", model.PlaybookAdminRoleId, err))
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.PlaybookMemberRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.PlaybookMemberRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new playbook %q role to database: %w", model.PlaybookMemberRoleId, err))
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.RunAdminRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.RunAdminRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("ffailed to create new playbook %q role to database: %w", model.RunAdminRoleId, err))
		}
	}
	if _, err := s.Store().Role().GetByName(context.Background(), model.RunMemberRoleId); err != nil {
		if _, err := s.Store().Role().Save(roles[model.RunMemberRoleId]); err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new playbook %q role to database: %w", model.RunMemberRoleId, err))
		}
	}
	schemes, err := s.Store().Scheme().GetAllPage(model.SchemeScopeTeam, 0, 1000000)
	if err != nil {
		multiErr = multierror.Append(multiErr, fmt.Errorf("failed to get all schemes: %w", err))
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
					multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new playbook %q role for existing custom scheme: %w", model.PlaybookAdminRoleId, err))
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
					multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new playbook %q role for existing custom scheme: %w", model.PlaybookMemberRoleId, err))
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
					multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new playbook %q role for existing custom scheme: %w", model.RunAdminRoleId, err))
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
					multiErr = multierror.Append(multiErr, fmt.Errorf("failed to create new playbook %q role for existing custom scheme: %w", model.RunMemberRoleId, err))
				} else {
					scheme.DefaultRunMemberRole = savedRole.Name
				}
			}
			_, err := s.Store().Scheme().Save(scheme)
			if err != nil {
				multiErr = multierror.Append(multiErr, fmt.Errorf("failed to update custom scheme: %w", err))
			}
		}
	}

	if multiErr != nil {
		return multiErr
	}

	system := model.System{
		Name:  PlaybookRolesCreationMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark playbook roles creation migration as completed: %w", err)
	}

	return nil
}

func (s *Server) doFirstAdminSetupCompleteMigration() error {
	// arbitrary choice, though if there is an longstanding installation with less than 10 messages,
	// putting the first admin through onboarding shouldn't be very disruptive.
	const existingInstallationPostsThreshold = 10

	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(FirstAdminSetupCompleteKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	teams, err := s.Store().Team().GetAll()
	if err != nil {
		// can not confirm that admin has started in this case.
		return fmt.Errorf("could not get teams: %w", err)
	}

	if len(teams) == 0 {
		// No teams, and no existing preference. This is most likely a new instance.
		// So do not mark that the admin has already done the first time setup.
		return nil
	}

	// if there are teams, then if this isn't a new installation, there should be posts
	postCount, err := s.Store().Post().AnalyticsPostCount(&model.PostCountOptions{})
	if err != nil {
		return fmt.Errorf("could not get posts count from the database: %w", err)
	} else if postCount < existingInstallationPostsThreshold {
		mlog.Info("Post count is lower than expected, aborting migration",
			mlog.Int("expected", int(existingInstallationPostsThreshold)),
			mlog.Int("actual", int(postCount)))
		return nil
	}

	system := model.System{
		Name:  FirstAdminSetupCompleteKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark first admin setup migration as completed: %w", err)
	}

	return nil
}

func (s *Server) doRemainingSchemaMigrations() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(remainingSchemaMigrationsKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	if teams, err := s.Store().Team().GetByEmptyInviteID(); err != nil {
		mlog.Error("Error fetching Teams without InviteID", mlog.Err(err))
	} else {
		for _, team := range teams {
			team.InviteId = model.NewId()
			if _, err := s.Store().Team().Update(team); err != nil {
				return fmt.Errorf("error updating Team InviteIDs %q: %w", team.Id, err)
			}
		}
	}

	system := model.System{
		Name:  remainingSchemaMigrationsKey,
		Value: "true",
	}

	if err := s.Store().System().Save(&system); err != nil {
		return fmt.Errorf("failed to mark the remaining schema migrations as completed: %w", err)
	}

	return nil
}

func (s *Server) doPostPriorityConfigDefaultTrueMigration() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(postPriorityConfigDefaultTrueMigrationKey); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	s.platform.UpdateConfig(func(config *model.Config) {
		config.ServiceSettings.PostPriority = model.NewBool(true)
	})

	system := model.System{
		Name:  postPriorityConfigDefaultTrueMigrationKey,
		Value: "true",
	}

	if err := s.Store().System().SaveOrUpdate(&system); err != nil {
		return fmt.Errorf("failed to mark post priority config migration as completed: %w", err)
	}

	return nil
}

func (s *Server) doElasticsearchFixChannelIndex() error {
	// If the migration is already marked as completed, don't do it again.
	var nfErr *store.ErrNotFound
	if _, err := s.Store().System().GetByName(model.MigrationKeyElasticsearchFixChannelIndex); err == nil {
		return nil
	} else if !errors.As(err, &nfErr) {
		return fmt.Errorf("could not query migration: %w", err)
	}

	license := s.License()
	if model.BuildEnterpriseReady != "true" || license == nil || !*license.Features.Elasticsearch {
		mlog.Info("Skipping triggering Elasticsearch channel index fix job as build is not Enterprise ready")
		return nil
	}

	if _, appErr := s.Jobs.CreateJob(model.JobTypeElasticsearchFixChannelIndex, nil); appErr != nil {
		return fmt.Errorf("failed to start job for fixing Elasticsearch channels index: %w", appErr)
	}

	return nil
}

func (a *App) DoAppMigrations() {
	a.Srv().doAppMigrations()
}

func (s *Server) doAppMigrations() {
	type migration struct {
		name    string
		handler func() error
	}
	migrations := []migration{
		{"Advanced Permissions Migration", s.doAdvancedPermissionsMigration},
		{"Emojis Permissions Migration", s.doEmojisPermissionsMigration},
		{"GuestRolesCreationMigration", s.doGuestRolesCreationMigration},
		{"System Console Roles Creation Migration", s.doSystemConsoleRolesCreationMigration},
		{"Custom Group Admin Role Creation Migration", s.doCustomGroupAdminRoleCreationMigration},
		// This migration always run after dependent migrations such as the guest roles migration.
		{"Permissions Migrations", s.doPermissionsMigrations},
		{"Content Extraction Config Default True Migration", s.doContentExtractionConfigDefaultTrueMigration},
		{"Playbooks Roles Creation Migration", s.doPlaybooksRolesCreationMigration},
		{"First Admin Setup Complete Migration", s.doFirstAdminSetupCompleteMigration},
		{"Remaining Schema Migrations", s.doRemainingSchemaMigrations},
		{"Post Priority Config Default True Migration", s.doPostPriorityConfigDefaultTrueMigration},
		{"Elasticsearch Fix Channel Index", s.doElasticsearchFixChannelIndex},
	}

	for i := range migrations {
		err := migrations[i].handler()
		if err != nil {
			mlog.Fatal("Failed to run app migration",
				mlog.String("migration", migrations[i].name),
				mlog.Err(err),
			)
		}
	}
}
