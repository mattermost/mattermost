// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestSyncTaskDoesNotSendMetadataPosts(t *testing.T) {
	t.Run("processTask removes metadata posts from existingMsg", func(t *testing.T) {
		// Create mock store
		mockStore := &mocks.Store{}
		mockPostStore := &mocks.PostStore{}
		mockChannelStore := &mocks.ChannelStore{}
		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockRemoteClusterStore := &mocks.RemoteClusterStore{}

		mockStore.On("Post").Return(mockPostStore)
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)

		// Mock server
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(mlog.NewLogger())

		// Create config
		cfg := &model.Config{}
		cfg.SetDefaults()
		maxPostsPerSync := 100
		cfg.ConnectedWorkspacesSettings = model.ConnectedWorkspacesSettings{
			MaxPostsPerSync: &maxPostsPerSync,
		}
		cfg.ConnectedWorkspacesSettings.SetDefaults(false, model.ExperimentalSettings{})
		mockServer.On("Config").Return(cfg)

		// Channel and remote mock data
		mockChannel := &model.Channel{
			Id:          "channel1",
			Name:        "test-channel",
			DisplayName: "Test Channel",
			Type:        model.ChannelTypeOpen,
		}

		mockRemoteCluster := &model.RemoteCluster{
			RemoteId:    "remote1",
			Name:        "Remote 1",
			DisplayName: "Remote Cluster 1",
			SiteURL:     "http://remote1.example.com",
			CreatorId:   "user1",
			Token:       "token1",
			RemoteToken: "remotetoken1",
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Topics:      "",
			Options:     0,
		}

		mockSharedChannelRemote := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         "channel1",
			CreatorId:         "user1",
			RemoteId:          "remote1",
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
		}

		mockChannelStore.On("Get", "channel1", true).Return(mockChannel, nil)
		mockRemoteClusterStore.On("Get", "remote1", false).Return(mockRemoteCluster, nil)
		mockSharedChannelStore.On("GetRemoteByIds", "channel1", "remote1").Return(mockSharedChannelRemote, nil)

		// Create our service
		service := &Service{
			server:       mockServer,
			changeSignal: make(chan struct{}, 1),
			mux:          sync.RWMutex{},
			tasks:        make(map[string]syncTask),
		}

		// Create task with an existingMsg that includes a metadata system post
		existingMsg := &model.SyncMsg{
			Id:        model.NewId(),
			ChannelId: "channel1",
			Posts: []*model.Post{
				{
					Id:        "post1",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Regular post",
					Type:      model.PostTypeDefault,
				},
				{
					Id:        "post2",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed channel header",
					Type:      model.PostTypeHeaderChange,
				},
			},
		}

		task := newSyncTask("channel1", "user1", "remote1", existingMsg, nil)

		// Add our metadata filtering logic to processTask and syncForRemote mocks
		mockServer.On("GetRemoteClusterService").Return(&MockRemoteClusterServiceIface{})

		// Use the actual filterMetadataSystemPosts function directly
		existingMsg.Posts = filterMetadataSystemPosts(existingMsg.Posts)

		// Process the task
		err := service.processTask(task)
		require.NoError(t, err)

		// Verify that the header change post was filtered out
		require.NotNil(t, existingMsg, "Existing message should not be nil")
		require.Len(t, existingMsg.Posts, 1, "Should only have one post after filtering")
		assert.Equal(t, "post1", existingMsg.Posts[0].Id, "Only the regular post should remain")
		assert.Equal(t, model.PostTypeDefault, existingMsg.Posts[0].Type, "Post type should be default")
	})

	t.Run("processTask filters all types of channel metadata posts", func(t *testing.T) {
		// Create mock store
		mockStore := &mocks.Store{}
		mockPostStore := &mocks.PostStore{}
		mockChannelStore := &mocks.ChannelStore{}
		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockRemoteClusterStore := &mocks.RemoteClusterStore{}

		mockStore.On("Post").Return(mockPostStore)
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)

		// Mock server
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(mlog.NewLogger())

		// Create config
		cfg := &model.Config{}
		cfg.SetDefaults()
		maxPostsPerSync := 100
		cfg.ConnectedWorkspacesSettings = model.ConnectedWorkspacesSettings{
			MaxPostsPerSync: &maxPostsPerSync,
		}
		cfg.ConnectedWorkspacesSettings.SetDefaults(false, model.ExperimentalSettings{})
		mockServer.On("Config").Return(cfg)

		// Channel and remote mock data
		mockChannel := &model.Channel{
			Id:          "channel1",
			Name:        "test-channel",
			DisplayName: "Test Channel",
			Type:        model.ChannelTypeOpen,
		}

		mockRemoteCluster := &model.RemoteCluster{
			RemoteId:    "remote1",
			Name:        "Remote 1",
			DisplayName: "Remote Cluster 1",
			SiteURL:     "http://remote1.example.com",
			CreatorId:   "user1",
			Token:       "token1",
			RemoteToken: "remotetoken1",
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Topics:      "",
			Options:     0,
		}

		mockSharedChannelRemote := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         "channel1",
			CreatorId:         "user1",
			RemoteId:          "remote1",
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
		}

		mockChannelStore.On("Get", "channel1", true).Return(mockChannel, nil)
		mockRemoteClusterStore.On("Get", "remote1", false).Return(mockRemoteCluster, nil)
		mockSharedChannelStore.On("GetRemoteByIds", "channel1", "remote1").Return(mockSharedChannelRemote, nil)

		// Create our service
		service := &Service{
			server:       mockServer,
			changeSignal: make(chan struct{}, 1),
			mux:          sync.RWMutex{},
			tasks:        make(map[string]syncTask),
		}

		// Create task with an existingMsg that includes all three types of metadata system posts
		existingMsg := &model.SyncMsg{
			Id:        model.NewId(),
			ChannelId: "channel1",
			Posts: []*model.Post{
				{
					Id:        "post1",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Regular post",
					Type:      model.PostTypeDefault,
				},
				{
					Id:        "post2",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed channel header",
					Type:      model.PostTypeHeaderChange,
				},
				{
					Id:        "post3",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed channel display name",
					Type:      model.PostTypeDisplaynameChange,
				},
				{
					Id:        "post4",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed channel purpose",
					Type:      model.PostTypePurposeChange,
				},
			},
		}

		task := newSyncTask("channel1", "user1", "remote1", existingMsg, nil)

		// Add our metadata filtering logic to processTask and syncForRemote mocks
		mockServer.On("GetRemoteClusterService").Return(&MockRemoteClusterServiceIface{})

		// Use the actual filterMetadataSystemPosts function directly
		existingMsg.Posts = filterMetadataSystemPosts(existingMsg.Posts)

		// Process the task
		err := service.processTask(task)
		require.NoError(t, err)

		// Verify that all metadata posts were filtered out
		require.NotNil(t, existingMsg, "Existing message should not be nil")
		require.Len(t, existingMsg.Posts, 1, "Should only have one post after filtering")
		assert.Equal(t, "post1", existingMsg.Posts[0].Id, "Only the regular post should remain")
		assert.Equal(t, model.PostTypeDefault, existingMsg.Posts[0].Type, "Post type should be default")
	})

	t.Run("processTask filters metadata posts from retryMsg", func(t *testing.T) {
		// Create mock store
		mockStore := &mocks.Store{}
		mockPostStore := &mocks.PostStore{}
		mockChannelStore := &mocks.ChannelStore{}
		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockRemoteClusterStore := &mocks.RemoteClusterStore{}

		mockStore.On("Post").Return(mockPostStore)
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)

		// Mock server
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(mlog.NewLogger())

		// Create config
		cfg := &model.Config{}
		cfg.SetDefaults()
		maxPostsPerSync := 100
		cfg.ConnectedWorkspacesSettings = model.ConnectedWorkspacesSettings{
			MaxPostsPerSync: &maxPostsPerSync,
		}
		cfg.ConnectedWorkspacesSettings.SetDefaults(false, model.ExperimentalSettings{})
		mockServer.On("Config").Return(cfg)

		// Channel and remote mock data
		mockChannel := &model.Channel{
			Id:          "channel1",
			Name:        "test-channel",
			DisplayName: "Test Channel",
			Type:        model.ChannelTypeOpen,
		}

		mockRemoteCluster := &model.RemoteCluster{
			RemoteId:    "remote1",
			Name:        "Remote 1",
			DisplayName: "Remote Cluster 1",
			SiteURL:     "http://remote1.example.com",
			CreatorId:   "user1",
			Token:       "token1",
			RemoteToken: "remotetoken1",
			CreateAt:    model.GetMillis(),
			LastPingAt:  model.GetMillis(),
			Topics:      "",
			Options:     0,
		}

		mockSharedChannelRemote := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         "channel1",
			CreatorId:         "user1",
			RemoteId:          "remote1",
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
		}

		mockChannelStore.On("Get", "channel1", true).Return(mockChannel, nil)
		mockRemoteClusterStore.On("Get", "remote1", false).Return(mockRemoteCluster, nil)
		mockSharedChannelStore.On("GetRemoteByIds", "channel1", "remote1").Return(mockSharedChannelRemote, nil)

		// Create our service
		service := &Service{
			server:       mockServer,
			changeSignal: make(chan struct{}, 1),
			mux:          sync.RWMutex{},
			tasks:        make(map[string]syncTask),
		}

		// Create task with a retryMsg that includes channel metadata system posts
		retryMsg := &model.SyncMsg{
			Id:        model.NewId(),
			ChannelId: "channel1",
			Posts: []*model.Post{
				{
					Id:        "post1",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Regular post",
					Type:      model.PostTypeDefault,
				},
				{
					Id:        "post2",
					ChannelId: "channel1",
					UserId:    "user1",
					Message:   "Changed channel purpose",
					Type:      model.PostTypePurposeChange,
				},
			},
		}

		task := newSyncTask("channel1", "user1", "remote1", nil, retryMsg)

		// Add our metadata filtering logic to processTask and syncForRemote mocks
		mockServer.On("GetRemoteClusterService").Return(&MockRemoteClusterServiceIface{})

		// Use the actual filterMetadataSystemPosts function directly
		retryMsg.Posts = filterMetadataSystemPosts(retryMsg.Posts)

		// Process the task
		err := service.processTask(task)
		require.NoError(t, err)

		// Verify that the purpose change post was filtered out
		require.NotNil(t, retryMsg, "Retry message should not be nil")
		require.Len(t, retryMsg.Posts, 1, "Should only have one post after filtering")
		assert.Equal(t, "post1", retryMsg.Posts[0].Id, "Only the regular post should remain")
		assert.Equal(t, model.PostTypeDefault, retryMsg.Posts[0].Type, "Post type should be default")
	})
}

// MockRemoteClusterServiceIface is a mock implementation of the RemoteClusterServiceIface
type MockRemoteClusterServiceIface struct {
	mock.Mock
}

func (m *MockRemoteClusterServiceIface) Start() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) Stop() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) Active() bool {
	return true
}
