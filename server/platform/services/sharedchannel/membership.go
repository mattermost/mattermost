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

// HandleMembershipChange is called when users are added or removed from a shared channel.
// It creates a task to notify all remote clusters about the membership change.
func (scs *Service) HandleMembershipChange(channelID, userID string, isAdd bool, remoteID string) {
	if rcs := scs.server.GetRemoteClusterService(); rcs == nil {
		return
	}

	// Create membership change info
	syncMsg := model.NewSyncMsg(channelID)
	syncMsg.MembershipInfo = &model.MembershipChangeMsg{
		ChannelId:  channelID,
		UserId:     userID,
		IsAdd:      isAdd,
		RemoteId:   remoteID, // which remote initiated this change
		ChangeTime: model.GetMillis(),
	}

	// Create and add task to the queue
	task := newSyncTask(channelID, userID, "", syncMsg, nil)
	task.schedule = time.Now().Add(NotifyMinimumDelay) // small delay to allow for batching
	scs.addTask(task)
}

// HandleMembershipBatchChange is called to process a batch of membership changes for a shared channel.
// It creates a task to notify all remote clusters about the batch membership changes.
func (scs *Service) HandleMembershipBatchChange(channelID string, userIDs []string, isAdd bool, remoteID string) {
	if rcs := scs.server.GetRemoteClusterService(); rcs == nil {
		return
	}

	if len(userIDs) == 0 {
		return
	}

	// Create timestamp for all changes in this batch
	changeTime := model.GetMillis()

	// Create batch membership change info
	batchInfo := &model.MembershipChangeBatchMsg{
		ChannelId:  channelID,
		RemoteId:   remoteID, // which remote initiated this change
		ChangeTime: changeTime,
		Changes:    make([]*model.MembershipChangeMsg, 0, len(userIDs)),
	}

	// Add each user to the batch
	for _, userID := range userIDs {
		batchInfo.Changes = append(batchInfo.Changes, &model.MembershipChangeMsg{
			ChannelId:  channelID,
			UserId:     userID,
			IsAdd:      isAdd,
			RemoteId:   remoteID,
			ChangeTime: changeTime,
		})
	}

	// Create sync message with the batch info
	syncMsg := model.NewSyncMsg(channelID)
	syncMsg.MembershipBatchInfo = batchInfo

	// Create and add task to the queue
	task := newSyncTask(channelID, "", "", syncMsg, nil)
	task.schedule = time.Now().Add(NotifyMinimumDelay) // small delay to allow for batching
	scs.addTask(task)

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Queued batch membership change",
		mlog.String("channel_id", channelID),
		mlog.Int("user_count", len(userIDs)),
		mlog.Bool("is_add", isAdd),
	)
}

// SyncAllChannelMembers synchronizes all channel members to a specific remote.
// This is typically called when a channel is first shared with a remote cluster.
func (scs *Service) SyncAllChannelMembers(channelID string, remoteID string) error {
	// Verify the channel exists and is shared
	if _, err := scs.server.GetStore().SharedChannel().Get(channelID); err != nil {
		return fmt.Errorf("failed to get shared channel %s: %w", channelID, err)
	}

	// Get the remote to ensure it exists
	remote, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err != nil {
		return fmt.Errorf("failed to get remote for channel %s: %w", channelID, err)
	}

	// Use cursor-based pagination to handle channels with many members
	// First, get the latest cursor position
	lastSyncAt := remote.LastMembersSyncAt
	maxPerPage := 200 // Process in reasonable batches
	
	// Process members incrementally with cursor-based pagination
	var allMembers model.ChannelMembers
	var processedCount int
	for {
		members, err := scs.server.GetStore().Channel().GetMembersAfterTimestamp(channelID, lastSyncAt, maxPerPage)
		if err != nil {
			return fmt.Errorf("failed to get members for channel %s: %w", channelID, err)
		}

		if len(members) == 0 {
			break // No more members to process
		}

		// Add to our collection
		allMembers = append(allMembers, members...)
		processedCount += len(members)

		// Update cursor for next page
		lastMember := members[len(members)-1]
		lastSyncAt = lastMember.LastUpdateAt

		// Log progress when processing large channels
		if processedCount % 1000 == 0 {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Processing channel members in batches",
				mlog.String("channel_id", channelID),
				mlog.String("remote_id", remoteID),
				mlog.Int("processed_so_far", processedCount),
			)
		}

		if len(members) < maxPerPage {
			break // Last page
		}
	}
	
	// Use allMembers instead of single-call members
	members := allMembers
	
	if len(members) == 0 {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "No members to sync for channel",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
		)
		return nil
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Syncing all channel members",
		mlog.String("channel_id", channelID),
		mlog.String("remote_id", remoteID),
		mlog.Int("member_count", len(members)),
	)

	// Get batch size from config
	batchSize := scs.GetMemberSyncBatchSize()

	// For small channels, queue individual membership changes
	if len(members) <= batchSize {
		return scs.syncMembersIndividually(channelID, remoteID, members, remote)
	}

	// For larger channels, use batch processing
	return scs.syncMembersInBatches(channelID, remoteID, members, remote)
}

