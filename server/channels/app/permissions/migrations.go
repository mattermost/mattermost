// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package permissions contains the pure, stateless logic for Mattermost's
// role-permission migrations. It has no server or database dependencies so it
// can be imported by lightweight tools such as code generators.
package permissions

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// PermissionTransformation describes a single conditional permission change: if On
// returns true for a role, Add the listed permissions and Remove the listed ones.
type PermissionTransformation struct {
	On     func(*model.Role, map[string]map[string]bool) bool
	Add    []string
	Remove []string
}

// PermissionsMap is an ordered list of transformations applied to every role.
type PermissionsMap []PermissionTransformation

// Permission-name constants used by migrations but not (yet) in model.
const (
	permissionManageSystem                        = "manage_system"
	permissionManageTeam                          = "manage_team"
	permissionManageEmojis                        = "manage_emojis"
	permissionManageOthersEmojis                  = "manage_others_emojis"
	permissionCreateEmojis                        = "create_emojis"
	permissionDeleteEmojis                        = "delete_emojis"
	permissionDeleteOthersEmojis                  = "delete_others_emojis"
	permissionManageWebhooks                      = "manage_webhooks"
	permissionManageOthersWebhooks                = "manage_others_webhooks"
	permissionManageIncomingWebhooks              = "manage_incoming_webhooks"
	permissionManageOwnIncomingWebhooks           = "manage_own_incoming_webhooks"
	permissionManageOthersIncomingWebhooks        = "manage_others_incoming_webhooks"
	permissionManageOutgoingWebhooks              = "manage_outgoing_webhooks"
	permissionManageOwnOutgoingWebhooks           = "manage_own_outgoing_webhooks"
	permissionManageOthersOutgoingWebhooks        = "manage_others_outgoing_webhooks"
	permissionBypassIncomingWebhookChannelLock    = "bypass_incoming_webhook_channel_lock"
	permissionListPublicTeams                     = "list_public_teams"
	permissionListPrivateTeams                    = "list_private_teams"
	permissionJoinPublicTeams                     = "join_public_teams"
	permissionJoinPrivateTeams                    = "join_private_teams"
	permissionPermanentDeleteUser                 = "permanent_delete_user"
	permissionCreateBot                           = "create_bot"
	permissionReadBots                            = "read_bots"
	permissionReadOthersBots                      = "read_others_bots"
	permissionManageBots                          = "manage_bots"
	permissionManageOthersBots                    = "manage_others_bots"
	permissionManageSlashCommands                 = "manage_slash_commands"
	permissionManageOwnSlashCommands              = "manage_own_slash_commands"
	permissionDeletePublicChannel                 = "delete_public_channel"
	permissionDeletePrivateChannel                = "delete_private_channel"
	permissionManagePublicChannelProperties       = "manage_public_channel_properties"
	permissionManagePrivateChannelProperties      = "manage_private_channel_properties"
	permissionManagePublicChannelAutoTranslation  = "manage_public_channel_auto_translation"
	permissionManagePrivateChannelAutoTranslation = "manage_private_channel_auto_translation"
	permissionConvertPublicChannelToPrivate       = "convert_public_channel_to_private"
	permissionConvertPrivateChannelToPublic       = "convert_private_channel_to_public"
	permissionViewMembers                         = "view_members"
	permissionInviteUser                          = "invite_user"
	permissionInviteGuest                         = "invite_guest"
	permissionPromoteGuest                        = "promote_guest"
	permissionDemoteToGuest                       = "demote_to_guest"
	permissionUseChannelMentions                  = "use_channel_mentions"
	permissionCreatePost                          = "create_post"
	permissionCreatePostPublic                    = "create_post_public"
	permissionUseGroupMentions                    = "use_group_mentions"
	permissionAddReaction                         = "add_reaction"
	permissionRemoveReaction                      = "remove_reaction"
	permissionManagePublicChannelMembers          = "manage_public_channel_members"
	permissionManagePrivateChannelMembers         = "manage_private_channel_members"
	permissionReadJobs                            = "read_jobs"
	permissionManageJobs                          = "manage_jobs"
	permissionReadOtherUsersTeams                 = "read_other_users_teams"
	permissionEditOtherUsers                      = "edit_other_users"
	permissionReadPublicChannelGroups             = "read_public_channel_groups"
	permissionReadPrivateChannelGroups            = "read_private_channel_groups"
	permissionEditBrand                           = "edit_brand"
	permissionManageSharedChannels                = "manage_shared_channels"
	permissionManageSecureConnections             = "manage_secure_connections"
	permissionManageOAuth                         = "manage_oauth"
	permissionManageRemoteClusters                = "manage_remote_clusters"
)

// ─── Condition helpers ────────────────────────────────────────────────────────

// IsExactRole matches only the role whose Name field equals roleName.
// Deprecated: prefer IsRole, which also handles scheme roles.
func IsExactRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, _ map[string]map[string]bool) bool {
		return role.Name == roleName
	}
}

// IsRole matches a role by exact name OR by scheme-role common name.
func IsRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, _ map[string]map[string]bool) bool {
		return role.Name == roleName || isSchemeRoleAssociatedToCommonName(roleName, role)
	}
}

// IsNotExactRole is the negation of IsExactRole.
// Deprecated: prefer IsNotRole.
func IsNotExactRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, _ map[string]map[string]bool) bool {
		return role.Name != roleName
	}
}

// IsNotRole is the negation of IsRole.
func IsNotRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, _ map[string]map[string]bool) bool {
		return role.Name != roleName && !isSchemeRoleAssociatedToCommonName(roleName, role)
	}
}

