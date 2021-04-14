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

	permissionsToAddComplianceRead := []string{model.PERMISSION_DOWNLOAD_COMPLIANCE_EXPORT_RESULT.Id, model.PERMISSION_READ_DATA_RETENTION_JOB.Id}
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

func (a *App) getAddExperimentalSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsExperimentalRead := []string{model.PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_BLEVE.Id, model.PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_FEATURES.Id, model.PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_FEATURE_FLAGS.Id}
	permissionsExperimentalWrite := []string{model.PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_BLEVE.Id, model.PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_FEATURES.Id, model.PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_FEATURE_FLAGS.Id}

	// Give the new subsection READ permissions to any user with READ_EXPERIMENTAL
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL.Id),
		Add: permissionsExperimentalRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_EXPERIMENTAL
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL.Id),
		Add: permissionsExperimentalWrite,
	})

	// Give the ancillary permissions MANAGE_JOBS and PURGE_BLEVE_INDEXES to anyone with WRITE_EXPERIMENTAL_BLEVE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_BLEVE.Id),
		Add: []string{model.PERMISSION_CREATE_POST_BLEVE_INDEXES_JOB.Id, model.PERMISSION_PURGE_BLEVE_INDEXES.Id},
	})

	return transformations, nil
}

func (a *App) getAddIntegrationsSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsIntegrationsRead := []string{model.PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_INTEGRATION_MANAGEMENT.Id, model.PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_BOT_ACCOUNTS.Id, model.PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_GIF.Id, model.PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_CORS.Id}
	permissionsIntegrationsWrite := []string{model.PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_INTEGRATION_MANAGEMENT.Id, model.PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_BOT_ACCOUNTS.Id, model.PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_GIF.Id, model.PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_CORS.Id}

	// Give the new subsection READ permissions to any user with READ_INTEGRATIONS
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_INTEGRATIONS.Id),
		Add: permissionsIntegrationsRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_EXPERIMENTAL
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS.Id),
		Add: permissionsIntegrationsWrite,
	})

	return transformations, nil
}

func (a *App) getAddSiteSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsSiteRead := []string{model.PERMISSION_SYSCONSOLE_READ_SITE_CUSTOMIZATION.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_LOCALIZATION.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_USERS_AND_TEAMS.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_NOTIFICATIONS.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_ANNOUNCEMENT_BANNER.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_EMOJI.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_POSTS.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_FILE_SHARING_AND_DOWNLOADS.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_PUBLIC_LINKS.Id, model.PERMISSION_SYSCONSOLE_READ_SITE_NOTICES.Id}
	permissionsSiteWrite := []string{model.PERMISSION_SYSCONSOLE_WRITE_SITE_CUSTOMIZATION.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_LOCALIZATION.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_USERS_AND_TEAMS.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_NOTIFICATIONS.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_ANNOUNCEMENT_BANNER.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_EMOJI.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_POSTS.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_FILE_SHARING_AND_DOWNLOADS.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_PUBLIC_LINKS.Id, model.PERMISSION_SYSCONSOLE_WRITE_SITE_NOTICES.Id}

	// Give the new subsection READ permissions to any user with READ_SITE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_SITE.Id),
		Add: permissionsSiteRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_SITE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_SITE.Id),
		Add: permissionsSiteWrite,
	})

	// Give the ancillary permissions EDIT_BRAND to anyone with WRITE_SITE_CUSTOMIZATION
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_SITE_CUSTOMIZATION.Id),
		Add: []string{model.PERMISSION_EDIT_BRAND.Id},
	})

	return transformations, nil
}

func (a *App) getAddComplianceSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsComplianceRead := []string{model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE_DATA_RETENTION_POLICY.Id, model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_EXPORT.Id, model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_MONITORING.Id, model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE.Id}
	permissionsComplianceWrite := []string{model.PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_DATA_RETENTION_POLICY.Id, model.PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_EXPORT.Id, model.PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_MONITORING.Id, model.PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE.Id}

	// Give the new subsection READ permissions to any user with READ_COMPLIANCE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE.Id),
		Add: permissionsComplianceRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_COMPLIANCE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE.Id),
		Add: permissionsComplianceWrite,
	})

	// Ancilary permissions
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_DATA_RETENTION_POLICY.Id),
		Add: []string{model.PERMISSION_CREATE_DATA_RETENTION_JOB.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE_DATA_RETENTION_POLICY.Id),
		Add: []string{model.PERMISSION_READ_DATA_RETENTION_JOB.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_EXPORT.Id),
		Add: []string{model.PERMISSION_CREATE_COMPLIANCE_EXPORT_JOB.Id, model.PERMISSION_DOWNLOAD_COMPLIANCE_EXPORT_RESULT.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_EXPORT.Id),
		Add: []string{model.PERMISSION_READ_COMPLIANCE_EXPORT_JOB.Id, model.PERMISSION_DOWNLOAD_COMPLIANCE_EXPORT_RESULT.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE.Id),
		Add: []string{model.PERMISSION_READ_AUDITS.Id},
	})

	return transformations, nil
}

