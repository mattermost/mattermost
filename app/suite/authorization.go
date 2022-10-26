// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (s *SuiteService) MakePermissionError(session *model.Session, permissions []*model.Permission) *model.AppError {
	permissionsStr := "permission="
	for _, permission := range permissions {
		permissionsStr += permission.Id
		permissionsStr += ","
	}
	return model.NewAppError("Permissions", "api.context.permissions.app_error", nil, "userId="+session.UserId+", "+permissionsStr, http.StatusForbidden)
}

func (s *SuiteService) SessionHasPermissionTo(session model.Session, permission *model.Permission) bool {
	if session.IsUnrestricted() {
		return true
	}
	return s.RolesGrantPermission(session.GetUserRoles(), permission.Id)
}

func (s *SuiteService) SessionHasPermissionToAny(session model.Session, permissions []*model.Permission) bool {
	for _, perm := range permissions {
		if s.SessionHasPermissionTo(session, perm) {
			return true
		}
	}
	return false
}

func (s *SuiteService) SessionHasPermissionToTeam(session model.Session, teamID string, permission *model.Permission) bool {
	if teamID == "" {
		return false
	}
	if session.IsUnrestricted() {
		return true
	}

	teamMember := session.GetTeamByTeamId(teamID)
	if teamMember != nil {
		if s.RolesGrantPermission(teamMember.GetRoles(), permission.Id) {
			return true
		}
	}

	return s.RolesGrantPermission(session.GetUserRoles(), permission.Id)
}

// SessionHasPermissionToTeams returns true only if user has access to all teams.
func (s *SuiteService) SessionHasPermissionToTeams(c request.CTX, session model.Session, teamIDs []string, permission *model.Permission) bool {
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

	if s.RolesGrantPermission(roles, permission.Id) {
		return true
	}

	return s.RolesGrantPermission(session.GetUserRoles(), permission.Id)
}

func (s *SuiteService) SessionHasPermissionToGroup(session model.Session, groupID string, permission *model.Permission) bool {
	groupMember, err := s.platform.Store.Group().GetMember(groupID, session.UserId)
	// don't reject immediately on ErrNoRows error because there's further authz logic below for non-groupmembers
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false
	}

	// each member of a group is implicitly considered to have the 'custom_group_user' role in that group, so if the user is a member of the
	// group and custom_group_user on their system has the requested permission then return true
	if groupMember != nil && s.RolesGrantPermission([]string{model.CustomGroupUserRoleId}, permission.Id) {
		return true
	}

	// Not implemented: group-override schemes.

	// ...otherwise check their system roles to see if they have the requested permission system-wide
	return s.SessionHasPermissionTo(session, permission)
}

func (s *SuiteService) SessionHasPermissionToUser(session model.Session, userID string) bool {
	if userID == "" {
		return false
	}
	if session.IsUnrestricted() {
		return true
	}

	if session.UserId == userID {
		return true
	}

	if s.SessionHasPermissionTo(session, model.PermissionEditOtherUsers) {
		return true
	}

	return false
}

func (s *SuiteService) SessionHasPermissionToUserOrBot(session model.Session, userID string) bool {
	if session.IsUnrestricted() {
		return true
	}
	if s.SessionHasPermissionToUser(session, userID) {
		return true
	}

	if err := s.SessionHasPermissionToManageBot(session, userID); err == nil {
		return true
	}

	return false
}

func (s *SuiteService) HasPermissionTo(askingUserId string, permission *model.Permission) bool {
	user, err := s.GetUser(askingUserId)
	if err != nil {
		return false
	}

	roles := user.GetRoles()

	return s.RolesGrantPermission(roles, permission.Id)
}

func (s *SuiteService) HasPermissionToTeam(askingUserId string, teamID string, permission *model.Permission) bool {
	if teamID == "" || askingUserId == "" {
		return false
	}
	teamMember, _ := s.GetTeamMember(teamID, askingUserId)
	if teamMember != nil && teamMember.DeleteAt == 0 {
		if s.RolesGrantPermission(teamMember.GetRoles(), permission.Id) {
			return true
		}
	}
	return s.HasPermissionTo(askingUserId, permission)
}

func (s *SuiteService) HasPermissionToUser(askingUserId string, userID string) bool {
	if askingUserId == userID {
		return true
	}

	if s.HasPermissionTo(askingUserId, model.PermissionEditOtherUsers) {
		return true
	}

	return false
}

func (s *SuiteService) RolesGrantPermission(roleNames []string, permissionId string) bool {
	roles, err := s.GetRolesByNames(roleNames)
	if err != nil {
		// This should only happen if something is very broken. We can't realistically
		// recover the situation, so deny permission and log an error.
		mlog.Error("Failed to get roles from database with role names: "+strings.Join(roleNames, ",")+" ", mlog.Err(err))
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
func (s *SuiteService) SessionHasPermissionToManageBot(session model.Session, botUserId string) *model.AppError {
	existingBot, err := s.GetBot(botUserId, true)
	if err != nil {
		return err
	}
	if session.IsUnrestricted() {
		return nil
	}

	if existingBot.OwnerId == session.UserId {
		if !s.SessionHasPermissionTo(session, model.PermissionManageBots) {
			if !s.SessionHasPermissionTo(session, model.PermissionReadBots) {
				// If the user doesn't have permission to read bots, pretend as if
				// the bot doesn't exist at all.
				return model.MakeBotNotFoundError(botUserId)
			}
			return s.MakePermissionError(&session, []*model.Permission{model.PermissionManageBots})
		}
	} else {
		if !s.SessionHasPermissionTo(session, model.PermissionManageOthersBots) {
			if !s.SessionHasPermissionTo(session, model.PermissionReadOthersBots) {
				// If the user doesn't have permission to read others' bots,
				// pretend as if the bot doesn't exist at all.
				return model.MakeBotNotFoundError(botUserId)
			}
			return s.MakePermissionError(&session, []*model.Permission{model.PermissionManageOthersBots})
		}
	}

	return nil
}
