// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (a *App) SessionHasPermissionToChannel(c request.CTX, session model.Session, channelID string, permission *model.Permission) bool {
	if channelID == "" {
		return false
	}

	ids, err := a.Srv().Store().Channel().GetAllChannelMembersForUser(session.UserId, true, true)

	var channelRoles []string
	if err == nil {
		if roles, ok := ids[channelID]; ok {
			channelRoles = strings.Fields(roles)
			if a.RolesGrantPermission(channelRoles, permission.Id) {
				return true
			}
		}
	}

	channel, appErr := a.GetChannel(c, channelID)
	if appErr != nil && appErr.StatusCode == http.StatusNotFound {
		return false
	}

	if session.IsUnrestricted() {
		return true
	}

	if appErr == nil && channel.TeamId != "" {
		return a.SessionHasPermissionToTeam(session, channel.TeamId, permission)
	}

	return a.SessionHasPermissionTo(session, permission)
}

// SessionHasPermissionToChannels returns true only if user has access to all channels.
func (a *App) SessionHasPermissionToChannels(c request.CTX, session model.Session, channelIDs []string, permission *model.Permission) bool {
	if len(channelIDs) == 0 {
		return true
	}

	for _, channelID := range channelIDs {
		if channelID == "" {
			return false
		}
	}

	if session.IsUnrestricted() {
		return true
	}

	ids, err := a.Srv().Store().Channel().GetAllChannelMembersForUser(session.UserId, true, true)

	var channelRoles []string
	uniqueRoles := make(map[string]bool)
	if err == nil {
		for _, channelID := range channelIDs {
			if roles, ok := ids[channelID]; ok {
				for _, role := range strings.Fields(roles) {
					uniqueRoles[role] = true
				}
			}
		}
	}

	for role := range uniqueRoles {
		channelRoles = append(channelRoles, role)
	}

	if a.RolesGrantPermission(channelRoles, permission.Id) {
		return true
	}

	channels, appErr := a.GetChannels(c, channelIDs)
	if appErr != nil && appErr.StatusCode == http.StatusNotFound {
		return false
	}

	// Get TeamIDs from channels
	uniqueTeamIDs := make(map[string]bool)
	for _, ch := range channels {
		if ch.TeamId != "" {
			uniqueTeamIDs[ch.TeamId] = true
		}
	}

	var teamIDs []string
	for teamID := range uniqueTeamIDs {
		teamIDs = append(teamIDs, teamID)
	}

	if appErr == nil && len(teamIDs) > 0 {
		return a.SessionHasPermissionToTeams(c, session, teamIDs, permission)
	}

	return a.SessionHasPermissionTo(session, permission)
}

func (a *App) SessionHasPermissionToGroup(session model.Session, groupID string, permission *model.Permission) bool {
	groupMember, err := a.Srv().Store().Group().GetMember(groupID, session.UserId)
	// don't reject immediately on ErrNoRows error because there's further authz logic below for non-groupmembers
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false
	}

	// each member of a group is implicitly considered to have the 'custom_group_user' role in that group, so if the user is a member of the
	// group and custom_group_user on their system has the requested permission then return true
	if groupMember != nil && a.RolesGrantPermission([]string{model.CustomGroupUserRoleId}, permission.Id) {
		return true
	}

	// Not implemented: group-override schemes.

	// ...otherwise check their system roles to see if they have the requested permission system-wide
	return a.SessionHasPermissionTo(session, permission)
}

func (a *App) SessionHasPermissionToChannelByPost(session model.Session, postID string, permission *model.Permission) bool {
	if channelMember, err := a.Srv().Store().Channel().GetMemberForPost(postID, session.UserId); err == nil {

		if a.RolesGrantPermission(channelMember.GetRoles(), permission.Id) {
			return true
		}
	}

	if channel, err := a.Srv().Store().Channel().GetForPost(postID); err == nil {
		if channel.TeamId != "" {
			return a.SessionHasPermissionToTeam(session, channel.TeamId, permission)
		}
	}

	return a.SessionHasPermissionTo(session, permission)
}

func (a *App) SessionHasPermissionToCategory(c request.CTX, session model.Session, userID, teamID, categoryId string) bool {
	if a.SessionHasPermissionTo(session, model.PermissionEditOtherUsers) {
		return true
	}
	category, err := a.GetSidebarCategory(c, categoryId)
	return err == nil && category != nil && category.UserId == session.UserId && category.UserId == userID && category.TeamId == teamID
}

func (a *App) HasPermissionToChannel(c request.CTX, askingUserId string, channelID string, permission *model.Permission) bool {
	if channelID == "" || askingUserId == "" {
		return false
	}

	channelMember, err := a.GetChannelMember(c, channelID, askingUserId)
	if err == nil {
		roles := channelMember.GetRoles()
		if a.RolesGrantPermission(roles, permission.Id) {
			return true
		}
	}

	var channel *model.Channel
	channel, err = a.GetChannel(c, channelID)
	if err == nil {
		return a.HasPermissionToTeam(askingUserId, channel.TeamId, permission)
	}

	return a.HasPermissionTo(askingUserId, permission)
}

func (a *App) HasPermissionToChannelByPost(askingUserId string, postID string, permission *model.Permission) bool {
	if channelMember, err := a.Srv().Store().Channel().GetMemberForPost(postID, askingUserId); err == nil {
		if a.RolesGrantPermission(channelMember.GetRoles(), permission.Id) {
			return true
		}
	}

	if channel, err := a.Srv().Store().Channel().GetForPost(postID); err == nil {
		return a.HasPermissionToTeam(askingUserId, channel.TeamId, permission)
	}

	return a.HasPermissionTo(askingUserId, permission)
}

func (a *App) HasPermissionToUser(askingUserId string, userID string) bool {
	if askingUserId == userID {
		return true
	}

	if a.HasPermissionTo(askingUserId, model.PermissionEditOtherUsers) {
		return true
	}

	return false
}

func (a *App) HasPermissionToReadChannel(c request.CTX, userID string, channel *model.Channel) bool {
	return a.HasPermissionToChannel(c, userID, channel.Id, model.PermissionReadChannel) || (channel.Type == model.ChannelTypeOpen && a.HasPermissionToTeam(userID, channel.TeamId, model.PermissionReadPublicChannel))
}
