// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"text/template"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
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

// firstSharedChannelStatePostInOrderedPage walks pl.Order (same ordering as GetPostsPage:
// root posts by CreateAt DESC) instead of ranging over pl.Posts, which is nondeterministic.
func firstSharedChannelStatePostInOrderedPage(pl *model.PostList) *model.Post {
	if pl == nil {
		return nil
	}
	for _, id := range pl.Order {
		p := pl.Posts[id]
		if p != nil && p.Type == model.PostTypeSharedChannelState {
			return p
		}
	}
	return nil
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
		systemPost := firstSharedChannelStatePostInOrderedPage(postsAfterRemove)
		require.NotNil(t, systemPost, "A system post should be created")
		assert.Equal(t, i18n.T("shared_channel.system_message.no_longer_shared", map[string]any{"WorkspaceName": "Test Remote"}), systemPost.Message)
		assert.Equal(t, model.SharedChannelStatePostValueUnshared, systemPost.GetProps()[model.PostPropsSharedChannelState])
		assert.Equal(t, "Test Remote", systemPost.GetProps()[model.PostPropsSharedChannelWorkspaceName])
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
		_, _, appErr := th.App.CreatePost(th.Context, post, channel, model.CreatePostFlags{})
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
		systemPost := firstSharedChannelStatePostInOrderedPage(postsAfterRemove)
		require.NotNil(t, systemPost, "A system post should be created")
		assert.Equal(t, i18n.T("shared_channel.system_message.no_longer_shared", map[string]any{"WorkspaceName": "Test Remote 1"}), systemPost.Message)
		assert.Equal(t, model.SharedChannelStatePostValueUnshared, systemPost.GetProps()[model.PostPropsSharedChannelState])
		assert.Equal(t, "Test Remote 1", systemPost.GetProps()[model.PostPropsSharedChannelWorkspaceName])
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
	mockCallback := func(_ /*rcMsg*/ model.RemoteClusterMsg, rc *model.RemoteCluster, rcResp *remotecluster.Response, _ /*errResp*/ error) {
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
	systemPost := firstSharedChannelStatePostInOrderedPage(posts)
	require.NotNil(t, systemPost, "System message should be posted when channel becomes unshared")
	assert.Equal(t, i18n.T("shared_channel.system_message.no_longer_shared", map[string]any{"WorkspaceName": "Test Remote"}), systemPost.Message)
	assert.Equal(t, model.SharedChannelStatePostValueUnshared, systemPost.GetProps()[model.PostPropsSharedChannelState])
	assert.Equal(t, "Test Remote", systemPost.GetProps()[model.PostPropsSharedChannelWorkspaceName])
}

// TestUninviteRemoteFromChannel_OnlyRemovesRequestedRemote verifies that when a channel has multiple
// remotes (including unconfirmed), uninviting one remote only removes that remote and does not
// trigger unshare. This guards the IncludeUnconfirmed fix in unshareChannelIfNoActiveRemotes.
func TestUninviteRemoteFromChannel_OnlyRemovesRequestedRemote(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSharedChannels(t).InitBasic(t)
	ss := th.App.Srv().Store()

	t.Run("uninvite one of two remotes (one confirmed, one unconfirmed) leaves channel shared and other remote present", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			TeamId:           channel.TeamId,
			Home:             true,
			ShareName:        channel.Name,
			ShareDisplayName: channel.DisplayName,
			CreatorId:        th.BasicUser.Id,
			RemoteId:         "",
		}
		_, err := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		rc1 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "remote-1",
			DisplayName:  "Remote 1",
			SiteURL:      "https://r1.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		rc1, err = ss.RemoteCluster().Save(rc1)
		require.NoError(t, err)

		rc2 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "remote-2",
			DisplayName:  "Remote 2",
			SiteURL:      "https://r2.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		rc2, err = ss.RemoteCluster().Save(rc2)
		require.NoError(t, err)

		// Remote 1: confirmed
		scr1 := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          rc1.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
		}
		_, err = ss.SharedChannel().SaveRemote(scr1)
		require.NoError(t, err)

		// Remote 2: unconfirmed (would be ignored by GetRemotes when IncludeUnconfirmed is false)
		scr2 := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  false,
			IsInviteConfirmed: false,
			RemoteId:          rc2.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
		}
		_, err = ss.SharedChannel().SaveRemote(scr2)
		require.NoError(t, err)

		// Uninvite the confirmed remote (remote 1)
		err = th.App.UninviteRemoteFromChannel(channel.Id, rc1.RemoteId)
		require.NoError(t, err)

		// Channel must still be shared (unshareChannelIfNoActiveRemotes must not have run)
		err = th.App.checkChannelIsShared(channel.Id)
		require.NoError(t, err, "Channel should still be shared when an unconfirmed remote remains")

		// Remote 1 must be gone (soft-deleted)
		has1, err := ss.SharedChannel().HasRemote(channel.Id, rc1.RemoteId)
		require.NoError(t, err)
		require.False(t, has1, "Uninvited remote should no longer be present")

		// Remote 2 (unconfirmed) must still be present
		has2, err := ss.SharedChannel().HasRemote(channel.Id, rc2.RemoteId)
		require.NoError(t, err)
		require.True(t, has2, "Other remote (unconfirmed) should still be present")

		// Uninvite posts a shared-channel state system message with the uninvited remote's display name
		postsPage, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   20,
		})
		require.Nil(t, appErr)
		uninvitePost := firstSharedChannelStatePostInOrderedPage(postsPage)
		require.NotNil(t, uninvitePost, "expected a system_shared_chan_state post after uninvite")
		assert.Equal(t, channel.Id, uninvitePost.ChannelId)
		assert.Equal(t, model.SharedChannelStatePostValueUnshared, uninvitePost.GetProps()[model.PostPropsSharedChannelState])
		assert.Equal(t, rc1.DisplayName, uninvitePost.GetProps()[model.PostPropsSharedChannelWorkspaceName])
		assert.Equal(t, i18n.T("shared_channel.system_message.no_longer_shared", map[string]any{"WorkspaceName": rc1.DisplayName}), uninvitePost.Message)
	})

	t.Run("uninvite one of two confirmed remotes leaves channel shared and other remote present", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			TeamId:           channel.TeamId,
			Home:             true,
			ShareName:        channel.Name,
			ShareDisplayName: channel.DisplayName,
			CreatorId:        th.BasicUser.Id,
			RemoteId:         "",
		}
		_, err := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		rc1 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "remote-a",
			DisplayName:  "Remote A",
			SiteURL:      "https://ra.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		rc1, err = ss.RemoteCluster().Save(rc1)
		require.NoError(t, err)

		rc2 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "remote-b",
			DisplayName:  "Remote B",
			SiteURL:      "https://rb.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		rc2, err = ss.RemoteCluster().Save(rc2)
		require.NoError(t, err)

		scr1 := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          rc1.RemoteId,
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
			RemoteId:          rc2.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
		}
		_, err = ss.SharedChannel().SaveRemote(scr2)
		require.NoError(t, err)

		err = th.App.UninviteRemoteFromChannel(channel.Id, rc1.RemoteId)
		require.NoError(t, err)

		err = th.App.checkChannelIsShared(channel.Id)
		require.NoError(t, err, "Channel should still be shared with the other remote")

		has1, err := ss.SharedChannel().HasRemote(channel.Id, rc1.RemoteId)
		require.NoError(t, err)
		require.False(t, has1, "Uninvited remote should no longer be present")

		has2, err := ss.SharedChannel().HasRemote(channel.Id, rc2.RemoteId)
		require.NoError(t, err)
		require.True(t, has2, "Other remote should still be present")
	})

	t.Run("uninvite the only non-deleted remote (other is already deleted) unshares the channel", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			TeamId:           channel.TeamId,
			Home:             true,
			ShareName:        channel.Name,
			ShareDisplayName: channel.DisplayName,
			CreatorId:        th.BasicUser.Id,
			RemoteId:         "",
		}
		_, err := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		rc1 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "remote-deleted",
			DisplayName:  "Remote Deleted",
			SiteURL:      "https://rd.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		rc1, err = ss.RemoteCluster().Save(rc1)
		require.NoError(t, err)

		rc2 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "remote-active",
			DisplayName:  "Remote Active",
			SiteURL:      "https://ra.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		rc2, err = ss.RemoteCluster().Save(rc2)
		require.NoError(t, err)

		scr1 := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          rc1.RemoteId,
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
			RemoteId:          rc2.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
		}
		_, err = ss.SharedChannel().SaveRemote(scr2)
		require.NoError(t, err)

		// Soft-delete the first remote so only one active remote remains
		_, err = ss.SharedChannel().DeleteRemote(scr1.Id)
		require.NoError(t, err)

		// Channel is still shared (one active remote)
		err = th.App.checkChannelIsShared(channel.Id)
		require.NoError(t, err, "Channel should still be shared with the active remote")

		// Uninvite the only remaining active remote
		err = th.App.UninviteRemoteFromChannel(channel.Id, rc2.RemoteId)
		require.NoError(t, err)

		// Channel must now be unshared (no remaining non-deleted remotes)
		err = th.App.checkChannelIsShared(channel.Id)
		require.Error(t, err, "Channel should be unshared after removing the last active remote")
		require.True(t, errors.Is(err, model.ErrChannelNotShared), "Error should be ErrChannelNotShared")
	})
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
		if remoteId != nil {
			user = th.SetUserRemoteID(t, user.Id, *remoteId)
		}
		user.Username = username
		var appErr *model.AppError
		user, appErr = th.App.UpdateUser(th.Context, user, false)
		require.Nil(t, appErr)
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

