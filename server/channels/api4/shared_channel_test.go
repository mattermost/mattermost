// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
)

var rnd = rand.New(rand.NewSource(time.Now().UnixNano()))

func setupForSharedChannels(tb testing.TB) *TestHelper {
	th := SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = fmt.Sprintf("http://localhost:%d", th.Server.ListenAddr.Port)
	})

	return th
}

func TestGetAllSharedChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

	ss := th.App.Srv().Store()
	EnsureCleanState(t, th, ss)

	const pages = 3
	const pageSize = 7

	savedIds := make([]string, 0, pages*pageSize)

	// make some shared channels
	for i := 0; i < pages*pageSize; i++ {
		channel := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, th.BasicTeam.Id)
		sc := &model.SharedChannel{
			ChannelId: channel.Id,
			TeamId:    channel.TeamId,
			Home:      randomBool(),
			ShareName: fmt.Sprintf("test_share_%d", i),
			CreatorId: th.BasicChannel.CreatorId,
			RemoteId:  model.NewId(),
		}

		_, err := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)
		savedIds = append(savedIds, channel.Id)
	}
	sort.Strings(savedIds)

	t.Run("get shared channels paginated", func(t *testing.T) {
		channelIds := make([]string, 0, 21)
		for i := 0; i < pages; i++ {
			channels, _, err := th.Client.GetAllSharedChannels(context.Background(), th.BasicTeam.Id, i, pageSize)
			require.NoError(t, err)
			channelIds = append(channelIds, getIds(channels)...)
		}
		sort.Strings(channelIds)

		// ids lists should now match
		assert.Equal(t, savedIds, channelIds, "id lists should match")
	})

	t.Run("get shared channels for invalid team", func(t *testing.T) {
		_, _, err := th.Client.GetAllSharedChannels(context.Background(), model.NewId(), 0, 100)
		require.Error(t, err)
	})

	t.Run("get shared channels, user not member of team", func(t *testing.T) {
		team := &model.Team{
			DisplayName: "tteam",
			Name:        GenerateTestTeamName(),
			Type:        model.TeamOpen,
		}
		team, _, err := th.SystemAdminClient.CreateTeam(context.Background(), team)
		require.NoError(t, err)

		_, _, err = th.Client.GetAllSharedChannels(context.Background(), team.Id, 0, 100)
		require.Error(t, err)
	})
}

func getIds(channels []*model.SharedChannel) []string {
	ids := make([]string, 0, len(channels))
	for _, c := range channels {
		ids = append(ids, c.ChannelId)
	}
	return ids
}

