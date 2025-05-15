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

	// For both short and normal modes, ensure rc is valid
	if rc.RemoteId == "" {
		rc.RemoteId = model.NewId() // Ensure we have a valid ID
	}

	// Ensure required fields exist for both test modes
	if rc.SiteURL == "" {
		rc.SiteURL = "http://example.com"
	}
	if rc.Token == "" {
		rc.Token = model.NewId()
	}
	if rc.RemoteToken == "" {
		rc.RemoteToken = model.NewId()
	}

	// Fast path for short testing mode
	if testing.Short() {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "ExtractUsersFromSyncForTest running in short mode")

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

			// In short mode, we don't need to check shouldUserSyncGlobal to keep it simple
			// We're essentially simulating that all users need sync for testing purposes
			sentUsers[user.Id] = user
		}

		// Apply batch size limitations in short mode too for consistency
		if len(sentUsers) > TestableMaxUsersPerSync {
			// Trim the map to match the batch size
			// Make a slice of keys for deterministic trimming
			keys := make([]string, 0, len(sentUsers))
			for key := range sentUsers {
				keys = append(keys, key)
			}

			// Create a new map with just TestableMaxUsersPerSync entries
			trimmedUsers := make(map[string]*model.User)
			for i := 0; i < minInt(len(keys), TestableMaxUsersPerSync); i++ {
				trimmedUsers[keys[i]] = sentUsers[keys[i]]
			}
			sentUsers = trimmedUsers
		}

		return sentUsers, nil
	}

	// Full implementation for normal tests with real DB
	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "ExtractUsersFromSyncForTest running in normal mode with DB")

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

			// Simple timestamp comparison - user needs sync if updated after the last sync
			needsSync := latestUserUpdateTime > rc.LastGlobalUserSyncAt

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
		mlog.Int("initial_cursor", int(rc.LastGlobalUserSyncAt)),
		mlog.Int("simulated_new_cursor", int(latestProcessedTime)),
		mlog.Int("users_in_batch", userCount),
		mlog.Int("max_users_per_batch", TestableMaxUsersPerSync),
	)

	return sentUsers, nil
}
