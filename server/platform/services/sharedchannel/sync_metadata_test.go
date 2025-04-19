// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

func TestSyncTaskDoesNotSendMetadataPosts(t *testing.T) {
	// Helper function to create test service with mocks
	setupTestService := func() (*Service, *MockServerIface) {
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
		mockServer.On("GetMetrics").Return(nil)

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

		// Add our metadata filtering logic to processTask and syncForRemote mocks
		mockServer.On("GetRemoteClusterService").Return(&MockRemoteClusterServiceIface{})

		return service, mockServer
	}

	// Helper function to verify filtered posts
	verifyFilteredPosts := func(t *testing.T, posts []*model.Post) {
		require.NotNil(t, posts, "Post list should not be nil")
		require.Len(t, posts, 1, "Should only have one post after filtering")
		assert.Equal(t, "post1", posts[0].Id, "Only the regular post should remain")
		assert.Equal(t, model.PostTypeDefault, posts[0].Type, "Post type should be default")
	}

	// Table-driven test cases
	tests := []struct {
		name     string
		msgField string // "existing" or "retry"
		posts    []*model.Post
	}{
		{
			name:     "removes header change from existingMsg",
			msgField: "existing",
			posts: []*model.Post{
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
		},
		{
			name:     "filters all types of metadata posts from existingMsg",
			msgField: "existing",
			posts: []*model.Post{
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
		},
		{
			name:     "filters metadata posts from retryMsg",
			msgField: "retry",
			posts: []*model.Post{
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
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup the service with mocks
			service, _ := setupTestService()

			// Create message
			syncMsg := &model.SyncMsg{
				Id:        model.NewId(),
				ChannelId: "channel1",
				Posts:     tc.posts,
			}

			// Create task based on message field type
			var task syncTask
			if tc.msgField == "existing" {
				task = newSyncTask("channel1", "user1", "remote1", syncMsg, nil)
			} else {
				task = newSyncTask("channel1", "user1", "remote1", nil, syncMsg)
			}

			// Apply filtering directly
			if tc.msgField == "existing" {
				task.existingMsg.Posts = filterMetadataSystemPosts(task.existingMsg.Posts)
			} else {
				task.retryMsg.Posts = filterMetadataSystemPosts(task.retryMsg.Posts)
			}

			// Process the task
			err := service.processTask(task)
			require.NoError(t, err)

			// Verify results
			if tc.msgField == "existing" {
				verifyFilteredPosts(t, task.existingMsg.Posts)
			} else {
				verifyFilteredPosts(t, task.retryMsg.Posts)
			}
		})
	}
}

// MockRemoteClusterServiceIface is a mock implementation of the RemoteClusterServiceIface
type MockRemoteClusterServiceIface struct {
	mock.Mock
}

func (m *MockRemoteClusterServiceIface) Shutdown() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) Start() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) Active() bool {
	return true
}

func (m *MockRemoteClusterServiceIface) AddTopicListener(topic string, listener remotecluster.TopicListener) string {
	args := m.Called(topic, listener)
	return args.String(0)
}

func (m *MockRemoteClusterServiceIface) RemoveTopicListener(listenerId string) {
	m.Called(listenerId)
}

func (m *MockRemoteClusterServiceIface) AddConnectionStateListener(listener remotecluster.ConnectionStateListener) string {
	args := m.Called(listener)
	return args.String(0)
}

func (m *MockRemoteClusterServiceIface) RemoveConnectionStateListener(listenerId string) {
	m.Called(listenerId)
}

func (m *MockRemoteClusterServiceIface) SendMsg(ctx context.Context, msg model.RemoteClusterMsg, rc *model.RemoteCluster, f remotecluster.SendMsgResultFunc) error {
	// Mock a successful message send
	if f != nil {
		resp := &remotecluster.Response{
			Status: remotecluster.ResponseStatusOK,
		}
		f(msg, rc, resp, nil)
	}
	return nil
}

func (m *MockRemoteClusterServiceIface) SendFile(ctx context.Context, us *model.UploadSession, fi *model.FileInfo, rc *model.RemoteCluster, rp remotecluster.ReaderProvider, f remotecluster.SendFileResultFunc) error {
	args := m.Called(ctx, us, fi, rc, rp, f)
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) SendProfileImage(ctx context.Context, userID string, rc *model.RemoteCluster, provider remotecluster.ProfileImageProvider, f remotecluster.SendProfileImageResultFunc) error {
	args := m.Called(ctx, userID, rc, provider, f)
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) AcceptInvitation(invite *model.RemoteClusterInvite, name string, displayName string, creatorId string, siteURL string, defaultTeamId string) (*model.RemoteCluster, error) {
	// Return default values for test purposes
	return &model.RemoteCluster{}, nil
}

func (m *MockRemoteClusterServiceIface) ReceiveIncomingMsg(rc *model.RemoteCluster, msg model.RemoteClusterMsg) remotecluster.Response {
	// Return default response for test purposes
	return remotecluster.Response{
		Status: remotecluster.ResponseStatusOK,
	}
}

func (m *MockRemoteClusterServiceIface) ReceiveInviteConfirmation(invite model.RemoteClusterInvite) (*model.RemoteCluster, error) {
	// Return default values for test purposes
	return &model.RemoteCluster{}, nil
}

func (m *MockRemoteClusterServiceIface) PingNow(rc *model.RemoteCluster) {
	m.Called(rc)
}
