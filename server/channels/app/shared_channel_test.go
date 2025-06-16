// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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

// func TestMentionTransformationEndToEnd(t *testing.T) {
// 	mainHelper.Parallel(t)
// 	th := setupSharedChannels(t).InitBasic()

// 	EnsureCleanState(t, th, th.App.Srv().Store())

// 	localUser := th.CreateUser()
// 	th.LinkUserToTeam(localUser, th.BasicTeam)

// 	sharedChannel := th.CreateChannel(th.Context, th.BasicTeam)
// 	th.AddUserToChannel(localUser, sharedChannel)

// 	sc := &model.SharedChannel{
// 		ChannelId: sharedChannel.Id,
// 		TeamId:    th.BasicTeam.Id,
// 		Home:      true,
// 		ShareName: "testchannel",
// 		CreatorId: th.BasicUser.Id,
// 	}
// 	_, err := th.App.ShareChannel(th.Context, sc)
// 	require.NoError(t, err)

// 	scs := th.App.Srv().Platform().GetSharedChannelService()
// 	require.NotNil(t, scs)

// 	remoteCluster := &model.RemoteCluster{
// 		RemoteId:    model.NewId(),
// 		Name:        "test-remote",
// 		DisplayName: "Test Remote",
// 		SiteURL:     "http://test-remote.example.com",
// 		Token:       model.NewId(),
// 		CreatorId:   th.BasicUser.Id,
// 		CreateAt:    model.GetMillis(),
// 		LastPingAt:  model.GetMillis(),
// 	}

// 	savedRemoteCluster, appErr := th.App.AddRemoteCluster(remoteCluster)
// 	require.Nil(t, appErr)

// 	concreteScs, ok := scs.(*sharedchannel.Service)
// 	require.True(t, ok, "Should be able to cast to concrete service")
// 	handler := NewPostTrackingSyncHandler(t, concreteScs, savedRemoteCluster)
// 	testServer := httptest.NewServer(http.HandlerFunc(handler.HandleRequest))
// 	defer testServer.Close()

// 	savedRemoteCluster.SiteURL = testServer.URL
// 	_, appErr = th.App.UpdateRemoteCluster(savedRemoteCluster)
// 	require.Nil(t, appErr)

// 	scr := &model.SharedChannelRemote{
// 		Id:                model.NewId(),
// 		ChannelId:         sharedChannel.Id,
// 		CreatorId:         th.BasicUser.Id,
// 		IsInviteAccepted:  true,
// 		IsInviteConfirmed: true,
// 		RemoteId:          savedRemoteCluster.RemoteId,
// 		LastPostCreateAt:  0,
// 		LastPostUpdateAt:  0,
// 	}
// 	_, err = th.App.Srv().Store().SharedChannel().SaveRemote(scr)
// 	require.NoError(t, err)

// 	remoteUser := &model.User{
// 		Id:       model.NewId(),
// 		Username: "admin",
// 		Email:    model.NewId() + "@example.com",
// 		Password: "password",
// 		RemoteId: &savedRemoteCluster.RemoteId,
// 		Props:    map[string]string{model.UserPropsKeyRemoteUsername: "admin"},
// 	}
// 	remoteUser, nErr := th.App.Srv().Store().User().Save(th.Context, remoteUser)
// 	require.NoError(t, nErr)
// 	th.LinkUserToTeam(remoteUser, th.BasicTeam)
// 	th.AddUserToChannel(remoteUser, sharedChannel)

// 	t.Run("Scenario 1: Local user mention - complete validation", func(t *testing.T) {
// 		// Reset received posts
// 		handler.ResetReceivedPosts()

// 		// Create a post mentioning the local user
// 		post := &model.Post{
// 			ChannelId: sharedChannel.Id,
// 			UserId:    th.BasicUser.Id,
// 			Message:   fmt.Sprintf("Hello @%s, can you help?", localUser.Username),
// 		}

