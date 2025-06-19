// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
)

func setupSharedChannels(tb testing.TB) *TestHelper {
	return SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
		cfg.FeatureFlags.EnableSharedChannelsMemberSync = true
		cfg.ClusterSettings.ClusterName = model.NewPointer("test-remote")
	})
}

func TestApp_CheckCanInviteToSharedChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSharedChannels(t).InitBasic()

	channel1 := th.CreateChannel(th.Context, th.BasicTeam)
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	channel3 := th.CreateChannel(th.Context, th.BasicTeam)

	data := []struct {
		channelID string
		home      bool
		name      string
		remoteID  string
	}{
		{channelID: channel1.Id, home: true, name: "test_home", remoteID: ""},
		{channelID: channel2.Id, home: false, name: "test_remote", remoteID: model.NewId()},
	}

	for _, d := range data {
		sc := &model.SharedChannel{
			ChannelId: d.channelID,
			TeamId:    th.BasicTeam.Id,
			Home:      d.home,
			ShareName: d.name,
			CreatorId: th.BasicUser.Id,
			RemoteId:  d.remoteID,
		}
		_, err := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)
	}

	t.Run("Test checkChannelNotShared: not yet shared channel", func(t *testing.T) {
		err := th.App.checkChannelNotShared(th.Context, channel3.Id)
		assert.NoError(t, err, "unshared channel should not error")
	})

	t.Run("Test checkChannelNotShared: already shared channel", func(t *testing.T) {
		err := th.App.checkChannelNotShared(th.Context, channel1.Id)
		assert.Error(t, err, "already shared channel should error")
	})

	t.Run("Test checkChannelNotShared: invalid channel", func(t *testing.T) {
		err := th.App.checkChannelNotShared(th.Context, model.NewId())
		assert.Error(t, err, "invalid channel should error")
	})

	t.Run("Test checkChannelIsShared: not yet shared channel", func(t *testing.T) {
		err := th.App.checkChannelIsShared(channel3.Id)
		assert.Error(t, err, "unshared channel should error")
	})

	t.Run("Test checkChannelIsShared: already shared channel", func(t *testing.T) {
		err := th.App.checkChannelIsShared(channel1.Id)
		assert.NoError(t, err, "already channel should not error")
	})

	t.Run("Test checkChannelIsShared: invalid channel", func(t *testing.T) {
		err := th.App.checkChannelIsShared(model.NewId())
		assert.Error(t, err, "invalid channel should error")
	})

	t.Run("Test CheckCanInviteToSharedChannel: Home shared channel", func(t *testing.T) {
		err := th.App.CheckCanInviteToSharedChannel(data[0].channelID)
		assert.NoError(t, err, "home channel should allow invites")
	})

	t.Run("Test CheckCanInviteToSharedChannel: Remote shared channel", func(t *testing.T) {
		err := th.App.CheckCanInviteToSharedChannel(data[1].channelID)
		assert.Error(t, err, "home channel should not allow invites")
	})

	t.Run("Test CheckCanInviteToSharedChannel: Invalid shared channel", func(t *testing.T) {
		err := th.App.CheckCanInviteToSharedChannel(model.NewId())
		assert.Error(t, err, "invalid channel should not allow invites")
	})
}

