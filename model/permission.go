// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	PermissionScopeSystem  = "system_scope"
	PermissionScopeTeam    = "team_scope"
	PermissionScopeChannel = "channel_scope"
)

type Permission struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Scope       string `json:"scope"`
}

var PERMISSION_INVITE_USER *Permission
var PERMISSION_ADD_USER_TO_TEAM *Permission
var PERMISSION_USE_SLASH_COMMANDS *Permission
var PERMISSION_MANAGE_SLASH_COMMANDS *Permission
var PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS *Permission
var PERMISSION_CREATE_PUBLIC_CHANNEL *Permission
var PERMISSION_CREATE_PRIVATE_CHANNEL *Permission
var PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS *Permission
var PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS *Permission
var PERMISSION_CONVERT_PUBLIC_CHANNEL_TO_PRIVATE *Permission
var PERMISSION_CONVERT_PRIVATE_CHANNEL_TO_PUBLIC *Permission
var PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE *Permission
var PERMISSION_MANAGE_ROLES *Permission
var PERMISSION_MANAGE_TEAM_ROLES *Permission
var PERMISSION_MANAGE_CHANNEL_ROLES *Permission
var PERMISSION_CREATE_DIRECT_CHANNEL *Permission
var PERMISSION_CREATE_GROUP_CHANNEL *Permission
var PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES *Permission
var PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES *Permission
var PERMISSION_LIST_PUBLIC_TEAMS *Permission
var PERMISSION_JOIN_PUBLIC_TEAMS *Permission
var PERMISSION_LIST_PRIVATE_TEAMS *Permission
var PERMISSION_JOIN_PRIVATE_TEAMS *Permission
var PERMISSION_LIST_TEAM_CHANNELS *Permission
var PERMISSION_JOIN_PUBLIC_CHANNELS *Permission
var PERMISSION_DELETE_PUBLIC_CHANNEL *Permission
var PERMISSION_DELETE_PRIVATE_CHANNEL *Permission
var PERMISSION_EDIT_OTHER_USERS *Permission
var PERMISSION_READ_CHANNEL *Permission
var PERMISSION_READ_PUBLIC_CHANNEL_GROUPS *Permission
var PERMISSION_READ_PRIVATE_CHANNEL_GROUPS *Permission
var PERMISSION_READ_PUBLIC_CHANNEL *Permission
var PERMISSION_ADD_REACTION *Permission
var PERMISSION_REMOVE_REACTION *Permission
var PERMISSION_REMOVE_OTHERS_REACTIONS *Permission
var PERMISSION_PERMANENT_DELETE_USER *Permission
var PERMISSION_UPLOAD_FILE *Permission
var PERMISSION_GET_PUBLIC_LINK *Permission
var PERMISSION_MANAGE_WEBHOOKS *Permission
var PERMISSION_MANAGE_OTHERS_WEBHOOKS *Permission
var PERMISSION_MANAGE_INCOMING_WEBHOOKS *Permission
var PERMISSION_MANAGE_OUTGOING_WEBHOOKS *Permission
var PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS *Permission
var PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS *Permission
var PERMISSION_MANAGE_OAUTH *Permission
var PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH *Permission
var PERMISSION_MANAGE_EMOJIS *Permission
var PERMISSION_MANAGE_OTHERS_EMOJIS *Permission
var PERMISSION_CREATE_EMOJIS *Permission
var PERMISSION_DELETE_EMOJIS *Permission
var PERMISSION_DELETE_OTHERS_EMOJIS *Permission
var PERMISSION_CREATE_POST *Permission
var PERMISSION_CREATE_POST_PUBLIC *Permission
var PERMISSION_CREATE_POST_EPHEMERAL *Permission
var PERMISSION_EDIT_POST *Permission
var PERMISSION_EDIT_OTHERS_POSTS *Permission
var PERMISSION_DELETE_POST *Permission
var PERMISSION_DELETE_OTHERS_POSTS *Permission
var PERMISSION_REMOVE_USER_FROM_TEAM *Permission
var PERMISSION_CREATE_TEAM *Permission
var PERMISSION_MANAGE_TEAM *Permission
var PERMISSION_IMPORT_TEAM *Permission
var PERMISSION_VIEW_TEAM *Permission
var PERMISSION_LIST_USERS_WITHOUT_TEAM *Permission
var PERMISSION_READ_JOBS *Permission
var PERMISSION_MANAGE_JOBS *Permission
var PERMISSION_CREATE_USER_ACCESS_TOKEN *Permission
var PERMISSION_READ_USER_ACCESS_TOKEN *Permission
var PERMISSION_REVOKE_USER_ACCESS_TOKEN *Permission
var PERMISSION_CREATE_BOT *Permission
var PERMISSION_ASSIGN_BOT *Permission
var PERMISSION_READ_BOTS *Permission
var PERMISSION_READ_OTHERS_BOTS *Permission
var PERMISSION_MANAGE_BOTS *Permission
var PERMISSION_MANAGE_OTHERS_BOTS *Permission
var PERMISSION_VIEW_MEMBERS *Permission
var PERMISSION_INVITE_GUEST *Permission
var PERMISSION_PROMOTE_GUEST *Permission
var PERMISSION_DEMOTE_TO_GUEST *Permission
var PERMISSION_USE_CHANNEL_MENTIONS *Permission
var PERMISSION_USE_GROUP_MENTIONS *Permission
var PERMISSION_READ_OTHER_USERS_TEAMS *Permission
var PERMISSION_EDIT_BRAND *Permission
var PERMISSION_MANAGE_SHARED_CHANNELS *Permission
var PERMISSION_MANAGE_REMOTE_CLUSTERS *Permission
var PERMISSION_DOWNLOAD_COMPLIANCE_EXPORT_RESULT *Permission
var PERMISSION_CREATE_DATA_RETENTION_JOB *Permission
var PERMISSION_READ_DATA_RETENTION_JOB *Permission
var PERMISSION_CREATE_COMPLIANCE_EXPORT_JOB *Permission
var PERMISSION_READ_COMPLIANCE_EXPORT_JOB *Permission
var PERMISSION_READ_AUDITS *Permission
var PERMISSION_TEST_ELASTICSEARCH *Permission
var PERMISSION_TEST_SITE_URL *Permission
var PERMISSION_TEST_S3 *Permission
var PERMISSION_RELOAD_CONFIG *Permission
var PERMISSION_INVALIDATE_CACHES *Permission
var PERMISSION_RECYCLE_DATABASE_CONNECTIONS *Permission
var PERMISSION_PURGE_ELASTICSEARCH_INDEXES *Permission
var PERMISSION_TEST_EMAIL *Permission
var PERMISSION_CREATE_ELASTICSEARCH_POST_INDEXING_JOB *Permission
var PERMISSION_CREATE_ELASTICSEARCH_POST_AGGREGATION_JOB *Permission
var PERMISSION_READ_ELASTICSEARCH_POST_INDEXING_JOB *Permission
var PERMISSION_READ_ELASTICSEARCH_POST_AGGREGATION_JOB *Permission
var PERMISSION_PURGE_BLEVE_INDEXES *Permission
var PERMISSION_CREATE_POST_BLEVE_INDEXES_JOB *Permission
var PERMISSION_CREATE_LDAP_SYNC_JOB *Permission
var PERMISSION_READ_LDAP_SYNC_JOB *Permission
var PERMISSION_TEST_LDAP *Permission
var PERMISSION_INVALIDATE_EMAIL_INVITE *Permission
var PERMISSION_GET_SAML_METADATA_FROM_IDP *Permission
var PERMISSION_ADD_SAML_PUBLIC_CERT *Permission
var PERMISSION_ADD_SAML_PRIVATE_CERT *Permission
var PERMISSION_ADD_SAML_IDP_CERT *Permission
var PERMISSION_REMOVE_SAML_PUBLIC_CERT *Permission
var PERMISSION_REMOVE_SAML_PRIVATE_CERT *Permission
var PERMISSION_REMOVE_SAML_IDP_CERT *Permission
var PERMISSION_GET_SAML_CERT_STATUS *Permission
var PERMISSION_ADD_LDAP_PUBLIC_CERT *Permission
var PERMISSION_ADD_LDAP_PRIVATE_CERT *Permission
var PERMISSION_REMOVE_LDAP_PUBLIC_CERT *Permission
var PERMISSION_REMOVE_LDAP_PRIVATE_CERT *Permission
var PERMISSION_GET_LOGS *Permission
var PERMISSION_GET_ANALYTICS *Permission
var PERMISSION_READ_LICENSE_INFORMATION *Permission
var PERMISSION_MANAGE_LICENSE_INFORMATION *Permission

