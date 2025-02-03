// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// createDefaultChannelMemberships adds users to channels based on their group memberships and how those groups are
// configured to sync with channels for group members on or after the given timestamp. If a channelID is given
// only that channel's members are created. If channelID is nil all channel memberships are created.
// If includeRemovedMembers is true, then channel members who left or were removed from the channel will
// be re-added; otherwise, they will not be re-added.
func (a *App) createDefaultChannelMemberships(rctx request.CTX, params model.CreateDefaultMembershipParams) error {
	channelMembers, appErr := a.ChannelMembersToAdd(params.Since, params.ScopedChannelID, params.ReAddRemovedMembers)
	if appErr != nil {
		return appErr
	}

	var multiErr *multierror.Error
	for _, userChannel := range channelMembers {
		if params.ScopedUserID != nil && *params.ScopedUserID != userChannel.UserID {
			continue
		}

		logger := rctx.Logger().With(
			mlog.String("user_id", userChannel.UserID),
			mlog.String("channel_id", userChannel.ChannelID),
		)

		channel, err := a.GetChannel(rctx, userChannel.ChannelID)
		if err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to get channel for default channel membership: %w", err))
			continue
		}

		tmem, err := a.GetTeamMember(rctx, channel.TeamId, userChannel.UserID)
		if err != nil && err.Id != "app.team.get_member.missing.app_error" {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to get member for default channel membership: %w", err))
			continue
		}

		// First add user to team
		if tmem == nil {
			_, err = a.AddTeamMember(rctx, channel.TeamId, userChannel.UserID)
			if err != nil {
				if err.Id == "api.team.join_user_to_team.allowed_domains.app_error" {
					logger.Info(
						"User not added to channel - the domain associated with the user is not in the list of allowed team domains",
						mlog.String("team_id", channel.TeamId),
					)
				} else {
					multiErr = multierror.Append(multiErr, fmt.Errorf("failed to add team member for default channel membership: %w", err))
				}
				continue
			}
			logger.Info("Added channel member for default channel membership")
		}

		_, err = a.AddChannelMember(rctx, userChannel.UserID, channel, ChannelMemberOpts{
			SkipTeamMemberIntegrityCheck: true,
		})
		if err != nil {
			if err.Id == "api.channel.add_user.to.channel.failed.deleted.app_error" {
				logger.Info("Not adding user to channel because they have already left the team")
			} else {
				multiErr = multierror.Append(multiErr, fmt.Errorf("failed to add channel member for default channel membership: %w", err))
			}
			continue
		}

		logger.Info("Added channel member for default channel membership")
	}

	return multiErr.ErrorOrNil()
}

// createDefaultTeamMemberships adds users to teams based on their group memberships and how those groups are
// configured to sync with teams for group members on or after the given timestamp. If a teamID is given
// only that team's members are created. If teamID is nil all team memberships are created.
// If includeRemovedMembers is true, then team members who left or were removed from the team will
// be re-added; otherwise, they will not be re-added.
func (a *App) createDefaultTeamMemberships(rctx request.CTX, params model.CreateDefaultMembershipParams) error {
	teamMembers, appErr := a.TeamMembersToAdd(params.Since, params.ScopedTeamID, params.ReAddRemovedMembers)
	if appErr != nil {
		return appErr
	}

	var multiErr *multierror.Error
	for _, userTeam := range teamMembers {
		if params.ScopedUserID != nil && *params.ScopedUserID != userTeam.UserID {
			continue
		}

		logger := rctx.Logger().With(
			mlog.String("user_id", userTeam.UserID),
			mlog.String("team_id", userTeam.TeamID),
		)

		_, err := a.AddTeamMember(rctx, userTeam.TeamID, userTeam.UserID)
		if err != nil {
			if err.Id == "api.team.join_user_to_team.allowed_domains.app_error" {
				logger.Info("User not added to team - the domain associated with the user is not in the list of allowed team domains")
			} else {
				multiErr = multierror.Append(multiErr, fmt.Errorf("failed to add team member for default team membership: %w", err))
			}
			continue
		}

		logger.Info("Added team member for default team membership")
	}

	return multiErr.ErrorOrNil()
}

// CreateDefaultMemberships adds users to teams and channels based on their group memberships and how those groups
// are configured to sync with teams and channels for group members on or after the given timestamp.
// If includeRemovedMembers is true, then members who left or were removed from a team/channel will
// be re-added; otherwise, they will not be re-added.
func (a *App) CreateDefaultMemberships(rctx request.CTX, params model.CreateDefaultMembershipParams) error {
	err := a.createDefaultTeamMemberships(rctx, params)
	if err != nil {
		return err
	}

	err = a.createDefaultChannelMemberships(rctx, params)
	if err != nil {
		return err
	}

	return nil
}

// DeleteGroupConstrainedMemberships deletes team and channel memberships of users who aren't members of the allowed
// groups of all group-constrained teams and channels.
func (a *App) DeleteGroupConstrainedMemberships(rctx request.CTX) error {
	err := a.deleteGroupConstrainedChannelMemberships(rctx, nil)
	if err != nil {
		return err
	}

	err = a.deleteGroupConstrainedTeamMemberships(rctx, nil)
	if err != nil {
		return err
	}

	return nil
}

