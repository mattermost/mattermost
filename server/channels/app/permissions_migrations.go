// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate go run ./generator/generate_default_roles_permissions.go -out ../../../e2e-tests/cypress/tests/support/api/default_roles_permissions.js

package app

import (
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

type permissionTransformation struct {
	On     func(*model.Role, map[string]map[string]bool) bool
	Add    []string
	Remove []string
}
type permissionsMap []permissionTransformation

const (
	PermissionManageSystem                        = "manage_system"
	PermissionManageTeam                          = "manage_team"
	PermissionManageEmojis                        = "manage_emojis"
	PermissionManageOthersEmojis                  = "manage_others_emojis"
	PermissionCreateEmojis                        = "create_emojis"
	PermissionDeleteEmojis                        = "delete_emojis"
	PermissionDeleteOthersEmojis                  = "delete_others_emojis"
	PermissionManageWebhooks                      = "manage_webhooks"
	PermissionManageOthersWebhooks                = "manage_others_webhooks"
	PermissionManageIncomingWebhooks              = "manage_incoming_webhooks"
	PermissionManageOwnIncomingWebhooks           = "manage_own_incoming_webhooks"
	PermissionManageOthersIncomingWebhooks        = "manage_others_incoming_webhooks"
	PermissionManageOutgoingWebhooks              = "manage_outgoing_webhooks"
	PermissionManageOwnOutgoingWebhooks           = "manage_own_outgoing_webhooks"
	PermissionManageOthersOutgoingWebhooks        = "manage_others_outgoing_webhooks"
	PermissionBypassIncomingWebhookChannelLock    = "bypass_incoming_webhook_channel_lock"
	PermissionListPublicTeams                     = "list_public_teams"
	PermissionListPrivateTeams                    = "list_private_teams"
	PermissionJoinPublicTeams                     = "join_public_teams"
	PermissionJoinPrivateTeams                    = "join_private_teams"
	PermissionPermanentDeleteUser                 = "permanent_delete_user"
	PermissionCreateBot                           = "create_bot"
	PermissionReadBots                            = "read_bots"
	PermissionReadOthersBots                      = "read_others_bots"
	PermissionManageBots                          = "manage_bots"
	PermissionManageOthersBots                    = "manage_others_bots"
	PermissionManageSlashCommands                 = "manage_slash_commands"
	PermissionManageOwnSlashCommands              = "manage_own_slash_commands"
	PermissionDeletePublicChannel                 = "delete_public_channel"
	PermissionDeletePrivateChannel                = "delete_private_channel"
	PermissionManagePublicChannelProperties       = "manage_public_channel_properties"
	PermissionManagePrivateChannelProperties      = "manage_private_channel_properties"
	PermissionManagePublicChannelAutoTranslation  = "manage_public_channel_auto_translation"
	PermissionManagePrivateChannelAutoTranslation = "manage_private_channel_auto_translation"
	PermissionConvertPublicChannelToPrivate       = "convert_public_channel_to_private"
	PermissionConvertPrivateChannelToPublic       = "convert_private_channel_to_public"
	PermissionViewMembers                         = "view_members"
	PermissionInviteUser                          = "invite_user"
	PermissionInviteGuest                         = "invite_guest"
	PermissionPromoteGuest                        = "promote_guest"
	PermissionDemoteToGuest                       = "demote_to_guest"
	PermissionUseChannelMentions                  = "use_channel_mentions"
	PermissionCreatePost                          = "create_post"
	PermissionCreatePost_PUBLIC                   = "create_post_public"
	PermissionUseGroupMentions                    = "use_group_mentions"
	PermissionAddReaction                         = "add_reaction"
	PermissionRemoveReaction                      = "remove_reaction"
	PermissionManagePublicChannelMembers          = "manage_public_channel_members"
	PermissionManagePrivateChannelMembers         = "manage_private_channel_members"
	PermissionReadJobs                            = "read_jobs"
	PermissionManageJobs                          = "manage_jobs"
	PermissionReadOtherUsersTeams                 = "read_other_users_teams"
	PermissionEditOtherUsers                      = "edit_other_users"
	PermissionReadPublicChannelGroups             = "read_public_channel_groups"
	PermissionReadPrivateChannelGroups            = "read_private_channel_groups"
	PermissionEditBrand                           = "edit_brand"
	PermissionManageSharedChannels                = "manage_shared_channels"
	PermissionManageSecureConnections             = "manage_secure_connections"
	PermissionManageOAuth                         = "manage_oauth"
	PermissionManageRemoteClusters                = "manage_remote_clusters" // deprecated; use `manage_secure_connections`
)

// Deprecated: This function should only be used if a case arises where team and/or channel scheme roles do not need to be migrated.
// Otherwise, use isRole.
func isExactRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return role.Name == roleName
	}
}

// isRole returns true if roleName matches a role's name field or if the team
// or channel scheme role matches a "common name". A common name is one of the following role
// that is common among the system scheme and the team and/or channel schemes:
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
func isRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		if role.Name == roleName {
			return true
		}
		return isSchemeRoleAssociatedToCommonName(roleName, role)
	}
}

// Deprecated: use isNotRole instead.
func isNotExactRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return role.Name != roleName
	}
}

func isNotRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, permissionsMap map[string]map[string]bool) bool {
		return role.Name != roleName && !isSchemeRoleAssociatedToCommonName(roleName, role)
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
	return strings.HasPrefix(role.DisplayName, displayName)
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

func getEmojisPermissionsSplitMigration() (permissionsMap, error) {
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

func getWebhooksPermissionsSplitMigration() (permissionsMap, error) {
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

func getIntegrationsOwnPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionExists(PermissionManageIncomingWebhooks),
			Add:    []string{PermissionManageOwnIncomingWebhooks, PermissionBypassIncomingWebhookChannelLock},
			Remove: []string{PermissionManageIncomingWebhooks},
		},
		permissionTransformation{
			On:     permissionExists(PermissionManageOutgoingWebhooks),
			Add:    []string{PermissionManageOwnOutgoingWebhooks},
			Remove: []string{PermissionManageOutgoingWebhooks},
		},
		permissionTransformation{
			On:     permissionExists(PermissionManageSlashCommands),
			Add:    []string{PermissionManageOwnSlashCommands},
			Remove: []string{PermissionManageSlashCommands},
		},
		// Ensure system admin has the new "manage others" permissions
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionManageOthersIncomingWebhooks.Id, model.PermissionManageOthersOutgoingWebhooks.Id, model.PermissionManageOthersSlashCommands.Id},
		},
		// Ensure team admin (including scheme team admins) have the new "manage others" permissions
		permissionTransformation{
			On:  isRole(model.TeamAdminRoleId),
			Add: []string{model.PermissionManageOthersIncomingWebhooks.Id, model.PermissionManageOthersOutgoingWebhooks.Id, model.PermissionManageOthersSlashCommands.Id},
		},
	}, nil
}

func getListJoinPublicPrivateTeamsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     isExactRole(model.SystemAdminRoleId),
			Add:    []string{PermissionListPrivateTeams, PermissionJoinPrivateTeams},
			Remove: []string{},
		},
		permissionTransformation{
			On:     isExactRole(model.SystemUserRoleId),
			Add:    []string{PermissionListPublicTeams, PermissionJoinPublicTeams},
			Remove: []string{},
		},
	}, nil
}

func removePermanentDeleteUserMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionExists(PermissionPermanentDeleteUser),
			Remove: []string{PermissionPermanentDeleteUser},
		},
	}, nil
}

func getAddBotPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     isExactRole(model.SystemAdminRoleId),
			Add:    []string{PermissionCreateBot, PermissionReadBots, PermissionReadOthersBots, PermissionManageBots, PermissionManageOthersBots},
			Remove: []string{},
		},
	}, nil
}

func applyChannelManageDeleteToChannelUser() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  permissionAnd(isExactRole(model.ChannelUserRoleId), onOtherRole(model.TeamUserRoleId, permissionExists(PermissionManagePrivateChannelProperties))),
			Add: []string{PermissionManagePrivateChannelProperties},
		},
		permissionTransformation{
			On:  permissionAnd(isExactRole(model.ChannelUserRoleId), onOtherRole(model.TeamUserRoleId, permissionExists(PermissionDeletePrivateChannel))),
			Add: []string{PermissionDeletePrivateChannel},
		},
		permissionTransformation{
			On:  permissionAnd(isExactRole(model.ChannelUserRoleId), onOtherRole(model.TeamUserRoleId, permissionExists(PermissionManagePublicChannelProperties))),
			Add: []string{PermissionManagePublicChannelProperties},
		},
		permissionTransformation{
			On:  permissionAnd(isExactRole(model.ChannelUserRoleId), onOtherRole(model.TeamUserRoleId, permissionExists(PermissionDeletePublicChannel))),
			Add: []string{PermissionDeletePublicChannel},
		},
	}, nil
}

func removeChannelManageDeleteFromTeamUser() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:     permissionAnd(isExactRole(model.TeamUserRoleId), permissionExists(PermissionManagePrivateChannelProperties)),
			Remove: []string{PermissionManagePrivateChannelProperties},
		},
		permissionTransformation{
			On:     permissionAnd(isExactRole(model.TeamUserRoleId), permissionExists(PermissionDeletePrivateChannel)),
			Remove: []string{model.PermissionDeletePrivateChannel.Id},
		},
		permissionTransformation{
			On:     permissionAnd(isExactRole(model.TeamUserRoleId), permissionExists(PermissionManagePublicChannelProperties)),
			Remove: []string{PermissionManagePublicChannelProperties},
		},
		permissionTransformation{
			On:     permissionAnd(isExactRole(model.TeamUserRoleId), permissionExists(PermissionDeletePublicChannel)),
			Remove: []string{PermissionDeletePublicChannel},
		},
	}, nil
}

func getViewMembersPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SystemUserRoleId),
			Add: []string{PermissionViewMembers},
		},
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{PermissionViewMembers},
		},
	}, nil
}

func getAddManageGuestsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{PermissionPromoteGuest, PermissionDemoteToGuest, PermissionInviteGuest},
		},
	}, nil
}

func channelModerationPermissionsMigration(allTeamSchemes []*model.Scheme) permissionsMap {
	transformations := permissionsMap{}

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
					isExactRole(channelAdminID),
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
					isExactRole(teamAdminID),
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
			On:  isExactRole(ts.DefaultChannelAdminRole),
			Add: []string{PermissionCreatePost},
		}
		transformations = append(transformations, trans)

		// ensure all team scheme team admins have create_post because it's not exposed via the UI
		trans = permissionTransformation{
			On:  isExactRole(ts.DefaultTeamAdminRole),
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
		On:  isExactRole(model.TeamAdminRoleId),
		Add: []string{PermissionCreatePost},
	})

	// ensure channel admins have create_post
	transformations = append(transformations, permissionTransformation{
		On:  isExactRole(model.ChannelAdminRoleId),
		Add: []string{PermissionCreatePost},
	})

	// conditionally add all other moderated permissions to team and channel admins
	transformations = append(transformations, teamAndChannelAdminConditionalTransformations(
		model.TeamAdminRoleId,
		model.ChannelAdminRoleId,
		model.ChannelUserRoleId,
		model.ChannelGuestRoleId,
	)...)

	// ensure system admin has all the moderated permissions
	transformations = append(transformations, permissionTransformation{
		On:  isExactRole(model.SystemAdminRoleId),
		Add: append(moderatedPermissionsMinusCreatePost, PermissionCreatePost),
	})

	// add the new use_channel_mentions permission to everyone who has create_post
	transformations = append(transformations, permissionTransformation{
		On:  permissionOr(permissionExists(PermissionCreatePost), permissionExists(PermissionCreatePost_PUBLIC)),
		Add: []string{PermissionUseChannelMentions},
	})

	return transformations
}

