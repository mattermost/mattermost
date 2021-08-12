// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

func SetRolePermissionsFromConfig(roles map[string]*model.Role, cfg *model.Config, isLicensed bool) map[string]*model.Role {
	if isLicensed {
		switch *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPublicChannelCreation {
		case model.PermissionsAll:
			roles[model.TeamUserRoleId].Permissions = append(
				roles[model.TeamUserRoleId].Permissions,
				model.PermissionCreatePublicChannel.Id,
			)
		case model.PermissionsTeamAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionCreatePublicChannel.Id,
			)
		}
	} else {
		roles[model.TeamUserRoleId].Permissions = append(
			roles[model.TeamUserRoleId].Permissions,
			model.PermissionCreatePublicChannel.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement {
		case model.PermissionsAll:
			roles[model.ChannelUserRoleId].Permissions = append(
				roles[model.ChannelUserRoleId].Permissions,
				model.PermissionManagePublicChannelProperties.Id,
			)
		case model.PermissionsChannelAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionManagePublicChannelProperties.Id,
			)
			roles[model.ChannelAdminRoleId].Permissions = append(
				roles[model.ChannelAdminRoleId].Permissions,
				model.PermissionManagePublicChannelProperties.Id,
			)
		case model.PermissionsTeamAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionManagePublicChannelProperties.Id,
			)
		}
	} else {
		roles[model.ChannelUserRoleId].Permissions = append(
			roles[model.ChannelUserRoleId].Permissions,
			model.PermissionManagePublicChannelProperties.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPublicChannelDeletion {
		case model.PermissionsAll:
			roles[model.ChannelUserRoleId].Permissions = append(
				roles[model.ChannelUserRoleId].Permissions,
				model.PermissionDeletePublicChannel.Id,
			)
		case model.PermissionsChannelAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionDeletePublicChannel.Id,
			)
			roles[model.ChannelAdminRoleId].Permissions = append(
				roles[model.ChannelAdminRoleId].Permissions,
				model.PermissionDeletePublicChannel.Id,
			)
		case model.PermissionsTeamAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionDeletePublicChannel.Id,
			)
		}
	} else {
		roles[model.ChannelUserRoleId].Permissions = append(
			roles[model.ChannelUserRoleId].Permissions,
			model.PermissionDeletePublicChannel.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelCreation {
		case model.PermissionsAll:
			roles[model.TeamUserRoleId].Permissions = append(
				roles[model.TeamUserRoleId].Permissions,
				model.PermissionCreatePrivateChannel.Id,
			)
		case model.PermissionsTeamAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionCreatePrivateChannel.Id,
			)
		}
	} else {
		roles[model.TeamUserRoleId].Permissions = append(
			roles[model.TeamUserRoleId].Permissions,
			model.PermissionCreatePrivateChannel.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement {
		case model.PermissionsAll:
			roles[model.ChannelUserRoleId].Permissions = append(
				roles[model.ChannelUserRoleId].Permissions,
				model.PermissionManagePrivateChannelProperties.Id,
			)
		case model.PermissionsChannelAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionManagePrivateChannelProperties.Id,
			)
			roles[model.ChannelAdminRoleId].Permissions = append(
				roles[model.ChannelAdminRoleId].Permissions,
				model.PermissionManagePrivateChannelProperties.Id,
			)
		case model.PermissionsTeamAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionManagePrivateChannelProperties.Id,
			)
		}
	} else {
		roles[model.ChannelUserRoleId].Permissions = append(
			roles[model.ChannelUserRoleId].Permissions,
			model.PermissionManagePrivateChannelProperties.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelDeletion {
		case model.PermissionsAll:
			roles[model.ChannelUserRoleId].Permissions = append(
				roles[model.ChannelUserRoleId].Permissions,
				model.PermissionDeletePrivateChannel.Id,
			)
		case model.PermissionsChannelAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionDeletePrivateChannel.Id,
			)
			roles[model.ChannelAdminRoleId].Permissions = append(
				roles[model.ChannelAdminRoleId].Permissions,
				model.PermissionDeletePrivateChannel.Id,
			)
		case model.PermissionsTeamAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionDeletePrivateChannel.Id,
			)
		}
	} else {
		roles[model.ChannelUserRoleId].Permissions = append(
			roles[model.ChannelUserRoleId].Permissions,
			model.PermissionDeletePrivateChannel.Id,
		)
	}

	// Restrict permissions for Private Channel Manage Members
	if isLicensed {
		switch *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManageMembers {
		case model.PermissionsAll:
			roles[model.ChannelUserRoleId].Permissions = append(
				roles[model.ChannelUserRoleId].Permissions,
				model.PermissionManagePrivateChannelMembers.Id,
			)
		case model.PermissionsChannelAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionManagePrivateChannelMembers.Id,
			)
			roles[model.ChannelAdminRoleId].Permissions = append(
				roles[model.ChannelAdminRoleId].Permissions,
				model.PermissionManagePrivateChannelMembers.Id,
			)
		case model.PermissionsTeamAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionManagePrivateChannelMembers.Id,
			)
		}
	} else {
		roles[model.ChannelUserRoleId].Permissions = append(
			roles[model.ChannelUserRoleId].Permissions,
			model.PermissionManagePrivateChannelMembers.Id,
		)
	}

	if !*cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_EnableOnlyAdminIntegrations {
		roles[model.TeamUserRoleId].Permissions = append(
			roles[model.TeamUserRoleId].Permissions,
			model.PermissionManageIncomingWebhooks.Id,
			model.PermissionManageOutgoingWebhooks.Id,
			model.PermissionManageSlashCommands.Id,
		)
		roles[model.SystemUserRoleId].Permissions = append(
			roles[model.SystemUserRoleId].Permissions,
			model.PermissionManageOAuth.Id,
		)
	}

	// Grant permissions for inviting and adding users to a team.
	if isLicensed {
		if *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictTeamInvite == model.PermissionsTeamAdmin {
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionInviteUser.Id,
				model.PermissionAddUserToTeam.Id,
			)
		} else if *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictTeamInvite == model.PermissionsAll {
			roles[model.TeamUserRoleId].Permissions = append(
				roles[model.TeamUserRoleId].Permissions,
				model.PermissionInviteUser.Id,
				model.PermissionAddUserToTeam.Id,
			)
		}
	} else {
		roles[model.TeamUserRoleId].Permissions = append(
			roles[model.TeamUserRoleId].Permissions,
			model.PermissionInviteUser.Id,
			model.PermissionAddUserToTeam.Id,
		)
	}

	if isLicensed {
		switch *cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_RestrictPostDelete {
		case model.PermissionsDeletePostAll:
			roles[model.ChannelUserRoleId].Permissions = append(
				roles[model.ChannelUserRoleId].Permissions,
				model.PermissionDeletePost.Id,
			)
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionDeletePost.Id,
				model.PermissionDeleteOthersPosts.Id,
			)
		case model.PermissionsDeletePostTeamAdmin:
			roles[model.TeamAdminRoleId].Permissions = append(
				roles[model.TeamAdminRoleId].Permissions,
				model.PermissionDeletePost.Id,
				model.PermissionDeleteOthersPosts.Id,
			)
		}
	} else {
		roles[model.ChannelUserRoleId].Permissions = append(
			roles[model.ChannelUserRoleId].Permissions,
			model.PermissionDeletePost.Id,
		)
		roles[model.TeamAdminRoleId].Permissions = append(
			roles[model.TeamAdminRoleId].Permissions,
			model.PermissionDeletePost.Id,
			model.PermissionDeleteOthersPosts.Id,
		)
	}

	if *cfg.TeamSettings.DEPRECATED_DO_NOT_USE_EnableTeamCreation {
		roles[model.SystemUserRoleId].Permissions = append(
			roles[model.SystemUserRoleId].Permissions,
			model.PermissionCreateTeam.Id,
		)
	}

	if isLicensed {
		switch *cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_AllowEditPost {
		case model.AllowEditPostAlways, model.AllowEditPostTimeLimit:
			roles[model.ChannelUserRoleId].Permissions = append(
				roles[model.ChannelUserRoleId].Permissions,
				model.PermissionEditPost.Id,
			)
			roles[model.SystemAdminRoleId].Permissions = append(
				roles[model.SystemAdminRoleId].Permissions,
				model.PermissionEditPost.Id,
			)
		}
	} else {
		roles[model.ChannelUserRoleId].Permissions = append(
			roles[model.ChannelUserRoleId].Permissions,
			model.PermissionEditPost.Id,
		)
		roles[model.SystemAdminRoleId].Permissions = append(
			roles[model.SystemAdminRoleId].Permissions,
			model.PermissionEditPost.Id,
		)
	}

	return roles
}