func isSchemeRoleAssociatedToCommonName(roleName string, role *model.Role) bool {
	roleIDToSchemeRoleDisplayName := map[string]string{
		model.TeamAdminRoleId: model.SchemeRoleDisplayNameTeamAdmin,
		model.TeamUserRoleId:  model.SchemeRoleDisplayNameTeamUser,
		model.TeamGuestRoleId: model.SchemeRoleDisplayNameTeamGuest,

		model.ChannelAdminRoleId: model.SchemeRoleDisplayNameChannelAdmin,
		model.ChannelUserRoleId:  model.SchemeRoleDisplayNameChannelUser,
		model.ChannelGuestRoleId: model.SchemeRoleDisplayNameChannelGuest,

		model.PlaybookAdminRoleId:  model.SchemeRoleDisplayNamePlaybookAdmin,
		model.PlaybookMemberRoleId: model.SchemeRoleDisplayNamePlaybookMember,

		model.RunAdminRoleId:  model.SchemeRoleDisplayNameRunAdmin,
		model.RunMemberRoleId: model.SchemeRoleDisplayNameRunMember,
	}
	displayName, ok := roleIDToSchemeRoleDisplayName[roleName]
	if !ok {
		return false
	}
	return strings.HasPrefix(role.DisplayName, displayName)
}

// IsNotSchemeRole returns true when the role's DisplayName does not contain roleName.
func IsNotSchemeRole(roleName string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, _ map[string]map[string]bool) bool {
		return !strings.Contains(role.DisplayName, roleName)
	}
}

// PermissionExists returns true when the role currently has permission in its map.
func PermissionExists(permission string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, pm map[string]map[string]bool) bool {
		val, ok := pm[role.Name][permission]
		return ok && val
	}
}

// PermissionNotExists returns true when the role does NOT have permission in its map.
func PermissionNotExists(permission string) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, pm map[string]map[string]bool) bool {
		val, ok := pm[role.Name][permission]
		return !(ok && val)
	}
}

// OnOtherRole applies function to a different role name (looked up from the permission map).
func OnOtherRole(otherRole string, function func(*model.Role, map[string]map[string]bool) bool) func(*model.Role, map[string]map[string]bool) bool {
	return func(_ *model.Role, pm map[string]map[string]bool) bool {
		return function(&model.Role{Name: otherRole}, pm)
	}
}

// PermissionOr returns true when any of funcs returns true.
func PermissionOr(funcs ...func(*model.Role, map[string]map[string]bool) bool) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, pm map[string]map[string]bool) bool {
		for _, f := range funcs {
			if f(role, pm) {
				return true
			}
		}
		return false
	}
}

// PermissionAnd returns true only when all funcs return true.
func PermissionAnd(funcs ...func(*model.Role, map[string]map[string]bool) bool) func(*model.Role, map[string]map[string]bool) bool {
	return func(role *model.Role, pm map[string]map[string]bool) bool {
		for _, f := range funcs {
			if !f(role, pm) {
				return false
			}
		}
		return true
	}
}

// ApplyPermissionsMap applies migrationMap to role, mutating pm in place and
// returning the resulting permission list for that role.
func ApplyPermissionsMap(role *model.Role, roleMap map[string]map[string]bool, migrationMap PermissionsMap) []string {
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

	var result []string
	for key, active := range roleMap[roleName] {
		if active {
			result = append(result, key)
		}
	}
	return result
}

// ─── Migration functions ──────────────────────────────────────────────────────

func GetEmojisPermissionsSplitMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:     PermissionExists(permissionManageEmojis),
			Add:    []string{permissionCreateEmojis, permissionDeleteEmojis},
			Remove: []string{permissionManageEmojis},
		},
		PermissionTransformation{
			On:     PermissionExists(permissionManageOthersEmojis),
			Add:    []string{permissionDeleteOthersEmojis},
			Remove: []string{permissionManageOthersEmojis},
		},
	}, nil
}

func GetWebhooksPermissionsSplitMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:     PermissionExists(permissionManageWebhooks),
			Add:    []string{permissionManageIncomingWebhooks, permissionManageOutgoingWebhooks},
			Remove: []string{permissionManageWebhooks},
		},
		PermissionTransformation{
			On:     PermissionExists(permissionManageOthersWebhooks),
			Add:    []string{permissionManageOthersIncomingWebhooks, permissionManageOthersOutgoingWebhooks},
			Remove: []string{permissionManageOthersWebhooks},
		},
	}, nil
}

func GetIntegrationsOwnPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:     PermissionExists(permissionManageIncomingWebhooks),
			Add:    []string{permissionManageOwnIncomingWebhooks, permissionBypassIncomingWebhookChannelLock},
			Remove: []string{permissionManageIncomingWebhooks},
		},
		PermissionTransformation{
			On:     PermissionExists(permissionManageOutgoingWebhooks),
			Add:    []string{permissionManageOwnOutgoingWebhooks},
			Remove: []string{permissionManageOutgoingWebhooks},
		},
		PermissionTransformation{
			On:     PermissionExists(permissionManageOthersIncomingWebhooks),
			Add:    []string{permissionManageOthersIncomingWebhooks},
			Remove: []string{permissionManageOthersIncomingWebhooks},
		},
		PermissionTransformation{
			On:     PermissionExists(permissionManageOthersOutgoingWebhooks),
			Add:    []string{permissionManageOthersOutgoingWebhooks},
			Remove: []string{permissionManageOthersOutgoingWebhooks},
		},
		PermissionTransformation{
			On:     PermissionExists(permissionManageSlashCommands),
			Add:    []string{permissionManageOwnSlashCommands},
			Remove: []string{permissionManageSlashCommands},
		},
		PermissionTransformation{
			On: IsExactRole(model.SystemAdminRoleId),
			Add: []string{
				permissionManageOthersIncomingWebhooks,
				permissionManageOthersOutgoingWebhooks,
				permissionManageOthersBots,
				permissionManageOwnSlashCommands,
			},
		},
	}, nil
}

func GetListJoinPublicPrivateTeamsPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:     IsExactRole(model.SystemAdminRoleId),
			Add:    []string{permissionListPrivateTeams, permissionJoinPrivateTeams},
			Remove: []string{},
		},
		PermissionTransformation{
			On:     IsExactRole(model.SystemUserRoleId),
			Add:    []string{permissionListPublicTeams, permissionJoinPublicTeams},
			Remove: []string{},
		},
	}, nil
}

func RemovePermanentDeleteUserMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:     PermissionExists(permissionPermanentDeleteUser),
			Remove: []string{permissionPermanentDeleteUser},
		},
	}, nil
}

func GetAddBotPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{permissionCreateBot, permissionReadBots, permissionReadOthersBots, permissionManageBots, permissionManageOthersBots},
		},
		PermissionTransformation{
			On:  IsExactRole(model.SystemUserRoleId),
			Add: []string{permissionCreateBot, permissionReadBots, permissionManageBots},
		},
	}, nil
}

func ApplyChannelManageDeleteToChannelUser() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionAnd(IsRole(model.ChannelUserRoleId), PermissionExists(permissionManagePublicChannelProperties)),
			Add: []string{
				permissionManagePublicChannelMembers,
				permissionDeletePublicChannel,
			},
		},
		PermissionTransformation{
			On: PermissionAnd(IsRole(model.ChannelUserRoleId), PermissionExists(permissionManagePrivateChannelProperties)),
			Add: []string{
				permissionManagePrivateChannelMembers,
				permissionDeletePrivateChannel,
			},
		},
	}, nil
}

func RemoveChannelManageDeleteFromTeamUser() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:     PermissionAnd(IsRole(model.TeamUserRoleId), PermissionExists(permissionManagePublicChannelMembers)),
			Remove: []string{permissionManagePublicChannelMembers, permissionDeletePublicChannel},
		},
		PermissionTransformation{
			On:     PermissionAnd(IsRole(model.TeamUserRoleId), PermissionExists(permissionManagePrivateChannelMembers)),
			Remove: []string{permissionManagePrivateChannelMembers, permissionDeletePrivateChannel},
		},
	}, nil
}

func GetViewMembersPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemUserRoleId),
			Add: []string{permissionViewMembers},
		},
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{permissionViewMembers},
		},
	}, nil
}

func GetAddManageGuestsPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{permissionInviteGuest, permissionPromoteGuest, permissionDemoteToGuest},
		},
	}, nil
}

func ChannelModerationPermissionsMigration(allTeamSchemes []*model.Scheme) PermissionsMap {
	transformations := PermissionsMap{}

	moderatedPermissionsMinusCreatePost := []string{
		permissionAddReaction,
		permissionRemoveReaction,
		permissionManagePublicChannelMembers,
		permissionManagePrivateChannelMembers,
		permissionUseChannelMentions,
	}

	teamAndChannelAdminConditionalTransformations := func(teamAdminID, channelAdminID, channelUserID, channelGuestID string) []PermissionTransformation {
		var transforms []PermissionTransformation

		for _, perm := range moderatedPermissionsMinusCreatePost {
			transforms = append(transforms, PermissionTransformation{
				On: PermissionAnd(
					IsExactRole(channelAdminID),
					PermissionOr(
						OnOtherRole(channelUserID, PermissionExists(perm)),
						OnOtherRole(channelGuestID, PermissionExists(perm)),
					),
				),
				Add: []string{perm},
			})
			transforms = append(transforms, PermissionTransformation{
				On: PermissionAnd(
					IsExactRole(teamAdminID),
					PermissionOr(
						OnOtherRole(channelAdminID, PermissionExists(perm)),
						OnOtherRole(channelUserID, PermissionExists(perm)),
						OnOtherRole(channelGuestID, PermissionExists(perm)),
					),
				),
				Add: []string{perm},
			})
		}
		return transforms
	}

	for _, ts := range allTeamSchemes {
		transformations = append(transformations, PermissionTransformation{
			On:  IsExactRole(ts.DefaultChannelAdminRole),
			Add: []string{permissionCreatePost},
		})
		transformations = append(transformations, PermissionTransformation{
			On:  IsExactRole(ts.DefaultTeamAdminRole),
			Add: []string{permissionCreatePost},
		})
		transformations = append(transformations, teamAndChannelAdminConditionalTransformations(
			ts.DefaultTeamAdminRole,
			ts.DefaultChannelAdminRole,
			ts.DefaultChannelUserRole,
			ts.DefaultChannelGuestRole,
		)...)
	}

	transformations = append(transformations, PermissionTransformation{
		On:  IsExactRole(model.TeamAdminRoleId),
		Add: []string{permissionCreatePost},
	})
	transformations = append(transformations, PermissionTransformation{
		On:  IsExactRole(model.ChannelAdminRoleId),
		Add: []string{permissionCreatePost},
	})
	transformations = append(transformations, teamAndChannelAdminConditionalTransformations(
		model.TeamAdminRoleId,
		model.ChannelAdminRoleId,
		model.ChannelUserRoleId,
		model.ChannelGuestRoleId,
	)...)
	transformations = append(transformations, PermissionTransformation{
		On:  IsExactRole(model.SystemAdminRoleId),
		Add: append(moderatedPermissionsMinusCreatePost, permissionCreatePost),
	})
	transformations = append(transformations, PermissionTransformation{
		On:  PermissionOr(PermissionExists(permissionCreatePost), PermissionExists(permissionCreatePostPublic)),
		Add: []string{permissionUseChannelMentions},
	})

	return transformations
}

func MakeChannelModerationPermissionsMigration(getAllTeamSchemes func() []*model.Scheme) func() (PermissionsMap, error) {
	return func() (PermissionsMap, error) {
		return ChannelModerationPermissionsMigration(getAllTeamSchemes()), nil
	}
}

func GetAddUseGroupMentionsPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionAnd(
				IsNotExactRole(model.ChannelGuestRoleId),
				IsNotSchemeRole(model.SchemeRoleDisplayNameChannelGuest),
				PermissionOr(PermissionExists(permissionCreatePost), PermissionExists(permissionCreatePostPublic)),
			),
			Add: []string{permissionUseGroupMentions},
		},
	}, nil
}

