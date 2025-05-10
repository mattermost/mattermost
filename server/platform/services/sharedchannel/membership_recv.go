// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

// onReceiveMembershipChange processes a channel membership change (add/remove) from a remote cluster
func (scs *Service) onReceiveMembershipChange(syncMsg *model.SyncMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	if syncMsg.MembershipInfo == nil {
		return fmt.Errorf("onReceiveMembershipChange missing MembershipInfo")
	}

	memberInfo := syncMsg.MembershipInfo

	// Get the channel to make sure it exists and is shared
	channel, err := scs.server.GetStore().Channel().Get(memberInfo.ChannelId, true)
	if err != nil {
		return fmt.Errorf("cannot get channel for membership change: %w", err)
	}

	// Verify this is a valid shared channel
	sc, err := scs.server.GetStore().SharedChannel().Get(memberInfo.ChannelId)
	if err != nil {
		return fmt.Errorf("cannot get shared channel for membership change: %w", err)
	}

	// Avoid unused variable warning
	_ = sc

	// Check if conflicting operations occurred while this change was in transit
	conflicts, err := scs.server.GetStore().SharedChannel().GetUserChanges(memberInfo.UserId, memberInfo.ChannelId, memberInfo.ChangeTime)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to check for membership change conflicts",
			mlog.String("user_id", memberInfo.UserId),
			mlog.String("channel_id", memberInfo.ChannelId),
			mlog.Err(err),
		)
		// Continue anyway - this is not a critical error
	}

	// If there are conflicting operations, the latest one wins
	if len(conflicts) > 0 {
		// If there's a newer change, ignore this one
		for _, conflict := range conflicts {
			if conflict.LastSyncAt > memberInfo.ChangeTime {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Ignoring older membership change due to conflict",
					mlog.String("user_id", memberInfo.UserId),
					mlog.String("channel_id", memberInfo.ChannelId),
					mlog.Bool("is_add", memberInfo.IsAdd),
					mlog.Int("change_time", int(memberInfo.ChangeTime)),
					mlog.Int("conflicting_time", int(conflict.LastSyncAt)),
				)

				return nil
			}
		}
	}

	// Process the membership change
	if memberInfo.IsAdd {
		// Add the user to the channel
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Adding user to channel from remote cluster",
			mlog.String("user_id", memberInfo.UserId),
			mlog.String("channel_id", memberInfo.ChannelId),
			mlog.String("remote_id", rc.RemoteId),
		)

		// Get the user if they exist
		user, eErr := scs.server.GetStore().User().Get(request.EmptyContext(scs.server.Log()).Context(), memberInfo.UserId)
		if eErr != nil {
			return fmt.Errorf("cannot get user for channel add: %w", eErr)
		}

		// Check user permissions for private channels
		if channel.Type == model.ChannelTypePrivate {
			// Ensure user is a member of the team
			rctx := request.EmptyContext(scs.server.Log())
			if teamMember, tErr := scs.server.GetStore().Team().GetMember(rctx, channel.TeamId, memberInfo.UserId); tErr != nil || teamMember == nil {
				// Add user to team as a guest if necessary
				teamMember := &model.TeamMember{
					TeamId:      channel.TeamId,
					UserId:      memberInfo.UserId,
					SchemeGuest: true,
					CreateAt:    model.GetMillis(),
				}
				if _, sErr := scs.server.GetStore().Team().SaveMember(rctx, teamMember, -1); sErr != nil {
					return fmt.Errorf("cannot add user to team for private channel: %w", sErr)
				}
			}
		}

		// Add the user to the channel
		cm := &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      memberInfo.UserId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeGuest: user.IsGuest(),
		}

		rctx := request.EmptyContext(scs.server.Log())
		if _, saveErr := scs.server.GetStore().Channel().SaveMember(rctx, cm); saveErr != nil {
			if saveErr.Error() != "channel_member_exists" {
				return fmt.Errorf("cannot add user to channel: %w", saveErr)
			}
			// User is already in the channel, which is fine
		}

		// Update the sync status
		if syncErr := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(memberInfo.UserId, memberInfo.ChannelId, rc.RemoteId); syncErr != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user LastSyncAt after membership change",
				mlog.String("user_id", memberInfo.UserId),
				mlog.String("channel_id", memberInfo.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
				mlog.Err(syncErr),
			)
		}
	} else {
		// Remove the user from the channel
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Removing user from channel from remote cluster",
			mlog.String("user_id", memberInfo.UserId),
			mlog.String("channel_id", memberInfo.ChannelId),
			mlog.String("remote_id", rc.RemoteId),
		)

		// Remove the user from the channel
		rctx := request.EmptyContext(scs.server.Log())
		if rErr := scs.server.GetStore().Channel().RemoveMember(rctx, memberInfo.ChannelId, memberInfo.UserId); rErr != nil {
			// Ignore "not found" errors - the user might already be removed
			if rErr.Error() != "store.sql_channel.remove_member.missing.app_error" {
				return fmt.Errorf("cannot remove user from channel: %w", rErr)
			}
		}

		// Update the sync status
		if syncErr := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(memberInfo.UserId, memberInfo.ChannelId, rc.RemoteId); syncErr != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user LastSyncAt after membership removal",
				mlog.String("user_id", memberInfo.UserId),
				mlog.String("channel_id", memberInfo.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
				mlog.Err(syncErr),
			)
		}
	}

	// Only update the cursor if all operations succeeded
	if err := scs.updateMembershipSyncCursor(memberInfo.ChannelId, rc.RemoteId, memberInfo.ChangeTime, true); err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update membership sync cursor",
			mlog.String("channel_id", memberInfo.ChannelId),
			mlog.String("remote_id", rc.RemoteId),
			mlog.String("remote_name", rc.DisplayName),
			mlog.Err(err),
		)
		// Non-critical error, don't return it
	}

	return nil
}

