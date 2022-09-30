// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"
)

// SysconsoleAncillaryPermissions maps the non-sysconsole permissions required by each sysconsole view.
var SysconsoleAncillaryPermissions map[string][]*Permission
var SystemManagerDefaultPermissions []string
var SystemUserManagerDefaultPermissions []string
var SystemReadOnlyAdminDefaultPermissions []string
var SystemCustomGroupAdminDefaultPermissions []string

var BuiltInSchemeManagedRoleIDs []string

var NewSystemRoleIDs []string

func init() {
	NewSystemRoleIDs = []string{
		SystemUserManagerRoleId,
		SystemReadOnlyAdminRoleId,
		SystemManagerRoleId,
	}

	BuiltInSchemeManagedRoleIDs = append([]string{
		SystemGuestRoleId,
		SystemUserRoleId,
		SystemAdminRoleId,
		SystemPostAllRoleId,
		SystemPostAllPublicRoleId,
		SystemUserAccessTokenRoleId,

		TeamGuestRoleId,
		TeamUserRoleId,
		TeamAdminRoleId,
		TeamPostAllRoleId,
		TeamPostAllPublicRoleId,

		ChannelGuestRoleId,
		ChannelUserRoleId,
		ChannelAdminRoleId,

		CustomGroupUserRoleId,

		PlaybookAdminRoleId,
		PlaybookMemberRoleId,
		RunAdminRoleId,
		RunMemberRoleId,
	}, NewSystemRoleIDs...)

	// When updating the values here, the values in mattermost-redux must also be updated.
	SysconsoleAncillaryPermissions = map[string][]*Permission{
		PermissionSysconsoleReadAboutEditionAndLicense.Id: {
			PermissionReadLicenseInformation,
		},
		PermissionSysconsoleWriteAboutEditionAndLicense.Id: {
			PermissionManageLicenseInformation,
		},
		PermissionSysconsoleReadUserManagementChannels.Id: {
			PermissionReadPublicChannel,
			PermissionReadChannel,
			PermissionReadPublicChannelGroups,
			PermissionReadPrivateChannelGroups,
		},
		PermissionSysconsoleReadUserManagementUsers.Id: {
			PermissionReadOtherUsersTeams,
			PermissionGetAnalytics,
		},
		PermissionSysconsoleReadUserManagementTeams.Id: {
			PermissionListPrivateTeams,
			PermissionListPublicTeams,
			PermissionViewTeam,
		},
		PermissionSysconsoleReadEnvironmentElasticsearch.Id: {
			PermissionReadElasticsearchPostIndexingJob,
			PermissionReadElasticsearchPostAggregationJob,
		},
		PermissionSysconsoleWriteEnvironmentWebServer.Id: {
			PermissionTestSiteURL,
			PermissionReloadConfig,
			PermissionInvalidateCaches,
		},
		PermissionSysconsoleWriteEnvironmentDatabase.Id: {
			PermissionRecycleDatabaseConnections,
		},
		PermissionSysconsoleWriteEnvironmentElasticsearch.Id: {
			PermissionTestElasticsearch,
			PermissionCreateElasticsearchPostIndexingJob,
			PermissionCreateElasticsearchPostAggregationJob,
			PermissionPurgeElasticsearchIndexes,
		},
		PermissionSysconsoleWriteEnvironmentFileStorage.Id: {
			PermissionTestS3,
		},
		PermissionSysconsoleWriteEnvironmentSMTP.Id: {
			PermissionTestEmail,
		},
		PermissionSysconsoleReadReportingServerLogs.Id: {
			PermissionGetLogs,
		},
		PermissionSysconsoleReadReportingSiteStatistics.Id: {
			PermissionGetAnalytics,
		},
		PermissionSysconsoleReadReportingTeamStatistics.Id: {
			PermissionViewTeam,
		},
		PermissionSysconsoleWriteUserManagementUsers.Id: {
			PermissionEditOtherUsers,
			PermissionDemoteToGuest,
			PermissionPromoteGuest,
		},
		PermissionSysconsoleWriteUserManagementChannels.Id: {
			PermissionManageTeam,
			PermissionManagePublicChannelProperties,
			PermissionManagePrivateChannelProperties,
			PermissionManagePrivateChannelMembers,
			PermissionManagePublicChannelMembers,
			PermissionDeletePrivateChannel,
			PermissionDeletePublicChannel,
			PermissionManageChannelRoles,
			PermissionConvertPublicChannelToPrivate,
			PermissionConvertPrivateChannelToPublic,
		},
		PermissionSysconsoleWriteUserManagementTeams.Id: {
			PermissionManageTeam,
			PermissionManageTeamRoles,
			PermissionRemoveUserFromTeam,
			PermissionJoinPrivateTeams,
			PermissionJoinPublicTeams,
			PermissionAddUserToTeam,
		},
		PermissionSysconsoleWriteUserManagementGroups.Id: {
			PermissionManageTeam,
			PermissionManagePrivateChannelMembers,
			PermissionManagePublicChannelMembers,
			PermissionConvertPublicChannelToPrivate,
			PermissionConvertPrivateChannelToPublic,
		},
		PermissionSysconsoleWriteSiteCustomization.Id: {
			PermissionEditBrand,
		},
		PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id: {
			PermissionCreateDataRetentionJob,
		},
		PermissionSysconsoleReadComplianceDataRetentionPolicy.Id: {
			PermissionReadDataRetentionJob,
		},
		PermissionSysconsoleWriteComplianceComplianceExport.Id: {
			PermissionCreateComplianceExportJob,
			PermissionDownloadComplianceExportResult,
		},
		PermissionSysconsoleReadComplianceComplianceExport.Id: {
			PermissionReadComplianceExportJob,
			PermissionDownloadComplianceExportResult,
		},
		PermissionSysconsoleReadComplianceCustomTermsOfService.Id: {
			PermissionReadAudits,
		},
		PermissionSysconsoleWriteExperimentalBleve.Id: {
			PermissionCreatePostBleveIndexesJob,
			PermissionPurgeBleveIndexes,
		},
		PermissionSysconsoleWriteAuthenticationLdap.Id: {
			PermissionCreateLdapSyncJob,
			PermissionAddLdapPublicCert,
			PermissionRemoveLdapPublicCert,
			PermissionAddLdapPrivateCert,
			PermissionRemoveLdapPrivateCert,
		},
		PermissionSysconsoleReadAuthenticationLdap.Id: {
			PermissionTestLdap,
			PermissionReadLdapSyncJob,
		},
		PermissionSysconsoleWriteAuthenticationEmail.Id: {
			PermissionInvalidateEmailInvite,
		},
		PermissionSysconsoleWriteAuthenticationSaml.Id: {
			PermissionGetSamlMetadataFromIdp,
			PermissionAddSamlPublicCert,
			PermissionAddSamlPrivateCert,
			PermissionAddSamlIdpCert,
			PermissionRemoveSamlPublicCert,
			PermissionRemoveSamlPrivateCert,
			PermissionRemoveSamlIdpCert,
			PermissionGetSamlCertStatus,
		},
	}

	SystemUserManagerDefaultPermissions = []string{
		PermissionSysconsoleReadUserManagementGroups.Id,
		PermissionSysconsoleReadUserManagementTeams.Id,
		PermissionSysconsoleReadUserManagementChannels.Id,
		PermissionSysconsoleReadUserManagementPermissions.Id,
		PermissionSysconsoleWriteUserManagementGroups.Id,
		PermissionSysconsoleWriteUserManagementTeams.Id,
		PermissionSysconsoleWriteUserManagementChannels.Id,
		PermissionSysconsoleReadAuthenticationSignup.Id,
		PermissionSysconsoleReadAuthenticationEmail.Id,
		PermissionSysconsoleReadAuthenticationPassword.Id,
		PermissionSysconsoleReadAuthenticationMfa.Id,
		PermissionSysconsoleReadAuthenticationLdap.Id,
		PermissionSysconsoleReadAuthenticationSaml.Id,
		PermissionSysconsoleReadAuthenticationOpenid.Id,
		PermissionSysconsoleReadAuthenticationGuestAccess.Id,
	}

	SystemReadOnlyAdminDefaultPermissions = []string{
		PermissionSysconsoleReadAboutEditionAndLicense.Id,
		PermissionSysconsoleReadReportingSiteStatistics.Id,
		PermissionSysconsoleReadReportingTeamStatistics.Id,
		PermissionSysconsoleReadReportingServerLogs.Id,
		PermissionSysconsoleReadUserManagementUsers.Id,
		PermissionSysconsoleReadUserManagementGroups.Id,
		PermissionSysconsoleReadUserManagementTeams.Id,
		PermissionSysconsoleReadUserManagementChannels.Id,
		PermissionSysconsoleReadUserManagementPermissions.Id,
		PermissionSysconsoleReadEnvironmentWebServer.Id,
		PermissionSysconsoleReadEnvironmentDatabase.Id,
		PermissionSysconsoleReadEnvironmentElasticsearch.Id,
		PermissionSysconsoleReadEnvironmentFileStorage.Id,
		PermissionSysconsoleReadEnvironmentImageProxy.Id,
		PermissionSysconsoleReadEnvironmentSMTP.Id,
		PermissionSysconsoleReadEnvironmentPushNotificationServer.Id,
		PermissionSysconsoleReadEnvironmentHighAvailability.Id,
		PermissionSysconsoleReadEnvironmentRateLimiting.Id,
		PermissionSysconsoleReadEnvironmentLogging.Id,
		PermissionSysconsoleReadEnvironmentSessionLengths.Id,
		PermissionSysconsoleReadEnvironmentPerformanceMonitoring.Id,
		PermissionSysconsoleReadEnvironmentDeveloper.Id,
		PermissionSysconsoleReadSiteCustomization.Id,
		PermissionSysconsoleReadSiteLocalization.Id,
		PermissionSysconsoleReadSiteUsersAndTeams.Id,
		PermissionSysconsoleReadSiteNotifications.Id,
		PermissionSysconsoleReadSiteAnnouncementBanner.Id,
		PermissionSysconsoleReadSiteEmoji.Id,
		PermissionSysconsoleReadSitePosts.Id,
		PermissionSysconsoleReadSiteFileSharingAndDownloads.Id,
		PermissionSysconsoleReadSitePublicLinks.Id,
		PermissionSysconsoleReadSiteNotices.Id,
		PermissionSysconsoleReadAuthenticationSignup.Id,
		PermissionSysconsoleReadAuthenticationEmail.Id,
		PermissionSysconsoleReadAuthenticationPassword.Id,
		PermissionSysconsoleReadAuthenticationMfa.Id,
		PermissionSysconsoleReadAuthenticationLdap.Id,
		PermissionSysconsoleReadAuthenticationSaml.Id,
		PermissionSysconsoleReadAuthenticationOpenid.Id,
		PermissionSysconsoleReadAuthenticationGuestAccess.Id,
		PermissionSysconsoleReadPlugins.Id,
		PermissionSysconsoleReadIntegrationsIntegrationManagement.Id,
		PermissionSysconsoleReadIntegrationsBotAccounts.Id,
		PermissionSysconsoleReadIntegrationsGif.Id,
		PermissionSysconsoleReadIntegrationsCors.Id,
		PermissionSysconsoleReadComplianceDataRetentionPolicy.Id,
		PermissionSysconsoleReadComplianceComplianceExport.Id,
		PermissionSysconsoleReadComplianceComplianceMonitoring.Id,
		PermissionSysconsoleReadComplianceCustomTermsOfService.Id,
		PermissionSysconsoleReadExperimentalFeatures.Id,
		PermissionSysconsoleReadExperimentalFeatureFlags.Id,
		PermissionSysconsoleReadExperimentalBleve.Id,
	}

	SystemManagerDefaultPermissions = []string{
		PermissionSysconsoleReadAboutEditionAndLicense.Id,
		PermissionSysconsoleReadReportingSiteStatistics.Id,
		PermissionSysconsoleReadReportingTeamStatistics.Id,
		PermissionSysconsoleReadReportingServerLogs.Id,
		PermissionSysconsoleReadUserManagementGroups.Id,
		PermissionSysconsoleReadUserManagementTeams.Id,
		PermissionSysconsoleReadUserManagementChannels.Id,
		PermissionSysconsoleReadUserManagementPermissions.Id,
		PermissionSysconsoleWriteUserManagementGroups.Id,
		PermissionSysconsoleWriteUserManagementTeams.Id,
		PermissionSysconsoleWriteUserManagementChannels.Id,
		PermissionSysconsoleWriteUserManagementPermissions.Id,
		PermissionSysconsoleReadEnvironmentWebServer.Id,
		PermissionSysconsoleReadEnvironmentDatabase.Id,
		PermissionSysconsoleReadEnvironmentElasticsearch.Id,
		PermissionSysconsoleReadEnvironmentFileStorage.Id,
		PermissionSysconsoleReadEnvironmentImageProxy.Id,
		PermissionSysconsoleReadEnvironmentSMTP.Id,
		PermissionSysconsoleReadEnvironmentPushNotificationServer.Id,
		PermissionSysconsoleReadEnvironmentHighAvailability.Id,
		PermissionSysconsoleReadEnvironmentRateLimiting.Id,
		PermissionSysconsoleReadEnvironmentLogging.Id,
		PermissionSysconsoleReadEnvironmentSessionLengths.Id,
		PermissionSysconsoleReadEnvironmentPerformanceMonitoring.Id,
		PermissionSysconsoleReadEnvironmentDeveloper.Id,
		PermissionSysconsoleWriteEnvironmentWebServer.Id,
		PermissionSysconsoleWriteEnvironmentDatabase.Id,
		PermissionSysconsoleWriteEnvironmentElasticsearch.Id,
		PermissionSysconsoleWriteEnvironmentFileStorage.Id,
		PermissionSysconsoleWriteEnvironmentImageProxy.Id,
		PermissionSysconsoleWriteEnvironmentSMTP.Id,
		PermissionSysconsoleWriteEnvironmentPushNotificationServer.Id,
		PermissionSysconsoleWriteEnvironmentHighAvailability.Id,
		PermissionSysconsoleWriteEnvironmentRateLimiting.Id,
		PermissionSysconsoleWriteEnvironmentLogging.Id,
		PermissionSysconsoleWriteEnvironmentSessionLengths.Id,
		PermissionSysconsoleWriteEnvironmentPerformanceMonitoring.Id,
		PermissionSysconsoleWriteEnvironmentDeveloper.Id,
		PermissionSysconsoleReadSiteCustomization.Id,
		PermissionSysconsoleWriteSiteCustomization.Id,
		PermissionSysconsoleReadSiteLocalization.Id,
		PermissionSysconsoleWriteSiteLocalization.Id,
		PermissionSysconsoleReadSiteUsersAndTeams.Id,
		PermissionSysconsoleWriteSiteUsersAndTeams.Id,
		PermissionSysconsoleReadSiteNotifications.Id,
		PermissionSysconsoleWriteSiteNotifications.Id,
		PermissionSysconsoleReadSiteAnnouncementBanner.Id,
		PermissionSysconsoleWriteSiteAnnouncementBanner.Id,
		PermissionSysconsoleReadSiteEmoji.Id,
		PermissionSysconsoleWriteSiteEmoji.Id,
		PermissionSysconsoleReadSitePosts.Id,
		PermissionSysconsoleWriteSitePosts.Id,
		PermissionSysconsoleReadSiteFileSharingAndDownloads.Id,
		PermissionSysconsoleWriteSiteFileSharingAndDownloads.Id,
		PermissionSysconsoleReadSitePublicLinks.Id,
		PermissionSysconsoleWriteSitePublicLinks.Id,
		PermissionSysconsoleReadSiteNotices.Id,
		PermissionSysconsoleWriteSiteNotices.Id,
		PermissionSysconsoleReadAuthenticationSignup.Id,
		PermissionSysconsoleReadAuthenticationEmail.Id,
		PermissionSysconsoleReadAuthenticationPassword.Id,
		PermissionSysconsoleReadAuthenticationMfa.Id,
		PermissionSysconsoleReadAuthenticationLdap.Id,
		PermissionSysconsoleReadAuthenticationSaml.Id,
		PermissionSysconsoleReadAuthenticationOpenid.Id,
		PermissionSysconsoleReadAuthenticationGuestAccess.Id,
		PermissionSysconsoleReadPlugins.Id,
		PermissionSysconsoleReadIntegrationsIntegrationManagement.Id,
		PermissionSysconsoleReadIntegrationsBotAccounts.Id,
		PermissionSysconsoleReadIntegrationsGif.Id,
		PermissionSysconsoleReadIntegrationsCors.Id,
		PermissionSysconsoleWriteIntegrationsIntegrationManagement.Id,
		PermissionSysconsoleWriteIntegrationsBotAccounts.Id,
		PermissionSysconsoleWriteIntegrationsGif.Id,
		PermissionSysconsoleWriteIntegrationsCors.Id,
	}

	SystemCustomGroupAdminDefaultPermissions = []string{
		PermissionCreateCustomGroup.Id,
		PermissionEditCustomGroup.Id,
		PermissionDeleteCustomGroup.Id,
		PermissionManageCustomGroupMembers.Id,
	}

	// Add the ancillary permissions to each system role
	SystemUserManagerDefaultPermissions = AddAncillaryPermissions(SystemUserManagerDefaultPermissions)
	SystemReadOnlyAdminDefaultPermissions = AddAncillaryPermissions(SystemReadOnlyAdminDefaultPermissions)
	SystemManagerDefaultPermissions = AddAncillaryPermissions(SystemManagerDefaultPermissions)
	SystemCustomGroupAdminDefaultPermissions = AddAncillaryPermissions(SystemCustomGroupAdminDefaultPermissions)
}

