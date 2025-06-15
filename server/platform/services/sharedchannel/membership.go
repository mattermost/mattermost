// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

// isChannelMemberSyncEnabled checks if the feature flag is enabled and remote cluster service is available
func (scs *Service) isChannelMemberSyncEnabled() bool {
	featureFlagEnabled := scs.server.Config().FeatureFlags.EnableSharedChannelsMemberSync
	remoteClusterService := scs.server.GetRemoteClusterService()
	return featureFlagEnabled && remoteClusterService != nil
}

// queueMembershipSyncTask creates and queues a task to synchronize channel membership changes
func (scs *Service) queueMembershipSyncTask(channelID, userID, remoteID string, syncMsg *model.SyncMsg, retryMsg *model.SyncMsg) {
	task := newSyncTask(channelID, userID, remoteID, syncMsg, retryMsg)
	task.schedule = time.Now().Add(NotifyMinimumDelay)

	scs.addTask(task)
}

// HandleMembershipChange is called when users are added or removed from a shared channel.
// It creates a task to notify all remote clusters about the membership change.
func (scs *Service) HandleMembershipChange(channelID, userID string, isAdd bool, remoteID string) {
	if !scs.isChannelMemberSyncEnabled() {
		return
	}

	// Create timestamp for consistent usage
	changeTime := model.GetMillis()

	// Create membership change info
	syncMsg := model.NewSyncMsg(channelID)
	syncMsg.MembershipChanges = []*model.MembershipChangeMsg{
		{
			ChannelId:  channelID,
			UserId:     userID,
			IsAdd:      isAdd,
			RemoteId:   remoteID, // which remote initiated this change
			ChangeTime: changeTime,
		},
	}

	// Queue the membership change task
	scs.queueMembershipSyncTask(channelID, userID, "", syncMsg, nil)
}

// HandleMembershipBatchChange is called to process a batch of membership changes for a shared channel.
// It creates a task to notify all remote clusters about the batch membership changes.
func (scs *Service) HandleMembershipBatchChange(channelID string, userIDs []string, isAdd bool, remoteID string) {
	if !scs.isChannelMemberSyncEnabled() {
		return
	}

	if len(userIDs) == 0 {
		return
	}

	// Create timestamp for consistent usage
	changeTime := model.GetMillis()

	// Create sync message with membership changes
	syncMsg := model.NewSyncMsg(channelID)
	syncMsg.MembershipChanges = make([]*model.MembershipChangeMsg, 0, len(userIDs))

	// Add each user to the batch
	for _, userID := range userIDs {
		syncMsg.MembershipChanges = append(syncMsg.MembershipChanges, &model.MembershipChangeMsg{
			ChannelId:  channelID,
			UserId:     userID,
			IsAdd:      isAdd,
			RemoteId:   remoteID,
			ChangeTime: changeTime,
		})
	}

	// Queue the batch membership sync task
	scs.queueMembershipSyncTask(channelID, "", "", syncMsg, nil)
}

