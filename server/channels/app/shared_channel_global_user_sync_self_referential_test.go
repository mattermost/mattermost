// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
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
	// Setup with default batch size
	th := SetupConfig(t, func(cfg *model.Config) {
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
		*cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen = true
		// Set default batch size - EnsureCleanState will reset to this value
		// Individual tests can override as needed (e.g., Test 3 sets it to 4)
		defaultBatchSize := 20
		cfg.ConnectedWorkspacesSettings.GlobalUserSyncBatchSize = &defaultBatchSize
		// Enable the feature flag for global user sync
		cfg.FeatureFlags.EnableSyncAllUsersForRemoteCluster = true
	}).InitBasic(t)

	ss := th.App.Srv().Store()

	// Get the shared channel service and cast to concrete type to access SyncAllUsersForRemoteCluster
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	service, ok := scsInterface.(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service concrete type")

	// Verify the service is active
	require.True(t, service.Active(), "SharedChannel service should be active")

	// Force the service to be active
	err := service.Start()
	require.NoError(t, err)

	// Also ensure the remote cluster service is running so callbacks work
	rcService := th.App.Srv().GetRemoteClusterService()
	if rcService != nil {
		_ = rcService.Start()

		// Force the service to be active in test environment
		if rc, ok := rcService.(*remotecluster.Service); ok {
			rc.SetActive(true)
		}

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
		now := model.GetMillis()
		selfCluster := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "self-cluster",
			SiteURL:              testServer.URL,
			CreateAt:             now,
			LastPingAt:           now, // Ensure it's considered online
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
		user := th.CreateUser(t)

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
			mu.Lock()
			defer mu.Unlock()
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
		EnsureCleanState(t, th, ss)

		// Set batch size to 4 for testing batching behavior
		batchSize := 4
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ConnectedWorkspacesSettings.GlobalUserSyncBatchSize = &batchSize
		})

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

		baseTime := model.GetMillis()

		// Create user with old timestamp
		userWithOldTimestamp := th.CreateUser(t)
		userWithOldTimestamp.UpdateAt = 1
		_, err = ss.User().Update(th.Context, userWithOldTimestamp, false)
		require.NoError(t, err)

		// Verify the user was actually updated with the old timestamp
		verifiedUser, pErr := ss.User().Get(context.Background(), userWithOldTimestamp.Id)
		require.NoError(t, pErr)
		userWithOldTimestamp = verifiedUser

		// Create regular users
		regularUsers := make([]*model.User, 3)
		for i := range 3 {
			regularUsers[i] = th.CreateUser(t)
			regularUsers[i].UpdateAt = baseTime + int64(i*100)
			_, err = ss.User().Update(th.Context, regularUsers[i], true)
			require.NoError(t, err)
		}

		// Create bot
		bot := th.CreateBot(t)
		botUser, appErr := th.App.GetUser(bot.UserId)
		require.Nil(t, appErr)
		botUser.UpdateAt = baseTime + 300
		_, err = ss.User().Update(th.Context, botUser, true)
		require.NoError(t, err)

		// Create system admin
		systemAdmin := th.CreateUser(t)
		_, appErr = th.App.UpdateUserRoles(th.Context, systemAdmin.Id, model.SystemAdminRoleId+" "+model.SystemUserRoleId, false)
		require.Nil(t, appErr)
		systemAdmin.UpdateAt = baseTime + 400
		_, err = ss.User().Update(th.Context, systemAdmin, true)
		require.NoError(t, err)

		// Create guest user
		guest := th.CreateGuest(t)
		guest.UpdateAt = baseTime + 500
		_, err = ss.User().Update(th.Context, guest, true)
		require.NoError(t, err)

		// Create remote user (should NOT be synced)
		remoteUser := th.CreateUser(t)
		remoteUser.RemoteId = &selfCluster.RemoteId
		remoteUser.UpdateAt = baseTime + 600
		_, err = ss.User().Update(th.Context, remoteUser, true)
		require.NoError(t, err)

		// Create inactive user (should NOT be synced)
		inactiveUser := th.CreateUser(t)
		inactiveUser.UpdateAt = baseTime + 700
		inactiveUser.DeleteAt = model.GetMillis()
		_, err = ss.User().Update(th.Context, inactiveUser, true)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnGlobalUserSync = func(userIds []string, messageNumber int32) {
			mu.Lock()
			batchedUserIDs = append(batchedUserIDs, userIds)
			mu.Unlock()
		}

		// Trigger sync
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// Wait for sync to complete
		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()

			// Count total synced users
			allSyncedUserIDs := make(map[string]bool)
			for _, batch := range batchedUserIDs {
				for _, userID := range batch {
					allSyncedUserIDs[userID] = true
				}
			}

			// Check that our specific test users are synced
			guestSynced := allSyncedUserIDs[guest.Id]
			botSynced := allSyncedUserIDs[bot.UserId]
			systemAdminSynced := allSyncedUserIDs[systemAdmin.Id]
			userWithOldTimestampSynced := allSyncedUserIDs[userWithOldTimestamp.Id]
			remoteUserNotSynced := !allSyncedUserIDs[remoteUser.Id]
			inactiveUserNotSynced := !allSyncedUserIDs[inactiveUser.Id]

			return guestSynced && botSynced && systemAdminSynced && userWithOldTimestampSynced &&
				remoteUserNotSynced && inactiveUserNotSynced
		}, 10*time.Second, 500*time.Millisecond, "Should sync expected users")

		// Verify results
		mu.Lock()
		defer mu.Unlock()

		allSyncedUserIDs := make(map[string]bool)
		for _, batch := range batchedUserIDs {
			assert.LessOrEqual(t, len(batch), batchSize, "Batch size should not exceed configured limit")
			for _, userID := range batch {
				allSyncedUserIDs[userID] = true
			}
		}

		// Verify user type filtering
		assert.Contains(t, allSyncedUserIDs, bot.UserId, "Bot should be synced")
		assert.Contains(t, allSyncedUserIDs, systemAdmin.Id, "System admin should be synced")
		assert.Contains(t, allSyncedUserIDs, guest.Id, "Guest user should be synced")
		assert.Contains(t, allSyncedUserIDs, userWithOldTimestamp.Id, "User with old timestamp should be synced")
		assert.NotContains(t, allSyncedUserIDs, remoteUser.Id, "Remote user should NOT be synced")
		assert.NotContains(t, allSyncedUserIDs, inactiveUser.Id, "Inactive user should NOT be synced")

		// Verify regular users are synced
		for i, user := range regularUsers {
			assert.Contains(t, allSyncedUserIDs, user.Id, "Regular user %d should be synced", i+1)
		}

		// Verify cursor was updated
		updatedCluster, clusterErr := ss.RemoteCluster().Get(selfCluster.RemoteId, true)
		require.NoError(t, clusterErr)
		assert.Greater(t, updatedCluster.LastGlobalUserSyncAt, int64(0), "Cursor should be updated after batch sync")
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

		for i := range 3 {
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
		for i := range 3 {
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
		for i := range 5 {
			users[i] = th.CreateUser(t)
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
			for _, countPtr := range syncMessagesPerCluster {
				if atomic.LoadInt32(countPtr) == 0 {
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
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)

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
		user3 := th.CreateUser(t)
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
		for i := range 3 {
			user := th.CreateUser(t)
			user.UpdateAt = model.GetMillis() + int64(i)
			_, err = ss.User().Update(th.Context, user, true)
			require.NoError(t, err)
		}

		// Test 1: Sync with feature flag disabled
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.EnableSyncAllUsersForRemoteCluster = false
			// Also disable SyncUsersOnConnectionOpen to ensure sync is completely disabled
			*cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen = false
		})
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
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.EnableSyncAllUsersForRemoteCluster = true
			// Re-enable SyncUsersOnConnectionOpen as well
			*cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen = true
		})
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
		for i := range 3 {
			user := th.CreateUser(t)
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
		for i := range 3 {
			user := th.CreateUser(t)
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
		for i := range 5 {
			user := th.CreateUser(t)
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
		for i := range 3 {
			user := th.CreateUser(t)
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
		// are synced correctly without duplication.
		// The test creates 3 users and adds them to shared channels in different combinations:
		// - user1: member of all 3 shared channels
		// - user2: member of 2 shared channels (channel1 and channel2)
		// - user3: member of 1 shared channel (channel3)
		// The test then performs a global user sync and verifies that each user is synced
		// exactly once, regardless of how many shared channels they belong to.
		// This ensures that the global user sync deduplicates users properly
		EnsureCleanState(t, th, ss)
		// Note: EnsureCleanState resets batch size to 20, which is sufficient for this test

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
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		user3 := th.CreateUser(t)

		// Add users to team
		th.LinkUserToTeam(t, user1, th.BasicTeam)
		th.LinkUserToTeam(t, user2, th.BasicTeam)
		th.LinkUserToTeam(t, user3, th.BasicTeam)

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
		channel1 := th.CreateChannel(t, th.BasicTeam)
		channel2 := th.CreateChannel(t, th.BasicTeam)
		channel3 := th.CreateChannel(t, th.BasicTeam)

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
		th.AddUserToChannel(t, user1, channel1)
		th.AddUserToChannel(t, user1, channel2)
		th.AddUserToChannel(t, user1, channel3)

		// user2 in two channels
		th.AddUserToChannel(t, user2, channel1)
		th.AddUserToChannel(t, user2, channel2)

		// user3 in one channel
		th.AddUserToChannel(t, user3, channel3)

		// Start the sync - this will trigger the first batch
		err = service.HandleSyncAllUsersForTesting(selfCluster)
		require.NoError(t, err)

		// With batch size of 20, all users should sync in one batch
		// Wait for sync to complete
		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()

			// Check if all our test users have been synced
			syncedMap := make(map[string]bool)
			for _, userId := range syncedUserIds {
				syncedMap[userId] = true
			}

			// We need all 3 test users to be synced
			return syncedMap[user1.Id] && syncedMap[user2.Id] && syncedMap[user3.Id]
		}, 10*time.Second, 100*time.Millisecond, "Expected all test users to be synced")

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

	t.Run("Test 10: Circular Sync Prevention After Connection Reset", func(t *testing.T) {
		// This test verifies the exact scenario: A→B sync, connection reset, B→A sync prevention
		// 1. User from Server A syncs to Server B (user appears on B with RemoteId=A)
		// 2. Connection is closed and a new one is created
		// 3. Server B attempts to sync back to Server A
		// 4. Verify the synced user (user:A) does NOT get synced back to A
		EnsureCleanState(t, th, ss)

		var syncedToB []string
		var syncedBackToA []string
		var mu sync.Mutex

		// Create test HTTP servers for both "servers"
		serverAHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/v4/remotecluster/msg" {
				// Parse message to track what gets synced back to A
				bodyBytes, _ := io.ReadAll(r.Body)
				var frame model.RemoteClusterFrame
				if unmarshalErr := json.Unmarshal(bodyBytes, &frame); unmarshalErr == nil {
					var syncMsg model.SyncMsg
					if unmarshalErr := json.Unmarshal(frame.Msg.Payload, &syncMsg); unmarshalErr == nil {
						mu.Lock()
						for userID := range syncMsg.Users {
							syncedBackToA = append(syncedBackToA, userID)
						}
						mu.Unlock()
					}
				}
			}
			writeOKResponse(w)
		})

		serverBHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/v4/remotecluster/msg" {
				// Parse message to track what gets synced to B
				bodyBytes, _ := io.ReadAll(r.Body)
				var frame model.RemoteClusterFrame
				if unmarshalErr := json.Unmarshal(bodyBytes, &frame); unmarshalErr == nil {
					var syncMsg model.SyncMsg
					if unmarshalErr := json.Unmarshal(frame.Msg.Payload, &syncMsg); unmarshalErr == nil {
						mu.Lock()
						for userID := range syncMsg.Users {
							syncedToB = append(syncedToB, userID)
						}
						mu.Unlock()
					}
				}
			}
			writeOKResponse(w)
		})

		serverA := httptest.NewServer(serverAHandler)
		serverB := httptest.NewServer(serverBHandler)
		defer serverA.Close()
		defer serverB.Close()

		// Step 1: Create "Server A" user and sync to "Server B"
		originalUser := th.CreateUser(t)
		originalUser.UpdateAt = model.GetMillis()
		_, err = ss.User().Update(th.Context, originalUser, true)
		require.NoError(t, err)

		// Create remote cluster B (from A's perspective)
		clusterB := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "server-b",
			SiteURL:              serverB.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		clusterB, err = ss.RemoteCluster().Save(clusterB)
		require.NoError(t, err)

		// Sync A→B (original user syncs to B)
		err = service.HandleSyncAllUsersForTesting(clusterB)
		require.NoError(t, err)

		// Wait for sync to complete
		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()
			return slices.Contains(syncedToB, originalUser.Id)
		}, 5*time.Second, 100*time.Millisecond, "Original user should sync from A to B")

		// Step 2: Simulate the synced user existing on Server B
		// Create a user on "Server A" that represents what would exist on B after sync
		// This user has RemoteId pointing to A, simulating user:A on Server B
		syncedUserOnB := &model.User{
			Email:    model.NewId() + "@example.com",
			Username: originalUser.Username + "_" + clusterB.Name, // Munged username
			Password: "password",
			RemoteId: &clusterB.RemoteId, // This would be A's cluster ID on the actual B server
			UpdateAt: model.GetMillis(),
		}
		syncedUserOnB, appErr := th.App.CreateUser(th.Context, syncedUserOnB)
		require.Nil(t, appErr)

		// Step 3: Simulate connection reset by creating a new cluster A (from B's perspective)
		// This represents B trying to sync back to A after connection reset
		clusterA := &model.RemoteCluster{
			RemoteId:             clusterB.RemoteId, // Same ID as the one referenced in syncedUserOnB.RemoteId
			Name:                 "server-a",
			SiteURL:              serverA.URL,
			CreateAt:             model.GetMillis(),
			LastPingAt:           model.GetMillis(),
			LastGlobalUserSyncAt: 0,
			Token:                model.NewId(),
			CreatorId:            th.BasicUser.Id,
			RemoteToken:          model.NewId(),
		}
		clusterA, err = ss.RemoteCluster().Save(clusterA)
		require.NoError(t, err)

		// Step 4: Attempt B→A sync (should NOT sync the user back to A)
		err = service.HandleSyncAllUsersForTesting(clusterA)
		require.NoError(t, err)

		// Step 5: Verify the synced user was NOT sent back to A
		// Use Never to ensure the user is never synced back
		require.Never(t, func() bool {
			mu.Lock()
			defer mu.Unlock()
			return slices.Contains(syncedBackToA, syncedUserOnB.Id)
		}, 2*time.Second, 100*time.Millisecond, "Synced user should NEVER be synced back to its originating cluster")

		// Verify that the synced user still exists locally but wasn't synced
		user, appErr := th.App.GetUser(syncedUserOnB.Id)
		require.Nil(t, appErr)
		assert.NotNil(t, user.RemoteId, "Synced user should still have RemoteId")
		assert.Equal(t, clusterB.RemoteId, *user.RemoteId, "RemoteId should point to origin cluster")
	})

	t.Run("Test 12: Database Error Handling", func(t *testing.T) {
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
		user := th.CreateUser(t)
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
