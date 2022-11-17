// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
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
	PermissionManageSecureConnections        = "manage_secure_connections"
	PermissionManageRemoteClusters           = "manage_remote_clusters" // deprecated; use `manage_secure_connections`
)

// Warning: This function should only be used in cases where team and channel scheme roles definitely do not need to be migrated.
// Otherwise, use isRoleIncludingSchemes.
func isRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return role.Name == roleName
	}
}

// isRoleIncludingSchemes returns true if roleName matches a role's name field or if the a team
// or channel scheme role matches the "common name".
//
// Common names that will match associated team and/or channel scheme roles are:
//
// TeamAdmin,
// TeamUser,
// TeamGuest,
// ChannelAdmin,
// ChannelUser,
// ChannelGuest,
// PlaybookAdmin,
// PlaybookMember,
// RunAdmin,
// RunMember
func isRoleIncludingSchemes(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		if role.Name == roleName {
			return true
		}
		return isSchemeRoleAssociatedToCommonName(roleName, role)
	}
}

func isNotRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return role.Name != roleName
	}
}

func isSchemeRoleAssociatedToCommonName(roleName string, role *model.Role) bool {
	roleIDToSchemeRoleDisplayName := map[string]string{
		model.TeamAdminRoleId: sqlstore.SchemeRoleDisplayNameTeamAdmin,
		model.TeamUserRoleId:  sqlstore.SchemeRoleDisplayNameTeamUser,
		model.TeamGuestRoleId: sqlstore.SchemeRoleDisplayNameTeamGuest,

		model.ChannelAdminRoleId: sqlstore.SchemeRoleDisplayNameChannelAdmin,
		model.ChannelUserRoleId:  sqlstore.SchemeRoleDisplayNameChannelUser,
		model.ChannelGuestRoleId: sqlstore.SchemeRoleDisplayNameChannelGuest,

		model.PlaybookAdminRoleId:  sqlstore.SchemeRoleDisplayNamePlaybookAdmin,
		model.PlaybookMemberRoleId: sqlstore.SchemeRoleDisplayNamePlaybookMember,

		model.RunAdminRoleId:  sqlstore.SchemeRoleDisplayNameRunAdmin,
		model.RunMemberRoleId: sqlstore.SchemeRoleDisplayNameRunMember,
	}
	displayName, ok := roleIDToSchemeRoleDisplayName[roleName]
	if !ok {
		return false
	}
	return strings.Contains(role.DisplayName, displayName)
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

func (s *Server) doPermissionsMigration(key string, migrationMap permissionsMap, roles []*model.Role) *model.AppError {
	if _, err := s.Store().System().GetByName(key); err == nil {
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
		if _, err := s.Store().Role().Save(role); err != nil {
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &invErr):
				return model.NewAppError("doPermissionsMigration", "app.role.save.invalid_role.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			default:
				return model.NewAppError("doPermissionsMigration", "app.role.save.insert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	if err := s.Store().System().SaveOrUpdate(&model.System{Name: key, Value: "true"}); err != nil {
		return model.NewAppError("doPermissionsMigration", "app.system.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
			On:     isRole(model.SystemAdminRoleId),
			Add:    []string{PermissionListPrivateTeams, PermissionJoinPrivateTeams},
			Remove: []string{},
		},
		permissionTransformation{
			On:     isRole(model.SystemUserRoleId),
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
			On:     isRole(model.SystemAdminRoleId),
			Add:    []string{PermissionCreateBot, PermissionReadBots, PermissionReadOthersBots, PermissionManageBots, PermissionManageOthersBots},
			Remove: []string{},
		},
	}, nil
}

func (a *App) applyChannelManageDeleteToChannelUser() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  permissionAnd(isRole(model.ChannelUserRoleId), onOtherRole(model.TeamUserRoleId, permissionExists(PermissionManagePrivateChannelProperties))),
			Add: []string{PermissionManagePrivateChannelProperties},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.ChannelUserRoleId), onOtherRole(model.TeamUserRoleId, permissionExists(PermissionDeletePrivateChannel))),
			Add: []string{PermissionDeletePrivateChannel},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.ChannelUserRoleId), onOtherRole(model.TeamUserRoleId, permissionExists(PermissionManagePublicChannelProperties))),
			Add: []string{PermissionManagePublicChannelProperties},
		},
		permissionTransformation{
			On:  permissionAnd(isRole(model.ChannelUserRoleId), onOtherRole(model.TeamUserRoleId, permissionExists(PermissionDeletePublicChannel))),
			Add: []string{PermissionDeletePublicChannel},
		},
	}, nil
}