// shouldSyncUser determines if a user should be synchronized to remote clusters.
// Returns false for bots and system admins.
//
// System admins are excluded because they might have elevated permissions that should
// not be replicated to remote instances. Bots are excluded because they typically
// operate only on the local instance and don't need to be synced to remotes.
// This filtering ensures that only regular users and guests are synchronized across
// shared channels.
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

	// Skip system users and bots as they might not be needed on the remote
	if user.IsBot || user.IsSystemAdmin() {
		return user, false
	}

	return user, true
}

// syncMembersIndividually processes each member individually
// This is more efficient for small channels
func (scs *Service) syncMembersIndividually(channelID, remoteID string, members model.ChannelMembers, remote *model.SharedChannelRemote) error {
	// Process each member
	syncTime := model.GetMillis()
	validMemberCount := 0

	for _, member := range members {
		// Check if user should be synced
		_, shouldSync := scs.shouldSyncUser(channelID, member.UserId)
		if !shouldSync {
			continue
		}

		// Queue membership change for this user (isAdd=true)
		scs.HandleMembershipChange(channelID, member.UserId, true, "")
		validMemberCount++

		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Queued channel member sync",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
			mlog.String("user_id", member.UserId),
		)
	}

	// Update the LastMembersSyncAt for this remote
	err := scs.server.GetStore().SharedChannel().UpdateRemoteLastSyncAt(remote.Id, syncTime)
	if err != nil {
		return fmt.Errorf("failed to update LastMembersSyncAt for remote %s: %w", remote.Id, err)
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Channel member sync queued successfully",
		mlog.String("channel_id", channelID),
		mlog.String("remote_id", remoteID),
		mlog.Int("member_count", validMemberCount),
	)

	return nil
}

// syncMembersInBatches processes members in batches for greater efficiency
// This is better for channels with many members
func (scs *Service) syncMembersInBatches(channelID, remoteID string, members model.ChannelMembers, remote *model.SharedChannelRemote) error {
	syncTime := model.GetMillis()
	validMembers := make([]string, 0, len(members))

	// First pass - collect valid member IDs
	for _, member := range members {
		// Check if user should be synced
		_, shouldSync := scs.shouldSyncUser(channelID, member.UserId)
		if !shouldSync {
			continue
		}

		validMembers = append(validMembers, member.UserId)
	}

	// Get batch size from config
	batchSize := scs.GetMemberSyncBatchSize()

	// Process in batches of the configured size
	totalBatches := (len(validMembers) + batchSize - 1) / batchSize

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Processing channel members in batches",
		mlog.String("channel_id", channelID),
		mlog.String("remote_id", remoteID),
		mlog.Int("valid_member_count", len(validMembers)),
		mlog.Int("batch_size", batchSize),
		mlog.Int("total_batches", totalBatches),
	)

	for i := 0; i < len(validMembers); i += batchSize {
		end := i + batchSize
		if end > len(validMembers) {
			end = len(validMembers)
		}

		// Create a batch of members
		batchMembers := validMembers[i:end]

		// Use the batch handling function to queue the changes
		scs.HandleMembershipBatchChange(channelID, batchMembers, true, remoteID)

		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Queued membership batch",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
			mlog.Int("batch", i/batchSize+1),
			mlog.Int("total_batches", totalBatches),
			mlog.Int("batch_size", len(batchMembers)),
		)
	}

	// Update the LastMembersSyncAt for this remote
	err := scs.server.GetStore().SharedChannel().UpdateRemoteLastSyncAt(remote.Id, syncTime)
	if err != nil {
		return fmt.Errorf("failed to update LastMembersSyncAt for remote %s: %w", remote.Id, err)
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Channel member batch sync queued",
		mlog.String("channel_id", channelID),
		mlog.String("remote_id", remoteID),
		mlog.Int("total_batches", totalBatches),
		mlog.Int("member_count", len(validMembers)),
	)

	return nil
}

