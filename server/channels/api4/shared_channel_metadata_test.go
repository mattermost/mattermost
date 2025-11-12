// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
)

// setupTestEnvironment sets up a common test environment for shared channel metadata tests
func setupTestEnvironment(t *testing.T) (*TestHelper, *sharedchannel.Service) {
	th := setupForSharedChannels(t).InitBasic(t)
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

	// Ensure services are running
	err := service.Start()
	require.NoError(t, err)

	rcService := th.App.Srv().GetRemoteClusterService()
	if rcService != nil {
		_ = rcService.Start()
		if rc, ok := rcService.(*remotecluster.Service); ok {
			rc.SetActive(true)
		}
		require.True(t, rcService.Active(), "RemoteClusterService should be active")
	}

	return th, service
}

// createSharedChannelSetup creates a shared channel with remote cluster for testing
func createSharedChannelSetup(t *testing.T, th *TestHelper, service *sharedchannel.Service, testServer *httptest.Server) (*model.Channel, *model.RemoteCluster) {
	// Create remote cluster
	selfCluster := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		Name:        "test-cluster-" + model.NewId()[:8],
		SiteURL:     testServer.URL,
		CreateAt:    model.GetMillis(),
		LastPingAt:  model.GetMillis(),
		Token:       model.NewId(),
		CreatorId:   th.BasicUser.Id,
		RemoteToken: model.NewId(),
	}
	var err error
	selfCluster, err = th.App.Srv().Store().RemoteCluster().Save(selfCluster)
	require.NoError(t, err)

	// Create channel with users
	testChannel := th.CreatePublicChannel(t)
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, testChannel, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, testChannel, false)
	require.Nil(t, appErr)

	// Create shared channel
	sc := &model.SharedChannel{
		ChannelId: testChannel.Id,
		TeamId:    testChannel.TeamId,
		Home:      true,
		ShareName: "test_sync_" + model.NewId()[:8],
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

	return testChannel, selfCluster
}