func (a *App) removeChannelManageDeleteFromTeamUser() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionAnd(isRole(model.TeamUserRoleId), permissionExists(PermissionManagePrivateChannelProperties)),
			Remove: []string{PermissionManagePrivateChannelProperties},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TeamUserRoleId), permissionExists(PermissionDeletePrivateChannel)),
			Remove: []string{model.PermissionDeletePrivateChannel.Id},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TeamUserRoleId), permissionExists(PermissionManagePublicChannelProperties)),
			Remove: []string{PermissionManagePublicChannelProperties},
		},
		permissionTransformation{
			On:     permissionAnd(isRole(model.TeamUserRoleId), permissionExists(PermissionDeletePublicChannel)),
			Remove: []string{PermissionDeletePublicChannel},
		},
	}, nil
}

func (a *App) getViewMembersPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SystemUserRoleId),
			Add: []string{PermissionViewMembers},
		},
		permissionTransformation{
			On:  isRole(model.SystemAdminRoleId),
			Add: []string{PermissionViewMembers},
		},
	}, nil
}

func (a *App) getAddManageGuestsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SystemAdminRoleId),
			Add: []string{PermissionPromoteGuest, PermissionDemoteToGuest, PermissionInviteGuest},
		},
	}, nil
}

func (a *App) channelModerationPermissionsMigration() (permissionsMap, error) {
	transformations := permissionsMap{}

	var allTeamSchemes []*model.Scheme
	next := a.SchemesIterator(model.SchemeScopeTeam, 100)
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
		On:  isRole(model.TeamAdminRoleId),
		Add: []string{PermissionCreatePost},
	})

	// ensure channel admins have create_post
	transformations = append(transformations, permissionTransformation{
		On:  isRole(model.ChannelAdminRoleId),
		Add: []string{PermissionCreatePost},
	})

	// conditionally add all other moderated permissions to team and channel admins
	transformations = append(transformations, teamAndChannelAdminConditionalTransformations(
		model.TeamAdminRoleId,
		model.ChannelAdminRoleId,
		model.ChannelUserRoleId,
		model.ChannelGuestRoleId,
	)...)

	// ensure system admin has all of the moderated permissions
	transformations = append(transformations, permissionTransformation{
		On:  isRole(model.SystemAdminRoleId),
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
				isNotRole(model.ChannelGuestRoleId),
				isNotSchemeRole(sqlstore.SchemeRoleDisplayNameChannelGuest),
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
			On:  isRole(model.SystemAdminRoleId),
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
			On:  isRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionSysconsoleReadUserManagementSystemRoles.Id, model.PermissionSysconsoleWriteUserManagementSystemRoles.Id},
		},
	}, nil
}

func (a *App) getAddManageSharedChannelsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SystemAdminRoleId),
			Add: []string{PermissionManageSharedChannels},
		},
	}, nil
}

func (a *App) getBillingPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionSysconsoleReadBilling.Id, model.PermissionSysconsoleWriteBilling.Id},
		},
	}, nil
}

func (a *App) getAddManageSecureConnectionsPermissionsMigration() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	// add the new permission to system admin
	transformations = append(transformations,
		permissionTransformation{
			On:  isRole(model.SystemAdminRoleId),
			Add: []string{PermissionManageSecureConnections},
		})

	// remote the deprecated permission from system admin
	transformations = append(transformations,
		permissionTransformation{
			On:     isRole(model.SystemAdminRoleId),
			Remove: []string{PermissionManageRemoteClusters},
		})

	return transformations, nil
}