// processMembershipBatch handles a batch of membership changes efficiently
func (scs *Service) processMembershipBatch(channelID string, memberIDs []string, remoteID string, syncTime int64) error {
	if len(memberIDs) == 0 {
		return nil
	}

	// Create membership batch message
	changeBatch := &model.MembershipChangeBatchMsg{
		ChannelId:  channelID,
		RemoteId:   scs.GetMyClusterId(),
		ChangeTime: syncTime,
		Changes:    make([]*model.MembershipChangeMsg, 0, len(memberIDs)),
	}

	// Add all members to the batch
	for _, userID := range memberIDs {
		changeBatch.Changes = append(changeBatch.Changes, &model.MembershipChangeMsg{
			ChannelId:  channelID,
			UserId:     userID,
			IsAdd:      true, // Always adding members in initial sync
			RemoteId:   scs.GetMyClusterId(),
			ChangeTime: syncTime,
		})
	}

	// Create a sync message for the batch
	syncMsg := model.NewSyncMsg(channelID)
	syncMsg.MembershipBatchInfo = changeBatch

	// Get the remote cluster
	rc, err := scs.server.GetRemoteClusterService().GetRemoteCluster(remoteID)
	if err != nil {
		return fmt.Errorf("failed to get remote cluster for batch membership sync: %w", err)
	}

	// Send message using the existing remote cluster framework
	payload, err := json.Marshal(syncMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal sync message: %w", err)
	}

	msg := model.RemoteClusterMsg{
		Id:       model.NewId(),
		Topic:    TopicChannelMembershipBatch,
		CreateAt: model.GetMillis(),
		Payload:  payload,
	}

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	var sendErr error
	// Define a callback function of type remotecluster.SendMsgResultFunc
	callback := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
		if err != nil {
			sendErr = fmt.Errorf("error sending batch membership changes to remote: %w", err)
			return
		}

		if resp != nil && resp.Err != "" {
			sendErr = fmt.Errorf("remote error when processing batch membership changes: %s", resp.Err)
			return
		}

		// Record successful sync for all users in the batch
		for _, userID := range memberIDs {
			if err := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(userID, channelID, remoteID); err != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update membership sync timestamp",
					mlog.String("remote_id", remoteID),
					mlog.String("channel_id", channelID),
					mlog.String("user_id", userID),
					mlog.Err(err),
				)
				// Continue with other users despite the error
			}
		}
	}
	err = scs.server.GetRemoteClusterService().SendMsg(ctx, msg, rc, callback)

	if err != nil {
		return fmt.Errorf("failed to send batch membership changes: %w", err)
	}

	if sendErr != nil {
		return sendErr
	}

	return nil
}

// processMembershipChange processes a channel membership change task.
// It determines which remotes should receive the update and creates tasks for each.
func (scs *Service) processMembershipChange(syncMsg *model.SyncMsg) {
	if syncMsg.MembershipInfo == nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Invalid membership change task - missing MembershipInfo",
			mlog.String("channel_id", syncMsg.ChannelId),
		)
		return
	}

	memberInfo := syncMsg.MembershipInfo

	// Get the shared channel (to verify it exists)
	_, err := scs.server.GetStore().SharedChannel().Get(syncMsg.ChannelId)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get shared channel for membership change",
			mlog.String("channel_id", syncMsg.ChannelId),
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

	// Sync to all remotes except the one that initiated this change
	for _, remote := range remotes {
		// Skip the remote that initiated this change to prevent loops
		if remote.RemoteId == memberInfo.RemoteId {
			continue
		}

		// Create a task for each remote
		scs.syncMembershipToRemote(syncMsg.ChannelId, memberInfo.UserId, memberInfo.IsAdd, remote, memberInfo.ChangeTime)
	}
}

// syncMembershipToRemote synchronizes a channel membership change with a remote cluster.
func (scs *Service) syncMembershipToRemote(channelID, userID string, isAdd bool, remote *model.SharedChannelRemote, changeTime int64) {
	// Get the remote cluster
	rc, err := scs.server.GetRemoteClusterService().GetRemoteCluster(remote.RemoteId)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get remote cluster for membership sync",
			mlog.String("remote_id", remote.RemoteId),
			mlog.String("channel_id", channelID),
			mlog.Err(err),
		)
		return
	}

	// Get the user to ensure they exist
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

	// Check if user needs to be synced to the remote
	doSync, _, err := scs.shouldUserSync(user, channelID, rc) // Ignoring doSyncImage as it's not needed here
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to check if user should be synced",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remote.RemoteId),
			mlog.Err(err),
		)
		// Continue anyway since we're more concerned with the membership change
	}

	if doSync {
		// Queue user profile sync using the existing task system
		userMsg := model.NewSyncMsg(channelID)
		userMsg.Users = map[string]*model.User{user.Id: user}

		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Queueing user profile sync as part of membership change",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remote.RemoteId),
		)

		scs.addTask(newSyncTask(channelID, user.Id, remote.RemoteId, userMsg, nil))
	}

	// Create the membership change message
	membershipMsg := model.NewSyncMsg(channelID)
	membershipMsg.MembershipInfo = &model.MembershipChangeMsg{
		ChannelId:  channelID,
		UserId:     userID,
		IsAdd:      isAdd,
		RemoteId:   scs.GetMyClusterId(),
		ChangeTime: changeTime,
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

	// Define a callback function of type remotecluster.SendMsgResultFunc
	callback := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error sending membership change to remote",
				mlog.String("remote", remote.RemoteId),
				mlog.String("channel_id", channelID),
				mlog.String("user_id", userID),
				mlog.Bool("is_add", isAdd),
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
				mlog.String("remote_error", resp.Err),
			)
			return
		}

		// Record successful sync
		err = scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(userID, channelID, remote.RemoteId)
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update membership sync timestamp",
				mlog.String("remote_id", remote.RemoteId),
				mlog.String("channel_id", channelID),
				mlog.String("user_id", userID),
				mlog.Err(err),
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