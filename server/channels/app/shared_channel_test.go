// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/sharedchannel"
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
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          rc.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
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

		// Create a sync message
		syncMsg := model.NewSyncMsg(channel.Id)

		// Get the shared channel sync service and convert to the concrete type
		scs := th.Server.GetSharedChannelSyncService()
		service, ok := scs.(*sharedchannel.Service)
		require.True(t, ok, "Expected sharedchannel.Service type")

		// Assume that we receive a ErrChannelNotShared error
		service.HandleChannelNotSharedErrorForTesting(syncMsg, rc)

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
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         th.BasicUser.Id,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          rc1.RemoteId,
			LastPostUpdateAt:  model.GetMillis(),
		}
		_, err = th.Server.Store().SharedChannel().SaveRemote(scr1)
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

		// Create a sync message
		syncMsg := model.NewSyncMsg(channel.Id)

		// Get the shared channel sync service and convert to the concrete type
		scs := th.Server.GetSharedChannelSyncService()
		service, ok := scs.(*sharedchannel.Service)
		require.True(t, ok, "Expected sharedchannel.Service type")

		// Assume that we receive a ErrChannelNotShared error
		service.HandleChannelNotSharedErrorForTesting(syncMsg, rc1)

		// Let's check how many remotes are still associated with the channel
		remotes, err := th.Server.Store().SharedChannel().GetRemotes(0, 10, model.SharedChannelRemoteFilterOpts{
			ChannelId: channel.Id,
		})
		require.NoError(t, err)
		t.Logf("Number of remotes after unshare: %d", len(remotes))

		// The expected behavior is that only the specific remote should be removed,
		// with the channel remaining shared with other remotes.
		err = th.App.checkChannelIsShared(channel.Id)

		// The channel should still be shared with remote2, so this should fail
		// Currently this passes, showing the unexpected behavior
		assert.NoError(t, err, "Channel should still be shared with other remotes")

		// Verify remote 1 is no longer in shared channel
		hasRemote1After, err := th.Server.Store().SharedChannel().HasRemote(channel.Id, rc1.RemoteId)
		require.NoError(t, err)
		require.False(t, hasRemote1After, "Channel should no longer be shared with remote 1")

		// Check if remote 2 is still associated with the channel
		// Expected behavior: remote 2 should still be associated
		hasRemote2After, err := th.Server.Store().SharedChannel().HasRemote(channel.Id, rc2.RemoteId)
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