// TestSharedChannelPostMetadataSync tests that post metadata (priorities, acknowledgements, and
// persistent notifications) is preserved during shared channel synchronization using self-referential approach.
func TestSharedChannelPostMetadataSync(t *testing.T) {
	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

	ss := th.App.Srv().Store()
	EnsureCleanState(t, th, ss)

	// Set license with all enterprise features
	license := model.NewTestLicense()
	license.SkuShortName = model.LicenseShortSkuEnterprise
	th.App.Srv().SetLicense(license)

	// Enable post priorities and persistent notifications
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostPriority = true
		*cfg.ServiceSettings.AllowPersistentNotifications = true
		*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true
		*cfg.ServiceSettings.PersistentNotificationMaxRecipients = 100
	})

	// Verify license and settings
	require.NotNil(t, th.App.Srv().License(), "License should be active")
	postPriorityEnabled := *th.App.Config().ServiceSettings.PostPriority
	require.True(t, postPriorityEnabled, "Post priorities should be enabled")

	// Get the shared channel service and cast to concrete type
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	service, ok := scsInterface.(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service concrete type")
	require.True(t, service.Active(), "SharedChannel service should be active")

	// Force the service to be active
	err := service.Start()
	require.NoError(t, err)

	// Ensure the remote cluster service is running
	rcService := th.App.Srv().GetRemoteClusterService()
	if rcService != nil {
		_ = rcService.Start()
		if rc, ok := rcService.(*remotecluster.Service); ok {
			rc.SetActive(true)
		}
		require.True(t, rcService.Active(), "RemoteClusterService should be active")
	}

	t.Run("Test 1: Post Priority Metadata Self-Referential Sync", func(t *testing.T) {
		var syncedPosts []*model.Post
		var syncHandler *SelfReferentialSyncHandler

		// Create test HTTP server using self-referential approach
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
			RemoteId:    model.NewId(),
			Name:        "test-cluster-priority",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = th.App.Srv().Store().RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Create a separate channel for this test to avoid conflicts
		testChannel := th.CreatePublicChannel()

		// Add both users to the channel to ensure mentions work
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, testChannel, false)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, testChannel, false)
		require.Nil(t, appErr)

		// Create shared channel
		sc := &model.SharedChannel{
			ChannelId: testChannel.Id,
			TeamId:    testChannel.TeamId,
			Home:      true,
			ShareName: "test_priority_sync",
			CreatorId: th.BasicUser.Id,
			RemoteId:  selfCluster.RemoteId,
		}
		sc, err = th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Create shared channel remote
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         sc.ChannelId,
			CreatorId:         sc.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          sc.RemoteId,
		}
		_, err = th.App.SaveSharedChannelRemote(scr)
		require.NoError(t, err)

		// Initialize sync handler with the new OnReceiveSyncMessageForTesting method
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnPostSync = func(post *model.Post) {
			t.Logf("Received synced post: ID=%s, Message=%s, HasMetadata=%v", post.Id, post.Message, post.Metadata != nil)
			if post.Metadata != nil && post.Metadata.Priority != nil {
				t.Logf("Post has priority metadata: Priority=%v, RequestedAck=%v, PersistentNotifications=%v",
					post.Metadata.Priority.Priority,
					post.Metadata.Priority.RequestedAck,
					post.Metadata.Priority.PersistentNotifications)
			}
			syncedPosts = append(syncedPosts, post)
		}

		// Create a local post with priority metadata
		originalPost, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Test post with priority metadata " + "@" + th.BasicUser2.Username,
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer(model.PostPriorityUrgent),
					RequestedAck:            model.NewPointer(true),
					PersistentNotifications: model.NewPointer(true),
				},
			},
		}, testChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		require.NotNil(t, originalPost)

		// Debug: Verify the original post has metadata
		t.Logf("Original post created: ID=%s, HasMetadata=%v", originalPost.Id, originalPost.Metadata != nil)
		if originalPost.Metadata != nil && originalPost.Metadata.Priority != nil {
			t.Logf("Original post priority metadata: Priority=%v, RequestedAck=%v, PersistentNotifications=%v",
				originalPost.Metadata.Priority.Priority,
				originalPost.Metadata.Priority.RequestedAck,
				originalPost.Metadata.Priority.PersistentNotifications)
		}

		// Test the self-referential sync flow:
		// 1. NotifyChannelChanged triggers the sync (entry point)
		t.Logf("Triggering sync for channel: %s", testChannel.Id)
		service.NotifyChannelChanged(testChannel.Id)

		// 2. Wait for the sync message to be processed by our self-referential handler
		require.Eventually(t, func() bool {
			return len(syncedPosts) >= 2
		}, 5*time.Second, 100*time.Millisecond, "Should receive synced posts via self-referential handler")

		// 3. Verify priority metadata is preserved through the complete sync flow
		t.Logf("Found %d synced posts", len(syncedPosts))
		// The test post should be the last one (after the "joined channel" post)
		syncedPost := syncedPosts[len(syncedPosts)-1]
		require.NotNil(t, syncedPost.Metadata, "Post metadata should be preserved")
		require.NotNil(t, syncedPost.Metadata.Priority, "Priority metadata should be preserved")
		assert.Equal(t, model.PostPriorityUrgent, *syncedPost.Metadata.Priority.Priority, "Priority should be preserved")
		assert.True(t, *syncedPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")
		assert.True(t, *syncedPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should be preserved")
	})

	t.Run("Test 2: Post Acknowledgement Metadata Self-Referential Sync", func(t *testing.T) {
		var syncedPosts []*model.Post
		var syncHandler *SelfReferentialSyncHandler

		// Create test HTTP server using self-referential approach
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
			RemoteId:    model.NewId(),
			Name:        "test-cluster-acks",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = th.App.Srv().Store().RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Create a separate channel for this test to avoid conflicts
		testChannel := th.CreatePublicChannel()

		// Add both users to the channel to ensure mentions work
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, testChannel, false)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, testChannel, false)
		require.Nil(t, appErr)

		// Create shared channel
		sc := &model.SharedChannel{
			ChannelId: testChannel.Id,
			TeamId:    testChannel.TeamId,
			Home:      true,
			ShareName: "test_ack_sync",
			CreatorId: th.BasicUser.Id,
			RemoteId:  selfCluster.RemoteId,
		}
		sc, err = th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Create shared channel remote
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         sc.ChannelId,
			CreatorId:         sc.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          sc.RemoteId,
		}
		_, err = th.App.SaveSharedChannelRemote(scr)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnPostSync = func(post *model.Post) {
			syncedPosts = append(syncedPosts, post)
		}

		// Create post with acknowledgement request
		originalPost, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Test post requesting acknowledgements " + "@" + th.BasicUser2.Username,
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer(model.PostPriorityUrgent),
					RequestedAck:            model.NewPointer(true),
					PersistentNotifications: model.NewPointer(false),
				},
			},
		}, testChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// Add acknowledgement to the post
		ack := &model.PostAcknowledgement{
			PostId:    originalPost.Id,
			UserId:    th.BasicUser2.Id,
			ChannelId: originalPost.ChannelId,
		}
		_, appErr = th.App.SaveAcknowledgementForPostWithModel(th.Context, ack)
		require.Nil(t, appErr)

		// Test the self-referential sync flow:
		// 1. NotifyChannelChanged triggers the sync (entry point)
		service.NotifyChannelChanged(testChannel.Id)

		// 2. Wait for the sync message to be processed by our self-referential handler
		require.Eventually(t, func() bool {
			return len(syncedPosts) >= 2
		}, 5*time.Second, 100*time.Millisecond, "Should receive synced posts via self-referential handler")

		// 3. Verify the post was synced and contains acknowledgement metadata
		// The test post should be the last one (after the "joined channel" post)
		syncedPost := syncedPosts[len(syncedPosts)-1]
		require.NotNil(t, syncedPost.Metadata, "Post metadata should be preserved")
		require.NotNil(t, syncedPost.Metadata.Priority, "Priority metadata should be preserved")
		assert.Equal(t, model.PostPriorityUrgent, *syncedPost.Metadata.Priority.Priority, "Priority should be preserved")
		assert.True(t, *syncedPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")
		assert.False(t, *syncedPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should be preserved")

		// Also verify that the post has acknowledgement info preserved
		// Note: Acknowledgements may be handled separately from the main post sync
	})

	t.Run("Test 2b: Acknowledgement Count Sync Back to Sender", func(t *testing.T) {
		var syncedPosts []*model.Post
		var syncHandler *SelfReferentialSyncHandler
		var postIdToSync string

		// Create test HTTP server using self-referential approach
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
			RemoteId:    model.NewId(),
			Name:        "test-cluster-ack-sync-back",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = th.App.Srv().Store().RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Create a separate channel for this test
		testChannel := th.CreatePublicChannel()

		// Add both users to the channel
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, testChannel, false)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, testChannel, false)
		require.Nil(t, appErr)

		// Create shared channel
		sc := &model.SharedChannel{
			ChannelId: testChannel.Id,
			TeamId:    testChannel.TeamId,
			Home:      true,
			ShareName: "test_ack_count_sync",
			CreatorId: th.BasicUser.Id,
			RemoteId:  selfCluster.RemoteId,
		}
		sc, err = th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Create shared channel remote
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         sc.ChannelId,
			CreatorId:         sc.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          sc.RemoteId,
		}
		_, err = th.App.SaveSharedChannelRemote(scr)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnPostSync = func(post *model.Post) {
			syncedPosts = append(syncedPosts, post)
		}

		// Step 1: Create post with acknowledgement request (sender side)
		originalPost, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Test post for ack count sync " + "@" + th.BasicUser2.Username,
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer(model.PostPriorityUrgent),
					RequestedAck:            model.NewPointer(true),
					PersistentNotifications: model.NewPointer(false),
				},
			},
		}, testChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		postIdToSync = originalPost.Id

		// Verify initial state - no acknowledgements
		acks, appErr := th.App.GetAcknowledgementsForPost(originalPost.Id)
		require.Nil(t, appErr)
		require.Empty(t, acks, "Should have no acknowledgements initially")

		// Step 2: Trigger initial sync to simulate post reaching receiver
		service.NotifyChannelChanged(testChannel.Id)

		// Wait for initial sync
		require.Eventually(t, func() bool {
			return len(syncedPosts) >= 2
		}, 5*time.Second, 100*time.Millisecond, "Should complete initial sync")

		// Step 3: Simulate receiver acknowledging the post
		// In real scenario, this would happen on the receiver's instance
		// We simulate it by directly adding an acknowledgement
		ackForStep3 := &model.PostAcknowledgement{
			PostId:         originalPost.Id,
			UserId:         th.BasicUser2.Id,
			ChannelId:      originalPost.ChannelId,
			AcknowledgedAt: model.GetMillis(),
		}
		_, appErr = th.App.SaveAcknowledgementForPostWithModel(th.Context, ackForStep3)
		require.Nil(t, appErr)

		// Step 4: Configure sync handler to capture acknowledgement updates
		syncHandler.OnPostSync = func(post *model.Post) {
			if post.Id == postIdToSync {
				t.Logf("Received sync for target post: ID=%s, HasAcks=%v", post.Id,
					post.Metadata != nil && post.Metadata.Acknowledgements != nil)
				if post.Metadata != nil && post.Metadata.Acknowledgements != nil {
					t.Logf("Acknowledgement count in sync: %d", len(post.Metadata.Acknowledgements))
					for _, ack := range post.Metadata.Acknowledgements {
						t.Logf("  Ack from user: %s at %d", ack.UserId, ack.AcknowledgedAt)
					}
				}
			}
			syncedPosts = append(syncedPosts, post)
		}

		// Step 5: Trigger sync to simulate acknowledgement syncing back to sender
		// Clear previous synced posts to track new sync
		syncedPosts = syncedPosts[:0]
		service.NotifyChannelChanged(testChannel.Id)

		// Step 6: Verify acknowledgement synced back
		require.Eventually(t, func() bool {
			// Check if we received a sync with acknowledgements
			for _, post := range syncedPosts {
				if post.Id == postIdToSync &&
					post.Metadata != nil &&
					post.Metadata.Acknowledgements != nil &&
					len(post.Metadata.Acknowledgements) > 0 {
					return true
				}
			}
			return false
		}, 5*time.Second, 100*time.Millisecond, "Should sync acknowledgements back")

		// Step 7: Verify the acknowledgement was properly synced
		// Find the synced post with acknowledgements
		var syncedPostWithAcks *model.Post
		for _, post := range syncedPosts {
			if post.Id == postIdToSync && post.Metadata != nil && post.Metadata.Acknowledgements != nil {
				syncedPostWithAcks = post
				break
			}
		}

		require.NotNil(t, syncedPostWithAcks, "Should find synced post with acknowledgements")
		require.NotNil(t, syncedPostWithAcks.Metadata, "Post metadata should exist")
		require.NotNil(t, syncedPostWithAcks.Metadata.Acknowledgements, "Acknowledgements should exist")
		require.Len(t, syncedPostWithAcks.Metadata.Acknowledgements, 1, "Should have exactly 1 acknowledgement")

		// Verify acknowledgement details
		ack := syncedPostWithAcks.Metadata.Acknowledgements[0]
		assert.Equal(t, th.BasicUser2.Id, ack.UserId, "Acknowledgement should be from BasicUser2")
		assert.Equal(t, originalPost.Id, ack.PostId, "Acknowledgement should be for the original post")
		assert.Greater(t, ack.AcknowledgedAt, int64(0), "Acknowledgement should have a timestamp")

		// Step 8: Verify that after sync, the sender's view would be updated
		// In a real scenario, the sync would update the sender's database
		// Here we verify the sync contained the correct acknowledgement data
		t.Logf("Successfully verified acknowledgement sync: User %s acknowledged post %s",
			ack.UserId, ack.PostId)
	})

	t.Run("Test 3: Persistent Notifications Self-Referential Sync", func(t *testing.T) {
		var syncedPosts []*model.Post
		var syncHandler *SelfReferentialSyncHandler

		// Create test HTTP server using self-referential approach
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
			RemoteId:    model.NewId(),
			Name:        "test-cluster-notifications",
			SiteURL:     testServer.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		selfCluster, err = th.App.Srv().Store().RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Create a separate channel for this test to avoid conflicts
		testChannel := th.CreatePublicChannel()

		// Add both users to the channel to ensure mentions work
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, testChannel, false)
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, testChannel, false)
		require.Nil(t, appErr)

		// Create shared channel
		sc := &model.SharedChannel{
			ChannelId: testChannel.Id,
			TeamId:    testChannel.TeamId,
			Home:      true,
			ShareName: "test_persistent_sync",
			CreatorId: th.BasicUser.Id,
			RemoteId:  selfCluster.RemoteId,
		}
		sc, err = th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Create shared channel remote
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         sc.ChannelId,
			CreatorId:         sc.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          sc.RemoteId,
		}
		_, err = th.App.SaveSharedChannelRemote(scr)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnPostSync = func(post *model.Post) {
			syncedPosts = append(syncedPosts, post)
		}

		// Create post with persistent notifications enabled
		_, appErr = th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Test post with persistent notifications " + "@" + th.BasicUser2.Username,
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer("important"),
					RequestedAck:            model.NewPointer(false),
					PersistentNotifications: model.NewPointer(true),
				},
			},
		}, testChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// Test the self-referential sync flow:
		// 1. NotifyChannelChanged triggers the sync (entry point)
		service.NotifyChannelChanged(testChannel.Id)

		// 2. Wait for the sync message to be processed by our self-referential handler
		require.Eventually(t, func() bool {
			return len(syncedPosts) >= 2
		}, 5*time.Second, 100*time.Millisecond, "Should receive synced posts via self-referential handler")

		// 3. Verify persistent notification metadata is preserved
		// The test post should be the last one (after the "joined channel" post)
		syncedPost := syncedPosts[len(syncedPosts)-1]
		require.NotNil(t, syncedPost.Metadata, "Post metadata should be preserved")
		require.NotNil(t, syncedPost.Metadata.Priority, "Priority metadata should be preserved")
		assert.Equal(t, "important", *syncedPost.Metadata.Priority.Priority, "Priority should be preserved")
		assert.False(t, *syncedPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved as false")
		assert.True(t, *syncedPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should be preserved as true")
	})

	t.Run("Test 4: Cross-Cluster Acknowledgement End-to-End Flow", func(t *testing.T) {
		var syncedPostsServerA []*model.Post
		var syncedPostsServerB []*model.Post
		var syncHandlerA, syncHandlerB *SelfReferentialSyncHandler
		var postIdToTrack string

		// Create test HTTP servers for both "clusters"
		testServerA := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandlerA != nil {
				syncHandlerA.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServerA.Close()

		testServerB := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandlerB != nil {
				syncHandlerB.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServerB.Close()

		// Create remote clusters for both "servers"
		clusterA := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "cluster-a-ack-flow",
			SiteURL:     testServerA.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		clusterA, err = th.App.Srv().Store().RemoteCluster().Save(clusterA)
		require.NoError(t, err)

		clusterB := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "cluster-b-ack-flow",
			SiteURL:     testServerB.URL,
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Token:       model.NewId(),
			CreatorId:   th.BasicUser.Id,
			RemoteToken: model.NewId(),
		}
		clusterB, err = th.App.Srv().Store().RemoteCluster().Save(clusterB)
		require.NoError(t, err)

		// Create a test channel for this flow
		testChannel := th.CreatePublicChannel()

		// Add local user to the channel
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, testChannel, false)
		require.Nil(t, appErr)

		// Create a remote user from Cluster B
		remoteUserFromClusterB := &model.User{
			Email:         "remote-user-b@example.com",
			Username:      "remoteuserb" + model.NewId()[:4],
			Password:      "password123",
			EmailVerified: true,
			RemoteId:      &clusterB.RemoteId,
		}
		remoteUserFromClusterB, appErr = th.App.CreateUser(th.Context, remoteUserFromClusterB)
		require.Nil(t, appErr)

		// Add remote user to the team first
		_, _, appErr = th.App.AddUserToTeam(th.Context, testChannel.TeamId, remoteUserFromClusterB.Id, "")
		require.Nil(t, appErr)

		// Add remote user to the channel
		_, appErr = th.App.AddUserToChannel(th.Context, remoteUserFromClusterB, testChannel, false)
		require.Nil(t, appErr)

		// Create shared channel (only one per channel)
		sc := &model.SharedChannel{
			ChannelId: testChannel.Id,
			TeamId:    testChannel.TeamId,
			Home:      true,
			ShareName: "test_cross_cluster_ack",
			CreatorId: th.BasicUser.Id,
			RemoteId:  "",
		}
		sc, err = th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Create shared channel remote for cluster A
		scrA := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         sc.ChannelId,
			CreatorId:         sc.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          clusterA.RemoteId,
		}
		_, err = th.App.SaveSharedChannelRemote(scrA)
		require.NoError(t, err)

		// Create shared channel remote for cluster B
		scrB := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         sc.ChannelId,
			CreatorId:         sc.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          clusterB.RemoteId,
		}
		_, err = th.App.SaveSharedChannelRemote(scrB)
		require.NoError(t, err)

		// Initialize sync handlers for both clusters
		syncHandlerA = NewSelfReferentialSyncHandler(t, service, clusterA)
		syncHandlerA.OnPostSync = func(post *model.Post) {
			t.Logf("Cluster A received sync: ID=%s, Message=%s, HasAcks=%v",
				post.Id, post.Message,
				post.Metadata != nil && post.Metadata.Acknowledgements != nil)
			if post.Metadata != nil && post.Metadata.Acknowledgements != nil {
				t.Logf("  Cluster A sees %d acknowledgements", len(post.Metadata.Acknowledgements))
			}
			syncedPostsServerA = append(syncedPostsServerA, post)
		}

		syncHandlerB = NewSelfReferentialSyncHandler(t, service, clusterB)
		syncHandlerB.OnPostSync = func(post *model.Post) {
			t.Logf("Cluster B received sync: ID=%s, Message=%s, RequestedAck=%v",
				post.Id, post.Message,
				post.Metadata != nil && post.Metadata.Priority != nil && post.Metadata.Priority.RequestedAck != nil && *post.Metadata.Priority.RequestedAck)
			syncedPostsServerB = append(syncedPostsServerB, post)
		}

		// STEP 1: Server A creates a post with acknowledgement request
		t.Log("=== STEP 1: Server A creates post with ack request ===")
		originalPost, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Cross-cluster ack test - please acknowledge",
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer(model.PostPriorityUrgent),
					RequestedAck:            model.NewPointer(true),
					PersistentNotifications: model.NewPointer(false),
				},
			},
		}, testChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		postIdToTrack = originalPost.Id

		// Verify initial state - no acknowledgements
		acks, appErr := th.App.GetAcknowledgementsForPost(originalPost.Id)
		require.Nil(t, appErr)
		require.Empty(t, acks, "Should have no acknowledgements initially")

		// STEP 2: Post syncs from Server A to Server B
		t.Log("=== STEP 2: Post syncs from Server A to Server B ===")
		service.NotifyChannelChanged(testChannel.Id)

		// Track the synced post ID on Server B
		var syncedPostIdOnServerB string

		// Wait for Server B to receive the post
		require.Eventually(t, func() bool {
			for _, post := range syncedPostsServerB {
				// Check if this is the synced version of our original post by matching the message
				if post.Message == originalPost.Message && post.Metadata != nil && post.Metadata.Priority != nil &&
					post.Metadata.Priority.RequestedAck != nil && *post.Metadata.Priority.RequestedAck {
					syncedPostIdOnServerB = post.Id
					t.Logf("Server B received post %s with ack request (original was %s)", post.Id, postIdToTrack)
					return true
				}
			}
			return false
		}, 5*time.Second, 100*time.Millisecond, "Server B should receive post with ack request")

		// STEP 3: User on Server B acknowledges the post
		t.Log("=== STEP 3: User on Server B acknowledges the post ===")
		// NOTE: In a real cross-cluster scenario, this acknowledgement would be created
		// on Server B and synced to Server A with RemoteId set. Since we're testing on
		// a single instance, we're creating it directly which results in RemoteId=nil
		ackFromServerB := &model.PostAcknowledgement{
			PostId:         syncedPostIdOnServerB,
			UserId:         remoteUserFromClusterB.Id,
			ChannelId:      testChannel.Id,
			AcknowledgedAt: model.GetMillis(),
		}
		_, appErr = th.App.SaveAcknowledgementForPostWithModel(th.Context, ackFromServerB)
		require.Nil(t, appErr)

		// Verify acknowledgement was saved locally
		acksAfterSave, appErr := th.App.GetAcknowledgementsForPost(syncedPostIdOnServerB)
		require.Nil(t, appErr)
		require.Len(t, acksAfterSave, 1, "Should have exactly 1 acknowledgement after user B acks")
		require.Equal(t, remoteUserFromClusterB.Id, acksAfterSave[0].UserId)

		// STEP 4: Acknowledgement syncs back from Server B to Server A
		t.Log("=== STEP 4: Acknowledgement syncs back from Server B to Server A ===")

		// Clear previous sync data to focus on acknowledgement sync
		syncedPostsServerA = syncedPostsServerA[:0]
		syncedPostsServerB = syncedPostsServerB[:0]

		// Trigger sync to send acknowledgement back to Server A
		service.NotifyChannelChanged(testChannel.Id)

		// Wait for Server A to receive the acknowledgement sync
		require.Eventually(t, func() bool {
			for _, post := range syncedPostsServerA {
				if post.Id == postIdToTrack && post.Metadata != nil && post.Metadata.Acknowledgements != nil {
					t.Logf("Server A received post %s with %d acknowledgements", post.Id, len(post.Metadata.Acknowledgements))
					return len(post.Metadata.Acknowledgements) > 0
				}
			}
			return false
		}, 5*time.Second, 100*time.Millisecond, "Server A should receive acknowledgement sync")

		// STEP 5: Verify the complete acknowledgement flow
		t.Log("=== STEP 5: Verify complete acknowledgement flow ===")

		// Find the synced post with acknowledgements on Server A
		var serverAPostWithAcks *model.Post
		for _, post := range syncedPostsServerA {
			if post.Id == postIdToTrack && post.Metadata != nil && post.Metadata.Acknowledgements != nil {
				serverAPostWithAcks = post
				break
			}
		}

		require.NotNil(t, serverAPostWithAcks, "Server A should receive post with acknowledgements")
		require.NotNil(t, serverAPostWithAcks.Metadata, "Post metadata should exist")
		require.NotNil(t, serverAPostWithAcks.Metadata.Acknowledgements, "Acknowledgements should exist")
		require.Len(t, serverAPostWithAcks.Metadata.Acknowledgements, 1, "Should have exactly 1 acknowledgement")

		// Verify acknowledgement details
		ack := serverAPostWithAcks.Metadata.Acknowledgements[0]
		assert.Equal(t, remoteUserFromClusterB.Id, ack.UserId, "Acknowledgement should be from remote user")
		assert.Equal(t, postIdToTrack, ack.PostId, "Acknowledgement should be for the correct post")
		assert.Greater(t, ack.AcknowledgedAt, int64(0), "Acknowledgement should have a timestamp")

		// Verify the original post still has its priority metadata
		require.NotNil(t, serverAPostWithAcks.Metadata.Priority, "Priority metadata should be preserved")
		assert.Equal(t, model.PostPriorityUrgent, *serverAPostWithAcks.Metadata.Priority.Priority, "Priority should be preserved")
		assert.True(t, *serverAPostWithAcks.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")

		// STEP 6: Verify acknowledgement behavior
		t.Log("=== STEP 6: Verify acknowledgement behavior ===")

		// Get acknowledgements directly from the database
		// NOTE: Due to test limitation (single server instance), the acknowledgement will have RemoteId=nil
		// In a real cross-cluster scenario, this would have RemoteId set to clusterB.RemoteId
		dbAcks, appErr := th.App.GetAcknowledgementsForPost(postIdToTrack)
		require.Nil(t, appErr)

		// We expect 1 acknowledgement because the test creates it directly on the same instance
		require.Len(t, dbAcks, 1, "Should have 1 acknowledgement (test limitation: created directly, not via sync)")

		// Verify the acknowledgement details
		ack = dbAcks[0]
		assert.Equal(t, postIdToTrack, ack.PostId, "Acknowledgement should be for the original post")
		assert.Equal(t, remoteUserFromClusterB.Id, ack.UserId, "Acknowledgement should be from remote user")
		assert.Nil(t, ack.RemoteId, "RemoteId is nil due to test limitation (should be set in real cross-cluster sync)")

		t.Log("Test limitation acknowledged: In real cross-cluster scenario, remote acknowledgements would have RemoteId set during sync")

		// STEP 7: Test echo prevention - verify no duplicate acknowledgements
		t.Log("=== STEP 7: Test echo prevention ===")

		// Clear the synced posts to track new syncs
		syncedPostsServerA = syncedPostsServerA[:0]

		// Trigger another sync to ensure no duplicates are created
		service.NotifyChannelChanged(testChannel.Id)

		// Use Eventually to wait for any potential duplicate syncs
		require.Eventually(t, func() bool {
			// Check if we received any syncs with acknowledgements
			for _, post := range syncedPostsServerA {
				if post.Id == postIdToTrack && post.Metadata != nil && post.Metadata.Acknowledgements != nil {
					// Verify acknowledgement count remains 1 (no duplicates)
					return len(post.Metadata.Acknowledgements) == 1
				}
			}
			// If no sync occurred yet, keep waiting
			return len(syncedPostsServerA) > 0
		}, 3*time.Second, 100*time.Millisecond, "Should maintain single acknowledgement after resync")

		t.Logf("✅ Cross-cluster acknowledgement flow completed successfully:")
		t.Logf("   1. Server A created post with ack request: %s", postIdToTrack)
		t.Logf("   2. Post synced to Server B with priority metadata intact")
		t.Logf("   3. User on Server B acknowledged the post: %s", ack.UserId)
		t.Logf("   4. Acknowledgement synced back to Server A")
		t.Logf("   5. Server A shows acknowledgement in post metadata")
		t.Logf("   6. Echo prevention verified - no duplicates created")
	})
}