func GetAddSystemConsolePermissionsMigration() (PermissionsMap, error) {
	permissionsToAdd := []string{}
	for _, permission := range append(model.SysconsoleReadPermissions, model.SysconsoleWritePermissions...) {
		permissionsToAdd = append(permissionsToAdd, permission.Id)
	}

	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: permissionsToAdd,
		},
		PermissionTransformation{
			On:  PermissionExists(permissionManageJobs),
			Add: []string{permissionReadJobs},
		},
		PermissionTransformation{
			On:  PermissionExists(permissionEditOtherUsers),
			Add: []string{permissionReadOtherUsersTeams},
		},
		PermissionTransformation{
			On:  PermissionExists(permissionManagePublicChannelMembers),
			Add: []string{permissionReadPublicChannelGroups},
		},
		PermissionTransformation{
			On:  PermissionExists(permissionManagePrivateChannelMembers),
			Add: []string{permissionReadPrivateChannelGroups},
		},
		PermissionTransformation{
			On:  PermissionExists(permissionManageSystem),
			Add: []string{permissionEditBrand},
		},
	}, nil
}

func GetAddConvertChannelPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(permissionManageTeam),
			Add: []string{permissionConvertPublicChannelToPrivate, permissionConvertPrivateChannelToPublic},
		},
	}, nil
}

func GetSystemRolesPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionSysconsoleReadUserManagementSystemRoles.Id, model.PermissionSysconsoleWriteUserManagementSystemRoles.Id},
		},
	}, nil
}

func GetAddManageSharedChannelsPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{permissionManageSharedChannels},
		},
	}, nil
}

func GetBillingPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionSysconsoleReadBilling.Id, model.PermissionSysconsoleWriteBilling.Id},
		},
	}, nil
}

func GetAddManageSecureConnectionsPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{permissionManageSecureConnections},
		},
		PermissionTransformation{
			On:     IsExactRole(model.SystemAdminRoleId),
			Remove: []string{permissionManageRemoteClusters},
		},
	}, nil
}

func GetAddDownloadComplianceExportResult() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionDownloadComplianceExportResult.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadCompliance.Id),
			Add: []string{model.PermissionDownloadComplianceExportResult.Id, model.PermissionReadDataRetentionJob.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteCompliance.Id),
			Add: []string{model.PermissionManageJobs.Id},
		},
	}, nil
}

func GetAddExperimentalSubsectionPermissions() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadExperimental.Id),
			Add: []string{model.PermissionSysconsoleReadExperimentalFeatures.Id, model.PermissionSysconsoleReadExperimentalFeatureFlags.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteExperimental.Id),
			Add: []string{model.PermissionSysconsoleWriteExperimentalFeatures.Id, model.PermissionSysconsoleWriteExperimentalFeatureFlags.Id},
		},
	}, nil
}

func GetAddIntegrationsSubsectionPermissions() (PermissionsMap, error) {
	permissionsIntegrationsRead := []string{model.PermissionSysconsoleReadIntegrationsIntegrationManagement.Id, model.PermissionSysconsoleReadIntegrationsBotAccounts.Id, model.PermissionSysconsoleReadIntegrationsGif.Id, model.PermissionSysconsoleReadIntegrationsCors.Id}
	permissionsIntegrationsWrite := []string{model.PermissionSysconsoleWriteIntegrationsIntegrationManagement.Id, model.PermissionSysconsoleWriteIntegrationsBotAccounts.Id, model.PermissionSysconsoleWriteIntegrationsGif.Id, model.PermissionSysconsoleWriteIntegrationsCors.Id}

	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadIntegrations.Id),
			Add: permissionsIntegrationsRead,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteIntegrations.Id),
			Add: permissionsIntegrationsWrite,
		},
	}, nil
}

func GetAddSiteSubsectionPermissions() (PermissionsMap, error) {
	permissionsSiteRead := []string{model.PermissionSysconsoleReadSiteCustomization.Id, model.PermissionSysconsoleReadSiteLocalization.Id, model.PermissionSysconsoleReadSiteUsersAndTeams.Id, model.PermissionSysconsoleReadSiteNotifications.Id, model.PermissionSysconsoleReadSiteAnnouncementBanner.Id, model.PermissionSysconsoleReadSiteEmoji.Id, model.PermissionSysconsoleReadSitePosts.Id, model.PermissionSysconsoleReadSiteFileSharingAndDownloads.Id, model.PermissionSysconsoleReadSitePublicLinks.Id, model.PermissionSysconsoleReadSiteNotices.Id}
	permissionsSiteWrite := []string{model.PermissionSysconsoleWriteSiteCustomization.Id, model.PermissionSysconsoleWriteSiteLocalization.Id, model.PermissionSysconsoleWriteSiteUsersAndTeams.Id, model.PermissionSysconsoleWriteSiteNotifications.Id, model.PermissionSysconsoleWriteSiteAnnouncementBanner.Id, model.PermissionSysconsoleWriteSiteEmoji.Id, model.PermissionSysconsoleWriteSitePosts.Id, model.PermissionSysconsoleWriteSiteFileSharingAndDownloads.Id, model.PermissionSysconsoleWriteSitePublicLinks.Id, model.PermissionSysconsoleWriteSiteNotices.Id}

	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadSite.Id),
			Add: permissionsSiteRead,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteSite.Id),
			Add: permissionsSiteWrite,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteSiteCustomization.Id),
			Add: []string{model.PermissionEditBrand.Id},
		},
	}, nil
}

