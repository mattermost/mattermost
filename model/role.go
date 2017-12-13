// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type Role struct {
	Id            int64   `json:"id"`
	Name          string   `json:"name"`
	DisplayName   string   `json:"display_name"`
	Description   string   `json:"description"`
	Permissions   []string `json:"permissions"`
	SchemeManaged bool     `json:"scheme_managed"`
}

type Roles []*Role

const (
	SYSTEM_USER_ROLE_ID              = "system_user"
	SYSTEM_ADMIN_ROLE_ID             = "system_admin"
	SYSTEM_POST_ALL_ROLE_ID          = "system_post_all"
	SYSTEM_POST_ALL_PUBLIC_ROLE_ID   = "system_post_all_public"
	SYSTEM_USER_ACCESS_TOKEN_ROLE_ID = "system_user_access_token"

	TEAM_USER_ROLE_ID            = "team_user"
	TEAM_ADMIN_ROLE_ID           = "team_admin"
	TEAM_POST_ALL_ROLE_ID        = "team_post_all"
	TEAM_POST_ALL_PUBLIC_ROLE_ID = "team_post_all_public"

	CHANNEL_USER_ROLE_ID  = "channel_user"
	CHANNEL_ADMIN_ROLE_ID = "channel_admin"
	CHANNEL_GUEST_ROLE_ID = "guest"
)

var DefaultRoles map[string]*Role

