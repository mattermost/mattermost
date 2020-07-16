// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

type permissionTransformation struct {
	On     func(*model.Role, map[string]map[string]bool) bool
	Add    []string
	Remove []string
}
type permissionsMap []permissionTransformation

const (
	PERMISSION_MANAGE_SYSTEM                               = "manage_system"
	PERMISSION_MANAGE_EMOJIS                               = "manage_emojis"
	PERMISSION_MANAGE_OTHERS_EMOJIS                        = "manage_others_emojis"
	PERMISSION_CREATE_EMOJIS                               = "create_emojis"
	PERMISSION_DELETE_EMOJIS                               = "delete_emojis"
	PERMISSION_DELETE_OTHERS_EMOJIS                        = "delete_others_emojis"
	PERMISSION_MANAGE_JOBS                                 = "manage_jobs"
	PERMISSION_MANAGE_WEBHOOKS                             = "manage_webhooks"
	PERMISSION_MANAGE_OTHERS_WEBHOOKS                      = "manage_others_webhooks"
	PERMISSION_MANAGE_INCOMING_WEBHOOKS                    = "manage_incoming_webhooks"
	PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS             = "manage_others_incoming_webhooks"
	PERMISSION_MANAGE_OUTGOING_WEBHOOKS                    = "manage_outgoing_webhooks"
	PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS             = "manage_others_outgoing_webhooks"
	PERMISSION_LIST_PUBLIC_TEAMS                           = "list_public_teams"
	PERMISSION_LIST_PRIVATE_TEAMS                          = "list_private_teams"
	PERMISSION_JOIN_PUBLIC_TEAMS                           = "join_public_teams"
	PERMISSION_JOIN_PRIVATE_TEAMS                          = "join_private_teams"
	PERMISSION_PERMANENT_DELETE_USER                       = "permanent_delete_user"
	PERMISSION_CREATE_BOT                                  = "create_bot"
	PERMISSION_READ_BOTS                                   = "read_bots"
	PERMISSION_READ_OTHERS_BOTS                            = "read_others_bots"
	PERMISSION_MANAGE_BOTS                                 = "manage_bots"
	PERMISSION_MANAGE_OTHERS_BOTS                          = "manage_others_bots"
	PERMISSION_DELETE_PUBLIC_CHANNEL                       = "delete_public_channel"
	PERMISSION_DELETE_PRIVATE_CHANNEL                      = "delete_private_channel"
	PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES            = "manage_public_channel_properties"
	PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES           = "manage_private_channel_properties"
	PERMISSION_VIEW_MEMBERS                                = "view_members"
	PERMISSION_INVITE_USER                                 = "invite_user"
	PERMISSION_INVITE_GUEST                                = "invite_guest"
	PERMISSION_PROMOTE_GUEST                               = "promote_guest"
	PERMISSION_DEMOTE_TO_GUEST                             = "demote_to_guest"
	PERMISSION_USE_CHANNEL_MENTIONS                        = "use_channel_mentions"
	PERMISSION_CREATE_POST                                 = "create_post"
	PERMISSION_CREATE_POST_PUBLIC                          = "create_post_public"
	PERMISSION_USE_GROUP_MENTIONS                          = "use_group_mentions"
	PERMISSION_ADD_REACTION                                = "add_reaction"
	PERMISSION_REMOVE_REACTION                             = "remove_reaction"
	PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS               = "manage_public_channel_members"
	PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS              = "manage_private_channel_members"
	PERMISSION_CREATE_USER_ACCESS_TOKEN                    = "create_user_access_token"
	PERMISSION_READ_USER_ACCESS_TOKEN                      = "read_user_access_token"
	PERMISSION_REVOKE_USER_ACCESS_TOKEN                    = "revoke_user_access_token"
	PERMISSION_EDIT_OTHER_USERS                            = "edit_other_users"
	PERMISSION_GET_PUBLIC_LINK                             = "get_public_link"
	PERMISSION_LIST_USERS_WITHOUT_TEAM                     = "list_users_without_team"
	PERMISSION_MANAGE_OAUTH                                = "manage_oauth"
	PERMISSION_MANAGE_ROLES                                = "manage_roles"
	PERMISSION_MANAGE_TEAM                                 = "manage_team"
	PERMISSION_CREATE_DIRECT_CHANNEL                       = "create_direct_channel"
	PERMISSION_CREATE_GROUP_CHANNEL                        = "create_group_channel"
	PERMISSION_CREATE_TEAM                                 = "create_team"
	PERMISSION_READ_SYSCONSOLE_ABOUT                       = "read_sysconsole_about"
	PERMISSION_WRITE_SYSCONSOLE_ABOUT                      = "write_sysconsole_about"
	PERMISSION_READ_SYSCONSOLE_REPORTING                   = "read_sysconsole_reporting"
	PERMISSION_WRITE_SYSCONSOLE_REPORTING                  = "write_sysconsole_reporting"
	PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT              = "read_sysconsole_user_management"
	PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT             = "write_sysconsole_user_management"
	PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_USERS        = "read_sysconsole_user_management_users"
	PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_USERS       = "write_sysconsole_user_management_users"
	PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_GROUPS       = "read_sysconsole_user_management_groups"
	PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_GROUPS      = "write_sysconsole_user_management_groups"
	PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_TEAMS        = "read_sysconsole_user_management_teams"
	PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_TEAMS       = "write_sysconsole_user_management_teams"
	PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_CHANNELS     = "read_sysconsole_user_management_channels"
	PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_CHANNELS    = "write_sysconsole_user_management_channels"
	PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_PERMISSIONS  = "read_sysconsole_user_management_permissions"
	PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_PERMISSIONS = "write_sysconsole_user_management_permissions"
	PERMISSION_READ_SYSCONSOLE_ENVIRONMENT                 = "read_sysconsole_environment"
	PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT                = "write_sysconsole_environment"
	PERMISSION_READ_SYSCONSOLE_SITE                        = "read_sysconsole_site"
	PERMISSION_WRITE_SYSCONSOLE_SITE                       = "write_sysconsole_site"
	PERMISSION_READ_SYSCONSOLE_AUTHENTICATION              = "read_sysconsole_authentication"
	PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION             = "write_sysconsole_authentication"
	PERMISSION_READ_SYSCONSOLE_PLUGINS                     = "read_sysconsole_plugins"
	PERMISSION_WRITE_SYSCONSOLE_PLUGINS                    = "write_sysconsole_plugins"
	PERMISSION_READ_SYSCONSOLE_INTEGRATIONS                = "read_sysconsole_integrations"
	PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS               = "write_sysconsole_integrations"
	PERMISSION_READ_SYSCONSOLE_COMPLIANCE                  = "read_sysconsole_compliance"
	PERMISSION_WRITE_SYSCONSOLE_COMPLIANCE                 = "write_sysconsole_compliance"
	PERMISSION_READ_SYSCONSOLE_EXPERIMENTAL                = "read_sysconsole_experimental"
	PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL               = "write_sysconsole_experimental"
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

func (a *App) doPermissionsMigration(key string, migrationMap permissionsMap) *model.AppError {
	if _, err := a.Srv().Store.System().GetByName(key); err == nil {
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
		role.Permissions = applyPermissionsMap(role, roleMap, migrationMap)
		if _, err := a.Srv().Store.Role().Save(role); err != nil {
			return err
		}
	}

	if err := a.Srv().Store.System().Save(&model.System{Name: key, Value: "true"}); err != nil {
		return err
	}
	return nil
}

func (a *App) getEmojisPermissionsSplitMigration() (permissionsMap, error) {
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
	}, nil
}