// makeChannelModerationPermissionsMigration returns a migration function for channel
// moderation permissions. Unlike the other migrations which are purely static, this one
// needs to query all team schemes from the database to generate its transformations.
func makeChannelModerationPermissionsMigration(getAllTeamSchemes func() []*model.Scheme) func() (permissionsMap, error) {
	return func() (permissionsMap, error) {
		return channelModerationPermissionsMigration(getAllTeamSchemes()), nil
	}
}

func getAddUseGroupMentionsPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionAnd(
				isNotExactRole(model.ChannelGuestRoleId),
				isNotSchemeRole(sqlstore.SchemeRoleDisplayNameChannelGuest),
				permissionOr(permissionExists(PermissionCreatePost), permissionExists(PermissionCreatePost_PUBLIC)),
			),
			Add: []string{PermissionUseGroupMentions},
		},
	}, nil
}

func getAddSystemConsolePermissionsMigration() (permissionsMap, error) {
	permissionsToAdd := []string{}
	for _, permission := range append(model.SysconsoleReadPermissions, model.SysconsoleWritePermissions...) {
		permissionsToAdd = append(permissionsToAdd, permission.Id)
	}

	return permissionsMap{
		// add the new permissions to system admin
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: permissionsToAdd,
		},
		// add read_jobs to all roles with manage_jobs
		permissionTransformation{
			On:  permissionExists(PermissionManageJobs),
			Add: []string{PermissionReadJobs},
		},
		// add read_other_users_teams to all roles with edit_other_users
		permissionTransformation{
			On:  permissionExists(PermissionEditOtherUsers),
			Add: []string{PermissionReadOtherUsersTeams},
		},
		// add read_public_channel_groups to all roles with manage_public_channel_members
		permissionTransformation{
			On:  permissionExists(PermissionManagePublicChannelMembers),
			Add: []string{PermissionReadPublicChannelGroups},
		},
		// add read_private_channel_groups to all roles with manage_private_channel_members
		permissionTransformation{
			On:  permissionExists(PermissionManagePrivateChannelMembers),
			Add: []string{PermissionReadPrivateChannelGroups},
		},
		// add edit_brand to all roles with manage_system
		permissionTransformation{
			On:  permissionExists(PermissionManageSystem),
			Add: []string{PermissionEditBrand},
		},
	}, nil
}

func getAddConvertChannelPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  permissionExists(PermissionManageTeam),
			Add: []string{PermissionConvertPublicChannelToPrivate, PermissionConvertPrivateChannelToPublic},
		},
	}, nil
}

func getSystemRolesPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionSysconsoleReadUserManagementSystemRoles.Id, model.PermissionSysconsoleWriteUserManagementSystemRoles.Id},
		},
	}, nil
}

func getAddManageSharedChannelsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{PermissionManageSharedChannels},
		},
	}, nil
}

func getBillingPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionSysconsoleReadBilling.Id, model.PermissionSysconsoleWriteBilling.Id},
		},
	}, nil
}

func getAddManageSecureConnectionsPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		// add the new permission to system admin
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{PermissionManageSecureConnections},
		},
		// remove the deprecated permission from system admin
		permissionTransformation{
			On:     isExactRole(model.SystemAdminRoleId),
			Remove: []string{PermissionManageRemoteClusters},
		},
	}, nil
}

func getAddDownloadComplianceExportResult() (permissionsMap, error) {
	return permissionsMap{
		// add the new permissions to system admin
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionDownloadComplianceExportResult.Id},
		},
		// add Download Compliance Export Result and Read Jobs to all roles with sysconsole_read_compliance
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadCompliance.Id),
			Add: []string{model.PermissionDownloadComplianceExportResult.Id, model.PermissionReadDataRetentionJob.Id},
		},
		// add manage_jobs to all roles with sysconsole_write_compliance
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteCompliance.Id),
			Add: []string{model.PermissionManageJobs.Id},
		},
	}, nil
}

func getAddExperimentalSubsectionPermissions() (permissionsMap, error) {
	return permissionsMap{
		// Give the new subsection READ permissions to any user with READ_EXPERIMENTAL
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadExperimental.Id),
			Add: []string{model.PermissionSysconsoleReadExperimentalFeatures.Id, model.PermissionSysconsoleReadExperimentalFeatureFlags.Id},
		},
		// Give the new subsection WRITE permissions to any user with WRITE_EXPERIMENTAL
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteExperimental.Id),
			Add: []string{model.PermissionSysconsoleWriteExperimentalFeatures.Id, model.PermissionSysconsoleWriteExperimentalFeatureFlags.Id},
		},
	}, nil
}

func getAddIntegrationsSubsectionPermissions() (permissionsMap, error) {
	permissionsIntegrationsRead := []string{model.PermissionSysconsoleReadIntegrationsIntegrationManagement.Id, model.PermissionSysconsoleReadIntegrationsBotAccounts.Id, model.PermissionSysconsoleReadIntegrationsGif.Id, model.PermissionSysconsoleReadIntegrationsCors.Id}
	permissionsIntegrationsWrite := []string{model.PermissionSysconsoleWriteIntegrationsIntegrationManagement.Id, model.PermissionSysconsoleWriteIntegrationsBotAccounts.Id, model.PermissionSysconsoleWriteIntegrationsGif.Id, model.PermissionSysconsoleWriteIntegrationsCors.Id}

	return permissionsMap{
		// Give the new subsection READ permissions to any user with READ_INTEGRATIONS
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadIntegrations.Id),
			Add: permissionsIntegrationsRead,
		},
		// Give the new subsection WRITE permissions to any user with WRITE_EXPERIMENTAL
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteIntegrations.Id),
			Add: permissionsIntegrationsWrite,
		},
	}, nil
}