type RoleType string
type RoleScope string

const (
	SystemGuestRoleId            = "system_guest"
	SystemUserRoleId             = "system_user"
	SystemAdminRoleId            = "system_admin"
	SystemPostAllRoleId          = "system_post_all"
	SystemPostAllPublicRoleId    = "system_post_all_public"
	SystemUserAccessTokenRoleId  = "system_user_access_token"
	SystemUserManagerRoleId      = "system_user_manager"
	SystemReadOnlyAdminRoleId    = "system_read_only_admin"
	SystemManagerRoleId          = "system_manager"
	SystemCustomGroupAdminRoleId = "system_custom_group_admin"

	TeamGuestRoleId         = "team_guest"
	TeamUserRoleId          = "team_user"
	TeamAdminRoleId         = "team_admin"
	TeamPostAllRoleId       = "team_post_all"
	TeamPostAllPublicRoleId = "team_post_all_public"

	ChannelGuestRoleId = "channel_guest"
	ChannelUserRoleId  = "channel_user"
	ChannelAdminRoleId = "channel_admin"

	CustomGroupUserRoleId = "custom_group_user"

	PlaybookAdminRoleId  = "playbook_admin"
	PlaybookMemberRoleId = "playbook_member"
	RunAdminRoleId       = "run_admin"
	RunMemberRoleId      = "run_member"

	RoleNameMaxLength        = 64
	RoleDisplayNameMaxLength = 128
	RoleDescriptionMaxLength = 1024

	RoleScopeSystem  RoleScope = "System"
	RoleScopeTeam    RoleScope = "Team"
	RoleScopeChannel RoleScope = "Channel"
	RoleScopeGroup   RoleScope = "Group"

	RoleTypeGuest RoleType = "Guest"
	RoleTypeUser  RoleType = "User"
	RoleTypeAdmin RoleType = "Admin"
)

