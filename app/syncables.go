// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/mlog"
)

// PopulateSyncablesSince adds users to teams and channels based on their group memberships and how those groups are
// configured to sync with teams and channels for group members on or after the given timestamp.
func (a *App) PopulateSyncablesSince(groupMembersCreatedAfter int64) error {
	userTeamIDs, appErr := a.PendingAutoAddTeamMembers(groupMembersCreatedAfter)
	if appErr != nil {
		return appErr
	}

	for _, userTeam := range userTeamIDs {
		_, err := a.AddTeamMember(userTeam.TeamID, userTeam.UserID)
		if err != nil {
			return err
		}

		a.Log.Info("added teammember",
			mlog.String("user_id", userTeam.UserID),
			mlog.String("team_id", userTeam.TeamID),
		)
	}

	userChannelIDs, appErr := a.PendingAutoAddChannelMembers(groupMembersCreatedAfter)
	if appErr != nil {
		return appErr
	}

	for _, userChannel := range userChannelIDs {
		channel, err := a.GetChannel(userChannel.ChannelID)
		if err != nil {
			return err
		}

		// First add user to team
		_, err = a.AddTeamMember(channel.TeamId, userChannel.UserID)
		if err != nil {
			return err
		}
		a.Log.Info("added teammember",
			mlog.String("user_id", userChannel.UserID),
			mlog.String("team_id", channel.TeamId),
		)

		_, err = a.AddChannelMember(userChannel.UserID, channel, "", "", "")
		if err != nil {
			return err
		}

		a.Log.Info("added channelmember",
			mlog.String("user_id", userChannel.UserID),
			mlog.String("channel_id", userChannel.ChannelID),
		)
	}

	return nil
}