func getAddSiteSubsectionPermissions() (permissionsMap, error) {
	permissionsSiteRead := []string{model.PermissionSysconsoleReadSiteCustomization.Id, model.PermissionSysconsoleReadSiteLocalization.Id, model.PermissionSysconsoleReadSiteUsersAndTeams.Id, model.PermissionSysconsoleReadSiteNotifications.Id, model.PermissionSysconsoleReadSiteAnnouncementBanner.Id, model.PermissionSysconsoleReadSiteEmoji.Id, model.PermissionSysconsoleReadSitePosts.Id, model.PermissionSysconsoleReadSiteFileSharingAndDownloads.Id, model.PermissionSysconsoleReadSitePublicLinks.Id, model.PermissionSysconsoleReadSiteNotices.Id}
	permissionsSiteWrite := []string{model.PermissionSysconsoleWriteSiteCustomization.Id, model.PermissionSysconsoleWriteSiteLocalization.Id, model.PermissionSysconsoleWriteSiteUsersAndTeams.Id, model.PermissionSysconsoleWriteSiteNotifications.Id, model.PermissionSysconsoleWriteSiteAnnouncementBanner.Id, model.PermissionSysconsoleWriteSiteEmoji.Id, model.PermissionSysconsoleWriteSitePosts.Id, model.PermissionSysconsoleWriteSiteFileSharingAndDownloads.Id, model.PermissionSysconsoleWriteSitePublicLinks.Id, model.PermissionSysconsoleWriteSiteNotices.Id}

	return permissionsMap{
		// Give the new subsection READ permissions to any user with READ_SITE
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadSite.Id),
			Add: permissionsSiteRead,
		},
		// Give the new subsection WRITE permissions to any user with WRITE_SITE
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteSite.Id),
			Add: permissionsSiteWrite,
		},
		// Give the ancillary permissions EDIT_BRAND to anyone with WRITE_SITE_CUSTOMIZATION
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteSiteCustomization.Id),
			Add: []string{model.PermissionEditBrand.Id},
		},
	}, nil
}

func getAddComplianceSubsectionPermissions() (permissionsMap, error) {
	permissionsComplianceRead := []string{model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.PermissionSysconsoleReadComplianceComplianceExport.Id, model.PermissionSysconsoleReadComplianceComplianceMonitoring.Id, model.PermissionSysconsoleReadComplianceCustomTermsOfService.Id}
	permissionsComplianceWrite := []string{model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.PermissionSysconsoleWriteComplianceComplianceExport.Id, model.PermissionSysconsoleWriteComplianceComplianceMonitoring.Id, model.PermissionSysconsoleWriteComplianceCustomTermsOfService.Id}

	return permissionsMap{
		// Give the new subsection READ permissions to any user with READ_COMPLIANCE
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadCompliance.Id),
			Add: permissionsComplianceRead,
		},
		// Give the new subsection WRITE permissions to any user with WRITE_COMPLIANCE
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteCompliance.Id),
			Add: permissionsComplianceWrite,
		},
		// Ancillary permissions
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id),
			Add: []string{model.PermissionCreateDataRetentionJob.Id},
		},
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id),
			Add: []string{model.PermissionReadDataRetentionJob.Id},
		},
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteComplianceComplianceExport.Id),
			Add: []string{model.PermissionCreateComplianceExportJob.Id, model.PermissionDownloadComplianceExportResult.Id},
		},
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadComplianceComplianceExport.Id),
			Add: []string{model.PermissionReadComplianceExportJob.Id, model.PermissionDownloadComplianceExportResult.Id},
		},
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadComplianceCustomTermsOfService.Id),
			Add: []string{model.PermissionReadAudits.Id},
		},
	}, nil
}

func getAddEnvironmentSubsectionPermissions() (permissionsMap, error) {
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

	permissionsElasticsearchRead := []string{
		model.PermissionReadElasticsearchPostIndexingJob.Id,
		model.PermissionReadElasticsearchPostAggregationJob.Id,
	}

	permissionsElasticsearchWrite := []string{
		model.PermissionTestElasticsearch.Id,
		model.PermissionCreateElasticsearchPostIndexingJob.Id,
		model.PermissionCreateElasticsearchPostAggregationJob.Id,
		model.PermissionPurgeElasticsearchIndexes.Id,
	}

	permissionsWebServerWrite := []string{
		model.PermissionTestSiteURL.Id,
		model.PermissionReloadConfig.Id,
		model.PermissionInvalidateCaches.Id,
	}

	return permissionsMap{
		// Give the new subsection READ permissions to any user with READ_ENVIRONMENT
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadEnvironment.Id),
			Add: permissionsEnvironmentRead,
		},
		// Give the new subsection WRITE permissions to any user with WRITE_ENVIRONMENT
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteEnvironment.Id),
			Add: permissionsEnvironmentWrite,
		},
		// Give these ancillary permissions to anyone with READ_ENVIRONMENT_ELASTICSEARCH
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadEnvironmentElasticsearch.Id),
			Add: permissionsElasticsearchRead,
		},
		// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_WEB_SERVER
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteEnvironmentWebServer.Id),
			Add: permissionsWebServerWrite,
		},
		// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_DATABASE
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteEnvironmentDatabase.Id),
			Add: []string{model.PermissionRecycleDatabaseConnections.Id},
		},
		// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_ELASTICSEARCH
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteEnvironmentElasticsearch.Id),
			Add: permissionsElasticsearchWrite,
		},
		// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_FILE_STORAGE
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteEnvironmentFileStorage.Id),
			Add: []string{model.PermissionTestS3.Id},
		},
	}, nil
}