type Role struct {
	Id            string   `json:"id"`
	Name          string   `json:"name"`
	DisplayName   string   `json:"display_name"`
	Description   string   `json:"description"`
	CreateAt      int64    `json:"create_at"`
	UpdateAt      int64    `json:"update_at"`
	DeleteAt      int64    `json:"delete_at"`
	Permissions   []string `json:"permissions"`
	SchemeManaged bool     `json:"scheme_managed"`
	BuiltIn       bool     `json:"built_in"`
}

func (r *Role) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"id":             r.Id,
		"name":           r.Name,
		"display_name":   r.DisplayName,
		"description":    r.Description,
		"create_at":      r.CreateAt,
		"update_at":      r.UpdateAt,
		"delete_at":      r.DeleteAt,
		"permissions":    r.Permissions,
		"scheme_managed": r.SchemeManaged,
		"built_in":       r.BuiltIn,
	}
}

type RolePatch struct {
	Permissions *[]string `json:"permissions"`
}

type RolePermissions struct {
	RoleID      string
	Permissions []string
}

func (r *Role) Patch(patch *RolePatch) {
	if patch.Permissions != nil {
		r.Permissions = *patch.Permissions
	}
}

func (r *Role) CreateAt_() float64 {
	return float64(r.CreateAt)
}