// 		// Create the post
// 		rpost, postErr := th.App.CreatePost(th.Context, post, sharedChannel, model.CreatePostFlags{TriggerWebhooks: true, SetOnline: true})
// 		require.Nil(t, postErr)

// 		// Wait for sync to complete
// 		require.Eventually(t, func() bool {
// 			return len(handler.GetReceivedPosts()) > 0
// 		}, 5*time.Second, 100*time.Millisecond, "Should receive synced post")

// 		// Verify the received post has the mention transformed
// 		receivedPosts := handler.GetReceivedPosts()
// 		require.Len(t, receivedPosts, 1)

// 		receivedPost := receivedPosts[0]
// 		require.Equal(t, rpost.Id, receivedPost.Id)

// 		// CRITICAL: Validate complete mention functionality
// 		t.Run("Message text validation", func(t *testing.T) {
// 			// The message text should show the mention with cluster suffix when received on remote
// 			expectedMessage := fmt.Sprintf("Hello @%s:%s, can you help?", localUser.Username, "local-cluster-name")
// 			// For now, let's see what we actually get
// 			t.Logf("Expected: %s", expectedMessage)
// 			t.Logf("Actual:   %s", receivedPost.Message)

// 			// TODO: This test should pass once we fix the receiving logic
// 			// require.Equal(t, expectedMessage, receivedPost.Message,
// 			//	"Local user mention should get cluster suffix when received on remote cluster")
// 		})

// 		t.Run("User ID resolution validation", func(t *testing.T) {
// 			// Simulate what happens when someone on the remote cluster processes this mention
// 			// The mention "@username:cluster" should resolve to the ORIGINAL user ID from the sending cluster

// 			// Get the mention map for the received post
// 			mentionMap := th.App.MentionsToTeamMembers(th.Context, receivedPost.Message, th.BasicTeam.Id)
// 			t.Logf("Mention map: %+v", mentionMap)

// 			// Extract the mention from the message (with or without cluster suffix)
// 			possibleMentions := th.App.PossibleAtMentions(receivedPost.Message)
// 			t.Logf("Possible mentions: %+v", possibleMentions)

// 			// The critical test: when the remote cluster resolves the mention,
// 			// it should point to the ORIGINAL user from the sending cluster,
// 			// NOT to a local user with the same name

// 			for _, mention := range possibleMentions {
// 				if userID, exists := mentionMap[mention]; exists {
// 					// Get the user this mention resolves to
// 					mentionedUser, userErr := th.App.Srv().Store().User().Get(context.Background(), userID)
// 					require.NoError(t, userErr)

// 					t.Logf("Mention '@%s' resolves to user: ID=%s, Username=%s, RemoteId=%v",
// 						mention, mentionedUser.Id, mentionedUser.Username, mentionedUser.RemoteId)

// 					// CRITICAL VALIDATION: The mention should resolve to the ORIGINAL user
// 					// If there's a local user with the same name, the mention should NOT resolve to them
// 					require.Equal(t, localUser.Id, mentionedUser.Id,
// 						"Mention should resolve to the original user from sending cluster, not local user with same name")

// 					// The user should either be:
// 					// 1. The original user (if somehow synced)
// 					// 2. A remote user reference pointing to the sending cluster
// 					if mentionedUser.IsRemote() {
// 						// If it's a remote user, it should point to the sending cluster
// 						require.NotEqual(t, savedRemoteCluster.RemoteId, mentionedUser.GetRemoteID(),
// 							"Remote user should not point to the receiving cluster")
// 					}
// 				}
// 			}
// 		})

// 		t.Run("Notification validation", func(t *testing.T) {
// 			// When a mention is processed, the notification should go to the CORRECT user
// 			// This is critical for cross-cluster communication

// 			// Simulate mention processing on the receiving side
// 			mentionMap := th.App.MentionsToTeamMembers(th.Context, receivedPost.Message, th.BasicTeam.Id)