func getAddAboutSubsectionPermissions() (permissionsMap, error) {
	permissionsAboutRead := []string{model.PermissionSysconsoleReadAboutEditionAndLicense.Id}
	permissionsAboutWrite := []string{model.PermissionSysconsoleWriteAboutEditionAndLicense.Id}

	return permissionsMap{
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadAbout.Id),
			Add: permissionsAboutRead,
		},
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteAbout.Id),
			Add: permissionsAboutWrite,
		},
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadAboutEditionAndLicense.Id),
			Add: []string{model.PermissionReadLicenseInformation.Id},
		},
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteAboutEditionAndLicense.Id),
			Add: []string{model.PermissionManageLicenseInformation.Id},
		},
	}, nil
}

func getAddReportingSubsectionPermissions() (permissionsMap, error) {
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

	return permissionsMap{
		// Give the new subsection READ permissions to any user with READ_REPORTING
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadReporting.Id),
			Add: permissionsReportingRead,
		},
		// Give the new subsection WRITE permissions to any user with WRITE_REPORTING
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteReporting.Id),
			Add: permissionsReportingWrite,
		},

		// Give the ancillary permissions PERMISSION_GET_ANALYTICS to anyone with PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS or PERMISSION_SYSCONSOLE_READ_REPORTING_SITE_STATISTICS
		permissionTransformation{
			On:  permissionOr(permissionExists(model.PermissionSysconsoleReadUserManagementUsers.Id), permissionExists(model.PermissionSysconsoleReadReportingSiteStatistics.Id)),
			Add: []string{model.PermissionGetAnalytics.Id},
		},
		// Give the ancillary permissions PERMISSION_GET_LOGS to anyone with PERMISSION_SYSCONSOLE_READ_REPORTING_SERVER_LOGS
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadReportingServerLogs.Id),
			Add: []string{model.PermissionGetLogs.Id},
		},
	}, nil
}

func getAddAuthenticationSubsectionPermissions() (permissionsMap, error) {
	permissionsAuthenticationRead := []string{model.PermissionSysconsoleReadAuthenticationSignup.Id, model.PermissionSysconsoleReadAuthenticationEmail.Id, model.PermissionSysconsoleReadAuthenticationPassword.Id, model.PermissionSysconsoleReadAuthenticationMfa.Id, model.PermissionSysconsoleReadAuthenticationLdap.Id, model.PermissionSysconsoleReadAuthenticationSaml.Id, model.PermissionSysconsoleReadAuthenticationOpenid.Id, model.PermissionSysconsoleReadAuthenticationGuestAccess.Id}
	permissionsAuthenticationWrite := []string{model.PermissionSysconsoleWriteAuthenticationSignup.Id, model.PermissionSysconsoleWriteAuthenticationEmail.Id, model.PermissionSysconsoleWriteAuthenticationPassword.Id, model.PermissionSysconsoleWriteAuthenticationMfa.Id, model.PermissionSysconsoleWriteAuthenticationLdap.Id, model.PermissionSysconsoleWriteAuthenticationSaml.Id, model.PermissionSysconsoleWriteAuthenticationOpenid.Id, model.PermissionSysconsoleWriteAuthenticationGuestAccess.Id}

	return permissionsMap{
		// Give the new subsection READ permissions to any user with READ_AUTHENTICATION
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadAuthentication.Id),
			Add: permissionsAuthenticationRead,
		},
		// Give the new subsection WRITE permissions to any user with WRITE_AUTHENTICATION
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteAuthentication.Id),
			Add: permissionsAuthenticationWrite,
		},
		// Give the ancillary permissions for LDAP to anyone with WRITE_AUTHENTICATION_LDAP
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteAuthenticationLdap.Id),
			Add: []string{model.PermissionCreateLdapSyncJob.Id, model.PermissionTestLdap.Id, model.PermissionAddLdapPublicCert.Id, model.PermissionAddLdapPrivateCert.Id, model.PermissionRemoveLdapPublicCert.Id, model.PermissionRemoveLdapPrivateCert.Id},
		},
		// Give the ancillary permissions PERMISSION_TEST_LDAP to anyone with READ_AUTHENTICATION_LDAP
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleReadAuthenticationLdap.Id),
			Add: []string{model.PermissionReadLdapSyncJob.Id},
		},
		// Give the ancillary permissions PERMISSION_INVALIDATE_EMAIL_INVITE to anyone with WRITE_AUTHENTICATION_EMAIL
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteAuthenticationEmail.Id),
			Add: []string{model.PermissionInvalidateEmailInvite.Id},
		},
		// Give the ancillary permissions for SAML to anyone with WRITE_AUTHENTICATION_SAML
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteAuthenticationSaml.Id),
			Add: []string{model.PermissionGetSamlMetadataFromIdp.Id, model.PermissionAddSamlPublicCert.Id, model.PermissionAddSamlPrivateCert.Id, model.PermissionAddSamlIdpCert.Id, model.PermissionRemoveSamlPublicCert.Id, model.PermissionRemoveSamlPrivateCert.Id, model.PermissionRemoveSamlIdpCert.Id, model.PermissionGetSamlCertStatus.Id},
		},
	}, nil
}

// This migration fixes https://github.com/mattermost/mattermost-server/issues/17642 where this particular ancillary permission was forgotten during the initial migrations
func getAddTestEmailAncillaryPermission() (permissionsMap, error) {
	return permissionsMap{
		// Give these ancillary permissions to anyone with WRITE_ENVIRONMENT_SMTP
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteEnvironmentSMTP.Id),
			Add: []string{model.PermissionTestEmail.Id},
		},
	}, nil
}

func getAddCustomUserGroupsPermissions() (permissionsMap, error) {
	customGroupPermissions := []string{
		model.PermissionCreateCustomGroup.Id,
		model.PermissionManageCustomGroupMembers.Id,
		model.PermissionEditCustomGroup.Id,
		model.PermissionDeleteCustomGroup.Id,
	}

	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SystemUserRoleId),
			Add: customGroupPermissions,
		},
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: customGroupPermissions,
		},
	}, nil
}