func (r *Role) UpdateAt_() float64 {
	return float64(r.UpdateAt)
}

func (r *Role) DeleteAt_() float64 {
	return float64(r.DeleteAt)
}

// MergeChannelHigherScopedPermissions is meant to be invoked on a channel scheme's role and merges the higher-scoped
// channel role's permissions.
func (r *Role) MergeChannelHigherScopedPermissions(higherScopedPermissions *RolePermissions) {
	mergedPermissions := []string{}

	higherScopedPermissionsMap := asStringBoolMap(higherScopedPermissions.Permissions)
	rolePermissionsMap := asStringBoolMap(r.Permissions)

	for _, cp := range AllPermissions {
		if cp.Scope != PermissionScopeChannel {
			continue
		}

		_, presentOnHigherScope := higherScopedPermissionsMap[cp.Id]

		// For the channel admin role always look to the higher scope to determine if the role has their permission.
		// The channel admin is a special case because they're not part of the UI to be "channel moderated", only
		// channel members and channel guests are.
		if higherScopedPermissions.RoleID == ChannelAdminRoleId && presentOnHigherScope {
			mergedPermissions = append(mergedPermissions, cp.Id)
			continue
		}

		_, permissionIsModerated := ChannelModeratedPermissionsMap[cp.Id]
		if permissionIsModerated {
			_, presentOnRole := rolePermissionsMap[cp.Id]
			if presentOnRole && presentOnHigherScope {
				mergedPermissions = append(mergedPermissions, cp.Id)
			}
		} else {
			if presentOnHigherScope {
				mergedPermissions = append(mergedPermissions, cp.Id)
			}
		}
	}

	r.Permissions = mergedPermissions
}

