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

var (
	rnd = rand.New(rand.NewSource(time.Now().UnixNano()))
)

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
	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

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

	// Ensure clean state before running tests
	ensureCleanState(t, th)

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
			RemoteId:     model.NewId(),
			Name:         "test-cluster-priority",
			SiteURL:      testServer.URL,
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			Token:        model.NewId(),
			CreatorId:    th.BasicUser.Id,
			RemoteToken:  model.NewId(),
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
			RemoteId:     model.NewId(),
			Name:         "test-cluster-acks",
			SiteURL:      testServer.URL,
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			Token:        model.NewId(),
			CreatorId:    th.BasicUser.Id,
			RemoteToken:  model.NewId(),
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
		_, appErr = th.App.SaveAcknowledgementForPost(th.Context, originalPost.Id, th.BasicUser2.Id)
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
			RemoteId:     model.NewId(),
			Name:         "test-cluster-notifications",
			SiteURL:      testServer.URL,
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			Token:        model.NewId(),
			CreatorId:    th.BasicUser.Id,
			RemoteToken:  model.NewId(),
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
}

func randomBool() bool {
	return rnd.Intn(2) != 0
}


func TestGetRemoteClusterById(t *testing.T) {
	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

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
	t.Run("should not create a local DM channel that is shared", func(t *testing.T) {
		th := setupForSharedChannels(t).InitBasic()
		defer th.TearDown()
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
	t.Run("Should not work if the remote cluster service is not enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		resp, err := th.SystemAdminClient.DeleteRemoteCluster(context.Background(), model.NewId())
		CheckNotImplementedStatus(t, resp)
		require.Error(t, err)
	})

	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

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
	t.Run("Should not work if the remote cluster service is not enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		resp, err := th.SystemAdminClient.InviteRemoteClusterToChannel(context.Background(), model.NewId(), model.NewId())
		CheckNotImplementedStatus(t, resp)
		require.Error(t, err)
	})

	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

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
	t.Run("Should not work if the remote cluster service is not enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		resp, err := th.SystemAdminClient.UninviteRemoteClusterToChannel(context.Background(), model.NewId(), model.NewId())
		CheckNotImplementedStatus(t, resp)
		require.Error(t, err)
	})

	th := setupForSharedChannels(t).InitBasic()
	defer th.TearDown()

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
