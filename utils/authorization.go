// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

func SetRolePermissionsFromConfig(roles map[string]*model.Role, cfg *model.Config, isLicensed bool) map[string]*model.Role {
	roles[model.TEAM_USER_ROLE_ID].Permissions = append(
		roles[model.TEAM_USER_ROLE_ID].Permissions,
		model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
	)
	roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
		roles[model.CHANNEL_USER_ROLE_ID].Permissions,
		model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
	)
	roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
		roles[model.CHANNEL_USER_ROLE_ID].Permissions,
		model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
	)
	roles[model.TEAM_USER_ROLE_ID].Permissions = append(
		roles[model.TEAM_USER_ROLE_ID].Permissions,
		model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
	)
	roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
		roles[model.CHANNEL_USER_ROLE_ID].Permissions,
		model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
	)
	roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
		roles[model.CHANNEL_USER_ROLE_ID].Permissions,
		model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
	)
	roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
		roles[model.CHANNEL_USER_ROLE_ID].Permissions,
		model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
	)
	roles[model.TEAM_USER_ROLE_ID].Permissions = append(
		roles[model.TEAM_USER_ROLE_ID].Permissions,
		model.PERMISSION_INVITE_USER.Id,
		model.PERMISSION_ADD_USER_TO_TEAM.Id,
	)
	roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
		roles[model.CHANNEL_USER_ROLE_ID].Permissions,
		model.PERMISSION_DELETE_POST.Id,
	)
	roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
		roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
		model.PERMISSION_DELETE_POST.Id,
		model.PERMISSION_DELETE_OTHERS_POSTS.Id,
	)

	roles[model.SYSTEM_USER_ROLE_ID].Permissions = append(
		roles[model.SYSTEM_USER_ROLE_ID].Permissions,
		model.PERMISSION_CREATE_TEAM.Id,
	)
	roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
		roles[model.CHANNEL_USER_ROLE_ID].Permissions,
		model.PERMISSION_EDIT_POST.Id,
	)
	roles[model.SYSTEM_ADMIN_ROLE_ID].Permissions = append(
		roles[model.SYSTEM_ADMIN_ROLE_ID].Permissions,
		model.PERMISSION_EDIT_POST.Id,
	)

	return roles
}
