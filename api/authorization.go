// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
)

func HasPermissionToContext(c *Context, permission *model.Permission) bool {
	userRoles := c.Session.GetUserRoles()
	if !CheckIfRolesGrantPermission(userRoles, permission.Id) {
		c.Err = model.NewLocAppError("HasPermissionToContext", "api.context.permissions.app_error", nil, "userId="+c.Session.UserId+", teamId="+c.TeamId+" permission="+permission.Id+" "+model.RoleIdsToString(userRoles))
		c.Err.StatusCode = http.StatusForbidden
		return false
	}

	return true
}

func HasPermissionTo(user *model.User, permission *model.Permission) bool {
	roles := user.GetRoles()

	return CheckIfRolesGrantPermission(roles, permission.Id)
}

func HasPermissionToCurrentTeamContext(c *Context, permission *model.Permission) bool {
	return HasPermissionToTeamContext(c, c.TeamId, permission)
}

func HasPermissionToTeamContext(c *Context, teamId string, permission *model.Permission) bool {
	teamMember := c.Session.GetTeamByTeamId(teamId)
	if teamMember != nil {
		roles := teamMember.GetRoles()

		if CheckIfRolesGrantPermission(roles, permission.Id) {
			return true
		}
	}

	if HasPermissionToContext(c, permission) {
		return true
	}

	c.Err = model.NewLocAppError("HasPermissionToTeamContext", "api.context.permissions.app_error", nil, "userId="+c.Session.UserId+", teamId="+c.TeamId+" permission="+permission.Id)
	c.Err.StatusCode = http.StatusForbidden
	return false
}

func HasPermissionToTeam(user *model.User, teamMember *model.TeamMember, permission *model.Permission) bool {
	if teamMember == nil {
		return false
	}

	roles := teamMember.GetRoles()

	if CheckIfRolesGrantPermission(roles, permission.Id) {
		return true
	}

	return HasPermissionTo(user, permission)
}

func HasPermissionToChannelContext(c *Context, channelId string, permission *model.Permission) bool {
	cmc := Srv.Store.Channel().GetMember(channelId, c.Session.UserId)

	var channelRoles []string
	if cmcresult := <-cmc; cmcresult.Err == nil {
		channelMember := cmcresult.Data.(model.ChannelMember)
		channelRoles = channelMember.GetRoles()

		if CheckIfRolesGrantPermission(channelRoles, permission.Id) {
			return true
		}
	}

	cc := Srv.Store.Channel().Get(channelId)
	if ccresult := <-cc; ccresult.Err == nil {
		channel := ccresult.Data.(*model.Channel)

		if teamMember := c.Session.GetTeamByTeamId(channel.TeamId); teamMember != nil {
			roles := teamMember.GetRoles()

			if CheckIfRolesGrantPermission(roles, permission.Id) {
				return true
			}
		}

	}

	if HasPermissionToContext(c, permission) {
		return true
	}

	c.Err = model.NewLocAppError("HasPermissionToChannelContext", "api.context.permissions.app_error", nil, "userId="+c.Session.UserId+", "+"permission="+permission.Id+" channelRoles="+model.RoleIdsToString(channelRoles))
	c.Err.StatusCode = http.StatusForbidden
	return false
}

func HasPermissionToChannel(user *model.User, teamMember *model.TeamMember, channelMember *model.ChannelMember, permission *model.Permission) bool {
	if channelMember == nil {
		return false
	}

	roles := channelMember.GetRoles()

	if CheckIfRolesGrantPermission(roles, permission.Id) {
		return true
	}

	return HasPermissionToTeam(user, teamMember, permission)
}

func HasPermissionToUser(c *Context, userId string) bool {
	// You are the user (users autmaticly have permissions to themselves)
	if c.Session.UserId == userId {
		return true
	}

	// You have permission
	if HasPermissionToContext(c, model.PERMISSION_EDIT_OTHER_USERS) {
		return true
	}

	c.Err = model.NewLocAppError("HasPermissionToUser", "api.context.permissions.app_error", nil, "userId="+userId)
	c.Err.StatusCode = http.StatusForbidden
	return false
}

func CheckIfRolesGrantPermission(roles []string, permissionId string) bool {
	for _, roleId := range roles {
		if role, ok := model.BuiltInRoles[roleId]; !ok {
			l4g.Debug("Bad role in system " + roleId)
			return false
		} else {
			permissions := role.Permissions
			for _, permission := range permissions {
				if permission == permissionId {
					return true
				}
			}
		}
	}

	return false
}
