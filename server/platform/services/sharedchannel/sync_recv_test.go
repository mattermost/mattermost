// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestProcessSyncMessage(t *testing.T) {
	remoteID := model.NewId()
	channelID := model.NewId()
	rc := &model.RemoteCluster{
		RemoteId: remoteID,
		Name:     "test-remote",
	}

	makeConfig := func() *model.Config {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.FeatureFlags.EnableSharedChannelsMemberSync = false
		return cfg
	}

	t.Run("returns SyncResponse directly for empty sync message", func(t *testing.T) {
		channel := &model.Channel{Id: channelID, Type: model.ChannelTypeOpen}

		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", channelID, true).Return(channel, nil)

		mockSCStore := &mocks.SharedChannelStore{}
		mockSCStore.On("HasRemote", channelID, remoteID).Return(true, nil)

		mockStore := &mocks.Store{}
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSCStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: channelID,
		}

		resp, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.NoError(t, err)
		assert.Empty(t, resp.PostErrors)
		assert.Empty(t, resp.UserErrors)
	})

	t.Run("returns error when channel not found", func(t *testing.T) {
		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", channelID, true).Return(nil, store.NewErrNotFound("Channel", channelID))

		mockStore := &mocks.Store{}
		mockStore.On("Channel").Return(mockChannelStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: channelID,
		}

		_, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "channel not found")
	})

	t.Run("returns error when channel not shared with remote", func(t *testing.T) {
		channel := &model.Channel{Id: channelID, Type: model.ChannelTypeOpen}

		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", channelID, true).Return(channel, nil)

		mockSCStore := &mocks.SharedChannelStore{}
		mockSCStore.On("HasRemote", channelID, remoteID).Return(false, nil)

		mockStore := &mocks.Store{}
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSCStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: channelID,
		}

		_, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrChannelNotShared)
	})

	t.Run("returns error for global user sync with posts", func(t *testing.T) {
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: "", // global user sync
			Posts:     []*model.Post{{Id: model.NewId()}},
		}

		_, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "should not contain posts")
	})

	t.Run("returns empty response for global user sync with no users", func(t *testing.T) {
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: "", // global user sync
		}

		resp, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.NoError(t, err)
		assert.Empty(t, resp.UsersSyncd)
	})

	t.Run("post with mismatched channelID is reported in PostErrors", func(t *testing.T) {
		channel := &model.Channel{Id: channelID, Type: model.ChannelTypeOpen}
		wrongChannelID := model.NewId()
		postID := model.NewId()

		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", channelID, true).Return(channel, nil)

		mockSCStore := &mocks.SharedChannelStore{}
		mockSCStore.On("HasRemote", channelID, remoteID).Return(true, nil)

		mockStore := &mocks.Store{}
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSCStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: channelID,
			Posts: []*model.Post{
				{Id: postID, ChannelId: wrongChannelID},
			},
		}

		resp, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.NoError(t, err)
		assert.Contains(t, resp.PostErrors, postID)
	})
}

func TestUpsertSyncUserStatus(t *testing.T) {
	setup := func(remoteID string, user *model.User) (*Service, *MockAppIface, *model.Status, *model.RemoteCluster) {
		var userID string
		if user == nil {
			userID = model.NewId()
		} else {
			userID = user.Id
		}

		status := &model.Status{
			UserId: userID,
			Status: model.StatusDnd,
		}
		remoteCluster := &model.RemoteCluster{
			RemoteId: remoteID,
			Name:     "test-remote",
		}

		mockUserStore := &mocks.UserStore{}
		if user == nil {
			mockUserStore.On("Get", mockTypeContext, mock.Anything).Return(nil, store.NewErrNotFound("User", userID))
		} else {
			mockUserStore.On("Get", mockTypeContext, user.Id).Return(user, nil)
		}

		mockStore := &mocks.Store{}
		mockStore.On("User").Return(mockUserStore)

		logger := mlog.CreateConsoleTestLogger(t)

		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)

		mockApp := &MockAppIface{}
		mockApp.On("SaveAndBroadcastStatus", status).Return()

		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		return scs, mockApp, status, remoteCluster
	}

	t.Run("should broadcast changes to a remote user's status", func(t *testing.T) {
		remoteID := model.NewId()
		user := &model.User{
			Id:       model.NewId(),
			RemoteId: model.NewPointer(remoteID),
		}

		scs, mockApp, status, remoteCluster := setup(remoteID, user)

		err := scs.upsertSyncUserStatus(request.TestContext(t), status, remoteCluster)

		require.NoError(t, err)
		mockApp.AssertCalled(t, "SaveAndBroadcastStatus", status)
	})

	t.Run("should return an error when the user doesn't exist locally", func(t *testing.T) {
		remoteID := model.NewId()
		var user *model.User

		scs, mockApp, status, remoteCluster := setup(remoteID, user)

		rctx := request.TestContext(t)
		err := scs.upsertSyncUserStatus(rctx, status, remoteCluster)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "error getting user when syncing status")
		mockApp.AssertNotCalled(t, "SaveAndBroadcastStatus")
	})

	t.Run("should return an error when attempting to sync a local user", func(t *testing.T) {
		remoteID := model.NewId()
		user := &model.User{
			Id:       model.NewId(),
			RemoteId: nil,
		}

		scs, mockApp, status, remoteCluster := setup(remoteID, user)

		rctx := request.TestContext(t)
		err := scs.upsertSyncUserStatus(rctx, status, remoteCluster)

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrRemoteIDMismatch)
		assert.Contains(t, err.Error(), "error updating user status")
		mockApp.AssertNotCalled(t, "SaveAndBroadcastStatus")
	})

	t.Run("should return an error when attempting to sync a user from a different remote", func(t *testing.T) {
		remoteID := model.NewId()
		anotherRemoteID := model.NewId()
		user := &model.User{
			Id:       model.NewId(),
			RemoteId: model.NewPointer(anotherRemoteID),
		}

		scs, mockApp, status, remoteCluster := setup(remoteID, user)

		rctx := request.TestContext(t)
		err := scs.upsertSyncUserStatus(rctx, status, remoteCluster)

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrRemoteIDMismatch)
		assert.Contains(t, err.Error(), "error updating user status")
		mockApp.AssertNotCalled(t, "SaveAndBroadcastStatus")
	})
}