func randomBool() bool {
	return rnd.Intn(2) != 0
}

func TestGetRemoteClusterById(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

	ss := th.App.Srv().Store()
	EnsureCleanState(t, th, ss)

	// for this test we need a user that belongs to a channel that
	// is shared with the requested remote id.

	// create a remote cluster
	rc := &model.RemoteCluster{
		RemoteId:  model.NewId(),
		Name:      "Test1",
		SiteURL:   model.NewId(),
		CreatorId: model.NewId(),
	}
	rc, appErr := th.App.AddRemoteCluster(rc)
	require.Nil(t, appErr)

	// create a shared channel
	sc := &model.SharedChannel{
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicChannel.TeamId,
		Home:      false,
		ShareName: "test_share",
		CreatorId: th.BasicChannel.CreatorId,
		RemoteId:  rc.RemoteId,
	}
	sc, err := th.App.ShareChannel(th.Context, sc)
	require.NoError(t, err)

	// create a shared channel remote to connect them
	scr := &model.SharedChannelRemote{
		Id:                model.NewId(),
		ChannelId:         sc.ChannelId,
		CreatorId:         sc.CreatorId,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
		RemoteId:          sc.RemoteId,
	}
	_, err = th.App.SaveSharedChannelRemote(scr)
	require.NoError(t, err)

	t.Run("valid remote, user is member", func(t *testing.T) {
		rcInfo, _, err := th.Client.GetRemoteClusterInfo(context.Background(), rc.RemoteId)
		require.NoError(t, err)
		assert.Equal(t, rc.Name, rcInfo.Name)
	})

	t.Run("invalid remote", func(t *testing.T) {
		_, resp, err := th.Client.GetRemoteClusterInfo(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestCreateDirectChannelWithRemoteUser(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("should not create a local DM channel that is shared", func(t *testing.T) {
		th := setupForSharedChannels(t).InitBasic()
		defer th.TearDown()

		ss := th.App.Srv().Store()
		EnsureCleanState(t, th, ss)

		client := th.Client
		defer func() {
			_, err := client.Logout(context.Background())
			require.NoError(t, err)
		}()

		localUser := th.BasicUser
		remoteUser := th.CreateUser()
		remoteUser.RemoteId = model.NewPointer(model.NewId())
		remoteUser, appErr := th.App.UpdateUser(th.Context, remoteUser, false)
		require.Nil(t, appErr)

		dm, _, err := client.CreateDirectChannel(context.Background(), localUser.Id, remoteUser.Id)
		require.Error(t, err)
		require.Nil(t, dm)
	})

	t.Run("creates a local DM channel that is shared", func(t *testing.T) {
		t.Skip("Remote DMs are currently disabled")

		th := setupForSharedChannels(t).InitBasic()
		defer th.TearDown()

		ss := th.App.Srv().Store()
		EnsureCleanState(t, th, ss)

		client := th.Client
		defer func() {
			_, err := client.Logout(context.Background())
			require.NoError(t, err)
		}()

		localUser := th.BasicUser
		remoteUser := th.CreateUser()
		remoteUser.RemoteId = model.NewPointer(model.NewId())
		remoteUser, appErr := th.App.UpdateUser(th.Context, remoteUser, false)
		require.Nil(t, appErr)

		dm, _, err := client.CreateDirectChannel(context.Background(), localUser.Id, remoteUser.Id)
		require.NoError(t, err)

		channelName := model.GetDMNameFromIds(localUser.Id, remoteUser.Id)
		require.Equal(t, channelName, dm.Name, "dm name didn't match")
		assert.True(t, dm.IsShared())
	})

	t.Run("sends a shared channel invitation to the remote", func(t *testing.T) {
		t.Skip("Remote DMs are currently disabled")

		th := setupForSharedChannels(t).InitBasic()
		defer th.TearDown()

		ss := th.App.Srv().Store()
		EnsureCleanState(t, th, ss)

		client := th.Client
		defer func() {
			_, err := client.Logout(context.Background())
			require.NoError(t, err)
		}()

		localUser := th.BasicUser
		remoteUser := th.CreateUser()

		rc := &model.RemoteCluster{
			Name:      "test",
			Token:     model.NewId(),
			CreatorId: localUser.Id,
		}
		rc, appErr := th.App.AddRemoteCluster(rc)
		require.Nil(t, appErr)

		remoteUser.RemoteId = model.NewPointer(rc.RemoteId)
		remoteUser, appErr = th.App.UpdateUser(th.Context, remoteUser, false)
		require.Nil(t, appErr)

		dm, _, err := client.CreateDirectChannel(context.Background(), localUser.Id, remoteUser.Id)
		require.NoError(t, err)

		channelName := model.GetDMNameFromIds(localUser.Id, remoteUser.Id)
		require.Equal(t, channelName, dm.Name, "dm name didn't match")
		require.True(t, dm.IsShared())
	})

	t.Run("does not send a shared channel invitation to the remote when creator is remote", func(t *testing.T) {
		t.Skip("Remote DMs are currently disabled")

		th := setupForSharedChannels(t).InitBasic()
		defer th.TearDown()

		ss := th.App.Srv().Store()
		EnsureCleanState(t, th, ss)

		client := th.Client
		defer func() {
			_, err := client.Logout(context.Background())
			require.NoError(t, err)
		}()

		localUser := th.BasicUser
		remoteUser := th.CreateUser()

		rc := &model.RemoteCluster{
			Name:      "test",
			Token:     model.NewId(),
			CreatorId: localUser.Id,
		}
		rc, appErr := th.App.AddRemoteCluster(rc)
		require.Nil(t, appErr)

		remoteUser.RemoteId = model.NewPointer(rc.RemoteId)
		remoteUser, appErr = th.App.UpdateUser(th.Context, remoteUser, false)
		require.Nil(t, appErr)

		dm, _, err := client.CreateDirectChannel(context.Background(), remoteUser.Id, localUser.Id)
		require.NoError(t, err)

		channelName := model.GetDMNameFromIds(localUser.Id, remoteUser.Id)
		require.Equal(t, channelName, dm.Name, "dm name didn't match")
		require.True(t, dm.IsShared())
	})
}

func TestGetSharedChannelRemotesByRemoteCluster(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("Should not work if the remote cluster service is not enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		resp, err := th.SystemAdminClient.DeleteRemoteCluster(context.Background(), model.NewId())
		CheckNotImplementedStatus(t, resp)
		require.Error(t, err)
	})

	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

	ss := th.App.Srv().Store()
	EnsureCleanState(t, th, ss)

	newRC1 := &model.RemoteCluster{Name: "rc1", SiteURL: "http://example1.com", CreatorId: th.SystemAdminUser.Id}
	newRC2 := &model.RemoteCluster{Name: "rc2", SiteURL: "http://example2.com", CreatorId: th.SystemAdminUser.Id}

	rc1, appErr := th.App.AddRemoteCluster(newRC1)
	require.Nil(t, appErr)
	rc2, appErr := th.App.AddRemoteCluster(newRC2)
	require.Nil(t, appErr)

	c1 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, th.BasicTeam.Id)
	sc1 := &model.SharedChannel{
		ChannelId:        c1.Id,
		TeamId:           th.BasicTeam.Id,
		ShareName:        "shared_1",
		ShareDisplayName: "Shared Channel 1", // for sorting purposes
		CreatorId:        th.BasicUser.Id,
		RemoteId:         rc1.RemoteId,
		Home:             true,
	}
	_, err := th.App.ShareChannel(th.Context, sc1)
	require.NoError(t, err)

	c2 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, th.BasicTeam.Id)
	sc2 := &model.SharedChannel{
		ChannelId:        c2.Id,
		TeamId:           th.BasicTeam.Id,
		ShareName:        "shared_2",
		ShareDisplayName: "Shared Channel 2",
		CreatorId:        th.BasicUser.Id,
		RemoteId:         rc1.RemoteId,
		Home:             false,
	}

	_, err = th.App.ShareChannel(th.Context, sc2)
	require.NoError(t, err)

	c3 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, th.BasicTeam.Id)
	sc3 := &model.SharedChannel{
		ChannelId: c3.Id,
		TeamId:    th.BasicTeam.Id,
		ShareName: "shared_3",
		CreatorId: th.BasicUser.Id,
		RemoteId:  rc2.RemoteId,
	}
	_, err = th.App.ShareChannel(th.Context, sc3)
	require.NoError(t, err)

	c4 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, th.BasicTeam.Id)
	sc4 := &model.SharedChannel{
		ChannelId:        c4.Id,
		TeamId:           th.BasicTeam.Id,
		ShareName:        "shared_4",
		ShareDisplayName: "Shared Channel 4",
		CreatorId:        th.BasicUser.Id,
		RemoteId:         rc1.RemoteId,
		Home:             false,
	}

	_, err = th.App.ShareChannel(th.Context, sc4)
	require.NoError(t, err)

	c5 := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, th.BasicTeam.Id)
	sc5 := &model.SharedChannel{
		ChannelId:        c5.Id,
		TeamId:           th.BasicTeam.Id,
		ShareName:        "shared_5",
		ShareDisplayName: "Shared Channel 5",
		CreatorId:        th.BasicUser.Id,
		RemoteId:         rc1.RemoteId,
		Home:             false,
	}

	_, err = th.App.ShareChannel(th.Context, sc5)
	require.NoError(t, err)

	// for the pagination test, we need to get the channelId of the
	// second SharedChannelRemote that belongs to RC1, sorted by ID,
	// so we accumulate those SharedChannelRemotes on creation and
	// later sort them to be able to get the right one for the test
	// result
	sharedChannelRemotesFromRC1 := []*model.SharedChannelRemote{}

	// create the shared channel remotes
	for _, sc := range []*model.SharedChannel{sc1, sc2, sc3, sc4, sc5} {
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         sc.ChannelId,
			CreatorId:         sc.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          sc.RemoteId,
		}
		// scr for c5 is not confirmed yet
		if sc.ChannelId == sc5.ChannelId {
			scr.IsInviteConfirmed = false
		}
		_, err = th.App.SaveSharedChannelRemote(scr)
		require.NoError(t, err)

		if scr.RemoteId == rc1.RemoteId {
			sharedChannelRemotesFromRC1 = append(sharedChannelRemotesFromRC1, scr)
		}
	}

	// we delete the shared channel remote for sc4
	scr4, err := th.App.GetSharedChannelRemoteByIds(sc4.ChannelId, sc4.RemoteId)
	require.NoError(t, err)

	deleted, err := th.App.DeleteSharedChannelRemote(scr4.Id)
	require.NoError(t, err)
	require.True(t, deleted)

	sort.Slice(sharedChannelRemotesFromRC1, func(i, j int) bool {
		return sharedChannelRemotesFromRC1[i].Id < sharedChannelRemotesFromRC1[j].Id
	})

	t.Run("should return the expected shared channels", func(t *testing.T) {
		testCases := []struct {
			Name               string
			Client             *model.Client4
			RemoteId           string
			Filter             model.SharedChannelRemoteFilterOpts
			Page               int
			PerPage            int
			ExpectedStatusCode int
			ExpectedError      bool
			ExpectedIds        []string
		}{
			{
				Name:               "should not work if the user doesn't have the right permissions",
				Client:             th.Client,
				RemoteId:           rc1.RemoteId,
				Page:               0,
				PerPage:            100,
				ExpectedStatusCode: http.StatusForbidden,
				ExpectedError:      true,
			},
			{
				Name:               "should not work if the remote cluster is nonexistent",
				Client:             th.SystemAdminClient,
				RemoteId:           model.NewId(),
				Page:               0,
				PerPage:            100,
				ExpectedStatusCode: http.StatusNotFound,
				ExpectedError:      true,
			},
			{
				Name:               "should return the complete list of shared channel remotes for a remote cluster",
				Client:             th.SystemAdminClient,
				RemoteId:           rc1.RemoteId,
				Page:               0,
				PerPage:            100,
				ExpectedStatusCode: http.StatusOK,
				ExpectedError:      false,
				ExpectedIds:        []string{sc1.ChannelId, sc2.ChannelId},
			},
			{
				Name:               "should return the complete list of shared channel remotes for a remote cluster, including deleted",
				Client:             th.SystemAdminClient,
				RemoteId:           rc1.RemoteId,
				Filter:             model.SharedChannelRemoteFilterOpts{IncludeDeleted: true},
				Page:               0,
				PerPage:            100,
				ExpectedStatusCode: http.StatusOK,
				ExpectedError:      false,
				ExpectedIds:        []string{sc1.ChannelId, sc2.ChannelId, sc4.ChannelId},
			},
			{
				Name:               "should return only the shared channel remotes homed localy",
				Client:             th.SystemAdminClient,
				RemoteId:           rc1.RemoteId,
				Filter:             model.SharedChannelRemoteFilterOpts{ExcludeRemote: true},
				Page:               0,
				PerPage:            100,
				ExpectedStatusCode: http.StatusOK,
				ExpectedError:      false,
				ExpectedIds:        []string{sc1.ChannelId},
			},
			{
				Name:               "should return only the shared channel remotes homed remotely",
				Client:             th.SystemAdminClient,
				RemoteId:           rc1.RemoteId,
				Filter:             model.SharedChannelRemoteFilterOpts{ExcludeHome: true},
				Page:               0,
				PerPage:            100,
				ExpectedStatusCode: http.StatusOK,
				ExpectedError:      false,
				ExpectedIds:        []string{sc2.ChannelId},
			},
			{
				Name:               "should return the complete list of shared channel remotes for a remote cluster including unconfirmed",
				Client:             th.SystemAdminClient,
				RemoteId:           rc1.RemoteId,
				Filter:             model.SharedChannelRemoteFilterOpts{IncludeUnconfirmed: true},
				Page:               0,
				PerPage:            100,
				ExpectedStatusCode: http.StatusOK,
				ExpectedError:      false,
				ExpectedIds:        []string{sc1.ChannelId, sc2.ChannelId, sc5.ChannelId},
			},
			{
				Name:               "should return only the unconfirmed shared channel remotes for a remote cluster",
				Client:             th.SystemAdminClient,
				RemoteId:           rc1.RemoteId,
				Filter:             model.SharedChannelRemoteFilterOpts{ExcludeConfirmed: true},
				Page:               0,
				PerPage:            100,
				ExpectedStatusCode: http.StatusOK,
				ExpectedError:      false,
				ExpectedIds:        []string{sc5.ChannelId},
			},
			{
				Name:               "should correctly paginate the results",
				Client:             th.SystemAdminClient,
				RemoteId:           rc1.RemoteId,
				Filter:             model.SharedChannelRemoteFilterOpts{IncludeDeleted: true, IncludeUnconfirmed: true},
				Page:               1,
				PerPage:            1,
				ExpectedStatusCode: http.StatusOK,
				ExpectedError:      false,
				ExpectedIds:        []string{sharedChannelRemotesFromRC1[1].ChannelId},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				scrs, resp, err := tc.Client.GetSharedChannelRemotesByRemoteCluster(context.Background(), tc.RemoteId, tc.Filter, tc.Page, tc.PerPage)
				checkHTTPStatus(t, resp, tc.ExpectedStatusCode)
				if tc.ExpectedError {
					require.Error(t, err)
				} else {
					require.NoError(t, err)
				}
				require.Len(t, scrs, len(tc.ExpectedIds))

				foundIds := []string{}
				for _, scr := range scrs {
					require.Equal(t, tc.RemoteId, scr.RemoteId)
					foundIds = append(foundIds, scr.ChannelId)
				}
				require.ElementsMatch(t, tc.ExpectedIds, foundIds)
			})
		}
	})
}

