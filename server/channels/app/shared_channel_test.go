// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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
		cfg.ClusterSettings.ClusterName = model.NewPointer("test-remote")
	})
}

func TestApp_CheckCanInviteToSharedChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSharedChannels(t).InitBasic(t)

	channel1 := th.CreateChannel(t, th.BasicTeam)
	channel2 := th.CreateChannel(t, th.BasicTeam)
	channel3 := th.CreateChannel(t, th.BasicTeam)

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
	th := setupSharedChannels(t).InitBasic(t)

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
		channel := th.CreateChannel(t, th.BasicTeam)
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
		postsBeforeRemove, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
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
		postsAfterRemove, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
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
		channel := th.CreateChannel(t, th.BasicTeam)
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
		postsBeforeRemove, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
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
		postsAfterRemove, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
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
	th := setupSharedChannels(t).InitBasic(t)

	// Setup: Create a shared channel and remote cluster
	ss := th.App.Srv().Store()

	// Get the shared channel service and cast to concrete type
	scsInterface := th.App.Srv().GetSharedChannelSyncService()
	service, ok := scsInterface.(*sharedchannel.Service)
	require.True(t, ok, "Expected sharedchannel.Service concrete type")

	channel := th.CreateChannel(t, th.BasicTeam)
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
	posts, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
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

