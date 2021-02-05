// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type permissionTransformation struct {
	On     func(*model.Role, map[string]map[string]bool) bool
	Add    []string
	Remove []string
}
type permissionsMap []permissionTransformation

const (
	PermissionManageSystem                   = "manage_system"
	PermissionManageTeam                     = "manage_team"
	PermissionManageEmojis                   = "manage_emojis"
	PermissionManageOthersEmojis             = "manage_others_emojis"
	PermissionCreateEmojis                   = "create_emojis"
	PermissionDeleteEmojis                   = "delete_emojis"
	PermissionDeleteOthersEmojis             = "delete_others_emojis"
	PermissionManageWebhooks                 = "manage_webhooks"
	PermissionManageOthersWebhooks           = "manage_others_webhooks"
	PermissionManageIncomingWebhooks         = "manage_incoming_webhooks"
	PermissionManageOthersIncomingWebhooks   = "manage_others_incoming_webhooks"
	PermissionManageOutgoingWebhooks         = "manage_outgoing_webhooks"
	PermissionManageOthersOutgoingWebhooks   = "manage_others_outgoing_webhooks"
	PermissionListPublicTeams                = "list_public_teams"
	PermissionListPrivateTeams               = "list_private_teams"
	PermissionJoinPublicTeams                = "join_public_teams"
	PermissionJoinPrivateTeams               = "join_private_teams"
	PermissionPermanentDeleteUser            = "permanent_delete_user"
	PermissionCreateBot                      = "create_bot"
	PermissionReadBots                       = "read_bots"
	PermissionReadOthersBots                 = "read_others_bots"
	PermissionManageBots                     = "manage_bots"
	PermissionManageOthersBots               = "manage_others_bots"
	PermissionDeletePublicChannel            = "delete_public_channel"
	PermissionDeletePrivateChannel           = "delete_private_channel"
	PermissionManagePublicChannelProperties  = "manage_public_channel_properties"
	PermissionManagePrivateChannelProperties = "manage_private_channel_properties"
	PermissionConvertPublicChannelToPrivate  = "convert_public_channel_to_private"
	PermissionConvertPrivateChannelToPublic  = "convert_private_channel_to_public"
	PermissionViewMembers                    = "view_members"
	PermissionInviteUser                     = "invite_user"
	PermissionInviteGuest                    = "invite_guest"
	PermissionPromoteGuest                   = "promote_guest"
	PermissionDemoteToGuest                  = "demote_to_guest"
	PermissionUseChannelMentions             = "use_channel_mentions"
	PermissionCreatePost                     = "create_post"
	PermissionCreatePost_PUBLIC              = "create_post_public"
	PermissionUseGroupMentions               = "use_group_mentions"
	PermissionAddReaction                    = "add_reaction"
	PermissionRemoveReaction                 = "remove_reaction"
	PermissionManagePublicChannelMembers     = "manage_public_channel_members"
	PermissionManagePrivateChannelMembers    = "manage_private_channel_members"
	PermissionReadJobs                       = "read_jobs"
	PermissionManageJobs                     = "manage_jobs"
	PermissionReadOtherUsersTeams            = "read_other_users_teams"
	PermissionEditOtherUsers                 = "edit_other_users"
	PermissionReadPublicChannelGroups        = "read_public_channel_groups"
	PermissionReadPrivateChannelGroups       = "read_private_channel_groups"
	PermissionEditBrand                      = "edit_brand"
	PermissionManageSharedChannels           = "manage_shared_channels"
	PermissionManageRemoteClusters           = "manage_remote_clusters"
)

func isRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return role.Name == roleName
	}
}

func isNotRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return role.Name != roleName
	}
}

func isNotSchemeRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return !strings.Contains(role.DisplayName, roleName)
	}
}

func permissionExists(permission string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		val, ok := permissionsMap[role.Name][permission]
		return ok && val
	}
}

func permissionNotExists(permission string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		val, ok := permissionsMap[role.Name][permission]
		return !(ok && val)
	}
}

func onOtherRole(otherRole string, function func(*model.Role, map[string]map[string]bool) bool) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return function(&model.Role{Name: otherRole}, permissionsMap)
	}
}