func (a *App) getAddDownloadComplianceExportResult() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsToAddComplianceRead := []string{model.PermissionDownloadComplianceExportResult.Id, model.PermissionReadDataRetentionJob.Id}
	permissionsToAddComplianceWrite := []string{model.PermissionManageJobs.Id}

	// add the new permissions to system admin
	transformations = append(transformations,
		permissionTransformation{
			On:  isRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionDownloadComplianceExportResult.Id},
		})

	// add Download Compliance Export Result and Read Jobs to all roles with sysconsole_read_compliance
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadCompliance.Id),
		Add: permissionsToAddComplianceRead,
	})

	// add manage_jobs to all roles with sysconsole_write_compliance
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteCompliance.Id),
		Add: permissionsToAddComplianceWrite,
	})

	return transformations, nil
}

func (a *App) getAddExperimentalSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsExperimentalRead := []string{model.PermissionSysconsoleReadExperimentalBleve.Id, model.PermissionSysconsoleReadExperimentalFeatures.Id, model.PermissionSysconsoleReadExperimentalFeatureFlags.Id}
	permissionsExperimentalWrite := []string{model.PermissionSysconsoleWriteExperimentalBleve.Id, model.PermissionSysconsoleWriteExperimentalFeatures.Id, model.PermissionSysconsoleWriteExperimentalFeatureFlags.Id}

	// Give the new subsection READ permissions to any user with READ_EXPERIMENTAL
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadExperimental.Id),
		Add: permissionsExperimentalRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_EXPERIMENTAL
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteExperimental.Id),
		Add: permissionsExperimentalWrite,
	})

	// Give the ancillary permissions MANAGE_JOBS and PURGE_BLEVE_INDEXES to anyone with WRITE_EXPERIMENTAL_BLEVE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteExperimentalBleve.Id),
		Add: []string{model.PermissionCreatePostBleveIndexesJob.Id, model.PermissionPurgeBleveIndexes.Id},
	})

	return transformations, nil
}

func (a *App) getAddIntegrationsSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsIntegrationsRead := []string{model.PermissionSysconsoleReadIntegrationsIntegrationManagement.Id, model.PermissionSysconsoleReadIntegrationsBotAccounts.Id, model.PermissionSysconsoleReadIntegrationsGif.Id, model.PermissionSysconsoleReadIntegrationsCors.Id}
	permissionsIntegrationsWrite := []string{model.PermissionSysconsoleWriteIntegrationsIntegrationManagement.Id, model.PermissionSysconsoleWriteIntegrationsBotAccounts.Id, model.PermissionSysconsoleWriteIntegrationsGif.Id, model.PermissionSysconsoleWriteIntegrationsCors.Id}

	// Give the new subsection READ permissions to any user with READ_INTEGRATIONS
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadIntegrations.Id),
		Add: permissionsIntegrationsRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_EXPERIMENTAL
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteIntegrations.Id),
		Add: permissionsIntegrationsWrite,
	})

	return transformations, nil
}

func (a *App) getAddSiteSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsSiteRead := []string{model.PermissionSysconsoleReadSiteCustomization.Id, model.PermissionSysconsoleReadSiteLocalization.Id, model.PermissionSysconsoleReadSiteUsersAndTeams.Id, model.PermissionSysconsoleReadSiteNotifications.Id, model.PermissionSysconsoleReadSiteAnnouncementBanner.Id, model.PermissionSysconsoleReadSiteEmoji.Id, model.PermissionSysconsoleReadSitePosts.Id, model.PermissionSysconsoleReadSiteFileSharingAndDownloads.Id, model.PermissionSysconsoleReadSitePublicLinks.Id, model.PermissionSysconsoleReadSiteNotices.Id}
	permissionsSiteWrite := []string{model.PermissionSysconsoleWriteSiteCustomization.Id, model.PermissionSysconsoleWriteSiteLocalization.Id, model.PermissionSysconsoleWriteSiteUsersAndTeams.Id, model.PermissionSysconsoleWriteSiteNotifications.Id, model.PermissionSysconsoleWriteSiteAnnouncementBanner.Id, model.PermissionSysconsoleWriteSiteEmoji.Id, model.PermissionSysconsoleWriteSitePosts.Id, model.PermissionSysconsoleWriteSiteFileSharingAndDownloads.Id, model.PermissionSysconsoleWriteSitePublicLinks.Id, model.PermissionSysconsoleWriteSiteNotices.Id}

	// Give the new subsection READ permissions to any user with READ_SITE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadSite.Id),
		Add: permissionsSiteRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_SITE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteSite.Id),
		Add: permissionsSiteWrite,
	})

	// Give the ancillary permissions EDIT_BRAND to anyone with WRITE_SITE_CUSTOMIZATION
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteSiteCustomization.Id),
		Add: []string{model.PermissionEditBrand.Id},
	})

	return transformations, nil
}

