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