var PERMISSION_SYSCONSOLE_READ_ABOUT *Permission
var PERMISSION_SYSCONSOLE_WRITE_ABOUT *Permission

var PERMISSION_SYSCONSOLE_READ_ABOUT_EDITION_AND_LICENSE *Permission
var PERMISSION_SYSCONSOLE_WRITE_ABOUT_EDITION_AND_LICENSE *Permission

var PERMISSION_SYSCONSOLE_READ_BILLING *Permission
var PERMISSION_SYSCONSOLE_WRITE_BILLING *Permission

var PERMISSION_SYSCONSOLE_READ_REPORTING *Permission
var PERMISSION_SYSCONSOLE_WRITE_REPORTING *Permission

var PERMISSION_SYSCONSOLE_READ_REPORTING_SITE_STATISTICS *Permission
var PERMISSION_SYSCONSOLE_WRITE_REPORTING_SITE_STATISTICS *Permission

var PERMISSION_SYSCONSOLE_READ_REPORTING_TEAM_STATISTICS *Permission
var PERMISSION_SYSCONSOLE_WRITE_REPORTING_TEAM_STATISTICS *Permission

var PERMISSION_SYSCONSOLE_READ_REPORTING_SERVER_LOGS *Permission
var PERMISSION_SYSCONSOLE_WRITE_REPORTING_SERVER_LOGS *Permission

var PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS *Permission
var PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_USERS *Permission

var PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS *Permission
var PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_GROUPS *Permission

var PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_TEAMS *Permission
var PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_TEAMS *Permission

var PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_CHANNELS *Permission
var PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_CHANNELS *Permission

var PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_PERMISSIONS *Permission
var PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS *Permission

var PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_SYSTEM_ROLES *Permission
var PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_SYSTEM_ROLES *Permission

// DEPRECATED
var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT *Permission

// DEPRECATED
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_WEB_SERVER *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_WEB_SERVER *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_DATABASE *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DATABASE *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_ELASTICSEARCH *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_ELASTICSEARCH *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_FILE_STORAGE *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_FILE_STORAGE *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_IMAGE_PROXY *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_IMAGE_PROXY *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_SMTP *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_SMTP *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_PUSH_NOTIFICATION_SERVER *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_PUSH_NOTIFICATION_SERVER *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_HIGH_AVAILABILITY *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_HIGH_AVAILABILITY *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_RATE_LIMITING *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_RATE_LIMITING *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_LOGGING *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_LOGGING *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_SESSION_LENGTHS *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_SESSION_LENGTHS *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_PERFORMANCE_MONITORING *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_PERFORMANCE_MONITORING *Permission

var PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_DEVELOPER *Permission
var PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DEVELOPER *Permission

var PERMISSION_SYSCONSOLE_READ_SITE *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_CUSTOMIZATION *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_CUSTOMIZATION *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_LOCALIZATION *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_LOCALIZATION *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_USERS_AND_TEAMS *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_USERS_AND_TEAMS *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_NOTIFICATIONS *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_NOTIFICATIONS *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_ANNOUNCEMENT_BANNER *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_ANNOUNCEMENT_BANNER *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_EMOJI *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_EMOJI *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_POSTS *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_POSTS *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_FILE_SHARING_AND_DOWNLOADS *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_FILE_SHARING_AND_DOWNLOADS *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_PUBLIC_LINKS *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_PUBLIC_LINKS *Permission

var PERMISSION_SYSCONSOLE_READ_SITE_NOTICES *Permission
var PERMISSION_SYSCONSOLE_WRITE_SITE_NOTICES *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_SIGNUP *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SIGNUP *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_EMAIL *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_EMAIL *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_PASSWORD *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_PASSWORD *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_MFA *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_MFA *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_LDAP *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_LDAP *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_SAML *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SAML *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_OPENID *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_OPENID *Permission

var PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_GUEST_ACCESS *Permission
var PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_GUEST_ACCESS *Permission

var PERMISSION_SYSCONSOLE_READ_PLUGINS *Permission
var PERMISSION_SYSCONSOLE_WRITE_PLUGINS *Permission

var PERMISSION_SYSCONSOLE_READ_INTEGRATIONS *Permission
var PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS *Permission

var PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_INTEGRATION_MANAGEMENT *Permission
var PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_INTEGRATION_MANAGEMENT *Permission

var PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_BOT_ACCOUNTS *Permission
var PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_BOT_ACCOUNTS *Permission

var PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_GIF *Permission
var PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_GIF *Permission

var PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_CORS *Permission
var PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_CORS *Permission

var PERMISSION_SYSCONSOLE_READ_COMPLIANCE *Permission
var PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE *Permission

var PERMISSION_SYSCONSOLE_READ_COMPLIANCE_DATA_RETENTION_POLICY *Permission
var PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_DATA_RETENTION_POLICY *Permission

var PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_EXPORT *Permission
var PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_EXPORT *Permission

var PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_MONITORING *Permission
var PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_MONITORING *Permission

var PERMISSION_SYSCONSOLE_READ_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE *Permission
var PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE *Permission

var PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL *Permission
var PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL *Permission

var PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_FEATURES *Permission
var PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_FEATURES *Permission

var PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_FEATURE_FLAGS *Permission
var PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_FEATURE_FLAGS *Permission

var PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_BLEVE *Permission
var PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_BLEVE *Permission

// General permission that encompasses all system admin functions
// in the future this could be broken up to allow access to some
// admin functions but not others
var PERMISSION_MANAGE_SYSTEM *Permission

var AllPermissions []*Permission
var DeprecatedPermissions []*Permission

var ChannelModeratedPermissions []string
var ChannelModeratedPermissionsMap map[string]string

var SysconsoleReadPermissions []*Permission
var SysconsoleWritePermissions []*Permission