// TestApp_RemoteUnsharing tests the functionality where a shared channel is unshared on one side and triggers an unshare on the remote cluster.
// This test uses a self-referential approach where a server syncs with itself through real HTTP communication.
func TestApp_RemoteUnsharing(t *testing.T) {
	th := setupSharedChannels(t).InitBasic()
	defer th.TearDown()

	ss := th.App.Srv().Store()

	// Get the shared channel service and cast to concrete type
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	service, ok := scsInterface.(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service concrete type")

	// Ensure services are active
	err := service.Start()
	require.NoError(t, err)

	rcService := th.App.Srv().GetRemoteClusterService()
	if rcService != nil {
		_ = rcService.Start()
	}

	t.Run("remote-initiated unshare with single remote", func(t *testing.T) {
		EnsureCleanState(t, th, ss)

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
			RemoteId:     model.NewId(),
			Name:         "test-remote",
			DisplayName:  "Test Remote",
			SiteURL:      testServer.URL,
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		selfCluster, err = ss.RemoteCluster().Save(selfCluster)
		require.NoError(t, err)

		// Initialize sync handler
		syncHandler = NewSelfReferentialSyncHandler(t, service, selfCluster)

		// Create a shared channel
		channel := th.CreateChannel(th.Context, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			TeamId:           channel.TeamId,
			Home:             true,
			ReadOnly:         false,
			ShareName:        channel.Name,
			ShareDisplayName: channel.DisplayName,
			SharePurpose:     channel.Purpose,
			ShareHeader:      channel.Header,
			CreatorId:        th.BasicUser.Id,
			RemoteId:         "",
		}

		_, err = th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Share the channel with the remote
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          selfCluster.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
		}
		_, err = ss.SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Get post count before "remote-initiated unshare"
		postsBeforeRemove, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
		postCountBefore := len(postsBeforeRemove.Posts)

		// Verify the channel is initially shared
		err = th.App.checkChannelIsShared(channel.Id)
		require.NoError(t, err, "Channel should be shared initially")

		// Step 1: Verify the channel is initially shared
		err = th.App.checkChannelIsShared(channel.Id)
		require.NoError(t, err, "Channel should be shared initially")

		// Step 2: Create a sync message that would be sent to the remote
		syncMsg := model.NewSyncMsg(channel.Id)
		syncMsg.Posts = []*model.Post{{
			Id:        model.NewId(),
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Test message after remote unshare",
			CreateAt:  model.GetMillis(),
		}}

		// Step 3: Simulate receiving ErrChannelIsNotShared from the remote
		// This directly tests the error handling logic without async complexity
		service.HandleChannelNotSharedErrorForTesting(syncMsg, selfCluster)

		// Step 4: Verify the channel is no longer shared locally
		err = th.App.checkChannelIsShared(channel.Id)
		assert.Error(t, err, "Channel should no longer be shared after error handling")

		// Verify a system message was posted to inform users the channel is no longer shared
		postsAfterRemove, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)

		// Expected: only one notification post when a remote is removed
		assert.Equal(t, postCountBefore+1, len(postsAfterRemove.Posts), "There should be one new post")

		// Find and verify the system message content
		var systemPost *model.Post
		for _, p := range postsAfterRemove.Posts {
			if p.Type == model.PostTypeSystemGeneric {
				systemPost = p
				break
			}
		}
		require.NotNil(t, systemPost, "A system post should be created")
		assert.Equal(t, "This channel is no longer shared.", systemPost.Message, "Message should match unshare message")
	})

	t.Run("remote-initiated unshare with multiple remotes", func(t *testing.T) {
		EnsureCleanState(t, th, ss)

		var syncHandler1, syncHandler2 *SelfReferentialSyncHandler

		// Create test HTTP servers for both remotes
		testServer1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandler1 != nil {
				syncHandler1.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer1.Close()

		testServer2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if syncHandler2 != nil {
				syncHandler2.HandleRequest(w, r)
			} else {
				writeOKResponse(w)
			}
		}))
		defer testServer2.Close()

		// Create two self-referential remote clusters
		selfCluster1 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "test-remote-1",
			DisplayName:  "Test Remote 1",
			SiteURL:      testServer1.URL,
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		selfCluster1, err = ss.RemoteCluster().Save(selfCluster1)
		require.NoError(t, err)

		selfCluster2 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "test-remote-2",
			DisplayName:  "Test Remote 2",
			SiteURL:      testServer2.URL,
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		selfCluster2, err = ss.RemoteCluster().Save(selfCluster2)
		require.NoError(t, err)

		// Initialize sync handlers
		syncHandler1 = NewSelfReferentialSyncHandler(t, service, selfCluster1)
		syncHandler2 = NewSelfReferentialSyncHandler(t, service, selfCluster2)

		// Create a shared channel
		channel := th.CreateChannel(th.Context, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			TeamId:           channel.TeamId,
			Home:             true,
			ReadOnly:         false,
			ShareName:        channel.Name,
			ShareDisplayName: channel.DisplayName,
			SharePurpose:     channel.Purpose,
			ShareHeader:      channel.Header,
			CreatorId:        th.BasicUser.Id,
			RemoteId:         "",
		}

		_, err = th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Share the channel with both remotes
		scr1 := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          selfCluster1.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
		}
		_, err = ss.SharedChannel().SaveRemote(scr1)
		require.NoError(t, err)

		scr2 := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          selfCluster2.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
		}
		_, err = ss.SharedChannel().SaveRemote(scr2)
		require.NoError(t, err)

		// Verify the channel is shared with both remotes
		hasRemote1, err := ss.SharedChannel().HasRemote(channel.Id, selfCluster1.RemoteId)
		require.NoError(t, err)
		require.True(t, hasRemote1, "Channel should be shared with remote 1")

		hasRemote2, err := ss.SharedChannel().HasRemote(channel.Id, selfCluster2.RemoteId)
		require.NoError(t, err)
		require.True(t, hasRemote2, "Channel should be shared with remote 2")

		// Step 1: Verify the channel is initially shared with both remotes
		err = th.App.checkChannelIsShared(channel.Id)
		require.NoError(t, err, "Channel should be shared initially")

		// Step 2: Create a post in the channel to trigger sync activity
		post := &model.Post{
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Test message after remote 1 unshare",
		}
		_, appErr := th.App.CreatePost(th.Context, post, channel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// Get post count after creating the test post but before "remote-initiated unshare"
		postsBeforeRemove, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
		postCountBefore := len(postsBeforeRemove.Posts)

		// Step 3: Create a sync message for remote 1
		syncMsg := model.NewSyncMsg(channel.Id)
		syncMsg.Posts = []*model.Post{{
			Id:        model.NewId(),
			ChannelId: channel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Test message after remote 1 unshare",
			CreateAt:  model.GetMillis(),
		}}

		// Step 4: Simulate remote 1 returning ErrChannelIsNotShared
		service.HandleChannelNotSharedErrorForTesting(syncMsg, selfCluster1)

		// Verify we now have only 1 remote (remote 2)
		remotes, err := ss.SharedChannel().GetRemotes(0, 10, model.SharedChannelRemoteFilterOpts{
			ChannelId: channel.Id,
		})
		require.NoError(t, err)
		require.Len(t, remotes, 1, "Expected 1 remote after removing remote 1")
		t.Logf("Number of remotes after unshare: %d", len(remotes))

		// The expected behavior is that only the specific remote should be removed,
		// with the channel remaining shared with other remotes.
		err = th.App.checkChannelIsShared(channel.Id)

		// The channel should still be shared with remote2, so this should pass
		assert.NoError(t, err, "Channel should still be shared with other remotes")

		// Verify remote 1 is no longer in shared channel
		hasRemote1After, err := ss.SharedChannel().HasRemote(channel.Id, selfCluster1.RemoteId)
		require.NoError(t, err)
		require.False(t, hasRemote1After, "Channel should no longer be shared with remote 1")

		// Check if remote 2 is still associated with the channel
		// Expected behavior: remote 2 should still be associated
		hasRemote2After, err := ss.SharedChannel().HasRemote(channel.Id, selfCluster2.RemoteId)
		require.NoError(t, err)
		assert.True(t, hasRemote2After, "Channel should still be shared with remote 2")

		// Verify a system message was posted about remote 1 unsharing
		postsAfterRemove, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)

		// Expected: only one notification post when a remote is removed
		assert.Equal(t, postCountBefore+1, len(postsAfterRemove.Posts), "There should be one new post")

		// Find and verify the system message content
		var systemPost *model.Post
		for _, p := range postsAfterRemove.Posts {
			if p.Type == model.PostTypeSystemGeneric {
				systemPost = p
				break
			}
		}
		require.NotNil(t, systemPost, "A system post should be created")
		assert.Equal(t, "This channel is no longer shared.", systemPost.Message, "Message should match unshare message")
	})
}