func (a *App) getWebhooksPermissionsSplitMigration() (permissionsMap, error) {
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
	}, nil
}

func (a *App) getListJoinPublicPrivateTeamsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add:    []string{PERMISSION_LIST_PRIVATE_TEAMS, PERMISSION_JOIN_PRIVATE_TEAMS},
			Remove: []string{},
		},
		permissionTransformation{
			On:     isRole(model.SYSTEM_USER_ROLE_ID),
			Add:    []string{PERMISSION_LIST_PUBLIC_TEAMS, PERMISSION_JOIN_PUBLIC_TEAMS},
			Remove: []string{},
		},
	}, nil
}

func (a *App) removePermanentDeleteUserMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionExists(PERMISSION_PERMANENT_DELETE_USER),
			Remove: []string{PERMISSION_PERMANENT_DELETE_USER},
		},
	}, nil
}

func (a *App) getAddBotPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add:    []string{PERMISSION_CREATE_BOT, PERMISSION_READ_BOTS, PERMISSION_READ_OTHERS_BOTS, PERMISSION_MANAGE_BOTS, PERMISSION_MANAGE_OTHERS_BOTS},
			Remove: []string{},
		},
	}, nil
}

func (a *App) applyChannelManageDeleteToChannelUser() (permissionsMap, error) {
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
	}, nil
}

func (a *App) removeChannelManageDeleteFromTeamUser() (permissionsMap, error) {
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
	}, nil
}