// registerPluginRemoteForTest registers a plugin as a shared channel remote and returns
// the remote cluster. It also shares the given channel and invites the remote to it.
func registerPluginRemoteForTest(t *testing.T, th *TestHelper, pluginID string, channel *model.Channel) *model.RemoteCluster {
	t.Helper()

	remoteID, err := th.App.RegisterPluginForSharedChannels(th.Context, model.RegisterPluginOpts{
		Displayname: "test-plugin-remote",
		PluginID:    pluginID,
		CreatorID:   th.BasicUser.Id,
		SiteURL:     "plugin://" + pluginID,
	})
	require.NoError(t, err)

	sc := &model.SharedChannel{
		ChannelId:        channel.Id,
		TeamId:           channel.TeamId,
		Home:             true,
		ShareName:        channel.Name,
		ShareDisplayName: channel.DisplayName,
		CreatorId:        th.BasicUser.Id,
	}
	_, err = th.App.ShareChannel(th.Context, sc)
	require.NoError(t, err)

	err = th.App.InviteRemoteToChannel(channel.Id, remoteID, th.BasicUser.Id, false)
	require.NoError(t, err)

	rc, err := th.App.Srv().Store().RemoteCluster().Get(remoteID, false)
	require.NoError(t, err)
	return rc
}