// Returns an array of permissions that are in either role.Permissions
// or patch.Permissions, but not both.
func PermissionsChangedByPatch(role *Role, patch *RolePatch) []string {
	var result []string

	if patch.Permissions == nil {
		return result
	}

	roleMap := make(map[string]bool)
	patchMap := make(map[string]bool)

	for _, permission := range role.Permissions {
		roleMap[permission] = true
	}

	for _, permission := range *patch.Permissions {
		patchMap[permission] = true
	}

	for _, permission := range role.Permissions {
		if !patchMap[permission] {
			result = append(result, permission)
		}
	}

	for _, permission := range *patch.Permissions {
		if !roleMap[permission] {
			result = append(result, permission)
		}
	}

	return result
}

func ChannelModeratedPermissionsChangedByPatch(role *Role, patch *RolePatch) []string {
	var result []string

	if role == nil {
		return result
	}

	if patch.Permissions == nil {
		return result
	}

	roleMap := make(map[string]bool)
	patchMap := make(map[string]bool)

	for _, permission := range role.Permissions {
		if channelModeratedPermissionName, found := ChannelModeratedPermissionsMap[permission]; found {
			roleMap[channelModeratedPermissionName] = true
		}
	}

	for _, permission := range *patch.Permissions {
		if channelModeratedPermissionName, found := ChannelModeratedPermissionsMap[permission]; found {
			patchMap[channelModeratedPermissionName] = true
		}
	}

	for permissionKey := range roleMap {
		if !patchMap[permissionKey] {
			result = append(result, permissionKey)
		}
	}

	for permissionKey := range patchMap {
		if !roleMap[permissionKey] {
			result = append(result, permissionKey)
		}
	}

	return result
}