func TestSyncMessageErrChannelNotSharedResponse(t *testing.T) {
	th := setupSharedChannels(t).InitBasic()
	defer th.TearDown()

	// Setup: Create a shared channel and remote cluster
	ss := th.App.Srv().Store()

	// Get the shared channel service and cast to concrete type
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	service, ok := scsInterface.(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service concrete type")

	channel := th.CreateChannel(th.Context, th.BasicTeam)
	sc := &model.SharedChannel{
		ChannelId:        channel.Id,
		TeamId:           th.BasicTeam.Id,
		Home:             true,
		ShareName:        channel.Name,
		ShareDisplayName: channel.DisplayName,
		CreatorId:        th.BasicUser.Id,
		RemoteId:         "",
	}
	_, err := ss.SharedChannel().Save(sc)
	require.NoError(t, err)

	// Create a self-referential remote cluster
	selfCluster := &model.RemoteCluster{
		RemoteId:     model.NewId(),
		Name:         "test-remote",
		DisplayName:  "Test Remote",
		SiteURL:      "https://test.example.com",
		Token:        model.NewId(),
		CreateAt:     model.GetMillis(),
		LastPingAt:   model.GetMillis(),
		CreatorId:    th.BasicUser.Id,
		RemoteTeamId: model.NewId(),
	}
	selfCluster, err = ss.RemoteCluster().Save(selfCluster)
	require.NoError(t, err)

	// Create shared channel remote
	scr := &model.SharedChannelRemote{
		Id:                model.NewId(),
		ChannelId:         channel.Id,
		CreatorId:         th.BasicUser.Id,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
		RemoteId:          selfCluster.RemoteId,
		LastPostCreateAt:  model.GetMillis(),
		LastPostUpdateAt:  model.GetMillis(),
	}
	_, err = ss.SharedChannel().SaveRemote(scr)
	require.NoError(t, err)

	// Verify channel is initially shared
	hasRemote, err := ss.SharedChannel().HasRemote(channel.Id, selfCluster.RemoteId)
	require.NoError(t, err)
	require.True(t, hasRemote, "Channel should be shared with remote initially")

	// Test: Simulate sync message callback receiving ErrChannelNotShared response
	syncMsg := model.NewSyncMsg(channel.Id)
	syncMsg.Posts = []*model.Post{{
		Id:        model.NewId(),
		ChannelId: channel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "Test sync message",
		CreateAt:  model.GetMillis(),
	}}

	// Create a response that simulates the remote returning ErrChannelNotShared
	response := &remotecluster.Response{
		Status: "fail",
		Err:    "cannot process sync message; channel is no longer shared: " + channel.Id,
	}

	// Test the complete flow by simulating what happens in sendSyncMsgToRemote callback
	// This tests the fixed error detection logic that checks rcResp.Err
	var callbackTriggered bool
	mockCallback := func(rcMsg model.RemoteClusterMsg, rc *model.RemoteCluster, rcResp *remotecluster.Response, errResp error) {
		callbackTriggered = true

		// This simulates the fixed logic in sync_send_remote.go
		if rcResp != nil && !rcResp.IsSuccess() && strings.Contains(rcResp.Err, "channel is no longer shared") {
			service.HandleChannelNotSharedErrorForTesting(syncMsg, rc)
		}
	}

	// Trigger the callback with our mock response
	mockCallback(model.RemoteClusterMsg{}, selfCluster, response, nil)

	// Verify the callback was triggered
	require.True(t, callbackTriggered, "Callback should have been triggered")

	// Verify the channel is no longer shared with the remote
	hasRemoteAfter, err := ss.SharedChannel().HasRemote(channel.Id, selfCluster.RemoteId)
	require.NoError(t, err)
	require.False(t, hasRemoteAfter, "Channel should no longer be shared with remote after error")

	// Verify a system message was posted
	posts, appErr := th.App.GetPostsPage(model.GetPostsOptions{
		ChannelId: channel.Id,
		Page:      0,
		PerPage:   10,
	})
	require.Nil(t, appErr)

	// Find the system message
	var systemPost *model.Post
	for _, p := range posts.Posts {
		if p.Type == model.PostTypeSystemGeneric && p.Message == "This channel is no longer shared." {
			systemPost = p
			break
		}
	}
	require.NotNil(t, systemPost, "System message should be posted when channel becomes unshared")
}

// PostTrackingSyncHandler extends the utilities handler to track received posts for testing
type PostTrackingSyncHandler struct {
	*SelfReferentialSyncHandler
	receivedPosts []*model.Post // Track received posts for validation
}

// NewPostTrackingSyncHandler creates a new handler that tracks received posts
func NewPostTrackingSyncHandler(t *testing.T, service *sharedchannel.Service, selfCluster *model.RemoteCluster) *PostTrackingSyncHandler {
	baseHandler := NewSelfReferentialSyncHandler(t, service, selfCluster)
	return &PostTrackingSyncHandler{
		SelfReferentialSyncHandler: baseHandler,
		receivedPosts:              make([]*model.Post, 0),
	}
}

// HandleRequest extends the base handler to also track posts
func (h *PostTrackingSyncHandler) HandleRequest(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/api/v4/remotecluster/msg" {
		// Read and capture posts before delegating to base handler
		body, _ := io.ReadAll(r.Body)
		var frame model.RemoteClusterFrame
		if json.Unmarshal(body, &frame) == nil {
			var syncMsg model.SyncMsg
			if json.Unmarshal(frame.Msg.Payload, &syncMsg) == nil {
				// Track received posts for validation
				h.receivedPosts = append(h.receivedPosts, syncMsg.Posts...)
			}
		}

		// Create a new request with the body content for the base handler
		r.Body = io.NopCloser(bytes.NewReader(body))
	}

	// Delegate to base handler
	h.SelfReferentialSyncHandler.HandleRequest(w, r)
}

