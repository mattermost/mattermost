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
	return scs.server.Config().FeatureFlags.EnableSharedChannelMemberSync && scs.server.GetRemoteClusterService() != nil
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
func (scs *Service) SyncAllChannelMembers(channelID string, remoteID string) error {
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

	// Get the remote to ensure it exists
	remote, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Failed to get remote",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
			mlog.Err(err),
		)
		return fmt.Errorf("failed to get remote for channel %s: %w", channelID, err)
	}

	// Use cursor-based pagination to handle channels with many members
	maxPerPage := 200 // Process in reasonable batches
	var allMembers model.ChannelMembers
	lastSyncAt := remote.LastMembersSyncAt

	// Process members incrementally with cursor-based pagination
	for {
		opts := model.ChannelMembersGetOptions{
			ChannelID:    channelID,
			UpdatedAfter: lastSyncAt,
			Limit:        maxPerPage,
		}

		members, err := scs.server.GetStore().Channel().GetMembers(opts)
		if err != nil {
			return fmt.Errorf("failed to get members for channel %s: %w", channelID, err)
		}

		if len(members) == 0 {
			break // No more members to process
		}

		// Add to our collection
		allMembers = append(allMembers, members...)

		// Update cursor for next page - find max timestamp
		var maxTimestamp int64
		for _, member := range members {
			if member.LastUpdateAt > maxTimestamp {
				maxTimestamp = member.LastUpdateAt
			}
		}

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

		// Move cursor forward for next batch fetch
		lastSyncAt = maxTimestamp
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

// shouldSyncUser determines if a user should be synchronized to remote clusters.
// Returns true for all valid users including bots and system admins.
//
// All users are synced to remote clusters, but their roles are normalized to
// system_user when they arrive at the destination cluster. This ensures that
// elevated permissions (like system admin) are not replicated to remote instances,
// while still allowing all users to participate in shared channels.
func (scs *Service) shouldSyncUser(channelID string, userID string) (*model.User, bool) {
	user, err := scs.server.GetStore().User().Get(context.Background(), userID)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Failed to get user during channel member sync",
			mlog.String("channel_id", channelID),
			mlog.String("user_id", userID),
			mlog.Err(err),
		)
		return nil, false
	}

	return user, true
}

// syncMembersIndividually processes each member individually
// This is more efficient for small channels
func (scs *Service) syncMembersIndividually(channelID, remoteID string, members model.ChannelMembers, remote *model.SharedChannelRemote) error {
	// Get valid members that should be synchronized
	syncedMembers := scs.filterSyncableMembers(channelID, members)

	// Queue individual membership changes for each member
	for _, userID := range syncedMembers {
		// Queue membership change for this user (isAdd=true)
		scs.HandleMembershipChange(channelID, userID, true, "")

		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Queued channel member sync",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
			mlog.String("user_id", userID),
			mlog.Int("timestamp", int(model.GetMillis())), // Add timestamp for better tracking
		)
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Channel member sync queued successfully",
		mlog.String("channel_id", channelID),
		mlog.String("remote_id", remoteID),
		mlog.Int("member_count", len(syncedMembers)),
		mlog.Int("timestamp", int(model.GetMillis())),
	)

	return nil
}

// filterSyncableMembers returns a list of user IDs that should be synchronized
func (scs *Service) filterSyncableMembers(channelID string, members model.ChannelMembers) []string {
	validMembers := make([]string, 0, len(members))

	for _, member := range members {
		_, shouldSync := scs.shouldSyncUser(channelID, member.UserId)
		if shouldSync {
			validMembers = append(validMembers, member.UserId)
		}
	}

	return validMembers
}