// SyncAllChannelMembers synchronizes all channel members to a specific remote.
// This is typically called when a channel is first shared with a remote cluster.
// If remote is provided, it will be used instead of fetching from the database.
func (scs *Service) SyncAllChannelMembers(channelID string, remoteID string, remote *model.SharedChannelRemote) error {
	if !scs.isChannelMemberSyncEnabled() {
		return nil
	}

	// Verify the channel exists and is shared
	if _, err := scs.server.GetStore().SharedChannel().Get(channelID); err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Failed to get shared channel",
			mlog.String("channel_id", channelID),
			mlog.Err(err),
		)
		return fmt.Errorf("failed to get shared channel %s: %w", channelID, err)
	}

	// Get the remote to ensure it exists (if not provided)
	if remote == nil {
		var err error
		remote, err = scs.server.GetStore().SharedChannel().GetRemoteByIds(channelID, remoteID)
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Failed to get remote",
				mlog.String("channel_id", channelID),
				mlog.String("remote_id", remoteID),
				mlog.Err(err),
			)
			return fmt.Errorf("failed to get remote for channel %s: %w", channelID, err)
		}
	}

	// Use offset-based pagination to handle channels with many members
	// This ensures we don't skip members when multiple members have the same LastUpdateAt timestamp
	maxPerPage := scs.GetMemberSyncBatchSize()
	var allMembers model.ChannelMembers
	lastSyncAt := remote.LastMembersSyncAt
	offset := 0

	// Process members incrementally with offset-based pagination
	for {
		opts := model.ChannelMembersGetOptions{
			ChannelID:    channelID,
			UpdatedAfter: lastSyncAt,
			Limit:        maxPerPage,
			Offset:       offset,
		}

		members, err1 := scs.server.GetStore().Channel().GetMembers(opts)
		if err1 != nil {
			return fmt.Errorf("failed to get members for channel %s: %w", channelID, err1)
		}

		if len(members) == 0 {
			break // No more members to process
		}

		// Add to our collection
		allMembers = append(allMembers, members...)

		// Log progress when processing large channels
		if len(allMembers)%1000 == 0 {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Processing channel members in batches",
				mlog.String("channel_id", channelID),
				mlog.String("remote_id", remoteID),
				mlog.Int("processed_so_far", len(allMembers)),
			)
		}

		if len(members) < maxPerPage {
			break // Last page
		}

		// Move to next page
		offset += maxPerPage
	}

	if len(allMembers) == 0 {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "No members to sync for channel",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
		)
		return nil
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Syncing all channel members",
		mlog.String("channel_id", channelID),
		mlog.String("remote_id", remoteID),
		mlog.Int("member_count", len(allMembers)),
	)

	// Get batch size from config
	batchSize := scs.GetMemberSyncBatchSize()

	// For small channels, queue individual membership changes
	if len(allMembers) <= batchSize {
		return scs.syncMembersIndividually(channelID, remoteID, allMembers, remote)
	}

	// For larger channels, use batch processing
	return scs.syncMembersInBatches(channelID, remoteID, allMembers, remote)
}

// syncMembersIndividually processes each member individually
// This is more efficient for small channels
func (scs *Service) syncMembersIndividually(channelID, remoteID string, members model.ChannelMembers, remote *model.SharedChannelRemote) error {
	// Queue individual membership changes for each member
	for _, member := range members {
		// Queue membership change for this user (isAdd=true)
		scs.HandleMembershipChange(channelID, member.UserId, true, "")
	}

	return nil
}

// syncMembersInBatches processes members in batches for greater efficiency
// This is better for channels with many members
func (scs *Service) syncMembersInBatches(channelID, remoteID string, members model.ChannelMembers, remote *model.SharedChannelRemote) error {
	// Get batch size from config
	batchSize := scs.GetMemberSyncBatchSize()

	for i := 0; i < len(members); i += batchSize {
		end := i + batchSize
		if end > len(members) {
			end = len(members)
		}

		// Create a batch of members
		batchMembers := members[i:end]

		// Extract user IDs from the batch
		userIDs := make([]string, len(batchMembers))
		for j, member := range batchMembers {
			userIDs[j] = member.UserId
		}

		// Use the batch handling function to queue the changes
		scs.HandleMembershipBatchChange(channelID, userIDs, true, "")
	}

	return nil
}

// processMembershipChange processes a channel membership change task.
// It determines which remotes should receive the update and creates tasks for each.
func (scs *Service) processMembershipChange(syncMsg *model.SyncMsg) {
	if len(syncMsg.MembershipChanges) == 0 {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Invalid membership change task - no membership changes",
			mlog.String("channel_id", syncMsg.ChannelId),
		)
		return
	}

	// Get the shared channel (to verify it exists)
	_, err := scs.server.GetStore().SharedChannel().Get(syncMsg.ChannelId)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get shared channel for membership change",
			mlog.String("channel_id", syncMsg.ChannelId),
			mlog.Int("change_count", len(syncMsg.MembershipChanges)),
			mlog.Err(err),
		)
		return
	}

	// Get all remotes for this channel
	remotes, err := scs.server.GetStore().SharedChannel().GetRemotes(0, 999999, model.SharedChannelRemoteFilterOpts{
		ChannelId: syncMsg.ChannelId,
	})
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get shared channel remotes for membership change",
			mlog.String("channel_id", syncMsg.ChannelId),
			mlog.Err(err),
		)
		return
	}

	// Always use batch processing for consistency (works for single or multiple changes)
	scs.syncMembershipBatchToRemotes(syncMsg, remotes)
}