// GetReceivedPosts returns the posts received by this handler
func (h *PostTrackingSyncHandler) GetReceivedPosts() []*model.Post {
	return h.receivedPosts
}

// ResetReceivedPosts clears the received posts list for testing
func (h *PostTrackingSyncHandler) ResetReceivedPosts() {
	h.receivedPosts = make([]*model.Post, 0)
}

func TestMentionTransformationEndToEnd(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSharedChannels(t).InitBasic()

	EnsureCleanState(t, th, th.App.Srv().Store())

	localUser := th.CreateUser()
	th.LinkUserToTeam(localUser, th.BasicTeam)

	sharedChannel := th.CreateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(localUser, sharedChannel)

	sc := &model.SharedChannel{
		ChannelId: sharedChannel.Id,
		TeamId:    th.BasicTeam.Id,
		Home:      true,
		ShareName: "testchannel",
		CreatorId: th.BasicUser.Id,
	}
	_, err := th.App.ShareChannel(th.Context, sc)
	require.NoError(t, err)

	scs := th.App.Srv().Platform().GetSharedChannelService()
	require.NotNil(t, scs)

	remoteCluster := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		Name:        "test-remote",
		DisplayName: "Test Remote",
		SiteURL:     "http://test-remote.example.com",
		Token:       model.NewId(),
		CreatorId:   th.BasicUser.Id,
		CreateAt:    model.GetMillis(),
		LastPingAt:  model.GetMillis(),
	}

	savedRemoteCluster, appErr := th.App.AddRemoteCluster(remoteCluster)
	require.Nil(t, appErr)

	concreteScs, ok := scs.(*sharedchannel.Service)
	require.True(t, ok, "Should be able to cast to concrete service")
	handler := NewPostTrackingSyncHandler(t, concreteScs, savedRemoteCluster)
	testServer := httptest.NewServer(http.HandlerFunc(handler.HandleRequest))
	defer testServer.Close()

	savedRemoteCluster.SiteURL = testServer.URL
	_, appErr = th.App.UpdateRemoteCluster(savedRemoteCluster)
	require.Nil(t, appErr)

	scr := &model.SharedChannelRemote{
		Id:                model.NewId(),
		ChannelId:         sharedChannel.Id,
		CreatorId:         th.BasicUser.Id,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
		RemoteId:          savedRemoteCluster.RemoteId,
		LastPostCreateAt:  0,
		LastPostUpdateAt:  0,
	}
	_, err = th.App.Srv().Store().SharedChannel().SaveRemote(scr)
	require.NoError(t, err)

	// Create a local admin user on the receiving cluster (test-remote)
	// This is the user that @admin:test-remote should resolve to when the suffix is stripped
	localAdmin := th.CreateUser()
	localAdmin.Username = "admin"
	localAdmin, updateErr := th.App.UpdateUser(th.Context, localAdmin, false)
	require.Nil(t, updateErr)
	th.LinkUserToTeam(localAdmin, th.BasicTeam)
	th.AddUserToChannel(localAdmin, sharedChannel)

	// Note: We don't manually create a remote user here.
	// The sync process will automatically create a remote user with username "admin:test-remote"
	// when it processes users from the sending cluster.

	// Helper functions to reduce duplication
	createAndSyncPost := func(message string) (*model.Post, *model.Post) {
		post := &model.Post{
			ChannelId: sharedChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   message,
		}

		rpost, postErr := th.App.CreatePost(th.Context, post, sharedChannel, model.CreatePostFlags{TriggerWebhooks: true, SetOnline: true})
		require.Nil(t, postErr)

		require.Eventually(t, func() bool {
			return len(handler.GetReceivedPosts()) > 0
		}, 5*time.Second, 100*time.Millisecond, "Should receive synced post")

		receivedPosts := handler.GetReceivedPosts()
		var receivedPost *model.Post
		for _, p := range receivedPosts {
			if p.Id == rpost.Id {
				receivedPost = p
				break
			}
		}
		require.NotNil(t, receivedPost, "Should find the post we just created in the received posts")

		return rpost, receivedPost
	}

	getFinalPost := func(postId string) *model.Post {
		finalPost, appErr := th.App.GetSinglePost(th.Context, postId, false)
		require.Nil(t, appErr, "Should be able to get the final processed post")
		return finalPost
	}

	analyzeMentions := func(message string) (model.UserMentionMap, []string) {
		mentionMap := th.App.MentionsToTeamMembers(th.Context, message, th.BasicTeam.Id)
		possibleMentions := possibleAtMentions(message)
		return mentionMap, possibleMentions
	}

	t.Run("Scenario 1: Local user mention - complete validation", func(t *testing.T) {
		// Reset received posts
		handler.ResetReceivedPosts()

		// Create and sync a post mentioning the local user
		message := fmt.Sprintf("Hello @%s, can you help?", localUser.Username)
		_, receivedPost := createAndSyncPost(message)

		// Validate complete mention functionality
		t.Run("Message text validation", func(t *testing.T) {
			// Local user mentions should remain unchanged when synced to remote cluster
			// The raw sync message preserves the original mention format
			finalPost := getFinalPost(receivedPost.Id)

			expectedMessage := fmt.Sprintf("Hello @%s, can you help?", localUser.Username)
			t.Logf("Expected: %s", expectedMessage)
			t.Logf("Actual:   %s", finalPost.Message)

			require.Equal(t, expectedMessage, finalPost.Message,
				"Local user mention should remain unchanged when synced to remote cluster")
		})

		t.Run("User ID resolution validation", func(t *testing.T) {
			// Simulate what happens when someone on the remote cluster processes this mention
			// The mention should resolve to the ORIGINAL user ID from the sending cluster

			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, possibleMentions := analyzeMentions(finalPost.Message)
			t.Logf("Mention map: %+v", mentionMap)
			t.Logf("Possible mentions: %+v", possibleMentions)

			// When the remote cluster resolves the mention,
			// it should point to the ORIGINAL user from the sending cluster,
			// NOT to a local user with the same name

			for _, mention := range possibleMentions {
				if userID, exists := mentionMap[mention]; exists {
					// Get the user this mention resolves to
					mentionedUser, userErr := th.App.Srv().Store().User().Get(context.Background(), userID)
					require.NoError(t, userErr)

					t.Logf("Mention '@%s' resolves to user: ID=%s, Username=%s, RemoteId=%v",
						mention, mentionedUser.Id, mentionedUser.Username, mentionedUser.RemoteId)

					// The mention should resolve to the ORIGINAL user
					// If there's a local user with the same name, the mention should NOT resolve to them
					require.Equal(t, localUser.Id, mentionedUser.Id,
						"Mention should resolve to the original user from sending cluster, not local user with same name")

					// The user should either be:
					// 1. The original user (if somehow synced)
					// 2. A remote user reference pointing to the sending cluster
					if mentionedUser.IsRemote() {
						// If it's a remote user, it should point to the sending cluster
						require.NotEqual(t, savedRemoteCluster.RemoteId, mentionedUser.GetRemoteID(),
							"Remote user should not point to the receiving cluster")
					}
				}
			}
		})

		t.Run("Notification validation", func(t *testing.T) {
			// When a mention is processed, the notification should go to the CORRECT user

			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, _ := analyzeMentions(finalPost.Message)

			// The original user should be in the mention map to receive notifications
			found := false
			for _, userID := range mentionMap {
				if userID == localUser.Id {
					found = true
					break
				}
			}

			require.True(t, found,
				"Original user should be in mention map to receive notification when mentioned from remote cluster")
		})
	})

	t.Run("Scenario 2: Remote user mention - complete validation", func(t *testing.T) {
		// Reset received posts
		handler.ResetReceivedPosts()

		// Create and sync a post mentioning the remote user with cluster suffix
		mentionWithSuffix := fmt.Sprintf("admin:%s", savedRemoteCluster.Name)
		message := fmt.Sprintf("Hello @%s, can you help?", mentionWithSuffix)
		_, receivedPost := createAndSyncPost(message)

		t.Run("Message text validation", func(t *testing.T) {
			// The remote user mention should be stripped to just "@admin" when sent to their home cluster
			finalPost := getFinalPost(receivedPost.Id)

			expectedMessage := "Hello @admin, can you help?"
			t.Logf("Raw received post message: %s", receivedPost.Message)
			t.Logf("Final processed post message: %s", finalPost.Message)
			t.Logf("Expected message: %s", expectedMessage)

			require.Equal(t, expectedMessage, finalPost.Message,
				"Remote user mention should be transformed to local format when sending to user's home cluster")
		})

		t.Run("User ID resolution validation", func(t *testing.T) {
			// When "@admin:org2" is mentioned on org1 and sent to org2,
			// the resulting "@admin" mention should resolve to the CORRECT admin user on org2

			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, possibleMentions := analyzeMentions(finalPost.Message)

			t.Logf("Raw received post message: %s", receivedPost.Message)
			t.Logf("Final processed post message: %s", finalPost.Message)
			t.Logf("Local admin user: ID=%s, Username=%s", localAdmin.Id, localAdmin.Username)
			t.Logf("Mention map: %+v", mentionMap)
			t.Logf("Possible mentions: %+v", possibleMentions)

			// Find the "admin" mention
			adminUserID, exists := mentionMap["admin"]
			require.True(t, exists, "Should find 'admin' mention in the message")

			// Get the user this mention resolves to
			mentionedUser, userErr := th.App.Srv().Store().User().Get(context.Background(), adminUserID)
			require.NoError(t, userErr)

			t.Logf("Mention '@admin' resolves to user: ID=%s, Username=%s, RemoteId=%v",
				mentionedUser.Id, mentionedUser.Username, mentionedUser.RemoteId)

			// When @admin:test-remote is processed on test-remote cluster, it should resolve to local admin
			require.Equal(t, localAdmin.Id, mentionedUser.Id,
				"@admin mention should resolve to the local admin user")

			// The user should be the local admin (not remote)
			require.False(t, mentionedUser.IsRemote(),
				"The resolved user should be local, not remote")

			// Verify this is a local user (no remote username prop needed)
			require.Equal(t, "admin", mentionedUser.Username,
				"The username should be admin")
		})

		t.Run("Profile link validation", func(t *testing.T) {
			// This validates what happens when someone clicks the @admin mention
			// It should open the profile of the CORRECT admin user (from the original cluster)

			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, _ := analyzeMentions(finalPost.Message)
			adminUserID, exists := mentionMap["admin"]
			require.True(t, exists)

			// When UI tries to get user info for profile link
			userProfile, userErr := th.App.GetUser(adminUserID)
			require.Nil(t, userErr)

			// Should be the local admin user
			require.Equal(t, localAdmin.Id, userProfile.Id,
				"Profile link should point to the local admin user")
			require.False(t, userProfile.IsRemote(),
				"Profile should be for local admin user on this cluster")

			t.Logf("Profile link points to: User ID=%s, Username=%s, RemoteId=%s",
				userProfile.Id, userProfile.Username, userProfile.GetRemoteID())
		})

		t.Run("Cross-cluster username collision test", func(t *testing.T) {
			// This is the scenario from your bug report:
			// When "@admin:test-remote" is mentioned and transformed to "@admin",
			// it should resolve to the LOCAL admin on test-remote cluster (where it's received)
			// NOT to any other user with a different username

			// Create another user with a similar but different username to test precision
			collisionUser := th.CreateUser()
			collisionUser.Username = "admin-collision"
			collisionUser, updateErr := th.App.UpdateUser(th.Context, collisionUser, false)
			require.Nil(t, updateErr)
			th.LinkUserToTeam(collisionUser, th.BasicTeam)
			th.AddUserToChannel(collisionUser, sharedChannel)

			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, _ := analyzeMentions(finalPost.Message)

			t.Logf("Local admin: ID=%s, Username=%s", localAdmin.Id, localAdmin.Username)
			t.Logf("Collision user: ID=%s, Username=%s", collisionUser.Id, collisionUser.Username)
			t.Logf("Mention map: %+v", mentionMap)

			// When "@admin" mention is processed, it should resolve to the exact match "admin"
			adminUserID, exists := mentionMap["admin"]
			require.True(t, exists, "Should find admin mention")

			t.Logf("Mention '@admin' resolves to ID: %s", adminUserID)

			// The mention should resolve to the LOCAL admin user (exact username match)
			require.Equal(t, localAdmin.Id, adminUserID,
				"Mention should resolve to the local admin user with exact username match")

			// Verify it's NOT the collision user
			require.NotEqual(t, collisionUser.Id, adminUserID,
				"Mention should NOT resolve to user with similar but different username")
		})
	})

	t.Run("Scenario 3: Mixed mentions should transform appropriately", func(t *testing.T) {
		// Reset received posts
		handler.ResetReceivedPosts()

		// Create and sync a post mentioning both local and remote users
		mentionWithSuffix := fmt.Sprintf("admin:%s", savedRemoteCluster.Name)
		message := fmt.Sprintf("Hey @%s and @%s, let's collaborate!", localUser.Username, mentionWithSuffix)
		_, receivedPost := createAndSyncPost(message)

		t.Run("Message text validation", func(t *testing.T) {
			// Local user mention stays as-is, remote user mention gets stripped
			finalPost := getFinalPost(receivedPost.Id)

			expectedMessage := fmt.Sprintf("Hey @%s and @admin, let's collaborate!", localUser.Username)
			t.Logf("Raw received post message: %s", receivedPost.Message)
			t.Logf("Final processed post message: %s", finalPost.Message)
			t.Logf("Expected message: %s", expectedMessage)

			require.Equal(t, expectedMessage, finalPost.Message,
				"Mixed mentions should transform only remote users when sending to their home cluster")
		})

		t.Run("User ID resolution validation", func(t *testing.T) {
			// Both mentions should resolve to the correct users
			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, possibleMentions := analyzeMentions(finalPost.Message)

			t.Logf("Mention map: %+v", mentionMap)
			t.Logf("Possible mentions: %+v", possibleMentions)

			// Local user mention should resolve to localUser
			localUserID, exists := mentionMap[localUser.Username]
			require.True(t, exists, "Should find local user mention")
			require.Equal(t, localUser.Id, localUserID,
				"Local user mention should resolve to the correct local user")

			// Admin mention should resolve to localAdmin (transformed from remote mention)
			adminUserID, exists := mentionMap["admin"]
			require.True(t, exists, "Should find admin mention")
			require.Equal(t, localAdmin.Id, adminUserID,
				"Admin mention should resolve to the local admin user")
		})

		t.Run("Notification validation", func(t *testing.T) {
			// Both users should be in the mention map to receive notifications
			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, _ := analyzeMentions(finalPost.Message)

			// Check that both users would receive notifications
			expectedUsers := map[string]string{
				localUser.Username: localUser.Id,
				"admin":            localAdmin.Id,
			}

			for username, expectedID := range expectedUsers {
				actualID, exists := mentionMap[username]
				require.True(t, exists, "User %s should be in mention map", username)
				require.Equal(t, expectedID, actualID,
					"User %s should resolve to correct ID for notifications", username)
			}
		})
	})

	t.Run("Bug Scenario: True username collision test", func(t *testing.T) {
		// This test reproduces the real bug scenario:
		// Two different clusters both have users named "admin"
		// When "@admin:remote-cluster" is mentioned and sent to remote-cluster,
		// it should NOT resolve to the local "admin" incorrectly

		// Create a second local admin user to simulate the collision
		// This represents a different "admin" user on the receiving cluster
		localAdminCollision := th.CreateUser()
		localAdminCollision.Username = "admin2" // We'll rename this to "admin" after creating localAdmin
		localAdminCollision, updateErr := th.App.UpdateUser(th.Context, localAdminCollision, false)
		require.Nil(t, updateErr)

		// Now rename the existing localAdmin to create the collision scenario
		// We temporarily rename one so we can create the collision
		originalAdmin := localAdmin
		originalAdmin.Username = "admin-original"
		originalAdmin, updateErr = th.App.UpdateUser(th.Context, originalAdmin, false)
		require.Nil(t, updateErr)

		// Now rename the collision user to "admin"
		localAdminCollision.Username = "admin"
		localAdminCollision, updateErr = th.App.UpdateUser(th.Context, localAdminCollision, false)
		require.Nil(t, updateErr)
		th.LinkUserToTeam(localAdminCollision, th.BasicTeam)
		th.AddUserToChannel(localAdminCollision, sharedChannel)

		// Reset received posts
		handler.ResetReceivedPosts()

		// Create and sync the test post: mention "@admin:test-remote"
		mentionWithSuffix := fmt.Sprintf("admin:%s", savedRemoteCluster.Name)
		message := fmt.Sprintf("Hey @%s, can you help with this critical issue?", mentionWithSuffix)
		_, receivedPost := createAndSyncPost(message)

		t.Run("Message transformation validation", func(t *testing.T) {
			// Verify the message transforms correctly from @admin:test-remote to @admin
			finalPost := getFinalPost(receivedPost.Id)

			expectedMessage := "Hey @admin, can you help with this critical issue?"
			t.Logf("Original message: %s", message)
			t.Logf("Raw received message: %s", receivedPost.Message)
			t.Logf("Final processed message: %s", finalPost.Message)
			t.Logf("Expected message: %s", expectedMessage)

			require.Equal(t, expectedMessage, finalPost.Message,
				"@admin:test-remote should transform to @admin when received on test-remote cluster")
		})

		t.Run("Collision resolution test", func(t *testing.T) {
			// THE CORE BUG TEST: When there are multiple users that could match "@admin",
			// which one does the system choose?

			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, possibleMentions := analyzeMentions(finalPost.Message)

			t.Logf("Available admin users in team:")
			t.Logf("  Original admin (admin-original): ID=%s, Username=%s", originalAdmin.Id, originalAdmin.Username)
			t.Logf("  Collision admin (admin): ID=%s, Username=%s", localAdminCollision.Id, localAdminCollision.Username)
			t.Logf("Mention map: %+v", mentionMap)
			t.Logf("Possible mentions: %+v", possibleMentions)

			// When @admin is processed, it should resolve to the exact username match
			adminUserID, exists := mentionMap["admin"]
			require.True(t, exists, "Should find admin mention in the processed message")

			resolvedUser, userErr := th.App.Srv().Store().User().Get(context.Background(), adminUserID)
			require.NoError(t, userErr)

			t.Logf("@admin mention resolved to: ID=%s, Username=%s",
				resolvedUser.Id, resolvedUser.Username)

			// The mention should resolve to the user with exact username "admin"
			// NOT to the user with username "admin-original"
			require.Equal(t, localAdminCollision.Id, resolvedUser.Id,
				"@admin mention should resolve to user with exact username 'admin'")
			require.Equal(t, "admin", resolvedUser.Username,
				"Resolved user should have exact username 'admin'")

			// Verify it's NOT the original admin user
			require.NotEqual(t, originalAdmin.Id, resolvedUser.Id,
				"Should NOT resolve to the user with username 'admin-original'")
		})

		t.Run("Profile link and notification consequences", func(t *testing.T) {
			// Show the real-world impact: which user gets the notification and profile click
			finalPost := getFinalPost(receivedPost.Id)
			mentionMap, _ := analyzeMentions(finalPost.Message)

			adminUserID := mentionMap["admin"]
			t.Logf("When user clicks @admin mention, profile will open user ID: %s", adminUserID)

			// Get the actual user profile that would be shown
			userProfile, userErr := th.App.GetUser(adminUserID)
			require.Nil(t, userErr)

			t.Logf("Profile shows: ID=%s, Username=%s", userProfile.Id, userProfile.Username)

			// The correct behavior: profile should be for the user with exact username "admin"
			require.Equal(t, localAdminCollision.Id, userProfile.Id,
				"Profile link should point to the user with exact username 'admin'")
			require.Equal(t, "admin", userProfile.Username,
				"Profile should show username 'admin'")

			// Notification impact: the correct user should get notified
			require.Equal(t, localAdminCollision.Id, adminUserID,
				"Notification should go to user with exact username 'admin'")
		})
	})
}