// syncMembersInBatches processes members in batches for greater efficiency
// This is better for channels with many members
func (scs *Service) syncMembersInBatches(channelID, remoteID string, members model.ChannelMembers, remote *model.SharedChannelRemote) error {
	// Get valid members that should be synchronized
	validMembers := scs.filterSyncableMembers(channelID, members)

	// Get batch size from config
	batchSize := scs.GetMemberSyncBatchSize()

	// Process in batches of the configured size
	totalBatches := (len(validMembers) + batchSize - 1) / batchSize

	for i := 0; i < len(validMembers); i += batchSize {
		end := i + batchSize
		if end > len(validMembers) {
			end = len(validMembers)
		}

		// Create a batch of members
		batchMembers := validMembers[i:end]

		// Use the batch handling function to queue the changes
		scs.HandleMembershipBatchChange(channelID, batchMembers, true, "")

		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Queued membership batch",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
			mlog.Int("batch_num", i/batchSize+1),
			mlog.Int("total_batches", totalBatches),
			mlog.Int("batch_size", len(batchMembers)),
		)
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Channel member batch sync queued",
		mlog.String("channel_id", channelID),
		mlog.String("remote_id", remoteID),
		mlog.Int("total_batches", totalBatches),
		mlog.Int("member_count", len(validMembers)),
		mlog.Int("timestamp", int(model.GetMillis())),
	)

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
	remotes, err := scs.server.GetStore().SharedChannel().GetRemotes(0, 1000, model.SharedChannelRemoteFilterOpts{
		ChannelId: syncMsg.ChannelId,
	})
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get shared channel remotes for membership change",
			mlog.String("channel_id", syncMsg.ChannelId),
			mlog.Err(err),
		)
		return
	}

	// Process batch if multiple changes, otherwise process single change
	if len(syncMsg.MembershipChanges) == 1 {
		change := syncMsg.MembershipChanges[0]
		// Sync to all remotes except the one that initiated this change
		for _, remote := range remotes {
			// Skip the remote that initiated this change to prevent loops
			if remote.RemoteId == change.RemoteId {
				continue
			}

			// Create a task for each remote
			scs.syncMembershipToRemote(syncMsg.ChannelId, change.UserId, change.IsAdd, remote, change.ChangeTime)
		}
	} else {
		// Batch processing - send all changes at once
		scs.syncMembershipBatchToRemotes(syncMsg, remotes)
	}
}

