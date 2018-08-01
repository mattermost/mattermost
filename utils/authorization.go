// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"github.com/mattermost/mattermost-server/model"
)

func SetRolePermissionsFromConfig(roles map[string]*model.Role, cfg *model.Config, isLicensed bool) map[string]*model.Role {
	if isLicensed {
		switch *cfg.TeamSettings.RestrictPublicChannelCreation {
		case model.PERMISSIONS_ALL:
			roles[model.TEAM_USER_ROLE_ID].Permissions = append(
				roles[model.TEAM_USER_ROLE_ID].Permissions,
				model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
			)
		case model.PERMISSIONS_TEAM_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
			)
		}
	} else {
		roles[model.TEAM_USER_ROLE_ID].Permissions = append(
			roles[model.TEAM_USER_ROLE_ID].Permissions,
			model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.RestrictPublicChannelManagement {
		case model.PERMISSIONS_ALL:
			roles[model.TEAM_USER_ROLE_ID].Permissions = append(
				roles[model.TEAM_USER_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
			)
		case model.PERMISSIONS_CHANNEL_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
			)
			roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions = append(
				roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
			)
		case model.PERMISSIONS_TEAM_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
			)
		}
	} else {
		roles[model.TEAM_USER_ROLE_ID].Permissions = append(
			roles[model.TEAM_USER_ROLE_ID].Permissions,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.RestrictPublicChannelDeletion {
		case model.PERMISSIONS_ALL:
			roles[model.TEAM_USER_ROLE_ID].Permissions = append(
				roles[model.TEAM_USER_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
			)
		case model.PERMISSIONS_CHANNEL_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
			)
			roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions = append(
				roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
			)
		case model.PERMISSIONS_TEAM_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
			)
		}
	} else {
		roles[model.TEAM_USER_ROLE_ID].Permissions = append(
			roles[model.TEAM_USER_ROLE_ID].Permissions,
			model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.RestrictPrivateChannelCreation {
		case model.PERMISSIONS_ALL:
			roles[model.TEAM_USER_ROLE_ID].Permissions = append(
				roles[model.TEAM_USER_ROLE_ID].Permissions,
				model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
			)
		case model.PERMISSIONS_TEAM_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
			)
		}
	} else {
		roles[model.TEAM_USER_ROLE_ID].Permissions = append(
			roles[model.TEAM_USER_ROLE_ID].Permissions,
			model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.RestrictPrivateChannelManagement {
		case model.PERMISSIONS_ALL:
			roles[model.TEAM_USER_ROLE_ID].Permissions = append(
				roles[model.TEAM_USER_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
			)
		case model.PERMISSIONS_CHANNEL_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
			)
			roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions = append(
				roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
			)
		case model.PERMISSIONS_TEAM_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
			)
		}
	} else {
		roles[model.TEAM_USER_ROLE_ID].Permissions = append(
			roles[model.TEAM_USER_ROLE_ID].Permissions,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
		)
	}

	if isLicensed {
		switch *cfg.TeamSettings.RestrictPrivateChannelDeletion {
		case model.PERMISSIONS_ALL:
			roles[model.TEAM_USER_ROLE_ID].Permissions = append(
				roles[model.TEAM_USER_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
			)
		case model.PERMISSIONS_CHANNEL_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
			)
			roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions = append(
				roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
			)
		case model.PERMISSIONS_TEAM_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
			)
		}
	} else {
		roles[model.TEAM_USER_ROLE_ID].Permissions = append(
			roles[model.TEAM_USER_ROLE_ID].Permissions,
			model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
		)
	}

	// Restrict permissions for Private Channel Manage Members
	if isLicensed {
		switch *cfg.TeamSettings.RestrictPrivateChannelManageMembers {
		case model.PERMISSIONS_ALL:
			roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
				roles[model.CHANNEL_USER_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
			)
		case model.PERMISSIONS_CHANNEL_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
			)
			roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions = append(
				roles[model.CHANNEL_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
			)
		case model.PERMISSIONS_TEAM_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
			)
		}
	} else {
		roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
			roles[model.CHANNEL_USER_ROLE_ID].Permissions,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
		)
	}

	if !*cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		roles[model.TEAM_USER_ROLE_ID].Permissions = append(
			roles[model.TEAM_USER_ROLE_ID].Permissions,
			model.PERMISSION_MANAGE_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
		)
		roles[model.SYSTEM_USER_ROLE_ID].Permissions = append(
			roles[model.SYSTEM_USER_ROLE_ID].Permissions,
			model.PERMISSION_MANAGE_OAUTH.Id,
		)
	}

	// Grant permissions for inviting and adding users to a team.
	if isLicensed {
		if *cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_TEAM_ADMIN {
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_INVITE_USER.Id,
				model.PERMISSION_ADD_USER_TO_TEAM.Id,
			)
		} else if *cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_ALL {
			roles[model.TEAM_USER_ROLE_ID].Permissions = append(
				roles[model.TEAM_USER_ROLE_ID].Permissions,
				model.PERMISSION_INVITE_USER.Id,
				model.PERMISSION_ADD_USER_TO_TEAM.Id,
			)
		}
	} else {
		roles[model.TEAM_USER_ROLE_ID].Permissions = append(
			roles[model.TEAM_USER_ROLE_ID].Permissions,
			model.PERMISSION_INVITE_USER.Id,
			model.PERMISSION_ADD_USER_TO_TEAM.Id,
		)
	}

	if isLicensed {
		switch *cfg.ServiceSettings.RestrictPostDelete {
		case model.PERMISSIONS_DELETE_POST_ALL:
			roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
				roles[model.CHANNEL_USER_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_POST.Id,
			)
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_POST.Id,
				model.PERMISSION_DELETE_OTHERS_POSTS.Id,
			)
		case model.PERMISSIONS_DELETE_POST_TEAM_ADMIN:
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_DELETE_POST.Id,
				model.PERMISSION_DELETE_OTHERS_POSTS.Id,
			)
		}
	} else {
		roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
			roles[model.CHANNEL_USER_ROLE_ID].Permissions,
			model.PERMISSION_DELETE_POST.Id,
		)
		roles[model.TEAM_ADMIN_ROLE_ID].Permissions = append(
			roles[model.TEAM_ADMIN_ROLE_ID].Permissions,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		)
	}

	if *cfg.TeamSettings.EnableTeamCreation {
		roles[model.SYSTEM_USER_ROLE_ID].Permissions = append(
			roles[model.SYSTEM_USER_ROLE_ID].Permissions,
			model.PERMISSION_CREATE_TEAM.Id,
		)
	}

	if isLicensed {
		switch *cfg.ServiceSettings.AllowEditPost {
		case model.ALLOW_EDIT_POST_ALWAYS, model.ALLOW_EDIT_POST_TIME_LIMIT:
			roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
				roles[model.CHANNEL_USER_ROLE_ID].Permissions,
				model.PERMISSION_EDIT_POST.Id,
			)
			roles[model.SYSTEM_ADMIN_ROLE_ID].Permissions = append(
				roles[model.SYSTEM_ADMIN_ROLE_ID].Permissions,
				model.PERMISSION_EDIT_POST.Id,
			)
		}
	} else {
		roles[model.CHANNEL_USER_ROLE_ID].Permissions = append(
			roles[model.CHANNEL_USER_ROLE_ID].Permissions,
			model.PERMISSION_EDIT_POST.Id,
		)
		roles[model.SYSTEM_ADMIN_ROLE_ID].Permissions = append(
			roles[model.SYSTEM_ADMIN_ROLE_ID].Permissions,
			model.PERMISSION_EDIT_POST.Id,
		)
	}

	return roles
}