func initializePermissions() {
	PERMISSION_INVITE_USER = &Permission{
		"invite_user",
		"authentication.permissions.team_invite_user.name",
		"authentication.permissions.team_invite_user.description",
		PermissionScopeTeam,
	}
	PERMISSION_ADD_USER_TO_TEAM = &Permission{
		"add_user_to_team",
		"authentication.permissions.add_user_to_team.name",
		"authentication.permissions.add_user_to_team.description",
		PermissionScopeTeam,
	}
	PERMISSION_USE_SLASH_COMMANDS = &Permission{
		"use_slash_commands",
		"authentication.permissions.team_use_slash_commands.name",
		"authentication.permissions.team_use_slash_commands.description",
		PermissionScopeChannel,
	}
	PERMISSION_MANAGE_SLASH_COMMANDS = &Permission{
		"manage_slash_commands",
		"authentication.permissions.manage_slash_commands.name",
		"authentication.permissions.manage_slash_commands.description",
		PermissionScopeTeam,
	}
	PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS = &Permission{
		"manage_others_slash_commands",
		"authentication.permissions.manage_others_slash_commands.name",
		"authentication.permissions.manage_others_slash_commands.description",
		PermissionScopeTeam,
	}
	PERMISSION_CREATE_PUBLIC_CHANNEL = &Permission{
		"create_public_channel",
		"authentication.permissions.create_public_channel.name",
		"authentication.permissions.create_public_channel.description",
		PermissionScopeTeam,
	}
	PERMISSION_CREATE_PRIVATE_CHANNEL = &Permission{
		"create_private_channel",
		"authentication.permissions.create_private_channel.name",
		"authentication.permissions.create_private_channel.description",
		PermissionScopeTeam,
	}
	PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS = &Permission{
		"manage_public_channel_members",
		"authentication.permissions.manage_public_channel_members.name",
		"authentication.permissions.manage_public_channel_members.description",
		PermissionScopeChannel,
	}
	PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS = &Permission{
		"manage_private_channel_members",
		"authentication.permissions.manage_private_channel_members.name",
		"authentication.permissions.manage_private_channel_members.description",
		PermissionScopeChannel,
	}
	PERMISSION_CONVERT_PUBLIC_CHANNEL_TO_PRIVATE = &Permission{
		"convert_public_channel_to_private",
		"authentication.permissions.convert_public_channel_to_private.name",
		"authentication.permissions.convert_public_channel_to_private.description",
		PermissionScopeChannel,
	}
	PERMISSION_CONVERT_PRIVATE_CHANNEL_TO_PUBLIC = &Permission{
		"convert_private_channel_to_public",
		"authentication.permissions.convert_private_channel_to_public.name",
		"authentication.permissions.convert_private_channel_to_public.description",
		PermissionScopeChannel,
	}
	PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE = &Permission{
		"assign_system_admin_role",
		"authentication.permissions.assign_system_admin_role.name",
		"authentication.permissions.assign_system_admin_role.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_ROLES = &Permission{
		"manage_roles",
		"authentication.permissions.manage_roles.name",
		"authentication.permissions.manage_roles.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_TEAM_ROLES = &Permission{
		"manage_team_roles",
		"authentication.permissions.manage_team_roles.name",
		"authentication.permissions.manage_team_roles.description",
		PermissionScopeTeam,
	}
	PERMISSION_MANAGE_CHANNEL_ROLES = &Permission{
		"manage_channel_roles",
		"authentication.permissions.manage_channel_roles.name",
		"authentication.permissions.manage_channel_roles.description",
		PermissionScopeChannel,
	}
	PERMISSION_MANAGE_SYSTEM = &Permission{
		"manage_system",
		"authentication.permissions.manage_system.name",
		"authentication.permissions.manage_system.description",
		PermissionScopeSystem,
	}
	PERMISSION_CREATE_DIRECT_CHANNEL = &Permission{
		"create_direct_channel",
		"authentication.permissions.create_direct_channel.name",
		"authentication.permissions.create_direct_channel.description",
		PermissionScopeSystem,
	}
	PERMISSION_CREATE_GROUP_CHANNEL = &Permission{
		"create_group_channel",
		"authentication.permissions.create_group_channel.name",
		"authentication.permissions.create_group_channel.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES = &Permission{
		"manage_public_channel_properties",
		"authentication.permissions.manage_public_channel_properties.name",
		"authentication.permissions.manage_public_channel_properties.description",
		PermissionScopeChannel,
	}
	PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES = &Permission{
		"manage_private_channel_properties",
		"authentication.permissions.manage_private_channel_properties.name",
		"authentication.permissions.manage_private_channel_properties.description",
		PermissionScopeChannel,
	}
	PERMISSION_LIST_PUBLIC_TEAMS = &Permission{
		"list_public_teams",
		"authentication.permissions.list_public_teams.name",
		"authentication.permissions.list_public_teams.description",
		PermissionScopeSystem,
	}
	PERMISSION_JOIN_PUBLIC_TEAMS = &Permission{
		"join_public_teams",
		"authentication.permissions.join_public_teams.name",
		"authentication.permissions.join_public_teams.description",
		PermissionScopeSystem,
	}
	PERMISSION_LIST_PRIVATE_TEAMS = &Permission{
		"list_private_teams",
		"authentication.permissions.list_private_teams.name",
		"authentication.permissions.list_private_teams.description",
		PermissionScopeSystem,
	}
	PERMISSION_JOIN_PRIVATE_TEAMS = &Permission{
		"join_private_teams",
		"authentication.permissions.join_private_teams.name",
		"authentication.permissions.join_private_teams.description",
		PermissionScopeSystem,
	}
	PERMISSION_LIST_TEAM_CHANNELS = &Permission{
		"list_team_channels",
		"authentication.permissions.list_team_channels.name",
		"authentication.permissions.list_team_channels.description",
		PermissionScopeTeam,
	}
	PERMISSION_JOIN_PUBLIC_CHANNELS = &Permission{
		"join_public_channels",
		"authentication.permissions.join_public_channels.name",
		"authentication.permissions.join_public_channels.description",
		PermissionScopeTeam,
	}
	PERMISSION_DELETE_PUBLIC_CHANNEL = &Permission{
		"delete_public_channel",
		"authentication.permissions.delete_public_channel.name",
		"authentication.permissions.delete_public_channel.description",
		PermissionScopeChannel,
	}
	PERMISSION_DELETE_PRIVATE_CHANNEL = &Permission{
		"delete_private_channel",
		"authentication.permissions.delete_private_channel.name",
		"authentication.permissions.delete_private_channel.description",
		PermissionScopeChannel,
	}
	PERMISSION_EDIT_OTHER_USERS = &Permission{
		"edit_other_users",
		"authentication.permissions.edit_other_users.name",
		"authentication.permissions.edit_other_users.description",
		PermissionScopeSystem,
	}
	PERMISSION_READ_CHANNEL = &Permission{
		"read_channel",
		"authentication.permissions.read_channel.name",
		"authentication.permissions.read_channel.description",
		PermissionScopeChannel,
	}
	PERMISSION_READ_PUBLIC_CHANNEL_GROUPS = &Permission{
		"read_public_channel_groups",
		"authentication.permissions.read_public_channel_groups.name",
		"authentication.permissions.read_public_channel_groups.description",
		PermissionScopeChannel,
	}
	PERMISSION_READ_PRIVATE_CHANNEL_GROUPS = &Permission{
		"read_private_channel_groups",
		"authentication.permissions.read_private_channel_groups.name",
		"authentication.permissions.read_private_channel_groups.description",
		PermissionScopeChannel,
	}
	PERMISSION_READ_PUBLIC_CHANNEL = &Permission{
		"read_public_channel",
		"authentication.permissions.read_public_channel.name",
		"authentication.permissions.read_public_channel.description",
		PermissionScopeTeam,
	}
	PERMISSION_ADD_REACTION = &Permission{
		"add_reaction",
		"authentication.permissions.add_reaction.name",
		"authentication.permissions.add_reaction.description",
		PermissionScopeChannel,
	}
	PERMISSION_REMOVE_REACTION = &Permission{
		"remove_reaction",
		"authentication.permissions.remove_reaction.name",
		"authentication.permissions.remove_reaction.description",
		PermissionScopeChannel,
	}
	PERMISSION_REMOVE_OTHERS_REACTIONS = &Permission{
		"remove_others_reactions",
		"authentication.permissions.remove_others_reactions.name",
		"authentication.permissions.remove_others_reactions.description",
		PermissionScopeChannel,
	}
	// DEPRECATED
	PERMISSION_PERMANENT_DELETE_USER = &Permission{
		"permanent_delete_user",
		"authentication.permissions.permanent_delete_user.name",
		"authentication.permissions.permanent_delete_user.description",
		PermissionScopeSystem,
	}
	PERMISSION_UPLOAD_FILE = &Permission{
		"upload_file",
		"authentication.permissions.upload_file.name",
		"authentication.permissions.upload_file.description",
		PermissionScopeChannel,
	}
	PERMISSION_GET_PUBLIC_LINK = &Permission{
		"get_public_link",
		"authentication.permissions.get_public_link.name",
		"authentication.permissions.get_public_link.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_MANAGE_WEBHOOKS = &Permission{
		"manage_webhooks",
		"authentication.permissions.manage_webhooks.name",
		"authentication.permissions.manage_webhooks.description",
		PermissionScopeTeam,
	}
	// DEPRECATED
	PERMISSION_MANAGE_OTHERS_WEBHOOKS = &Permission{
		"manage_others_webhooks",
		"authentication.permissions.manage_others_webhooks.name",
		"authentication.permissions.manage_others_webhooks.description",
		PermissionScopeTeam,
	}
	PERMISSION_MANAGE_INCOMING_WEBHOOKS = &Permission{
		"manage_incoming_webhooks",
		"authentication.permissions.manage_incoming_webhooks.name",
		"authentication.permissions.manage_incoming_webhooks.description",
		PermissionScopeTeam,
	}
	PERMISSION_MANAGE_OUTGOING_WEBHOOKS = &Permission{
		"manage_outgoing_webhooks",
		"authentication.permissions.manage_outgoing_webhooks.name",
		"authentication.permissions.manage_outgoing_webhooks.description",
		PermissionScopeTeam,
	}
	PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS = &Permission{
		"manage_others_incoming_webhooks",
		"authentication.permissions.manage_others_incoming_webhooks.name",
		"authentication.permissions.manage_others_incoming_webhooks.description",
		PermissionScopeTeam,
	}
	PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS = &Permission{
		"manage_others_outgoing_webhooks",
		"authentication.permissions.manage_others_outgoing_webhooks.name",
		"authentication.permissions.manage_others_outgoing_webhooks.description",
		PermissionScopeTeam,
	}
	PERMISSION_MANAGE_OAUTH = &Permission{
		"manage_oauth",
		"authentication.permissions.manage_oauth.name",
		"authentication.permissions.manage_oauth.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH = &Permission{
		"manage_system_wide_oauth",
		"authentication.permissions.manage_system_wide_oauth.name",
		"authentication.permissions.manage_system_wide_oauth.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_MANAGE_EMOJIS = &Permission{
		"manage_emojis",
		"authentication.permissions.manage_emojis.name",
		"authentication.permissions.manage_emojis.description",
		PermissionScopeTeam,
	}
	// DEPRECATED
	PERMISSION_MANAGE_OTHERS_EMOJIS = &Permission{
		"manage_others_emojis",
		"authentication.permissions.manage_others_emojis.name",
		"authentication.permissions.manage_others_emojis.description",
		PermissionScopeTeam,
	}
	PERMISSION_CREATE_EMOJIS = &Permission{
		"create_emojis",
		"authentication.permissions.create_emojis.name",
		"authentication.permissions.create_emojis.description",
		PermissionScopeTeam,
	}
	PERMISSION_DELETE_EMOJIS = &Permission{
		"delete_emojis",
		"authentication.permissions.delete_emojis.name",
		"authentication.permissions.delete_emojis.description",
		PermissionScopeTeam,
	}
	PERMISSION_DELETE_OTHERS_EMOJIS = &Permission{
		"delete_others_emojis",
		"authentication.permissions.delete_others_emojis.name",
		"authentication.permissions.delete_others_emojis.description",
		PermissionScopeTeam,
	}
	PERMISSION_CREATE_POST = &Permission{
		"create_post",
		"authentication.permissions.create_post.name",
		"authentication.permissions.create_post.description",
		PermissionScopeChannel,
	}
	PERMISSION_CREATE_POST_PUBLIC = &Permission{
		"create_post_public",
		"authentication.permissions.create_post_public.name",
		"authentication.permissions.create_post_public.description",
		PermissionScopeChannel,
	}
	PERMISSION_CREATE_POST_EPHEMERAL = &Permission{
		"create_post_ephemeral",
		"authentication.permissions.create_post_ephemeral.name",
		"authentication.permissions.create_post_ephemeral.description",
		PermissionScopeChannel,
	}
	PERMISSION_EDIT_POST = &Permission{
		"edit_post",
		"authentication.permissions.edit_post.name",
		"authentication.permissions.edit_post.description",
		PermissionScopeChannel,
	}
	PERMISSION_EDIT_OTHERS_POSTS = &Permission{
		"edit_others_posts",
		"authentication.permissions.edit_others_posts.name",
		"authentication.permissions.edit_others_posts.description",
		PermissionScopeChannel,
	}
	PERMISSION_DELETE_POST = &Permission{
		"delete_post",
		"authentication.permissions.delete_post.name",
		"authentication.permissions.delete_post.description",
		PermissionScopeChannel,
	}
	PERMISSION_DELETE_OTHERS_POSTS = &Permission{
		"delete_others_posts",
		"authentication.permissions.delete_others_posts.name",
		"authentication.permissions.delete_others_posts.description",
		PermissionScopeChannel,
	}
	PERMISSION_MANAGE_SHARED_CHANNELS = &Permission{
		"manage_shared_channels",
		"authentication.permissions.manage_shared_channels.name",
		"authentication.permissions.manage_shared_channels.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_REMOTE_CLUSTERS = &Permission{
		"manage_remote_clusters",
		"authentication.permissions.manage_remote_clusters.name",
		"authentication.permissions.manage_remote_clusters.description",
		PermissionScopeSystem,
	}

	PERMISSION_CREATE_DATA_RETENTION_JOB = &Permission{
		"create_data_retention_job",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_READ_DATA_RETENTION_JOB = &Permission{
		"read_data_retention_job",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_CREATE_COMPLIANCE_EXPORT_JOB = &Permission{
		"create_compliance_export_job",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_READ_COMPLIANCE_EXPORT_JOB = &Permission{
		"read_compliance_export_job",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_READ_AUDITS = &Permission{
		"read_audits",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_PURGE_BLEVE_INDEXES = &Permission{
		"purge_bleve_indexes",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_CREATE_POST_BLEVE_INDEXES_JOB = &Permission{
		"create_post_bleve_indexes_job",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_CREATE_LDAP_SYNC_JOB = &Permission{
		"create_ldap_sync_job",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_READ_LDAP_SYNC_JOB = &Permission{
		"read_ldap_sync_job",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_TEST_LDAP = &Permission{
		"test_ldap",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_INVALIDATE_EMAIL_INVITE = &Permission{
		"invalidate_email_invite",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_GET_SAML_METADATA_FROM_IDP = &Permission{
		"get_saml_metadata_from_idp",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_ADD_SAML_PUBLIC_CERT = &Permission{
		"add_saml_public_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_ADD_SAML_PRIVATE_CERT = &Permission{
		"add_saml_private_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_ADD_SAML_IDP_CERT = &Permission{
		"add_saml_idp_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_REMOVE_SAML_PUBLIC_CERT = &Permission{
		"remove_saml_public_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_REMOVE_SAML_PRIVATE_CERT = &Permission{
		"remove_saml_private_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_REMOVE_SAML_IDP_CERT = &Permission{
		"remove_saml_idp_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_GET_SAML_CERT_STATUS = &Permission{
		"get_saml_cert_status",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_ADD_LDAP_PUBLIC_CERT = &Permission{
		"add_ldap_public_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_ADD_LDAP_PRIVATE_CERT = &Permission{
		"add_ldap_private_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_REMOVE_LDAP_PUBLIC_CERT = &Permission{
		"remove_ldap_public_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_REMOVE_LDAP_PRIVATE_CERT = &Permission{
		"remove_ldap_private_cert",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_GET_LOGS = &Permission{
		"get_logs",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_READ_LICENSE_INFORMATION = &Permission{
		"read_license_information",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_GET_ANALYTICS = &Permission{
		"get_analytics",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_MANAGE_LICENSE_INFORMATION = &Permission{
		"manage_license_information",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_DOWNLOAD_COMPLIANCE_EXPORT_RESULT = &Permission{
		"download_compliance_export_result",
		"authentication.permissions.download_compliance_export_result.name",
		"authentication.permissions.download_compliance_export_result.description",
		PermissionScopeSystem,
	}

	PERMISSION_TEST_SITE_URL = &Permission{
		"test_site_url",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_TEST_ELASTICSEARCH = &Permission{
		"test_elasticsearch",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_TEST_S3 = &Permission{
		"test_s3",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_RELOAD_CONFIG = &Permission{
		"reload_config",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_INVALIDATE_CACHES = &Permission{
		"invalidate_caches",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_RECYCLE_DATABASE_CONNECTIONS = &Permission{
		"recycle_database_connections",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_PURGE_ELASTICSEARCH_INDEXES = &Permission{
		"purge_elasticsearch_indexes",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_TEST_EMAIL = &Permission{
		"test_email",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_CREATE_ELASTICSEARCH_POST_INDEXING_JOB = &Permission{
		"create_elasticsearch_post_indexing_job",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_CREATE_ELASTICSEARCH_POST_AGGREGATION_JOB = &Permission{
		"create_elasticsearch_post_aggregation_job",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_READ_ELASTICSEARCH_POST_INDEXING_JOB = &Permission{
		"read_elasticsearch_post_indexing_job",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_READ_ELASTICSEARCH_POST_AGGREGATION_JOB = &Permission{
		"read_elasticsearch_post_aggregation_job",
		"",
		"",
		PermissionScopeSystem,
	}

	PERMISSION_REMOVE_USER_FROM_TEAM = &Permission{
		"remove_user_from_team",
		"authentication.permissions.remove_user_from_team.name",
		"authentication.permissions.remove_user_from_team.description",
		PermissionScopeTeam,
	}
	PERMISSION_CREATE_TEAM = &Permission{
		"create_team",
		"authentication.permissions.create_team.name",
		"authentication.permissions.create_team.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_TEAM = &Permission{
		"manage_team",
		"authentication.permissions.manage_team.name",
		"authentication.permissions.manage_team.description",
		PermissionScopeTeam,
	}
	PERMISSION_IMPORT_TEAM = &Permission{
		"import_team",
		"authentication.permissions.import_team.name",
		"authentication.permissions.import_team.description",
		PermissionScopeTeam,
	}
	PERMISSION_VIEW_TEAM = &Permission{
		"view_team",
		"authentication.permissions.view_team.name",
		"authentication.permissions.view_team.description",
		PermissionScopeTeam,
	}
	PERMISSION_LIST_USERS_WITHOUT_TEAM = &Permission{
		"list_users_without_team",
		"authentication.permissions.list_users_without_team.name",
		"authentication.permissions.list_users_without_team.description",
		PermissionScopeSystem,
	}
	PERMISSION_CREATE_USER_ACCESS_TOKEN = &Permission{
		"create_user_access_token",
		"authentication.permissions.create_user_access_token.name",
		"authentication.permissions.create_user_access_token.description",
		PermissionScopeSystem,
	}
	PERMISSION_READ_USER_ACCESS_TOKEN = &Permission{
		"read_user_access_token",
		"authentication.permissions.read_user_access_token.name",
		"authentication.permissions.read_user_access_token.description",
		PermissionScopeSystem,
	}
	PERMISSION_REVOKE_USER_ACCESS_TOKEN = &Permission{
		"revoke_user_access_token",
		"authentication.permissions.revoke_user_access_token.name",
		"authentication.permissions.revoke_user_access_token.description",
		PermissionScopeSystem,
	}
	PERMISSION_CREATE_BOT = &Permission{
		"create_bot",
		"authentication.permissions.create_bot.name",
		"authentication.permissions.create_bot.description",
		PermissionScopeSystem,
	}
	PERMISSION_ASSIGN_BOT = &Permission{
		"assign_bot",
		"authentication.permissions.assign_bot.name",
		"authentication.permissions.assign_bot.description",
		PermissionScopeSystem,
	}
	PERMISSION_READ_BOTS = &Permission{
		"read_bots",
		"authentication.permissions.read_bots.name",
		"authentication.permissions.read_bots.description",
		PermissionScopeSystem,
	}
	PERMISSION_READ_OTHERS_BOTS = &Permission{
		"read_others_bots",
		"authentication.permissions.read_others_bots.name",
		"authentication.permissions.read_others_bots.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_BOTS = &Permission{
		"manage_bots",
		"authentication.permissions.manage_bots.name",
		"authentication.permissions.manage_bots.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_OTHERS_BOTS = &Permission{
		"manage_others_bots",
		"authentication.permissions.manage_others_bots.name",
		"authentication.permissions.manage_others_bots.description",
		PermissionScopeSystem,
	}
	PERMISSION_READ_JOBS = &Permission{
		"read_jobs",
		"authentication.permisssions.read_jobs.name",
		"authentication.permisssions.read_jobs.description",
		PermissionScopeSystem,
	}
	PERMISSION_MANAGE_JOBS = &Permission{
		"manage_jobs",
		"authentication.permisssions.manage_jobs.name",
		"authentication.permisssions.manage_jobs.description",
		PermissionScopeSystem,
	}
	PERMISSION_VIEW_MEMBERS = &Permission{
		"view_members",
		"authentication.permisssions.view_members.name",
		"authentication.permisssions.view_members.description",
		PermissionScopeTeam,
	}
	PERMISSION_INVITE_GUEST = &Permission{
		"invite_guest",
		"authentication.permissions.invite_guest.name",
		"authentication.permissions.invite_guest.description",
		PermissionScopeTeam,
	}
	PERMISSION_PROMOTE_GUEST = &Permission{
		"promote_guest",
		"authentication.permissions.promote_guest.name",
		"authentication.permissions.promote_guest.description",
		PermissionScopeSystem,
	}
	PERMISSION_DEMOTE_TO_GUEST = &Permission{
		"demote_to_guest",
		"authentication.permissions.demote_to_guest.name",
		"authentication.permissions.demote_to_guest.description",
		PermissionScopeSystem,
	}
	PERMISSION_USE_CHANNEL_MENTIONS = &Permission{
		"use_channel_mentions",
		"authentication.permissions.use_channel_mentions.name",
		"authentication.permissions.use_channel_mentions.description",
		PermissionScopeChannel,
	}
	PERMISSION_USE_GROUP_MENTIONS = &Permission{
		"use_group_mentions",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeChannel,
	}
	PERMISSION_READ_OTHER_USERS_TEAMS = &Permission{
		"read_other_users_teams",
		"authentication.permissions.read_other_users_teams.name",
		"authentication.permissions.read_other_users_teams.description",
		PermissionScopeSystem,
	}
	PERMISSION_EDIT_BRAND = &Permission{
		"edit_brand",
		"authentication.permissions.edit_brand.name",
		"authentication.permissions.edit_brand.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_READ_ABOUT = &Permission{
		"sysconsole_read_about",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_WRITE_ABOUT = &Permission{
		"sysconsole_write_about",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ABOUT_EDITION_AND_LICENSE = &Permission{
		"sysconsole_read_about_edition_and_license",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ABOUT_EDITION_AND_LICENSE = &Permission{
		"sysconsole_write_about_edition_and_license",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_BILLING = &Permission{
		"sysconsole_read_billing",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_BILLING = &Permission{
		"sysconsole_write_billing",
		"",
		"",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_READ_REPORTING = &Permission{
		"sysconsole_read_reporting",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_WRITE_REPORTING = &Permission{
		"sysconsole_write_reporting",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_REPORTING_SITE_STATISTICS = &Permission{
		"sysconsole_read_reporting_site_statistics",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_REPORTING_SITE_STATISTICS = &Permission{
		"sysconsole_write_reporting_site_statistics",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_REPORTING_TEAM_STATISTICS = &Permission{
		"sysconsole_read_reporting_team_statistics",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_REPORTING_TEAM_STATISTICS = &Permission{
		"sysconsole_write_reporting_team_statistics",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_REPORTING_SERVER_LOGS = &Permission{
		"sysconsole_read_reporting_server_logs",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_REPORTING_SERVER_LOGS = &Permission{
		"sysconsole_write_reporting_server_logs",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS = &Permission{
		"sysconsole_read_user_management_users",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_USERS = &Permission{
		"sysconsole_write_user_management_users",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS = &Permission{
		"sysconsole_read_user_management_groups",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_GROUPS = &Permission{
		"sysconsole_write_user_management_groups",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_TEAMS = &Permission{
		"sysconsole_read_user_management_teams",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_TEAMS = &Permission{
		"sysconsole_write_user_management_teams",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_CHANNELS = &Permission{
		"sysconsole_read_user_management_channels",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_CHANNELS = &Permission{
		"sysconsole_write_user_management_channels",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_PERMISSIONS = &Permission{
		"sysconsole_read_user_management_permissions",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS = &Permission{
		"sysconsole_write_user_management_permissions",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_SYSTEM_ROLES = &Permission{
		"sysconsole_read_user_management_system_roles",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_SYSTEM_ROLES = &Permission{
		"sysconsole_write_user_management_system_roles",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT = &Permission{
		"sysconsole_read_environment",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT = &Permission{
		"sysconsole_write_environment",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_WEB_SERVER = &Permission{
		"sysconsole_read_environment_web_server",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_WEB_SERVER = &Permission{
		"sysconsole_write_environment_web_server",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_DATABASE = &Permission{
		"sysconsole_read_environment_database",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DATABASE = &Permission{
		"sysconsole_write_environment_database",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_ELASTICSEARCH = &Permission{
		"sysconsole_read_environment_elasticsearch",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_ELASTICSEARCH = &Permission{
		"sysconsole_write_environment_elasticsearch",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_FILE_STORAGE = &Permission{
		"sysconsole_read_environment_file_storage",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_FILE_STORAGE = &Permission{
		"sysconsole_write_environment_file_storage",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_IMAGE_PROXY = &Permission{
		"sysconsole_read_environment_image_proxy",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_IMAGE_PROXY = &Permission{
		"sysconsole_write_environment_image_proxy",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_SMTP = &Permission{
		"sysconsole_read_environment_smtp",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_SMTP = &Permission{
		"sysconsole_write_environment_smtp",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_PUSH_NOTIFICATION_SERVER = &Permission{
		"sysconsole_read_environment_push_notification_server",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_PUSH_NOTIFICATION_SERVER = &Permission{
		"sysconsole_write_environment_push_notification_server",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_HIGH_AVAILABILITY = &Permission{
		"sysconsole_read_environment_high_availability",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_HIGH_AVAILABILITY = &Permission{
		"sysconsole_write_environment_high_availability",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_RATE_LIMITING = &Permission{
		"sysconsole_read_environment_rate_limiting",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_RATE_LIMITING = &Permission{
		"sysconsole_write_environment_rate_limiting",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_LOGGING = &Permission{
		"sysconsole_read_environment_logging",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_LOGGING = &Permission{
		"sysconsole_write_environment_logging",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_SESSION_LENGTHS = &Permission{
		"sysconsole_read_environment_session_lengths",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_SESSION_LENGTHS = &Permission{
		"sysconsole_write_environment_session_lengths",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_PERFORMANCE_MONITORING = &Permission{
		"sysconsole_read_environment_performance_monitoring",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_PERFORMANCE_MONITORING = &Permission{
		"sysconsole_write_environment_performance_monitoring",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_DEVELOPER = &Permission{
		"sysconsole_read_environment_developer",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DEVELOPER = &Permission{
		"sysconsole_write_environment_developer",
		"",
		"",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_READ_SITE = &Permission{
		"sysconsole_read_site",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_WRITE_SITE = &Permission{
		"sysconsole_write_site",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}

	PERMISSION_SYSCONSOLE_READ_SITE_CUSTOMIZATION = &Permission{
		"sysconsole_read_site_customization",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_CUSTOMIZATION = &Permission{
		"sysconsole_write_site_customization",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_LOCALIZATION = &Permission{
		"sysconsole_read_site_localization",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_LOCALIZATION = &Permission{
		"sysconsole_write_site_localization",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_USERS_AND_TEAMS = &Permission{
		"sysconsole_read_site_users_and_teams",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_USERS_AND_TEAMS = &Permission{
		"sysconsole_write_site_users_and_teams",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_NOTIFICATIONS = &Permission{
		"sysconsole_read_site_notifications",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_NOTIFICATIONS = &Permission{
		"sysconsole_write_site_notifications",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_ANNOUNCEMENT_BANNER = &Permission{
		"sysconsole_read_site_announcement_banner",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_ANNOUNCEMENT_BANNER = &Permission{
		"sysconsole_write_site_announcement_banner",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_EMOJI = &Permission{
		"sysconsole_read_site_emoji",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_EMOJI = &Permission{
		"sysconsole_write_site_emoji",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_POSTS = &Permission{
		"sysconsole_read_site_posts",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_POSTS = &Permission{
		"sysconsole_write_site_posts",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_FILE_SHARING_AND_DOWNLOADS = &Permission{
		"sysconsole_read_site_file_sharing_and_downloads",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_FILE_SHARING_AND_DOWNLOADS = &Permission{
		"sysconsole_write_site_file_sharing_and_downloads",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_PUBLIC_LINKS = &Permission{
		"sysconsole_read_site_public_links",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_PUBLIC_LINKS = &Permission{
		"sysconsole_write_site_public_links",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_SITE_NOTICES = &Permission{
		"sysconsole_read_site_notices",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_SITE_NOTICES = &Permission{
		"sysconsole_write_site_notices",
		"",
		"",
		PermissionScopeSystem,
	}

	// Deprecated
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION = &Permission{
		"sysconsole_read_authentication",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// Deprecated
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION = &Permission{
		"sysconsole_write_authentication",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_SIGNUP = &Permission{
		"sysconsole_read_authentication_signup",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SIGNUP = &Permission{
		"sysconsole_write_authentication_signup",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_EMAIL = &Permission{
		"sysconsole_read_authentication_email",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_EMAIL = &Permission{
		"sysconsole_write_authentication_email",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_PASSWORD = &Permission{
		"sysconsole_read_authentication_password",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_PASSWORD = &Permission{
		"sysconsole_write_authentication_password",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_MFA = &Permission{
		"sysconsole_read_authentication_mfa",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_MFA = &Permission{
		"sysconsole_write_authentication_mfa",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_LDAP = &Permission{
		"sysconsole_read_authentication_ldap",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_LDAP = &Permission{
		"sysconsole_write_authentication_ldap",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_SAML = &Permission{
		"sysconsole_read_authentication_saml",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SAML = &Permission{
		"sysconsole_write_authentication_saml",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_OPENID = &Permission{
		"sysconsole_read_authentication_openid",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_OPENID = &Permission{
		"sysconsole_write_authentication_openid",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_GUEST_ACCESS = &Permission{
		"sysconsole_read_authentication_guest_access",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_GUEST_ACCESS = &Permission{
		"sysconsole_write_authentication_guest_access",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_PLUGINS = &Permission{
		"sysconsole_read_plugins",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_PLUGINS = &Permission{
		"sysconsole_write_plugins",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_READ_INTEGRATIONS = &Permission{
		"sysconsole_read_integrations",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS = &Permission{
		"sysconsole_write_integrations",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_INTEGRATION_MANAGEMENT = &Permission{
		"sysconsole_read_integrations_integration_management",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_INTEGRATION_MANAGEMENT = &Permission{
		"sysconsole_write_integrations_integration_management",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_BOT_ACCOUNTS = &Permission{
		"sysconsole_read_integrations_bot_accounts",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_BOT_ACCOUNTS = &Permission{
		"sysconsole_write_integrations_bot_accounts",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_GIF = &Permission{
		"sysconsole_read_integrations_gif",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_GIF = &Permission{
		"sysconsole_write_integrations_gif",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_CORS = &Permission{
		"sysconsole_read_integrations_cors",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_CORS = &Permission{
		"sysconsole_write_integrations_cors",
		"",
		"",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_READ_COMPLIANCE = &Permission{
		"sysconsole_read_compliance",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE = &Permission{
		"sysconsole_write_compliance",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_COMPLIANCE_DATA_RETENTION_POLICY = &Permission{
		"sysconsole_read_compliance_data_retention_policy",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_DATA_RETENTION_POLICY = &Permission{
		"sysconsole_write_compliance_data_retention_policy",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_EXPORT = &Permission{
		"sysconsole_read_compliance_compliance_export",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_EXPORT = &Permission{
		"sysconsole_write_compliance_compliance_export",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_MONITORING = &Permission{
		"sysconsole_read_compliance_compliance_monitoring",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_MONITORING = &Permission{
		"sysconsole_write_compliance_compliance_monitoring",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE = &Permission{
		"sysconsole_read_compliance_custom_terms_of_service",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE = &Permission{
		"sysconsole_write_compliance_custom_terms_of_service",
		"",
		"",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL = &Permission{
		"sysconsole_read_experimental",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	// DEPRECATED
	PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL = &Permission{
		"sysconsole_write_experimental",
		"authentication.permissions.use_group_mentions.name",
		"authentication.permissions.use_group_mentions.description",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_FEATURES = &Permission{
		"sysconsole_read_experimental_features",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_FEATURES = &Permission{
		"sysconsole_write_experimental_features",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_FEATURE_FLAGS = &Permission{
		"sysconsole_read_experimental_feature_flags",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_FEATURE_FLAGS = &Permission{
		"sysconsole_write_experimental_feature_flags",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_BLEVE = &Permission{
		"sysconsole_read_experimental_bleve",
		"",
		"",
		PermissionScopeSystem,
	}
	PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_BLEVE = &Permission{
		"sysconsole_write_experimental_bleve",
		"",
		"",
		PermissionScopeSystem,
	}

	SysconsoleReadPermissions = []*Permission{
		PERMISSION_SYSCONSOLE_READ_ABOUT_EDITION_AND_LICENSE,
		PERMISSION_SYSCONSOLE_READ_BILLING,
		PERMISSION_SYSCONSOLE_READ_REPORTING_SITE_STATISTICS,
		PERMISSION_SYSCONSOLE_READ_REPORTING_TEAM_STATISTICS,
		PERMISSION_SYSCONSOLE_READ_REPORTING_SERVER_LOGS,
		PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS,
		PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS,
		PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_TEAMS,
		PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_CHANNELS,
		PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_PERMISSIONS,
		PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_SYSTEM_ROLES,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_WEB_SERVER,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_DATABASE,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_ELASTICSEARCH,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_FILE_STORAGE,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_IMAGE_PROXY,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_SMTP,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_PUSH_NOTIFICATION_SERVER,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_HIGH_AVAILABILITY,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_RATE_LIMITING,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_LOGGING,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_SESSION_LENGTHS,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_PERFORMANCE_MONITORING,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT_DEVELOPER,
		PERMISSION_SYSCONSOLE_READ_SITE_CUSTOMIZATION,
		PERMISSION_SYSCONSOLE_READ_SITE_LOCALIZATION,
		PERMISSION_SYSCONSOLE_READ_SITE_USERS_AND_TEAMS,
		PERMISSION_SYSCONSOLE_READ_SITE_NOTIFICATIONS,
		PERMISSION_SYSCONSOLE_READ_SITE_ANNOUNCEMENT_BANNER,
		PERMISSION_SYSCONSOLE_READ_SITE_EMOJI,
		PERMISSION_SYSCONSOLE_READ_SITE_POSTS,
		PERMISSION_SYSCONSOLE_READ_SITE_FILE_SHARING_AND_DOWNLOADS,
		PERMISSION_SYSCONSOLE_READ_SITE_PUBLIC_LINKS,
		PERMISSION_SYSCONSOLE_READ_SITE_NOTICES,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_SIGNUP,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_EMAIL,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_PASSWORD,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_MFA,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_LDAP,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_SAML,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_OPENID,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION_GUEST_ACCESS,
		PERMISSION_SYSCONSOLE_READ_PLUGINS,
		PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_INTEGRATION_MANAGEMENT,
		PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_BOT_ACCOUNTS,
		PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_GIF,
		PERMISSION_SYSCONSOLE_READ_INTEGRATIONS_CORS,
		PERMISSION_SYSCONSOLE_READ_COMPLIANCE_DATA_RETENTION_POLICY,
		PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_EXPORT,
		PERMISSION_SYSCONSOLE_READ_COMPLIANCE_COMPLIANCE_MONITORING,
		PERMISSION_SYSCONSOLE_READ_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE,
		PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_FEATURES,
		PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_FEATURE_FLAGS,
		PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL_BLEVE,
	}

	SysconsoleWritePermissions = []*Permission{
		PERMISSION_SYSCONSOLE_WRITE_ABOUT_EDITION_AND_LICENSE,
		PERMISSION_SYSCONSOLE_WRITE_BILLING,
		PERMISSION_SYSCONSOLE_WRITE_REPORTING_SITE_STATISTICS,
		PERMISSION_SYSCONSOLE_WRITE_REPORTING_TEAM_STATISTICS,
		PERMISSION_SYSCONSOLE_WRITE_REPORTING_SERVER_LOGS,
		PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_USERS,
		PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_GROUPS,
		PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_TEAMS,
		PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_CHANNELS,
		PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS,
		PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_SYSTEM_ROLES,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_WEB_SERVER,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DATABASE,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_ELASTICSEARCH,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_FILE_STORAGE,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_IMAGE_PROXY,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_SMTP,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_PUSH_NOTIFICATION_SERVER,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_HIGH_AVAILABILITY,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_RATE_LIMITING,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_LOGGING,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_SESSION_LENGTHS,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_PERFORMANCE_MONITORING,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT_DEVELOPER,
		PERMISSION_SYSCONSOLE_WRITE_SITE_CUSTOMIZATION,
		PERMISSION_SYSCONSOLE_WRITE_SITE_LOCALIZATION,
		PERMISSION_SYSCONSOLE_WRITE_SITE_USERS_AND_TEAMS,
		PERMISSION_SYSCONSOLE_WRITE_SITE_NOTIFICATIONS,
		PERMISSION_SYSCONSOLE_WRITE_SITE_ANNOUNCEMENT_BANNER,
		PERMISSION_SYSCONSOLE_WRITE_SITE_EMOJI,
		PERMISSION_SYSCONSOLE_WRITE_SITE_POSTS,
		PERMISSION_SYSCONSOLE_WRITE_SITE_FILE_SHARING_AND_DOWNLOADS,
		PERMISSION_SYSCONSOLE_WRITE_SITE_PUBLIC_LINKS,
		PERMISSION_SYSCONSOLE_WRITE_SITE_NOTICES,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SIGNUP,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_EMAIL,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_PASSWORD,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_MFA,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_LDAP,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_SAML,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_OPENID,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION_GUEST_ACCESS,
		PERMISSION_SYSCONSOLE_WRITE_PLUGINS,
		PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_INTEGRATION_MANAGEMENT,
		PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_BOT_ACCOUNTS,
		PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_GIF,
		PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS_CORS,
		PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_DATA_RETENTION_POLICY,
		PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_EXPORT,
		PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_COMPLIANCE_MONITORING,
		PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE_CUSTOM_TERMS_OF_SERVICE,
		PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_FEATURES,
		PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_FEATURE_FLAGS,
		PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL_BLEVE,
	}

	SystemScopedPermissionsMinusSysconsole := []*Permission{
		PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE,
		PERMISSION_MANAGE_ROLES,
		PERMISSION_MANAGE_SYSTEM,
		PERMISSION_CREATE_DIRECT_CHANNEL,
		PERMISSION_CREATE_GROUP_CHANNEL,
		PERMISSION_LIST_PUBLIC_TEAMS,
		PERMISSION_JOIN_PUBLIC_TEAMS,
		PERMISSION_LIST_PRIVATE_TEAMS,
		PERMISSION_JOIN_PRIVATE_TEAMS,
		PERMISSION_EDIT_OTHER_USERS,
		PERMISSION_READ_OTHER_USERS_TEAMS,
		PERMISSION_GET_PUBLIC_LINK,
		PERMISSION_MANAGE_OAUTH,
		PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH,
		PERMISSION_CREATE_TEAM,
		PERMISSION_LIST_USERS_WITHOUT_TEAM,
		PERMISSION_CREATE_USER_ACCESS_TOKEN,
		PERMISSION_READ_USER_ACCESS_TOKEN,
		PERMISSION_REVOKE_USER_ACCESS_TOKEN,
		PERMISSION_CREATE_BOT,
		PERMISSION_ASSIGN_BOT,
		PERMISSION_READ_BOTS,
		PERMISSION_READ_OTHERS_BOTS,
		PERMISSION_MANAGE_BOTS,
		PERMISSION_MANAGE_OTHERS_BOTS,
		PERMISSION_READ_JOBS,
		PERMISSION_MANAGE_JOBS,
		PERMISSION_PROMOTE_GUEST,
		PERMISSION_DEMOTE_TO_GUEST,
		PERMISSION_EDIT_BRAND,
		PERMISSION_MANAGE_SHARED_CHANNELS,
		PERMISSION_MANAGE_REMOTE_CLUSTERS,
		PERMISSION_DOWNLOAD_COMPLIANCE_EXPORT_RESULT,
		PERMISSION_CREATE_DATA_RETENTION_JOB,
		PERMISSION_READ_DATA_RETENTION_JOB,
		PERMISSION_CREATE_COMPLIANCE_EXPORT_JOB,
		PERMISSION_READ_COMPLIANCE_EXPORT_JOB,
		PERMISSION_READ_AUDITS,
		PERMISSION_TEST_SITE_URL,
		PERMISSION_TEST_ELASTICSEARCH,
		PERMISSION_TEST_S3,
		PERMISSION_RELOAD_CONFIG,
		PERMISSION_INVALIDATE_CACHES,
		PERMISSION_RECYCLE_DATABASE_CONNECTIONS,
		PERMISSION_PURGE_ELASTICSEARCH_INDEXES,
		PERMISSION_TEST_EMAIL,
		PERMISSION_CREATE_ELASTICSEARCH_POST_INDEXING_JOB,
		PERMISSION_CREATE_ELASTICSEARCH_POST_AGGREGATION_JOB,
		PERMISSION_READ_ELASTICSEARCH_POST_INDEXING_JOB,
		PERMISSION_READ_ELASTICSEARCH_POST_AGGREGATION_JOB,
		PERMISSION_PURGE_BLEVE_INDEXES,
		PERMISSION_CREATE_POST_BLEVE_INDEXES_JOB,
		PERMISSION_CREATE_LDAP_SYNC_JOB,
		PERMISSION_READ_LDAP_SYNC_JOB,
		PERMISSION_TEST_LDAP,
		PERMISSION_INVALIDATE_EMAIL_INVITE,
		PERMISSION_GET_SAML_METADATA_FROM_IDP,
		PERMISSION_ADD_SAML_PUBLIC_CERT,
		PERMISSION_ADD_SAML_PRIVATE_CERT,
		PERMISSION_ADD_SAML_IDP_CERT,
		PERMISSION_REMOVE_SAML_PUBLIC_CERT,
		PERMISSION_REMOVE_SAML_PRIVATE_CERT,
		PERMISSION_REMOVE_SAML_IDP_CERT,
		PERMISSION_GET_SAML_CERT_STATUS,
		PERMISSION_ADD_LDAP_PUBLIC_CERT,
		PERMISSION_ADD_LDAP_PRIVATE_CERT,
		PERMISSION_REMOVE_LDAP_PUBLIC_CERT,
		PERMISSION_REMOVE_LDAP_PRIVATE_CERT,
		PERMISSION_GET_ANALYTICS,
		PERMISSION_GET_LOGS,
		PERMISSION_READ_LICENSE_INFORMATION,
		PERMISSION_MANAGE_LICENSE_INFORMATION,
	}

	TeamScopedPermissions := []*Permission{
		PERMISSION_INVITE_USER,
		PERMISSION_ADD_USER_TO_TEAM,
		PERMISSION_MANAGE_SLASH_COMMANDS,
		PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS,
		PERMISSION_CREATE_PUBLIC_CHANNEL,
		PERMISSION_CREATE_PRIVATE_CHANNEL,
		PERMISSION_MANAGE_TEAM_ROLES,
		PERMISSION_LIST_TEAM_CHANNELS,
		PERMISSION_JOIN_PUBLIC_CHANNELS,
		PERMISSION_READ_PUBLIC_CHANNEL,
		PERMISSION_MANAGE_INCOMING_WEBHOOKS,
		PERMISSION_MANAGE_OUTGOING_WEBHOOKS,
		PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS,
		PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS,
		PERMISSION_CREATE_EMOJIS,
		PERMISSION_DELETE_EMOJIS,
		PERMISSION_DELETE_OTHERS_EMOJIS,
		PERMISSION_REMOVE_USER_FROM_TEAM,
		PERMISSION_MANAGE_TEAM,
		PERMISSION_IMPORT_TEAM,
		PERMISSION_VIEW_TEAM,
		PERMISSION_VIEW_MEMBERS,
		PERMISSION_INVITE_GUEST,
	}

	ChannelScopedPermissions := []*Permission{
		PERMISSION_USE_SLASH_COMMANDS,
		PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS,
		PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS,
		PERMISSION_MANAGE_CHANNEL_ROLES,
		PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES,
		PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES,
		PERMISSION_CONVERT_PUBLIC_CHANNEL_TO_PRIVATE,
		PERMISSION_CONVERT_PRIVATE_CHANNEL_TO_PUBLIC,
		PERMISSION_DELETE_PUBLIC_CHANNEL,
		PERMISSION_DELETE_PRIVATE_CHANNEL,
		PERMISSION_READ_CHANNEL,
		PERMISSION_READ_PUBLIC_CHANNEL_GROUPS,
		PERMISSION_READ_PRIVATE_CHANNEL_GROUPS,
		PERMISSION_ADD_REACTION,
		PERMISSION_REMOVE_REACTION,
		PERMISSION_REMOVE_OTHERS_REACTIONS,
		PERMISSION_UPLOAD_FILE,
		PERMISSION_CREATE_POST,
		PERMISSION_CREATE_POST_PUBLIC,
		PERMISSION_CREATE_POST_EPHEMERAL,
		PERMISSION_EDIT_POST,
		PERMISSION_EDIT_OTHERS_POSTS,
		PERMISSION_DELETE_POST,
		PERMISSION_DELETE_OTHERS_POSTS,
		PERMISSION_USE_CHANNEL_MENTIONS,
		PERMISSION_USE_GROUP_MENTIONS,
	}

	DeprecatedPermissions = []*Permission{
		PERMISSION_PERMANENT_DELETE_USER,
		PERMISSION_MANAGE_WEBHOOKS,
		PERMISSION_MANAGE_OTHERS_WEBHOOKS,
		PERMISSION_MANAGE_EMOJIS,
		PERMISSION_MANAGE_OTHERS_EMOJIS,
		PERMISSION_SYSCONSOLE_READ_AUTHENTICATION,
		PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION,
		PERMISSION_SYSCONSOLE_READ_SITE,
		PERMISSION_SYSCONSOLE_WRITE_SITE,
		PERMISSION_SYSCONSOLE_READ_ENVIRONMENT,
		PERMISSION_SYSCONSOLE_WRITE_ENVIRONMENT,
		PERMISSION_SYSCONSOLE_READ_REPORTING,
		PERMISSION_SYSCONSOLE_WRITE_REPORTING,
		PERMISSION_SYSCONSOLE_READ_ABOUT,
		PERMISSION_SYSCONSOLE_WRITE_ABOUT,
		PERMISSION_SYSCONSOLE_READ_EXPERIMENTAL,
		PERMISSION_SYSCONSOLE_WRITE_EXPERIMENTAL,
		PERMISSION_SYSCONSOLE_READ_INTEGRATIONS,
		PERMISSION_SYSCONSOLE_WRITE_INTEGRATIONS,
		PERMISSION_SYSCONSOLE_READ_COMPLIANCE,
		PERMISSION_SYSCONSOLE_WRITE_COMPLIANCE,
	}

	AllPermissions = []*Permission{}
	AllPermissions = append(AllPermissions, SystemScopedPermissionsMinusSysconsole...)
	AllPermissions = append(AllPermissions, TeamScopedPermissions...)
	AllPermissions = append(AllPermissions, ChannelScopedPermissions...)
	AllPermissions = append(AllPermissions, SysconsoleReadPermissions...)
	AllPermissions = append(AllPermissions, SysconsoleWritePermissions...)

	ChannelModeratedPermissions = []string{
		PERMISSION_CREATE_POST.Id,
		"create_reactions",
		"manage_members",
		PERMISSION_USE_CHANNEL_MENTIONS.Id,
	}

	ChannelModeratedPermissionsMap = map[string]string{
		PERMISSION_CREATE_POST.Id:                    ChannelModeratedPermissions[0],
		PERMISSION_ADD_REACTION.Id:                   ChannelModeratedPermissions[1],
		PERMISSION_REMOVE_REACTION.Id:                ChannelModeratedPermissions[1],
		PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id:  ChannelModeratedPermissions[2],
		PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id: ChannelModeratedPermissions[2],
		PERMISSION_USE_CHANNEL_MENTIONS.Id:           ChannelModeratedPermissions[3],
	}
}

func init() {
	initializePermissions()
}