func getAddCustomUserGroupsPermissionRestore() (permissionsMap, error) {
	customGroupPermissions := []string{
		model.PermissionRestoreCustomGroup.Id,
	}

	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SystemUserRoleId),
			Add: customGroupPermissions,
		},
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: customGroupPermissions,
		},
		permissionTransformation{
			On:  isExactRole(model.SystemCustomGroupAdminRoleId),
			Add: customGroupPermissions,
		},
	}, nil
}

func getAddPlaybooksPermissions() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(
				permissionExists(model.PermissionCreatePublicChannel.Id),
				permissionExists(model.PermissionCreatePrivateChannel.Id),
			),
			Add: []string{
				model.PermissionPublicPlaybookCreate.Id,
				model.PermissionPrivatePlaybookCreate.Id,
			},
		},
		permissionTransformation{
			On: isExactRole(model.SystemAdminRoleId),
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
		},
	}, nil
}

func getPlaybooksPermissionsAddManageRoles() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(
				isExactRole(model.PlaybookAdminRoleId),
				isExactRole(model.TeamAdminRoleId),
				isExactRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionPublicPlaybookManageRoles.Id,
				model.PermissionPrivatePlaybookManageRoles.Id,
			},
		},
	}, nil
}

func getProductsBoardsPermissions() (permissionsMap, error) {
	return permissionsMap{
		// Give the new subsection READ permissions to any user with SYSTEM_MANAGER
		permissionTransformation{
			On:  permissionOr(isExactRole(model.SystemManagerRoleId)),
			Add: []string{model.PermissionSysconsoleReadProductsBoards.Id},
		},

		// Give the new subsection WRITE permissions to any user with SYSTEM_ADMIN
		permissionTransformation{
			On:  permissionOr(isExactRole(model.SystemAdminRoleId)),
			Add: []string{model.PermissionSysconsoleWriteProductsBoards.Id},
		},
	}, nil
}

func getAddChannelReadContentPermissions() (permissionsMap, error) {
	return permissionsMap{
		// Migrate all roles including custom roles that have the read_channel permission
		// but exclude system console roles system_read_only_admin system_user_manager & system_manager
		// as this system roles are for the admin console use only
		permissionTransformation{
			On: permissionAnd(
				permissionAnd(
					isNotRole(model.SystemUserManagerRoleId),
					isNotRole(model.SystemReadOnlyAdminRoleId),
					isNotRole(model.SystemManagerRoleId),
				),
				permissionExists(model.PermissionReadChannel.Id),
			),
			Add: []string{
				model.PermissionReadChannelContent.Id,
			},
		},
	}, nil
}

func getAddIPFilterPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(isExactRole(model.SystemAdminRoleId)),
			Add: []string{
				model.PermissionSysconsoleReadIPFilters.Id,
			},
		},

		permissionTransformation{
			On: permissionOr(isExactRole(model.SystemAdminRoleId)),
			Add: []string{
				model.PermissionSysconsoleWriteIPFilters.Id,
			},
		},
	}, nil
}

func getAddOutgoingOAuthConnectionsPermissions() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(isExactRole(model.SystemAdminRoleId)),
			Add: []string{
				model.PermissionManageOutgoingOAuthConnections.Id,
			},
		},
	}, nil
}

func getAddChannelBookmarksPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(
				isRole(model.ChannelUserRoleId),
				isRole(model.ChannelAdminRoleId),
				isRole(model.TeamAdminRoleId),
				isRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionAddBookmarkPublicChannel.Id,
				model.PermissionEditBookmarkPublicChannel.Id,
				model.PermissionDeleteBookmarkPublicChannel.Id,
				model.PermissionOrderBookmarkPublicChannel.Id,
				model.PermissionAddBookmarkPrivateChannel.Id,
				model.PermissionEditBookmarkPrivateChannel.Id,
				model.PermissionDeleteBookmarkPrivateChannel.Id,
				model.PermissionOrderBookmarkPrivateChannel.Id,
			},
		},
	}, nil
}

func getAddManageJobAncillaryPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteAuthenticationLdap.Id),
			Add: []string{model.PermissionManageLdapSyncJob.Id},
		},

		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id),
			Add: []string{model.PermissionManageDataRetentionJob.Id},
		},
		permissionTransformation{
			On:  permissionExists(model.PermissionSysconsoleWriteComplianceComplianceExport.Id),
			Add: []string{model.PermissionManageComplianceExportJob.Id},
		},
		permissionTransformation{
			On: permissionExists(model.PermissionSysconsoleWriteEnvironmentElasticsearch.Id),
			Add: []string{
				model.PermissionManageElasticsearchPostIndexingJob.Id,
				model.PermissionManageElasticsearchPostAggregationJob.Id,
			},
		},
	}, nil
}

func getAddUploadFilePermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  permissionExists(model.PermissionCreatePost.Id),
			Add: []string{model.PermissionUploadFile.Id},
		},
	}, nil
}

func getFixReadAuditsPermissionMigration() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	transformations = append(transformations, permissionTransformation{
		On:     permissionExists(model.PermissionSysconsoleReadComplianceCustomTermsOfService.Id),
		Remove: []string{model.PermissionReadAudits.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadComplianceComplianceMonitoring.Id),
		Add: []string{model.PermissionReadAudits.Id},
	})
	return transformations, nil
}

func removeGetAnalyticsPermissionMigration() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	transformations = append(transformations, permissionTransformation{
		On:     permissionExists(model.PermissionSysconsoleReadUserManagementUsers.Id),
		Remove: []string{model.PermissionGetAnalytics.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On:  permissionExists(model.PermissionSysconsoleReadReportingTeamStatistics.Id),
		Add: []string{model.PermissionGetAnalytics.Id},
	})
	return transformations, nil
}