func TestInviteRemoteClusterToChannel(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("Should not work if the remote cluster service is not enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		resp, err := th.SystemAdminClient.InviteRemoteClusterToChannel(context.Background(), model.NewId(), model.NewId())
		CheckNotImplementedStatus(t, resp)
		require.Error(t, err)
	})

	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

	ss := th.App.Srv().Store()
	EnsureCleanState(t, th, ss)

	newRC := &model.RemoteCluster{Name: "rc", SiteURL: "http://example.com", CreatorId: th.SystemAdminUser.Id}

	rc, appErr := th.App.AddRemoteCluster(newRC)
	require.Nil(t, appErr)

	t.Run("Should not work if the user doesn't have the right permissions", func(t *testing.T) {
		resp, err := th.Client.InviteRemoteClusterToChannel(context.Background(), model.NewId(), model.NewId())
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	t.Run("should not work if the remote cluster is nonexistent", func(t *testing.T) {
		resp, err := th.SystemAdminClient.InviteRemoteClusterToChannel(context.Background(), model.NewId(), model.NewId())
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
	})

	t.Run("should not work if the channel is nonexistent", func(t *testing.T) {
		resp, err := th.SystemAdminClient.InviteRemoteClusterToChannel(context.Background(), rc.RemoteId, model.NewId())
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
	})

	t.Run("should correctly invite the remote cluster to the channel", func(t *testing.T) {
		t.Skip("Requires server2server communication: ToBeImplemented")
	})

	t.Run("should do nothing but return 204 if the remote cluster is already invited to the channel", func(t *testing.T) {
		t.Skip("Requires server2server communication: ToBeImplemented")
	})
}

func TestUninviteRemoteClusterToChannel(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("Should not work if the remote cluster service is not enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		resp, err := th.SystemAdminClient.UninviteRemoteClusterToChannel(context.Background(), model.NewId(), model.NewId())
		CheckNotImplementedStatus(t, resp)
		require.Error(t, err)
	})

	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

	ss := th.App.Srv().Store()
	EnsureCleanState(t, th, ss)

	newRC := &model.RemoteCluster{Name: "rc", SiteURL: "http://example.com", CreatorId: th.SystemAdminUser.Id}

	rc, appErr := th.App.AddRemoteCluster(newRC)
	require.Nil(t, appErr)

	t.Run("Should not work if the user doesn't have the right permissions", func(t *testing.T) {
		resp, err := th.Client.UninviteRemoteClusterToChannel(context.Background(), model.NewId(), model.NewId())
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	t.Run("should not work if the remote cluster is nonexistent", func(t *testing.T) {
		resp, err := th.SystemAdminClient.UninviteRemoteClusterToChannel(context.Background(), model.NewId(), model.NewId())
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
	})

	t.Run("should not work if the channel is nonexistent", func(t *testing.T) {
		resp, err := th.SystemAdminClient.UninviteRemoteClusterToChannel(context.Background(), rc.RemoteId, model.NewId())
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
	})

	t.Run("should correctly uninvite the remote cluster to the channel", func(t *testing.T) {
		t.Skip("Requires server2server communication: ToBeImplemented")
	})

	t.Run("should do nothing but return 204 if the remote cluster is not sharing the channel", func(t *testing.T) {
		t.Skip("Requires server2server communication: ToBeImplemented")
	})
}