// onReceiveMembershipBatch processes a batch of channel membership changes from a remote cluster
func (scs *Service) onReceiveMembershipBatch(syncMsg *model.SyncMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	if syncMsg.MembershipBatchInfo == nil {
		return fmt.Errorf("onReceiveMembershipBatch missing MembershipBatchInfo")
	}

	batchInfo := syncMsg.MembershipBatchInfo

	// Get the channel to make sure it exists and is shared
	channel, err := scs.server.GetStore().Channel().Get(batchInfo.ChannelId, true)
	if err != nil {
		return fmt.Errorf("cannot get channel for membership batch: %w", err)
	}

	// Verify this is a valid shared channel
	sc, err := scs.server.GetStore().SharedChannel().Get(batchInfo.ChannelId)
	if err != nil {
		return fmt.Errorf("cannot get shared channel for membership batch: %w", err)
	}

	// Avoid unused variable warning
	_ = sc

	scs.server.Log().Log(mlog.LvlInfo, "Processing membership batch",
		mlog.String("channel_id", batchInfo.ChannelId),
		mlog.String("remote_id", rc.RemoteId),
		mlog.Int("batch_size", len(batchInfo.Changes)),
	)

	// Process each change in the batch
	var successCount, skipCount, failCount int

	for _, change := range batchInfo.Changes {
		// Check if conflicting operations occurred while this change was in transit
		conflicts, conflictErr := scs.server.GetStore().SharedChannel().GetUserChanges(change.UserId, change.ChannelId, change.ChangeTime)
		if conflictErr != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to check for membership change conflicts in batch",
				mlog.String("user_id", change.UserId),
				mlog.String("channel_id", change.ChannelId),
				mlog.Err(conflictErr),
			)
			// Continue anyway - this is not a critical error
		}

		// If there are conflicting operations, the latest one wins
		skipThisChange := false
		if len(conflicts) > 0 {
			// If there's a newer change, ignore this one
			for _, conflict := range conflicts {
				if conflict.LastSyncAt > change.ChangeTime {
					scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Ignoring older membership change due to conflict in batch",
						mlog.String("user_id", change.UserId),
						mlog.String("channel_id", change.ChannelId),
						mlog.Bool("is_add", change.IsAdd),
						mlog.Int("change_time", int(change.ChangeTime)),
						mlog.Int("conflicting_time", int(conflict.LastSyncAt)),
					)
					skipCount++
					skipThisChange = true
					break
				}
			}
		}

		if skipThisChange {
			continue
		}

		// Process the membership change based on whether it's an add or remove
		if change.IsAdd {
			// Add the user to the channel
			if processErr := scs.processMemberAdd(change, channel, rc); processErr != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to add user in membership batch",
					mlog.String("user_id", change.UserId),
					mlog.String("channel_id", change.ChannelId),
					mlog.String("remote_id", rc.RemoteId),
					mlog.Err(processErr),
				)
				failCount++
				continue
			}
		} else {
			// Remove the user from the channel
			if processErr := scs.processMemberRemove(change, rc); processErr != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to remove user in membership batch",
					mlog.String("user_id", change.UserId),
					mlog.String("channel_id", change.ChannelId),
					mlog.String("remote_id", rc.RemoteId),
					mlog.Err(processErr),
				)
				failCount++
				continue
			}
		}

		successCount++
	}

	// Only update the cursor if processing succeeded
	if failCount == 0 || successCount > 0 {
		// We consider this successful if at least some operations succeeded
		if err := scs.updateMembershipSyncCursor(batchInfo.ChannelId, rc.RemoteId, batchInfo.ChangeTime, true); err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update membership sync cursor after batch",
				mlog.String("channel_id", batchInfo.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
				mlog.String("remote_name", rc.DisplayName),
				mlog.Err(err),
			)
			// Non-critical error, don't return it
		}
	} else {
		// Don't update cursor if everything failed, so we can retry
		scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Skipping cursor update due to failures",
			mlog.String("channel_id", batchInfo.ChannelId),
			mlog.String("remote_id", rc.RemoteId),
			mlog.Int("success", successCount),
			mlog.Int("failed", failCount),
		)
	}

	scs.server.Log().Log(mlog.LvlInfo, "Processed membership batch",
		mlog.String("channel_id", batchInfo.ChannelId),
		mlog.String("remote_id", rc.RemoteId),
		mlog.Int("total", len(batchInfo.Changes)),
		mlog.Int("success", successCount),
		mlog.Int("skipped", skipCount),
		mlog.Int("failed", failCount),
	)

	return nil
}

