// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

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

	// Fast path for short testing mode
	if testing.Short() {
		// In short mode, just get users directly from the mock store
		// and do minimal processing
		users, err := scs.server.GetStore().User().GetAllProfiles(&model.UserGetOptions{
			Page:    0,
			PerPage: 100,
		})
		
		if err != nil {
			return nil, err
		}

		// Just filter out remote users and return
		for _, user := range users {
			// Skip users from the target remote cluster
			if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
				continue
			}
			sentUsers[user.Id] = user
		}
		
		return sentUsers, nil
	}

	// Full implementation for normal tests with real DB
	
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

	// Track the highest processed timestamp to update LastGlobalUserSyncAt
	var latestProcessedTime int64 = rc.LastGlobalUserSyncAt

	// Get all active users
	options := &model.UserGetOptions{
		Page:         0,
		PerPage:      100, // Process in batches
		Active:       true,
		UpdatedAfter: rc.LastGlobalUserSyncAt, // Only get users updated after the cursor
	}

	// Store users by update time for batched processing
	usersByUpdateTime := make(map[int64][]*model.User)
	var updateTimes []int64

	// First, collect all eligible users and organize them by update time
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

		// Process users but don't add to sentUsers yet - just collect them
		for _, user := range users {
			// Skip users from the target remote cluster
			if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
				continue
			}

			// Calculate latest update time for this user (profile or picture)
			latestUserUpdateTime := user.UpdateAt
			if user.LastPictureUpdate > latestUserUpdateTime {
				latestUserUpdateTime = user.LastPictureUpdate
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

			// Add user to the map by update time
			if _, exists := usersByUpdateTime[latestUserUpdateTime]; !exists {
				usersByUpdateTime[latestUserUpdateTime] = []*model.User{}
				updateTimes = append(updateTimes, latestUserUpdateTime)
			}
			usersByUpdateTime[latestUserUpdateTime] = append(usersByUpdateTime[latestUserUpdateTime], user)
		}

		// Move to next page
		options.Page++
	}

	// Sort update times (not strictly necessary but helps with predictability)
	// Simple sort for int64 slice
	for i := 0; i < len(updateTimes); i++ {
		for j := i + 1; j < len(updateTimes); j++ {
			if updateTimes[i] > updateTimes[j] {
				updateTimes[i], updateTimes[j] = updateTimes[j], updateTimes[i]
			}
		}
	}

	// Process users in batches, simulating the cursor updates
	userCount := 0
	for _, updateTime := range updateTimes {
		usersAtTime := usersByUpdateTime[updateTime]

		for _, user := range usersAtTime {
			// Skip users with update times <= current cursor position in tests
			latestUserUpdateTime := user.UpdateAt
			if user.LastPictureUpdate > latestUserUpdateTime {
				latestUserUpdateTime = user.LastPictureUpdate
			}

			if latestUserUpdateTime <= rc.LastGlobalUserSyncAt {
				continue // Skip users that wouldn't be included based on cursor
			}

			// Add user to the result set
			sentUsers[user.Id] = user
			userCount++

			// Update the latestProcessedTime
			if latestUserUpdateTime > latestProcessedTime {
				latestProcessedTime = latestUserUpdateTime
			}

			// If we've reached the batch size, simulate a cursor update
			if userCount >= TestableMaxUsersPerSync {
				// Simulate updating the cursor in the test code
				rc.LastGlobalUserSyncAt = latestProcessedTime
				break
			}
		}

		if userCount >= TestableMaxUsersPerSync {
			break // Stop after the first batch
		}
	}

	// Log information about the simulation
	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "ExtractUsersFromSyncForTest simulation",
		mlog.String("remote_id", rc.RemoteId),
		mlog.Int("initial_cursor", rc.LastGlobalUserSyncAt),
		mlog.Int("simulated_new_cursor", latestProcessedTime),
		mlog.Int("users_in_batch", userCount),
		mlog.Int("max_users_per_batch", TestableMaxUsersPerSync),
	)

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
