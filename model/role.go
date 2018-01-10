// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"regexp"
)

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

	ROLE_NAME_MAX_LENGTH = 64
)

type Role struct {
	Id            string   `json:"id"`
	Name          string   `json:"name"`
	DisplayName   string   `json:"display_name"`
	Description   string   `json:"description"`
	Permissions   []string `json:"permissions"`
	SchemeManaged bool     `json:"scheme_managed"`
}

type RolePatch struct {
	Permissions *[]string `json:"permissions"`
}

func (role *Role) ToJson() string {
	if b, err := json.Marshal(role); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func RoleFromJson(data io.Reader) *Role {
	decoder := json.NewDecoder(data)
	var role Role
	err := decoder.Decode(&role)
	if err == nil {
		return &role
	} else {
		return nil
	}
}

func RoleListToJson(r []*Role) string {
	b, err := json.Marshal(r)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func RoleListFromJson(data io.Reader) []*Role {
	decoder := json.NewDecoder(data)
	var roles []*Role
	err := decoder.Decode(&roles)
	if err == nil {
		return roles
	} else {
		return nil
	}
}

func (r *RolePatch) ToJson() string {
	b, err := json.Marshal(r)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func RolePatchFromJson(data io.Reader) *RolePatch {
	decoder := json.NewDecoder(data)
	var o RolePatch
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Role) Patch(patch *RolePatch) {
	if patch.Permissions != nil {
		o.Permissions = *patch.Permissions
	}
}

var validRoleNameCharacters = regexp.MustCompile(`^[a-z0-9_]+$`)

func IsValidRoleName(roleName string) bool {
	if len(roleName) <= 0 || len(roleName) > 64 {
		return false
	}

	if !validRoleNameCharacters.MatchString(roleName) {
		return false
	}

	return true
}

func MakeDefaultRoles() map[string]*Role {
	roles := make(map[string]*Role)

	roles[CHANNEL_USER_ROLE_ID] = &Role{
		Name:        "channel_user",
		DisplayName: "authentication.roles.channel_user.name",
		Description: "authentication.roles.channel_user.description",
		Permissions: []string{
			PERMISSION_READ_CHANNEL.Id,
			PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			PERMISSION_UPLOAD_FILE.Id,
			PERMISSION_GET_PUBLIC_LINK.Id,
			PERMISSION_CREATE_POST.Id,
			PERMISSION_EDIT_POST.Id,
			PERMISSION_USE_SLASH_COMMANDS.Id,
		},
		SchemeManaged: true,
	}

	roles[CHANNEL_ADMIN_ROLE_ID] = &Role{
		Name:        "channel_admin",
		DisplayName: "authentication.roles.channel_admin.name",
		Description: "authentication.roles.channel_admin.description",
		Permissions: []string{
			PERMISSION_MANAGE_CHANNEL_ROLES.Id,
		},
		SchemeManaged: true,
	}

	roles[CHANNEL_GUEST_ROLE_ID] = &Role{
		Name:          "guest",
		DisplayName:   "authentication.roles.global_guest.name",
		Description:   "authentication.roles.global_guest.description",
		Permissions:   []string{},
		SchemeManaged: true,
	}

	roles[TEAM_USER_ROLE_ID] = &Role{
		Name:        "team_user",
		DisplayName: "authentication.roles.team_user.name",
		Description: "authentication.roles.team_user.description",
		Permissions: []string{
			PERMISSION_LIST_TEAM_CHANNELS.Id,
			PERMISSION_JOIN_PUBLIC_CHANNELS.Id,
			PERMISSION_READ_PUBLIC_CHANNEL.Id,
			PERMISSION_VIEW_TEAM.Id,
		},
		SchemeManaged: true,
	}

	roles[TEAM_POST_ALL_ROLE_ID] = &Role{
		Name:        "team_post_all",
		DisplayName: "authentication.roles.team_post_all.name",
		Description: "authentication.roles.team_post_all.description",
		Permissions: []string{
			PERMISSION_CREATE_POST.Id,
		},
		SchemeManaged: true,
	}

	roles[TEAM_POST_ALL_PUBLIC_ROLE_ID] = &Role{
		Name:        "team_post_all_public",
		DisplayName: "authentication.roles.team_post_all_public.name",
		Description: "authentication.roles.team_post_all_public.description",
		Permissions: []string{
			PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		SchemeManaged: true,
	}

	roles[TEAM_ADMIN_ROLE_ID] = &Role{
		Name:        "team_admin",
		DisplayName: "authentication.roles.team_admin.name",
		Description: "authentication.roles.team_admin.description",
		Permissions: []string{
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
		SchemeManaged: true,
	}

	roles[SYSTEM_USER_ROLE_ID] = &Role{
		Name:        "system_user",
		DisplayName: "authentication.roles.global_user.name",
		Description: "authentication.roles.global_user.description",
		Permissions: []string{
			PERMISSION_CREATE_DIRECT_CHANNEL.Id,
			PERMISSION_CREATE_GROUP_CHANNEL.Id,
			PERMISSION_PERMANENT_DELETE_USER.Id,
		},
		SchemeManaged: true,
	}

	roles[SYSTEM_POST_ALL_ROLE_ID] = &Role{
		Name:        "system_post_all",
		DisplayName: "authentication.roles.system_post_all.name",
		Description: "authentication.roles.system_post_all.description",
		Permissions: []string{
			PERMISSION_CREATE_POST.Id,
		},
		SchemeManaged: true,
	}

	roles[SYSTEM_POST_ALL_PUBLIC_ROLE_ID] = &Role{
		Name:        "system_post_all_public",
		DisplayName: "authentication.roles.system_post_all_public.name",
		Description: "authentication.roles.system_post_all_public.description",
		Permissions: []string{
			PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		SchemeManaged: true,
	}

	roles[SYSTEM_USER_ACCESS_TOKEN_ROLE_ID] = &Role{
		Name:        "system_user_access_token",
		DisplayName: "authentication.roles.system_user_access_token.name",
		Description: "authentication.roles.system_user_access_token.description",
		Permissions: []string{
			PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
			PERMISSION_READ_USER_ACCESS_TOKEN.Id,
			PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
		},
		SchemeManaged: true,
	}

	roles[SYSTEM_ADMIN_ROLE_ID] = &Role{
		Name:        "system_admin",
		DisplayName: "authentication.roles.global_admin.name",
		Description: "authentication.roles.global_admin.description",
		// System admins can do anything channel and team admins can do
		// plus everything members of teams and channels can do to all teams
		// and channels on the system
		Permissions: append(
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
						roles[TEAM_USER_ROLE_ID].Permissions...,
					),
					roles[CHANNEL_USER_ROLE_ID].Permissions...,
				),
				roles[TEAM_ADMIN_ROLE_ID].Permissions...,
			),
			roles[CHANNEL_ADMIN_ROLE_ID].Permissions...,
		),
		SchemeManaged: true,
	}

	return roles
}