func (a *App) getAddComplianceSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsComplianceRead := []string{model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.PermissionSysconsoleReadComplianceComplianceExport.Id, model.PermissionSysconsoleReadComplianceComplianceMonitoring.Id, model.PermissionSysconsoleReadComplianceCustomTermsOfService.Id}
	permissionsComplianceWrite := []string{model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.PermissionSysconsoleWriteComplianceComplianceExport.Id, model.PermissionSysconsoleWriteComplianceComplianceMonitoring.Id, model.PermissionSysconsoleWriteComplianceCustomTermsOfService.Id}

	// Give the new subsection READ permissions to any user with READ_COMPLIANCE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadCompliance.Id),
		Add: permissionsComplianceRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_COMPLIANCE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteCompliance.Id),
		Add: permissionsComplianceWrite,
	})

	// Ancillary permissions
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id),
		Add: []string{model.PermissionCreateDataRetentionJob.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id),
		Add: []string{model.PermissionReadDataRetentionJob.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteComplianceComplianceExport.Id),
		Add: []string{model.PermissionCreateComplianceExportJob.Id, model.PermissionDownloadComplianceExportResult.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadComplianceComplianceExport.Id),
		Add: []string{model.PermissionReadComplianceExportJob.Id, model.PermissionDownloadComplianceExportResult.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadComplianceCustomTermsOfService.Id),
		Add: []string{model.PermissionReadAudits.Id},
	})

	return transformations, nil
}

