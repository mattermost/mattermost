// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) SessionHasPermissionTo(session model.Session, permission *model.Permission) bool {
	if session.IsUnrestricted() {
		return true
	}
	return a.RolesGrantPermission(session.GetUserRoles(), permission.Id)
}

// SessionHasPermissionToAndNotRestrictedAdmin is a variant of [App.SessionHasPermissionTo] that
// denies access to restricted system admins. Note that a local session is always unrestricted.
func (a *App) SessionHasPermissionToAndNotRestrictedAdmin(session model.Session, permission *model.Permission) bool {
	if session.IsUnrestricted() {
		return true
	}

	if *a.Config().ExperimentalSettings.RestrictSystemAdmin {
		return false
	}

	return a.RolesGrantPermission(session.GetUserRoles(), permission.Id)
}

func (a *App) SessionHasPermissionToAny(session model.Session, permissions []*model.Permission) bool {
	for _, perm := range permissions {
		if a.SessionHasPermissionTo(session, perm) {
			return true
		}
	}
	return false
}

func (a *App) SessionHasPermissionToTeam(session model.Session, teamID string, permission *model.Permission) bool {
	if teamID == "" {
		return false
	}
	if session.IsUnrestricted() {
		return true
	}

	teamMember := session.GetTeamByTeamId(teamID)
	if teamMember != nil {
		if a.RolesGrantPermission(teamMember.GetRoles(), permission.Id) {
			return true
		}
	}

	return a.RolesGrantPermission(session.GetUserRoles(), permission.Id)
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

	// Check session permission, if it allows access, no need to check teams.
	if a.SessionHasPermissionTo(session, permission) {
		return true
	}
	for _, teamID := range teamIDs {
		tm := session.GetTeamByTeamId(teamID)
		if tm != nil {
			// If a team member has permission, then no need to check further.
			if a.RolesGrantPermission(tm.GetRoles(), permission.Id) {
				continue
			}
		}
		return false
	}
	return true
}