func (a *App) getAddEnvironmentSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsEnvironmentRead := []string{
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_WEB_SERVER.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_DATABASE.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_ELASTICSEARCH.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_FILE_STORAGE.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_IMAGE_PROXY.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_SMTP.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_PUSH_NOTIFICATION_SERVER.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_HIGH_AVAILABILITY.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_RATE_LIMITING.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_LOGGING.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_SESSION_LENGTHS.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_PERFORMANCE_MONITORING.Id,
		model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_DEVELOPER.Id,
	}
	permissionsEnvironmentWrite := []string{
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_WEB_SERVER.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DATABASE.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_ELASTICSEARCH.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_FILE_STORAGE.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_IMAGE_PROXY.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_SMTP.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_PUSH_NOTIFICATION_SERVER.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_HIGH_AVAILABILITY.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_RATE_LIMITING.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_LOGGING.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_SESSION_LENGTHS.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_PERFORMANCE_MONITORING.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DEVELOPER.Id,
	}

	// Give the new subsection READ permissions to any user with READ_ENVIRONMENT
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT.Id),
		Add: permissionsEnvironmentRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_ENVIRONMENT
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT.Id),
		Add: permissionsEnvironmentWrite,
	})

	// Give these ancillary permissions to anyone with READ_ENVIRONMENT_ELASTICSEARCH
	transformations = append(transformations, permissionTransformation{
		On: permissionExists(model.PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_ELASTICSEARCH.Id),
		Add: []string{
			model.PERMISSION_READ_ELASTICSEARCH_POST_INDEXING_JOB.Id,
			model.PERMISSION_READ_ELASTICSEARCH_POST_AGGREGATION_JOB.Id,
		},
	})

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_WEB_SERVER
	transformations = append(transformations, permissionTransformation{
		On: permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_WEB_SERVER.Id),
		Add: []string{
			model.PERMISSION_TEST_SITE_URL.Id,
			model.PERMISSION_RELOAD_CONFIG.Id,
			model.PERMISSION_INVALIDATE_CACHES.Id,
		},
	})

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_DATABASE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DATABASE.Id),
		Add: []string{model.PERMISSION_RECYCLE_DATABASE_CONNECTIONS.Id},
	})

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_ELASTICSEARCH
	transformations = append(transformations, permissionTransformation{
		On: permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_ELASTICSEARCH.Id),
		Add: []string{
			model.PERMISSION_TEST_ELASTICSEARCH.Id,
			model.PERMISSION_CREATE_ELASTICSEARCH_POST_INDEXING_JOB.Id,
			model.PERMISSION_CREATE_ELASTICSEARCH_POST_AGGREGATION_JOB.Id,
			model.PERMISSION_PURGE_ELASTICSEARCH_INDEXES.Id,
		},
	})

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_FILE_STORAGE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_FILE_STORAGE.Id),
		Add: []string{model.PERMISSION_TEST_S3.Id},
	})

	return transformations, nil
}

func (a *App) getAddAboutSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsAboutRead := []string{model.PERMISSION_SYSCONSOLE_READ_ABOUT_EDITION_AND_LICENSE.Id}
	permissionsAboutWrite := []string{model.PERMISSION_SYSCONSOLE_WRITE_ABOUT_EDITION_AND_LICENSE.Id}

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_ABOUT.Id),
		Add: permissionsAboutRead,
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_ABOUT.Id),
		Add: permissionsAboutWrite,
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_ABOUT_EDITION_AND_LICENSE.Id),
		Add: []string{model.PERMISSION_READ_LICENSE_INFORMATION.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_ABOUT_EDITION_AND_LICENSE.Id),
		Add: []string{model.PERMISSION_MANAGE_LICENSE_INFORMATION.Id},
	})

	return transformations, nil
}

func (a *App) getAddReportingSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsReportingRead := []string{
		model.PERMISSION_SYSCONSOLE_READ_REPORTING_SITE_STATISTICS.Id,
		model.PERMISSION_SYSCONSOLE_READ_REPORTING_TEAM_STATISTICS.Id,
		model.PERMISSION_SYSCONSOLE_READ_REPORTING_SERVER_LOGS.Id,
	}
	permissionsReportingWrite := []string{
		model.PERMISSION_SYSCONSOLE_WRITE_REPORTING_SITE_STATISTICS.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_REPORTING_TEAM_STATISTICS.Id,
		model.PERMISSION_SYSCONSOLE_WRITE_REPORTING_SERVER_LOGS.Id,
	}

	// Give the new subsection READ permissions to any user with READ_REPORTING
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_REPORTING.Id),
		Add: permissionsReportingRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_REPORTING
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_REPORTING.Id),
		Add: permissionsReportingWrite,
	})

	// Give the ancillary permissions PERMISSION_GET_ANALYTICS to anyone with PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS or PERMISSION_SYSCONSOLE_READ_REPORTING_SITE_STATISTICS
	transformations = append(transformations, permissionTransformation{
		On:  permissionOr(permissionExists(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS.Id), permissionExists(model.PERMISSION_SYSCONSOLE_READ_REPORTING_SITE_STATISTICS.Id)),
		Add: []string{model.PERMISSION_GET_ANALYTICS.Id},
	})

	// Give the ancillary permissions PERMISSION_GET_LOGS to anyone with PERMISSION_SYSCONSOLE_READ_REPORTING_SERVER_LOGS
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_REPORTING_SERVER_LOGS.Id),
		Add: []string{model.PERMISSION_GET_LOGS.Id},
	})

	return transformations, nil
}