func (a *App) getAddEnvironmentSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsEnvironmentRead := []string{
		model.PermissionSysconsoleReadEnvironmentWebServer.Id,
		model.PermissionSysconsoleReadEnvironmentDatabase.Id,
		model.PermissionSysconsoleReadEnvironmentElasticsearch.Id,
		model.PermissionSysconsoleReadEnvironmentFileStorage.Id,
		model.PermissionSysconsoleReadEnvironmentImageProxy.Id,
		model.PermissionSysconsoleReadEnvironmentSMTP.Id,
		model.PermissionSysconsoleReadEnvironmentPushNotificationServer.Id,
		model.PermissionSysconsoleReadEnvironmentHighAvailability.Id,
		model.PermissionSysconsoleReadEnvironmentRateLimiting.Id,
		model.PermissionSysconsoleReadEnvironmentLogging.Id,
		model.PermissionSysconsoleReadEnvironmentSessionLengths.Id,
		model.PermissionSysconsoleReadEnvironmentPerformanceMonitoring.Id,
		model.PermissionSysconsoleReadEnvironmentDeveloper.Id,
	}
	permissionsEnvironmentWrite := []string{
		model.PermissionSysconsoleWriteEnvironmentWebServer.Id,
		model.PermissionSysconsoleWriteEnvironmentDatabase.Id,
		model.PermissionSysconsoleWriteEnvironmentElasticsearch.Id,
		model.PermissionSysconsoleWriteEnvironmentFileStorage.Id,
		model.PermissionSysconsoleWriteEnvironmentImageProxy.Id,
		model.PermissionSysconsoleWriteEnvironmentSMTP.Id,
		model.PermissionSysconsoleWriteEnvironmentPushNotificationServer.Id,
		model.PermissionSysconsoleWriteEnvironmentHighAvailability.Id,
		model.PermissionSysconsoleWriteEnvironmentRateLimiting.Id,
		model.PermissionSysconsoleWriteEnvironmentLogging.Id,
		model.PermissionSysconsoleWriteEnvironmentSessionLengths.Id,
		model.PermissionSysconsoleWriteEnvironmentPerformanceMonitoring.Id,
		model.PermissionSysconsoleWriteEnvironmentDeveloper.Id,
	}

	// Give the new subsection READ permissions to any user with READ_ENVIRONMENT
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadEnvironment.Id),
		Add: permissionsEnvironmentRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_ENVIRONMENT
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteEnvironment.Id),
		Add: permissionsEnvironmentWrite,
	})

	// Give these ancillary permissions to anyone with READ_ENVIRONMENT_ELASTICSEARCH
	transformations = append(transformations, permissionTransformation{
		On: permissionExists(model.PermissionSysconsoleReadEnvironmentElasticsearch.Id),
		Add: []string{
			model.PermissionReadElasticsearchPostIndexingJob.Id,
			model.PermissionReadElasticsearchPostAggregationJob.Id,
		},
	})

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_WEB_SERVER
	transformations = append(transformations, permissionTransformation{
		On: permissionExists(model.PermissionSysconsoleWriteEnvironmentWebServer.Id),
		Add: []string{
			model.PermissionTestSiteURL.Id,
			model.PermissionReloadConfig.Id,
			model.PermissionInvalidateCaches.Id,
		},
	})

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_DATABASE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteEnvironmentDatabase.Id),
		Add: []string{model.PermissionRecycleDatabaseConnections.Id},
	})

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_ELASTICSEARCH
	transformations = append(transformations, permissionTransformation{
		On: permissionExists(model.PermissionSysconsoleWriteEnvironmentElasticsearch.Id),
		Add: []string{
			model.PermissionTestElasticsearch.Id,
			model.PermissionCreateElasticsearchPostIndexingJob.Id,
			model.PermissionCreateElasticsearchPostAggregationJob.Id,
			model.PermissionPurgeElasticsearchIndexes.Id,
		},
	})

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_FILE_STORAGE
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteEnvironmentFileStorage.Id),
		Add: []string{model.PermissionTestS3.Id},
	})

	return transformations, nil
}

func (a *App) getAddAboutSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsAboutRead := []string{model.PermissionSysconsoleReadAboutEditionAndLicense.Id}
	permissionsAboutWrite := []string{model.PermissionSysconsoleWriteAboutEditionAndLicense.Id}

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadAbout.Id),
		Add: permissionsAboutRead,
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteAbout.Id),
		Add: permissionsAboutWrite,
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadAboutEditionAndLicense.Id),
		Add: []string{model.PermissionReadLicenseInformation.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteAboutEditionAndLicense.Id),
		Add: []string{model.PermissionManageLicenseInformation.Id},
	})

	return transformations, nil
}

func (a *App) getAddReportingSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsReportingRead := []string{
		model.PermissionSysconsoleReadReportingSiteStatistics.Id,
		model.PermissionSysconsoleReadReportingTeamStatistics.Id,
		model.PermissionSysconsoleReadReportingServerLogs.Id,
	}
	permissionsReportingWrite := []string{
		model.PermissionSysconsoleWriteReportingSiteStatistics.Id,
		model.PermissionSysconsoleWriteReportingTeamStatistics.Id,
		model.PermissionSysconsoleWriteReportingServerLogs.Id,
	}

	// Give the new subsection READ permissions to any user with READ_REPORTING
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadReporting.Id),
		Add: permissionsReportingRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_REPORTING
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteReporting.Id),
		Add: permissionsReportingWrite,
	})

	// Give the ancillary permissions PERMISSION_GET_ANALYTICS to anyone with PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS or PERMISSION_SYSCONSOLE_READ_REPORTING_SITE_STATISTICS
	transformations = append(transformations, permissionTransformation{
		On:  permissionOr(permissionExists(model.PermissionSysconsoleReadUserManagementUsers.Id), permissionExists(model.PermissionSysconsoleReadReportingSiteStatistics.Id)),
		Add: []string{model.PermissionGetAnalytics.Id},
	})

	// Give the ancillary permissions PERMISSION_GET_LOGS to anyone with PERMISSION_SYSCONSOLE_READ_REPORTING_SERVER_LOGS
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadReportingServerLogs.Id),
		Add: []string{model.PermissionGetLogs.Id},
	})

	return transformations, nil
}

func (a *App) getAddAuthenticationSubsectionPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsAuthenticationRead := []string{model.PermissionSysconsoleReadAuthenticationSignup.Id, model.PermissionSysconsoleReadAuthenticationEmail.Id, model.PermissionSysconsoleReadAuthenticationPassword.Id, model.PermissionSysconsoleReadAuthenticationMfa.Id, model.PermissionSysconsoleReadAuthenticationLdap.Id, model.PermissionSysconsoleReadAuthenticationSaml.Id, model.PermissionSysconsoleReadAuthenticationOpenid.Id, model.PermissionSysconsoleReadAuthenticationGuestAccess.Id}
	permissionsAuthenticationWrite := []string{model.PermissionSysconsoleWriteAuthenticationSignup.Id, model.PermissionSysconsoleWriteAuthenticationEmail.Id, model.PermissionSysconsoleWriteAuthenticationPassword.Id, model.PermissionSysconsoleWriteAuthenticationMfa.Id, model.PermissionSysconsoleWriteAuthenticationLdap.Id, model.PermissionSysconsoleWriteAuthenticationSaml.Id, model.PermissionSysconsoleWriteAuthenticationOpenid.Id, model.PermissionSysconsoleWriteAuthenticationGuestAccess.Id}

	// Give the new subsection READ permissions to any user with READ_AUTHENTICATION
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadAuthentication.Id),
		Add: permissionsAuthenticationRead,
	})

	// Give the new subsection WRITE permissions to any user with WRITE_AUTHENTICATION
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteAuthentication.Id),
		Add: permissionsAuthenticationWrite,
	})

	// Give the ancillary permissions for LDAP to anyone with WRITE_AUTHENTICATION_LDAP
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteAuthenticationLdap.Id),
		Add: []string{model.PermissionCreateLdapSyncJob.Id, model.PermissionTestLdap.Id, model.PermissionAddLdapPublicCert.Id, model.PermissionAddLdapPrivateCert.Id, model.PermissionRemoveLdapPublicCert.Id, model.PermissionRemoveLdapPrivateCert.Id},
	})

	// Give the ancillary permissions PERMISSION_TEST_LDAP to anyone with READ_AUTHENTICATION_LDAP
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadAuthenticationLdap.Id),
		Add: []string{model.PermissionReadLdapSyncJob.Id},
	})

	// Give the ancillary permissions PERMISSION_INVALIDATE_EMAIL_INVITE to anyone with WRITE_AUTHENTICATION_EMAIL
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteAuthenticationEmail.Id),
		Add: []string{model.PermissionInvalidateEmailInvite.Id},
	})

	// Give the ancillary permissions for SAML to anyone with WRITE_AUTHENTICATION_SAML
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteAuthenticationSaml.Id),
		Add: []string{model.PermissionGetSamlMetadataFromIdp.Id, model.PermissionAddSamlPublicCert.Id, model.PermissionAddSamlPrivateCert.Id, model.PermissionAddSamlIdpCert.Id, model.PermissionRemoveSamlPublicCert.Id, model.PermissionRemoveSamlPrivateCert.Id, model.PermissionRemoveSamlIdpCert.Id, model.PermissionGetSamlCertStatus.Id},
	})

	return transformations, nil
}

// This migration fixes https://github.com/mattermost/mattermost-server/issues/17642 where this particular ancillary permission was forgotten during the initial migrations
func (a *App) getAddTestEmailAncillaryPermission() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_SMTP
	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleWriteEnvironmentSMTP.Id),
		Add: []string{model.PermissionTestEmail.Id},
	})

	return transformations, nil
}