func TestPluginAPIReceiveSharedChannelSyncMsg(t *testing.T) {
	th := setupSharedChannels(t).InitBasic(t)

	channel := th.CreateChannel(t, th.BasicTeam)
	pluginID := "com.test.sync-plugin"
	rc := registerPluginRemoteForTest(t, th, pluginID, channel)

	api := NewPluginAPI(th.App, th.Context, &model.Manifest{Id: pluginID})

	t.Run("nil msg returns error", func(t *testing.T) {
		_, err := api.ReceiveSharedChannelSyncMsg(rc.RemoteId, nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "must not be nil")
	})

	t.Run("unknown remoteID returns error", func(t *testing.T) {
		msg := model.NewSyncMsg(channel.Id)
		_, err := api.ReceiveSharedChannelSyncMsg(model.NewId(), msg)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("remoteID belonging to different plugin returns error", func(t *testing.T) {
		otherPluginID := "com.other.plugin"
		otherChannel := th.CreateChannel(t, th.BasicTeam)
		otherRC := registerPluginRemoteForTest(t, th, otherPluginID, otherChannel)
		msg := model.NewSyncMsg(channel.Id)
		_, err := api.ReceiveSharedChannelSyncMsg(otherRC.RemoteId, msg)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "does not belong to plugin")
	})

	t.Run("channel not shared with remote returns error", func(t *testing.T) {
		otherChannel := th.CreateChannel(t, th.BasicTeam)
		msg := model.NewSyncMsg(otherChannel.Id)
		_, err := api.ReceiveSharedChannelSyncMsg(rc.RemoteId, msg)
		require.Error(t, err)
	})

	t.Run("syncs a user and verifies it exists in the database", func(t *testing.T) {
		userID := model.NewId()
		username := "synced-user-" + model.NewId()[:8]
		email := model.NewId() + "@remote.test"

		msg := model.NewSyncMsg(channel.Id)
		msg.Users = map[string]*model.User{
			userID: {
				Id:       userID,
				Username: username,
				Email:    email,
				RemoteId: model.NewPointer(rc.RemoteId),
			},
		}

		resp, err := api.ReceiveSharedChannelSyncMsg(rc.RemoteId, msg)
		require.NoError(t, err)
		assert.Contains(t, resp.UsersSyncd, userID)
		assert.Empty(t, resp.UserErrors)

		// Verify the user was actually created in the database
		user, appErr := th.App.GetUser(userID)
		require.Nil(t, appErr)
		assert.Contains(t, user.Username, username) // username gets ":remotename" appended by sync
		assert.Equal(t, rc.RemoteId, user.GetRemoteID())
	})

	t.Run("syncs a post and verifies it exists in the database", func(t *testing.T) {
		// First sync a user who will author the post
		userID := model.NewId()
		msg := model.NewSyncMsg(channel.Id)
		msg.Users = map[string]*model.User{
			userID: {
				Id:       userID,
				Username: "post-author-" + model.NewId()[:8],
				Email:    model.NewId() + "@remote.test",
				RemoteId: model.NewPointer(rc.RemoteId),
			},
		}
		_, err := api.ReceiveSharedChannelSyncMsg(rc.RemoteId, msg)
		require.NoError(t, err)

		// Now sync a post from that user
		postID := model.NewId()
		postMsg := model.NewSyncMsg(channel.Id)
		postMsg.Posts = []*model.Post{
			{
				Id:        postID,
				ChannelId: channel.Id,
				UserId:    userID,
				Message:   "hello from the plugin remote",
				CreateAt:  model.GetMillis(),
				RemoteId:  model.NewPointer(rc.RemoteId),
			},
		}

		resp, err := api.ReceiveSharedChannelSyncMsg(rc.RemoteId, postMsg)
		require.NoError(t, err)
		assert.Empty(t, resp.PostErrors)

		// Verify the post exists in the database
		post, appErr := th.App.GetSinglePost(th.Context, postID, false)
		require.Nil(t, appErr)
		assert.Equal(t, "hello from the plugin remote", post.Message)
		assert.Equal(t, channel.Id, post.ChannelId)
		assert.Equal(t, userID, post.UserId)
	})
}

func TestPluginAPIReceiveSharedChannelAttachmentSyncMsg(t *testing.T) {
	th := setupSharedChannels(t).InitBasic(t)

	channel := th.CreateChannel(t, th.BasicTeam)
	pluginID := "com.test.attachment-plugin"
	rc := registerPluginRemoteForTest(t, th, pluginID, channel)

	api := NewPluginAPI(th.App, th.Context, &model.Manifest{Id: pluginID})

	t.Run("unknown remoteID returns error", func(t *testing.T) {
		fi := &model.FileInfo{Name: "test.txt", Size: 4, CreatorId: th.BasicUser.Id}
		_, err := api.ReceiveSharedChannelAttachmentSyncMsg(model.NewId(), channel.Id, fi, bytes.NewReader([]byte("data")))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("remoteID belonging to different plugin returns error", func(t *testing.T) {
		otherPluginID := "com.other.attachment-plugin"
		otherChannel := th.CreateChannel(t, th.BasicTeam)
		otherRC := registerPluginRemoteForTest(t, th, otherPluginID, otherChannel)
		fi := &model.FileInfo{Name: "test.txt", Size: 4, CreatorId: th.BasicUser.Id}
		_, err := api.ReceiveSharedChannelAttachmentSyncMsg(otherRC.RemoteId, channel.Id, fi, bytes.NewReader([]byte("data")))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "does not belong to plugin")
	})

	t.Run("channel not shared with remote returns error", func(t *testing.T) {
		otherChannel := th.CreateChannel(t, th.BasicTeam)
		fi := &model.FileInfo{Name: "test.txt", Size: 4, CreatorId: th.BasicUser.Id}
		_, err := api.ReceiveSharedChannelAttachmentSyncMsg(rc.RemoteId, otherChannel.Id, fi, bytes.NewReader([]byte("data")))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not shared")
	})

	t.Run("nil FileInfo returns error", func(t *testing.T) {
		_, err := api.ReceiveSharedChannelAttachmentSyncMsg(rc.RemoteId, channel.Id, nil, bytes.NewReader([]byte("data")))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "FileInfo is required")
	})

	t.Run("nil data returns error", func(t *testing.T) {
		fi := &model.FileInfo{Name: "test.txt", Size: 4, CreatorId: th.BasicUser.Id}
		_, err := api.ReceiveSharedChannelAttachmentSyncMsg(rc.RemoteId, channel.Id, fi, nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "File data is required")
	})

	t.Run("empty CreatorId returns error", func(t *testing.T) {
		fi := &model.FileInfo{Name: "test.txt", Size: 4}
		_, err := api.ReceiveSharedChannelAttachmentSyncMsg(rc.RemoteId, channel.Id, fi, bytes.NewReader([]byte("data")))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "CreatorId is required")
	})

	t.Run("empty Name returns error", func(t *testing.T) {
		fi := &model.FileInfo{Size: 4, CreatorId: th.BasicUser.Id}
		_, err := api.ReceiveSharedChannelAttachmentSyncMsg(rc.RemoteId, channel.Id, fi, bytes.NewReader([]byte("data")))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Name is required")
	})

	t.Run("local user as creator returns error", func(t *testing.T) {
		fi := &model.FileInfo{Name: "test.txt", Size: 4, CreatorId: th.BasicUser.Id}
		_, err := api.ReceiveSharedChannelAttachmentSyncMsg(rc.RemoteId, channel.Id, fi, bytes.NewReader([]byte("data")))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "does not belong to remote")
	})

	t.Run("syncs an attachment and verifies FileInfo and SharedChannelAttachment in database", func(t *testing.T) {
		// Create a remote user belonging to this plugin's remote
		remoteUser := &model.User{
			Email:    model.NewId() + "@remote.test",
			Username: "remote-attach-" + model.NewId()[:8],
			Password: model.NewTestPassword(),
			RemoteId: model.NewPointer(rc.RemoteId),
		}
		remoteUser, appErr := th.App.CreateUser(th.Context, remoteUser)
		require.Nil(t, appErr)

		// The sender-side file ID must be preserved on the receiving server so the
		// post's FileIds (which reference the sender ID) resolve to the saved file.
		senderFileID := model.NewId()
		fi := &model.FileInfo{
			Id:        senderFileID,
			CreatorId: remoteUser.Id,
			Name:      "hello.txt",
			Size:      13,
		}

		saved, err := api.ReceiveSharedChannelAttachmentSyncMsg(rc.RemoteId, channel.Id, fi, bytes.NewReader([]byte("hello, world!")))
		require.NoError(t, err)
		require.NotNil(t, saved)
		assert.Equal(t, senderFileID, saved.Id, "saved FileInfo must keep the sender's file ID")
		assert.Equal(t, rc.RemoteId, *saved.RemoteId)

		// Verify the FileInfo was persisted with a server-constructed path
		storedFI, appErr := th.App.GetFileInfo(th.Context, saved.Id)
		require.Nil(t, appErr)
		assert.Equal(t, senderFileID, storedFI.Id)
		assert.Equal(t, "hello.txt", storedFI.Name)
		assert.NotEmpty(t, storedFI.Path)
		assert.Contains(t, storedFI.Path, "hello.txt")
		assert.Equal(t, rc.RemoteId, *storedFI.RemoteId)

		// Verify SharedChannelAttachment record was created for cursor tracking
		sca, scaErr := th.App.Srv().Store().SharedChannel().GetAttachment(saved.Id, rc.RemoteId)
		require.NoError(t, scaErr)
		assert.Equal(t, saved.Id, sca.FileId)
		assert.Equal(t, rc.RemoteId, sca.RemoteId)
	})
}