func permissionOr(funcs ...func(*model.Role, map[string]map[string]bool) bool) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		for _, f := range funcs {
			if f(role, permissionsMap) {
				return true
			}
		}
		return false
	}
}

func permissionAnd(funcs ...func(*model.Role, map[string]map[string]bool) bool) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		for _, f := range funcs {
			if !f(role, permissionsMap) {
				return false
			}
		}
		return true
	}
}

func applyPermissionsMap(role *model.Role, roleMap map[string]map[string]bool, migrationMap permissionsMap) []string {
	var result []string

	roleName := role.Name
	for _, transformation := range migrationMap {
		if transformation.On(role, roleMap) {
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

func (a *App) doPermissionsMigration(key string, migrationMap permissionsMap, roles []*model.Role) *model.AppError {
	if _, err := a.Srv().Store.System().GetByName(key); err == nil {
		return nil
	}

	roleMap := make(map[string]map[string]bool)
	for _, role := range roles {
		roleMap[role.Name] = make(map[string]bool)
		for _, permission := range role.Permissions {
			roleMap[role.Name][permission] = true
		}
	}

	for _, role := range roles {
		role.Permissions = applyPermissionsMap(role, roleMap, migrationMap)
		if _, err := a.Srv().Store.Role().Save(role); err != nil {
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &invErr):
				return model.NewAppError("doPermissionsMigration", "app.role.save.invalid_role.app_error", nil, invErr.Error(), http.StatusBadRequest)
			default:
				return model.NewAppError("doPermissionsMigration", "app.role.save.insert.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	if err := a.Srv().Store.System().Save(&model.System{Name: key, Value: "true"}); err != nil {
		return model.NewAppError("doPermissionsMigration", "app.system.save.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) getEmojisPermissionsSplitMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionExists(PermissionManageEmojis),
			Add:    []string{PermissionCreateEmojis, PermissionDeleteEmojis},
			Remove: []string{PermissionManageEmojis},
		},
		permissionTransformation{
			On:     permissionExists(PermissionManageOthersEmojis),
			Add:    []string{PermissionDeleteOthersEmojis},
			Remove: []string{PermissionManageOthersEmojis},
		},
	}, nil
}

func (a *App) getWebhooksPermissionsSplitMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionExists(PermissionManageWebhooks),
			Add:    []string{PermissionManageIncomingWebhooks, PermissionManageOutgoingWebhooks},
			Remove: []string{PermissionManageWebhooks},
		},
		permissionTransformation{
			On:     permissionExists(PermissionManageOthersWebhooks),
			Add:    []string{PermissionManageOthersIncomingWebhooks, PermissionManageOthersOutgoingWebhooks},
			Remove: []string{PermissionManageOthersWebhooks},
		},
	}, nil
}

func (a *App) getListJoinPublicPrivateTeamsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add:    []string{PermissionListPrivateTeams, PermissionJoinPrivateTeams},
			Remove: []string{},
		},
		permissionTransformation{
			On:     isRole(model.SYSTEM_USER_ROLE_ID),
			Add:    []string{PermissionListPublicTeams, PermissionJoinPublicTeams},
			Remove: []string{},
		},
	}, nil
}

func (a *App) removePermanentDeleteUserMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionExists(PermissionPermanentDeleteUser),
			Remove: []string{PermissionPermanentDeleteUser},
		},
	}, nil
}

func (a *App) getAddBotPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add:    []string{PermissionCreateBot, PermissionReadBots, PermissionReadOthersBots, PermissionManageBots, PermissionManageOthersBots},
			Remove: []string{},
		},
	}, nil
}

func (a *App) applyChannelManageDeleteToChannelUser() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  permissionAnd(isRole(model.CHANNEL_USER_ROLE_ID), onOtherRole(model.TEAM_USER_ROLE_ID, permissionExists(PermissionManagePrivateChannelProperties))),
			Add: []string{PermissionManagePrivateChannelProperties},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.CHANNEL_USER_ROLE_ID), onOtherRole(model.TEAM_USER_ROLE_ID, permissionExists(PermissionDeletePrivateChannel))),
			Add: []string{PermissionDeletePrivateChannel},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.CHANNEL_USER_ROLE_ID), onOtherRole(model.TEAM_USER_ROLE_ID, permissionExists(PermissionManagePublicChannelProperties))),
			Add: []string{PermissionManagePublicChannelProperties},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.CHANNEL_USER_ROLE_ID), onOtherRole(model.TEAM_USER_ROLE_ID, permissionExists(PermissionDeletePublicChannel))),
			Add: []string{PermissionDeletePublicChannel},
		},
	}, nil
}

