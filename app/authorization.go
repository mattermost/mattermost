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
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (a *App) MakePermissionError(s *model.Session, permissions []*model.Permission) *model.AppError {
	permissionsStr := "permission="
	for _, permission := range permissions {
		permissionsStr += permission.Id
		permissionsStr += ","
	}
	return model.NewAppError("Permissions", "api.context.permissions.app_error", nil, "userId="+s.UserId+", "+permissionsStr, http.StatusForbidden)
}

func (a *App) SessionHasPermissionTo(c request.CTX, session model.Session, permission *model.Permission) bool {
	if session.IsUnrestricted() {
		return true
	}
	return a.RolesGrantPermission(c, session.GetUserRoles(), permission.Id)
}

func (a *App) SessionHasPermissionToAny(c request.CTX, session model.Session, permissions []*model.Permission) bool {
	for _, perm := range permissions {
		if a.SessionHasPermissionTo(c, session, perm) {
			return true
		}
	}
	return false
}

func (a *App) SessionHasPermissionToTeam(c request.CTX, session model.Session, teamID string, permission *model.Permission) bool {
	if teamID == "" {
		return false
	}
	if session.IsUnrestricted() {
		return true
	}

	teamMember := session.GetTeamByTeamId(teamID)
	if teamMember != nil {
		if a.RolesGrantPermission(c, teamMember.GetRoles(), permission.Id) {
			return true
		}
	}

	return a.RolesGrantPermission(c, session.GetUserRoles(), permission.Id)
}

// SessionHasPermissionToTeams returns true only if user has access to all teams.
func (a *App) SessionHasPermissionToTeams(c request.CTX, session model.Session, teamIDs []string, permission *model.Permission) bool {
	if len(teamIDs) == 0 {
		return true
	}

	for _, teamID := range teamIDs {
		if teamID == "" {
			return false
		}
	}
	if session.IsUnrestricted() {
		return true
	}

	// Getting the list of unique roles from all teams.
	var roles []string
	uniqueRoles := make(map[string]bool)
	for _, teamID := range teamIDs {
		tm := session.GetTeamByTeamId(teamID)
		if tm != nil {
			for _, role := range tm.GetRoles() {
				uniqueRoles[role] = true
			}
		}
	}

	for role := range uniqueRoles {
		roles = append(roles, role)
	}

	if a.RolesGrantPermission(c, roles, permission.Id) {
		return true
	}

	return a.RolesGrantPermission(c, session.GetUserRoles(), permission.Id)
}