func (a *App) getAddCustomUserGroupsPermissions() (permissionsMap, error) {
	t := []permissionTransformation{}

	customGroupPermissions := []string{
		model.PermissionCreateCustomGroup.Id,
		model.PermissionManageCustomGroupMembers.Id,
		model.PermissionEditCustomGroup.Id,
		model.PermissionDeleteCustomGroup.Id,
	}

	t = append(t, permissionTransformation{
		On:  isRole(model.SystemUserRoleId),
		Add: customGroupPermissions,
	})

	t = append(t, permissionTransformation{
		On:  isRole(model.SystemAdminRoleId),
		Add: customGroupPermissions,
	})

	return t, nil
}

func (a *App) getAddPlaybooksPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	transformations = append(transformations, permissionTransformation{
		On: permissionOr(
			permissionExists(model.PermissionCreatePublicChannel.Id),
			permissionExists(model.PermissionCreatePrivateChannel.Id),
		),
		Add: []string{
			model.PermissionPublicPlaybookCreate.Id,
			model.PermissionPrivatePlaybookCreate.Id,
		},
	})

	transformations = append(transformations, permissionTransformation{
		On: isRole(model.SystemAdminRoleId),
		Add: []string{
			model.PermissionPublicPlaybookManageProperties.Id,
			model.PermissionPublicPlaybookManageMembers.Id,
			model.PermissionPublicPlaybookView.Id,
			model.PermissionPublicPlaybookMakePrivate.Id,
			model.PermissionPrivatePlaybookManageProperties.Id,
			model.PermissionPrivatePlaybookManageMembers.Id,
			model.PermissionPrivatePlaybookView.Id,
			model.PermissionPrivatePlaybookMakePublic.Id,
			model.PermissionRunCreate.Id,
			model.PermissionRunManageProperties.Id,
			model.PermissionRunManageMembers.Id,
			model.PermissionRunView.Id,
		},
	})

	return transformations, nil
}

func (a *App) getPlaybooksPermissionsAddManageRoles() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	transformations = append(transformations, permissionTransformation{
		On: permissionOr(
			isRole(model.PlaybookAdminRoleId),
			isRole(model.TeamAdminRoleId),
			isRole(model.SystemAdminRoleId),
		),
		Add: []string{
			model.PermissionPublicPlaybookManageRoles.Id,
			model.PermissionPrivatePlaybookManageRoles.Id,
		},
	})

	return transformations, nil
}

func (a *App) getProductsBoardsPermissions() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	permissionsProductsRead := []string{model.PermissionSysconsoleReadProductsBoards.Id}
	permissionsProductsWrite := []string{model.PermissionSysconsoleWriteProductsBoards.Id}

	// Give the new subsection READ permissions to any user with SYSTEM_MANAGER
	transformations = append(transformations, permissionTransformation{
		On:  permissionOr(isRole(model.SystemManagerRoleId)),
		Add: permissionsProductsRead,
	})

	// Give the new subsection WRITE permissions to any user with SYSTEM_ADMIN
	transformations = append(transformations, permissionTransformation{
		On:  permissionOr(isRole(model.SystemAdminRoleId)),
		Add: permissionsProductsWrite,
	})

	return transformations, nil
}

// DoPermissionsMigrations execute all the permissions migrations need by the current version.
func (a *App) DoPermissionsMigrations() error {
	return a.Srv().doPermissionsMigrations()
}