func (a *App) removeChannelManageDeleteFromTeamUser() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionAnd(isRole(model.TEAM_USER_ROLE_ID), permissionExists(PermissionManagePrivateChannelProperties)),
			Remove: []string{PermissionManagePrivateChannelProperties},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TEAM_USER_ROLE_ID), permissionExists(PermissionDeletePrivateChannel)),
			Remove: []string{model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TEAM_USER_ROLE_ID), permissionExists(PermissionManagePublicChannelProperties)),
			Remove: []string{PermissionManagePublicChannelProperties},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TEAM_USER_ROLE_ID), permissionExists(PermissionDeletePublicChannel)),
			Remove: []string{PermissionDeletePublicChannel},
		},
	}, nil
}

func (a *App) getViewMembersPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SYSTEM_USER_ROLE_ID),
			Add: []string{PermissionViewMembers},
		},
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{PermissionViewMembers},
		},
	}, nil
}

func (a *App) getAddManageGuestsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{PermissionPromoteGuest, PermissionDemoteToGuest, PermissionInviteGuest},
		},
	}, nil
}

func (a *App) channelModerationPermissionsMigration() (permissionsMap, error) {
	transformations := permissionsMap{}

	var allTeamSchemes []*model.Scheme
	next := a.SchemesIterator(model.SCHEME_SCOPE_TEAM, 100)
	var schemeBatch []*model.Scheme
	for schemeBatch = next(); len(schemeBatch) > 0; schemeBatch = next() {
		allTeamSchemes = append(allTeamSchemes, schemeBatch...)
	}

	moderatedPermissionsMinusCreatePost := []string{
		PermissionAddReaction,
		PermissionRemoveReaction,
		PermissionManagePublicChannelMembers,
		PermissionManagePrivateChannelMembers,
		PermissionUseChannelMentions,
	}

	teamAndChannelAdminConditionalTransformations := func(teamAdminID, channelAdminID, channelUserID, channelGuestID string) []permissionTransformation {
		transformations := []permissionTransformation{}

		for _, perm := range moderatedPermissionsMinusCreatePost {
			// add each moderated permission to the channel admin if channel user or guest has the permission
			trans := permissionTransformation{
				On: permissionAnd(
					isRole(channelAdminID),
					permissionOr(
						onOtherRole(channelUserID, permissionExists(perm)),
						onOtherRole(channelGuestID, permissionExists(perm)),
					),
				),
				Add: []string{perm},
			}
			transformations = append(transformations, trans)

			// add each moderated permission to the team admin if channel admin, user, or guest has the permission
			trans = permissionTransformation{
				On: permissionAnd(
					isRole(teamAdminID),
					permissionOr(
						onOtherRole(channelAdminID, permissionExists(perm)),
						onOtherRole(channelUserID, permissionExists(perm)),
						onOtherRole(channelGuestID, permissionExists(perm)),
					),
				),
				Add: []string{perm},
			}
			transformations = append(transformations, trans)
		}

		return transformations
	}

	for _, ts := range allTeamSchemes {
		// ensure all team scheme channel admins have create_post because it's not exposed via the UI
		trans := permissionTransformation{
			On:  isRole(ts.DefaultChannelAdminRole),
			Add: []string{PermissionCreatePost},
		}
		transformations = append(transformations, trans)

		// ensure all team scheme team admins have create_post because it's not exposed via the UI
		trans = permissionTransformation{
			On:  isRole(ts.DefaultTeamAdminRole),
			Add: []string{PermissionCreatePost},
		}
		transformations = append(transformations, trans)

		// conditionally add all other moderated permissions to team and channel admins
		transformations = append(transformations, teamAndChannelAdminConditionalTransformations(
			ts.DefaultTeamAdminRole,
			ts.DefaultChannelAdminRole,
			ts.DefaultChannelUserRole,
			ts.DefaultChannelGuestRole,
		)...)
	}

	// ensure team admins have create_post
	transformations = append(transformations, permissionTransformation{
		On:  isRole(model.TEAM_ADMIN_ROLE_ID),
		Add: []string{PermissionCreatePost},
	})

	// ensure channel admins have create_post
	transformations = append(transformations, permissionTransformation{
		On:  isRole(model.CHANNEL_ADMIN_ROLE_ID),
		Add: []string{PermissionCreatePost},
	})

	// conditionally add all other moderated permissions to team and channel admins
	transformations = append(transformations, teamAndChannelAdminConditionalTransformations(
		model.TEAM_ADMIN_ROLE_ID,
		model.CHANNEL_ADMIN_ROLE_ID,
		model.CHANNEL_USER_ROLE_ID,
		model.CHANNEL_GUEST_ROLE_ID,
	)...)

	// ensure system admin has all of the moderated permissions
	transformations = append(transformations, permissionTransformation{
		On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
		Add: append(moderatedPermissionsMinusCreatePost, PermissionCreatePost),
	})

	// add the new use_channel_mentions permission to everyone who has create_post
	transformations = append(transformations, permissionTransformation{
		On:  permissionOr(permissionExists(PermissionCreatePost), permissionExists(PermissionCreatePost_PUBLIC)),
		Add: []string{PermissionUseChannelMentions},
	})

	return transformations, nil
}

func (a *App) getAddUseGroupMentionsPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionAnd(
				isNotRole(model.CHANNEL_GUEST_ROLE_ID),
				isNotSchemeRole("Channel Guest Role for Scheme"),
				permissionOr(permissionExists(PermissionCreatePost), permissionExists(PermissionCreatePost_PUBLIC)),
			),
			Add: []string{PermissionUseGroupMentions},
		},
	}, nil
}

func (a *App) getAddSystemConsolePermissionsMigration() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsToAdd := []string{}
	for _, permission := range append(model.SysconsoleReadPermissions, model.SysconsoleWritePermissions...) {
		permissionsToAdd = append(permissionsToAdd, permission.Id)
	}

	// add the new permissions to system admin
	transformations = append(transformations,
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: permissionsToAdd,
		})

	// add read_jobs to all roles with manage_jobs
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(PermissionManageJobs),
		Add: []string{PermissionReadJobs},
	})

	// add read_other_users_teams to all roles with edit_other_users
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(PermissionEditOtherUsers),
		Add: []string{PermissionReadOtherUsersTeams},
	})

	// add read_public_channel_groups to all roles with manage_public_channel_members
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(PermissionManagePublicChannelMembers),
		Add: []string{PermissionReadPublicChannelGroups},
	})

	// add read_private_channel_groups to all roles with manage_private_channel_members
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(PermissionManagePrivateChannelMembers),
		Add: []string{PermissionReadPrivateChannelGroups},
	})

	// add edit_brand to all roles with manage_system
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(PermissionManageSystem),
		Add: []string{PermissionEditBrand},
	})

	return transformations, nil
}

func (a *App) getAddConvertChannelPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  permissionExists(PermissionManageTeam),
			Add: []string{PermissionConvertPublicChannelToPrivate, PermissionConvertPrivateChannelToPublic},
		},
	}, nil
}

func (a *App) getSystemRolesPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_SYSTEM_ROLES.Id, model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_SYSTEM_ROLES.Id},
		},
	}, nil
}

func (a *App) getAddManageSharedChannelsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{PermissionManageSharedChannels},
		},
	}, nil
}

func (a *App) getBillingPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{model.PERMISSION_SYSCONSOLE_READ_BILLING.Id, model.PERMISSION_SYSCONSOLE_WRITE_BILLING.Id},
		},
	}, nil
}

func (a *App) getAddManageRemoteClustersPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{PermissionManageRemoteClusters},
		},
	}, nil
}