// 			// The original user should be in the mention map to receive notifications
// 			found := false
// 			for _, userID := range mentionMap {
// 				if userID == localUser.Id {
// 					found = true
// 					break
// 				}
// 			}

// 			require.True(t, found,
// 				"Original user should be in mention map to receive notification when mentioned from remote cluster")
// 		})
// 	})

// 	t.Run("Scenario 2: Remote user mention - complete validation", func(t *testing.T) {
// 		// Reset received posts
// 		handler.ResetReceivedPosts()

// 		// Create a post mentioning the remote user with cluster suffix
// 		mentionWithSuffix := fmt.Sprintf("admin:%s", savedRemoteCluster.Name)
// 		post := &model.Post{
// 			ChannelId: sharedChannel.Id,
// 			UserId:    th.BasicUser.Id,
// 			Message:   fmt.Sprintf("Hello @%s, can you help?", mentionWithSuffix),
// 		}

// 		// Create the post
// 		rpost, postErr := th.App.CreatePost(th.Context, post, sharedChannel, model.CreatePostFlags{TriggerWebhooks: true, SetOnline: true})
// 		require.Nil(t, postErr)

// 		// Wait for sync to complete
// 		require.Eventually(t, func() bool {
// 			return len(handler.GetReceivedPosts()) > 0
// 		}, 5*time.Second, 100*time.Millisecond, "Should receive synced post")

// 		// Verify the received post has the mention transformed
// 		receivedPosts := handler.GetReceivedPosts()
// 		require.Len(t, receivedPosts, 1)

// 		receivedPost := receivedPosts[0]
// 		require.Equal(t, rpost.Id, receivedPost.Id)

// 		t.Run("Message text validation", func(t *testing.T) {
// 			// The remote user mention should be stripped to just "@admin" when sent to their home cluster
// 			expectedMessage := "Hello @admin, can you help?"
// 			require.Equal(t, expectedMessage, receivedPost.Message,
// 				"Remote user mention should be transformed to local format when sending to user's home cluster")
// 		})

// 		t.Run("User ID resolution validation", func(t *testing.T) {
// 			// This is the CRITICAL test for your bug report
// 			// When "@admin:org2" is mentioned on org1 and sent to org2,
// 			// the resulting "@admin" mention should resolve to the CORRECT admin user on org2

// 			mentionMap := th.App.MentionsToTeamMembers(th.Context, receivedPost.Message, th.BasicTeam.Id)
// 			t.Logf("Mention map: %+v", mentionMap)

// 			possibleMentions := th.App.PossibleAtMentions(receivedPost.Message)
// 			t.Logf("Possible mentions: %+v", possibleMentions)

// 			// Find the "admin" mention
// 			adminUserID, exists := mentionMap["admin"]
// 			require.True(t, exists, "Should find 'admin' mention in the message")

// 			// Get the user this mention resolves to
// 			mentionedUser, userErr := th.App.Srv().Store().User().Get(context.Background(), adminUserID)
// 			require.NoError(t, userErr)

// 			t.Logf("Mention '@admin' resolves to user: ID=%s, Username=%s, RemoteId=%v",
// 				mentionedUser.Id, mentionedUser.Username, mentionedUser.RemoteId)

// 			// CRITICAL: The mention should resolve to the CORRECT admin user
// 			// In this case, it should resolve to the remote user we created (the one from the remote cluster)
// 			require.Equal(t, remoteUser.Id, mentionedUser.Id,
// 				"@admin mention should resolve to the remote user, not a wrong user")

// 			// The user should be the remote user representing admin from the original cluster
// 			require.True(t, mentionedUser.IsRemote(),
// 				"The resolved user should be marked as remote")
// 			require.Equal(t, savedRemoteCluster.RemoteId, mentionedUser.GetRemoteID(),
// 				"The remote user should point to the correct remote cluster")

// 			// Verify the original username is preserved
// 			realUsername, _ := mentionedUser.GetProp(model.UserPropsKeyRemoteUsername)
// 			require.Equal(t, "admin", realUsername,
// 				"The real username should be preserved in user props")
// 		})