// GetChannelModeratedPermissions returns a map of channel moderated permissions that the role has access to
func (r *Role) GetChannelModeratedPermissions(channelType ChannelType) map[string]bool {
	moderatedPermissions := make(map[string]bool)
	for _, permission := range r.Permissions {
		if _, found := ChannelModeratedPermissionsMap[permission]; !found {
			continue
		}

		for moderated, moderatedPermissionValue := range ChannelModeratedPermissionsMap {
			// the moderated permission has already been found to be true so skip this iteration
			if moderatedPermissions[moderatedPermissionValue] {
				continue
			}

			if moderated == permission {
				// Special case where the channel moderated permission for `manage_members` is different depending on whether the channel is private or public
				if moderated == PermissionManagePublicChannelMembers.Id || moderated == PermissionManagePrivateChannelMembers.Id {
					canManagePublic := channelType == ChannelTypeOpen && moderated == PermissionManagePublicChannelMembers.Id
					canManagePrivate := channelType == ChannelTypePrivate && moderated == PermissionManagePrivateChannelMembers.Id
					moderatedPermissions[moderatedPermissionValue] = canManagePublic || canManagePrivate
				} else {
					moderatedPermissions[moderatedPermissionValue] = true
				}
			}
		}
	}

	return moderatedPermissions
}

// RolePatchFromChannelModerationsPatch Creates and returns a RolePatch based on a slice of ChannelModerationPatches, roleName is expected to be either "members" or "guests".
func (r *Role) RolePatchFromChannelModerationsPatch(channelModerationsPatch []*ChannelModerationPatch, roleName string) *RolePatch {
	permissionsToAddToPatch := make(map[string]bool)

	// Iterate through the list of existing permissions on the role and append permissions that we want to keep.
	for _, permission := range r.Permissions {
		// Permission is not moderated so dont add it to the patch and skip the channelModerationsPatch
		if _, isModerated := ChannelModeratedPermissionsMap[permission]; !isModerated {
			continue
		}

		permissionEnabled := true
		// Check if permission has a matching moderated permission name inside the channel moderation patch
		for _, channelModerationPatch := range channelModerationsPatch {
			if *channelModerationPatch.Name == ChannelModeratedPermissionsMap[permission] {
				// Permission key exists in patch with a value of false so skip over it
				if roleName == "members" {
					if channelModerationPatch.Roles.Members != nil && !*channelModerationPatch.Roles.Members {
						permissionEnabled = false
					}
				} else if roleName == "guests" {
					if channelModerationPatch.Roles.Guests != nil && !*channelModerationPatch.Roles.Guests {
						permissionEnabled = false
					}
				}
			}
		}

		if permissionEnabled {
			permissionsToAddToPatch[permission] = true
		}
	}

	// Iterate through the patch and add any permissions that dont already exist on the role
	for _, channelModerationPatch := range channelModerationsPatch {
		for permission, moderatedPermissionName := range ChannelModeratedPermissionsMap {
			if roleName == "members" && channelModerationPatch.Roles.Members != nil && *channelModerationPatch.Roles.Members && *channelModerationPatch.Name == moderatedPermissionName {
				permissionsToAddToPatch[permission] = true
			}

			if roleName == "guests" && channelModerationPatch.Roles.Guests != nil && *channelModerationPatch.Roles.Guests && *channelModerationPatch.Name == moderatedPermissionName {
				permissionsToAddToPatch[permission] = true
			}
		}
	}

	patchPermissions := make([]string, 0, len(permissionsToAddToPatch))
	for permission := range permissionsToAddToPatch {
		patchPermissions = append(patchPermissions, permission)
	}

	return &RolePatch{Permissions: &patchPermissions}
}

func (r *Role) IsValid() bool {
	if !IsValidId(r.Id) {
		return false
	}

	return r.IsValidWithoutId()
}

func (r *Role) IsValidWithoutId() bool {
	if !IsValidRoleName(r.Name) {
		return false
	}

	if r.DisplayName == "" || len(r.DisplayName) > RoleDisplayNameMaxLength {
		return false
	}

	if len(r.Description) > RoleDescriptionMaxLength {
		return false
	}

	check := func(perms []*Permission, permission string) bool {
		for _, p := range perms {
			if permission == p.Id {
				return true
			}
		}
		return false
	}
	for _, permission := range r.Permissions {
		permissionValidated := check(AllPermissions, permission) || check(DeprecatedPermissions, permission)
		if !permissionValidated {
			return false
		}
	}

	return true
}

func CleanRoleNames(roleNames []string) ([]string, bool) {
	var cleanedRoleNames []string
	for _, roleName := range roleNames {
		if strings.TrimSpace(roleName) == "" {
			continue
		}

		if !IsValidRoleName(roleName) {
			return roleNames, false
		}

		cleanedRoleNames = append(cleanedRoleNames, roleName)
	}

	return cleanedRoleNames, true
}

func IsValidRoleName(roleName string) bool {
	if roleName == "" || len(roleName) > RoleNameMaxLength {
		return false
	}

	if strings.TrimLeft(roleName, "abcdefghijklmnopqrstuvwxyz0123456789_") != "" {
		return false
	}

	return true
}

