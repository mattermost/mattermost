// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"github.com/mattermost/platform/model"
)

func SetDefaultRolesBasedOnConfig() {
	// Reset the roles to default to make this logic easier
	model.InitalizeRoles()

	switch *Cfg.TeamSettings.RestrictPublicChannelCreation {
	case model.PERMISSIONS_ALL:
		model.ROLE_TEAM_USER.Permissions = append(
			model.ROLE_TEAM_USER.Permissions,
			model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
		)
		break
	case model.PERMISSIONS_TEAM_ADMIN:
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
		)
		break
	}

	switch *Cfg.TeamSettings.RestrictPublicChannelManagement {
	case model.PERMISSIONS_ALL:
		model.ROLE_TEAM_USER.Permissions = append(
			model.ROLE_TEAM_USER.Permissions,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
		)
		break
	case model.PERMISSIONS_CHANNEL_ADMIN:
		model.ROLE_CHANNEL_ADMIN.Permissions = append(
			model.ROLE_CHANNEL_ADMIN.Permissions,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
		)
		break
	case model.PERMISSIONS_TEAM_ADMIN:
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
		)
		break
	}

	switch *Cfg.TeamSettings.RestrictPublicChannelDeletion {
	case model.PERMISSIONS_ALL:
		model.ROLE_TEAM_USER.Permissions = append(
			model.ROLE_TEAM_USER.Permissions,
			model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
		)
		break
	case model.PERMISSIONS_CHANNEL_ADMIN:
		model.ROLE_CHANNEL_ADMIN.Permissions = append(
			model.ROLE_CHANNEL_ADMIN.Permissions,
			model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
		)
		break
	case model.PERMISSIONS_TEAM_ADMIN:
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
		)
		break
	}

	switch *Cfg.TeamSettings.RestrictPrivateChannelCreation {
	case model.PERMISSIONS_ALL:
		model.ROLE_TEAM_USER.Permissions = append(
			model.ROLE_TEAM_USER.Permissions,
			model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
		)
		break
	case model.PERMISSIONS_TEAM_ADMIN:
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
		)
		break
	}

	switch *Cfg.TeamSettings.RestrictPrivateChannelManagement {
	case model.PERMISSIONS_ALL:
		model.ROLE_TEAM_USER.Permissions = append(
			model.ROLE_TEAM_USER.Permissions,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
		)
		break
	case model.PERMISSIONS_CHANNEL_ADMIN:
		model.ROLE_CHANNEL_ADMIN.Permissions = append(
			model.ROLE_CHANNEL_ADMIN.Permissions,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
		)
		break
	case model.PERMISSIONS_TEAM_ADMIN:
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
		)
		break
	}

	switch *Cfg.TeamSettings.RestrictPrivateChannelDeletion {
	case model.PERMISSIONS_ALL:
		model.ROLE_TEAM_USER.Permissions = append(
			model.ROLE_TEAM_USER.Permissions,
			model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
		)
		break
	case model.PERMISSIONS_CHANNEL_ADMIN:
		model.ROLE_CHANNEL_ADMIN.Permissions = append(
			model.ROLE_CHANNEL_ADMIN.Permissions,
			model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
		)
		break
	case model.PERMISSIONS_TEAM_ADMIN:
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
		)
		break
	}

	if !*Cfg.ServiceSettings.EnableOnlyAdminIntegrations {
		model.ROLE_TEAM_USER.Permissions = append(
			model.ROLE_TEAM_USER.Permissions,
			model.PERMISSION_MANAGE_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
		)
		model.ROLE_SYSTEM_USER.Permissions = append(
			model.ROLE_SYSTEM_USER.Permissions,
			model.PERMISSION_MANAGE_OAUTH.Id,
		)
	}

	// If team admins are given permission
	if *Cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_TEAM_ADMIN {
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_INVITE_USER.Id,
		)
		// If it's not restricted to system admin or team admin, then give all users permission
	} else if *Cfg.TeamSettings.RestrictTeamInvite != model.PERMISSIONS_SYSTEM_ADMIN {
		model.ROLE_SYSTEM_USER.Permissions = append(
			model.ROLE_SYSTEM_USER.Permissions,
			model.PERMISSION_INVITE_USER.Id,
		)
	}

	switch *Cfg.ServiceSettings.RestrictPostDelete {
	case model.PERMISSIONS_DELETE_POST_ALL:
		model.ROLE_CHANNEL_USER.Permissions = append(
			model.ROLE_CHANNEL_USER.Permissions,
			model.PERMISSION_DELETE_POST.Id,
		)
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		)
		break
	case model.PERMISSIONS_DELETE_POST_TEAM_ADMIN:
		model.ROLE_TEAM_ADMIN.Permissions = append(
			model.ROLE_TEAM_ADMIN.Permissions,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		)
		break
	}

	if Cfg.TeamSettings.EnableTeamCreation {
		model.ROLE_SYSTEM_USER.Permissions = append(
			model.ROLE_SYSTEM_USER.Permissions,
			model.PERMISSION_CREATE_TEAM.Id,
		)
	}

}
