// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

const (
	PERMISSION_SCOPE_SYSTEM  = "system_scope"
	PERMISSION_SCOPE_TEAM    = "team_scope"
	PERMISSION_SCOPE_CHANNEL = "channel_scope"
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
var PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE *Permission
var PERMISSION_MANAGE_ROLES *Permission
var PERMISSION_MANAGE_TEAM_ROLES *Permission
var PERMISSION_MANAGE_CHANNEL_ROLES *Permission
var PERMISSION_CREATE_DIRECT_CHANNEL *Permission
var PERMISSION_CREATE_GROUP_CHANNEL *Permission
var PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES *Permission
var PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES *Permission
var PERMISSION_LIST_TEAM_CHANNELS *Permission
var PERMISSION_JOIN_PUBLIC_CHANNELS *Permission
var PERMISSION_DELETE_PUBLIC_CHANNEL *Permission
var PERMISSION_DELETE_PRIVATE_CHANNEL *Permission
var PERMISSION_EDIT_OTHER_USERS *Permission
var PERMISSION_READ_CHANNEL *Permission
var PERMISSION_READ_PUBLIC_CHANNEL *Permission
var PERMISSION_ADD_REACTION *Permission
var PERMISSION_REMOVE_REACTION *Permission
var PERMISSION_REMOVE_OTHERS_REACTIONS *Permission
var PERMISSION_PERMANENT_DELETE_USER *Permission
var PERMISSION_UPLOAD_FILE *Permission
var PERMISSION_GET_PUBLIC_LINK *Permission
var PERMISSION_MANAGE_WEBHOOKS *Permission
var PERMISSION_MANAGE_OTHERS_WEBHOOKS *Permission
var PERMISSION_MANAGE_OAUTH *Permission
var PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH *Permission
var PERMISSION_MANAGE_EMOJIS *Permission
var PERMISSION_MANAGE_OTHERS_EMOJIS *Permission
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
var PERMISSION_MANAGE_JOBS *Permission
var PERMISSION_CREATE_USER_ACCESS_TOKEN *Permission
var PERMISSION_READ_USER_ACCESS_TOKEN *Permission
var PERMISSION_REVOKE_USER_ACCESS_TOKEN *Permission

// General permission that encompasses all system admin functions
// in the future this could be broken up to allow access to some
// admin functions but not others
var PERMISSION_MANAGE_SYSTEM *Permission

var ALL_PERMISSIONS []*Permission

func initializePermissions() {
	PERMISSION_INVITE_USER = &Permission{
		"invite_user",
		"authentication.permissions.team_invite_user.name",
		"authentication.permissions.team_invite_user.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_ADD_USER_TO_TEAM = &Permission{
		"add_user_to_team",
		"authentication.permissions.add_user_to_team.name",
		"authentication.permissions.add_user_to_team.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_USE_SLASH_COMMANDS = &Permission{
		"use_slash_commands",
		"authentication.permissions.team_use_slash_commands.name",
		"authentication.permissions.team_use_slash_commands.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_MANAGE_SLASH_COMMANDS = &Permission{
		"manage_slash_commands",
		"authentication.permissions.manage_slash_commands.name",
		"authentication.permissions.manage_slash_commands.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS = &Permission{
		"manage_others_slash_commands",
		"authentication.permissions.manage_others_slash_commands.name",
		"authentication.permissions.manage_others_slash_commands.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_CREATE_PUBLIC_CHANNEL = &Permission{
		"create_public_channel",
		"authentication.permissions.create_public_channel.name",
		"authentication.permissions.create_public_channel.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_CREATE_PRIVATE_CHANNEL = &Permission{
		"create_private_channel",
		"authentication.permissions.create_private_channel.name",
		"authentication.permissions.create_private_channel.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS = &Permission{
		"manage_public_channel_members",
		"authentication.permissions.manage_public_channel_members.name",
		"authentication.permissions.manage_public_channel_members.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS = &Permission{
		"manage_private_channel_members",
		"authentication.permissions.manage_private_channel_members.name",
		"authentication.permissions.manage_private_channel_members.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE = &Permission{
		"assign_system_admin_role",
		"authentication.permissions.assign_system_admin_role.name",
		"authentication.permissions.assign_system_admin_role.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_MANAGE_ROLES = &Permission{
		"manage_roles",
		"authentication.permissions.manage_roles.name",
		"authentication.permissions.manage_roles.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_MANAGE_TEAM_ROLES = &Permission{
		"manage_team_roles",
		"authentication.permissions.manage_team_roles.name",
		"authentication.permissions.manage_team_roles.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_MANAGE_CHANNEL_ROLES = &Permission{
		"manage_channel_roles",
		"authentication.permissions.manage_channel_roles.name",
		"authentication.permissions.manage_channel_roles.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_MANAGE_SYSTEM = &Permission{
		"manage_system",
		"authentication.permissions.manage_system.name",
		"authentication.permissions.manage_system.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_CREATE_DIRECT_CHANNEL = &Permission{
		"create_direct_channel",
		"authentication.permissions.create_direct_channel.name",
		"authentication.permissions.create_direct_channel.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_CREATE_GROUP_CHANNEL = &Permission{
		"create_group_channel",
		"authentication.permissions.create_group_channel.name",
		"authentication.permissions.create_group_channel.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES = &Permission{
		"manage_public_channel_properties",
		"authentication.permissions.manage_public_channel_properties.name",
		"authentication.permissions.manage_public_channel_properties.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES = &Permission{
		"manage_private_channel_properties",
		"authentication.permissions.manage_private_channel_properties.name",
		"authentication.permissions.manage_private_channel_properties.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_LIST_TEAM_CHANNELS = &Permission{
		"list_team_channels",
		"authentication.permissions.list_team_channels.name",
		"authentication.permissions.list_team_channels.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_JOIN_PUBLIC_CHANNELS = &Permission{
		"join_public_channels",
		"authentication.permissions.join_public_channels.name",
		"authentication.permissions.join_public_channels.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_DELETE_PUBLIC_CHANNEL = &Permission{
		"delete_public_channel",
		"authentication.permissions.delete_public_channel.name",
		"authentication.permissions.delete_public_channel.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_DELETE_PRIVATE_CHANNEL = &Permission{
		"delete_private_channel",
		"authentication.permissions.delete_private_channel.name",
		"authentication.permissions.delete_private_channel.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_EDIT_OTHER_USERS = &Permission{
		"edit_other_users",
		"authentication.permissions.edit_other_users.name",
		"authentication.permissions.edit_other_users.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_READ_CHANNEL = &Permission{
		"read_channel",
		"authentication.permissions.read_channel.name",
		"authentication.permissions.read_channel.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_READ_PUBLIC_CHANNEL = &Permission{
		"read_public_channel",
		"authentication.permissions.read_public_channel.name",
		"authentication.permissions.read_public_channel.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_ADD_REACTION = &Permission{
		"add_reaction",
		"authentication.permissions.add_reaction.name",
		"authentication.permissions.add_reaction.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_REMOVE_REACTION = &Permission{
		"remove_reaction",
		"authentication.permissions.remove_reaction.name",
		"authentication.permissions.remove_reaction.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_REMOVE_OTHERS_REACTIONS = &Permission{
		"remove_others_reactions",
		"authentication.permissions.remove_others_reactions.name",
		"authentication.permissions.remove_others_reactions.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_PERMANENT_DELETE_USER = &Permission{
		"permanent_delete_user",
		"authentication.permissions.permanent_delete_user.name",
		"authentication.permissions.permanent_delete_user.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_UPLOAD_FILE = &Permission{
		"upload_file",
		"authentication.permissions.upload_file.name",
		"authentication.permissions.upload_file.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_GET_PUBLIC_LINK = &Permission{
		"get_public_link",
		"authentication.permissions.get_public_link.name",
		"authentication.permissions.get_public_link.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_MANAGE_WEBHOOKS = &Permission{
		"manage_webhooks",
		"authentication.permissions.manage_webhooks.name",
		"authentication.permissions.manage_webhooks.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_MANAGE_OTHERS_WEBHOOKS = &Permission{
		"manage_others_webhooks",
		"authentication.permissions.manage_others_webhooks.name",
		"authentication.permissions.manage_others_webhooks.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_MANAGE_OAUTH = &Permission{
		"manage_oauth",
		"authentication.permissions.manage_oauth.name",
		"authentication.permissions.manage_oauth.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH = &Permission{
		"manage_system_wide_oauth",
		"authentication.permissions.manage_system_wide_oauth.name",
		"authentication.permissions.manage_system_wide_oauth.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_MANAGE_EMOJIS = &Permission{
		"manage_emojis",
		"authentication.permissions.manage_emojis.name",
		"authentication.permissions.manage_emojis.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_MANAGE_OTHERS_EMOJIS = &Permission{
		"manage_others_emojis",
		"authentication.permissions.manage_others_emojis.name",
		"authentication.permissions.manage_others_emojis.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_CREATE_POST = &Permission{
		"create_post",
		"authentication.permissions.create_post.name",
		"authentication.permissions.create_post.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_CREATE_POST_PUBLIC = &Permission{
		"create_post_public",
		"authentication.permissions.create_post_public.name",
		"authentication.permissions.create_post_public.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_CREATE_POST_EPHEMERAL = &Permission{
		"create_post_ephemeral",
		"authentication.permissions.create_post_ephemeral.name",
		"authentication.permissions.create_post_ephemeral.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_EDIT_POST = &Permission{
		"edit_post",
		"authentication.permissions.edit_post.name",
		"authentication.permissions.edit_post.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_EDIT_OTHERS_POSTS = &Permission{
		"edit_others_posts",
		"authentication.permissions.edit_others_posts.name",
		"authentication.permissions.edit_others_posts.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_DELETE_POST = &Permission{
		"delete_post",
		"authentication.permissions.delete_post.name",
		"authentication.permissions.delete_post.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_DELETE_OTHERS_POSTS = &Permission{
		"delete_others_posts",
		"authentication.permissions.delete_others_posts.name",
		"authentication.permissions.delete_others_posts.description",
		PERMISSION_SCOPE_CHANNEL,
	}
	PERMISSION_REMOVE_USER_FROM_TEAM = &Permission{
		"remove_user_from_team",
		"authentication.permissions.remove_user_from_team.name",
		"authentication.permissions.remove_user_from_team.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_CREATE_TEAM = &Permission{
		"create_team",
		"authentication.permissions.create_team.name",
		"authentication.permissions.create_team.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_MANAGE_TEAM = &Permission{
		"manage_team",
		"authentication.permissions.manage_team.name",
		"authentication.permissions.manage_team.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_IMPORT_TEAM = &Permission{
		"import_team",
		"authentication.permissions.import_team.name",
		"authentication.permissions.import_team.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_VIEW_TEAM = &Permission{
		"view_team",
		"authentication.permissions.view_team.name",
		"authentication.permissions.view_team.description",
		PERMISSION_SCOPE_TEAM,
	}
	PERMISSION_LIST_USERS_WITHOUT_TEAM = &Permission{
		"list_users_without_team",
		"authentication.permissions.list_users_without_team.name",
		"authentication.permissions.list_users_without_team.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_CREATE_USER_ACCESS_TOKEN = &Permission{
		"create_user_access_token",
		"authentication.permissions.create_user_access_token.name",
		"authentication.permissions.create_user_access_token.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_READ_USER_ACCESS_TOKEN = &Permission{
		"read_user_access_token",
		"authentication.permissions.read_user_access_token.name",
		"authentication.permissions.read_user_access_token.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_REVOKE_USER_ACCESS_TOKEN = &Permission{
		"revoke_user_access_token",
		"authentication.permissions.revoke_user_access_token.name",
		"authentication.permissions.revoke_user_access_token.description",
		PERMISSION_SCOPE_SYSTEM,
	}
	PERMISSION_MANAGE_JOBS = &Permission{
		"manage_jobs",
		"authentication.permisssions.manage_jobs.name",
		"authentication.permisssions.manage_jobs.description",
		PERMISSION_SCOPE_SYSTEM,
	}

	ALL_PERMISSIONS = []*Permission{
		PERMISSION_INVITE_USER,
		PERMISSION_ADD_USER_TO_TEAM,
		PERMISSION_USE_SLASH_COMMANDS,
		PERMISSION_MANAGE_SLASH_COMMANDS,
		PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS,
		PERMISSION_CREATE_PUBLIC_CHANNEL,
		PERMISSION_CREATE_PRIVATE_CHANNEL,
		PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS,
		PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS,
		PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE,
		PERMISSION_MANAGE_ROLES,
		PERMISSION_MANAGE_TEAM_ROLES,
		PERMISSION_MANAGE_CHANNEL_ROLES,
		PERMISSION_CREATE_DIRECT_CHANNEL,
		PERMISSION_CREATE_GROUP_CHANNEL,
		PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES,
		PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES,
		PERMISSION_LIST_TEAM_CHANNELS,
		PERMISSION_JOIN_PUBLIC_CHANNELS,
		PERMISSION_DELETE_PUBLIC_CHANNEL,
		PERMISSION_DELETE_PRIVATE_CHANNEL,
		PERMISSION_EDIT_OTHER_USERS,
		PERMISSION_READ_CHANNEL,
		PERMISSION_READ_PUBLIC_CHANNEL,
		PERMISSION_ADD_REACTION,
		PERMISSION_REMOVE_REACTION,
		PERMISSION_REMOVE_OTHERS_REACTIONS,
		PERMISSION_PERMANENT_DELETE_USER,
		PERMISSION_UPLOAD_FILE,
		PERMISSION_GET_PUBLIC_LINK,
		PERMISSION_MANAGE_WEBHOOKS,
		PERMISSION_MANAGE_OTHERS_WEBHOOKS,
		PERMISSION_MANAGE_OAUTH,
		PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH,
		PERMISSION_MANAGE_EMOJIS,
		PERMISSION_MANAGE_OTHERS_EMOJIS,
		PERMISSION_CREATE_POST,
		PERMISSION_CREATE_POST_PUBLIC,
		PERMISSION_CREATE_POST_EPHEMERAL,
		PERMISSION_EDIT_POST,
		PERMISSION_EDIT_OTHERS_POSTS,
		PERMISSION_DELETE_POST,
		PERMISSION_DELETE_OTHERS_POSTS,
		PERMISSION_REMOVE_USER_FROM_TEAM,
		PERMISSION_CREATE_TEAM,
		PERMISSION_MANAGE_TEAM,
		PERMISSION_IMPORT_TEAM,
		PERMISSION_VIEW_TEAM,
		PERMISSION_LIST_USERS_WITHOUT_TEAM,
		PERMISSION_MANAGE_JOBS,
		PERMISSION_CREATE_USER_ACCESS_TOKEN,
		PERMISSION_READ_USER_ACCESS_TOKEN,
		PERMISSION_REVOKE_USER_ACCESS_TOKEN,
		PERMISSION_MANAGE_SYSTEM,
	}
}

func init() {
	initializePermissions()
}