// syncMembershipToRemote synchronizes a channel membership change with a remote cluster.
func (scs *Service) syncMembershipToRemote(channelID, userID string, isAdd bool, remote *model.SharedChannelRemote, changeTime int64) {
	// Get the remote cluster
	rc, err := scs.server.GetStore().RemoteCluster().Get(remote.RemoteId, false)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get remote cluster for membership sync",
			mlog.String("remote_id", remote.RemoteId),
			mlog.String("channel_id", channelID),
			mlog.Err(err),
		)
		return
	}

	// Get the user and check if they should be synced in one operation
	user, err := scs.server.GetStore().User().Get(context.Background(), userID)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get user for membership sync",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remote.RemoteId),
			mlog.Err(err),
		)
		return
	}

	// Check if user profile needs to be synced to the remote
	// We only need the first return value (doSync)
	doSync, _, err := scs.shouldUserSync(user, channelID, rc)
	if err == nil && doSync {
		// Queue user profile sync using the existing task system
		userMsg := model.NewSyncMsg(channelID)
		userMsg.Users = map[string]*model.User{user.Id: user}

		scs.queueMembershipSyncTask(channelID, user.Id, remote.RemoteId, userMsg, nil)
	} else if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to check if user should be synced",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remote.RemoteId),
			mlog.Err(err),
		)
		// Continue anyway since we're more concerned with the membership change
	}

	// Create the membership change message with a slightly future timestamp
	// to ensure it's greater than any existing timestamp
	membershipMsg := model.NewSyncMsg(channelID)

	// Use a high enough timestamp to ensure cursor updates
	currentTime := model.GetMillis()
	if currentTime <= changeTime {
		currentTime = changeTime + 1
	}

	membershipMsg.MembershipChanges = []*model.MembershipChangeMsg{
		{
			ChannelId:  channelID,
			UserId:     userID,
			IsAdd:      isAdd,
			RemoteId:   scs.getMyClusterId(),
			ChangeTime: currentTime,
		},
	}

	// Send message using the existing remote cluster framework
	payload, err := json.Marshal(membershipMsg)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to marshal membership message",
			mlog.String("remote_id", remote.RemoteId),
			mlog.String("channel_id", channelID),
			mlog.String("user_id", userID),
			mlog.Err(err),
		)
		return
	}

	msg := model.RemoteClusterMsg{
		Id:       model.NewId(),
		Topic:    TopicChannelMembership,
		CreateAt: model.GetMillis(),
		Payload:  payload,
	}

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	// Define a callback function with better response handling
	callback := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error sending membership change to remote",
				mlog.String("remote", remote.RemoteId),
				mlog.String("channel_id", channelID),
				mlog.String("user_id", userID),
				mlog.Bool("is_add", isAdd),
				mlog.Int("change_time", int(changeTime)),
				mlog.Err(err),
			)

			// Will retry when remote comes back online
			return
		}

		if resp != nil && resp.Err != "" {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Remote error when processing membership change",
				mlog.String("remote", remote.RemoteId),
				mlog.String("channel_id", channelID),
				mlog.String("user_id", userID),
				mlog.Bool("is_add", isAdd),
				mlog.Int("change_time", int(changeTime)),
				mlog.String("remote_error", resp.Err),
			)
			return
		}

		// Parse the response payload
		var syncResp model.SyncResponse
		syncSuccess := false

		if resp != nil && len(resp.Payload) > 0 {
			if jsonErr := json.Unmarshal(resp.Payload, &syncResp); jsonErr != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to parse membership sync response",
					mlog.String("remote_id", remote.RemoteId),
					mlog.String("channel_id", channelID),
					mlog.String("user_id", userID),
					mlog.Int("change_time", int(changeTime)),
					mlog.Err(jsonErr),
				)
			} else {
				// Check if this specific user was successfully synced
				for _, syncedID := range syncResp.UsersSyncd {
					if syncedID == userID {
						syncSuccess = true
						break
					}
				}
			}
		} else {
			// For backward compatibility, assume success if no detailed response
			syncSuccess = true
		}

		if syncSuccess {
			// Record successful sync
			err = scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(userID, channelID, remote.RemoteId)
			if err != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user sync timestamp",
					mlog.String("user_id", userID),
					mlog.Err(err),
				)
			}

			// Update the cursor only on success
			if err := scs.updateMembershipSyncCursor(channelID, remote.RemoteId, changeTime, true); err != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update membership sync cursor",
					mlog.String("remote_id", remote.RemoteId),
					mlog.String("channel_id", channelID),
					mlog.String("user_id", userID),
					mlog.Int("change_time", int(changeTime)),
					mlog.Err(err),
				)
			}
		} else {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "User not included in synced users list",
				mlog.String("remote_id", remote.RemoteId),
				mlog.String("channel_id", channelID),
				mlog.String("user_id", userID),
				mlog.Int("change_time", int(changeTime)),
			)
		}
	}
	err = scs.server.GetRemoteClusterService().SendMsg(ctx, msg, rc, callback)

	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to send membership change to remote",
			mlog.String("remote_id", remote.RemoteId),
			mlog.String("channel_id", channelID),
			mlog.String("user_id", userID),
			mlog.Bool("is_add", isAdd),
			mlog.Err(err),
		)

		// Will retry when remote comes back online
	}
}

// syncMembershipBatchToRemotes synchronizes a batch of membership changes with remote clusters.
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

		// Send message using the existing remote cluster framework
		payload, err := json.Marshal(syncMsg)
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
				if err := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(change.UserId, change.ChannelId, remote.RemoteId); err != nil {
					scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update user sync timestamp in batch",
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

			if err := scs.updateMembershipSyncCursor(syncMsg.ChannelId, remote.RemoteId, maxChangeTime, true); err != nil {
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