func GetAddComplianceSubsectionPermissions() (PermissionsMap, error) {
	permissionsComplianceRead := []string{model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.PermissionSysconsoleReadComplianceComplianceExport.Id, model.PermissionSysconsoleReadComplianceComplianceMonitoring.Id, model.PermissionSysconsoleReadComplianceCustomTermsOfService.Id}
	permissionsComplianceWrite := []string{model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.PermissionSysconsoleWriteComplianceComplianceExport.Id, model.PermissionSysconsoleWriteComplianceComplianceMonitoring.Id, model.PermissionSysconsoleWriteComplianceCustomTermsOfService.Id}

	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadCompliance.Id),
			Add: permissionsComplianceRead,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteCompliance.Id),
			Add: permissionsComplianceWrite,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id),
			Add: []string{model.PermissionCreateDataRetentionJob.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id),
			Add: []string{model.PermissionReadDataRetentionJob.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteComplianceComplianceExport.Id),
			Add: []string{model.PermissionCreateComplianceExportJob.Id, model.PermissionDownloadComplianceExportResult.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadComplianceComplianceExport.Id),
			Add: []string{model.PermissionReadComplianceExportJob.Id, model.PermissionDownloadComplianceExportResult.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadComplianceCustomTermsOfService.Id),
			Add: []string{model.PermissionReadAudits.Id},
		},
	}, nil
}

func GetAddEnvironmentSubsectionPermissions() (PermissionsMap, error) {
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

	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadEnvironment.Id),
			Add: permissionsEnvironmentRead,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteEnvironment.Id),
			Add: permissionsEnvironmentWrite,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadEnvironmentElasticsearch.Id),
			Add: permissionsElasticsearchRead,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteEnvironmentWebServer.Id),
			Add: permissionsWebServerWrite,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteEnvironmentDatabase.Id),
			Add: []string{model.PermissionRecycleDatabaseConnections.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteEnvironmentElasticsearch.Id),
			Add: permissionsElasticsearchWrite,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteEnvironmentFileStorage.Id),
			Add: []string{model.PermissionTestS3.Id},
		},
	}, nil
}

func GetAddAboutSubsectionPermissions() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadAbout.Id),
			Add: []string{model.PermissionSysconsoleReadAboutEditionAndLicense.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteAbout.Id),
			Add: []string{model.PermissionSysconsoleWriteAboutEditionAndLicense.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadAboutEditionAndLicense.Id),
			Add: []string{model.PermissionReadLicenseInformation.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteAboutEditionAndLicense.Id),
			Add: []string{model.PermissionManageLicenseInformation.Id},
		},
	}, nil
}

func GetAddReportingSubsectionPermissions() (PermissionsMap, error) {
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

	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadReporting.Id),
			Add: permissionsReportingRead,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteReporting.Id),
			Add: permissionsReportingWrite,
		},
		PermissionTransformation{
			On:  PermissionOr(PermissionExists(model.PermissionSysconsoleReadUserManagementUsers.Id), PermissionExists(model.PermissionSysconsoleReadReportingSiteStatistics.Id)),
			Add: []string{model.PermissionGetAnalytics.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadReportingServerLogs.Id),
			Add: []string{model.PermissionGetLogs.Id},
		},
	}, nil
}

func GetAddAuthenticationSubsectionPermissions() (PermissionsMap, error) {
	permissionsAuthenticationRead := []string{model.PermissionSysconsoleReadAuthenticationSignup.Id, model.PermissionSysconsoleReadAuthenticationEmail.Id, model.PermissionSysconsoleReadAuthenticationPassword.Id, model.PermissionSysconsoleReadAuthenticationMfa.Id, model.PermissionSysconsoleReadAuthenticationLdap.Id, model.PermissionSysconsoleReadAuthenticationSaml.Id, model.PermissionSysconsoleReadAuthenticationOpenid.Id, model.PermissionSysconsoleReadAuthenticationGuestAccess.Id}
	permissionsAuthenticationWrite := []string{model.PermissionSysconsoleWriteAuthenticationSignup.Id, model.PermissionSysconsoleWriteAuthenticationEmail.Id, model.PermissionSysconsoleWriteAuthenticationPassword.Id, model.PermissionSysconsoleWriteAuthenticationMfa.Id, model.PermissionSysconsoleWriteAuthenticationLdap.Id, model.PermissionSysconsoleWriteAuthenticationSaml.Id, model.PermissionSysconsoleWriteAuthenticationOpenid.Id, model.PermissionSysconsoleWriteAuthenticationGuestAccess.Id}

	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadAuthentication.Id),
			Add: permissionsAuthenticationRead,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteAuthentication.Id),
			Add: permissionsAuthenticationWrite,
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteAuthenticationLdap.Id),
			Add: []string{model.PermissionCreateLdapSyncJob.Id, model.PermissionTestLdap.Id, model.PermissionAddLdapPublicCert.Id, model.PermissionAddLdapPrivateCert.Id, model.PermissionRemoveLdapPublicCert.Id, model.PermissionRemoveLdapPrivateCert.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadAuthenticationLdap.Id),
			Add: []string{model.PermissionReadLdapSyncJob.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteAuthenticationEmail.Id),
			Add: []string{model.PermissionInvalidateEmailInvite.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteAuthenticationSaml.Id),
			Add: []string{model.PermissionGetSamlMetadataFromIdp.Id, model.PermissionAddSamlPublicCert.Id, model.PermissionAddSamlPrivateCert.Id, model.PermissionAddSamlIdpCert.Id, model.PermissionRemoveSamlPublicCert.Id, model.PermissionRemoveSamlPrivateCert.Id, model.PermissionRemoveSamlIdpCert.Id, model.PermissionGetSamlCertStatus.Id},
		},
	}, nil
}

func GetAddTestEmailAncillaryPermission() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteEnvironmentSMTP.Id),
			Add: []string{model.PermissionTestEmail.Id},
		},
	}, nil
}

