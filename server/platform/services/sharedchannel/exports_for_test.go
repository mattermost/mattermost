// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestableMaxUsersPerSync allows tests to control batch size without modifying the constant
var TestableMaxUsersPerSync = MaxUsersPerSync

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

	// Ensure rc is valid
	if rc.RemoteId == "" {
		rc.RemoteId = model.NewId()
	}
	if rc.SiteURL == "" {
		rc.SiteURL = "http://example.com"
	}
	if rc.Token == "" {
		rc.Token = model.NewId()
	}
	if rc.RemoteToken == "" {
		rc.RemoteToken = model.NewId()
	}

	isShortMode := testing.Short()
	logLevel := mlog.LvlSharedChannelServiceDebug
	logMessage := "running in normal mode with DB"
	if isShortMode {
		logMessage = "running in short mode"
	}
	scs.server.Log().Log(logLevel, "ExtractUsersFromSyncForTest "+logMessage)

	// Get users based on the test mode
	var users []*model.User

	options := &model.UserGetOptions{
		Page:    0,
		PerPage: 100,
		Active:  true,
	}

	// In normal mode, use cursor-based filtering
	if !isShortMode {
		options.UpdatedAfter = rc.LastGlobalUserSyncAt
	}

	// Collect all eligible users
	for {
		batchUsers, batchErr := scs.server.GetStore().User().GetAllProfiles(options)
		if batchErr != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error fetching users",
				mlog.String("remote_id", rc.RemoteId),
				mlog.Err(batchErr),
			)
			return sentUsers, batchErr
		}

		if len(batchUsers) == 0 {
			break
		}

		users = append(users, batchUsers...)
		options.Page++
	}

	// Track the highest timestamp for cursor updates in normal mode
	var latestProcessedTime int64 = rc.LastGlobalUserSyncAt

	// Process users with appropriate filtering based on mode
	userCount := 0
	for _, user := range users {
		if userCount >= TestableMaxUsersPerSync {
			break
		}

		// Skip users from the target remote in both modes
		if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
			continue
		}

		// In normal mode, perform cursor-based filtering
		if !isShortMode {
			// Calculate latest update time for this user
			latestUserUpdateTime := user.UpdateAt
			if user.LastPictureUpdate > latestUserUpdateTime {
				latestUserUpdateTime = user.LastPictureUpdate
			}

			// Skip if not updated since last sync
			if latestUserUpdateTime <= rc.LastGlobalUserSyncAt {
				continue
			}

			// Update cursor position for simulation
			if latestUserUpdateTime > latestProcessedTime {
				latestProcessedTime = latestUserUpdateTime
			}
		}

		// Add user to results
		sentUsers[user.Id] = user
		userCount++
	}

	// In normal mode, update the simulation cursor
	if !isShortMode && userCount > 0 {
		rc.LastGlobalUserSyncAt = latestProcessedTime

		// Log information about the simulation
		scs.server.Log().Log(logLevel, "ExtractUsersFromSyncForTest simulation",
			mlog.String("remote_id", rc.RemoteId),
			mlog.Int("initial_cursor", int(rc.LastGlobalUserSyncAt)),
			mlog.Int("simulated_new_cursor", int(latestProcessedTime)),
			mlog.Int("users_in_batch", userCount),
			mlog.Int("max_users_per_batch", TestableMaxUsersPerSync),
		)
	}

	return sentUsers, nil
}