// deleteGroupConstrainedTeamMemberships deletes team memberships of users who aren't members of the allowed
// groups of the given group-constrained team. If a teamID is given then the procedure is scoped to the given team,
// if teamID is nil then the procedure affects all teams.
func (a *App) deleteGroupConstrainedTeamMemberships(rctx request.CTX, teamID *string) error {
	teamMembers, appErr := a.TeamMembersToRemove(teamID)
	if appErr != nil {
		return appErr
	}

	var multiErr *multierror.Error
	for _, userTeam := range teamMembers {
		logger := rctx.Logger().With(
			mlog.String("user_id", userTeam.UserId),
			mlog.String("team_id", userTeam.TeamId),
		)

		err := a.RemoveUserFromTeam(rctx, userTeam.TeamId, userTeam.UserId, "")
		if err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to remove team member for default team membership: %w", err))
			continue
		}

		logger.Info("Removed team member for group constrained team membership")
	}

	return multiErr.ErrorOrNil()
}

// deleteGroupConstrainedChannelMemberships deletes channel memberships of users who aren't members of the allowed
// groups of the given group-constrained channel. If a channelID is given then the procedure is scoped to the given team,
// if channelID is nil then the procedure affects all teams.
func (a *App) deleteGroupConstrainedChannelMemberships(rctx request.CTX, channelID *string) error {
	channelMembers, appErr := a.ChannelMembersToRemove(channelID)
	if appErr != nil {
		return appErr
	}

	var multiErr *multierror.Error
	for _, userChannel := range channelMembers {
		logger := rctx.Logger().With(
			mlog.String("user_id", userChannel.UserId),
			mlog.String("channel_id", userChannel.ChannelId),
		)

		channel, err := a.GetChannel(rctx, userChannel.ChannelId)
		if err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to get channel for group constrained channel membership: %w", err))
			continue
		}

		err = a.RemoveUserFromChannel(rctx, userChannel.UserId, "", channel)
		if err != nil {
			multiErr = multierror.Append(multiErr, fmt.Errorf("failed to remove channel member for group constrained channel membership: %w", err))
			continue
		}

		logger.Info("Removed channel member for group constrained channel membership")
	}

	return multiErr.ErrorOrNil()
}

// SyncSyncableRoles updates the SchemeAdmin field value of the given syncable's members based on the configuration of
// the member's group memberships and the configuration of those groups to the syncable. This method should only
// be invoked on group-synced (aka group-constrained) syncables.
func (a *App) SyncSyncableRoles(rctx request.CTX, syncableID string, syncableType model.GroupSyncableType) *model.AppError {
	permittedAdmins, err := a.Srv().Store().Group().PermittedSyncableAdmins(syncableID, syncableType)
	if err != nil {
		return model.NewAppError("SyncSyncableRoles", "app.select_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info(
		fmt.Sprintf("Permitted admins for %s", syncableType),
		mlog.String(strings.ToLower(fmt.Sprintf("%s_id", syncableType)), syncableID),
		mlog.Array("permitted_admins", permittedAdmins),
	)

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		var updatedMembers []*model.TeamMember
		updatedMembers, err = a.Srv().Store().Team().UpdateMembersRole(syncableID, permittedAdmins)
		if err != nil {
			return model.NewAppError("App.SyncSyncableRoles", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, member := range updatedMembers {
			a.ClearSessionCacheForUser(member.UserId)

			if appErr := a.sendUpdatedTeamMemberEvent(member); appErr != nil {
				rctx.Logger().Warn("Error sending channel member updated websocket event", mlog.Err(appErr))
			}
		}
	case model.GroupSyncableTypeChannel:
		var updatedMembers []*model.ChannelMember
		updatedMembers, err = a.Srv().Store().Channel().UpdateMembersRole(syncableID, permittedAdmins)
		if err != nil {
			return model.NewAppError("App.SyncSyncableRoles", "app.update_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, member := range updatedMembers {
			a.ClearSessionCacheForUser(member.UserId)

			if appErr := a.sendUpdateChannelMemberEvent(member); appErr != nil {
				rctx.Logger().Warn("Error sending channel member updated websocket event", mlog.Err(appErr))
			}
		}
	default:
		return model.NewAppError("App.SyncSyncableRoles", "groups.unsupported_syncable_type", map[string]any{"Value": syncableType}, "", http.StatusInternalServerError)
	}

	return nil
}

// SyncRolesAndMembership updates the SchemeAdmin status and membership of all of the members of the given
// syncable.
func (a *App) SyncRolesAndMembership(rctx request.CTX, syncableID string, syncableType model.GroupSyncableType, includeRemovedMembers bool) {
	appErr := a.SyncSyncableRoles(rctx, syncableID, syncableType)
	if appErr != nil {
		rctx.Logger().Warn("Error syncing syncable roles", mlog.Err(appErr))
	}

	lastJob, _ := a.Srv().Store().Job().GetNewestJobByStatusAndType(model.JobStatusSuccess, model.JobTypeLdapSync)
	var since int64
	if lastJob != nil {
		since = lastJob.StartAt
	}

	params := model.CreateDefaultMembershipParams{Since: since, ReAddRemovedMembers: includeRemovedMembers}

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		params.ScopedTeamID = &syncableID
		if err := a.createDefaultTeamMemberships(rctx, params); err != nil {
			rctx.Logger().Warn("Error creating default team memberships", mlog.Err(err))
		}
		if err := a.deleteGroupConstrainedTeamMemberships(rctx, &syncableID); err != nil {
			rctx.Logger().Warn("Error deleting group constrained team memberships", mlog.Err(err))
		}
	case model.GroupSyncableTypeChannel:
		params.ScopedChannelID = &syncableID
		if err := a.createDefaultChannelMemberships(rctx, params); err != nil {
			rctx.Logger().Warn("Error creating default channel memberships", mlog.Err(err))
		}
		if err := a.deleteGroupConstrainedChannelMemberships(rctx, &syncableID); err != nil {
			rctx.Logger().Warn("Error deleting group constrained team memberships", mlog.Err(err))
		}
	}
}