func TestSharedChannelPostMetadataSync(t *testing.T) {
	th, service := setupTestEnvironment(t)

	t.Run("Post Priority Metadata Self-Referential Sync", func(t *testing.T) {
		t.Skip("MM-64687")
		var syncedPosts []*model.Post

		// Create test HTTP server using self-referential approach
		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeOKResponse(w)
		}))
		defer testServer.Close()

		testChannel, selfCluster := createSharedChannelSetup(t, th, service, testServer)

		// Initialize sync handler
		syncHandler := NewSelfReferentialSyncHandler(t, service, selfCluster)
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

		// Update test server to use the sync handler
		testServer.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			syncHandler.HandleRequest(w, r)
		})

		// Create a local post with priority metadata
		originalPost, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Test post with priority metadata @" + th.BasicUser2.Username,
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

		// Trigger sync
		t.Logf("Triggering sync for channel: %s", testChannel.Id)
		service.NotifyChannelChanged(testChannel.Id)

		// Wait for sync completion using Eventually pattern
		require.Eventually(t, func() bool {
			return len(syncedPosts) >= 2
		}, 5*time.Second, 100*time.Millisecond, "Should receive synced posts via self-referential handler")

		// Verify priority metadata is preserved through the complete sync flow
		t.Logf("Found %d synced posts", len(syncedPosts))
		syncedPost := syncedPosts[len(syncedPosts)-1]
		require.NotNil(t, syncedPost.Metadata, "Post metadata should be preserved")
		require.NotNil(t, syncedPost.Metadata.Priority, "Priority metadata should be preserved")
		assert.Equal(t, model.PostPriorityUrgent, *syncedPost.Metadata.Priority.Priority, "Priority should be preserved")
		assert.True(t, *syncedPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")
		assert.True(t, *syncedPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should be preserved")
	})

	t.Run("Post Acknowledgement Metadata Self-Referential Sync", func(t *testing.T) {
		EnsureCleanState(t, th, th.App.Srv().Store())
		var syncedPosts []*model.Post

		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeOKResponse(w)
		}))
		defer testServer.Close()

		testChannel, selfCluster := createSharedChannelSetup(t, th, service, testServer)

		syncHandler := NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnPostSync = func(post *model.Post) {
			syncedPosts = append(syncedPosts, post)
		}

		testServer.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			syncHandler.HandleRequest(w, r)
		})

		// Create post with acknowledgement request
		originalPost, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Test post requesting acknowledgements @" + th.BasicUser2.Username,
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

		// Trigger sync
		service.NotifyChannelChanged(testChannel.Id)

		// Wait for sync completion
		require.Eventually(t, func() bool {
			return len(syncedPosts) >= 2
		}, 5*time.Second, 100*time.Millisecond, "Should receive synced posts via self-referential handler")

		// Verify acknowledgement metadata is preserved
		syncedPost := syncedPosts[len(syncedPosts)-1]
		require.NotNil(t, syncedPost.Metadata, "Post metadata should be preserved")
		require.NotNil(t, syncedPost.Metadata.Priority, "Priority metadata should be preserved")
		assert.Equal(t, model.PostPriorityUrgent, *syncedPost.Metadata.Priority.Priority, "Priority should be preserved")
		assert.True(t, *syncedPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")
		assert.False(t, *syncedPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should be preserved")
	})

	t.Run("Acknowledgement Count Sync Back to Sender", func(t *testing.T) {
		t.Skip("MM-64687")
		EnsureCleanState(t, th, th.App.Srv().Store())
		var syncedPosts []*model.Post
		var postIdToSync string

		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeOKResponse(w)
		}))
		defer testServer.Close()

		testChannel, selfCluster := createSharedChannelSetup(t, th, service, testServer)

		syncHandler := NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnPostSync = func(post *model.Post) {
			if post.Id == postIdToSync {
				t.Logf("Received sync for target post: ID=%s, HasAcks=%v", post.Id,
					post.Metadata != nil && post.Metadata.Acknowledgements != nil)
				if post.Metadata != nil && post.Metadata.Acknowledgements != nil {
					t.Logf("Acknowledgement count in sync: %d", len(post.Metadata.Acknowledgements))
				}
			}
			syncedPosts = append(syncedPosts, post)
		}

		testServer.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			syncHandler.HandleRequest(w, r)
		})

		// Create post with acknowledgement request
		originalPost, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Test post for ack count sync @" + th.BasicUser2.Username,
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

		// Trigger initial sync
		service.NotifyChannelChanged(testChannel.Id)

		// Wait for initial sync
		require.Eventually(t, func() bool {
			return len(syncedPosts) >= 2
		}, 5*time.Second, 100*time.Millisecond, "Should complete initial sync")

		// Add acknowledgement
		ackForSync := &model.PostAcknowledgement{
			PostId:         originalPost.Id,
			UserId:         th.BasicUser2.Id,
			ChannelId:      originalPost.ChannelId,
			AcknowledgedAt: model.GetMillis(),
		}
		_, appErr = th.App.SaveAcknowledgementForPostWithModel(th.Context, ackForSync)
		require.Nil(t, appErr)

		// Clear previous synced posts and trigger sync
		syncedPosts = syncedPosts[:0]
		service.NotifyChannelChanged(testChannel.Id)

		// Wait for acknowledgement sync
		require.Eventually(t, func() bool {
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

		// Verify acknowledgement was synced
		var syncedPostWithAcks *model.Post
		for _, post := range syncedPosts {
			if post.Id == postIdToSync && post.Metadata != nil && post.Metadata.Acknowledgements != nil {
				syncedPostWithAcks = post
				break
			}
		}

		require.NotNil(t, syncedPostWithAcks, "Should find synced post with acknowledgements")
		require.NotNil(t, syncedPostWithAcks.Metadata.Acknowledgements, "Acknowledgements should exist")
		require.Len(t, syncedPostWithAcks.Metadata.Acknowledgements, 1, "Should have exactly 1 acknowledgement")

		ack := syncedPostWithAcks.Metadata.Acknowledgements[0]
		assert.Equal(t, th.BasicUser2.Id, ack.UserId, "Acknowledgement should be from BasicUser2")
		assert.Equal(t, originalPost.Id, ack.PostId, "Acknowledgement should be for the original post")
		assert.Greater(t, ack.AcknowledgedAt, int64(0), "Acknowledgement should have a timestamp")
	})

	t.Run("Persistent Notifications Self-Referential Sync", func(t *testing.T) {
		t.Skip("MM-64687")
		EnsureCleanState(t, th, th.App.Srv().Store())
		var syncedPosts []*model.Post

		testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeOKResponse(w)
		}))
		defer testServer.Close()

		testChannel, selfCluster := createSharedChannelSetup(t, th, service, testServer)

		syncHandler := NewSelfReferentialSyncHandler(t, service, selfCluster)
		syncHandler.OnPostSync = func(post *model.Post) {
			syncedPosts = append(syncedPosts, post)
		}

		testServer.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			syncHandler.HandleRequest(w, r)
		})

		// Create post with persistent notifications enabled
		_, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: testChannel.Id,
			Message:   "Test post with persistent notifications @" + th.BasicUser2.Username,
			Metadata: &model.PostMetadata{
				Priority: &model.PostPriority{
					Priority:                model.NewPointer(model.PostPriorityUrgent),
					RequestedAck:            model.NewPointer(true),
					PersistentNotifications: model.NewPointer(true),
				},
			},
		}, testChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// Trigger sync
		service.NotifyChannelChanged(testChannel.Id)

		// Wait for sync completion
		require.Eventually(t, func() bool {
			return len(syncedPosts) >= 2
		}, 5*time.Second, 100*time.Millisecond, "Should receive synced posts via self-referential handler")

		// Verify persistent notifications setting is preserved
		syncedPost := syncedPosts[len(syncedPosts)-1]
		require.NotNil(t, syncedPost.Metadata, "Post metadata should be preserved")
		require.NotNil(t, syncedPost.Metadata.Priority, "Priority metadata should be preserved")
		assert.Equal(t, model.PostPriorityUrgent, *syncedPost.Metadata.Priority.Priority, "Priority should be preserved")
		assert.True(t, *syncedPost.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")
		assert.True(t, *syncedPost.Metadata.Priority.PersistentNotifications, "PersistentNotifications should be preserved")
	})

	t.Run("Cross-Cluster Acknowledgement End-to-End Flow", func(t *testing.T) {
		t.Skip("MM-64687")
		EnsureCleanState(t, th, th.App.Srv().Store())
		var syncedPostsServerA []*model.Post
		var syncedPostsServerB []*model.Post
		var postIdToTrack string

		// Create test HTTP servers for both "clusters"
		testServerA := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeOKResponse(w)
		}))
		defer testServerA.Close()

		testServerB := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			writeOKResponse(w)
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
		var err error
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

		// Create test channel and add local user
		testChannel := th.CreatePublicChannel(t)
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser, testChannel, false)
		require.Nil(t, appErr)

		// Create remote user from Cluster B
		remoteUserFromClusterB := &model.User{
			Email:         "remote-user-b@example.com",
			Username:      "remoteuserb" + model.NewId()[:4],
			Password:      "password123",
			EmailVerified: true,
			RemoteId:      &clusterB.RemoteId,
		}
		remoteUserFromClusterB, appErr = th.App.CreateUser(th.Context, remoteUserFromClusterB)
		require.Nil(t, appErr)

		// Add remote user to team and channel
		_, _, appErr = th.App.AddUserToTeam(th.Context, testChannel.TeamId, remoteUserFromClusterB.Id, "")
		require.Nil(t, appErr)
		_, appErr = th.App.AddUserToChannel(th.Context, remoteUserFromClusterB, testChannel, false)
		require.Nil(t, appErr)

		// Create shared channel
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

		// Create shared channel remotes for both clusters
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
		syncHandlerA := NewSelfReferentialSyncHandler(t, service, clusterA)
		syncHandlerA.OnPostSync = func(post *model.Post) {
			t.Logf("Cluster A received sync: ID=%s, Message=%s, HasAcks=%v",
				post.Id, post.Message,
				post.Metadata != nil && post.Metadata.Acknowledgements != nil)
			if post.Metadata != nil && post.Metadata.Acknowledgements != nil {
				t.Logf("  Cluster A sees %d acknowledgements", len(post.Metadata.Acknowledgements))
			}
			syncedPostsServerA = append(syncedPostsServerA, post)
		}

		syncHandlerB := NewSelfReferentialSyncHandler(t, service, clusterB)
		syncHandlerB.OnPostSync = func(post *model.Post) {
			t.Logf("Cluster B received sync: ID=%s, Message=%s, RequestedAck=%v",
				post.Id, post.Message,
				post.Metadata != nil && post.Metadata.Priority != nil && post.Metadata.Priority.RequestedAck != nil && *post.Metadata.Priority.RequestedAck)
			syncedPostsServerB = append(syncedPostsServerB, post)
		}

		// Update test servers to use sync handlers
		testServerA.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			syncHandlerA.HandleRequest(w, r)
		})

		testServerB.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			syncHandlerB.HandleRequest(w, r)
		})

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

		// Wait for Server B to receive the post
		var syncedPostIdOnServerB string
		require.Eventually(t, func() bool {
			for _, post := range syncedPostsServerB {
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
		var serverAPostWithAcks *model.Post
		for _, post := range syncedPostsServerA {
			if post.Id == postIdToTrack && post.Metadata != nil && post.Metadata.Acknowledgements != nil {
				serverAPostWithAcks = post
				break
			}
		}

		require.NotNil(t, serverAPostWithAcks, "Server A should receive post with acknowledgements")
		require.NotNil(t, serverAPostWithAcks.Metadata.Acknowledgements, "Acknowledgements should exist")
		require.Len(t, serverAPostWithAcks.Metadata.Acknowledgements, 1, "Should have exactly 1 acknowledgement")

		// Verify acknowledgement details
		ack := serverAPostWithAcks.Metadata.Acknowledgements[0]
		assert.Equal(t, remoteUserFromClusterB.Id, ack.UserId, "Acknowledgement should be from remote user")
		assert.Equal(t, postIdToTrack, ack.PostId, "Acknowledgement should be for the correct post")
		assert.Greater(t, ack.AcknowledgedAt, int64(0), "Acknowledgement should have a timestamp")

		// Verify priority metadata is preserved
		require.NotNil(t, serverAPostWithAcks.Metadata.Priority, "Priority metadata should be preserved")
		assert.Equal(t, model.PostPriorityUrgent, *serverAPostWithAcks.Metadata.Priority.Priority, "Priority should be preserved")
		assert.True(t, *serverAPostWithAcks.Metadata.Priority.RequestedAck, "RequestedAck should be preserved")

		// STEP 6: Test echo prevention - verify no duplicate acknowledgements
		t.Log("=== STEP 6: Test echo prevention ===")
		syncedPostsServerA = syncedPostsServerA[:0]

		// Trigger another sync to ensure no duplicates are created
		service.NotifyChannelChanged(testChannel.Id)

		// Verify acknowledgement count remains 1 (no duplicates)
		require.Eventually(t, func() bool {
			for _, post := range syncedPostsServerA {
				if post.Id == postIdToTrack && post.Metadata != nil && post.Metadata.Acknowledgements != nil {
					return len(post.Metadata.Acknowledgements) == 1
				}
			}
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
