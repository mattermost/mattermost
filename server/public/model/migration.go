// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	AdvancedPermissionsMigrationKey       = "AdvancedPermissionsMigrationComplete"
	MigrationKeyAdvancedPermissionsPhase2 = "migration_advanced_permissions_phase_2"

	MigrationKeyEmojiPermissionsSplit                  = "emoji_permissions_split"
	MigrationKeyWebhookPermissionsSplit                = "webhook_permissions_split"
	MigrationKeyListJoinPublicPrivateTeams             = "list_join_public_private_teams"
	MigrationKeyRemovePermanentDeleteUser              = "remove_permanent_delete_user"
	MigrationKeyAddBotPermissions                      = "add_bot_permissions"
	MigrationKeyApplyChannelManageDeleteToChannelUser  = "apply_channel_manage_delete_to_channel_user"
	MigrationKeyRemoveChannelManageDeleteFromTeamUser  = "remove_channel_manage_delete_from_team_user"
	MigrationKeyViewMembersNewPermission               = "view_members_new_permission"
	MigrationKeyAddManageGuestsPermissions             = "add_manage_guests_permissions"
	MigrationKeyChannelModerationsPermissions          = "channel_moderations_permissions"
	MigrationKeyAddUseGroupMentionsPermission          = "add_use_group_mentions_permission"
	MigrationKeyAddSystemConsolePermissions            = "add_system_console_permissions"
	MigrationKeySidebarCategoriesPhase2                = "migration_sidebar_categories_phase_2"
	MigrationKeyAddConvertChannelPermissions           = "add_convert_channel_permissions"
	MigrationKeyAddSystemRolesPermissions              = "add_system_roles_permissions"
	MigrationKeyAddBillingPermissions                  = "add_billing_permissions"
	MigrationKeyAddManageSharedChannelPermissions      = "manage_shared_channel_permissions"
	MigrationKeyAddManageSecureConnectionsPermissions  = "manage_secure_connections_permissions"
	MigrationKeyAddDownloadComplianceExportResults     = "download_compliance_export_results"
	MigrationKeyAddComplianceSubsectionPermissions     = "compliance_subsection_permissions"
	MigrationKeyAddExperimentalSubsectionPermissions   = "experimental_subsection_permissions"
	MigrationKeyAddAuthenticationSubsectionPermissions = "authentication_subsection_permissions"
	MigrationKeyAddSiteSubsectionPermissions           = "site_subsection_permissions"
	MigrationKeyAddEnvironmentSubsectionPermissions    = "environment_subsection_permissions"
	MigrationKeyAddReportingSubsectionPermissions      = "reporting_subsection_permissions"
	MigrationKeyAddTestEmailAncillaryPermission        = "test_email_ancillary_permission"
	MigrationKeyAddAboutSubsectionPermissions          = "about_subsection_permissions"
	MigrationKeyAddIntegrationsSubsectionPermissions   = "integrations_subsection_permissions"
	MigrationKeyAddPlaybooksPermissions                = "playbooks_permissions"
	MigrationKeyAddCustomUserGroupsPermissions         = "custom_groups_permissions"
	MigrationKeyAddPlayboosksManageRolesPermissions    = "playbooks_manage_roles"
	MigrationKeyAddProductsBoardsPermissions           = "products_boards"
	MigrationKeyAddCustomUserGroupsPermissionRestore   = "custom_groups_permission_restore"
	MigrationKeyAddReadChannelContentPermissions       = "read_channel_content_permissions"
	MigrationKeyS3Path                                 = "s3_path_migration"
	MigrationKeyDeleteEmptyDrafts                      = "delete_empty_drafts_migration"
	MigrationKeyDeleteOrphanDrafts                     = "delete_orphan_drafts_migration"
	MigrationKeyAddIPFilteringPermissions              = "add_ip_filtering_permissions"
	MigrationKeyAddOutgoingOAuthConnectionsPermissions = "add_outgoing_oauth_connections_permissions"
	MigrationKeyAddChannelBookmarksPermissions         = "add_channel_bookmarks_permissions"
	MigrationKeyDeleteDmsPreferences                   = "delete_dms_preferences_migration"
	MigrationKeyAddManageJobAncillaryPermissions       = "add_manage_jobs_ancillary_permissions"
	MigrationKeyAddUploadFilePermission                = "add_upload_file_permission"
	RestrictAccessToChannelConversionToPublic          = "restrict_access_to_channel_conversion_to_public_permissions"
	MigrationKeyFixReadAuditsPermission                = "fix_read_audits_permission"
	MigrationRemoveGetAnalyticsPermission              = "remove_get_analytics_permission"
	MigrationAddSysconsoleMobileSecurityPermission     = "add_sysconsole_mobile_security_permission"
	MigrationKeyAddChannelBannerPermissions            = "add_channel_banner_permissions"
	MigrationKeyAddChannelAccessRulesPermission        = "add_channel_access_rules_permission"
)