func initializeDefaultRoles() {
	DefaultRoles = make(map[string]*Role)

	DefaultRoles[CHANNEL_USER_ROLE_ID] = &Role{
		0,
		"channel_user",
		"authentication.roles.channel_user.name",
		"authentication.roles.channel_user.description",
		[]string{
			PERMISSION_READ_CHANNEL.Id,
			PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			PERMISSION_UPLOAD_FILE.Id,
			PERMISSION_GET_PUBLIC_LINK.Id,
			PERMISSION_CREATE_POST.Id,
			PERMISSION_EDIT_POST.Id,
			PERMISSION_USE_SLASH_COMMANDS.Id,
		},
		true,
	}

	DefaultRoles[CHANNEL_ADMIN_ROLE_ID] = &Role{
		1,
		"channel_admin",
		"authentication.roles.channel_admin.name",
		"authentication.roles.channel_admin.description",
		[]string{
			PERMISSION_MANAGE_CHANNEL_ROLES.Id,
		},
		true,
	}

	DefaultRoles[CHANNEL_GUEST_ROLE_ID] = &Role{
		2,
		"guest",
		"authentication.roles.global_guest.name",
		"authentication.roles.global_guest.description",
		[]string{},
		true,
	}

	DefaultRoles[TEAM_USER_ROLE_ID] = &Role{
		3,
		"team_user",
		"authentication.roles.team_user.name",
		"authentication.roles.team_user.description",
		[]string{
			PERMISSION_LIST_TEAM_CHANNELS.Id,
			PERMISSION_JOIN_PUBLIC_CHANNELS.Id,
			PERMISSION_READ_PUBLIC_CHANNEL.Id,
			PERMISSION_VIEW_TEAM.Id,
		},
		true,
	}

	DefaultRoles[TEAM_POST_ALL_ROLE_ID] = &Role{
		4,
		"team_post_all",
		"authentication.roles.team_post_all.name",
		"authentication.roles.team_post_all.description",
		[]string{
			PERMISSION_CREATE_POST.Id,
		},
		true,
	}

	DefaultRoles[TEAM_POST_ALL_PUBLIC_ROLE_ID] = &Role{
		5,
		"team_post_all_public",
		"authentication.roles.team_post_all_public.name",
		"authentication.roles.team_post_all_public.description",
		[]string{
			PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		true,
	}

	DefaultRoles[TEAM_ADMIN_ROLE_ID] = &Role{
		6,
		"team_admin",
		"authentication.roles.team_admin.name",
		"authentication.roles.team_admin.description",
		[]string{
			PERMISSION_EDIT_OTHERS_POSTS.Id,
			PERMISSION_REMOVE_USER_FROM_TEAM.Id,
			PERMISSION_MANAGE_TEAM.Id,
			PERMISSION_IMPORT_TEAM.Id,
			PERMISSION_MANAGE_TEAM_ROLES.Id,
			PERMISSION_MANAGE_CHANNEL_ROLES.Id,
			PERMISSION_MANAGE_OTHERS_WEBHOOKS.Id,
			PERMISSION_MANAGE_SLASH_COMMANDS.Id,
			PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS.Id,
			PERMISSION_MANAGE_WEBHOOKS.Id,
		},
		true,
	}

	DefaultRoles[SYSTEM_USER_ROLE_ID] = &Role{
		7,
		"system_user",
		"authentication.roles.global_user.name",
		"authentication.roles.global_user.description",
		[]string{
			PERMISSION_CREATE_DIRECT_CHANNEL.Id,
			PERMISSION_CREATE_GROUP_CHANNEL.Id,
			PERMISSION_PERMANENT_DELETE_USER.Id,
		},
		true,
	}

	DefaultRoles[SYSTEM_POST_ALL_ROLE_ID] = &Role{
		8,
		"system_post_all",
		"authentication.roles.system_post_all.name",
		"authentication.roles.system_post_all.description",
		[]string{
			PERMISSION_CREATE_POST.Id,
		},
		true,
	}

	DefaultRoles[SYSTEM_POST_ALL_PUBLIC_ROLE_ID] = &Role{
		9,
		"system_post_all_public",
		"authentication.roles.system_post_all_public.name",
		"authentication.roles.system_post_all_public.description",
		[]string{
			PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		true,
	}

	DefaultRoles[SYSTEM_USER_ACCESS_TOKEN_ROLE_ID] = &Role{
		10,
		"system_user_access_token",
		"authentication.roles.system_user_access_token.name",
		"authentication.roles.system_user_access_token.description",
		[]string{
			PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
			PERMISSION_READ_USER_ACCESS_TOKEN.Id,
			PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
		},
		true,
	}

	DefaultRoles[SYSTEM_ADMIN_ROLE_ID] = &Role{
		11,
		"system_admin",
		"authentication.roles.global_admin.name",
		"authentication.roles.global_admin.description",
		// System admins can do anything channel and team admins can do
		// plus everything members of teams and channels can do to all teams
		// and channels on the system
		append(
			append(
				append(
					append(
						[]string{
							PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE.Id,
							PERMISSION_MANAGE_SYSTEM.Id,
							PERMISSION_MANAGE_ROLES.Id,
							PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
							PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
							PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
							PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
							PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
							PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
							PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
							PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
							PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH.Id,
							PERMISSION_MANAGE_OTHERS_WEBHOOKS.Id,
							PERMISSION_EDIT_OTHER_USERS.Id,
							PERMISSION_MANAGE_OAUTH.Id,
							PERMISSION_INVITE_USER.Id,
							PERMISSION_DELETE_POST.Id,
							PERMISSION_DELETE_OTHERS_POSTS.Id,
							PERMISSION_CREATE_TEAM.Id,
							PERMISSION_ADD_USER_TO_TEAM.Id,
							PERMISSION_LIST_USERS_WITHOUT_TEAM.Id,
							PERMISSION_MANAGE_JOBS.Id,
							PERMISSION_CREATE_POST_PUBLIC.Id,
							PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
							PERMISSION_READ_USER_ACCESS_TOKEN.Id,
							PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
						},
						DefaultRoles[TEAM_USER_ROLE_ID].Permissions...,
					),
					DefaultRoles[CHANNEL_USER_ROLE_ID].Permissions...,
				),
				DefaultRoles[TEAM_ADMIN_ROLE_ID].Permissions...,
			),
			DefaultRoles[CHANNEL_ADMIN_ROLE_ID].Permissions...,
		),
		true,
	}
}

func init() {
	initializePermissions()
	initializeDefaultRoles()
}