func (a *App) SessionHasPermissionToChannel(c request.CTX, session model.Session, channelID string, permission *model.Permission) bool {
	if channelID == "" {
		return false
	}

	channel, appErr := a.GetChannel(c, channelID)
	if appErr != nil && appErr.StatusCode == http.StatusNotFound {
		return false
	} else if appErr != nil {
		c.Logger().Warn("Failed to get channel", mlog.String("channel_id", channelID), mlog.Err(appErr))
	}

	if session.IsUnrestricted() || a.RolesGrantPermission(session.GetUserRoles(), model.PermissionManageSystem.Id) {
		return true
	}

	if appErr == nil && a.isChannelArchivedAndHidden(channel) {
		return false
	}

	ids, err := a.Srv().Store().Channel().GetAllChannelMembersForUser(c, session.UserId, true, true)
	var channelRoles []string
	if err == nil {
		if roles, ok := ids[channelID]; ok {
			channelRoles = strings.Fields(roles)
			if a.RolesGrantPermission(channelRoles, permission.Id) {
				return true
			}
		}
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

	if session.IsUnrestricted() || a.RolesGrantPermission(session.GetUserRoles(), model.PermissionManageSystem.Id) {
		return true
	}

	for _, channelID := range channelIDs {
		if channelID == "" {
			return false
		}

		// make sure all channels exist, otherwise return false.
		for _, channelID := range channelIDs {
			channel, appErr := a.GetChannel(c, channelID)
			if appErr != nil {
				return false
			}

			// if any channel is archived and the user doesn't have permission to view archived channels, return false
			if a.isChannelArchivedAndHidden(channel) {
				return false
			}
		}
	}

	// if System Roles (i.e. Admin, TeamAdmin) allow permissions
	// if so, no reason to check team
	if a.SessionHasPermissionTo(session, permission) {
		return true
	}

	ids, err := a.Srv().Store().Channel().GetAllChannelMembersForUser(c, session.UserId, true, true)
	var channelRoles []string
	for _, channelID := range channelIDs {
		if err == nil {
			// If a channel member has permission, then no need to check further.
			if roles, ok := ids[channelID]; ok {
				channelRoles = strings.Fields(roles)
				if a.RolesGrantPermission(channelRoles, permission.Id) {
					continue
				}
			}
		}
		return false
	}

	return true
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
	if postID == "" {
		return false
	}

	if channelMember, err := a.Srv().Store().Channel().GetMemberForPost(postID, session.UserId, *a.Config().TeamSettings.ExperimentalViewArchivedChannels); err == nil {
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

func (a *App) SessionHasPermissionToUser(session model.Session, userID string) bool {
	if userID == "" {
		return false
	}
	if session.IsUnrestricted() || a.SessionHasPermissionTo(session, model.PermissionManageSystem) {
		return true
	}

	if session.UserId == userID {
		return true
	}

	if !a.SessionHasPermissionTo(session, model.PermissionEditOtherUsers) {
		return false
	}

	user, err := a.GetUser(userID)
	if err != nil {
		return false
	}

	if user.IsSystemAdmin() {
		return false
	}

	return true
}

func (a *App) SessionHasPermissionToUserOrBot(rctx request.CTX, session model.Session, userID string) bool {
	if session.IsUnrestricted() {
		return true
	}

	err := a.SessionHasPermissionToManageBot(rctx, session, userID)
	if err == nil {
		return true
	}
	if err.Id == "store.sql_bot.get.missing.app_error" && err.Where == "SqlBotStore.Get" {
		if a.SessionHasPermissionToUser(session, userID) {
			return true
		}
	}
	return false
}

func (a *App) HasPermissionTo(askingUserId string, permission *model.Permission) bool {
	user, err := a.GetUser(askingUserId)
	if err != nil {
		return false
	}

	roles := user.GetRoles()

	return a.RolesGrantPermission(roles, permission.Id)
}

func (a *App) HasPermissionToTeam(c request.CTX, askingUserId string, teamID string, permission *model.Permission) bool {
	if teamID == "" || askingUserId == "" {
		return false
	}
	teamMember, _ := a.GetTeamMember(c, teamID, askingUserId)
	if teamMember != nil && teamMember.DeleteAt == 0 {
		if a.RolesGrantPermission(teamMember.GetRoles(), permission.Id) {
			return true
		}
	}
	return a.HasPermissionTo(askingUserId, permission)
}

func (a *App) HasPermissionToChannel(c request.CTX, askingUserId string, channelID string, permission *model.Permission) bool {
	if channelID == "" || askingUserId == "" {
		return false
	}

	// We call GetAllChannelMembersForUser instead of just getting
	// a single member from the DB, because it's cache backed
	// and this is a very frequent call.
	ids, err := a.Srv().Store().Channel().GetAllChannelMembersForUser(c, askingUserId, true, true)
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
	if appErr == nil && channel.TeamId != "" {
		return a.HasPermissionToTeam(c, askingUserId, channel.TeamId, permission)
	}

	return a.HasPermissionTo(askingUserId, permission)
}

func (a *App) HasPermissionToChannelByPost(c request.CTX, askingUserId string, postID string, permission *model.Permission) bool {
	if channelMember, err := a.Srv().Store().Channel().GetMemberForPost(postID, askingUserId, *a.Config().TeamSettings.ExperimentalViewArchivedChannels); err == nil {
		if a.RolesGrantPermission(channelMember.GetRoles(), permission.Id) {
			return true
		}
	}

	if channel, err := a.Srv().Store().Channel().GetForPost(postID); err == nil {
		return a.HasPermissionToTeam(c, askingUserId, channel.TeamId, permission)
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

func (a *App) RolesGrantPermission(roleNames []string, permissionId string) bool {
	roles, err := a.GetRolesByNames(roleNames)
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
func (a *App) SessionHasPermissionToManageBot(rctx request.CTX, session model.Session, botUserId string) *model.AppError {
	existingBot, err := a.GetBot(rctx, botUserId, true)
	if err != nil {
		return err
	}
	if session.IsUnrestricted() {
		return nil
	}

	if existingBot.OwnerId == session.UserId {
		if !a.SessionHasPermissionTo(session, model.PermissionManageBots) {
			if !a.SessionHasPermissionTo(session, model.PermissionReadBots) {
				// If the user doesn't have permission to read bots, pretend as if
				// the bot doesn't exist at all.
				return model.MakeBotNotFoundError("permissions", botUserId)
			}
			return model.MakePermissionError(&session, []*model.Permission{model.PermissionManageBots})
		}
	} else {
		if !a.SessionHasPermissionTo(session, model.PermissionManageOthersBots) {
			if !a.SessionHasPermissionTo(session, model.PermissionReadOthersBots) {
				// If the user doesn't have permission to read others' bots,
				// pretend as if the bot doesn't exist at all.
				return model.MakeBotNotFoundError("permissions", botUserId)
			}
			return model.MakePermissionError(&session, []*model.Permission{model.PermissionManageOthersBots})
		}
	}

	return nil
}

func (a *App) SessionHasPermissionToReadChannel(c request.CTX, session model.Session, channel *model.Channel) bool {
	if session.IsUnrestricted() {
		return true
	}

	return a.HasPermissionToReadChannel(c, session.UserId, channel)
}

func (a *App) HasPermissionToReadChannel(c request.CTX, userID string, channel *model.Channel) bool {
	if a.isChannelArchivedAndHidden(channel) {
		return false
	}
	if a.HasPermissionToChannel(c, userID, channel.Id, model.PermissionReadChannelContent) {
		return true
	}

	if channel.Type == model.ChannelTypeOpen && !*a.Config().ComplianceSettings.Enable {
		return a.HasPermissionToTeam(c, userID, channel.TeamId, model.PermissionReadPublicChannel)
	}

	return false
}

func (a *App) HasPermissionToChannelMemberCount(c request.CTX, userID string, channel *model.Channel) bool {
	if a.isChannelArchivedAndHidden(channel) {
		return false
	}
	if a.HasPermissionToChannel(c, userID, channel.Id, model.PermissionReadChannelContent) {
		return true
	}

	if channel.Type == model.ChannelTypeOpen {
		return a.HasPermissionToTeam(c, userID, channel.TeamId, model.PermissionListTeamChannels)
	}

	return false
}

func (a *App) isChannelArchivedAndHidden(channel *model.Channel) bool {
	return !*a.Config().TeamSettings.ExperimentalViewArchivedChannels && channel.DeleteAt != 0
}
