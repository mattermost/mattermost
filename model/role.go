// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
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

	ROLE_NAME_MAX_LENGTH         = 64
	ROLE_DISPLAY_NAME_MAX_LENGTH = 128
	ROLE_DESCRIPTION_MAX_LENGTH  = 1024
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

type RolePatch struct {
	Permissions *[]string `json:"permissions"`
}

func (role *Role) ToJson() string {
	b, _ := json.Marshal(role)
	return string(b)
}

func RoleFromJson(data io.Reader) *Role {
	var role *Role
	json.NewDecoder(data).Decode(&role)
	return role
}

func RoleListToJson(r []*Role) string {
	b, _ := json.Marshal(r)
	return string(b)
}

func RoleListFromJson(data io.Reader) []*Role {
	var roles []*Role
	json.NewDecoder(data).Decode(&roles)
	return roles
}

func (r *RolePatch) ToJson() string {
	b, _ := json.Marshal(r)
	return string(b)
}

func RolePatchFromJson(data io.Reader) *RolePatch {
	var rolePatch *RolePatch
	json.NewDecoder(data).Decode(&rolePatch)
	return rolePatch
}

func (o *Role) Patch(patch *RolePatch) {
	if patch.Permissions != nil {
		o.Permissions = *patch.Permissions
	}
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

func (role *Role) IsValid() bool {
	if len(role.Id) != 26 {
		return false
	}

	return role.IsValidWithoutId()
}

func (role *Role) IsValidWithoutId() bool {
	if !IsValidRoleName(role.Name) {
		return false
	}

	if len(role.DisplayName) == 0 || len(role.DisplayName) > ROLE_DISPLAY_NAME_MAX_LENGTH {
		return false
	}

	if len(role.Description) > ROLE_DESCRIPTION_MAX_LENGTH {
		return false
	}

	for _, permission := range role.Permissions {
		permissionValidated := false
		for _, p := range ALL_PERMISSIONS {
			if permission == p.Id {
				permissionValidated = true
				break
			}
		}

		if !permissionValidated {
			return false
		}
	}

	return true
}

func IsValidRoleName(roleName string) bool {
	if len(roleName) <= 0 || len(roleName) > ROLE_NAME_MAX_LENGTH {
		return false
	}

	if strings.TrimLeft(roleName, "abcdefghijklmnopqrstuvwxyz0123456789_") != "" {
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
			PERMISSION_ADD_REACTION.Id,
			PERMISSION_REMOVE_REACTION.Id,
			PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			PERMISSION_UPLOAD_FILE.Id,
			PERMISSION_GET_PUBLIC_LINK.Id,
			PERMISSION_CREATE_POST.Id,
			PERMISSION_USE_SLASH_COMMANDS.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
	}

	roles[CHANNEL_ADMIN_ROLE_ID] = &Role{
		Name:        "channel_admin",
		DisplayName: "authentication.roles.channel_admin.name",
		Description: "authentication.roles.channel_admin.description",
		Permissions: []string{
			PERMISSION_MANAGE_CHANNEL_ROLES.Id,
		},
		SchemeManaged: true,
		BuiltIn:       true,
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
		BuiltIn:       true,
	}

	roles[TEAM_POST_ALL_ROLE_ID] = &Role{
		Name:        "team_post_all",
		DisplayName: "authentication.roles.team_post_all.name",
		Description: "authentication.roles.team_post_all.description",
		Permissions: []string{
			PERMISSION_CREATE_POST.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[TEAM_POST_ALL_PUBLIC_ROLE_ID] = &Role{
		Name:        "team_post_all_public",
		DisplayName: "authentication.roles.team_post_all_public.name",
		Description: "authentication.roles.team_post_all_public.description",
		Permissions: []string{
			PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
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
		BuiltIn:       true,
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
		BuiltIn:       true,
	}

	roles[SYSTEM_POST_ALL_ROLE_ID] = &Role{
		Name:        "system_post_all",
		DisplayName: "authentication.roles.system_post_all.name",
		Description: "authentication.roles.system_post_all.description",
		Permissions: []string{
			PERMISSION_CREATE_POST.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
	}

	roles[SYSTEM_POST_ALL_PUBLIC_ROLE_ID] = &Role{
		Name:        "system_post_all_public",
		DisplayName: "authentication.roles.system_post_all_public.name",
		Description: "authentication.roles.system_post_all_public.description",
		Permissions: []string{
			PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		SchemeManaged: false,
		BuiltIn:       true,
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
		SchemeManaged: false,
		BuiltIn:       true,
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
							PERMISSION_CREATE_POST_EPHEMERAL.Id,
							PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
							PERMISSION_READ_USER_ACCESS_TOKEN.Id,
							PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
							PERMISSION_REMOVE_OTHERS_REACTIONS.Id,
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
		BuiltIn:       true,
	}

	return roles
}