func (a *App) SessionHasPermissionToChannel(c request.CTX, session model.Session, channelID string, permission *model.Permission) bool {
	if channelID == "" {
		return false
	}

	ids, err := a.Srv().Store().Channel().GetAllChannelMembersForUser(session.UserId, true, true)

	var channelRoles []string
	if err == nil {
		if roles, ok := ids[channelID]; ok {
			channelRoles = strings.Fields(roles)
			if a.RolesGrantPermission(c, channelRoles, permission.Id) {
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
		return a.SessionHasPermissionToTeam(c, session, channel.TeamId, permission)
	}

	return a.SessionHasPermissionTo(c, session, permission)
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

	if a.RolesGrantPermission(c, channelRoles, permission.Id) {
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

	return a.SessionHasPermissionTo(c, session, permission)
}

func (a *App) SessionHasPermissionToGroup(c request.CTX, session model.Session, groupID string, permission *model.Permission) bool {
	groupMember, err := a.Srv().Store().Group().GetMember(groupID, session.UserId)
	// don't reject immediately on ErrNoRows error because there's further authz logic below for non-groupmembers
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false
	}

	// each member of a group is implicitly considered to have the 'custom_group_user' role in that group, so if the user is a member of the
	// group and custom_group_user on their system has the requested permission then return true
	if groupMember != nil && a.RolesGrantPermission(c, []string{model.CustomGroupUserRoleId}, permission.Id) {
		return true
	}

	// Not implemented: group-override schemes.

	// ...otherwise check their system roles to see if they have the requested permission system-wide
	return a.SessionHasPermissionTo(c, session, permission)
}

func (a *App) SessionHasPermissionToChannelByPost(c request.CTX, session model.Session, postID string, permission *model.Permission) bool {
	if channelMember, err := a.Srv().Store().Channel().GetMemberForPost(postID, session.UserId); err == nil {

		if a.RolesGrantPermission(c, channelMember.GetRoles(), permission.Id) {
			return true
		}
	}

	if channel, err := a.Srv().Store().Channel().GetForPost(postID); err == nil {
		if channel.TeamId != "" {
			return a.SessionHasPermissionToTeam(c, session, channel.TeamId, permission)
		}
	}

	return a.SessionHasPermissionTo(c, session, permission)
}

func (a *App) SessionHasPermissionToCategory(c request.CTX, session model.Session, userID, teamID, categoryId string) bool {
	if a.SessionHasPermissionTo(c, session, model.PermissionEditOtherUsers) {
		return true
	}
	category, err := a.GetSidebarCategory(c, categoryId)
	return err == nil && category != nil && category.UserId == session.UserId && category.UserId == userID && category.TeamId == teamID
}

func (a *App) SessionHasPermissionToUser(c request.CTX, session model.Session, userID string) bool {
	if userID == "" {
		return false
	}
	if session.IsUnrestricted() {
		return true
	}

	if session.UserId == userID {
		return true
	}

	if a.SessionHasPermissionTo(c, session, model.PermissionEditOtherUsers) {
		return true
	}

	return false
}

func (a *App) SessionHasPermissionToUserOrBot(c request.CTX, session model.Session, userID string) bool {
	if session.IsUnrestricted() {
		return true
	}
	if a.SessionHasPermissionToUser(c, session, userID) {
		return true
	}

	if err := a.SessionHasPermissionToManageBot(c, session, userID); err == nil {
		return true
	}

	return false
}

func (a *App) HasPermissionTo(c request.CTX, askingUserId string, permission *model.Permission) bool {
	user, err := a.GetUser(askingUserId)
	if err != nil {
		return false
	}

	roles := user.GetRoles()

	return a.RolesGrantPermission(c, roles, permission.Id)
}

func (a *App) HasPermissionToTeam(c request.CTX, askingUserId string, teamID string, permission *model.Permission) bool {
	if teamID == "" || askingUserId == "" {
		return false
	}
	teamMember, _ := a.GetTeamMember(teamID, askingUserId)
	if teamMember != nil && teamMember.DeleteAt == 0 {
		if a.RolesGrantPermission(c, teamMember.GetRoles(), permission.Id) {
			return true
		}
	}
	return a.HasPermissionTo(c, askingUserId, permission)
}

func (a *App) HasPermissionToChannel(c request.CTX, askingUserId string, channelID string, permission *model.Permission) bool {
	if channelID == "" || askingUserId == "" {
		return false
	}

	channelMember, err := a.GetChannelMember(c, channelID, askingUserId)
	if err == nil {
		roles := channelMember.GetRoles()
		if a.RolesGrantPermission(c, roles, permission.Id) {
			return true
		}
	}

	var channel *model.Channel
	channel, err = a.GetChannel(c, channelID)
	if err == nil {
		return a.HasPermissionToTeam(c, askingUserId, channel.TeamId, permission)
	}

	return a.HasPermissionTo(c, askingUserId, permission)
}

func (a *App) HasPermissionToChannelByPost(c request.CTX, askingUserId string, postID string, permission *model.Permission) bool {
	if channelMember, err := a.Srv().Store().Channel().GetMemberForPost(postID, askingUserId); err == nil {
		if a.RolesGrantPermission(c, channelMember.GetRoles(), permission.Id) {
			return true
		}
	}

	if channel, err := a.Srv().Store().Channel().GetForPost(postID); err == nil {
		return a.HasPermissionToTeam(c, askingUserId, channel.TeamId, permission)
	}

	return a.HasPermissionTo(c, askingUserId, permission)
}

func (a *App) HasPermissionToUser(c request.CTX, askingUserId string, userID string) bool {
	if askingUserId == userID {
		return true
	}

	if a.HasPermissionTo(c, askingUserId, model.PermissionEditOtherUsers) {
		return true
	}

	return false
}

func (a *App) RolesGrantPermission(c request.CTX, roleNames []string, permissionId string) bool {
	roles, err := a.GetRolesByNames(roleNames)
	if err != nil {
		// This should only happen if something is very broken. We can't realistically
		// recover the situation, so deny permission and log an error.
		c.Logger().Error("Failed to get roles from database with role names: "+strings.Join(roleNames, ",")+" ", mlog.Err(err))
		return false
	}

	for _, role := range roles {
		if role.DeleteAt != 0 {
			continue
		}

		permissions := role.Permissions
		for _, permission := range permissions {
			if permission == permissionId {
				return true
			}
		}
	}

	return false
}

// SessionHasPermissionToManageBot returns nil if the session has access to manage the given bot.
// This function deviates from other authorization checks in returning an error instead of just
// a boolean, allowing the permission failure to be exposed with more granularity.
func (a *App) SessionHasPermissionToManageBot(c request.CTX, session model.Session, botUserId string) *model.AppError {
	existingBot, err := a.GetBot(botUserId, true)
	if err != nil {
		return err
	}
	if session.IsUnrestricted() {
		return nil
	}

	if existingBot.OwnerId == session.UserId {
		if !a.SessionHasPermissionTo(c, session, model.PermissionManageBots) {
			if !a.SessionHasPermissionTo(c, session, model.PermissionReadBots) {
				// If the user doesn't have permission to read bots, pretend as if
				// the bot doesn't exist at all.
				return model.MakeBotNotFoundError(botUserId)
			}
			return a.MakePermissionError(&session, []*model.Permission{model.PermissionManageBots})
		}
	} else {
		if !a.SessionHasPermissionTo(c, session, model.PermissionManageOthersBots) {
			if !a.SessionHasPermissionTo(c, session, model.PermissionReadOthersBots) {
				// If the user doesn't have permission to read others' bots,
				// pretend as if the bot doesn't exist at all.
				return model.MakeBotNotFoundError(botUserId)
			}
			return a.MakePermissionError(&session, []*model.Permission{model.PermissionManageOthersBots})
		}
	}

	return nil
}

func (a *App) HasPermissionToReadChannel(c request.CTX, userID string, channel *model.Channel) bool {
	return a.HasPermissionToChannel(c, userID, channel.Id, model.PermissionReadChannel) || (channel.Type == model.ChannelTypeOpen && a.HasPermissionToTeam(c, userID, channel.TeamId, model.PermissionReadPublicChannel))
}
