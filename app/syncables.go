// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

// createDefaultChannelMemberships adds users to channels based on their group memberships and how those groups are
// configured to sync with channels for group members on or after the given timestamp. If a channelID is given
// only that channel's members are created. If channelID is nil all channel memberships are created.
func (a *App) createDefaultChannelMemberships(since int64, channelID *string) error {
	channelMembers, appErr := a.ChannelMembersToAdd(since, channelID)
	if appErr != nil {
		return appErr
	}

	for _, userChannel := range channelMembers {
		channel, err := a.GetChannel(userChannel.ChannelID)
		if err != nil {
			return err
		}

		tmem, err := a.GetTeamMember(channel.TeamId, userChannel.UserID)
		if err != nil && err.Id != "store.sql_team.get_member.missing.app_error" {
			return err
		}

		// First add user to team
		if tmem == nil {
			_, err = a.AddTeamMember(channel.TeamId, userChannel.UserID)
			if err != nil {
				return err
			}
			a.Log.Info("added teammember",
				mlog.String("user_id", userChannel.UserID),
				mlog.String("team_id", channel.TeamId),
			)
		}

		_, err = a.AddChannelMember(userChannel.UserID, channel, "", "")
		if err != nil {
			if err.Id == "api.channel.add_user.to.channel.failed.deleted.app_error" {
				a.Log.Info("Not adding user to channel because they have already left the team",
					mlog.String("user_id", userChannel.UserID),
					mlog.String("channel_id", userChannel.ChannelID),
				)
			} else {
				return err
			}
		}

		a.Log.Info("added channelmember",
			mlog.String("user_id", userChannel.UserID),
			mlog.String("channel_id", userChannel.ChannelID),
		)
	}

	return nil
}

// createDefaultTeamMemberships adds users to teams based on their group memberships and how those groups are
// configured to sync with teams for group members on or after the given timestamp. If a teamID is given
// only that team's members are created. If teamID is nil all team memberships are created.
func (a *App) createDefaultTeamMemberships(since int64, teamID *string) error {
	teamMembers, appErr := a.TeamMembersToAdd(since, teamID)
	if appErr != nil {
		return appErr
	}

	for _, userTeam := range teamMembers {
		_, err := a.AddTeamMember(userTeam.TeamID, userTeam.UserID)
		if err != nil {
			return err
		}

		a.Log.Info("added teammember",
			mlog.String("user_id", userTeam.UserID),
			mlog.String("team_id", userTeam.TeamID),
		)
	}

	return nil
}

// CreateDefaultMemberships adds users to teams and channels based on their group memberships and how those groups
// are configured to sync with teams and channels for group members on or after the given timestamp.
func (a *App) CreateDefaultMemberships(since int64) error {
	err := a.createDefaultTeamMemberships(since, nil)
	if err != nil {
		return err
	}

	err = a.createDefaultChannelMemberships(since, nil)
	if err != nil {
		return err
	}

	return nil
}

// DeleteGroupConstrainedMemberships deletes team and channel memberships of users who aren't members of the allowed
// groups of all group-constrained teams and channels.
func (a *App) DeleteGroupConstrainedMemberships() error {
	err := a.deleteGroupConstrainedChannelMemberships(nil)
	if err != nil {
		return err
	}

	err = a.deleteGroupConstrainedTeamMemberships(nil)
	if err != nil {
		return err
	}

	return nil
}

// deleteGroupConstrainedTeamMemberships deletes team memberships of users who aren't members of the allowed
// groups of the given group-constrained team. If a teamID is given then the procedure is scoped to the given team,
// if teamID is nil then the proceedure affects all teams.
func (a *App) deleteGroupConstrainedTeamMemberships(teamID *string) error {
	teamMembers, appErr := a.TeamMembersToRemove(teamID)
	if appErr != nil {
		return appErr
	}

	for _, userTeam := range teamMembers {
		err := a.RemoveUserFromTeam(userTeam.TeamId, userTeam.UserId, "")
		if err != nil {
			return err
		}

		a.Log.Info("removed teammember",
			mlog.String("user_id", userTeam.UserId),
			mlog.String("team_id", userTeam.TeamId),
		)
	}

	return nil
}

// deleteGroupConstrainedChannelMemberships deletes channel memberships of users who aren't members of the allowed
// groups of the given group-constrained channel. If a channelID is given then the procedure is scoped to the given team,
// if channelID is nil then the proceedure affects all teams.
func (a *App) deleteGroupConstrainedChannelMemberships(channelID *string) error {
	channelMembers, appErr := a.ChannelMembersToRemove(channelID)
	if appErr != nil {
		return appErr
	}

	for _, userChannel := range channelMembers {
		channel, err := a.GetChannel(userChannel.ChannelId)
		if err != nil {
			return err
		}

		err = a.RemoveUserFromChannel(userChannel.UserId, "", channel)
		if err != nil {
			return err
		}

		a.Log.Info("removed channelmember",
			mlog.String("user_id", userChannel.UserId),
			mlog.String("channel_id", channel.Id),
		)
	}

	return nil
}

// SyncSyncableRoles updates the SchemeAdmin field value of the given syncable's members based on the configuration of
// the member's group memberships and the configuration of those groups to the syncable. This method should only
// be invoked on group-synced (aka group-constrained) syncables.
func (a *App) SyncSyncableRoles(syncableID string, syncableType model.GroupSyncableType) *model.AppError {
	permittedAdmins, err := a.Srv.Store.Group().PermittedSyncableAdmins(syncableID, syncableType)
	if err != nil {
		return err
	}

	a.Log.Info(
		fmt.Sprintf("Permitted admins for %s", syncableType),
		mlog.String(strings.ToLower(fmt.Sprintf("%s_id", syncableType)), syncableID),
		mlog.Any("permitted_admins", permittedAdmins),
	)

	var updateFunc func(string, []string) *model.AppError

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		updateFunc = a.Srv.Store.Team().UpdateMembersRole
	case model.GroupSyncableTypeChannel:
		updateFunc = a.Srv.Store.Channel().UpdateMembersRole
	default:
		return model.NewAppError("App.SyncSyncableRoles", "groups.unsupported_syncable_type", map[string]interface{}{"Value": syncableType}, "", http.StatusInternalServerError)
	}

	err = updateFunc(syncableID, permittedAdmins)
	if err != nil {
		return err
	}

	return nil
}

// SyncRolesAndMembership updates the SchemeAdmin status and membership of all of the members of the given
// syncable.
func (a *App) SyncRolesAndMembership(syncableID string, syncableType model.GroupSyncableType) {
	a.SyncSyncableRoles(syncableID, syncableType)

	lastJob, _ := a.Srv.Store.Job().GetNewestJobByStatusAndType(model.JOB_STATUS_SUCCESS, model.JOB_TYPE_LDAP_SYNC)
	var since int64
	if lastJob != nil {
		since = lastJob.StartAt
	}

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		a.createDefaultTeamMemberships(since, &syncableID)
		a.deleteGroupConstrainedTeamMemberships(&syncableID)
		a.ClearTeamMembersCache(syncableID)
	case model.GroupSyncableTypeChannel:
		a.createDefaultChannelMemberships(since, &syncableID)
		a.deleteGroupConstrainedChannelMemberships(&syncableID)
		a.ClearChannelMembersCache(syncableID)
	}
}