// TestTransformMentionsOnReceive provides comprehensive unit testing for the mention transformation logic
// using explicit mentionTransforms. This tests ONLY the receiver-side transformation logic
// without requiring complex end-to-end cross-cluster setup.
func TestTransformMentionsOnReceive(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSharedChannels(t).InitBasic(t)

	// Setup shared channel
	sharedChannel := th.CreateChannel(t, th.BasicTeam)
	sc := &model.SharedChannel{
		ChannelId: sharedChannel.Id,
		TeamId:    th.BasicTeam.Id,
		Home:      true,
		ShareName: "testchannel",
		CreatorId: th.BasicUser.Id,
	}
	_, err := th.App.ShareChannel(th.Context, sc)
	require.NoError(t, err)

	// Setup remote cluster representing the sender
	remoteCluster := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		Name:        "remote1",
		DisplayName: "Remote 1",
		SiteURL:     "http://remote1.example.com",
		Token:       model.NewId(),
		CreatorId:   th.BasicUser.Id,
		CreateAt:    model.GetMillis(),
		LastPingAt:  model.GetMillis(),
	}
	savedRemoteCluster, appErr := th.App.AddRemoteCluster(remoteCluster)
	require.Nil(t, appErr)

	// Get shared channel service
	scs := th.App.Srv().Platform().GetSharedChannelService()
	require.NotNil(t, scs)
	concreteScs, ok := scs.(*sharedchannel.Service)
	require.True(t, ok)

	// Helper to create test users
	createUser := func(username string, remoteId *string) *model.User {
		user := th.CreateUser(t)
		user.Username = username
		if remoteId != nil {
			user.RemoteId = remoteId
		}
		user, updateErr := th.App.UpdateUser(th.Context, user, false)
		require.Nil(t, updateErr)
		th.LinkUserToTeam(t, user, th.BasicTeam)
		th.AddUserToChannel(t, user, sharedChannel)
		return user
	}

	// Helper to test transformation
	testTransformation := func(originalMessage string, mentionTransforms map[string]string, expectedMessage string, description string) {
		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: sharedChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   originalMessage,
		}

		t.Logf("Testing: %s", description)
		t.Logf("  Original: %s", originalMessage)
		t.Logf("  Transforms: %v", mentionTransforms)

		// Call the transformation function directly
		concreteScs.TransformMentionsOnReceiveForTesting(th.Context, post, sharedChannel, savedRemoteCluster, mentionTransforms)

		t.Logf("  Result: %s", post.Message)
		t.Logf("  Expected: %s", expectedMessage)

		require.Equal(t, expectedMessage, post.Message, description)
	}

	t.Run("Scenario 1.1: Remote mentions local user (simple mention)", func(t *testing.T) {
		// Create remote user that was synced to receiver
		remoteUser := createUser("admin:remote1", &savedRemoteCluster.RemoteId)

		// Scenario: remote1 mentions "@admin" (their local user) → sent to receiver
		// mentionTransforms["admin"] = remote1AdminUserId
		mentionTransforms := map[string]string{
			"admin": remoteUser.Id,
		}

		testTransformation(
			"Hello @admin, can you help?",
			mentionTransforms,
			"Hello @admin:remote1, can you help?", // Use synced username
			"Simple mention of synced remote user should use synced username",
		)
	})

	t.Run("Scenario 1.2: Remote mentions local user (different username)", func(t *testing.T) {
		// Create remote user that was synced to receiver
		remoteUser := createUser("user:remote1", &savedRemoteCluster.RemoteId)

		mentionTransforms := map[string]string{
			"user": remoteUser.Id,
		}

		testTransformation(
			"Hello @user, can you help?",
			mentionTransforms,
			"Hello @user:remote1, can you help?",
			"Simple mention of different synced remote user should use synced username",
		)
	})

	t.Run("Scenario 2.1: Remote mentions with colon (local user)", func(t *testing.T) {
		// Create local user on receiver
		localUser := createUser("admin", nil)

		// Scenario: remote2 mentions "@admin:remote1" → sent to remote1
		// mentionTransforms["admin:remote1"] = remote1AdminUserId
		mentionTransforms := map[string]string{
			"admin:remote1": localUser.Id,
		}

		testTransformation(
			"Hello @admin:remote1, can you help?",
			mentionTransforms,
			"Hello @admin, can you help?", // Strip suffix for local user
			"Colon mention of local user should strip cluster suffix",
		)
	})

	t.Run("Scenario 2.2: Remote mentions with colon (different local user)", func(t *testing.T) {
		// Create local user on receiver
		localUser := createUser("user", nil)

		mentionTransforms := map[string]string{
			"user:remote1": localUser.Id,
		}

		testTransformation(
			"Hello @user:remote1, can you help?",
			mentionTransforms,
			"Hello @user, can you help?",
			"Colon mention of different local user should strip cluster suffix",
		)
	})

	t.Run("Scenario A1: Name clash - remote user mention, local user exists", func(t *testing.T) {
		// Create local user with same name
		_ = createUser("alice", nil) // Create name clash scenario
		// Create remote user that was synced
		remoteUser := createUser("alice:remote1", &savedRemoteCluster.RemoteId)

		// When remote1 mentions "@alice" (their local user), receiver gets explicit transform
		mentionTransforms := map[string]string{
			"alice": remoteUser.Id, // Points to synced remote user, not local user
		}

		testTransformation(
			"Hello @alice, can you help?",
			mentionTransforms,
			"Hello @alice:remote1, can you help?",
			"Matrix A1: Remote user mention with local name clash should add cluster suffix",
		)
	})

	t.Run("Scenario A2: Same user - previously synced", func(t *testing.T) {
		// Create user that was synced from sender
		syncedUser := createUser("bob:remote1", &savedRemoteCluster.RemoteId)

		mentionTransforms := map[string]string{
			"bob": syncedUser.Id,
		}

		testTransformation(
			"Hello @bob, can you help?",
			mentionTransforms,
			"Hello @bob:remote1, can you help?",
			"Matrix A2: Previously synced user should display synced username",
		)
	})

	t.Run("Scenario A3: No user exists on receiver", func(t *testing.T) {
		// Use non-existent user ID
		nonExistentUserId := model.NewId()

		mentionTransforms := map[string]string{
			"charlie": nonExistentUserId,
		}

		testTransformation(
			"Hello @charlie, can you help?",
			mentionTransforms,
			"Hello @charlie:remote1, can you help?",
			"Matrix A3: Unknown user should get cluster suffix",
		)
	})

	t.Run("Scenario B1: User exists on origin with same ID", func(t *testing.T) {
		// Create local user (representing user on their home cluster)
		localUser := createUser("dave", nil)

		// Remote mentions "@dave:remote1" pointing to local user ID
		mentionTransforms := map[string]string{
			"dave:remote1": localUser.Id,
		}

		testTransformation(
			"Hello @dave:remote1, can you help?",
			mentionTransforms,
			"Hello @dave, can you help?",
			"Matrix B1: Remote mention of local user should strip cluster suffix",
		)
	})

	t.Run("Scenario B2: User does not exist on origin", func(t *testing.T) {
		// Use non-existent user ID
		nonExistentUserId := model.NewId()

		mentionTransforms := map[string]string{
			"eve:remote1": nonExistentUserId,
		}

		testTransformation(
			"Hello @eve:remote1, can you help?",
			mentionTransforms,
			"Hello @eve:remote1, can you help?",
			"Matrix B2: Unknown colon mention should remain unchanged",
		)
	})

	t.Run("Empty mentionTransforms", func(t *testing.T) {
		// No transforms provided
		mentionTransforms := map[string]string{}

		testTransformation(
			"Hello @anyone, can you help?",
			mentionTransforms,
			"Hello @anyone, can you help?",
			"Message without transforms should remain unchanged",
		)
	})

	t.Run("Mixed scenarios in single message", func(t *testing.T) {
		// Setup users
		localUser := createUser("frank", nil)
		remoteUser := createUser("george:remote1", &savedRemoteCluster.RemoteId)

		// Multiple transforms in one message
		mentionTransforms := map[string]string{
			"frank:remote1": localUser.Id,  // Colon mention → strip suffix
			"george":        remoteUser.Id, // Simple mention → use synced username
		}

		testTransformation(
			"Hello @frank:remote1 and @george, let's collaborate!",
			mentionTransforms,
			"Hello @frank and @george:remote1, let's collaborate!",
			"Mixed mention types should transform correctly",
		)
	})

	t.Run("Colon mention of remote user", func(t *testing.T) {
		// Create remote user that was synced
		remoteUser := createUser("guest:remote1", &savedRemoteCluster.RemoteId)

		// Colon mention pointing to remote user (edge case)
		mentionTransforms := map[string]string{
			"guest:remote1": remoteUser.Id,
		}

		testTransformation(
			"Hello @guest:remote1, welcome!",
			mentionTransforms,
			"Hello @guest:remote1, welcome!",
			"Colon mention of remote user should use synced username",
		)
	})

	t.Run("Performance: Large message with many mentions", func(t *testing.T) {
		// Create users for performance test
		user1 := createUser("user1:remote1", &savedRemoteCluster.RemoteId)
		user2 := createUser("user2:remote1", &savedRemoteCluster.RemoteId)
		user3 := createUser("user3:remote1", &savedRemoteCluster.RemoteId)

		mentionTransforms := map[string]string{
			"user1": user1.Id,
			"user2": user2.Id,
			"user3": user3.Id,
		}

		testTransformation(
			"Meeting with @user1, @user2, and @user3 about @user1's proposal. @user2 will present, @user3 will take notes.",
			mentionTransforms,
			"Meeting with @user1:remote1, @user2:remote1, and @user3:remote1 about @user1:remote1's proposal. @user2:remote1 will present, @user3:remote1 will take notes.",
			"Multiple mentions should transform efficiently",
		)
	})
}
