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
	// Debug logging: Start of membership add process
	scs.PostMembershipSyncDebugMessage(fmt.Sprintf("🚀 SHARED CHANNEL: Starting processMemberAdd - user_id=%s, channel_id=%s, channel_type=%s, remote_id=%s",
		change.UserId, change.ChannelId, channel.Type, rc.RemoteId))

	// Get the user if they exist
	user, err := scs.server.GetStore().User().Get(request.EmptyContext(scs.server.Log()).Context(), change.UserId)
	if err != nil {
		scs.PostMembershipSyncDebugMessage(fmt.Sprintf("❌ SHARED CHANNEL: Failed to get user - user_id=%s, channel_id=%s, err=%v",
			change.UserId, change.ChannelId, err))
		return fmt.Errorf("cannot get user for channel add: %w", err)
	}

	// Debug logging: Got user successfully
	scs.PostMembershipSyncDebugMessage(fmt.Sprintf("✓ SHARED CHANNEL: Got user successfully - user_id=%s, username=%s, is_remote=%t, remote_id=%s",
		user.Id, user.Username, user.IsRemote(), user.GetRemoteID()))

	// Check user permissions for private channels
	if channel.Type == model.ChannelTypePrivate {
		// Debug logging: Processing private channel membership
		scs.PostMembershipSyncDebugMessage(fmt.Sprintf("🔒 SHARED CHANNEL: Processing PRIVATE channel - user_id=%s, channel_id=%s, team_id=%s",
			user.Id, channel.Id, channel.TeamId))

		// Add user to team if needed for private channel
		rctx := request.EmptyContext(scs.server.Log())
		appErr := scs.app.AddUserToTeamByTeamId(rctx, channel.TeamId, user)
		if appErr != nil {
			scs.PostMembershipSyncDebugMessage(fmt.Sprintf("❌ SHARED CHANNEL: Failed to add user to team - user_id=%s, team_id=%s, err=%v",
				user.Id, channel.TeamId, appErr))
			return fmt.Errorf("cannot add user to team for private channel: %w", appErr)
		}

		// Debug logging: Added user to team successfully
		scs.PostMembershipSyncDebugMessage(fmt.Sprintf("✓ SHARED CHANNEL: Added user to team successfully - user_id=%s, team_id=%s",
			user.Id, channel.TeamId))
	}

	// Debug logging: About to call AddUserToChannel
	scs.PostMembershipSyncDebugMessage(fmt.Sprintf("📞 SHARED CHANNEL: About to call AddUserToChannel - user_id=%s, channel_id=%s, skip_team_check=true",
		user.Id, channel.Id))

	// Use the standard method - ACP checks now handle remote users gracefully
	rctx := request.EmptyContext(scs.server.Log())
	_, appErr := scs.app.AddUserToChannel(rctx, user, channel, true)
	if appErr != nil {
		// Debug logging: AddUserToChannel failed
		scs.PostMembershipSyncDebugMessage(fmt.Sprintf("❌ SHARED CHANNEL: AddUserToChannel FAILED - user_id=%s, channel_id=%s, err=%v, err_id=%s",
			user.Id, channel.Id, appErr, appErr.Id))

		// Skip "already added" errors
		if appErr.Error() != "api.channel.add_user.to_channel.failed.app_error" &&
			!strings.Contains(appErr.Error(), "channel_member_exists") {
			scs.PostMembershipSyncDebugMessage(fmt.Sprintf("💥 SHARED CHANNEL: AddUserToChannel FATAL ERROR - user_id=%s, channel_id=%s, err=%v",
				user.Id, channel.Id, appErr))
			return fmt.Errorf("cannot add user to channel: %w", appErr)
		}
		// User is already in the channel, which is fine
		scs.PostMembershipSyncDebugMessage(fmt.Sprintf("⚠️  SHARED CHANNEL: User already in channel (ignoring) - user_id=%s, channel_id=%s",
			user.Id, channel.Id))
	} else {
		// Debug logging: AddUserToChannel succeeded
		scs.PostMembershipSyncDebugMessage(fmt.Sprintf("✅ SHARED CHANNEL: AddUserToChannel SUCCESS - user_id=%s, channel_id=%s",
			user.Id, channel.Id))
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

// PostMembershipSyncDebugMessage posts a debug system message to track membership sync execution
// Posts to Town Square channel to ensure visibility even when no shared channels exist
func (scs *Service) PostMembershipSyncDebugMessage(message string) {
	if scs.app == nil {
		return
	}

	// Try to find Town Square channel (default channel that should always exist)
	// Get all teams and try to find Town Square in any team
	teams, err := scs.server.GetStore().Team().GetAll()
	if err != nil || len(teams) == 0 {
		return
	}

	// Use the first team's Town Square channel
	team := teams[0]
	townSquareChannel, err := scs.server.GetStore().Channel().GetByName(team.Id, model.DefaultChannelName, true)
	if err != nil {
		return
	}

	// Find a system admin user to post as
	adminUsersMap, err := scs.server.GetStore().User().GetSystemAdminProfiles()
	if err != nil || len(adminUsersMap) == 0 {
		return
	}

	// Get the first admin user from the map
	var adminUser *model.User
	for _, user := range adminUsersMap {
		adminUser = user
		break
	}
	if adminUser == nil {
		return
	}

	post := &model.Post{
		ChannelId: townSquareChannel.Id,
		UserId:    adminUser.Id,
		Message:   message,
		Type:      model.PostTypeSystemGeneric,
		CreateAt:  model.GetMillis(),
	}

	ctx := request.EmptyContext(scs.server.Log())
	_, appErr := scs.app.CreatePost(ctx, post, townSquareChannel, model.CreatePostFlags{})
	if appErr != nil {
		scs.server.Log().Warn("Failed to post membership sync debug message", mlog.String("channel_id", townSquareChannel.Id), mlog.Err(appErr))
	}
}