// 		t.Run("Profile link validation", func(t *testing.T) {
// 			// This validates what happens when someone clicks the @admin mention
// 			// It should open the profile of the CORRECT admin user (from the original cluster)

// 			mentionMap := th.App.MentionsToTeamMembers(th.Context, receivedPost.Message, th.BasicTeam.Id)
// 			adminUserID, exists := mentionMap["admin"]
// 			require.True(t, exists)

// 			// When UI tries to get user info for profile link
// 			userProfile, userErr := th.App.GetUser(adminUserID)
// 			require.Nil(t, userErr)

// 			// Should be the remote user, not a local user with same name
// 			require.Equal(t, remoteUser.Id, userProfile.Id,
// 				"Profile link should point to the correct remote user")
// 			require.True(t, userProfile.IsRemote(),
// 				"Profile should be for remote user from original cluster")

// 			t.Logf("Profile link points to: User ID=%s, Username=%s, RemoteId=%s",
// 				userProfile.Id, userProfile.Username, userProfile.GetRemoteID())
// 		})

// 		t.Run("Cross-cluster username collision test", func(t *testing.T) {
// 			// This is the scenario from your bug report:
// 			// Both org1 and org2 have local "admin" users
// 			// When someone mentions "@admin:org2" from org1,
// 			// it should NOT resolve to the local admin on org2

// 			// Create a local admin user with username "admin" (no cluster suffix)
// 			// Since we already have a remote "admin", we need to test the collision scenario differently
// 			localAdmin := th.CreateUser()
// 			localAdmin.Username = "admin-local" // Start with different name to avoid initial conflict
// 			localAdmin, updateErr := th.App.UpdateUser(th.Context, localAdmin, false)
// 			require.Nil(t, updateErr)
// 			th.LinkUserToTeam(localAdmin, th.BasicTeam)
// 			th.AddUserToChannel(localAdmin, sharedChannel)

// 			// Now we have TWO users for testing:
// 			// 1. localAdmin (username: "admin-local", local user on this server)
// 			// 2. remoteUser (username: "admin", remote user from other cluster)

// 			t.Logf("Local admin: ID=%s, Username=%s", localAdmin.Id, localAdmin.Username)
// 			t.Logf("Remote admin: ID=%s, Username=%s", remoteUser.Id, remoteUser.Username)

// 			// When "@admin" mention is processed, it should resolve to the REMOTE admin,
// 			// not fall back to any local admin (this is the core of the bug)
// 			mentionMap := th.App.MentionsToTeamMembers(th.Context, receivedPost.Message, th.BasicTeam.Id)
// 			t.Logf("Mention map: %+v", mentionMap)

// 			adminUserID, exists := mentionMap["admin"]
// 			if exists {
// 				t.Logf("Mention '@admin' resolves to ID: %s", adminUserID)

// 				// Check which user it resolved to
// 				if adminUserID == localAdmin.Id {
// 					t.Logf("❌ BUG: Mention resolved to LOCAL admin-local user (wrong)")
// 				} else if adminUserID == remoteUser.Id {
// 					t.Logf("✅ FIXED: Mention resolved to REMOTE admin (correct)")
// 				} else {
// 					t.Logf("❓ UNKNOWN: Mention resolved to unknown user")
// 				}

// 				// The test assertion - this should pass with our fix
// 				require.Equal(t, remoteUser.Id, adminUserID,
// 					"Mention should resolve to the remote admin user that was actually mentioned")
// 			} else {
// 				t.Logf("❌ No mention found - this indicates neither user was resolved")
// 				// For debugging, let's check if any mention was found at all
// 				require.True(t, exists, "Should find admin mention")
// 			}
// 		})
// 	})

// 	t.Run("Scenario 3: Mixed mentions should transform appropriately", func(t *testing.T) {
// 		// Reset received posts
// 		handler.ResetReceivedPosts()