func TestPluginAPIReceiveSharedChannelProfileImageSyncMsg(t *testing.T) {
	th := setupSharedChannels(t).InitBasic(t)

	channel := th.CreateChannel(t, th.BasicTeam)
	pluginID := "com.test.profile-image-plugin"
	rc := registerPluginRemoteForTest(t, th, pluginID, channel)

	api := NewPluginAPI(th.App, th.Context, &model.Manifest{Id: pluginID})

	t.Run("unknown remoteID returns error", func(t *testing.T) {
		err := api.ReceiveSharedChannelProfileImageSyncMsg(model.NewId(), th.BasicUser.Id, []byte("img"))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("remoteID belonging to different plugin returns error", func(t *testing.T) {
		otherPluginID := "com.other.profile-plugin"
		otherChannel := th.CreateChannel(t, th.BasicTeam)
		otherRC := registerPluginRemoteForTest(t, th, otherPluginID, otherChannel)
		err := api.ReceiveSharedChannelProfileImageSyncMsg(otherRC.RemoteId, th.BasicUser.Id, []byte("img"))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "does not belong to plugin")
	})

	t.Run("nonexistent user returns error", func(t *testing.T) {
		err := api.ReceiveSharedChannelProfileImageSyncMsg(rc.RemoteId, model.NewId(), []byte("img"))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("local user (wrong RemoteId) returns error", func(t *testing.T) {
		err := api.ReceiveSharedChannelProfileImageSyncMsg(rc.RemoteId, th.BasicUser.Id, []byte("img"))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "does not belong to remote")
	})

	t.Run("syncs profile image and verifies it was saved", func(t *testing.T) {
		// Create a remote user belonging to this plugin's remote
		remoteUser := &model.User{
			Email:    model.NewId() + "@remote.test",
			Username: "remote-img-" + model.NewId()[:8],
			Password: model.NewTestPassword(),
			RemoteId: model.NewPointer(rc.RemoteId),
		}
		remoteUser, appErr := th.App.CreateUser(th.Context, remoteUser)
		require.Nil(t, appErr)

		lastPictureBefore := remoteUser.LastPictureUpdate

		// Capture profile image before sync (default/empty for new user)
		preImgBytes, _, appErr := th.App.GetProfileImage(remoteUser)
		require.Nil(t, appErr)

		pngData, err := os.ReadFile("tests/test.png")
		require.NoError(t, err, "Failed to load tests/test.png")

		err = api.ReceiveSharedChannelProfileImageSyncMsg(rc.RemoteId, remoteUser.Id, pngData)
		require.NoError(t, err)

		// Verify the user's LastPictureUpdate was bumped
		updatedUser, appErr := th.App.GetUser(remoteUser.Id)
		require.Nil(t, appErr)
		assert.Greater(t, updatedUser.LastPictureUpdate, lastPictureBefore)

		// Verify the image bytes changed and are non-empty
		postImgBytes, _, appErr := th.App.GetProfileImage(updatedUser)
		require.Nil(t, appErr)
		assert.NotEmpty(t, postImgBytes)
		assert.NotEqual(t, preImgBytes, postImgBytes, "profile image should differ after sync")
	})
}

// activatePluginFromTemplate compiles a Go plugin from a .go.tmpl template file located
// in the tests/ directory, executes the template with the provided data, activates it in
// a real plugin environment with full RPC, and returns the environment. The plugin's
// OnActivate hook runs through the real apiRPCClient → gob → apiRPCServer → PluginAPI
// path. If OnActivate returns an error, the test fails.
func activatePluginFromTemplate(t *testing.T, th *TestHelper, pluginID, templateFile string, data any) *plugin.Environment {
	t.Helper()

	testsDir, found := fileutils.FindDir("tests")
	require.True(t, found, "tests directory not found")

	tmplPath := filepath.Join(testsDir, templateFile)
	tmplBytes, err := os.ReadFile(tmplPath)
	require.NoError(t, err, "failed to read plugin template %s", tmplPath)

	tmpl, err := template.New(filepath.Base(templateFile)).Parse(string(tmplBytes))
	require.NoError(t, err, "failed to parse plugin template")

	var buf strings.Builder
	err = tmpl.Execute(&buf, data)
	require.NoError(t, err, "failed to execute plugin template")

	pluginDir := t.TempDir()
	webappPluginDir := t.TempDir()

	newPluginAPI := func(manifest *model.Manifest) plugin.API {
		return th.App.NewPluginAPI(th.Context, manifest)
	}
	env, err := plugin.NewEnvironment(newPluginAPI, NewDriverImpl(th.App.Srv()), pluginDir, webappPluginDir, th.App.Log(), nil)
	require.NoError(t, err)

	th.App.ch.SetPluginsEnvironment(env)

	backend := filepath.Join(pluginDir, pluginID, "backend.exe")
	utils.CompileGo(t, buf.String(), backend)

	manifestJSON := `{"id": "` + pluginID + `", "server": {"executable": "backend.exe"}}`
	err = os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(manifestJSON), 0600)
	require.NoError(t, err)

	manifest, activated, reterr := env.Activate(pluginID)
	require.NoError(t, reterr, "plugin OnActivate failed")
	require.NotNil(t, manifest)
	require.True(t, activated)

	t.Cleanup(func() {
		env.Shutdown()
	})

	return env
}

func TestPluginRPCSharedChannelSync(t *testing.T) {
	th := setupSharedChannels(t).InitBasic(t)

	// Pre-setup: create and share a channel, register the plugin as a remote, invite it
	channel := th.CreateChannel(t, th.BasicTeam)
	pluginID := "testplugin"
	rc := registerPluginRemoteForTest(t, th, pluginID, channel)

	// IDs the plugin will use to create content
	syncUserID := model.NewId()
	syncPostID := model.NewId()

	// Compile and activate plugin from template — OnActivate runs through full RPC
	activatePluginFromTemplate(t, th, pluginID, "shared_channel_sync_plugin_test.go.tmpl", struct {
		ChannelID  string
		RemoteID   string
		SyncUserID string
		SyncPostID string
	}{
		ChannelID:  channel.Id,
		RemoteID:   rc.RemoteId,
		SyncUserID: syncUserID,
		SyncPostID: syncPostID,
	})

	// --- Post-activation verification: check everything landed in the DB ---

	// Verify synced user
	user, appErr := th.App.GetUser(syncUserID)
	require.Nil(t, appErr, "synced user should exist in DB")
	assert.Contains(t, user.Username, "rpc-synced-user")
	assert.Equal(t, rc.RemoteId, user.GetRemoteID())

	// Verify synced post
	post, appErr := th.App.GetSinglePost(th.Context, syncPostID, false)
	require.Nil(t, appErr, "synced post should exist in DB")
	assert.Equal(t, "hello from plugin over RPC", post.Message)
	assert.Equal(t, channel.Id, post.ChannelId)
	assert.Equal(t, syncUserID, post.UserId)

	// The attachment was verified inside the plugin's OnActivate (it would have returned
	// an error if ReceiveSharedChannelAttachmentSyncMsg failed). The file ID is assigned
	// server-side by the upload session, so we can't look it up by a pre-known ID here.
	// The direct PluginAPI test (TestPluginAPIReceiveSharedChannelAttachmentSyncMsg) does
	// the detailed DB verification for attachment persistence.

	// Verify profile image was saved for the synced user
	updatedUser, err := th.App.Srv().Store().User().Get(th.Context.Context(), syncUserID)
	require.NoError(t, err)
	assert.Greater(t, updatedUser.LastPictureUpdate, int64(0), "LastPictureUpdate should be set after profile image sync")

	imgBytes, _, appErr := th.App.GetProfileImage(updatedUser)
	require.Nil(t, appErr)
	assert.NotEmpty(t, imgBytes, "profile image bytes should be readable")
}