func addSysConsoleMobileSecurityPermission() (permissionsMap, error) {
	transformations := []permissionTransformation{}

	transformations = append(transformations, permissionTransformation{
		On:  isExactRole(model.SystemAdminRoleId),
		Add: []string{model.PermissionSysconsoleWriteEnvironmentMobileSecurity.Id},
	})

	transformations = append(transformations, permissionTransformation{
		On: permissionOr(
			isExactRole(model.SystemAdminRoleId),
			isExactRole(model.SystemReadOnlyAdminRoleId),
		),
		Add: []string{model.PermissionSysconsoleReadEnvironmentMobileSecurity.Id},
	})

	return transformations, nil
}

func getAddChannelBannerPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(
				isRole(model.ChannelAdminRoleId),
				isRole(model.TeamAdminRoleId),
				isRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionManagePublicChannelBanner.Id,
				model.PermissionManagePrivateChannelBanner.Id,
			},
		},
	}, nil
}

func getAddChannelAccessRulesPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(
				isRole(model.ChannelAdminRoleId),
				isRole(model.TeamAdminRoleId),
				isRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionManageChannelAccessRules.Id,
			},
		},
	}, nil
}

func getAddTeamAccessRulesPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(
				isRole(model.TeamAdminRoleId),
				isRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionManageTeamAccessRules.Id,
			},
		},
	}, nil
}

func getAddChannelAutoTranslationPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(
				isRole(model.ChannelAdminRoleId),
				isRole(model.TeamAdminRoleId),
				isRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionManagePublicChannelAutoTranslation.Id,
				model.PermissionManagePrivateChannelAutoTranslation.Id,
			},
		},
	}, nil
}

// Only sysadmins, team admins, and users with channels and groups managements have access to "convert channel to public"
func getRestrictAcessToChannelConversionToPublic() (permissionsMap, error) {
	return []permissionTransformation{
		{
			On: permissionAnd(
				isNotRole(model.SystemAdminRoleId),
				isNotRole(model.TeamAdminRoleId),
				permissionOr(
					permissionNotExists(model.PermissionSysconsoleWriteUserManagementChannels.Id),
					permissionNotExists(model.PermissionSysconsoleWriteUserManagementGroups.Id),
				),
			),
			Remove: []string{PermissionConvertPrivateChannelToPublic},
		},
	}, nil
}

func getAddSharedChannelManagerPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SharedChannelManagerRoleId),
			Add: []string{PermissionManageSharedChannels},
		},
	}, nil
}

func getRestoreManageOAuthPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  isExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionManageOAuth.Id},
		},
	}, nil
}

func getAddManageAgentPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: isExactRole(model.SystemAdminRoleId),
			Add: []string{
				model.PermissionManageOwnAgent.Id,
				model.PermissionManageOthersAgent.Id,
			},
		},
		permissionTransformation{
			On: isExactRole(model.SystemUserRoleId),
			Add: []string{
				model.PermissionManageOwnAgent.Id,
			},
		},
	}, nil
}

func getAddEditFileAttachmentPermissionMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On:  permissionExists(model.PermissionEditPost.Id),
			Add: []string{model.PermissionEditFileAttachment.Id},
		},
	}, nil
}

func getAddDiscoverableChannelPermissionsMigration() (permissionsMap, error) {
	return permissionsMap{
		permissionTransformation{
			On: permissionOr(
				isRole(model.ChannelAdminRoleId),
				isRole(model.TeamAdminRoleId),
				isRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionManagePrivateChannelDiscoverability.Id,
				model.PermissionManageChannelJoinRequests.Id,
			},
		},
	}, nil
}

type migrationEntry struct {
	Key       string
	Migration func() (permissionsMap, error)
}

