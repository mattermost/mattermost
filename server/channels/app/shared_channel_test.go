// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
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

func TestApp_UnshareChannelMessage(t *testing.T) {
	th := setupSharedChannels(t).InitBasic()

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

	// Verify channel is shared
	err = th.App.checkChannelIsShared(channel.Id)
	assert.NoError(t, err, "channel should be shared")

	// Get post count before unshare
	postsBeforeUnshare, appErr := th.App.GetPostsPage(model.GetPostsOptions{
		ChannelId: channel.Id,
		Page:      0,
		PerPage:   10,
	})
	require.Nil(t, appErr)
	postCountBefore := len(postsBeforeUnshare.Posts)

	// Unshare the channel
	success, err := th.App.UnshareChannel(channel.Id)
	assert.True(t, success, "unshare should be successful")
	assert.NoError(t, err, "unshare should not error")

	// Verify channel is no longer shared
	err = th.App.checkChannelIsShared(channel.Id)
	assert.Error(t, err, "unshared channel should error when checking if shared")

	// Verify a system message was posted
	postsAfterUnshare, appErr := th.App.GetPostsPage(model.GetPostsOptions{
		ChannelId: channel.Id,
		Page:      0,
		PerPage:   10,
	})
	require.Nil(t, appErr)

	// Should be exactly one more post
	assert.Equal(t, postCountBefore+1, len(postsAfterUnshare.Posts), "there should be one new post")

	// Find the system post and verify its content
	var systemPost *model.Post
	for _, post := range postsAfterUnshare.Posts {
		if post.Type == model.PostTypeSystemGeneric {
			systemPost = post
			break
		}
	}

	assert.NotNil(t, systemPost, "system post should be created")
	assert.Equal(t, "This channel is no longer shared.", systemPost.Message, "message should match unshare message")
	assert.Equal(t, channel.Id, systemPost.ChannelId, "post should be in the correct channel")
	assert.Equal(t, th.BasicUser.Id, systemPost.UserId, "post should be from the creator")
}

func TestApp_UnshareDirectChannel(t *testing.T) {
	th := setupSharedChannels(t).InitBasic()

	// Save the original feature flag value
	originalFlag := th.App.Config().FeatureFlags.EnableSharedChannelsDMs
	
	// Disable the feature flag
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.EnableSharedChannelsDMs = false
	})
	
	defer func() {
		// Restore original feature flag value after the test
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.EnableSharedChannelsDMs = originalFlag
		})
	}()
	
	// Create a direct channel
	directChannel, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
	require.Nil(t, appErr)
	
	// Attempt to unshare the direct channel (which should fail)
	_, err := th.App.UnshareChannel(directChannel.Id)
	assert.Error(t, err, "should error when trying to unshare a direct channel with feature flag disabled")
	assert.Contains(t, err.Error(), "cannot unshare a direct or group channel")
	
	// Test the enabled feature flag case
	t.Run("with feature flag enabled", func(t *testing.T) {
		// Enable the feature flag
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.EnableSharedChannelsDMs = true
		})
		
		// Create a regular channel (not DM/GM) for testing
		channel := th.CreateChannel(th.Context, th.BasicTeam)
		
		// Add a valid shared channel record to make unshare operation succeed
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
		
		// Now unshare should succeed
		success, err := th.App.UnshareChannel(channel.Id)
		assert.NoError(t, err, "should not error when feature flag is enabled")
		assert.True(t, success, "should successfully unshare the channel")
	})
}

func TestApp_RemoteChannelUnshareMessage(t *testing.T) {
	th := setupSharedChannels(t).InitBasic()

	// Create a shared channel, but set it as remote (not home)
	channel := th.CreateChannel(th.Context, th.BasicTeam)
	remoteId := model.NewId()

	sc := &model.SharedChannel{
		ChannelId:        channel.Id,
		TeamId:           channel.TeamId,
		Home:             false, // This is a remote channel, not home
		ReadOnly:         false,
		ShareName:        channel.Name,
		ShareDisplayName: channel.DisplayName,
		SharePurpose:     channel.Purpose,
		ShareHeader:      channel.Header,
		CreatorId:        th.BasicUser.Id,
		RemoteId:         remoteId, // Set a remote ID
	}

	_, err := th.App.ShareChannel(th.Context, sc)
	require.NoError(t, err)

	// Verify channel is shared
	err = th.App.checkChannelIsShared(channel.Id)
	assert.NoError(t, err, "channel should be shared")

	// Create a remote cluster for testing
	rc := &model.RemoteCluster{
		RemoteId:  remoteId,
		Name:      "test_remote",
		SiteURL:   "http://example.com",
		CreatorId: th.BasicUser.Id,
	}

	_, err = th.App.Srv().Store().RemoteCluster().Save(rc)
	require.NoError(t, err)

	// Get post count before unshare
	postsBeforeUnshare, appErr := th.App.GetPostsPage(model.GetPostsOptions{
		ChannelId: channel.Id,
		Page:      0,
		PerPage:   10,
	})
	require.Nil(t, appErr)
	postCountBefore := len(postsBeforeUnshare.Posts)

	// Simulate an unshare message from remote by directly calling the handler
	sharedSvc := th.App.Srv().GetSharedChannelSyncService()
	require.NotNil(t, sharedSvc, "Shared channel service should be available")

	// Create unshare message payload
	unshareMsg := struct {
		ChannelId string `json:"channel_id"`
		RemoteId  string `json:"remote_id"`
	}{
		ChannelId: channel.Id,
		RemoteId:  remoteId,
	}

	jsonData, err := json.Marshal(unshareMsg)
	require.NoError(t, err)

	// Create remote cluster message
	remoteMsg := model.RemoteClusterMsg{
		Topic:   "sharedchannel_unshare",
		Payload: jsonData,
	}

	// Process the message
	err = sharedSvc.OnReceiveChannelUnshare(remoteMsg, rc, nil)
	assert.NoError(t, err, "unshare message processing should not error")

	// Verify channel is no longer shared
	err = th.App.checkChannelIsShared(channel.Id)
	assert.Error(t, err, "channel should no longer be shared")

	// Verify a system message was posted
	postsAfterUnshare, appErr := th.App.GetPostsPage(model.GetPostsOptions{
		ChannelId: channel.Id,
		Page:      0,
		PerPage:   10,
	})
	require.Nil(t, appErr)

	// Should be exactly one more post
	assert.Equal(t, postCountBefore+1, len(postsAfterUnshare.Posts), "there should be one new post")

	// Find the system post and verify its content
	var systemPost *model.Post
	for _, post := range postsAfterUnshare.Posts {
		if post.Type == model.PostTypeSystemGeneric {
			systemPost = post
			break
		}
	}

	assert.NotNil(t, systemPost, "system post should be created")
	assert.Equal(t, "This channel is no longer shared.", systemPost.Message, "message should match unshare message")
	assert.Equal(t, channel.Id, systemPost.ChannelId, "post should be in the correct channel")
}