func (a *App) getViewMembersPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SYSTEM_USER_ROLE_ID),
			Add: []string{PERMISSION_VIEW_MEMBERS},
		},
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{PERMISSION_VIEW_MEMBERS},
		},
	}, nil
}

func (a *App) getAddManageGuestsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{PERMISSION_PROMOTE_GUEST, PERMISSION_DEMOTE_TO_GUEST, PERMISSION_INVITE_GUEST},
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
		PERMISSION_ADD_REACTION,
		PERMISSION_REMOVE_REACTION,
		PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS,
		PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS,
		PERMISSION_USE_CHANNEL_MENTIONS,
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
			Add: []string{PERMISSION_CREATE_POST},
		}
		transformations = append(transformations, trans)

		// ensure all team scheme team admins have create_post because it's not exposed via the UI
		trans = permissionTransformation{
			On:  isRole(ts.DefaultTeamAdminRole),
			Add: []string{PERMISSION_CREATE_POST},
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
		Add: []string{PERMISSION_CREATE_POST},
	})

	// ensure channel admins have create_post
	transformations = append(transformations, permissionTransformation{
		On:  isRole(model.CHANNEL_ADMIN_ROLE_ID),
		Add: []string{PERMISSION_CREATE_POST},
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
		Add: append(moderatedPermissionsMinusCreatePost, PERMISSION_CREATE_POST),
	})

	// add the new use_channel_mentions permission to everyone who has create_post
	transformations = append(transformations, permissionTransformation{
		On:  permissionOr(permissionExists(PERMISSION_CREATE_POST), permissionExists(PERMISSION_CREATE_POST_PUBLIC)),
		Add: []string{PERMISSION_USE_CHANNEL_MENTIONS},
	})

	return transformations, nil
}

func (a *App) getAddUseGroupMentionsPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionAnd(
				isNotRole(model.CHANNEL_GUEST_ROLE_ID),
				isNotSchemeRole("Channel Guest Role for Scheme"),
				permissionOr(permissionExists(PERMISSION_CREATE_POST), permissionExists(PERMISSION_CREATE_POST_PUBLIC)),
			),
			Add: []string{PERMISSION_USE_GROUP_MENTIONS},
		},
	}, nil
}

func (a *App) getAddSystemConsolePermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: isRole(model.SYSTEM_ADMIN_ROLE_ID),
			Add: []string{
				PERMISSION_READ_SYSCONSOLE_ABOUT,
				PERMISSION_WRITE_SYSCONSOLE_ABOUT,
				PERMISSION_READ_SYSCONSOLE_REPORTING,
				PERMISSION_WRITE_SYSCONSOLE_REPORTING,
				PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT,
				PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT,
				PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_USERS,
				PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_USERS,
				PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_GROUPS,
				PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_GROUPS,
				PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_TEAMS,
				PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_TEAMS,
				PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_CHANNELS,
				PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_CHANNELS,
				PERMISSION_READ_SYSCONSOLE_USERMANAGEMENT_PERMISSIONS,
				PERMISSION_WRITE_SYSCONSOLE_USERMANAGEMENT_PERMISSIONS,
				PERMISSION_READ_SYSCONSOLE_ENVIRONMENT,
				PERMISSION_WRITE_SYSCONSOLE_ENVIRONMENT,
				PERMISSION_READ_SYSCONSOLE_SITE,
				PERMISSION_WRITE_SYSCONSOLE_SITE,
				PERMISSION_READ_SYSCONSOLE_AUTHENTICATION,
				PERMISSION_WRITE_SYSCONSOLE_AUTHENTICATION,
				PERMISSION_READ_SYSCONSOLE_PLUGINS,
				PERMISSION_WRITE_SYSCONSOLE_PLUGINS,
				PERMISSION_READ_SYSCONSOLE_INTEGRATIONS,
				PERMISSION_WRITE_SYSCONSOLE_INTEGRATIONS,
				PERMISSION_READ_SYSCONSOLE_COMPLIANCE,
				PERMISSION_WRITE_SYSCONSOLE_COMPLIANCE,
				PERMISSION_READ_SYSCONSOLE_EXPERIMENTAL,
				PERMISSION_WRITE_SYSCONSOLE_EXPERIMENTAL},
		},
	}, nil
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
		{Key: model.MIGRATION_KEY_ADD_SYSTEM_CONSOLE_PERMISSION, Migration: a.getAddSystemConsolePermissionsMigration},
	}

	for _, migration := range PermissionsMigrations {
		migMap, err := migration.Migration()
		if err != nil {
			return err
		}
		if err := a.doPermissionsMigration(migration.Key, migMap); err != nil {
			return err
		}
	}
	return nil
}