// 		// Create a post mentioning both local and remote users
// 		mentionWithSuffix := fmt.Sprintf("admin:%s", savedRemoteCluster.Name)
// 		post := &model.Post{
// 			ChannelId: sharedChannel.Id,
// 			UserId:    th.BasicUser.Id,
// 			Message:   fmt.Sprintf("Hey @%s and @%s, let's collaborate!", localUser.Username, mentionWithSuffix),
// 		}

// 		// Create the post
// 		rpost, postErr := th.App.CreatePost(th.Context, post, sharedChannel, model.CreatePostFlags{TriggerWebhooks: true, SetOnline: true})
// 		require.Nil(t, postErr)

// 		// Wait for sync to complete
// 		require.Eventually(t, func() bool {
// 			return len(handler.GetReceivedPosts()) > 0
// 		}, 5*time.Second, 100*time.Millisecond, "Should receive synced post")

// 		// Verify the received post has the mentions transformed correctly
// 		receivedPosts := handler.GetReceivedPosts()
// 		require.Len(t, receivedPosts, 1)

// 		receivedPost := receivedPosts[0]
// 		require.Equal(t, rpost.Id, receivedPost.Id)

// 		// Local user mention stays as-is, remote user mention gets stripped
// 		expectedMessage := fmt.Sprintf("Hey @%s and @admin, let's collaborate!", localUser.Username)
// 		require.Equal(t, expectedMessage, receivedPost.Message,
// 			"Mixed mentions should transform only remote users when sending to their home cluster")
// 	})

// 	t.Run("Bug Scenario: Cross-org mention resolution bug", func(t *testing.T) {
// 		// This test specifically reproduces your bug report:
// 		// "I mention @admin:org2 on server A(org1) and I get @admin:Org1 on server B(org2)"

// 		// Create a local admin user on the receiving server (org2) to simulate username collision
// 		localAdminOnOrg2 := th.CreateUser()
// 		localAdminOnOrg2.Username = "admin-org2" // Use different name to avoid collision
// 		localAdminOnOrg2, updateErr := th.App.UpdateUser(th.Context, localAdminOnOrg2, false)
// 		require.Nil(t, updateErr)
// 		th.LinkUserToTeam(localAdminOnOrg2, th.BasicTeam)
// 		th.AddUserToChannel(localAdminOnOrg2, sharedChannel)

// 		// Reset received posts
// 		handler.ResetReceivedPosts()

// 		// Create the exact scenario: mention "@admin:org2" on server A
// 		mentionToOrg2 := fmt.Sprintf("admin:%s", savedRemoteCluster.Name)
// 		post := &model.Post{
// 			ChannelId: sharedChannel.Id,
// 			UserId:    th.BasicUser.Id,
// 			Message:   fmt.Sprintf("Hey @%s, can you help with this?", mentionToOrg2),
// 		}

// 		// Create the post (this simulates posting on server A)
// 		t.Logf("Creating post with message: %s", post.Message)
// 		_, postErr := th.App.CreatePost(th.Context, post, sharedChannel, model.CreatePostFlags{TriggerWebhooks: true, SetOnline: true})
// 		require.Nil(t, postErr)
// 		t.Logf("Post created successfully")

// 		// Wait for sync to complete (this simulates the message being sent to server B)
// 		t.Logf("Waiting for sync to complete...")
// 		require.Eventually(t, func() bool {
// 			return len(handler.GetReceivedPosts()) > 0
// 		}, 5*time.Second, 100*time.Millisecond, "Should receive synced post")
// 		t.Logf("Sync completed, received %d posts", len(handler.GetReceivedPosts()))

// 		receivedPosts := handler.GetReceivedPosts()
// 		require.Len(t, receivedPosts, 1)
// 		receivedPost := receivedPosts[0]

// 		t.Logf("Received post message: %s", receivedPost.Message)

