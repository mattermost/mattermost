// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) SessionHasPermissionTo(session model.Session, permission *model.Permission) bool {
	if !a.CheckIfRolesGrantPermission(session.GetUserRoles(), permission.Id) {
		a.ClearSessionCacheForUser(session.UserId)
		return false
	}

	return true
}

/// DO NOT USE: LEGACY
func (a *App) SessionHasPermissionToTeam(session model.Session, teamId string, permission *model.Permission) bool {
	if teamId == "" {
		return false
	}

	teamMember := session.GetTeamByTeamId(teamId)
	if teamMember != nil {
		if a.CheckIfRolesGrantPermission(teamMember.GetRoles(), permission.Id) {
			return true
		}
	}

	return a.CheckIfRolesGrantPermission(session.GetUserRoles(), permission.Id)
}

func (a *App) SessionHasPermissionToChannel(session model.Session, channelId string, permission *model.Permission) bool {
	if channelId == "" {
		return false
	}

	cmc := a.Srv.Store.Channel().GetAllChannelMembersForUser(session.UserId, true)

	var channelRoles []string
	if cmcresult := <-cmc; cmcresult.Err == nil {
		ids := cmcresult.Data.(map[string]string)
		if roles, ok := ids[channelId]; ok {
			channelRoles = strings.Fields(roles)
			if a.CheckIfRolesGrantPermission(channelRoles, permission.Id) {
				return true
			}
		}
	}

	channel, err := a.GetChannel(channelId)
	if err == nil && channel.TeamId != "" {
		return a.SessionHasPermissionToTeam(session, channel.TeamId, permission)
	} else if err != nil && err.StatusCode == http.StatusNotFound {
		return false
	}

	return a.SessionHasPermissionTo(session, permission)
}

func (a *App) SessionHasPermissionToChannelByPost(session model.Session, postId string, permission *model.Permission) bool {
	var channelMember *model.ChannelMember
	if result := <-a.Srv.Store.Channel().GetMemberForPost(postId, session.UserId); result.Err == nil {
		channelMember = result.Data.(*model.ChannelMember)

		if a.CheckIfRolesGrantPermission(channelMember.GetRoles(), permission.Id) {
			return true
		}
	}

	if result := <-a.Srv.Store.Channel().GetForPost(postId); result.Err == nil {
		channel := result.Data.(*model.Channel)
		return a.SessionHasPermissionToTeam(session, channel.TeamId, permission)
	}

	return a.SessionHasPermissionTo(session, permission)
}

func (a *App) SessionHasPermissionToUser(session model.Session, userId string) bool {
	if userId == "" {
		return false
	}

	if session.UserId == userId {
		return true
	}

	if a.SessionHasPermissionTo(session, model.PERMISSION_EDIT_OTHER_USERS) {
		return true
	}

	return false
}

func (a *App) SessionHasPermissionToPost(session model.Session, postId string, permission *model.Permission) bool {
	post, err := a.GetSinglePost(postId)
	if err != nil {
		return false
	}

	if post.UserId == session.UserId {
		return true
	}

	return a.SessionHasPermissionToChannel(session, post.ChannelId, permission)
}

func (a *App) HasPermissionTo(askingUserId string, permission *model.Permission) bool {
	user, err := a.GetUser(askingUserId)
	if err != nil {
		return false
	}

	roles := user.GetRoles()

	return a.CheckIfRolesGrantPermission(roles, permission.Id)
}

func (a *App) HasPermissionToTeam(askingUserId string, teamId string, permission *model.Permission) bool {
	if teamId == "" || askingUserId == "" {
		return false
	}

	teamMember, err := a.GetTeamMember(teamId, askingUserId)
	if err != nil {
		return false
	}

	roles := teamMember.GetRoles()

	if a.CheckIfRolesGrantPermission(roles, permission.Id) {
		return true
	}

	return a.HasPermissionTo(askingUserId, permission)
}

func (a *App) HasPermissionToChannel(askingUserId string, channelId string, permission *model.Permission) bool {
	if channelId == "" || askingUserId == "" {
		return false
	}

	channelMember, err := a.GetChannelMember(channelId, askingUserId)
	if err == nil {
		roles := channelMember.GetRoles()
		if a.CheckIfRolesGrantPermission(roles, permission.Id) {
			return true
		}
	}

	var channel *model.Channel
	channel, err = a.GetChannel(channelId)
	if err == nil {
		return a.HasPermissionToTeam(askingUserId, channel.TeamId, permission)
	}

	return a.HasPermissionTo(askingUserId, permission)
}

func (a *App) HasPermissionToChannelByPost(askingUserId string, postId string, permission *model.Permission) bool {
	var channelMember *model.ChannelMember
	if result := <-a.Srv.Store.Channel().GetMemberForPost(postId, askingUserId); result.Err == nil {
		channelMember = result.Data.(*model.ChannelMember)

		if a.CheckIfRolesGrantPermission(channelMember.GetRoles(), permission.Id) {
			return true
		}
	}

	if result := <-a.Srv.Store.Channel().GetForPost(postId); result.Err == nil {
		channel := result.Data.(*model.Channel)
		return a.HasPermissionToTeam(askingUserId, channel.TeamId, permission)
	}

	return a.HasPermissionTo(askingUserId, permission)
}

func (a *App) HasPermissionToUser(askingUserId string, userId string) bool {
	if askingUserId == userId {
		return true
	}

	if a.HasPermissionTo(askingUserId, model.PERMISSION_EDIT_OTHER_USERS) {
		return true
	}

	return false
}

func (a *App) CheckIfRolesGrantPermission(roles []string, permissionId string) bool {
	for _, roleId := range roles {
		if role := a.Role(roleId); role == nil {
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