// syncMembershipBatchToRemotes synchronizes membership changes (single or batch) with remote clusters.
func (scs *Service) syncMembershipBatchToRemotes(syncMsg *model.SyncMsg, remotes []*model.SharedChannelRemote) {
	if len(syncMsg.MembershipChanges) == 0 {
		return
	}

	// Get the initiating remote ID from the first change (all should be the same)
	initiatingRemoteId := ""
	if len(syncMsg.MembershipChanges) > 0 {
		initiatingRemoteId = syncMsg.MembershipChanges[0].RemoteId
	}

	// Send to all remotes except the one that initiated this change
	for _, remote := range remotes {
		// Skip the remote that initiated this change to prevent loops
		if remote.RemoteId == initiatingRemoteId {
			continue
		}

		// Get the remote cluster
		rc, err := scs.server.GetStore().RemoteCluster().Get(remote.RemoteId, false)
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get remote cluster for batch membership sync",
				mlog.String("remote_id", remote.RemoteId),
				mlog.String("channel_id", syncMsg.ChannelId),
				mlog.Err(err),
			)
			continue
		}

		// Create a copy of the sync message to potentially add user profiles
		enrichedSyncMsg := &model.SyncMsg{
			Id:                syncMsg.Id,
			ChannelId:         syncMsg.ChannelId,
			MembershipChanges: syncMsg.MembershipChanges,
			Users:             make(map[string]*model.User),
		}

		// Add user profiles for all users being added
		for _, change := range syncMsg.MembershipChanges {
			if change.IsAdd {
				user, pErr := scs.server.GetStore().User().Get(context.Background(), change.UserId)
				if pErr != nil {
					scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Failed to get user for batch membership sync",
						mlog.String("user_id", change.UserId),
						mlog.String("channel_id", syncMsg.ChannelId),
						mlog.String("remote_id", remote.RemoteId),
						mlog.Err(pErr),
					)
					continue
				}

				// Check if user profile needs to be synced
				doSync, _, sErr := scs.shouldUserSync(user, syncMsg.ChannelId, rc)
				if sErr == nil && doSync {
					enrichedSyncMsg.Users[user.Id] = user
				}
			}
		}

		// Send message using the existing remote cluster framework
		payload, err := json.Marshal(enrichedSyncMsg)
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to marshal batch membership message",
				mlog.String("remote_id", remote.RemoteId),
				mlog.String("channel_id", syncMsg.ChannelId),
				mlog.Err(err),
			)
			continue
		}

		msg := model.RemoteClusterMsg{
			Id:       model.NewId(),
			Topic:    TopicChannelMembership,
			CreateAt: model.GetMillis(),
			Payload:  payload,
		}

		ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
		defer cancel()

		// Define a callback function
		callback := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
			if err != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error sending batch membership changes to remote",
					mlog.String("remote", remote.RemoteId),
					mlog.String("channel_id", syncMsg.ChannelId),
					mlog.Int("change_count", len(syncMsg.MembershipChanges)),
					mlog.Err(err),
				)
				return
			}

			if resp != nil && resp.Err != "" {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Remote error when processing batch membership changes",
					mlog.String("remote", remote.RemoteId),
					mlog.String("channel_id", syncMsg.ChannelId),
					mlog.String("remote_error", resp.Err),
				)
				return
			}

			// Update sync timestamps
			for _, change := range syncMsg.MembershipChanges {
				if err := scs.server.GetStore().SharedChannel().UpdateUserLastMembershipSyncAt(change.UserId, change.ChannelId, remote.RemoteId, change.ChangeTime); err != nil {
					scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user membership sync timestamp in batch",
						mlog.String("user_id", change.UserId),
						mlog.Err(err),
					)
				}
			}

			// Update the cursor with the latest change time
			var maxChangeTime int64
			for _, change := range syncMsg.MembershipChanges {
				if change.ChangeTime > maxChangeTime {
					maxChangeTime = change.ChangeTime
				}
			}

			if err := scs.updateMembershipSyncCursor(syncMsg.ChannelId, remote.RemoteId, maxChangeTime); err != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update membership sync cursor for batch",
					mlog.String("remote_id", remote.RemoteId),
					mlog.String("channel_id", syncMsg.ChannelId),
					mlog.Err(err),
				)
			}
		}

		err = scs.server.GetRemoteClusterService().SendMsg(ctx, msg, rc, callback)

		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to send batch membership changes to remote",
				mlog.String("remote_id", remote.RemoteId),
				mlog.String("channel_id", syncMsg.ChannelId),
				mlog.Err(err),
			)
		}
	}
}