func (s *Server) doPermissionsMigrations() error {
	a := New(ServerConnector(s.Channels()))
	PermissionsMigrations := []struct {
		Key       string
		Migration func() (permissionsMap, error)
	}{
		{Key: model.MigrationKeyEmojiPermissionsSplit, Migration: a.getEmojisPermissionsSplitMigration},
		{Key: model.MigrationKeyWebhookPermissionsSplit, Migration: a.getWebhooksPermissionsSplitMigration},
		{Key: model.MigrationKeyListJoinPublicPrivateTeams, Migration: a.getListJoinPublicPrivateTeamsPermissionsMigration},
		{Key: model.MigrationKeyRemovePermanentDeleteUser, Migration: a.removePermanentDeleteUserMigration},
		{Key: model.MigrationKeyAddBotPermissions, Migration: a.getAddBotPermissionsMigration},
		{Key: model.MigrationKeyApplyChannelManageDeleteToChannelUser, Migration: a.applyChannelManageDeleteToChannelUser},
		{Key: model.MigrationKeyRemoveChannelManageDeleteFromTeamUser, Migration: a.removeChannelManageDeleteFromTeamUser},
		{Key: model.MigrationKeyViewMembersNewPermission, Migration: a.getViewMembersPermissionMigration},
		{Key: model.MigrationKeyAddManageGuestsPermissions, Migration: a.getAddManageGuestsPermissionsMigration},
		{Key: model.MigrationKeyChannelModerationsPermissions, Migration: a.channelModerationPermissionsMigration},
		{Key: model.MigrationKeyAddUseGroupMentionsPermission, Migration: a.getAddUseGroupMentionsPermissionMigration},
		{Key: model.MigrationKeyAddSystemConsolePermissions, Migration: a.getAddSystemConsolePermissionsMigration},
		{Key: model.MigrationKeyAddConvertChannelPermissions, Migration: a.getAddConvertChannelPermissionsMigration},
		{Key: model.MigrationKeyAddManageSharedChannelPermissions, Migration: a.getAddManageSharedChannelsPermissionsMigration},
		{Key: model.MigrationKeyAddManageSecureConnectionsPermissions, Migration: a.getAddManageSecureConnectionsPermissionsMigration},
		{Key: model.MigrationKeyAddSystemRolesPermissions, Migration: a.getSystemRolesPermissionsMigration},
		{Key: model.MigrationKeyAddBillingPermissions, Migration: a.getBillingPermissionsMigration},
		{Key: model.MigrationKeyAddDownloadComplianceExportResults, Migration: a.getAddDownloadComplianceExportResult},
		{Key: model.MigrationKeyAddExperimentalSubsectionPermissions, Migration: a.getAddExperimentalSubsectionPermissions},
		{Key: model.MigrationKeyAddAuthenticationSubsectionPermissions, Migration: a.getAddAuthenticationSubsectionPermissions},
		{Key: model.MigrationKeyAddIntegrationsSubsectionPermissions, Migration: a.getAddIntegrationsSubsectionPermissions},
		{Key: model.MigrationKeyAddSiteSubsectionPermissions, Migration: a.getAddSiteSubsectionPermissions},
		{Key: model.MigrationKeyAddComplianceSubsectionPermissions, Migration: a.getAddComplianceSubsectionPermissions},
		{Key: model.MigrationKeyAddEnvironmentSubsectionPermissions, Migration: a.getAddEnvironmentSubsectionPermissions},
		{Key: model.MigrationKeyAddAboutSubsectionPermissions, Migration: a.getAddAboutSubsectionPermissions},
		{Key: model.MigrationKeyAddReportingSubsectionPermissions, Migration: a.getAddReportingSubsectionPermissions},
		{Key: model.MigrationKeyAddTestEmailAncillaryPermission, Migration: a.getAddTestEmailAncillaryPermission},
		{Key: model.MigrationKeyAddPlaybooksPermissions, Migration: a.getAddPlaybooksPermissions},
		{Key: model.MigrationKeyAddCustomUserGroupsPermissions, Migration: a.getAddCustomUserGroupsPermissions},
		{Key: model.MigrationKeyAddPlayboosksManageRolesPermissions, Migration: a.getPlaybooksPermissionsAddManageRoles},
		{Key: model.MigrationKeyAddProductsBoardsPermissions, Migration: a.getProductsBoardsPermissions},
	}

	roles, err := s.Store().Role().GetAll()
	if err != nil {
		return err
	}

	for _, migration := range PermissionsMigrations {
		migMap, err := migration.Migration()
		if err != nil {
			return err
		}
		if err := s.doPermissionsMigration(migration.Key, migMap, roles); err != nil {
			return err
		}
	}
	return nil
}