func (a *App) getAddDownloadComplianceExportResult() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsToAddComplianceRead := []string{model.PERMISSION_DOWNLOAD_COMPLIANCE_EXPORT_RESULT.Id, model.PERMISSION_READ_JOBS.Id}
	permissionsToAddComplianceWrite := []string{model.PERMISSION_MANAGE_JOBS.Id}

	// add the new permissions to system admin
	transformations = append(transformations,
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{model.PERMISSION_DOWNLOAD_COMPLIANCE_EXPORT_RESULT.Id},
		})

	// add Download Compliance Export Result and Read Jobs to all roles with sysconsole_read_compliance
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE.Id),
		Add: permissionsToAddComplianceRead,
	})

	// add manage_jobs to all roles with sysconsole_write_compliance
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE.Id),
		Add: permissionsToAddComplianceWrite,
	})

	return transformations, nil
}

// DoPermissionsMigrations execute all the permissions migrations need by the current version.
func (a *App) DoPermissionsMigrations() error {
	PermissionsMigrations := []struct {
		Key       string
		Migration func() (permissionsMap, error)
	}{
		{Key: model.MIGRATION_KEY_EMOJI_PERMISSIONS_SPLIT, Migration: a.getEmojisPermissionsSplitMigration},
		{Key: model.MIGRATION_KEY_WEBHOOK_PERMISSIONS_SPLIT, Migration: a.getWebhooksPermissionsSplitMigration},
		{Key: model.MIGRATION_KEY_LIST_JOIN_PUBLIC_PRIVATE_TEAMS, Migration: a.getListJoinPublicPrivateTeamsPermissionsMigration},
		{Key: model.MIGRATION_KEY_REMOVE_PERMANENT_DELETE_USER, Migration: a.removePermanentDeleteUserMigration},
		{Key: model.MIGRATION_KEY_ADD_BOT_PERMISSIONS, Migration: a.getAddBotPermissionsMigration},
		{Key: model.MIGRATION_KEY_APPLY_CHANNEL_MANAGE_DELETE_TO_CHANNEL_USER, Migration: a.applyChannelManageDeleteToChannelUser},
		{Key: model.MIGRATION_KEY_REMOVE_CHANNEL_MANAGE_DELETE_FROM_TEAM_USER, Migration: a.removeChannelManageDeleteFromTeamUser},
		{Key: model.MIGRATION_KEY_VIEW_MEMBERS_NEW_PERMISSION, Migration: a.getViewMembersPermissionMigration},
		{Key: model.MIGRATION_KEY_ADD_MANAGE_GUESTS_PERMISSIONS, Migration: a.getAddManageGuestsPermissionsMigration},
		{Key: model.MIGRATION_KEY_CHANNEL_MODERATIONS_PERMISSIONS, Migration: a.channelModerationPermissionsMigration},
		{Key: model.MIGRATION_KEY_ADD_USE_GROUP_MENTIONS_PERMISSION, Migration: a.getAddUseGroupMentionsPermissionMigration},
		{Key: model.MIGRATION_KEY_ADD_SYSTEM_CONSOLE_PERMISSIONS, Migration: a.getAddSystemConsolePermissionsMigration},
		{Key: model.MIGRATION_KEY_ADD_CONVERT_CHANNEL_PERMISSIONS, Migration: a.getAddConvertChannelPermissionsMigration},
		{Key: model.MIGRATION_KEY_ADD_MANAGE_SHARED_CHANNEL_PERMISSIONS, Migration: a.getAddManageSharedChannelsPermissionsMigration},
		{Key: model.MIGRATION_KEY_ADD_MANAGE_REMOTE_CLUSTERS_PERMISSIONS, Migration: a.getAddManageRemoteClustersPermissionsMigration},
		{Key: model.MIGRATION_KEY_ADD_SYSTEM_ROLES_PERMISSIONS, Migration: a.getSystemRolesPermissionsMigration},
		{Key: model.MIGRATION_KEY_ADD_BILLING_PERMISSIONS, Migration: a.getBillingPermissionsMigration},
		{Key: model.MIGRATION_KEY_ADD_DOWNLOAD_COMPLIANCE_EXPORT_RESULTS, Migration: a.getAddDownloadComplianceExportResult},
	}

	roles, err := a.GetAllRoles()
	if err != nil {
		return err
	}

	for _, migration := range PermissionsMigrations {
		migMap, err := migration.Migration()
		if err != nil {
			return err
		}
		if err := a.doPermissionsMigration(migration.Key, migMap, roles); err != nil {
			return err
		}
	}
	return nil
}
