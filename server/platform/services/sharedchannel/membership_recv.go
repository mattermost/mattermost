// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

// checkMembershipConflict checks if there are newer changes that would conflict with this one
// Returns true if this change should be skipped due to a conflict
func (scs *Service) checkMembershipConflict(userID, channelID string, changeTime int64) (bool, error) {
	conflicts, err := scs.server.GetStore().SharedChannel().GetUserChanges(userID, channelID, changeTime)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to check for membership change conflicts",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.Err(err),
		)
		return false, err
	}

	// If there are conflicting operations, the latest one wins
	for _, conflict := range conflicts {
		if conflict.LastMembershipSyncAt > changeTime {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Ignoring older membership change due to conflict",
				mlog.String("user_id", userID),
				mlog.String("channel_id", channelID),
				mlog.Int("change_time", int(changeTime)),
				mlog.Int("conflicting_time", int(conflict.LastMembershipSyncAt)),
			)
			return true, nil
		}
	}

	return false, nil
}

// onReceiveMembershipChanges processes channel membership changes from a remote cluster
func (scs *Service) onReceiveMembershipChanges(syncMsg *model.SyncMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	// Check if feature flag is enabled
	if !scs.server.Config().FeatureFlags.EnableSharedChannelsMemberSync {
		return nil
	}

	if len(syncMsg.MembershipChanges) == 0 {
		return fmt.Errorf("onReceiveMembershipChanges: no membership changes")
	}

	// Get the channel to make sure it exists and is shared
	channel, err := scs.server.GetStore().Channel().Get(syncMsg.ChannelId, true)
	if err != nil {
		return fmt.Errorf("cannot get channel for membership changes: %w", err)
	}

	// Verify this is a valid shared channel
	_, err = scs.server.GetStore().SharedChannel().Get(syncMsg.ChannelId)
	if err != nil {
		return fmt.Errorf("cannot get shared channel for membership changes: %w", err)
	}

	// Calculate the maximum ChangeTime from all changes in the batch
	var maxChangeTime int64
	for _, change := range syncMsg.MembershipChanges {
		if change.ChangeTime > maxChangeTime {
			maxChangeTime = change.ChangeTime
		}
	}

	// Process each change
	var successCount, skipCount, failCount int

	for _, change := range syncMsg.MembershipChanges {
		// Check for conflicts
		shouldSkip, _ := scs.checkMembershipConflict(change.UserId, change.ChannelId, change.ChangeTime)
		if shouldSkip {
			skipCount++
			continue
		}

		// Process the membership change based on whether it's an add or remove
		var processErr error
		if change.IsAdd {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Adding user to channel from remote cluster",
				mlog.String("user_id", change.UserId),
				mlog.String("channel_id", change.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
			)
			processErr = scs.processMemberAdd(change, channel, rc, maxChangeTime)
		} else {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Removing user from channel from remote cluster",
				mlog.String("user_id", change.UserId),
				mlog.String("channel_id", change.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
			)
			processErr = scs.processMemberRemove(change, rc, maxChangeTime)
		}

		if processErr != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to process membership change",
				mlog.String("user_id", change.UserId),
				mlog.String("channel_id", change.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
				mlog.Bool("is_add", change.IsAdd),
				mlog.Err(processErr),
			)
			failCount++
			continue
		}

		successCount++
	}

	return nil
}

// processMemberAdd handles adding a user to a channel as part of batch processing
func (scs *Service) processMemberAdd(change *model.MembershipChangeMsg, channel *model.Channel, rc *model.RemoteCluster, maxChangeTime int64) error {
	// Get the user if they exist
	user, err := scs.server.GetStore().User().Get(request.EmptyContext(scs.server.Log()).Context(), change.UserId)
	if err != nil {
		return fmt.Errorf("cannot get user for channel add: %w", err)
	}

	// Check user permissions for private channels
	if channel.Type == model.ChannelTypePrivate {
		// Add user to team if needed for private channel
		rctx := request.EmptyContext(scs.server.Log())
		appErr := scs.app.AddUserToTeamByTeamId(rctx, channel.TeamId, user)
		if appErr != nil {
			return fmt.Errorf("cannot add user to team for private channel: %w", appErr)
		}
	}

	// Use the app layer to add the user to the channel
	// This ensures proper processing of all side effects
	rctx := request.EmptyContext(scs.server.Log())
	_, appErr := scs.app.AddUserToChannel(rctx, user, channel, false)
	if appErr != nil {
		// Skip "already added" errors
		if appErr.Error() != "api.channel.add_user.to_channel.failed.app_error" &&
			!strings.Contains(appErr.Error(), "channel_member_exists") {
			return fmt.Errorf("cannot add user to channel: %w", appErr)
		}
		// User is already in the channel, which is fine
	}

	// Update the sync status
	if syncErr := scs.server.GetStore().SharedChannel().UpdateUserLastMembershipSyncAt(change.UserId, change.ChannelId, rc.RemoteId, maxChangeTime); syncErr != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user LastMembershipSyncAt after batch member add",
			mlog.String("user_id", change.UserId),
			mlog.String("channel_id", change.ChannelId),
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(syncErr),
		)
		// Continue despite the error - this is not critical
	}

	return nil
}

// processMemberRemove handles removing a user from a channel as part of batch processing
func (scs *Service) processMemberRemove(change *model.MembershipChangeMsg, rc *model.RemoteCluster, maxChangeTime int64) error {
	// Get channel so we can use app layer methods properly
	channel, err := scs.server.GetStore().Channel().Get(change.ChannelId, true)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Cannot find channel for member removal",
			mlog.String("channel_id", change.ChannelId),
			mlog.String("user_id", change.UserId),
			mlog.Err(err),
		)
		// Continue anyway to update sync status - the channel might be deleted
	}

	// Use the app layer's remove user method if channel still exists
	if channel != nil {
		rctx := request.EmptyContext(scs.server.Log())
		// We use empty string for removerUserId to indicate system-initiated removal
		// This also ensures we bypass permission checks intended for user-initiated removals
		appErr := scs.app.RemoveUserFromChannel(rctx, change.UserId, "", channel)
		if appErr != nil {
			// Ignore "not found" errors - the user might already be removed
			if !strings.Contains(appErr.Error(), "store.sql_channel.remove_member.missing.app_error") {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Error removing user from channel",
					mlog.String("channel_id", change.ChannelId),
					mlog.String("user_id", change.UserId),
					mlog.Err(appErr),
				)
				// Continue anyway to update sync status - don't return error here
				// to ensure sync status still gets updated
			}
		}
	}

	// Update the sync status
	if syncErr := scs.server.GetStore().SharedChannel().UpdateUserLastMembershipSyncAt(change.UserId, change.ChannelId, rc.RemoteId, maxChangeTime); syncErr != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user LastMembershipSyncAt after batch member remove",
			mlog.String("user_id", change.UserId),
			mlog.String("channel_id", change.ChannelId),
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(syncErr),
		)
		// Continue despite the error - this is not critical
	}

	return nil
}
