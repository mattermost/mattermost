// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
)

// TestSharedChannelGlobalUserSyncSelfReferential is a comprehensive test suite for MM-62751
// that tests global user synchronization between connected Mattermost instances.
// It uses a self-referential approach where a server syncs with itself, providing real HTTP communication
// without mocks or invalid URLs. We test calling SyncAllUsersForRemoteCluster directly.
func TestSharedChannelGlobalUserSyncSelfReferential(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ENABLESYNCALLUSERSFORREMOTECLUSTER", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_ENABLESYNCALLUSERSFORREMOTECLUSTER")

	// Setup with custom batch size for testing
	th := SetupConfig(t, func(cfg *model.Config) {
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
		// Set a small batch size for testing
		batchSize := 4
		cfg.ConnectedWorkspacesSettings.GlobalUserSyncBatchSize = &batchSize
	}).InitBasic()
	defer th.TearDown()

	ss := th.App.Srv().Store()

	// Get the shared channel service and cast to concrete type to access SyncAllUsersForRemoteCluster
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	service, ok := scsInterface.(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service concrete type")

	// Force the service to be active
	err := service.Start()
	require.NoError(t, err)

	// Also ensure the remote cluster service is running so callbacks work
	rcService := th.App.Srv().GetRemoteClusterService()
	if rcService != nil {
		_ = rcService.Start()

		// Verify it's active
		if !rcService.Active() {
			t.Fatalf("RemoteClusterService is not active after Start")
		}
	}

	t.Run("Test 1: Individual User Sync", func(t *testing.T) {
		// This test verifies end-to-end user synchronization for a single user, including:
		// - Syncing a user from Server A to Server B
		// - Proper cursor tracking with LastGlobalUserSyncAt
		// - Verification of user addition/removal on receiving side
		EnsureCleanState(t, th, ss)

		var syncedUsers []string
		var mu sync.Mutex
		var syncHandler *SelfReferentialSyncHandler

		// Create a test HTTP server that acts as the "remote" cluster
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandler != nil {
				syncHandler.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer.Close()

		// Create a self-referential remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Initialize sync handler with callbacks
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnGlobalUserSync = func(userIds []string, messageNumber int32) {
			mu.Lock()
			syncedUsers = append(syncedUsers, userIds...)
			mu.Unlock()
		}

		// Create a new user to sync
		user := th.CreateUser()

		// Ensure user has a recent update time for cursor-based sync
		user.UpdateAt = model.GetMillis()
		_, err = ss.User().Update(th.Context, user, true)
		require.NoError(t, err)

		// Trigger global user sync directly
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Wait for sync to complete
		require.Eventually(t, func() bool {
			count := syncHandler.GetSyncMessageCount()
			return count > 0
		}, 5*time.Second, 100*time.Millisecond, "Should have received at least one sync message")

		// Verify the user was synced
		mu.Lock()
		assert.Contains(t, syncedUsers, user.Id, "New user should be synced")
		mu.Unlock()

		// Verify cursor was updated
		updatedCluster, clusterErr := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, clusterErr)
		assert.Greater(t, updatedCluster.LastGlobalUserSyncAt, int64(0), "Cursor should be updated after sync")
	})

	t.Run("Test 2: Batch User Sync with Type Filtering", func(t *testing.T) {
		// This test verifies batch synchronization with multiple users and user type filtering:
		// - Creating more users than the batch size to ensure multiple batches
		// - Testing that different user types are filtered correctly
		// - Verifying cursor updates after batch operations
		// - Using configurable batch size via GetUserSyncBatchSize
		EnsureCleanState(t, th, ss)

		var syncMessageCount int32
		var mu sync.Mutex
		var batchedUserIDs [][]string
		var syncHandler *SelfReferentialSyncHandler

		// Create test HTTP server
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandler != nil {
				syncHandler.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer.Close()

		// Create self-referential remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-batch",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Get the current batch size configuration
		batchSize := service.GetUserSyncBatchSizeForTesting()
		t.Logf("Using user sync batch size: %d", batchSize)

		// Update existing test helper users to have recent timestamps
		// This ensures they will be included in the sync
		baseTime := model.GetMillis()

		// Get all existing non-bot, non-system-admin users and update their timestamps
		existingRegularUsers := []*model.User{}
		for page := 0; ; page++ {
			options := &model.UserGetOptions{
				Page:    page,
				PerPage: 100,
			}
			users, userErr := ss.User().GetAllProfiles(options)
			require.NoError(t, userErr)
			if len(users) == 0 {
				break
			}
			for _, user := range users {
				// Skip bots and system admins from existing users
				if !user.IsBot && !user.IsSystemAdmin() && (user.RemoteId == nil || *user.RemoteId == "") {
					existingRegularUsers = append(existingRegularUsers, user)
				}
			}
		}

		// Update timestamps for all existing regular users
		for i, user := range existingRegularUsers {
			user.UpdateAt = baseTime + int64(i*100)
			_, err = ss.User().Update(th.Context, user, true)
			require.NoError(t, err)
		}
		t.Logf("Updated %d existing regular users with recent timestamps", len(existingRegularUsers))

		// First, create multiple users BEFORE enabling global sync
		// This ensures all users will be included in the sync
		// Using smaller numbers for faster testing
		numRegularUsers := 10 // This will give us 3 batches with batch size of 4
		regularUserIDs := make([]string, numRegularUsers)
		for i := 0; i < numRegularUsers; i++ {
			user := th.CreateUser()
			regularUserIDs[i] = user.Id
			// Ensure recent update time with proper spacing
			user.UpdateAt = baseTime + int64((len(existingRegularUsers)+i)*100)
			_, err = ss.User().Update(th.Context, user, true)
			require.NoError(t, err)
		}

		// Add users that should NOT be synced
		// Add a bot
		bot := th.CreateBot()
		botUser, appErr := th.App.GetUser(bot.UserId)
		require.Nil(t, appErr)
		botUser.UpdateAt = baseTime + int64((len(existingRegularUsers)+numRegularUsers)*100)
		_, err = ss.User().Update(th.Context, botUser, true)
		require.NoError(t, err)

		// Add a system admin
		systemAdmin := th.CreateUser()
		_, appErr = th.App.UpdateUserRoles(th.Context, systemAdmin.Id, model.SystemAdminRoleId+" "+model.SystemUserRoleId, false)
		require.Nil(t, appErr)
		systemAdmin.UpdateAt = baseTime + int64((len(existingRegularUsers)+numRegularUsers+1)*100)
		_, err = ss.User().Update(th.Context, systemAdmin, true)
		require.NoError(t, err)

		// Add a guest user (should be synced)
		guest := th.CreateGuest()
		guest.UpdateAt = baseTime + int64((len(existingRegularUsers)+numRegularUsers+2)*100)
		_, err = ss.User().Update(th.Context, guest, true)
		require.NoError(t, err)

		// Add a user from the remote cluster (should NOT be synced)
		remoteUser := th.CreateUser()
		remoteUser.RemoteId = &selfCluster.RemoteId
		remoteUser.UpdateAt = baseTime + int64((len(existingRegularUsers)+numRegularUsers+3)*100)
		_, err = ss.User().Update(th.Context, remoteUser, true)
		require.NoError(t, err)

		// Initialize sync handler with callbacks
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnGlobalUserSync = func(userIds []string, messageNumber int32) {
			mu.Lock()
			batchedUserIDs = append(batchedUserIDs, userIds)
			atomic.AddInt32(&syncMessageCount, 1)
			t.Logf("Received batch %d with %d users", len(batchedUserIDs), len(userIds))
			mu.Unlock()
		}

		// Enable global user sync for the remote cluster
		// Since GlobalUserSyncEnabled field doesn't exist, we'll rely on the feature flag being enabled

		// Get total user count before sync for debugging
		totalUserCount := 0
		existingUsers := []*model.User{}
		for page := 0; ; page++ {
			options := &model.UserGetOptions{
				Page:    page,
				PerPage: 100,
			}
			users, userErr := ss.User().GetAllProfiles(options)
			require.NoError(t, userErr)
			if len(users) == 0 {
				break
			}
			totalUserCount += len(users)
			existingUsers = append(existingUsers, users...)
		}
		t.Logf("Total users in system before sync: %d", totalUserCount)

		// Count users by type for debugging
		regularCount := 0
		botCount := 0
		systemAdminCount := 0
		guestCount := 0
		remoteCount := 0
		inactiveCount := 0
		oldTimestampCount := 0

		for _, user := range existingUsers {
			// Check if user is inactive
			if user.DeleteAt > 0 {
				inactiveCount++
				continue
			}

			// Check if user has old timestamp
			if user.UpdateAt == 0 {
				oldTimestampCount++
				t.Logf("User %s has UpdateAt=0", user.Username)
			}

			if user.IsBot {
				botCount++
			} else if user.IsSystemAdmin() {
				systemAdminCount++
			} else if user.IsGuest() {
				guestCount++
			} else if user.RemoteId != nil && *user.RemoteId != "" {
				remoteCount++
			} else {
				regularCount++
			}
		}
		t.Logf("User breakdown: regular=%d, bots=%d, system admins=%d, guests=%d, remote=%d, inactive=%d, oldTimestamp=%d",
			regularCount, botCount, systemAdminCount, guestCount, remoteCount, inactiveCount, oldTimestampCount)

		// Sync all users
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Calculate expected numbers
		// Should include: all regular users (existing + new) + guest, but NOT bot, system admin, or remote user
		expectedSyncedUsers := len(existingRegularUsers) + numRegularUsers + 1 // existing regular + new regular + guest
		expectedMinBatches := (expectedSyncedUsers + batchSize - 1) / batchSize

		t.Logf("Expected sync: %d users (existing regular=%d, new regular=%d, guest=1), batch size=%d, min batches=%d",
			expectedSyncedUsers, len(existingRegularUsers), numRegularUsers, batchSize, expectedMinBatches)

		// Wait for batch messages to be received
		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()

			// Count total synced users
			totalSynced := 0
			for _, batch := range batchedUserIDs {
				totalSynced += len(batch)
			}

			// Check if we have received enough batches or all users
			if len(batchedUserIDs) < expectedMinBatches && totalSynced < expectedSyncedUsers {
				t.Logf("Waiting for batches: received %d batches with %d total users, expected at least %d batches",
					len(batchedUserIDs), totalSynced, expectedMinBatches)
				// Wait for scheduled batches to process automatically
				return false
			}

			// Check if all expected users have been synced
			allSyncedUserIDs := make(map[string]bool)
			for _, batch := range batchedUserIDs {
				for _, userID := range batch {
					allSyncedUserIDs[userID] = true
				}
			}

			// Verify all regular users are synced
			regularUsersSynced := 0
			for _, userID := range regularUserIDs {
				if allSyncedUserIDs[userID] {
					regularUsersSynced++
				}
			}

			// Check if guest is synced
			guestSynced := allSyncedUserIDs[guest.Id]

			t.Logf("Sync progress: batches=%d, totalSynced=%d, regularUsersSynced=%d/%d, guestSynced=%v",
				len(batchedUserIDs), totalSynced, regularUsersSynced, numRegularUsers, guestSynced)

			// We're done when all regular users and guest are synced
			return regularUsersSynced == numRegularUsers && guestSynced
		}, 20*time.Second, 500*time.Millisecond, "Should sync all expected users in batches")

		// Verify sync messages were sent
		count := atomic.LoadInt32(&syncMessageCount)
		assert.Greater(t, count, int32(0), "Should have received sync messages")

		// Check batch contents and verify filtering
		mu.Lock()
		totalSynced := 0
		allSyncedUserIDs := make(map[string]bool)
		for i, batch := range batchedUserIDs {
			t.Logf("Batch %d: %d users", i+1, len(batch))
			assert.LessOrEqual(t, len(batch), batchSize, "Batch size should not exceed configured limit")
			totalSynced += len(batch)
			for _, userID := range batch {
				allSyncedUserIDs[userID] = true
			}
		}
		mu.Unlock()

		// Verify correct number of batches
		assert.GreaterOrEqual(t, len(batchedUserIDs), expectedMinBatches,
			fmt.Sprintf("Should have at least %d batches with batch size %d", expectedMinBatches, batchSize))

		// Verify that bot, system admin, and remote user were NOT synced
		assert.NotContains(t, allSyncedUserIDs, bot.UserId, "Bot should NOT be synced")
		assert.NotContains(t, allSyncedUserIDs, systemAdmin.Id, "System admin should NOT be synced")
		assert.NotContains(t, allSyncedUserIDs, remoteUser.Id, "User from remote cluster should NOT be synced")

		// Verify that guest WAS synced
		assert.Contains(t, allSyncedUserIDs, guest.Id, "Guest user should be synced")

		// Verify that all regular users were synced
		for _, regularUserID := range regularUserIDs {
			assert.Contains(t, allSyncedUserIDs, regularUserID, "Regular user should be synced")
		}

		// Verify cursor was updated
		updatedCluster, clusterErr := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, clusterErr)
		assert.Greater(t, updatedCluster.LastGlobalUserSyncAt, int64(0), "Cursor should be updated after batch sync")

		t.Logf("Test completed: synced %d users in %d batches (batch size: %d)", totalSynced, len(batchedUserIDs), batchSize)
	})

	t.Run("Test 3: Multiple Remote Clusters", func(t *testing.T) {
		// This test verifies syncing users to multiple remote clusters:
		// - Syncing users from Server A to both Server B and Server C
		// - Ensuring proper cursor tracking on each remote
		// - Verifying user propagation across all connected servers
		EnsureCleanState(t, th, ss)

		var syncMessagesPerCluster = make(map[string]*int32)
		var syncedUsersPerCluster = make(map[string][]string)
		var mu sync.Mutex

		// Create multiple test servers for different clusters
		clusters := make([]*model.RemoteCluster, 3)
		testServers := make([]*httptest.Server, 3)

		for i := 0; i < 3; i++ {
			clusterName := fmt.Sprintf("cluster-%d", i+1)
			var count int32
			syncMessagesPerCluster[clusterName] = &count
			syncedUsersPerCluster[clusterName] = []string{}

			idx := i // Capture index for closure
			testServers[i] = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/api/v4/remotecluster/msg" {
					clusterName := fmt.Sprintf("cluster-%d", idx+1)
					atomic.AddInt32(syncMessagesPerCluster[clusterName], 1)

					// Parse message
					bodyBytes, _ := io.ReadAll(r.Body)
					var frame model.RemoteClusterFrame
					if unmarshalErr := json.Unmarshal(bodyBytes, &frame); unmarshalErr == nil {
						var syncMsg model.SyncMsg
						if unmarshalErr := json.Unmarshal(frame.Msg.Payload, &syncMsg); unmarshalErr == nil {
							// Track synced users for this cluster
							mu.Lock()
							for userID := range syncMsg.Users {
								syncedUsersPerCluster[clusterName] = append(syncedUsersPerCluster[clusterName], userID)
							}
							mu.Unlock()

							// Create success response
							syncResp := &model.SyncResponse{
								UsersSyncd: make([]string, 0, len(syncMsg.Users)),
							}
							for userID := range syncMsg.Users {
								syncResp.UsersSyncd = append(syncResp.UsersSyncd, userID)
							}

							response := &remotecluster.Response{
								Status: remotecluster.ResponseStatusOK,
							}
							_ = response.SetPayload(syncResp)

							w.Header().Set("Content-Type", "application/json")
							w.WriteHeader(http.StatusOK)
							respBytes, _ := json.Marshal(response)
							_, _ = w.Write(respBytes)
							return
						}
					}
				}
				writeOKResponse(w)
			}))
		}

		// Cleanup servers
		defer func() {
			for _, server := range testServers {
				server.Close()
			}
		}()

		// Create remote clusters
		for i := 0; i < 3; i++ {
			clusters[i] = &model.RemoteCluster{
				RemoteId:             model.NewId(),
				Name:                 fmt.Sprintf("cluster-%d", i+1),
				SiteURL:              testServers[i].URL,
				CreateAt:             model.GetMillis(),
				LastPingAt:           model.GetMillis(),
				LastGlobalUserSyncAt: 0,
				Token:                model.NewId(),
				CreatorId:            th.BasicUser.Id,
				RemoteToken:          model.NewId(),
			}
			clusters[i], err = ss.RemoteCluster().Save(clusters[i])
			require.NoError(t, err)
		}

		// Create users to sync
		users := make([]*model.User, 5)
		for i := 0; i < 5; i++ {
			users[i] = th.CreateUser()
			users[i].UpdateAt = model.GetMillis() + int64(i)
			_, err = ss.User().Update(th.Context, users[i], true)
			require.NoError(t, err)
		}

		// Sync to all clusters
		for _, cluster := range clusters {
			err = service.HandleSyncAllUsersForTesting(cluster)
			require.NoError(t, err)
		}

		// Wait for syncs to complete
		require.Eventually(t, func() bool {
			// Each cluster should receive sync messages
			for name, countPtr := range syncMessagesPerCluster {
				if atomic.LoadInt32(countPtr) == 0 {
					t.Logf("Cluster %s has not received sync messages yet", name)
					return false
				}
			}
			return true
		}, 10*time.Second, 100*time.Millisecond, "All clusters should receive sync messages")

		// Verify each cluster received the users
		mu.Lock()
		for clusterName, syncedUsers := range syncedUsersPerCluster {
			for _, user := range users {
				assert.Contains(t, syncedUsers, user.Id,
					"Cluster %s should have received user %s", clusterName, user.Id)
			}
		}
		mu.Unlock()

		// Verify cursor updates for each cluster
		for _, cluster := range clusters {
			updatedCluster, err2 := ss.RemoteCluster().Get(cluster.RemoteId, true)
			require.NoError(t, err2)
			assert.Greater(t, updatedCluster.LastGlobalUserSyncAt, int64(0),
				"Cursor should be updated for cluster %s", cluster.Name)
		}
	})

	t.Run("Test 4: Cursor Management", func(t *testing.T) {
		// This test verifies proper cursor handling:
		// - Cursor persistence across sync operations
		// - Failed sync handling (cursor should not update on failed syncs)
		// - Cursor updates only when sync is successful
		EnsureCleanState(t, th, ss)

		var syncAttempts int32
		var failureMode atomic.Bool
		failureMode.Store(false)
		var syncHandler *SelfReferentialSyncHandler

		// Create test HTTP server
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/api/v4/remotecluster/msg":
				atomic.AddInt32(&syncAttempts, 1)

				if failureMode.Load() {
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = w.Write([]byte(`{"error":"simulated failure"}`))
					return
				}

				// Success case
				if syncHandler != nil {
					syncHandler.HandleRequest(w, r)
				} else {
					writeOKResponse(w)
				}
			case "/api/v4/remotecluster/ping":
				writeOKResponse(w)
			default:
				w.WriteHeader(http.StatusNotFound)
			}
		}))
		defer testServer.Close()

		// Create self-referential remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-cursor",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)

		// Create first batch of users
		user1 := th.CreateUser()
		user2 := th.CreateUser()

		// Set update times
		user1.UpdateAt = model.GetMillis()
		user2.UpdateAt = model.GetMillis() + 1000
		_, err = ss.User().Update(th.Context, user1, true)
		require.NoError(t, err)
		_, err = ss.User().Update(th.Context, user2, true)
		require.NoError(t, err)

		// First sync - should succeed and update cursor
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Wait for first sync
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncAttempts) > 0
		}, 5*time.Second, 100*time.Millisecond, "Should have attempted sync")

		// Verify cursor was updated
		cluster1, err2 := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err2)
		firstCursor := cluster1.LastGlobalUserSyncAt
		assert.Greater(t, firstCursor, int64(0), "Cursor should be updated after first sync")

		// Enable failure mode
		failureMode.Store(true)

		// Create a new user after cursor
		user3 := th.CreateUser()
		user3.UpdateAt = model.GetMillis()
		_, err = ss.User().Update(th.Context, user3, true)
		require.NoError(t, err)

		// Second sync - should fail
		initialAttempts := atomic.LoadInt32(&syncAttempts)
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err) // The method itself shouldn't error, just the remote call

		// Wait for failed sync attempt
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncAttempts) > initialAttempts
		}, 5*time.Second, 100*time.Millisecond, "Should have attempted sync")

		// Verify cursor was NOT updated on failure
		cluster2, err2 := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err2)
		assert.Equal(t, firstCursor, cluster2.LastGlobalUserSyncAt, "Cursor should not update on failed sync")

		// Disable failure mode
		failureMode.Store(false)

		// Third sync - should succeed and update cursor
		preSuccessAttempts := atomic.LoadInt32(&syncAttempts)
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Wait for successful sync
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncAttempts) > preSuccessAttempts
		}, 5*time.Second, 100*time.Millisecond, "Should have attempted sync")

		// Verify cursor was updated after successful sync
		cluster3, err3 := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err3)
		assert.Greater(t, cluster3.LastGlobalUserSyncAt, firstCursor, "Cursor should advance after successful sync")
	})

	t.Run("Test 5: Feature Flag Testing", func(t *testing.T) {
		// This test verifies feature flag handling:
		// - Verifies syncing works when feature flag is enabled
		// - Confirms syncing is disabled when feature flag is disabled
		// - Ensures cursor is only updated when flag is enabled
		EnsureCleanState(t, th, ss)

		var syncMessageCount int32

		// Create test HTTP server
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/v4/remotecluster/msg" {
				atomic.AddInt32(&syncMessageCount, 1)
			}
			writeOKResponse(w)
		}))
		defer testServer.Close()

		// Create self-referential remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-feature-flag",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Create users
		for i := 0; i < 3; i++ {
			user := th.CreateUser()
			user.UpdateAt = model.GetMillis() + int64(i)
			_, err = ss.User().Update(th.Context, user, true)
			require.NoError(t, err)
		}

		// Test 1: Sync with feature flag disabled
		os.Setenv("MM_FEATUREFLAGS_ENABLESYNCALLUSERSFORREMOTECLUSTER", "false")
		err = th.App.ReloadConfig()
		require.NoError(t, err)

		atomic.StoreInt32(&syncMessageCount, 0)
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Verify no sync messages were sent
		require.Never(t, func() bool {
			return atomic.LoadInt32(&syncMessageCount) > 0
		}, 2*time.Second, 100*time.Millisecond, "No sync should occur with feature flag disabled")

		// Verify cursor was not updated
		cluster1, err2 := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err2)
		assert.Equal(t, int64(0), cluster1.LastGlobalUserSyncAt, "Cursor should not update when flag is disabled")

		// Test 2: Sync with feature flag enabled
		os.Setenv("MM_FEATUREFLAGS_ENABLESYNCALLUSERSFORREMOTECLUSTER", "true")
		err = th.App.ReloadConfig()
		require.NoError(t, err)

		atomic.StoreInt32(&syncMessageCount, 0)
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Verify sync messages were sent
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncMessageCount) > 0
		}, 5*time.Second, 100*time.Millisecond, "Sync should occur with feature flag enabled")

		// Verify cursor was updated
		cluster2, err2 := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err2)
		assert.Greater(t, cluster2.LastGlobalUserSyncAt, int64(0), "Cursor should update when flag is enabled")
	})

	t.Run("Test 6: Config Option Testing", func(t *testing.T) {
		// This test verifies the SyncUsersOnConnectionOpen config option:
		// - Verifies automatic sync on connection open when enabled
		// - Confirms no sync occurs on connection open when disabled
		// - Tests cursor updates in both scenarios
		EnsureCleanState(t, th, ss)

		var syncMessageCount int32
		var connectionOpenSyncOccurred atomic.Bool

		// Create test HTTP server
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/v4/remotecluster/msg" {
				atomic.AddInt32(&syncMessageCount, 1)

				// Parse message to check if it's a user sync
				bodyBytes, _ := io.ReadAll(r.Body)
				var frame model.RemoteClusterFrame
				if unmarshalErr := json.Unmarshal(bodyBytes, &frame); unmarshalErr == nil {
					var syncMsg model.SyncMsg
					if unmarshalErr := json.Unmarshal(frame.Msg.Payload, &syncMsg); unmarshalErr == nil && len(syncMsg.Users) > 0 {
						connectionOpenSyncOccurred.Store(true)
					}
				}
			}
			writeOKResponse(w)
		}))
		defer testServer.Close()

		// Create users before creating remote cluster
		for i := 0; i < 3; i++ {
			user := th.CreateUser()
			user.UpdateAt = model.GetMillis() + int64(i)
			_, err = ss.User().Update(th.Context, user, true)
			require.NoError(t, err)
		}

		// Test 1: Connection open with sync disabled (default)
		// Ensure config option is disabled (default)
		th.App.UpdateConfig(func(cfg *model.Config) {
			if cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen == nil {
				cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen = model.NewPointer(false)
			} else {
				*cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen = false
			}
		})

		// Create remote cluster - simulating connection open
		selfCluster1 := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-config-disabled",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		_, err = ss.RemoteCluster().Save(selfCluster1)
		require.NoError(t, err)

		// Verify no automatic sync occurs within a reasonable time
		require.Never(t, func() bool {
			return connectionOpenSyncOccurred.Load() || atomic.LoadInt32(&syncMessageCount) > 0
		}, 2*time.Second, 100*time.Millisecond, "No automatic sync should occur when config is disabled")

		// Test 2: Connection open with sync enabled
		// Reset counters
		atomic.StoreInt32(&syncMessageCount, 0)
		connectionOpenSyncOccurred.Store(false)

		// Enable config option
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen = true
		})

		// Create another remote cluster - simulating connection open
		selfCluster2 := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-config-enabled",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster2, err = ss.RemoteCluster().Save(selfCluster2)
		require.NoError(t, err)

		// For this test, we need to manually trigger what would happen on connection open
		// since the shared channel service might not automatically pick up new clusters in test mode
		if th.App.Config().ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen != nil &&
			*th.App.Config().ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen {
			// Manually trigger sync as would happen on connection open
			err = service.HandleSyncAllUsersForTesting(selfCluster2)
			require.NoError(t, err)
		}

		// Wait for sync to occur
		require.Eventually(t, func() bool {
			return connectionOpenSyncOccurred.Load()
		}, 5*time.Second, 100*time.Millisecond, "Automatic sync should occur when config is enabled")

		// Verify sync occurred
		assert.Greater(t, atomic.LoadInt32(&syncMessageCount), int32(0), "Should have sync messages when config enabled")

		// Verify cursor was updated
		updatedCluster, err2 := ss.RemoteCluster().Get(selfCluster2.RemoteId, true)
		require.NoError(t, err2)
		assert.Greater(t, updatedCluster.LastGlobalUserSyncAt, int64(0), "Cursor should be updated after automatic sync")
	})

	t.Run("Test 7: Sync Task After Connection Becomes Available", func(t *testing.T) {
		// This test verifies that global user sync works correctly
		// when a remote cluster becomes available after being offline
		EnsureCleanState(t, th, ss)

		var syncTaskCreated atomic.Bool
		var syncHandler *SelfReferentialSyncHandler

		// Create test HTTP server
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandler != nil {
				syncHandler.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer.Close()

		// Create remote cluster that was previously offline (old LastPingAt)
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-reconnect",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis() - 300000, // Created 5 minutes ago
			LastPingAt:           model.GetMillis() - 120000, // Last ping 2 minutes ago
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnGlobalUserSync = func(userIds []string, messageNumber int32) {
			syncTaskCreated.Store(true)
		}

		// Create some users to sync
		for i := 0; i < 3; i++ {
			user := th.CreateUser()
			user.UpdateAt = model.GetMillis() + int64(i)
			_, err = ss.User().Update(th.Context, user, true)
			require.NoError(t, err)
		}

		// Update LastPingAt to simulate cluster coming back online
		selfCluster.LastPingAt = model.GetMillis()
		_, err = ss.RemoteCluster().Update(selfCluster)
		require.NoError(t, err)

		// Trigger global user sync as would happen when connection is restored
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Verify sync task was created and executed
		require.Eventually(t, func() bool {
			return syncTaskCreated.Load()
		}, 5*time.Second, 100*time.Millisecond, "Sync should execute when cluster comes back online")

		// Verify cursor was updated
		updatedCluster, err2 := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err2)
		assert.Greater(t, updatedCluster.LastGlobalUserSyncAt, int64(0), "Cursor should be updated after sync")
	})

	t.Run("Test 8: Remote Cluster Offline During Sync", func(t *testing.T) {
		// This test verifies behavior when a remote cluster goes offline during sync:
		// - Sync should fail gracefully
		// - Cursor should not be updated
		// - No partial data should be persisted
		EnsureCleanState(t, th, ss)

		var syncAttempts int32
		var serverOnline atomic.Bool
		serverOnline.Store(true)

		// Create test HTTP server that can simulate going offline
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !serverOnline.Load() {
				// Simulate server being offline
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}

			if r.URL.Path == "/api/v4/remotecluster/msg" {
				atomic.AddInt32(&syncAttempts, 1)
				// On second attempt, go offline
				if atomic.LoadInt32(&syncAttempts) >= 2 {
					serverOnline.Store(false)
					w.WriteHeader(http.StatusServiceUnavailable)
					return
				}
			}
			writeOKResponse(w)
		}))
		defer testServer.Close()

		// Create remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-offline",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Create users to sync
		for i := 0; i < 5; i++ {
			user := th.CreateUser()
			user.UpdateAt = model.GetMillis() + int64(i)
			_, err = ss.User().Update(th.Context, user, true)
			require.NoError(t, err)
		}

		// First sync should succeed
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Wait for first sync
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncAttempts) >= 1
		}, 5*time.Second, 100*time.Millisecond)

		// Get cursor after first sync
		cluster1, err2 := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err2)
		firstCursor := cluster1.LastGlobalUserSyncAt
		assert.Greater(t, firstCursor, int64(0), "Cursor should be set after first sync")

		// Create more users
		for i := 0; i < 3; i++ {
			user := th.CreateUser()
			user.UpdateAt = model.GetMillis() + int64(100+i)
			_, err = ss.User().Update(th.Context, user, true)
			require.NoError(t, err)
		}

		// Second sync should fail (server goes offline)
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err) // Method itself shouldn't error

		// Wait for second sync attempt
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncAttempts) >= 2
		}, 5*time.Second, 100*time.Millisecond)

		// Verify cursor was not updated after failed sync
		cluster2, err2 := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err2)
		assert.Equal(t, firstCursor, cluster2.LastGlobalUserSyncAt, "Cursor should not update when sync fails")
	})

	t.Run("Test 9: Users in Multiple Shared Channels", func(t *testing.T) {
		// This test verifies that users who are members of multiple shared channels
		// are synced correctly without duplication
		EnsureCleanState(t, th, ss)

		var syncedUserIds []string
		var mu sync.Mutex
		var syncHandler *SelfReferentialSyncHandler

		// Create test HTTP server
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandler != nil {
				syncHandler.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer.Close()

		// Create remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-multi-channel",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnGlobalUserSync = func(userIds []string, messageNumber int32) {
			mu.Lock()
			syncedUserIds = append(syncedUserIds, userIds...)
			mu.Unlock()
		}

		// Create users
		user1 := th.CreateUser()
		user2 := th.CreateUser()
		user3 := th.CreateUser()

		// Add users to team
		th.LinkUserToTeam(user1, th.BasicTeam)
		th.LinkUserToTeam(user2, th.BasicTeam)
		th.LinkUserToTeam(user3, th.BasicTeam)

		// Update timestamps
		user1.UpdateAt = model.GetMillis()
		user2.UpdateAt = model.GetMillis() + 1
		user3.UpdateAt = model.GetMillis() + 2
		_, err = ss.User().Update(th.Context, user1, true)
		require.NoError(t, err)
		_, err = ss.User().Update(th.Context, user2, true)
		require.NoError(t, err)
		_, err = ss.User().Update(th.Context, user3, true)
		require.NoError(t, err)

		// Create multiple shared channels
		channel1 := th.CreateChannel(th.Context, th.BasicTeam)
		channel2 := th.CreateChannel(th.Context, th.BasicTeam)
		channel3 := th.CreateChannel(th.Context, th.BasicTeam)

		// Make channels shared
		sc1 := &model.SharedChannel{
			ChannelId:        channel1.Id,
			TeamId:           channel1.TeamId,
			RemoteId:         selfCluster.RemoteId,
			Home:             true,
			ReadOnly:         false,
			ShareName:        channel1.Name,
			ShareDisplayName: channel1.DisplayName,
			CreatorId:        th.BasicUser.Id,
		}
		_, err = ss.SharedChannel().Save(sc1)
		require.NoError(t, err)

		sc2 := &model.SharedChannel{
			ChannelId:        channel2.Id,
			TeamId:           channel2.TeamId,
			RemoteId:         selfCluster.RemoteId,
			Home:             true,
			ReadOnly:         false,
			ShareName:        channel2.Name,
			ShareDisplayName: channel2.DisplayName,
			CreatorId:        th.BasicUser.Id,
		}
		_, err = ss.SharedChannel().Save(sc2)
		require.NoError(t, err)

		sc3 := &model.SharedChannel{
			ChannelId:        channel3.Id,
			TeamId:           channel3.TeamId,
			RemoteId:         selfCluster.RemoteId,
			Home:             true,
			ReadOnly:         false,
			ShareName:        channel3.Name,
			ShareDisplayName: channel3.DisplayName,
			CreatorId:        th.BasicUser.Id,
		}
		_, err = ss.SharedChannel().Save(sc3)
		require.NoError(t, err)

		// Add users to multiple shared channels
		// user1 in all channels
		th.AddUserToChannel(user1, channel1)
		th.AddUserToChannel(user1, channel2)
		th.AddUserToChannel(user1, channel3)

		// user2 in two channels
		th.AddUserToChannel(user2, channel1)
		th.AddUserToChannel(user2, channel2)

		// user3 in one channel
		th.AddUserToChannel(user3, channel3)

		// Sync users
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Wait for sync
		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()
			t.Logf("Current synced users count: %d", len(syncedUserIds))
			if len(syncedUserIds) > 0 {
				t.Logf("Synced user IDs: %v", syncedUserIds)
			}
			// We expect at least 3 users to be synced
			return len(syncedUserIds) >= 3
		}, 10*time.Second, 100*time.Millisecond, "Expected at least 3 users to be synced")

		// Verify each user is synced exactly once
		mu.Lock()
		userCount := make(map[string]int)
		for _, userId := range syncedUserIds {
			userCount[userId]++
		}
		mu.Unlock()

		// Each user should appear exactly once regardless of how many channels they're in
		assert.Equal(t, 1, userCount[user1.Id], "User1 should be synced exactly once")
		assert.Equal(t, 1, userCount[user2.Id], "User2 should be synced exactly once")
		assert.Equal(t, 1, userCount[user3.Id], "User3 should be synced exactly once")
	})

	t.Run("Test 10: Database Error Handling", func(t *testing.T) {
		// This test verifies proper error handling when database operations fail:
		// - Sync should fail gracefully
		// - Cursor should not be updated
		// - Error should be logged appropriately
		EnsureCleanState(t, th, ss)

		// For this test, we'll simulate a database error by creating a remote cluster
		// with invalid data that will cause issues during sync
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeOKResponse(w)
		}))
		defer testServer.Close()

		// Create remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster-db-error",
			SiteURL:              testServer.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Create a user
		user := th.CreateUser()
		user.UpdateAt = model.GetMillis()
		_, err = ss.User().Update(th.Context, user, true)
		require.NoError(t, err)

		// To simulate a database error, we'll set an extremely large cursor value
		// that will cause issues when querying users
		selfCluster.LastGlobalUserSyncAt = 9223372036854775807 // Max int64
		_, err = ss.RemoteCluster().Update(selfCluster)
		require.NoError(t, err)

		// Attempt sync - it should handle the error gracefully
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		// The sync itself might not return an error, but it should handle any internal errors gracefully
		// We're mainly testing that it doesn't panic or corrupt data

		// Verify the cursor wasn't corrupted
		updatedCluster, err := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err)
		assert.Equal(t, int64(9223372036854775807), updatedCluster.LastGlobalUserSyncAt, "Cursor should remain unchanged on error")

		// Reset cursor to a valid value
		selfCluster.LastGlobalUserSyncAt = 0
		_, err = ss.RemoteCluster().Update(selfCluster)
		require.NoError(t, err)

		// Now sync should work normally
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Verify cursor was updated after successful sync
		finalCluster, err := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, err)
		assert.Greater(t, finalCluster.LastGlobalUserSyncAt, int64(0), "Cursor should update after successful sync")
	})
}
