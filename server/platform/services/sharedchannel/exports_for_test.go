// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// Export constants for testing
var MaxUsersPerSyncForTesting = MaxUsersPerSync

// TestableMaxUsersPerSync allows tests to control batch size without modifying the constant
var TestableMaxUsersPerSync = MaxUsersPerSync

// SyncData represents a data container for testing sync operations
type SyncData struct {
	sd *syncData
}

// GetUsers returns the users map from sync data for testing
func (s *SyncData) GetUsers() map[string]*model.User {
	if s.sd == nil {
		return nil
	}
	return s.sd.users
}

// makeKey creates a unique key for a remote cluster and channel combination
func makeKey(channelID, remoteID string) string {
	return channelID + remoteID
}

// ExtractUsersFromSyncForTest processes a sync operation and gathers the users
func ExtractUsersFromSyncForTest(scs *Service, rc *model.RemoteCluster) (map[string]*model.User, error) {
	// Gather users that would be sent for testing
	sentUsers := make(map[string]*model.User)

	if rc == nil {
		return sentUsers, nil
	}

	// Make sure the remote cluster is considered online for testing
	if !rc.IsOnline() {
		rc.LastPingAt = model.GetMillis() // Make it appear online
	}

	// Get all active users
	options := &model.UserGetOptions{
		Page:    0,
		PerPage: 100, // Process in batches
		Active:  true,
	}

	// Initialize user sync data cache
	syncData := &userSyncData{
		userSyncMap: make(map[string]map[string]int64),
		initialized: false,
	}

	// Fetch all user sync records for the target remote cluster in a single query
	allSyncRecords, err := scs.server.GetStore().SharedChannel().GetUsersByRemote(rc.RemoteId)
	if err != nil && !isNotFoundError(err) {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error fetching user sync records",
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(err),
		)
	} else {
		// Build the user sync map
		for _, record := range allSyncRecords {
			if _, ok := syncData.userSyncMap[record.UserId]; !ok {
				syncData.userSyncMap[record.UserId] = make(map[string]int64)
			}
			syncData.userSyncMap[record.UserId][record.ChannelId] = record.LastSyncAt
		}
		syncData.initialized = true
	}

	// We may need to page through all users
	for {
		users, err := scs.server.GetStore().User().GetAllProfiles(options)
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error fetching users for global sync",
				mlog.String("remote_id", rc.RemoteId),
				mlog.Err(err),
			)
			return sentUsers, err
		}

		if len(users) == 0 {
			break
		}

		// Add users to sync data, but only if they need syncing
		for _, user := range users {
			// Calculate latest update time for this user (profile or picture)
			latestUserUpdateTime := user.UpdateAt
			if user.LastPictureUpdate > latestUserUpdateTime {
				latestUserUpdateTime = user.LastPictureUpdate
			}

			// Skip users that haven't been updated since our last sync and
			// users from the target remote cluster
			if latestUserUpdateTime <= rc.LastGlobalUserSyncAt ||
				(user.RemoteId != nil && *user.RemoteId == rc.RemoteId) {
				continue
			}

			// Check if this user needs syncing (additional check with individual sync records)
			needsSync, err := scs.shouldUserSyncGlobal(user, rc, syncData)
			if err != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error checking if user needs sync",
					mlog.String("user_id", user.Id),
					mlog.String("remote_id", rc.RemoteId),
					mlog.Err(err),
				)
				continue
			}

			if !needsSync {
				continue
			}

			// Add this user to our extracted list
			sentUsers[user.Id] = user
		}

		// Move to next page
		options.Page++
	}

	return sentUsers, nil
}

// Tasks returns the internal tasks map for testing
func (scs *Service) Tasks() map[string]syncTask {
	scs.mux.RLock()
	defer scs.mux.RUnlock()

	return scs.tasks
}

// IsSyncingForTesting checks if a sync task exists for the given remote cluster and channel
func (scs *Service) IsSyncingForTesting(rc *model.RemoteCluster, channelID string) bool {
	if rc == nil {
		return false
	}

	scs.mux.RLock()
	defer scs.mux.RUnlock()

	key := makeKey(channelID, rc.RemoteId)
	_, ok := scs.tasks[key]
	return ok
}

// SetSyncingForTesting adds a sync task for the given remote cluster and channel
func (scs *Service) SetSyncingForTesting(rc *model.RemoteCluster, channelID string) {
	if rc == nil {
		return
	}

	scs.mux.Lock()
	defer scs.mux.Unlock()

	key := makeKey(channelID, rc.RemoteId)
	scs.tasks[key] = syncTask{
		channelID: channelID,
		remoteID:  rc.RemoteId,
	}
}

// UnsetSyncingForTesting removes a sync task for the given remote cluster and channel
func (scs *Service) UnsetSyncingForTesting(rc *model.RemoteCluster, channelID string) {
	if rc == nil {
		return
	}

	scs.mux.Lock()
	defer scs.mux.Unlock()

	key := makeKey(channelID, rc.RemoteId)
	delete(scs.tasks, key)
}