func (a *App) getAddAuthenticationSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsAuthenticationRead := []string{model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_SIGNUP.Id, model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_EMAIL.Id, model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_PASSWORD.Id, model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_MFA.Id, model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_LDAP.Id, model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_SAML.Id, model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_OPENID.Id, model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_GUEST_ACCESS.Id}
	permissionsAuthenticationWrite := []string{model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SIGNUP.Id, model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_EMAIL.Id, model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_PASSWORD.Id, model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_MFA.Id, model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_LDAP.Id, model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SAML.Id, model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_OPENID.Id, model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_GUEST_ACCESS.Id}

	// Give the new subsection READ permissions to any user with READ_AUTHENTICATION
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION.Id),
		Add: permissionsAuthenticationRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_AUTHENTICATION
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION.Id),
		Add: permissionsAuthenticationWrite,
	})

	// Give the ancillary permissions for LDAP to anyone with WRITE_AUTHENTICATION_LDAP
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_LDAP.Id),
		Add: []string{model.PERMISSION_CREATE_LDAP_SYNC_JOB.Id, model.PERMISSION_TEST_LDAP.Id, model.PERMISSION_ADD_LDAP_PUBLIC_CERT.Id, model.PERMISSION_ADD_LDAP_PRIVATE_CERT.Id, model.PERMISSION_REMOVE_LDAP_PUBLIC_CERT.Id, model.PERMISSION_REMOVE_LDAP_PRIVATE_CERT.Id},
	})

	// Give the ancillary permissions PERMISSION_TEST_LDAP to anyone with READ_AUTHENTICATION_LDAP
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_LDAP.Id),
		Add: []string{model.PERMISSION_READ_LDAP_SYNC_JOB.Id},
	})

	// Give the ancillary permissions PERMISSION_INVALIDATE_EMAIL_INVITE to anyone with WRITE_AUTHENTICATION_EMAIL
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_EMAIL.Id),
		Add: []string{model.PERMISSION_INVALIDATE_EMAIL_INVITE.Id},
	})

	// Give the ancillary permissions for SAML to anyone with WRITE_AUTHENTICATION_SAML
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SAML.Id),
		Add: []string{model.PERMISSION_GET_SAML_METADATA_FROM_IDP.Id, model.PERMISSION_ADD_SAML_PUBLIC_CERT.Id, model.PERMISSION_ADD_SAML_PRIVATE_CERT.Id, model.PERMISSION_ADD_SAML_IDP_CERT.Id, model.PERMISSION_REMOVE_SAML_PUBLIC_CERT.Id, model.PERMISSION_REMOVE_SAML_PRIVATE_CERT.Id, model.PERMISSION_REMOVE_SAML_IDP_CERT.Id, model.PERMISSION_GET_SAML_CERT_STATUS.Id},
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
		{Key: model.MIGRATION_KEY_ADD_EXPERIMENTAL_SUBSECTION_PERMISSIONS, Migration: a.getAddExperimentalSubsectionPermissions},
		{Key: model.MIGRATION_KEY_ADD_AUTHENTICATION_SUBSECTION_PERMISSIONS, Migration: a.getAddAuthenticationSubsectionPermissions},
		{Key: model.MIGRATION_KEY_ADD_INTEGRATIONS_SUBSECTION_PERMISSIONS, Migration: a.getAddIntegrationsSubsectionPermissions},
		{Key: model.MIGRATION_KEY_ADD_SITE_SUBSECTION_PERMISSIONS, Migration: a.getAddSiteSubsectionPermissions},
		{Key: model.MIGRATION_KEY_ADD_COMPLIANCE_SUBSECTION_PERMISSIONS, Migration: a.getAddComplianceSubsectionPermissions},
		{Key: model.MIGRATION_KEY_ADD_ENVIRONMENT_SUBSECTION_PERMISSIONS, Migration: a.getAddEnvironmentSubsectionPermissions},
		{Key: model.MIGRATION_KEY_ADD_ABOUT_SUBSECTION_PERMISSIONS, Migration: a.getAddAboutSubsectionPermissions},
		{Key: model.MIGRATION_KEY_ADD_REPORTING_SUBSECTION_PERMISSIONS, Migration: a.getAddReportingSubsectionPermissions},
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
