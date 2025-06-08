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

func TestGetSharedChannelsWithRemotes(t *testing.T) {
	th := setupSharedChannels(t).InitBasic()
	defer th.TearDown()

	// Create remote clusters
	remote1 := &model.RemoteCluster{
		Name:        "remote1",
		DisplayName: "Remote Cluster 1",
		SiteURL:     "http://example.com",
		CreatorId:   th.BasicUser.Id,
		Token:       model.NewId(),
		LastPingAt:  model.GetMillis(),
	}
	remote1, appErr := th.App.AddRemoteCluster(remote1)
	require.Nil(t, appErr)

	remote2 := &model.RemoteCluster{
		Name:        "remote2",
		DisplayName: "Remote Cluster 2",
		SiteURL:     "http://example.org",
		CreatorId:   th.BasicUser.Id,
		Token:       model.NewId(),
		LastPingAt:  model.GetMillis(),
	}
	remote2, appErr = th.App.AddRemoteCluster(remote2)
	require.Nil(t, appErr)

	// Create shared channels
	channel1 := th.CreateChannel(th.Context, th.BasicTeam)
	sc1 := &model.SharedChannel{
		ChannelId:        channel1.Id,
		TeamId:           th.BasicTeam.Id,
		Home:             true,
		ReadOnly:         false,
		ShareName:        channel1.Name,
		ShareDisplayName: channel1.DisplayName,
		SharePurpose:     channel1.Purpose,
		ShareHeader:      channel1.Header,
		CreatorId:        th.BasicUser.Id,
	}
	sc1, err := th.App.ShareChannel(th.Context, sc1)
	require.NoError(t, err)

	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	sc2 := &model.SharedChannel{
		ChannelId:        channel2.Id,
		TeamId:           th.BasicTeam.Id,
		Home:             false,
		ReadOnly:         false,
		ShareName:        channel2.Name,
		ShareDisplayName: channel2.DisplayName,
		SharePurpose:     channel2.Purpose,
		ShareHeader:      channel2.Header,
		CreatorId:        th.BasicUser.Id,
		RemoteId:         remote1.RemoteId,
	}
	sc2, err = th.App.ShareChannel(th.Context, sc2)
	require.NoError(t, err)

	// Add remotes to channel1
	scr1 := &model.SharedChannelRemote{
		ChannelId:         sc1.ChannelId,
		RemoteId:          remote1.RemoteId,
		CreatorId:         th.BasicUser.Id,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
	}
	_, err = th.App.SaveSharedChannelRemote(scr1)
	require.NoError(t, err)

	scr2 := &model.SharedChannelRemote{
		ChannelId:         sc1.ChannelId,
		RemoteId:          remote2.RemoteId,
		CreatorId:         th.BasicUser.Id,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
	}
	_, err = th.App.SaveSharedChannelRemote(scr2)
	require.NoError(t, err)

	// Execute the function
	opts := model.SharedChannelFilterOpts{
		TeamId: th.BasicTeam.Id,
	}
	result, appErr := th.App.GetSharedChannelsWithRemotes(0, 10, opts)

	// Assertions
	require.Nil(t, appErr)
	require.NotNil(t, result)
	require.Len(t, result, 2)

	// Sort results to ensure consistent testing
	sortChannels := func(c1, c2 *model.SharedChannelWithRemotes) bool {
		return c1.SharedChannel.ChannelId < c2.SharedChannel.ChannelId
	}

	if sortChannels(result[1], result[0]) {
		// Swap if not in expected order
		result[0], result[1] = result[1], result[0]
	}

	// Verify channel1 (home channel) with two remotes
	assert.Equal(t, sc1.ChannelId, result[0].SharedChannel.ChannelId)
	assert.Len(t, result[0].Remotes, 2)

	// Verify remotes for channel1
	remoteNames := []string{result[0].Remotes[0].DisplayName, result[0].Remotes[1].DisplayName}
	assert.Contains(t, remoteNames, remote1.DisplayName)
	assert.Contains(t, remoteNames, remote2.DisplayName)

	// Verify channel2 (non-home channel) with one remote
	assert.Equal(t, sc2.ChannelId, result[1].SharedChannel.ChannelId)
	assert.Len(t, result[1].Remotes, 1, "Non-home channel should have 1 remote (the one it's from)")
	assert.Equal(t, remote1.DisplayName, result[1].Remotes[0].DisplayName)
}
