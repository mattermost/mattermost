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

// TestApp_RemoteUnsharing tests the functionality where a shared channel is unshared on both sides.
func TestApp_RemoteUnsharing(t *testing.T) {
	th := setupSharedChannels(t).InitBasic()

	// This test simulates what happens when a remote site indicates a channel is no longer shared
	t.Run("remote-initiated unshare flow", func(t *testing.T) {
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
}