func GetAddPlaybooksPermissions() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionOr(
				PermissionExists(model.PermissionCreatePublicChannel.Id),
				PermissionExists(model.PermissionCreatePrivateChannel.Id),
			),
			Add: []string{
				model.PermissionPublicPlaybookCreate.Id,
				model.PermissionPrivatePlaybookCreate.Id,
			},
		},
		PermissionTransformation{
			On: IsExactRole(model.SystemAdminRoleId),
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

func GetAddCustomUserGroupsPermissions() (PermissionsMap, error) {
	customGroupPermissions := []string{
		model.PermissionCreateCustomGroup.Id,
		model.PermissionManageCustomGroupMembers.Id,
		model.PermissionEditCustomGroup.Id,
		model.PermissionDeleteCustomGroup.Id,
	}

	return PermissionsMap{
		PermissionTransformation{On: IsExactRole(model.SystemUserRoleId), Add: customGroupPermissions},
		PermissionTransformation{On: IsExactRole(model.SystemAdminRoleId), Add: customGroupPermissions},
	}, nil
}

func GetPlaybooksPermissionsAddManageRoles() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionOr(
				IsExactRole(model.PlaybookAdminRoleId),
				IsExactRole(model.TeamAdminRoleId),
				IsExactRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionPublicPlaybookManageRoles.Id,
				model.PermissionPrivatePlaybookManageRoles.Id,
			},
		},
	}, nil
}

func GetProductsBoardsPermissions() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionOr(IsExactRole(model.SystemManagerRoleId)),
			Add: []string{model.PermissionSysconsoleReadProductsBoards.Id},
		},
		PermissionTransformation{
			On:  PermissionOr(IsExactRole(model.SystemAdminRoleId)),
			Add: []string{model.PermissionSysconsoleWriteProductsBoards.Id},
		},
	}, nil
}

func GetAddCustomUserGroupsPermissionRestore() (PermissionsMap, error) {
	customGroupPermissions := []string{model.PermissionRestoreCustomGroup.Id}

	return PermissionsMap{
		PermissionTransformation{On: IsExactRole(model.SystemUserRoleId), Add: customGroupPermissions},
		PermissionTransformation{On: IsExactRole(model.SystemAdminRoleId), Add: customGroupPermissions},
		PermissionTransformation{On: IsExactRole(model.SystemCustomGroupAdminRoleId), Add: customGroupPermissions},
	}, nil
}

func GetAddChannelReadContentPermissions() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionAnd(
				PermissionAnd(
					IsNotRole(model.SystemUserManagerRoleId),
					IsNotRole(model.SystemReadOnlyAdminRoleId),
					IsNotRole(model.SystemManagerRoleId),
				),
				PermissionExists(model.PermissionReadChannel.Id),
			),
			Add: []string{model.PermissionReadChannelContent.Id},
		},
	}, nil
}

func GetAddIPFilterPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionOr(IsExactRole(model.SystemAdminRoleId)),
			Add: []string{model.PermissionSysconsoleReadIPFilters.Id},
		},
		PermissionTransformation{
			On:  PermissionOr(IsExactRole(model.SystemAdminRoleId)),
			Add: []string{model.PermissionSysconsoleWriteIPFilters.Id},
		},
	}, nil
}

func GetAddOutgoingOAuthConnectionsPermissions() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionOr(IsExactRole(model.SystemAdminRoleId)),
			Add: []string{model.PermissionManageOutgoingOAuthConnections.Id},
		},
	}, nil
}

func GetAddChannelBookmarksPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionOr(
				IsRole(model.ChannelUserRoleId),
				IsRole(model.ChannelAdminRoleId),
				IsRole(model.TeamAdminRoleId),
				IsRole(model.SystemAdminRoleId),
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

func GetAddManageJobAncillaryPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteAuthenticationLdap.Id),
			Add: []string{model.PermissionManageLdapSyncJob.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id),
			Add: []string{model.PermissionManageDataRetentionJob.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleWriteComplianceComplianceExport.Id),
			Add: []string{model.PermissionManageComplianceExportJob.Id},
		},
		PermissionTransformation{
			On: PermissionExists(model.PermissionSysconsoleWriteEnvironmentElasticsearch.Id),
			Add: []string{
				model.PermissionManageElasticsearchPostIndexingJob.Id,
				model.PermissionManageElasticsearchPostAggregationJob.Id,
			},
		},
	}, nil
}

func GetAddUploadFilePermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionCreatePost.Id),
			Add: []string{model.PermissionUploadFile.Id},
		},
	}, nil
}

func GetRestrictAcessToChannelConversionToPublic() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionAnd(
				IsNotRole(model.SystemAdminRoleId),
				IsNotRole(model.TeamAdminRoleId),
				PermissionOr(
					PermissionNotExists(model.PermissionSysconsoleWriteUserManagementChannels.Id),
					PermissionNotExists(model.PermissionSysconsoleWriteUserManagementGroups.Id),
				),
			),
			Remove: []string{permissionConvertPrivateChannelToPublic},
		},
	}, nil
}

func GetFixReadAuditsPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:     PermissionExists(model.PermissionSysconsoleReadComplianceCustomTermsOfService.Id),
			Remove: []string{model.PermissionReadAudits.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadComplianceComplianceMonitoring.Id),
			Add: []string{model.PermissionReadAudits.Id},
		},
	}, nil
}

func RemoveGetAnalyticsPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:     PermissionExists(model.PermissionSysconsoleReadUserManagementUsers.Id),
			Remove: []string{model.PermissionGetAnalytics.Id},
		},
		PermissionTransformation{
			On:  PermissionExists(model.PermissionSysconsoleReadReportingTeamStatistics.Id),
			Add: []string{model.PermissionGetAnalytics.Id},
		},
	}, nil
}

func AddSysConsoleMobileSecurityPermission() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionSysconsoleWriteEnvironmentMobileSecurity.Id},
		},
		PermissionTransformation{
			On: PermissionOr(
				IsExactRole(model.SystemAdminRoleId),
				IsExactRole(model.SystemReadOnlyAdminRoleId),
			),
			Add: []string{model.PermissionSysconsoleReadEnvironmentMobileSecurity.Id},
		},
	}, nil
}

func GetAddChannelBannerPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionOr(
				IsRole(model.ChannelAdminRoleId),
				IsRole(model.TeamAdminRoleId),
				IsRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionManagePublicChannelBanner.Id,
				model.PermissionManagePrivateChannelBanner.Id,
			},
		},
	}, nil
}

func GetAddChannelAccessRulesPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionOr(
				IsRole(model.ChannelAdminRoleId),
				IsRole(model.TeamAdminRoleId),
				IsRole(model.SystemAdminRoleId),
			),
			Add: []string{model.PermissionManageChannelAccessRules.Id},
		},
	}, nil
}

func GetAddTeamAccessRulesPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionOr(
				IsRole(model.TeamAdminRoleId),
				IsRole(model.SystemAdminRoleId),
			),
			Add: []string{model.PermissionManageTeamAccessRules.Id},
		},
	}, nil
}

func GetAddChannelAutoTranslationPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionOr(
				IsRole(model.ChannelAdminRoleId),
				IsRole(model.TeamAdminRoleId),
				IsRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionManagePublicChannelAutoTranslation.Id,
				model.PermissionManagePrivateChannelAutoTranslation.Id,
			},
		},
	}, nil
}

func GetAddSharedChannelManagerPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SharedChannelManagerRoleId),
			Add: []string{permissionManageSharedChannels},
		},
	}, nil
}

func GetRestoreManageOAuthPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  IsExactRole(model.SystemAdminRoleId),
			Add: []string{model.PermissionManageOAuth.Id},
		},
	}, nil
}

func GetAddManageAgentPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: IsExactRole(model.SystemAdminRoleId),
			Add: []string{
				model.PermissionManageOwnAgent.Id,
				model.PermissionManageOthersAgent.Id,
			},
		},
		PermissionTransformation{
			On: IsExactRole(model.SystemUserRoleId),
			Add: []string{
				model.PermissionManageOwnAgent.Id,
			},
		},
	}, nil
}

func GetAddEditFileAttachmentPermissionMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On:  PermissionExists(model.PermissionEditPost.Id),
			Add: []string{model.PermissionEditFileAttachment.Id},
		},
	}, nil
}

func GetAddDiscoverableChannelPermissionsMigration() (PermissionsMap, error) {
	return PermissionsMap{
		PermissionTransformation{
			On: PermissionOr(
				IsRole(model.ChannelAdminRoleId),
				IsRole(model.TeamAdminRoleId),
				IsRole(model.SystemAdminRoleId),
			),
			Add: []string{
				model.PermissionManagePrivateChannelDiscoverability.Id,
				model.PermissionManageChannelJoinRequests.Id,
			},
		},
	}, nil
}

// ─── Migration entry list ─────────────────────────────────────────────────────

// Entry pairs a migration key with its migration function.
type Entry struct {
	Key       string
	Migration func() (PermissionsMap, error)
}

