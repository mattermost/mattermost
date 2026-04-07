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

const (
	// Error IDs returned by the app layer that indicate an idempotent no-op.
	errIDAddUserToChannelFailed  = "api.channel.add_user.to.channel.failed.app_error"
	errIDSaveMemberExists        = "app.channel.save_member.exists.app_error"
	errIDGetChannelMemberMissing = "app.channel.get_member.missing.app_error"
)

// onReceiveMembershipChanges processes channel membership changes from a remote cluster.
// In the new model, the sender derives the authoritative net state from ChannelMemberHistory.
// Both processMemberAdd and processMemberRemove are idempotent:
//   - processMemberAdd ignores "already added" errors
//   - processMemberRemove ignores "not found" errors
//
// Out-of-order messages resolve naturally: if an old "add" arrives after a newer "remove",
// the sender's next sync cycle will send a corrective "remove" because the history shows the user left.
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

	// Process each change
	var failCount int

	for _, change := range syncMsg.MembershipChanges {
		if change.ChannelId != syncMsg.ChannelId {
			scs.server.Log().LogM(mlog.MlvlSharedChannelServiceWarn, "ChannelId mismatch in membership change",
				mlog.String("expected", syncMsg.ChannelId),
				mlog.String("got", change.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
			)
			failCount++
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
			processErr = scs.processMemberAdd(change, channel, rc, syncMsg)
		} else {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Removing user from channel from remote cluster",
				mlog.String("user_id", change.UserId),
				mlog.String("channel_id", change.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
			)
			processErr = scs.processMemberRemove(change, rc)
		}

		if processErr != nil {
			scs.server.Log().LogM(mlog.MlvlSharedChannelServiceError, "Failed to process membership change",
				mlog.String("user_id", change.UserId),
				mlog.String("channel_id", change.ChannelId),
				mlog.String("remote_id", rc.RemoteId),
				mlog.Bool("is_add", change.IsAdd),
				mlog.Err(processErr),
			)
			failCount++
			continue
		}
	}

	if failCount > 0 {
		scs.server.Log().LogM(mlog.MlvlSharedChannelServiceWarn, "Some membership changes failed",
			mlog.String("channel_id", syncMsg.ChannelId),
			mlog.Int("total", len(syncMsg.MembershipChanges)),
			mlog.Int("failed", failCount),
		)
	}

	return nil
}

// processMemberAdd handles adding a user to a channel
func (scs *Service) processMemberAdd(change *model.MembershipChangeMsg, channel *model.Channel, rc *model.RemoteCluster, syncMsg *model.SyncMsg) error {
	rctx := request.EmptyContext(scs.server.Log())
	var user *model.User
	var err error

	// First try to upsert user from sync message (mirrors mention scenario)
	if userProfile, exists := syncMsg.Users[change.UserId]; exists {
		user, err = scs.upsertSyncUser(rctx, userProfile, channel, rc)
		if err != nil {
			return fmt.Errorf("cannot upsert user for channel add: %w", err)
		}
	} else {
		// Fallback to existing lookup for users not in sync message
		user, err = scs.server.GetStore().User().Get(rctx.Context(), change.UserId)
		if err != nil {
			return fmt.Errorf("cannot get user for channel add: %w", err)
		}
	}

	if user.GetRemoteID() != rc.RemoteId {
		return fmt.Errorf("membership add sync failed: %w", ErrRemoteIDMismatch)
	}

	// Check user permissions for private channels
	if channel.Type == model.ChannelTypePrivate {
		// Add user to team if needed for private channel
		if appErr := scs.app.AddUserToTeamByTeamId(rctx, channel.TeamId, user); appErr != nil {
			return fmt.Errorf("cannot add user to team for private channel: %w", appErr)
		}
	}

	// Use the app layer to add the user to the channel
	// Skip team member check (true) since we already handled team membership above
	_, appErr := scs.app.AddUserToChannel(rctx, user, channel, true)
	if appErr != nil {
		// Skip "already added" errors — idempotent
		if appErr.Id != errIDAddUserToChannelFailed &&
			appErr.Id != errIDSaveMemberExists {
			return fmt.Errorf("cannot add user to channel: %w", appErr)
		}
	}

	return nil
}

// processMemberRemove handles removing a user from a channel
func (scs *Service) processMemberRemove(change *model.MembershipChangeMsg, rc *model.RemoteCluster) error {
	// Get channel so we can use app layer methods properly
	channel, err := scs.server.GetStore().Channel().Get(change.ChannelId, true)
	if err != nil {
		scs.server.Log().LogM(mlog.MlvlSharedChannelServiceWarn, "Cannot find channel for member removal",
			mlog.String("channel_id", change.ChannelId),
			mlog.String("user_id", change.UserId),
			mlog.Err(err),
		)
		return nil // channel might be deleted, nothing to do
	}

	rctx := request.EmptyContext(scs.server.Log())
	user, userErr := scs.server.GetStore().User().Get(rctx.Context(), change.UserId)
	if userErr != nil {
		return fmt.Errorf("cannot get user for channel remove: %w", userErr)
	}
	if user.GetRemoteID() != rc.RemoteId {
		return fmt.Errorf("membership remove sync failed: %w", ErrRemoteIDMismatch)
	}

	// Use the app layer's remove user method
	appErr := scs.app.RemoveUserFromChannel(rctx, change.UserId, "", channel)
	if appErr != nil {
		// Ignore "not found" errors - the user might already be removed
		if appErr.Id == errIDGetChannelMemberMissing {
			return nil
		}
		return fmt.Errorf("cannot remove user from channel: %w", appErr)
	}

	return nil
}
