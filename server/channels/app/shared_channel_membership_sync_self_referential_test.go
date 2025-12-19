// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSharedChannelMembershipSyncSelfReferential(t *testing.T) {
	th := setupSharedChannels(t).InitBasic(t)

	ss := th.App.Srv().Store()

	// Get the shared channel service and cast to concrete type to access SyncAllChannelMembers
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	service, ok := scsInterface.(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service concrete type")

	// Force the service to be active
	err := service.Start()
	require.NoError(t, err)

	// Wait for service to be fully active
	require.Eventually(t, func() bool {
		return service.Active()
	}, 5*time.Second, 100*time.Millisecond, "SharedChannelService should be active")

	// Also ensure the remote cluster service is running so callbacks work
	rcService := th.App.Srv().GetRemoteClusterService()
	if rcService != nil {
		_ = rcService.Start()

		// Force the service to be active in test environment
		if rc, ok := rcService.(*remotecluster.Service); ok {
			rc.SetActive(true)
		}

		// Wait for remote cluster service to be active
		require.Eventually(t, func() bool {
			return rcService.Active()
		}, 5*time.Second, 100*time.Millisecond, "RemoteClusterService should be active")
	}

	t.Run("Test 1: Automatic sync on membership changes", func(t *testing.T) {
		// This test verifies that membership sync happens automatically when users are added or removed from a shared channel.
		// The sync is triggered by HandleMembershipChange which is called automatically by AddUserToChannel and RemoveUserFromChannel.
		// The test ensures that sync messages are sent asynchronously after a minimum delay for both add and remove operations.
		EnsureCleanState(t, th, ss)
		// Track sync messages received
		var syncMessageCount int32
		var syncHandler *SelfReferentialSyncHandler

		// Create a test HTTP server that acts as the "remote" cluster
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt32(&syncMessageCount, 1)
			if syncHandler != nil {
				syncHandler.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer.Close()

		// Create a shared channel
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "auto-sync-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		_, shareErr := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, shareErr)

		// Create a self-referential remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)

		// Share the channel with our self-referential cluster
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          selfCluster.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastMembersSyncAt: 0,
		}
		_, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Refresh the channel object to get the updated Shared field
		channel, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.True(t, channel.IsShared(), "Channel should be marked as shared")

		// Create a user and add to team
		user := th.CreateUser(t)
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Add user to channel - this triggers HandleMembershipChange automatically
		_, appErr = th.App.AddUserToChannel(th.Context, user, channel, false)
		require.Nil(t, appErr)

		// Wait for the user to be locally added before checking for sync
		require.Eventually(t, func() bool {
			_, memberErr := ss.Channel().GetMember(th.Context, channel.Id, user.Id)
			return memberErr == nil
		}, 5*time.Second, 100*time.Millisecond, "User should be locally added to channel")

		// Wait for async sync with more generous timeout (minimum delay is 2 seconds + async task processing)
		require.Eventually(t, func() bool {
			count := atomic.LoadInt32(&syncMessageCount)
			return count > 0
		}, 15*time.Second, 200*time.Millisecond, "Should have received at least one sync message via automatic sync")

		// Wait for async task queue to be processed and sync to complete
		require.Eventually(t, func() bool {
			return !service.HasPendingTasksForTesting()
		}, 10*time.Second, 200*time.Millisecond, "All async sync tasks should be completed")

		// Verify the user is a member at the receiver end
		member, memberErr := ss.Channel().GetMember(th.Context, channel.Id, user.Id)
		require.NoError(t, memberErr)
		require.Equal(t, user.Id, member.UserId)

		// Reset sync counter and wait for background tasks to settle
		var initialCount int32
		require.Eventually(t, func() bool {
			initialCount = atomic.LoadInt32(&syncMessageCount)
			return !service.HasPendingTasksForTesting()
		}, 5*time.Second, 100*time.Millisecond, "Background tasks should settle before removal test")

		// Remove user from channel - this should also trigger automatic sync
		appErr = th.App.RemoveUserFromChannel(th.Context, user.Id, th.BasicUser.Id, channel)
		require.Nil(t, appErr)

		// Wait for removal sync with increased timeout
		require.Eventually(t, func() bool {
			count := atomic.LoadInt32(&syncMessageCount)
			return count > initialCount
		}, 20*time.Second, 200*time.Millisecond, "Should have received sync message for user removal")

		// Wait for async task queue to be processed after removal
		require.Eventually(t, func() bool {
			return !service.HasPendingTasksForTesting()
		}, 15*time.Second, 200*time.Millisecond, "All async removal tasks should be completed")

		// Wait for the removal to be processed with extended timeout
		require.Eventually(t, func() bool {
			_, err = ss.Channel().GetMember(th.Context, channel.Id, user.Id)
			return err != nil
		}, 30*time.Second, 300*time.Millisecond, "User should not be a member after removal")
	})
	t.Run("Test 2: Batch membership sync with user type filtering", func(t *testing.T) {
		EnsureCleanState(t, th, ss)
		// This test verifies batch sync of multiple members and proper filtering of user types
		var batchedUserIDs [][]string
		var mu sync.Mutex
		var selfCluster *model.RemoteCluster
		var syncCompleted atomic.Bool

		// Placeholder for sync handler - will be created after selfCluster is initialized
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

		// Create channel but DON'T share it yet
		channel := th.CreateChannel(t, th.BasicTeam)

		// Create self-referential remote cluster
		selfCluster = &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster-batch",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		batchSize := service.GetMemberSyncBatchSize()

		// First, add multiple users to the channel BEFORE sharing
		// Include different user types to test filtering
		numRegularUsers := (batchSize * 2) + 5 // Back to original
		regularUserIDs := make([]string, numRegularUsers)
		for i := range numRegularUsers {
			user := th.CreateUser(t)
			regularUserIDs[i] = user.Id
			_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, th.BasicUser.Id)
			require.Nil(t, appErr)
			_, appErr = th.App.AddUserToChannel(th.Context, user, channel, false)
			require.Nil(t, appErr)
		}

		// Add users that should be synced (including bots and system admins)
		// Add a bot
		bot := th.CreateBot(t)
		botUser, appErr := th.App.GetUser(bot.UserId)
		require.Nil(t, appErr)
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, bot.UserId, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, botUser, channel, false)
		require.Nil(t, appErr)

		// Add a system admin
		systemAdmin := th.CreateUser(t)
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, systemAdmin.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.UpdateUserRoles(th.Context, systemAdmin.Id, model.SystemAdminRoleId+" "+model.SystemUserRoleId, false)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, systemAdmin, channel, false)
		require.Nil(t, appErr)

		// Add a guest user (should be synced)
		guest := th.CreateGuest(t)
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, guest.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, guest, channel, false)
		require.Nil(t, appErr)

		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "batch-sync-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		_, err = th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Share channel with self
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          selfCluster.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastMembersSyncAt: 0,
		}
		_, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Initialize sync handler with callbacks
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)

		// Track when all expected batches are received
		// Should include regular users + guest + BasicUser + bot + system admin
		expectedTotal := numRegularUsers + 1 + 1 + 1 + 1 // regular users + guest + BasicUser + bot + system admin
		expectedBatches := (expectedTotal + batchSize - 1) / batchSize

		syncHandler.OnBatchSync = func(userIds []string, messageNumber int32) {
			mu.Lock()
			batchedUserIDs = append(batchedUserIDs, userIds)
			// Check if we've received all expected batches
			if len(batchedUserIDs) >= expectedBatches {
				syncCompleted.Store(true)
			}
			mu.Unlock()
		}

		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Wait for batch messages to be received with more robust checking
		require.Eventually(t, func() bool {
			return syncCompleted.Load()
		}, 30*time.Second, 200*time.Millisecond, fmt.Sprintf("Should receive %d batch sync messages", expectedBatches))

		// Wait for all async processing to complete
		require.Eventually(t, func() bool {
			return !service.HasPendingTasksForTesting()
		}, 15*time.Second, 200*time.Millisecond, "All async tasks should be completed")

		// Verify cursor was updated - wait longer for batch processing
		require.Eventually(t, func() bool {
			updatedScr, getErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
			return getErr == nil && updatedScr.LastMembersSyncAt > 0
		}, 20*time.Second, 200*time.Millisecond, "Cursor should be updated after batch sync")

		// Verify sync messages were sent
		count := syncHandler.GetSyncMessageCount()
		assert.Greater(t, count, int32(0), "Should have received sync messages")

		// Check batch contents with proper locking
		mu.Lock()
		totalSynced := 0
		allSyncedUserIDs := make(map[string]bool)
		actualBatches := len(batchedUserIDs)
		for _, batch := range batchedUserIDs {
			totalSynced += len(batch)
			for _, userID := range batch {
				allSyncedUserIDs[userID] = true
			}
		}
		mu.Unlock()

		// Verify exact batch count
		assert.Equal(t, expectedBatches, actualBatches, fmt.Sprintf("Should have exactly %d batches with batch size %d", expectedBatches, batchSize))

		// Verify total synced users
		assert.Equal(t, expectedTotal, totalSynced, "All users including bots and system admins should be synced")

		// Verify that bot and system admin WERE synced
		assert.Contains(t, allSyncedUserIDs, bot.UserId, "Bot should be synced")
		assert.Contains(t, allSyncedUserIDs, systemAdmin.Id, "System admin should be synced")

		// Verify that guest WAS synced
		assert.Contains(t, allSyncedUserIDs, guest.Id, "Guest user should be synced")

		// Verify that regular users were synced
		for _, regularUserID := range regularUserIDs {
			assert.Contains(t, allSyncedUserIDs, regularUserID, "Regular user should be synced")
		}
	})
	t.Run("Test 3: Cursor management", func(t *testing.T) {
		// This test verifies incremental sync using cursor timestamps.
		// The cursor (LastMembersSyncAt) tracks the last sync time to ensure only new/modified
		// memberships are synced on subsequent calls, avoiding redundant syncs.
		// We test that:
		// 1. Initial sync includes all existing members and updates the cursor
		// 2. Subsequent syncs only include members added after the cursor timestamp
		// 3. Previously synced members are not re-synced (incremental behavior)
		EnsureCleanState(t, th, ss)
		var syncedInFirstCall []string
		var syncedInSecondCall []string
		var mu sync.Mutex
		var selfCluster *model.RemoteCluster
		var svc *sharedchannel.Service
		var syncHandler *SelfReferentialSyncHandler

		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandler != nil {
				syncHandler.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer.Close()

		// Create and share channel
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "cursor-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		_, shareErr := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, shareErr)

		// Create self-referential remote cluster
		selfCluster = &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster-cursor",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Share channel with self
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          selfCluster.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastMembersSyncAt: 0,
		}
		scr, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Refresh the channel object to get the updated Shared field
		channel, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.True(t, channel.IsShared(), "Channel should be marked as shared")

		// Add first batch of users
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user1.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, user1, channel, false)
		require.Nil(t, appErr)

		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user2.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, user2, channel, false)
		require.Nil(t, appErr)

		// Get the shared channel service
		scsInterface := th.App.Srv().GetSharedChannelSyncService()
		var ok bool
		svc, ok = scsInterface.(*sharedchannel.Service)
		require.True(t, ok, "Expected sharedchannel.Service concrete type")

		// Force the service to be active
		err = svc.Start()
		require.NoError(t, err)

		// Create sync handler with callbacks
		syncHandler = NewSelfReferentialSyncHandler(t, svc, selfCluster)
		syncHandler.OnIndividualSync = func(userId string, messageNumber int32) {
			mu.Lock()
			defer mu.Unlock()
			if messageNumber <= 2 { // First sync
				syncedInFirstCall = append(syncedInFirstCall, userId)
			} else { // Second sync
				syncedInSecondCall = append(syncedInSecondCall, userId)
			}
		}

		// First sync
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Wait for first sync to complete
		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()
			return len(syncedInFirstCall) >= 2
		}, 10*time.Second, 100*time.Millisecond, "First sync should complete with initial users")

		// Wait for cursor to be updated after first sync
		var firstSyncCursor int64
		require.Eventually(t, func() bool {
			scr, err = ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
			if err != nil {
				return false
			}
			firstSyncCursor = scr.LastMembersSyncAt
			return firstSyncCursor > 0
		}, 10*time.Second, 100*time.Millisecond, "Cursor should be updated after first sync")

		// Add another user after cursor update
		user3 := th.CreateUser(t)
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user3.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, user3, channel, false)
		require.Nil(t, appErr)

		// Second sync - should only sync user3
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Wait for second sync to complete
		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()
			return len(syncedInSecondCall) >= 1
		}, 10*time.Second, 100*time.Millisecond, "Second sync should complete with new user")

		// Wait for cursor to be updated after second sync
		var secondSyncCursor int64
		require.Eventually(t, func() bool {
			scr, err = ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
			if err != nil {
				return false
			}
			secondSyncCursor = scr.LastMembersSyncAt
			return secondSyncCursor > firstSyncCursor
		}, 10*time.Second, 100*time.Millisecond, "Cursor should advance after second sync")

		// Verify incremental sync
		assert.GreaterOrEqual(t, len(syncedInFirstCall), 2, "First sync should include initial users")
		assert.Contains(t, syncedInSecondCall, user3.Id, "Second sync should include only new user")
		assert.NotContains(t, syncedInSecondCall, user1.Id, "Second sync should not re-sync existing users")
		assert.NotContains(t, syncedInSecondCall, user2.Id, "Second sync should not re-sync existing users")
	})
	t.Run("Test 4: Sync failure and recovery", func(t *testing.T) {
		t.Skip("MM-64687")
		// This test verifies that membership sync handles remote server failures gracefully
		// and successfully syncs members once the remote server recovers.
		// We test that:
		// 1. Sync attempts are made even when the remote server returns errors
		// 2. No members are synced during failure mode
		// 3. Once the server recovers, sync completes successfully
		EnsureCleanState(t, th, ss)
		var syncAttempts int32
		var failureMode atomic.Bool
		failureMode.Store(true)
		var successfulSyncs []string
		var selfCluster *model.RemoteCluster
		var syncHandler *SelfReferentialSyncHandler

		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/v4/remotecluster/msg" {
				atomic.AddInt32(&syncAttempts, 1)

				if failureMode.Load() {
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = w.Write([]byte(`{"error":"simulated failure"}`))
					return
				}

				if syncHandler != nil {
					syncHandler.HandleRequest(w, r)
				} else {
					writeOKResponse(w)
				}
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer.Close()

		// Create and share channel
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "failure-recovery-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		_, shareErr := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, shareErr)

		// Create self-referential remote cluster
		selfCluster = &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster-failure",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Share channel with self
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          selfCluster.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastMembersSyncAt: 0,
		}
		_, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Initialize sync handler with callbacks
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnBatchSync = func(userIds []string, messageNumber int32) {
			successfulSyncs = append(successfulSyncs, userIds...)
		}
		syncHandler.OnIndividualSync = func(userId string, messageNumber int32) {
			successfulSyncs = append(successfulSyncs, userId)
		}

		// Add a user to sync
		testUser := th.CreateUser(t)
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, testUser.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, testUser, channel, false)
		require.Nil(t, appErr)

		// First sync attempt - will fail
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Wait for first sync attempt with more robust checking
		require.Eventually(t, func() bool {
			attempts := atomic.LoadInt32(&syncAttempts)
			return attempts > 0
		}, 15*time.Second, 100*time.Millisecond, "Should have attempted sync during failure mode")

		initialAttempts := atomic.LoadInt32(&syncAttempts)
		assert.Greater(t, initialAttempts, int32(0), "Should have attempted sync")
		assert.Empty(t, successfulSyncs, "No successful syncs during failure mode")

		// Recover from failure mode
		failureMode.Store(false)

		// Second sync attempt - should succeed
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Wait for successful sync with more robust checking
		require.Eventually(t, func() bool {
			return slices.Contains(successfulSyncs, testUser.Id)
		}, 15*time.Second, 100*time.Millisecond, "Should have successful sync after recovery")

		// Verify recovery
		finalAttempts := atomic.LoadInt32(&syncAttempts)
		assert.Greater(t, finalAttempts, initialAttempts, "Should have retried after recovery")
	})
	t.Run("Test 5: Manual sync with cursor management", func(t *testing.T) {
		// This test verifies manual sync using SyncAllChannelMembers with complete cursor management:
		// 1. Initial sync of 10 users with cursor tracking
		// 2. Mixed operations: remove 3 users and add 5 new users
		// 3. Verifies all operations are properly synced and cursor is updated correctly
		// 4. Validates that the LastMembersSyncAt cursor advances after each sync operation
		EnsureCleanState(t, th, ss)
		var totalSyncMessages int32
		var addOperations int32
		var removeOperations int32
		var selfCluster *model.RemoteCluster

		// Create sync handler
		syncHandler := &SelfReferentialSyncHandler{
			t:                t,
			service:          service,
			selfCluster:      nil, // Will be set later
			syncMessageCount: &totalSyncMessages,
		}

		// Create test HTTP server
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/v4/remotecluster/msg" {
				bodyBytes, _ := io.ReadAll(r.Body)

				// Count add and remove operations
				var frame model.RemoteClusterFrame
				if json.Unmarshal(bodyBytes, &frame) == nil {
					var syncMsg model.SyncMsg
					if json.Unmarshal(frame.Msg.Payload, &syncMsg) == nil && frame.Msg.Topic == "sharedchannel_membership" {
						// Count membership changes from the unified field
						for _, change := range syncMsg.MembershipChanges {
							if change.IsAdd {
								atomic.AddInt32(&addOperations, 1)
							} else {
								atomic.AddInt32(&removeOperations, 1)
							}
						}
					}
				}

				// Restore body and handle with sync handler
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
				if selfCluster != nil {
					syncHandler.selfCluster = selfCluster
					syncHandler.HandleRequest(w, r)
					return
				}
			}
			writeOKResponse(w)
		}))
		defer testServer.Close()

		// Create and share channel
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "full-sync-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		_, shareErr := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, shareErr)

		// Create self-referential remote cluster
		selfCluster = &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster-full",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		syncHandler.selfCluster = selfCluster

		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          selfCluster.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastMembersSyncAt: 0,
		}
		_, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Refresh the channel object to get the updated Shared field
		channel, appErr := th.App.GetChannel(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.True(t, channel.IsShared(), "Channel should be marked as shared")

		// Phase 1: Add initial batch of users
		initialUsers := make([]*model.User, 10)
		for i := range 10 {
			initialUsers[i] = th.CreateUser(t)
			_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, initialUsers[i].Id, th.BasicUser.Id)
			require.Nil(t, appErr)
			_, appErr = th.App.AddUserToChannel(th.Context, initialUsers[i], channel, false)
			require.Nil(t, appErr)
		}

		// Get initial cursor value
		initialScr, scrErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
		require.NoError(t, scrErr)
		initialCursor := initialScr.LastMembersSyncAt

		// Initial sync
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Wait for initial sync to complete
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&addOperations) >= 10
		}, 10*time.Second, 100*time.Millisecond, "Should sync all initial users")

		initialAdds := atomic.LoadInt32(&addOperations)
		assert.GreaterOrEqual(t, initialAdds, int32(10), "Should sync all initial users")

		// Verify cursor was updated after initial sync
		require.Eventually(t, func() bool {
			updatedScr, getErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
			return getErr == nil && updatedScr.LastMembersSyncAt > initialCursor
		}, 10*time.Second, 100*time.Millisecond, "Cursor should be updated after initial sync")

		// Get cursor after initial sync
		afterInitialScr, getErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
		require.NoError(t, getErr)
		cursorAfterInitial := afterInitialScr.LastMembersSyncAt

		// Phase 2: Mixed operations - remove some, add new ones
		// Remove first 3 users
		for i := range 3 {
			appErr := th.App.RemoveUserFromChannel(th.Context, initialUsers[i].Id, th.SystemAdminUser.Id, channel)
			require.Nil(t, appErr)
		}

		// Add 5 new users
		newUsers := make([]*model.User, 5)
		for i := range 5 {
			newUsers[i] = th.CreateUser(t)
			_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, newUsers[i].Id, th.BasicUser.Id)
			require.Nil(t, appErr)
			_, appErr = th.App.AddUserToChannel(th.Context, newUsers[i], channel, false)
			require.Nil(t, appErr)
		}

		// Sync mixed changes
		previousMessages := atomic.LoadInt32(&totalSyncMessages)

		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Wait for mixed changes sync to complete
		require.Eventually(t, func() bool {
			messages := atomic.LoadInt32(&totalSyncMessages)
			removes := atomic.LoadInt32(&removeOperations)
			return messages > previousMessages && removes >= 3
		}, 10*time.Second, 100*time.Millisecond, "Should sync mixed changes")

		// Verify cursor was updated after mixed operations sync
		require.Eventually(t, func() bool {
			finalScr, finalErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
			return finalErr == nil && finalScr.LastMembersSyncAt > cursorAfterInitial
		}, 10*time.Second, 100*time.Millisecond, "Cursor should be updated after mixed operations sync")

		// Verify final state
		members, membersErr := ss.Channel().GetMembers(model.ChannelMembersGetOptions{
			ChannelID: channel.Id,
			Limit:     100,
		})
		require.NoError(t, membersErr)

		expectedMembers := 10 - 3 + 5 + 1 // initial - removed + added + system admin
		assert.Equal(t, expectedMembers, len(members), "Should have correct final member count")

		finalMessages := atomic.LoadInt32(&totalSyncMessages)
		finalAdds := atomic.LoadInt32(&addOperations)
		finalRemoves := atomic.LoadInt32(&removeOperations)

		assert.Greater(t, finalMessages, int32(0), "Should have sync messages")
		assert.Greater(t, finalAdds, int32(0), "Should have add operations")
		assert.GreaterOrEqual(t, finalRemoves, int32(3), "Should have remove operations")
	})
	t.Run("Test 6: Multiple remote clusters", func(t *testing.T) {
		// This test verifies membership sync across multiple remote clusters:
		// 1. Adding users syncs to all 3 remote clusters
		// 2. Changes from one cluster propagate through our server to other clusters
		// 3. Removals sync to all clusters
		EnsureCleanState(t, th, ss)
		var totalSyncMessages int32
		var syncMessagesPerCluster = make(map[string]*int32)

		// Create multiple test HTTP servers to simulate different remote clusters
		clusters := make([]*model.RemoteCluster, 3)
		testServers := make([]*httptest.Server, 3)
		syncHandlers := make([]*SelfReferentialSyncHandler, 3)

		// Create 3 remote clusters and their servers
		for i := range 3 {
			clusterName := fmt.Sprintf("cluster-%d", i+1)
			var count int32
			syncMessagesPerCluster[clusterName] = &count

			// Create sync handler for this cluster
			syncHandlers[i] = &SelfReferentialSyncHandler{
				t:                t,
				service:          service,
				selfCluster:      nil, // Will be set later
				syncMessageCount: &totalSyncMessages,
			}

			// Create test server for this cluster
			idx := i // Capture index for closure
			testServers[i] = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/api/v4/remotecluster/msg" {
					clusterName := fmt.Sprintf("cluster-%d", idx+1)
					atomic.AddInt32(syncMessagesPerCluster[clusterName], 1)

					// Read body
					bodyBytes, readErr := io.ReadAll(r.Body)
					if readErr != nil {
						writeOKResponse(w)
						return
					}

					r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

					// Handle with the appropriate sync handler
					if clusters[idx] != nil {
						syncHandlers[idx].selfCluster = clusters[idx]
						syncHandlers[idx].HandleRequest(w, r)
						return
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

		// Create a new team for this test to avoid team member limits
		team := th.CreateTeam(t)

		// Create and share channel in the new team
		channel := &model.Channel{
			TeamId:      team.Id,
			Name:        "multi-cluster-test-channel",
			DisplayName: "Multi Cluster Test Channel",
			Type:        model.ChannelTypeOpen,
		}
		var appErr *model.AppError
		channel, appErr = th.App.CreateChannel(th.Context, channel, false)
		require.Nil(t, appErr)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    team.Id,
			Home:      true,
			ShareName: "multi-cluster-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "", // Empty means sync to all remotes
		}
		_, shareErr := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, shareErr)

		// Create remote clusters
		for i := range 3 {
			clusters[i] = &model.RemoteCluster{
				RemoteId:    model.NewId(),
				Name:        fmt.Sprintf("cluster-%d", i+1),
				SiteURL:     testServers[i].URL,
				CreateAt:    model.GetMillis(),
				LastPingAt:  model.GetMillis(),
				Token:       model.NewId(),
				CreatorId:   th.BasicUser.Id,
				RemoteToken: model.NewId(),
			}
			clusters[i], err = ss.RemoteCluster().Save(clusters[i])
			require.NoError(t, err)

			// Share channel with this cluster
			scr := &model.SharedChannelRemote{
				Id:                model.NewId(),
				ChannelId:         channel.Id,
				CreatorId:         th.BasicUser.Id,
				RemoteId:          clusters[i].RemoteId,
				IsInviteAccepted:  true,
				IsInviteConfirmed: true,
				LastMembersSyncAt: 0,
			}
			_, err = ss.SharedChannel().SaveRemote(scr)
			require.NoError(t, err)
		}

		// Add users to channel - they should sync to all remote clusters
		users := make([]*model.User, 5)
		for i := range 5 {
			users[i] = th.CreateUser(t)
			_, _, addErr := th.App.AddUserToTeam(th.Context, team.Id, users[i].Id, th.BasicUser.Id)
			require.Nil(t, addErr)
			_, addErr = th.App.AddUserToChannel(th.Context, users[i], channel, false)
			require.Nil(t, addErr)
		}

		// Sync to all clusters - need to sync each one individually
		for _, cluster := range clusters {
			err = service.SyncAllChannelMembers(channel.Id, cluster.RemoteId, nil)
			require.NoError(t, err)
		}

		// Wait for syncs to complete
		require.Eventually(t, func() bool {
			// Each cluster should receive at least 5 sync messages (one per user)
			for _, countPtr := range syncMessagesPerCluster {
				if atomic.LoadInt32(countPtr) < 5 {
					return false
				}
			}
			return true
		}, 10*time.Second, 100*time.Millisecond, "All clusters should receive sync messages")

		// Verify each cluster received messages
		for name, countPtr := range syncMessagesPerCluster {
			finalCount := atomic.LoadInt32(countPtr)
			assert.GreaterOrEqual(t, finalCount, int32(5),
				"Cluster %s should receive at least 5 sync messages", name)
		}

		// Part 2: Test propagation from one cluster through another
		// This simulates cluster-2 receiving a membership change and propagating it

		// Reset counters
		atomic.StoreInt32(&totalSyncMessages, 0)
		for _, countPtr := range syncMessagesPerCluster {
			atomic.StoreInt32(countPtr, 0)
		}

		// Create a new user that will be added "by cluster-2"
		userFromCluster2 := th.CreateUser(t)
		_, _, appErr = th.App.AddUserToTeam(th.Context, team.Id, userFromCluster2.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Create a sync message as if it came from cluster-2 adding this user
		syncMsg := model.NewSyncMsg(channel.Id)
		syncMsg.MembershipChanges = []*model.MembershipChangeMsg{
			{
				ChannelId:  channel.Id,
				UserId:     userFromCluster2.Id,
				IsAdd:      true,
				RemoteId:   clusters[1].RemoteId, // from cluster-2
				ChangeTime: model.GetMillis(),
			},
		}

		// Wrap it in a RemoteClusterMsg
		payload, payloadErr := syncMsg.ToJSON()
		require.NoError(t, payloadErr)

		rcMsg := model.RemoteClusterMsg{
			Topic:   sharedchannel.TopicSync,
			Payload: payload,
		}

		// Simulate cluster-2 sending this change to our server
		// This should trigger our server to propagate to other clusters
		response := &remotecluster.Response{}
		err = service.OnReceiveSyncMessageForTesting(rcMsg, clusters[1], response)
		require.NoError(t, err)

		// Our server should now propagate this change to cluster-1 and cluster-3
		// Wait for the propagation to happen
		require.Eventually(t, func() bool {
			count3 := atomic.LoadInt32(syncMessagesPerCluster["cluster-3"])
			// We expect at least cluster-3 to receive the propagated change
			return count3 >= 1
		}, 10*time.Second, 100*time.Millisecond, "Change should propagate to other clusters")

		// Verify the user was added locally
		member, memberErr := ss.Channel().GetMember(th.Context, channel.Id, userFromCluster2.Id)
		require.NoError(t, memberErr, "User should be a member after receiving sync from cluster-2")
		require.Equal(t, userFromCluster2.Id, member.UserId)

		// Verify cluster-3 received the propagated change
		finalCount3 := atomic.LoadInt32(syncMessagesPerCluster["cluster-3"])
		assert.GreaterOrEqual(t, finalCount3, int32(1),
			"cluster-3 should receive propagated sync from our server")

		// Part 3: Test removal syncing to all clusters

		// Reset counters
		atomic.StoreInt32(&totalSyncMessages, 0)
		for _, countPtr := range syncMessagesPerCluster {
			atomic.StoreInt32(countPtr, 0)
		}

		// Remove a user - should sync to all clusters
		appErr = th.App.RemoveUserFromChannel(th.Context, users[0].Id, th.SystemAdminUser.Id, channel)
		require.Nil(t, appErr)

		// Sync removal to all clusters
		for _, cluster := range clusters {
			err = service.SyncAllChannelMembers(channel.Id, cluster.RemoteId, nil)
			require.NoError(t, err)
		}

		// Wait for removal sync
		require.Eventually(t, func() bool {
			perCluster := make(map[string]int32)
			for name, countPtr := range syncMessagesPerCluster {
				perCluster[name] = atomic.LoadInt32(countPtr)
			}

			// Each cluster should receive at least 1 sync message for the removal
			allClustersReceived := true
			for _, count := range perCluster {
				if count < 1 {
					allClustersReceived = false
					break
				}
			}
			return allClustersReceived
		}, 10*time.Second, 100*time.Millisecond, "All clusters should receive removal sync")
	})
	t.Run("Test 7: Feature flag disabled", func(t *testing.T) {
		// This test verifies that the shared channel membership sync functionality respects the feature flag.
		// It tests two scenarios:
		// 1. When the feature flag is disabled, no sync messages should be sent even when SyncAllChannelMembers is called
		// 2. When the feature flag is enabled, sync messages should be sent as expected
		// This ensures that the feature can be safely disabled in production without triggering unintended syncs
		EnsureCleanState(t, th, ss)
		var syncMessageCount int32

		// Disable feature flag from the beginning to prevent any automatic sync
		os.Setenv("MM_FEATUREFLAGS_ENABLESHAREDCHANNELMEMBERSYNC", "false")
		rErr := th.App.ReloadConfig()
		require.NoError(t, rErr)

		// Create test HTTP server that counts sync messages
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/v4/remotecluster/msg" {
				atomic.AddInt32(&syncMessageCount, 1)
			}
			writeOKResponse(w)
		}))
		defer testServer.Close()

		// Create and share channel
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "feature-flag-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		_, shareErr := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, shareErr)

		// Create self-referential remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster-flag-test",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Share channel with self
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          selfCluster.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastMembersSyncAt: 0,
		}
		_, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Test 1: Sync with feature flag disabled
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.EnableSharedChannelsMemberSync = false
		})

		// Add users to the channel after disabling the feature flag
		for range 3 {
			user := th.CreateUser(t)
			_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, th.BasicUser.Id)
			require.Nil(t, appErr)
			_, appErr = th.App.AddUserToChannel(th.Context, user, channel, false)
			require.Nil(t, appErr)
		}

		atomic.StoreInt32(&syncMessageCount, 0)
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Verify no sync messages were sent
		require.Never(t, func() bool {
			return atomic.LoadInt32(&syncMessageCount) > 0
		}, 2*time.Second, 100*time.Millisecond, "No sync should occur with feature flag disabled")

		// Test 2: Sync with feature flag enabled
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.EnableSharedChannelsMemberSync = true
		})

		atomic.StoreInt32(&syncMessageCount, 0)
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Verify sync messages were sent
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncMessageCount) > 0
		}, 5*time.Second, 100*time.Millisecond, "Sync should occur with feature flag enabled")
	})
	t.Run("Test 8: Sync Task After Connection Becomes Available", func(t *testing.T) {
		// This test verifies that membership sync works correctly when a remote cluster
		// reconnects after being offline. We simulate a cluster that has been unavailable
		// (old LastPingAt timestamp) and then comes back online.
		// Expected behavior:
		// 1. Cluster is created with old LastPingAt (simulating previous offline state)
		// 2. When LastPingAt is updated (cluster comes online), sync should work
		// 3. All channel members should be synced successfully
		// 4. Cursor (LastMembersSyncAt) should be updated after successful sync
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

		// Create channel and share it
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "reconnect-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		_, shareErr := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, shareErr)

		// Create remote cluster that was previously offline (old LastPingAt)
		selfCluster := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster-reconnect",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis() - 300000, // Created 5 minutes ago
			LastPingAt:  model.GetMillis() - 120000, // Last ping 2 minutes ago
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Share channel with self
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          selfCluster.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastMembersSyncAt: 0,
		}
		_, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnBatchSync = func(userIds []string, messageNumber int32) {
			syncTaskCreated.Store(true)
		}

		// Add some users to sync
		for range 3 {
			user := th.CreateUser(t)
			_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, th.BasicUser.Id)
			require.Nil(t, appErr)
			_, appErr = th.App.AddUserToChannel(th.Context, user, channel, false)
			require.Nil(t, appErr)
		}

		// Update LastPingAt to simulate cluster coming back online
		selfCluster.LastPingAt = model.GetMillis()
		_, err = ss.RemoteCluster().Update(selfCluster)
		require.NoError(t, err)

		// Trigger membership sync as would happen when connection is restored
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Verify sync task was created and executed with more generous timeout
		require.Eventually(t, func() bool {
			return syncTaskCreated.Load()
		}, 15*time.Second, 200*time.Millisecond, "Sync should execute when cluster comes back online")

		// Wait for async task queue to be processed
		require.Eventually(t, func() bool {
			return !service.HasPendingTasksForTesting()
		}, 10*time.Second, 200*time.Millisecond, "All async sync tasks should be completed")

		// Verify cursor was updated with extended timeout
		require.Eventually(t, func() bool {
			updatedScr, scrErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
			return scrErr == nil && updatedScr.LastMembersSyncAt > 0
		}, 20*time.Second, 200*time.Millisecond, "Cursor should be updated after sync")
	})
	t.Run("Test 9: Remote Cluster Offline During Sync", func(t *testing.T) {
		// This test verifies graceful failure handling when a remote cluster goes offline
		// during the sync operation. We simulate a server that works initially but then
		// becomes unavailable during subsequent sync attempts.
		// Expected behavior:
		// 1. First sync succeeds and updates the cursor
		// 2. Server goes offline for the second sync attempt
		// 3. Second sync fails gracefully without errors
		// 4. Cursor remains at the value from the successful first sync (no corruption)
		// 5. No partial data is persisted from the failed sync
		EnsureCleanState(t, th, ss)

		var syncAttempts int32
		var serverOnline atomic.Bool
		serverOnline.Store(true)
		var syncHandler *SelfReferentialSyncHandler

		// Create test HTTP server that can simulate going offline
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !serverOnline.Load() {
				// Simulate server being offline
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}

			if r.URL.Path == "/api/v4/remotecluster/msg" {
				currentAttempt := atomic.AddInt32(&syncAttempts, 1)
				// On second sync cycle, go offline (allow first full sync to complete)
				if currentAttempt > 2 {
					serverOnline.Store(false)
					w.WriteHeader(http.StatusServiceUnavailable)
					return
				}

				// First sync succeeds - use sync handler if available for all requests in first sync
				if syncHandler != nil {
					syncHandler.HandleRequest(w, r)
					return
				}
			}
			writeOKResponse(w)
		}))
		defer testServer.Close()

		// Create channel and share it
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    th.BasicTeam.Id,
			Home:      true,
			ShareName: "offline-test",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		_, shareErr := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, shareErr)

		// Create remote cluster
		selfCluster := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster-offline",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Share channel with self
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			RemoteId:          selfCluster.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			LastMembersSyncAt: 0,
		}
		_, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Add users to sync - use more than batch size to test batch sync
		// Default batch size is 20, so use 25 users to ensure batch processing
		for range 25 {
			user := th.CreateUser(t)
			_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, th.BasicUser.Id)
			require.Nil(t, appErr)
			_, appErr = th.App.AddUserToChannel(th.Context, user, channel, false)
			require.Nil(t, appErr)
		}

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)

		// First sync should succeed
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err)

		// Wait for first sync with more generous timeout
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncAttempts) >= 1
		}, 15*time.Second, 200*time.Millisecond, "Should complete first sync")

		// Wait for cursor to be updated after first sync
		var firstCursor int64
		require.Eventually(t, func() bool {
			scr1, scrErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
			if scrErr != nil {
				return false
			}
			firstCursor = scr1.LastMembersSyncAt
			return firstCursor > 0
		}, 10*time.Second, 200*time.Millisecond, "Cursor should be set after first sync")

		// Add more users to ensure we still have > 20 total for batch sync
		for range 5 {
			user := th.CreateUser(t)
			_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, th.BasicUser.Id)
			require.Nil(t, appErr)
			_, appErr = th.App.AddUserToChannel(th.Context, user, channel, false)
			require.Nil(t, appErr)
		}

		// Second sync should fail (server goes offline)
		err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
		require.NoError(t, err) // Method itself shouldn't error

		// Wait for second sync attempt with more generous timeout
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&syncAttempts) >= 2
		}, 20*time.Second, 200*time.Millisecond, "Should attempt second sync")

		// Wait for any cursor updates to complete and verify cursor was not updated
		require.Never(t, func() bool {
			scr2, scrErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
			if scrErr != nil {
				return false
			}
			return scr2.LastMembersSyncAt > firstCursor
		}, 5*time.Second, 200*time.Millisecond, "Cursor should not update when sync fails")
	})
	t.Run("Test 10: Users in Multiple Shared Channels", func(t *testing.T) {
		// This test verifies deduplication when users belong to multiple shared channels.
		// Unlike global user sync which syncs users once regardless of channel membership,
		// membership sync operates per channel and must handle users in multiple channels.
		// Test setup:
		// - user1: member of all 3 shared channels
		// - user2: member of 2 shared channels (channel1 and channel2)
		// - user3: member of 1 shared channel (channel3)
		// Expected behavior:
		// - Each user is synced exactly once per channel they belong to
		// - No duplicate sync messages for the same user in the same channel
		// - Users not in a channel are not synced for that channel
		EnsureCleanState(t, th, ss)

		var syncedChannelUsers = make(map[string][]string) // channelId -> userIds
		var mu sync.Mutex
		var syncHandler *SelfReferentialSyncHandler
		var testServer *httptest.Server
		var totalSyncMessages int32

		// Create users
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		user3 := th.CreateUser(t)

		// Add users to team
		th.LinkUserToTeam(t, user1, th.BasicTeam)
		th.LinkUserToTeam(t, user2, th.BasicTeam)
		th.LinkUserToTeam(t, user3, th.BasicTeam)

		// Create multiple shared channels
		channel1 := th.CreateChannel(t, th.BasicTeam)
		channel2 := th.CreateChannel(t, th.BasicTeam)
		channel3 := th.CreateChannel(t, th.BasicTeam)

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

		// First create the remote cluster with a placeholder URL
		selfCluster := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "self-cluster-multi-channel",
			SiteURL:     "http://placeholder",
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Initialize sync handler before creating the test server
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)

		// Create a wrapper handler to intercept sync messages
		testServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Intercept and track channel syncs
			if r.URL.Path == "/api/v4/remotecluster/msg" {
				bodyBytes, pErr := io.ReadAll(r.Body)
				if pErr == nil {
					// Restore body for actual handler
					r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

					var frame model.RemoteClusterFrame
					if json.Unmarshal(bodyBytes, &frame) == nil {
						var syncMsg model.SyncMsg
						if json.Unmarshal(frame.Msg.Payload, &syncMsg) == nil {
							mu.Lock()
							channelId := syncMsg.ChannelId
							if channelId != "" {
								if _, ok := syncedChannelUsers[channelId]; !ok {
									syncedChannelUsers[channelId] = []string{}
								}

								// Add all users from membership changes
								for _, change := range syncMsg.MembershipChanges {
									if change.IsAdd {
										syncedChannelUsers[channelId] = append(syncedChannelUsers[channelId], change.UserId)
										atomic.AddInt32(&totalSyncMessages, 1)
									}
								}
							}
							mu.Unlock()
						}
					}
				}
			}

			// Call the actual sync handler
			syncHandler.HandleRequest(w, r)
		}))
		defer testServer.Close()

		// Update the cluster with the actual test server URL
		selfCluster.SiteURL = testServer.URL
		_, err = ss.RemoteCluster().Update(selfCluster)
		require.NoError(t, err)

		// Make channels shared
		for i, channel := range []*model.Channel{channel1, channel2, channel3} {
			sc := &model.SharedChannel{
				ChannelId: channel.Id,
				TeamId:    th.BasicTeam.Id,
				RemoteId:  selfCluster.RemoteId,
				Home:      true,
				ReadOnly:  false,
				ShareName: fmt.Sprintf("channel%d", i+1),
				CreatorId: th.BasicUser.Id,
			}
			_, err = ss.SharedChannel().Save(sc)
			require.NoError(t, err)

			scr := &model.SharedChannelRemote{
				Id:                model.NewId(),
				ChannelId:         channel.Id,
				CreatorId:         th.BasicUser.Id,
				RemoteId:          selfCluster.RemoteId,
				IsInviteAccepted:  true,
				IsInviteConfirmed: true,
				LastMembersSyncAt: 0,
			}
			_, err = ss.SharedChannel().SaveRemote(scr)
			require.NoError(t, err)
		}

		// Sync memberships for each channel separately
		for _, channel := range []*model.Channel{channel1, channel2, channel3} {
			err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
			require.NoError(t, err)
		}

		// Ensure the sync handler is ready by waiting for the first message
		require.Eventually(t, func() bool {
			return atomic.LoadInt32(&totalSyncMessages) > 0
		}, 10*time.Second, 50*time.Millisecond, "Expected at least one sync message to be sent")

		// Calculate expected number of sync messages
		// channel1: user1, user2, BasicUser = 3
		// channel2: user1, user2, BasicUser = 3
		// channel3: user1, user3, BasicUser = 3
		// Total: 9 sync messages (one per user per channel)
		expectedSyncMessages := int32(9)

		// Wait for all sync messages to be processed with detailed debugging
		require.Eventually(t, func() bool {
			currentMessages := atomic.LoadInt32(&totalSyncMessages)

			mu.Lock()
			channelCount := len(syncedChannelUsers)
			var totalUsers int
			for _, users := range syncedChannelUsers {
				totalUsers += len(users)
			}
			mu.Unlock()

			// Log progress for debugging
			if currentMessages < expectedSyncMessages {
				t.Logf("Waiting for sync messages: %d/%d received, %d channels synced, %d total users",
					currentMessages, expectedSyncMessages, channelCount, totalUsers)
			}

			return currentMessages >= expectedSyncMessages
		}, 30*time.Second, 200*time.Millisecond,
			fmt.Sprintf("Expected %d sync messages, but got %d", expectedSyncMessages, atomic.LoadInt32(&totalSyncMessages)))

		// Verify we have complete data for all channels
		require.Eventually(t, func() bool {
			mu.Lock()
			defer mu.Unlock()

			// Verify we have sync data for all 3 channels
			if len(syncedChannelUsers) != 3 {
				return false
			}

			// Verify each channel has the expected number of users
			channel1Users, ok1 := syncedChannelUsers[channel1.Id]
			channel2Users, ok2 := syncedChannelUsers[channel2.Id]
			channel3Users, ok3 := syncedChannelUsers[channel3.Id]

			if !ok1 || !ok2 || !ok3 {
				return false
			}

			// Count unique users per channel
			channel1Count := len(getUniqueUsers(channel1Users))
			channel2Count := len(getUniqueUsers(channel2Users))
			channel3Count := len(getUniqueUsers(channel3Users))

			// channel1 should have user1, user2, BasicUser = 3
			// channel2 should have user1, user2, BasicUser = 3
			// channel3 should have user1, user3, BasicUser = 3
			expectedCounts := channel1Count == 3 && channel2Count == 3 && channel3Count == 3

			if !expectedCounts {
				t.Logf("Channel user counts - channel1: %d, channel2: %d, channel3: %d",
					channel1Count, channel2Count, channel3Count)
			}

			return expectedCounts
		}, 30*time.Second, 200*time.Millisecond, "Expected all channels to have their users synced")

		// Verify each user is synced exactly once per channel they belong to
		mu.Lock()
		defer mu.Unlock()

		// Verify channel1 synced user1, user2, and BasicUser
		channel1Users := syncedChannelUsers[channel1.Id]
		userCount1 := make(map[string]int)
		for _, userId := range channel1Users {
			userCount1[userId]++
		}
		assert.Equal(t, 1, userCount1[user1.Id], "User1 should be synced exactly once for channel1")
		assert.Equal(t, 1, userCount1[user2.Id], "User2 should be synced exactly once for channel1")
		assert.Equal(t, 0, userCount1[user3.Id], "User3 should not be synced for channel1")

		// Verify channel2 synced user1, user2, and BasicUser
		channel2Users := syncedChannelUsers[channel2.Id]
		userCount2 := make(map[string]int)
		for _, userId := range channel2Users {
			userCount2[userId]++
		}
		assert.Equal(t, 1, userCount2[user1.Id], "User1 should be synced exactly once for channel2")
		assert.Equal(t, 1, userCount2[user2.Id], "User2 should be synced exactly once for channel2")
		assert.Equal(t, 0, userCount2[user3.Id], "User3 should not be synced for channel2")

		// Verify channel3 synced user1, user3, and BasicUser
		channel3Users := syncedChannelUsers[channel3.Id]
		userCount3 := make(map[string]int)
		for _, userId := range channel3Users {
			userCount3[userId]++
		}
		assert.Equal(t, 1, userCount3[user1.Id], "User1 should be synced exactly once for channel3")
		assert.Equal(t, 0, userCount3[user2.Id], "User2 should not be synced for channel3")
		assert.Equal(t, 1, userCount3[user3.Id], "User3 should be synced exactly once for channel3")
	})
	// t.Run("Test 11: Strengthened conflict resolution", func(t *testing.T) {
	// 	// This test verifies robust handling of conflicting membership states between multiple clusters.
	// 	// Strengthened conflict scenarios tested:
	// 	// 1. Basic conflict: user removed from one cluster but not another
	// 	// 2. Re-addition after partial sync: user re-added after being synced to only one cluster
	// 	// 3. Cursor consistency: verify sync cursors are properly updated across conflict resolution
	// 	// 4. Post-conflict operations: ensure system works correctly after resolving conflicts
	// 	// The test ensures the system correctly resolves conflicts and maintains data consistency
	// 	EnsureCleanState(t, th, ss)
	// 	var syncMessages []model.SyncMsg
	// 	var mu sync.Mutex
	// 	var syncMessageCount int32
	// 	var selfCluster *model.RemoteCluster

	// 	// Create sync handler
	// 	syncHandler := NewSelfReferentialSyncHandler(t, service, nil)

	// 	// Create test HTTP server that tracks sync messages
	// 	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	// 		if r.URL.Path == "/api/v4/remotecluster/msg" {
	// 			atomic.AddInt32(&syncMessageCount, 1)

	// 			// Read body once
	// 			bodyBytes, readErr := io.ReadAll(r.Body)
	// 			if readErr != nil {
	// 				writeOKResponse(w)
	// 				return
	// 			}
	// 			r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	// 			// Capture all sync messages - parse as RemoteClusterFrame
	// 			var frame model.RemoteClusterFrame
	// 			if unmarshalErr := json.Unmarshal(bodyBytes, &frame); unmarshalErr == nil {
	// 				var syncMsg model.SyncMsg
	// 				if payloadErr := json.Unmarshal(frame.Msg.Payload, &syncMsg); payloadErr == nil {
	// 					mu.Lock()
	// 					syncMessages = append(syncMessages, syncMsg)
	// 					mu.Unlock()
	// 				}
	// 			}

	// 			// Handle with sync handler for proper response
	// 			if selfCluster != nil {
	// 				syncHandler.selfCluster = selfCluster
	// 				syncHandler.HandleRequest(w, r)
	// 				return
	// 			}
	// 		}
	// 		writeOKResponse(w)
	// 	}))
	// 	defer testServer.Close()

	// 	// Create and share channel
	// 	channel := th.CreateChannel(t, th.BasicTeam)
	// 	sc := &model.SharedChannel{
	// 		ChannelId: channel.Id,
	// 		TeamId:    th.BasicTeam.Id,
	// 		Home:      true,
	// 		ShareName: "strengthened-conflict-test",
	// 		CreatorId: th.BasicUser.Id,
	// 		RemoteId:  "",
	// 	}
	// 	_, shareErr := th.App.ShareChannel(th.Context, sc)
	// 	require.NoError(t, shareErr)

	// 	// Create self-referential remote cluster
	// 	selfCluster = &model.RemoteCluster{
	// 		RemoteId:    model.NewId(),
	// 		Name:        "self-cluster-strengthened-conflict",
	// 		SiteURL:     testServer.URL,
	// 		CreateAt:    model.GetMillis(),
	// 		LastPingAt:  model.GetMillis(),
	// 		Token:       model.NewId(),
	// 		CreatorId:   th.BasicUser.Id,
	// 		RemoteToken: model.NewId(),
	// 	}
	// 	selfCluster, err = ss.RemoteCluster().Save(selfCluster)
	// 	require.NoError(t, err)

	// 	// Share channel with self
	// 	scr := &model.SharedChannelRemote{
	// 		Id:                model.NewId(),
	// 		ChannelId:         channel.Id,
	// 		CreatorId:         th.BasicUser.Id,
	// 		RemoteId:          selfCluster.RemoteId,
	// 		IsInviteAccepted:  true,
	// 		IsInviteConfirmed: true,
	// 		LastMembersSyncAt: 0,
	// 	}
	// 	_, err = ss.SharedChannel().SaveRemote(scr)
	// 	require.NoError(t, err)

	// 	// Phase 1: Create users for conflict scenarios
	// 	conflictUser1 := th.CreateUser(t)
	// 	conflictUser2 := th.CreateUser(t)

	// 	// Add users to team
	// 	for _, user := range []*model.User{conflictUser1, conflictUser2} {
	// 		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, th.BasicUser.Id)
	// 		require.Nil(t, appErr)
	// 	}

	// 	// Add users to channel initially
	// 	for _, user := range []*model.User{conflictUser1, conflictUser2} {
	// 		_, appErr := th.App.AddUserToChannel(th.Context, user, channel, false)
	// 		require.Nil(t, appErr)
	// 	}

	// 	// Verify users are initially members
	// 	for _, user := range []*model.User{conflictUser1, conflictUser2} {
	// 		_, initialErr := ss.Channel().GetMember(context.Background(), channel.Id, user.Id)
	// 		require.NoError(t, initialErr, "User should be initially a member")
	// 	}

	// 	// Phase 2: Initial sync
	// 	err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
	// 	require.NoError(t, err)

	// 	// Wait for initial sync to complete
	// 	require.Eventually(t, func() bool {
	// 		count := atomic.LoadInt32(&syncMessageCount)
	// 		return count > 0
	// 	}, 15*time.Second, 200*time.Millisecond, "Should have initial sync messages")

	// 	// Get initial cursor
	// 	initialScr, scrErr := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
	// 	require.NoError(t, scrErr)
	// 	initialCursor := initialScr.LastMembersSyncAt

	// 	// Phase 3: Create conflict by removing user locally
	// 	// Temporarily disable automatic sync to prevent interference with manual operations
	// 	th.App.UpdateConfig(func(cfg *model.Config) {
	// 		cfg.FeatureFlags.EnableSharedChannelsMemberSync = false
	// 	})
	// 	rErr := th.App.ReloadConfig()
	// 	require.NoError(t, rErr)

	// 	// Remove conflictUser1 locally
	// 	appErr := th.App.RemoveUserFromChannel(th.Context, conflictUser1.Id, th.SystemAdminUser.Id, channel)
	// 	require.Nil(t, appErr, "Failed to remove conflictUser1")

	// 	// Wait for removal to complete
	// 	require.Eventually(t, func() bool {
	// 		_, err1 := ss.Channel().GetMember(context.Background(), channel.Id, conflictUser1.Id)
	// 		return err1 != nil // User should not be found
	// 	}, 15*time.Second, 200*time.Millisecond, "User should be removed from channel")

	// 	// Phase 4: Re-add user (creating conflict state)
	// 	// Re-add conflictUser1 (simulating conflict between local state and remote state)
	// 	_, appErr = th.App.AddUserToChannel(th.Context, conflictUser1, channel, false)
	// 	require.Nil(t, appErr)

	// 	// Re-enable automatic sync for the conflict resolution phase
	// 	th.App.UpdateConfig(func(cfg *model.Config) {
	// 		cfg.FeatureFlags.EnableSharedChannelsMemberSync = true
	// 	})
	// 	rErr = th.App.ReloadConfig()
	// 	require.NoError(t, rErr)

	// 	// Wait for local operation to complete
	// 	require.Eventually(t, func() bool {
	// 		_, err1 := ss.Channel().GetMember(context.Background(), channel.Id, conflictUser1.Id)
	// 		return err1 == nil // User should be found
	// 	}, 10*time.Second, 200*time.Millisecond, "User should be locally a member after re-adding")

	// 	// Phase 5: Conflict resolution sync
	// 	// Reset message tracking for conflict resolution phase
	// 	atomic.StoreInt32(&syncMessageCount, 0)
	// 	mu.Lock()
	// 	syncMessages = []model.SyncMsg{}
	// 	mu.Unlock()

	// 	err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
	// 	require.NoError(t, err)

	// 	// Wait for conflict resolution sync to complete
	// 	require.Eventually(t, func() bool {
	// 		count := atomic.LoadInt32(&syncMessageCount)
	// 		return count > 0
	// 	}, 20*time.Second, 200*time.Millisecond, "Should receive conflict resolution sync messages")

	// 	// Phase 6: Verification of conflict resolution
	// 	mu.Lock()
	// 	totalMessages := len(syncMessages)
	// 	mu.Unlock()

	// 	// Verify we received sync messages for conflict resolution
	// 	assert.Greater(t, totalMessages, 0, "Should have sync messages for conflict resolution")

	// 	// Verify final membership state is consistent
	// 	expectedMembers := map[string]bool{
	// 		conflictUser1.Id: true, // Re-added, should be member
	// 		conflictUser2.Id: true, // Never removed, should be member
	// 		th.BasicUser.Id:  true, // Basic user, should be member
	// 	}

	// 	for userId, shouldBeMember := range expectedMembers {
	// 		require.Eventually(t, func() bool {
	// 			_, memberErr := ss.Channel().GetMember(context.Background(), channel.Id, userId)
	// 			if shouldBeMember {
	// 				return memberErr == nil
	// 			}
	// 			return memberErr != nil
	// 		}, 10*time.Second, 200*time.Millisecond,
	// 			"User %s membership state should be consistent after conflict resolution", userId)
	// 	}

	// 	// Phase 7: Verify cursor updates
	// 	require.Eventually(t, func() bool {
	// 		scrUpdated, err1 := ss.SharedChannel().GetRemoteByIds(channel.Id, selfCluster.RemoteId)
	// 		return err1 == nil && scrUpdated.LastMembersSyncAt > initialCursor
	// 	}, 15*time.Second, 200*time.Millisecond, "Cluster should have updated sync cursor")

	// 	// Phase 8: Test that new operations after conflict resolution work correctly
	// 	newUser := th.CreateUser(t)
	// 	_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, newUser.Id, th.BasicUser.Id)
	// 	require.Nil(t, appErr)
	// 	_, appErr = th.App.AddUserToChannel(th.Context, newUser, channel, false)
	// 	require.Nil(t, appErr)

	// 	// Reset and sync this new user
	// 	atomic.StoreInt32(&syncMessageCount, 0)
	// 	mu.Lock()
	// 	syncMessages = []model.SyncMsg{}
	// 	mu.Unlock()

	// 	err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
	// 	require.NoError(t, err)

	// 	// Verify the new user is synced correctly
	// 	require.Eventually(t, func() bool {
	// 		mu.Lock()
	// 		defer mu.Unlock()

	// 		// Check if the new user appears in any sync message
	// 		for _, msg := range syncMessages {
	// 			for _, change := range msg.MembershipChanges {
	// 				if change.UserId == newUser.Id && change.IsAdd {
	// 					return true
	// 				}
	// 			}
	// 		}
	// 		return false
	// 	}, 15*time.Second, 200*time.Millisecond, "New user should be synced correctly after conflict resolution")

	// 	// Phase 9: Verify efficiency - no redundant syncs for existing members
	// 	atomic.StoreInt32(&syncMessageCount, 0)
	// 	mu.Lock()
	// 	syncMessages = []model.SyncMsg{}
	// 	mu.Unlock()

	// 	// Trigger another sync - should not send messages for already-synced members
	// 	err = service.SyncAllChannelMembers(channel.Id, selfCluster.RemoteId, nil)
	// 	require.NoError(t, err)

	// 	// Wait for sync completion and verify minimal activity
	// 	// Give time for any sync to complete, then check the final count
	// 	require.Eventually(t, func() bool {
	// 		finalCount := atomic.LoadInt32(&syncMessageCount)
	// 		// Should have minimal activity since all members are already synced
	// 		return finalCount <= 1
	// 	}, 10*time.Second, 200*time.Millisecond, "Should have minimal sync activity for already-synced members")
	// })
}

// Helper function to get unique users from a list
func getUniqueUsers(users []string) map[string]bool {
	unique := make(map[string]bool)
	for _, user := range users {
		unique[user] = true
	}
	return unique
}