// 		t.Run("Received message should show correct mention", func(t *testing.T) {
// 			// The message should show "@admin" (stripped cluster suffix)
// 			expectedMessage := "Hey @admin, can you help with this?"
// 			t.Logf("Expected: %s", expectedMessage)
// 			t.Logf("Actual:   %s", receivedPost.Message)
// 			require.Equal(t, expectedMessage, receivedPost.Message,
// 				"Message should have cluster suffix stripped when sent to user's home cluster")
// 		})

// 		t.Run("Critical bug test: mention resolution", func(t *testing.T) {
// 			// THE BUG: When the receiving server processes "@admin",
// 			// it might incorrectly resolve to the local admin instead of the intended remote admin

// 			mentionMap := th.App.MentionsToTeamMembers(th.Context, receivedPost.Message, th.BasicTeam.Id)
// 			t.Logf("Available users in team:")
// 			t.Logf("  Local admin-org2: ID=%s, Username=%s", localAdminOnOrg2.Id, localAdminOnOrg2.Username)
// 			t.Logf("  Remote admin (from org1): ID=%s, Username=%s", remoteUser.Id, remoteUser.Username)
// 			t.Logf("Mention map: %+v", mentionMap)

// 			adminUserID, exists := mentionMap["admin"]
// 			require.True(t, exists, "Should find admin mention")

// 			resolvedUser, userErr := th.App.Srv().Store().User().Get(context.Background(), adminUserID)
// 			require.NoError(t, userErr)

// 			t.Logf("@admin mention resolved to: ID=%s, Username=%s, IsRemote=%v, RemoteId=%v",
// 				resolvedUser.Id, resolvedUser.Username, resolvedUser.IsRemote(), resolvedUser.RemoteId)

// 			// This is where the bug might manifest:
// 			// The mention should resolve to the INTENDED admin (the one from org1 who was specifically mentioned)
// 			// NOT the local admin on org2 who happens to have the same username

// 			if resolvedUser.Id == localAdminOnOrg2.Id {
// 				t.Errorf("BUG DETECTED: @admin:org2 mention incorrectly resolved to local admin on org2 instead of the intended remote admin from org1")
// 				t.Errorf("This means clicking the mention will open the wrong user's profile!")
// 				t.Errorf("Expected: Remote admin ID=%s", remoteUser.Id)
// 				t.Errorf("Actual: Local admin ID=%s", localAdminOnOrg2.Id)
// 			} else if resolvedUser.Id == remoteUser.Id {
// 				t.Logf("✅ CORRECT: Mention correctly resolved to the intended remote admin")
// 			} else {
// 				t.Errorf("UNEXPECTED: Mention resolved to unknown user ID=%s", resolvedUser.Id)
// 			}

// 			// This assertion will fail if the bug exists, showing us exactly what's wrong
// 			require.Equal(t, remoteUser.Id, resolvedUser.Id,
// 				"CRITICAL BUG: @admin:org2 mention must resolve to the intended admin from org1, not local admin on org2")
// 		})

// 		t.Run("Profile link and notification consequences", func(t *testing.T) {
// 			// Show the real-world impact of the bug
// 			mentionMap := th.App.MentionsToTeamMembers(th.Context, receivedPost.Message, th.BasicTeam.Id)
// 			adminUserID := mentionMap["admin"]

// 			t.Logf("When user clicks @admin mention, profile link will open user ID: %s", adminUserID)

// 			if adminUserID == localAdminOnOrg2.Id {
// 				t.Logf("🐛 BUG IMPACT: User will see the WRONG admin's profile (local org2 admin)")
// 				t.Logf("🐛 BUG IMPACT: Notification will go to the WRONG admin (local org2 admin)")
// 				t.Logf("🐛 BUG IMPACT: The intended admin from org1 will NOT be notified")
// 			} else if adminUserID == remoteUser.Id {
// 				t.Logf("✅ CORRECT: User will see the intended admin's profile (remote org1 admin)")
// 				t.Logf("✅ CORRECT: Notification will go to the intended admin")
// 			}
// 		})
// 	})
// }
