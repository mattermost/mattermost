// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

func SetRolePermissionsFromConfig(roles map[string]*model.Role, cfg *model.Config, isLicensed bool) map[string]*model.Role {
	roles[model.TeamUserRoleId].Permissions = append(
		roles[model.TeamUserRoleId].Permissions,
		model.PermissionCreatePublicChannel.Id,
	)
	roles[model.ChannelUserRoleId].Permissions = append(
		roles[model.ChannelUserRoleId].Permissions,
		model.PermissionManagePublicChannelProperties.Id,
	)
	roles[model.ChannelUserRoleId].Permissions = append(
		roles[model.ChannelUserRoleId].Permissions,
		model.PermissionDeletePublicChannel.Id,
	)
	roles[model.TeamUserRoleId].Permissions = append(
		roles[model.TeamUserRoleId].Permissions,
		model.PermissionCreatePrivateChannel.Id,
	)
	roles[model.ChannelUserRoleId].Permissions = append(
		roles[model.ChannelUserRoleId].Permissions,
		model.PermissionManagePrivateChannelProperties.Id,
	)
	roles[model.ChannelUserRoleId].Permissions = append(
		roles[model.ChannelUserRoleId].Permissions,
		model.PermissionDeletePrivateChannel.Id,
	)
	roles[model.ChannelUserRoleId].Permissions = append(
		roles[model.ChannelUserRoleId].Permissions,
		model.PermissionManagePrivateChannelMembers.Id,
	)
	roles[model.TeamUserRoleId].Permissions = append(
		roles[model.TeamUserRoleId].Permissions,
		model.PermissionInviteUser.Id,
		model.PermissionAddUserToTeam.Id,
	)
	roles[model.ChannelUserRoleId].Permissions = append(
		roles[model.ChannelUserRoleId].Permissions,
		model.PermissionDeletePost.Id,
	)
	roles[model.TeamAdminRoleId].Permissions = append(
		roles[model.TeamAdminRoleId].Permissions,
		model.PermissionDeletePost.Id,
		model.PermissionDeleteOthersPosts.Id,
	)

	roles[model.SystemUserRoleId].Permissions = append(
		roles[model.SystemUserRoleId].Permissions,
		model.PermissionCreateTeam.Id,
	)
	roles[model.ChannelUserRoleId].Permissions = append(
		roles[model.ChannelUserRoleId].Permissions,
		model.PermissionEditPost.Id,
	)
	roles[model.SystemAdminRoleId].Permissions = append(
		roles[model.SystemAdminRoleId].Permissions,
		model.PermissionEditPost.Id,
	)

	return roles
}
