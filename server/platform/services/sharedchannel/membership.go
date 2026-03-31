// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// isChannelMemberSyncEnabled checks if the feature flag is enabled and remote cluster service is available
func (scs *Service) isChannelMemberSyncEnabled() bool {
	featureFlagEnabled := scs.server.Config().FeatureFlags.EnableSharedChannelsMemberSync
	remoteClusterService := scs.server.GetRemoteClusterService()
	return featureFlagEnabled && remoteClusterService != nil
}

// NotifyMembershipChanged is called when users are added or removed from a shared channel.
// It triggers a sync for the channel so that membership changes are picked up from
// ChannelMemberHistory at sync time, following the same pattern as posts and reactions.
// originRemoteID identifies the remote that initiated the change, so it can be skipped
// during sync to prevent echo-back.
func (scs *Service) NotifyMembershipChanged(channelID string, originRemoteID string) {
	if !scs.isChannelMemberSyncEnabled() {
		return
	}
	task := newSyncTask(channelID, "", "", nil, nil)
	task.originRemoteID = originRemoteID
	task.schedule = time.Now().Add(NotifyMinimumDelay)
	scs.addTask(task)
}

// ForceMembershipSyncForRemote triggers a sync for all channels shared with the specified remote.
// Called when a remote comes back online to catch up on any membership changes that occurred
// while it was offline. The sync pipeline will read ChannelMemberHistory using the
// LastMembersSyncAt cursor to detect both additions and removals.
func (scs *Service) ForceMembershipSyncForRemote(rc *model.RemoteCluster) {
	if !scs.isChannelMemberSyncEnabled() {
		return
	}

	opts := model.SharedChannelRemoteFilterOpts{
		RemoteId: rc.RemoteId,
	}
	scrs, err := scs.server.GetStore().SharedChannel().GetRemotes(0, 999999, opts)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to fetch shared channel remotes for membership sync",
			mlog.String("remote", rc.DisplayName),
			mlog.String("remoteId", rc.RemoteId),
			mlog.Err(err),
		)
		return
	}

	for _, scr := range scrs {
		scs.NotifyChannelChanged(scr.ChannelId)
	}
}