// getPermissionsMigrationEntries returns the ordered list of permission migrations.
// getAllTeamSchemes is passed in for migrations that need to query team schemes from
// the database; all other migrations are purely static.
func getPermissionsMigrationEntries(getAllTeamSchemes func() []*model.Scheme) []migrationEntry {
	return []migrationEntry{
		{Key: model.MigrationKeyEmojiPermissionsSplit, Migration: getEmojisPermissionsSplitMigration},
		{Key: model.MigrationKeyWebhookPermissionsSplit, Migration: getWebhooksPermissionsSplitMigration},
		{Key: model.MigrationKeyIntegrationsOwnPermissions, Migration: getIntegrationsOwnPermissionsMigration},
		{Key: model.MigrationKeyListJoinPublicPrivateTeams, Migration: getListJoinPublicPrivateTeamsPermissionsMigration},
		{Key: model.MigrationKeyRemovePermanentDeleteUser, Migration: removePermanentDeleteUserMigration},
		{Key: model.MigrationKeyAddBotPermissions, Migration: getAddBotPermissionsMigration},
		{Key: model.MigrationKeyApplyChannelManageDeleteToChannelUser, Migration: applyChannelManageDeleteToChannelUser},
		{Key: model.MigrationKeyRemoveChannelManageDeleteFromTeamUser, Migration: removeChannelManageDeleteFromTeamUser},
		{Key: model.MigrationKeyViewMembersNewPermission, Migration: getViewMembersPermissionMigration},
		{Key: model.MigrationKeyAddManageGuestsPermissions, Migration: getAddManageGuestsPermissionsMigration},
		{Key: model.MigrationKeyChannelModerationsPermissions, Migration: makeChannelModerationPermissionsMigration(getAllTeamSchemes)},
		{Key: model.MigrationKeyAddUseGroupMentionsPermission, Migration: getAddUseGroupMentionsPermissionMigration},
		{Key: model.MigrationKeyAddSystemConsolePermissions, Migration: getAddSystemConsolePermissionsMigration},
		{Key: model.MigrationKeyAddConvertChannelPermissions, Migration: getAddConvertChannelPermissionsMigration},
		{Key: model.MigrationKeyAddManageSharedChannelPermissions, Migration: getAddManageSharedChannelsPermissionsMigration},
		{Key: model.MigrationKeyAddManageSecureConnectionsPermissions, Migration: getAddManageSecureConnectionsPermissionsMigration},
		{Key: model.MigrationKeyAddSystemRolesPermissions, Migration: getSystemRolesPermissionsMigration},
		{Key: model.MigrationKeyAddBillingPermissions, Migration: getBillingPermissionsMigration},
		{Key: model.MigrationKeyAddDownloadComplianceExportResults, Migration: getAddDownloadComplianceExportResult},
		{Key: model.MigrationKeyAddExperimentalSubsectionPermissions, Migration: getAddExperimentalSubsectionPermissions},
		{Key: model.MigrationKeyAddAuthenticationSubsectionPermissions, Migration: getAddAuthenticationSubsectionPermissions},
		{Key: model.MigrationKeyAddIntegrationsSubsectionPermissions, Migration: getAddIntegrationsSubsectionPermissions},
		{Key: model.MigrationKeyAddSiteSubsectionPermissions, Migration: getAddSiteSubsectionPermissions},
		{Key: model.MigrationKeyAddComplianceSubsectionPermissions, Migration: getAddComplianceSubsectionPermissions},
		{Key: model.MigrationKeyAddEnvironmentSubsectionPermissions, Migration: getAddEnvironmentSubsectionPermissions},
		{Key: model.MigrationKeyAddAboutSubsectionPermissions, Migration: getAddAboutSubsectionPermissions},
		{Key: model.MigrationKeyAddReportingSubsectionPermissions, Migration: getAddReportingSubsectionPermissions},
		{Key: model.MigrationKeyAddTestEmailAncillaryPermission, Migration: getAddTestEmailAncillaryPermission},
		{Key: model.MigrationKeyAddPlaybooksPermissions, Migration: getAddPlaybooksPermissions},
		{Key: model.MigrationKeyAddCustomUserGroupsPermissions, Migration: getAddCustomUserGroupsPermissions},
		{Key: model.MigrationKeyAddPlayboosksManageRolesPermissions, Migration: getPlaybooksPermissionsAddManageRoles},
		{Key: model.MigrationKeyAddProductsBoardsPermissions, Migration: getProductsBoardsPermissions},
		{Key: model.MigrationKeyAddCustomUserGroupsPermissionRestore, Migration: getAddCustomUserGroupsPermissionRestore},
		{Key: model.MigrationKeyAddReadChannelContentPermissions, Migration: getAddChannelReadContentPermissions},
		{Key: model.MigrationKeyAddIPFilteringPermissions, Migration: getAddIPFilterPermissionsMigration},
		{Key: model.MigrationKeyAddOutgoingOAuthConnectionsPermissions, Migration: getAddOutgoingOAuthConnectionsPermissions},
		{Key: model.MigrationKeyAddChannelBookmarksPermissions, Migration: getAddChannelBookmarksPermissionsMigration},
		{Key: model.MigrationKeyAddManageJobAncillaryPermissions, Migration: getAddManageJobAncillaryPermissionsMigration},
		{Key: model.MigrationKeyAddUploadFilePermission, Migration: getAddUploadFilePermissionMigration},
		{Key: model.RestrictAccessToChannelConversionToPublic, Migration: getRestrictAcessToChannelConversionToPublic},
		{Key: model.MigrationKeyFixReadAuditsPermission, Migration: getFixReadAuditsPermissionMigration},
		{Key: model.MigrationRemoveGetAnalyticsPermission, Migration: removeGetAnalyticsPermissionMigration},
		{Key: model.MigrationAddSysconsoleMobileSecurityPermission, Migration: addSysConsoleMobileSecurityPermission},
		{Key: model.MigrationKeyAddChannelBannerPermissions, Migration: getAddChannelBannerPermissionMigration},
		{Key: model.MigrationKeyAddChannelAccessRulesPermission, Migration: getAddChannelAccessRulesPermissionMigration},
		{Key: model.MigrationKeyAddTeamAccessRulesPermission, Migration: getAddTeamAccessRulesPermissionMigration},
		{Key: model.MigrationKeyAddChannelAutoTranslationPermissions, Migration: getAddChannelAutoTranslationPermissionMigration},
		{Key: model.MigrationKeyAddSharedChannelManagerPermissions, Migration: getAddSharedChannelManagerPermissionsMigration},
		{Key: model.MigrationKeyRestoreManageOAuthPermission, Migration: getRestoreManageOAuthPermissionMigration},
		{Key: model.MigrationKeyAddManageAgentPermissions, Migration: getAddManageAgentPermissionsMigration},
		{Key: model.MigrationKeyAddEditFileAttachmentPermission, Migration: getAddEditFileAttachmentPermissionMigration},
		{Key: model.MigrationKeyAddDiscoverableChannelPermissions, Migration: getAddDiscoverableChannelPermissionsMigration},
	}
}

// DoPermissionsMigrations executes all the permissions migrations needed by the current version.
func (a *App) DoPermissionsMigrations() error {
	return a.Srv().doPermissionsMigrations()
}

func (s *Server) doPermissionsMigrations() error {
	a := New(ServerConnector(s.Channels()))
	getAllTeamSchemes := func() []*model.Scheme {
		var all []*model.Scheme
		next := a.SchemesIterator(model.SchemeScopeTeam, 100)
		for batch := next(); len(batch) > 0; batch = next() {
			all = append(all, batch...)
		}
		return all
	}
	migrations := getPermissionsMigrationEntries(getAllTeamSchemes)

	roles, err := s.Store().Role().GetAll()
	if err != nil {
		return err
	}

	for _, migration := range migrations {
		migMap, err := migration.Migration()
		if err != nil {
			return err
		}
		if err := s.doPermissionsMigration(migration.Key, migMap, roles); err != nil {
			mlog.Error("Failed to run permissions migration", mlog.String("key", migration.Key), mlog.Err(err))
			return err
		}
	}
	return nil
}