func MakeDefaultRoles() map[string]*Role {
	roles := make(map[string]*Role)

	roles[CustomGroupUserRoleId] = &Role{
		Name:        CustomGroupUserRoleId,
		DisplayName: fmt.Sprintf("authentication.roles.%s.name", CustomGroupUserRoleId),
		Description: fmt.Sprintf("authentication.roles.%s.description", CustomGroupUserRoleId),
		Permissions: []string{},
	}

	roles[ChannelGuestRoleId] = &Role{
		Name:        "channel_guest",
		DisplayName: "authentication.roles.channel_guest.name",
		Description: "authentication.roles.channel_guest.description",
		Permissions: []string{
			PermissionReadChannel.Id,
			PermissionAddReaction.Id,
			PermissionRemoveReaction.Id,
			PermissionUploadFile.Id,
			PermissionEditPost.Id,
			PermissionCreatePost.Id,
			PermissionUseChannelMentions.Id,
			PermissionUseSlashCommands.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[ChannelUserRoleId] = &Role{
		Name:        "channel_user",
		DisplayName: "authentication.roles.channel_user.name",
		Description: "authentication.roles.channel_user.description",
		Permissions: []string{
			PermissionReadChannel.Id,
			PermissionAddReaction.Id,
			PermissionRemoveReaction.Id,
			PermissionManagePublicChannelMembers.Id,
			PermissionUploadFile.Id,
			PermissionGetPublicLink.Id,
			PermissionCreatePost.Id,
			PermissionUseChannelMentions.Id,
			PermissionUseSlashCommands.Id,
			PermissionManagePublicChannelProperties.Id,
			PermissionDeletePublicChannel.Id,
			PermissionManagePrivateChannelProperties.Id,
			PermissionDeletePrivateChannel.Id,
			PermissionManagePrivateChannelMembers.Id,
			PermissionDeletePost.Id,
			PermissionEditPost.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[ChannelAdminRoleId] = &Role{
		Name:        "channel_admin",
		DisplayName: "authentication.roles.channel_admin.name",
		Description: "authentication.roles.channel_admin.description",
		Permissions: []string{
			PermissionManageChannelRoles.Id,
			PermissionUseGroupMentions.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[TeamGuestRoleId] = &Role{
		Name:        "team_guest",
		DisplayName: "authentication.roles.team_guest.name",
		Description: "authentication.roles.team_guest.description",
		Permissions: []string{
			PermissionViewTeam.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[TeamUserRoleId] = &Role{
		Name:        "team_user",
		DisplayName: "authentication.roles.team_user.name",
		Description: "authentication.roles.team_user.description",
		Permissions: []string{
			PermissionListTeamChannels.Id,
			PermissionJoinPublicChannels.Id,
			PermissionReadPublicChannel.Id,
			PermissionViewTeam.Id,
			PermissionCreatePublicChannel.Id,
			PermissionCreatePrivateChannel.Id,
			PermissionInviteUser.Id,
			PermissionAddUserToTeam.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[TeamPostAllRoleId] = &Role{
		Name:        "team_post_all",
		DisplayName: "authentication.roles.team_post_all.name",
		Description: "authentication.roles.team_post_all.description",
		Permissions: []string{
			PermissionCreatePost.Id,
			PermissionUseChannelMentions.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[TeamPostAllPublicRoleId] = &Role{
		Name:        "team_post_all_public",
		DisplayName: "authentication.roles.team_post_all_public.name",
		Description: "authentication.roles.team_post_all_public.description",
		Permissions: []string{
			PermissionCreatePostPublic.Id,
			PermissionUseChannelMentions.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[TeamAdminRoleId] = &Role{
		Name:        "team_admin",
		DisplayName: "authentication.roles.team_admin.name",
		Description: "authentication.roles.team_admin.description",
		Permissions: []string{
			PermissionRemoveUserFromTeam.Id,
			PermissionManageTeam.Id,
			PermissionImportTeam.Id,
			PermissionManageTeamRoles.Id,
			PermissionManageChannelRoles.Id,
			PermissionManageOthersIncomingWebhooks.Id,
			PermissionManageOthersOutgoingWebhooks.Id,
			PermissionManageSlashCommands.Id,
			PermissionManageOthersSlashCommands.Id,
			PermissionManageIncomingWebhooks.Id,
			PermissionManageOutgoingWebhooks.Id,
			PermissionConvertPublicChannelToPrivate.Id,
			PermissionConvertPrivateChannelToPublic.Id,
			PermissionDeletePost.Id,
			PermissionDeleteOthersPosts.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[PlaybookAdminRoleId] = &Role{
		Name:        PlaybookAdminRoleId,
		DisplayName: "authentication.roles.playbook_admin.name",
		Description: "authentication.roles.playbook_admin.description",
		Permissions: []string{
			PermissionPublicPlaybookManageMembers.Id,
			PermissionPublicPlaybookManageRoles.Id,
			PermissionPublicPlaybookManageProperties.Id,
			PermissionPrivatePlaybookManageMembers.Id,
			PermissionPrivatePlaybookManageRoles.Id,
			PermissionPrivatePlaybookManageProperties.Id,
			PermissionPublicPlaybookMakePrivate.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[PlaybookMemberRoleId] = &Role{
		Name:        PlaybookMemberRoleId,
		DisplayName: "authentication.roles.playbook_member.name",
		Description: "authentication.roles.playbook_member.description",
		Permissions: []string{
			PermissionPublicPlaybookView.Id,
			PermissionPublicPlaybookManageMembers.Id,
			PermissionPublicPlaybookManageProperties.Id,
			PermissionPrivatePlaybookView.Id,
			PermissionPrivatePlaybookManageMembers.Id,
			PermissionPrivatePlaybookManageProperties.Id,
			PermissionRunCreate.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[RunAdminRoleId] = &Role{
		Name:        RunAdminRoleId,
		DisplayName: "authentication.roles.run_admin.name",
		Description: "authentication.roles.run_admin.description",
		Permissions: []string{
			PermissionRunManageMembers.Id,
			PermissionRunManageProperties.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[RunMemberRoleId] = &Role{
		Name:        RunMemberRoleId,
		DisplayName: "authentication.roles.run_member.name",
		Description: "authentication.roles.run_member.description",
		Permissions: []string{
			PermissionRunView.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[SystemGuestRoleId] = &Role{
		Name:        "system_guest",
		DisplayName: "authentication.roles.global_guest.name",
		Description: "authentication.roles.global_guest.description",
		Permissions: []string{
			PermissionCreateDirectChannel.Id,
			PermissionCreateGroupChannel.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[SystemUserRoleId] = &Role{
		Name:        "system_user",
		DisplayName: "authentication.roles.global_user.name",
		Description: "authentication.roles.global_user.description",
		Permissions: []string{
			PermissionListPublicTeams.Id,
			PermissionJoinPublicTeams.Id,
			PermissionCreateDirectChannel.Id,
			PermissionCreateGroupChannel.Id,
			PermissionViewMembers.Id,
			PermissionCreateTeam.Id,
			PermissionCreateCustomGroup.Id,
			PermissionEditCustomGroup.Id,
			PermissionDeleteCustomGroup.Id,
			PermissionManageCustomGroupMembers.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[SystemPostAllRoleId] = &Role{
		Name:        "system_post_all",
		DisplayName: "authentication.roles.system_post_all.name",
		Description: "authentication.roles.system_post_all.description",
		Permissions: []string{
			PermissionCreatePost.Id,
			PermissionUseChannelMentions.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[SystemPostAllPublicRoleId] = &Role{
		Name:        "system_post_all_public",
		DisplayName: "authentication.roles.system_post_all_public.name",
		Description: "authentication.roles.system_post_all_public.description",
		Permissions: []string{
			PermissionCreatePostPublic.Id,
			PermissionUseChannelMentions.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[SystemUserAccessTokenRoleId] = &Role{
		Name:        "system_user_access_token",
		DisplayName: "authentication.roles.system_user_access_token.name",
		Description: "authentication.roles.system_user_access_token.description",
		Permissions: []string{
			PermissionCreateUserAccessToken.Id,
			PermissionReadUserAccessToken.Id,
			PermissionRevokeUserAccessToken.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[SystemUserManagerRoleId] = &Role{
		Name:          "system_user_manager",
		DisplayName:   "authentication.roles.system_user_manager.name",
		Description:   "authentication.roles.system_user_manager.description",
		Permissions:   SystemUserManagerDefaultPermissions,
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[SystemReadOnlyAdminRoleId] = &Role{
		Name:          "system_read_only_admin",
		DisplayName:   "authentication.roles.system_read_only_admin.name",
		Description:   "authentication.roles.system_read_only_admin.description",
		Permissions:   SystemReadOnlyAdminDefaultPermissions,
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[SystemManagerRoleId] = &Role{
		Name:          "system_manager",
		DisplayName:   "authentication.roles.system_manager.name",
		Description:   "authentication.roles.system_manager.description",
		Permissions:   SystemManagerDefaultPermissions,
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[SystemCustomGroupAdminRoleId] = &Role{
		Name:          "system_custom_group_admin",
		DisplayName:   "authentication.roles.system_custom_group_admin.name",
		Description:   "authentication.roles.system_custom_group_admin.description",
		Permissions:   SystemCustomGroupAdminDefaultPermissions,
		SchemeManaged: false,
		BuiltIn:       true,
	}

	allPermissionIDs := []string{}
	for _, permission := range AllPermissions {
		allPermissionIDs = append(allPermissionIDs, permission.Id)
	}

	roles[SystemAdminRoleId] = &Role{
		Name:        "system_admin",
		DisplayName: "authentication.roles.global_admin.name",
		Description: "authentication.roles.global_admin.description",
		// System admins can do anything channel and team admins can do
		// plus everything members of teams and channels can do to all teams
		// and channels on the system
		Permissions:   allPermissionIDs,
		SchemeManaged: true,
		BuiltIn:       true,
	}

	return roles
}

func AddAncillaryPermissions(permissions []string) []string {
	for _, permission := range permissions {
		if ancillaryPermissions, ok := SysconsoleAncillaryPermissions[permission]; ok {
			for _, ancillaryPermission := range ancillaryPermissions {
				permissions = append(permissions, ancillaryPermission.Id)
			}
		}
	}
	return permissions
}

func asStringBoolMap(list []string) map[string]bool {
	listMap := make(map[string]bool, len(list))
	for _, p := range list {
		listMap[p] = true
	}
	return listMap
}
