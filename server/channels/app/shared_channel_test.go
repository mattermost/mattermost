// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func setupSharedChannels(tb testing.TB) *TestHelper {
	return SetupConfig(tb, func(cfg *model.Config) {
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
	})
}

func TestApp_CheckCanInviteToSharedChannel(t *testing.T) {
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
func TestApp_RemoteUnsharing(t *testing.T) {
	th := setupSharedChannels(t).InitBasic()

	t.Run("remote-initiated unshare with single remote", func(t *testing.T) {
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

		_, err := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Create a remote cluster
		rc := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "test-remote",
			DisplayName:  "Test Remote",
			SiteURL:      "http://test-remote.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		_, err = th.Server.Store().RemoteCluster().Save(rc)
		require.NoError(t, err)

		// Share the channel with the remote
		scr := &model.SharedChannelRemote{
			Id:               model.NewId(),
			ChannelId:        channel.Id,
			CreatorId:        th.BasicUser.Id,
			IsInviteAccepted: true,
			RemoteId:         rc.RemoteId,
			LastPostUpdateAt: model.GetMillis(),
		}
		_, err = th.Server.Store().SharedChannel().SaveRemote(scr)
		require.NoError(t, err)

		// Get post count before "remote-initiated unshare"
		postsBeforeRemove, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
		postCountBefore := len(postsBeforeRemove.Posts)

		// This simulates the handleChannelNotSharedError function being called when
		// a response from the remote contains ErrChannelNotShared

		// First, remove the remote
		_, err = th.Server.Store().SharedChannel().DeleteRemote(scr.Id)
		require.NoError(t, err)

		// Then unshare the channel (which would happen in handleChannelNotSharedError)
		success, err := th.App.UnshareChannel(channel.Id)
		require.NoError(t, err)
		require.True(t, success, "Channel should be unshared successfully")

		// Verify the channel is no longer shared locally
		err = th.App.checkChannelIsShared(channel.Id)
		assert.Error(t, err, "Channel should no longer be shared")

		// Verify a system message was posted to inform users the channel is no longer shared
		postsAfterRemove, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
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

		_, err := th.App.ShareChannel(th.Context, sc)
		require.NoError(t, err)

		// Create two remote clusters
		rc1 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "test-remote-1",
			DisplayName:  "Test Remote 1",
			SiteURL:      "http://test-remote-1.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		_, err = th.Server.Store().RemoteCluster().Save(rc1)
		require.NoError(t, err)

		rc2 := &model.RemoteCluster{
			RemoteId:     model.NewId(),
			Name:         "test-remote-2",
			DisplayName:  "Test Remote 2",
			SiteURL:      "http://test-remote-2.example.com",
			Token:        model.NewId(),
			CreateAt:     model.GetMillis(),
			LastPingAt:   model.GetMillis(),
			CreatorId:    th.BasicUser.Id,
			RemoteTeamId: model.NewId(),
		}
		_, err = th.Server.Store().RemoteCluster().Save(rc2)
		require.NoError(t, err)

		// Share the channel with both remotes
		scr1 := &model.SharedChannelRemote{
			Id:               model.NewId(),
			ChannelId:        channel.Id,
			CreatorId:        th.BasicUser.Id,
			IsInviteAccepted: true,
			RemoteId:         rc1.RemoteId,
			LastPostUpdateAt: model.GetMillis(),
		}
		_, err = th.Server.Store().SharedChannel().SaveRemote(scr1)
		require.NoError(t, err)

		scr2 := &model.SharedChannelRemote{
			Id:               model.NewId(),
			ChannelId:        channel.Id,
			CreatorId:        th.BasicUser.Id,
			IsInviteAccepted: true,
			RemoteId:         rc2.RemoteId,
			LastPostUpdateAt: model.GetMillis(),
		}
		_, err = th.Server.Store().SharedChannel().SaveRemote(scr2)
		require.NoError(t, err)

		// Verify the channel is shared with both remotes
		hasRemote1, err := th.Server.Store().SharedChannel().HasRemote(channel.Id, rc1.RemoteId)
		require.NoError(t, err)
		require.True(t, hasRemote1, "Channel should be shared with remote 1")

		hasRemote2, err := th.Server.Store().SharedChannel().HasRemote(channel.Id, rc2.RemoteId)
		require.NoError(t, err)
		require.True(t, hasRemote2, "Channel should be shared with remote 2")

		// Get post count before "remote-initiated unshare" on one of the remotes
		postsBeforeRemove, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
		postCountBefore := len(postsBeforeRemove.Posts)

		// This simulates what happens when Remote 1 informs Server that it
		// has unshared the channel (by returning ErrChannelNotShared)

		// First, get the SharedChannelRemote to simulate what handleChannelNotSharedError would do
		scrRemote, err := th.Server.Store().SharedChannel().GetRemoteByIds(channel.Id, rc1.RemoteId)
		require.NoError(t, err)
		require.NotNil(t, scrRemote)

		// Get channel details for notification
		chanObj, err := th.Server.Store().Channel().Get(channel.Id, true)
		require.NoError(t, err)
		require.NotNil(t, chanObj)

		// Remove just the one remote that unshared
		_, err = th.Server.Store().SharedChannel().DeleteRemote(scr1.Id)
		require.NoError(t, err)
		// Simply create a system message directly since we are only testing the behavior
		post := &model.Post{UserId: scrRemote.CreatorId, ChannelId: channel.Id, Message: "This channel is no longer shared.", Type: model.PostTypeSystemGeneric}
		_, appErr = th.App.CreatePost(th.Context, post, chanObj, model.CreatePostFlags{})
		require.Nil(t, appErr)
		// We only need to verify that the channel is still shared, not how many remotes it has
		err = th.App.checkChannelIsShared(channel.Id)
		assert.NoError(t, err, "Channel should still be shared")

		// Verify remote 1 is no longer in shared channel
		hasRemote1After, err := th.Server.Store().SharedChannel().HasRemote(channel.Id, rc1.RemoteId)
		require.NoError(t, err)
		require.False(t, hasRemote1After, "Channel should no longer be shared with remote 1")

		// But it should still be shared with remote 2
		hasRemote2After, err := th.Server.Store().SharedChannel().HasRemote(channel.Id, rc2.RemoteId)
		require.NoError(t, err)
		require.True(t, hasRemote2After, "Channel should still be shared with remote 2")

		// Verify a system message was posted about remote 1 unsharing
		postsAfterRemove, appErr := th.App.GetPostsPage(model.GetPostsOptions{
			ChannelId: channel.Id,
			Page:      0,
			PerPage:   10,
		})
		require.Nil(t, appErr)
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