// processMemberAdd handles adding a user to a channel as part of batch processing
func (scs *Service) processMemberAdd(change *model.MembershipChangeMsg, channel *model.Channel, rc *model.RemoteCluster) error {
	// Get the user if they exist
	user, err := scs.server.GetStore().User().Get(request.EmptyContext(scs.server.Log()).Context(), change.UserId)
	if err != nil {
		return fmt.Errorf("cannot get user for channel add: %w", err)
	}

	// Check user permissions for private channels
	if channel.Type == model.ChannelTypePrivate {
		// Ensure user is a member of the team
		rctx := request.EmptyContext(scs.server.Log())
		if teamMember, teamErr := scs.server.GetStore().Team().GetMember(rctx, channel.TeamId, change.UserId); teamErr != nil || teamMember == nil {
			// Add user to team as a guest if necessary
			teamMember := &model.TeamMember{
				TeamId:      channel.TeamId,
				UserId:      change.UserId,
				SchemeGuest: true,
				CreateAt:    model.GetMillis(),
			}
			if _, saveErr := scs.server.GetStore().Team().SaveMember(rctx, teamMember, -1); saveErr != nil {
				return fmt.Errorf("cannot add user to team for private channel: %w", saveErr)
			}
		}
	}

	// Add the user to the channel
	cm := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      change.UserId,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: user.IsGuest(),
	}

	rctx := request.EmptyContext(scs.server.Log())
	if _, saveErr := scs.server.GetStore().Channel().SaveMember(rctx, cm); saveErr != nil {
		if saveErr.Error() != "channel_member_exists" {
			return fmt.Errorf("cannot add user to channel: %w", saveErr)
		}
		// User is already in the channel, which is fine
	}

	// Update the sync status
	if syncErr := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(change.UserId, change.ChannelId, rc.RemoteId); syncErr != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user LastSyncAt after batch member add",
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
func (scs *Service) processMemberRemove(change *model.MembershipChangeMsg, rc *model.RemoteCluster) error {
	// Remove the user from the channel
	rctx := request.EmptyContext(scs.server.Log())
	if removeErr := scs.server.GetStore().Channel().RemoveMember(rctx, change.ChannelId, change.UserId); removeErr != nil {
		// Ignore "not found" errors - the user might already be removed
		if removeErr.Error() != "store.sql_channel.remove_member.missing.app_error" {
			return fmt.Errorf("cannot remove user from channel: %w", removeErr)
		}
	}

	// Update the sync status
	if syncErr := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(change.UserId, change.ChannelId, rc.RemoteId); syncErr != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user LastSyncAt after batch member remove",
			mlog.String("user_id", change.UserId),
			mlog.String("channel_id", change.ChannelId),
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(syncErr),
		)
		// Continue despite the error - this is not critical
	}

	return nil
}
