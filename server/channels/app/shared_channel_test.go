// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
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

func TestGetSharedChannelsWithRemotes(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create mock store to use in our test
	mockStore := &storemocks.Store{}
	mockSharedChannelStore := &storemocks.SharedChannelStore{}
	mockRemoteClusterStore := &storemocks.RemoteClusterStore{}

	// Replace the app's store with our mocked version
	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(mockStore)
	defer func() { th.App.Srv().SetStore(originalStore) }()

	mockStore.On("SharedChannel").Return(mockSharedChannelStore)
	mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)

	// Setup test data
	teamId := model.NewId()

	// Create shared channels
	channel1 := &model.SharedChannel{
		ChannelId:        model.NewId(),
		TeamId:           teamId,
		Home:             true,
		ShareName:        "channel1",
		ShareDisplayName: "Channel 1",
		CreatorId:        th.BasicUser.Id,
		RemoteId:         "",
		CreateAt:         model.GetMillis(),
		UpdateAt:         model.GetMillis(),
	}

	channel2 := &model.SharedChannel{
		ChannelId:        model.NewId(),
		TeamId:           teamId,
		Home:             false,
		ShareName:        "channel2",
		ShareDisplayName: "Channel 2",
		CreatorId:        th.BasicUser.Id,
		RemoteId:         model.NewId(),
		CreateAt:         model.GetMillis(),
		UpdateAt:         model.GetMillis(),
	}

	// Create remote clusters
	remote1 := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		Name:        "remote1",
		DisplayName: "Remote 1",
		SiteURL:     "http://remote1.example.com",
		CreatorId:   th.BasicUser.Id,
		CreateAt:    model.GetMillis(),
		LastPingAt:  model.GetMillis(),
	}

	remote2 := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		Name:        "remote2",
		DisplayName: "Remote 2",
		SiteURL:     "http://remote2.example.com",
		CreatorId:   th.BasicUser.Id,
		CreateAt:    model.GetMillis(),
		LastPingAt:  model.GetMillis(),
	}

	// Create shared channel remotes
	sharedChannelRemote1 := &model.SharedChannelRemote{
		Id:        model.NewId(),
		ChannelId: channel1.ChannelId,
		RemoteId:  remote1.RemoteId,
		CreatorId: th.BasicUser.Id,
		CreateAt:  model.GetMillis(),
		UpdateAt:  model.GetMillis(),
	}

	sharedChannelRemote2 := &model.SharedChannelRemote{
		Id:        model.NewId(),
		ChannelId: channel1.ChannelId,
		RemoteId:  remote2.RemoteId,
		CreatorId: th.BasicUser.Id,
		CreateAt:  model.GetMillis(),
		UpdateAt:  model.GetMillis(),
	}

	channels := []*model.SharedChannel{channel1, channel2}

	// Setup mock expectations
	mockSharedChannelStore.On("GetAll", mock.Anything, mock.Anything, mock.Anything).Return(channels, nil)

	// Return channel1's remotes
	remoteFilter1 := model.SharedChannelRemoteFilterOpts{
		ChannelId: channel1.ChannelId,
	}
	mockSharedChannelStore.On("GetRemotes", mock.Anything, mock.Anything, remoteFilter1).
		Return([]*model.SharedChannelRemote{sharedChannelRemote1, sharedChannelRemote2}, nil)

	// Return an empty list for channel2's remotes since it's not a home channel
	remoteFilter2 := model.SharedChannelRemoteFilterOpts{
		ChannelId: channel2.ChannelId,
	}
	mockSharedChannelStore.On("GetRemotes", mock.Anything, mock.Anything, remoteFilter2).
		Return([]*model.SharedChannelRemote{}, nil)

	// Return the remote clusters when requested
	mockRemoteClusterStore.On("Get", remote1.RemoteId, true).Return(remote1, nil)
	mockRemoteClusterStore.On("Get", remote2.RemoteId, true).Return(remote2, nil)
	mockRemoteClusterStore.On("Get", channel2.RemoteId, true).Return(remote2, nil)

	// Execute the function
	opts := model.SharedChannelFilterOpts{
		TeamId: teamId,
	}
	result, appErr := th.App.GetSharedChannelsWithRemotes(0, 10, opts)

	// Assertions
	require.Nil(t, appErr)
	require.NotNil(t, result)
	require.Len(t, result, 2)

	// Check channel1
	assert.Equal(t, channel1.ChannelId, result[0].SharedChannel.ChannelId)
	assert.Len(t, result[0].Remotes, 2)

	remoteNames := []string{result[0].Remotes[0].DisplayName, result[0].Remotes[1].DisplayName}
	assert.Contains(t, remoteNames, remote1.DisplayName)
	assert.Contains(t, remoteNames, remote2.DisplayName)

	// Check channel2
	assert.Equal(t, channel2.ChannelId, result[1].SharedChannel.ChannelId)
	assert.Len(t, result[1].Remotes, 1, "Non-home channel should have 1 remote (the one it's from)")
}