// DefaultMigrationEntries returns the ordered list of all permission migrations.
// getAllTeamSchemes is required only for the channel-moderation migration; pass a
// function returning nil for contexts without database access (e.g. code generation).
func DefaultMigrationEntries(getAllTeamSchemes func() []*model.Scheme) []Entry {
	return []Entry{
		{Key: model.MigrationKeyEmojiPermissionsSplit, Migration: GetEmojisPermissionsSplitMigration},
		{Key: model.MigrationKeyWebhookPermissionsSplit, Migration: GetWebhooksPermissionsSplitMigration},
		{Key: model.MigrationKeyIntegrationsOwnPermissions, Migration: GetIntegrationsOwnPermissionsMigration},
		{Key: model.MigrationKeyListJoinPublicPrivateTeams, Migration: GetListJoinPublicPrivateTeamsPermissionsMigration},
		{Key: model.MigrationKeyRemovePermanentDeleteUser, Migration: RemovePermanentDeleteUserMigration},
		{Key: model.MigrationKeyAddBotPermissions, Migration: GetAddBotPermissionsMigration},
		{Key: model.MigrationKeyApplyChannelManageDeleteToChannelUser, Migration: ApplyChannelManageDeleteToChannelUser},
		{Key: model.MigrationKeyRemoveChannelManageDeleteFromTeamUser, Migration: RemoveChannelManageDeleteFromTeamUser},
		{Key: model.MigrationKeyViewMembersNewPermission, Migration: GetViewMembersPermissionMigration},
		{Key: model.MigrationKeyAddManageGuestsPermissions, Migration: GetAddManageGuestsPermissionsMigration},
		{Key: model.MigrationKeyChannelModerationsPermissions, Migration: MakeChannelModerationPermissionsMigration(getAllTeamSchemes)},
		{Key: model.MigrationKeyAddUseGroupMentionsPermission, Migration: GetAddUseGroupMentionsPermissionMigration},
		{Key: model.MigrationKeyAddSystemConsolePermissions, Migration: GetAddSystemConsolePermissionsMigration},
		{Key: model.MigrationKeyAddConvertChannelPermissions, Migration: GetAddConvertChannelPermissionsMigration},
		{Key: model.MigrationKeyAddManageSharedChannelPermissions, Migration: GetAddManageSharedChannelsPermissionsMigration},
		{Key: model.MigrationKeyAddManageSecureConnectionsPermissions, Migration: GetAddManageSecureConnectionsPermissionsMigration},
		{Key: model.MigrationKeyAddSystemRolesPermissions, Migration: GetSystemRolesPermissionsMigration},
		{Key: model.MigrationKeyAddBillingPermissions, Migration: GetBillingPermissionsMigration},
		{Key: model.MigrationKeyAddDownloadComplianceExportResults, Migration: GetAddDownloadComplianceExportResult},
		{Key: model.MigrationKeyAddExperimentalSubsectionPermissions, Migration: GetAddExperimentalSubsectionPermissions},
		{Key: model.MigrationKeyAddAuthenticationSubsectionPermissions, Migration: GetAddAuthenticationSubsectionPermissions},
		{Key: model.MigrationKeyAddIntegrationsSubsectionPermissions, Migration: GetAddIntegrationsSubsectionPermissions},
		{Key: model.MigrationKeyAddSiteSubsectionPermissions, Migration: GetAddSiteSubsectionPermissions},
		{Key: model.MigrationKeyAddComplianceSubsectionPermissions, Migration: GetAddComplianceSubsectionPermissions},
		{Key: model.MigrationKeyAddEnvironmentSubsectionPermissions, Migration: GetAddEnvironmentSubsectionPermissions},
		{Key: model.MigrationKeyAddAboutSubsectionPermissions, Migration: GetAddAboutSubsectionPermissions},
		{Key: model.MigrationKeyAddReportingSubsectionPermissions, Migration: GetAddReportingSubsectionPermissions},
		{Key: model.MigrationKeyAddTestEmailAncillaryPermission, Migration: GetAddTestEmailAncillaryPermission},
		{Key: model.MigrationKeyAddPlaybooksPermissions, Migration: GetAddPlaybooksPermissions},
		{Key: model.MigrationKeyAddCustomUserGroupsPermissions, Migration: GetAddCustomUserGroupsPermissions},
		{Key: model.MigrationKeyAddPlayboosksManageRolesPermissions, Migration: GetPlaybooksPermissionsAddManageRoles},
		{Key: model.MigrationKeyAddProductsBoardsPermissions, Migration: GetProductsBoardsPermissions},
		{Key: model.MigrationKeyAddCustomUserGroupsPermissionRestore, Migration: GetAddCustomUserGroupsPermissionRestore},
		{Key: model.MigrationKeyAddReadChannelContentPermissions, Migration: GetAddChannelReadContentPermissions},
		{Key: model.MigrationKeyAddIPFilteringPermissions, Migration: GetAddIPFilterPermissionsMigration},
		{Key: model.MigrationKeyAddOutgoingOAuthConnectionsPermissions, Migration: GetAddOutgoingOAuthConnectionsPermissions},
		{Key: model.MigrationKeyAddChannelBookmarksPermissions, Migration: GetAddChannelBookmarksPermissionsMigration},
		{Key: model.MigrationKeyAddManageJobAncillaryPermissions, Migration: GetAddManageJobAncillaryPermissionsMigration},
		{Key: model.MigrationKeyAddUploadFilePermission, Migration: GetAddUploadFilePermissionMigration},
		{Key: model.RestrictAccessToChannelConversionToPublic, Migration: GetRestrictAcessToChannelConversionToPublic},
		{Key: model.MigrationKeyFixReadAuditsPermission, Migration: GetFixReadAuditsPermissionMigration},
		{Key: model.MigrationRemoveGetAnalyticsPermission, Migration: RemoveGetAnalyticsPermissionMigration},
		{Key: model.MigrationAddSysconsoleMobileSecurityPermission, Migration: AddSysConsoleMobileSecurityPermission},
		{Key: model.MigrationKeyAddChannelBannerPermissions, Migration: GetAddChannelBannerPermissionMigration},
		{Key: model.MigrationKeyAddChannelAccessRulesPermission, Migration: GetAddChannelAccessRulesPermissionMigration},
		{Key: model.MigrationKeyAddTeamAccessRulesPermission, Migration: GetAddTeamAccessRulesPermissionMigration},
		{Key: model.MigrationKeyAddChannelAutoTranslationPermissions, Migration: GetAddChannelAutoTranslationPermissionMigration},
		{Key: model.MigrationKeyAddSharedChannelManagerPermissions, Migration: GetAddSharedChannelManagerPermissionsMigration},
		{Key: model.MigrationKeyRestoreManageOAuthPermission, Migration: GetRestoreManageOAuthPermissionMigration},
		{Key: model.MigrationKeyAddManageAgentPermissions, Migration: GetAddManageAgentPermissionsMigration},
		{Key: model.MigrationKeyAddEditFileAttachmentPermission, Migration: GetAddEditFileAttachmentPermissionMigration},
		{Key: model.MigrationKeyAddDiscoverableChannelPermissions, Migration: GetAddDiscoverableChannelPermissionsMigration},
	}
}

// ─── Top-level helper ─────────────────────────────────────────────────────────

// DefaultRolesWithMigrationsApplied returns the default roles after all
// permission migrations have been applied. Team schemes are not considered;
// this matches a fresh server install.
func DefaultRolesWithMigrationsApplied() map[string]*model.Role {
	roles := model.MakeDefaultRoles()

	roleMap := make(map[string]map[string]bool)
	for _, role := range roles {
		roleMap[role.Name] = make(map[string]bool)
		for _, perm := range role.Permissions {
			roleMap[role.Name][perm] = true
		}
	}

	// doEmojisPermissionsMigration runs before doPermissionsMigrations and
	// unconditionally grants emoji permissions. It is a separate migration from
	// getEmojisPermissionsSplitMigration (which handles old `manage_emojis` roles).
	emojiGrants := map[string][]string{
		model.SystemUserRoleId:  {model.PermissionCreateEmojis.Id, model.PermissionDeleteEmojis.Id},
		model.SystemAdminRoleId: {model.PermissionCreateEmojis.Id, model.PermissionDeleteEmojis.Id, model.PermissionDeleteOthersEmojis.Id},
	}
	for roleName, perms := range emojiGrants {
		if roleMap[roleName] == nil {
			roleMap[roleName] = make(map[string]bool)
		}
		for _, p := range perms {
			roleMap[roleName][p] = true
		}
	}

	roleSlice := make([]*model.Role, 0, len(roles))
	for _, r := range roles {
		roleSlice = append(roleSlice, r)
	}

	// Sync roleMap back to role.Permissions before applying migrations so that
	// the emoji permissions added above are visible to migration conditions.
	for _, role := range roleSlice {
		role.Permissions = nil
		for perm, active := range roleMap[role.Name] {
			if active {
				role.Permissions = append(role.Permissions, perm)
			}
		}
	}

	for _, entry := range DefaultMigrationEntries(func() []*model.Scheme { return nil }) {
		migMap, err := entry.Migration()
		if err != nil {
			continue
		}
		for _, role := range roleSlice {
			role.Permissions = ApplyPermissionsMap(role, roleMap, migMap)
		}
	}

	return roles
}
