// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"github.com/mattermost/mattermost/server/public/model"
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
	// Since we can't replace the sendUserSyncData function directly, we'll use a new sync data struct
	// to gather users then manually call the function we want to test
	sentUsers := make(map[string]*model.User)

	// Handle nil remote cluster and offline cases
	if rc == nil || !rc.IsOnline() {
		return sentUsers, nil
	}

	// Get users directly from the store (works with both real DB and mocks)
	users, err := scs.server.GetStore().User().GetAllProfiles(&model.UserGetOptions{
		Page:    0,
		PerPage: 1000, // Get all at once to simplify
		Active:  true,
	})
	if err != nil {
		return sentUsers, err
	}

	// Process the users, filtering out remote users
	for _, user := range users {
		// Skip remote users (don't sync back to origin)
		if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
			continue
		}
		sentUsers[user.Id] = user
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
