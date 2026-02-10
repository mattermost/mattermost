// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// setupMembershipTest creates the common test fixtures for membership sync tests.
// Returns a Service, the mock stores, and IDs for the channel, remote, and team.
func setupMembershipTest(t *testing.T) (*Service, *MockServerIface, *MockAppIface, *mocks.Store, *mocks.SharedChannelStore, *mocks.ChannelStore, *mocks.UserStore) {
	t.Helper()

	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)
	mockApp := &MockAppIface{}
	scs := &Service{
		server: mockServer,
		app:    mockApp,
	}

	mockStore := &mocks.Store{}
	mockSharedChannelStore := &mocks.SharedChannelStore{}
	mockChannelStore := &mocks.ChannelStore{}
	mockUserStore := &mocks.UserStore{}

	mockStore.On("SharedChannel").Return(mockSharedChannelStore)
	mockStore.On("Channel").Return(mockChannelStore)
	mockStore.On("User").Return(mockUserStore)
	mockServer.On("GetStore").Return(mockStore)

	// Enable membership sync feature flag
	mockConfig := model.Config{}
	mockConfig.SetDefaults()
	mockConfig.FeatureFlags.EnableSharedChannelsMemberSync = true
	mockServer.On("Config").Return(&mockConfig)

	return scs, mockServer, mockApp, mockStore, mockSharedChannelStore, mockChannelStore, mockUserStore
}

func TestOnReceiveMembershipChanges_ChannelIdMismatch(t *testing.T) {
	scs, _, _, _, mockSharedChannelStore, mockChannelStore, _ := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}
	mockChannelStore.On("Get", channelId, true).Return(channel, nil)
	mockSharedChannelStore.On("Get", channelId).Return(&model.SharedChannel{ChannelId: channelId}, nil)

	syncMsg := &model.SyncMsg{
		ChannelId: channelId,
		MembershipChanges: []*model.MembershipChangeMsg{
			{
				ChannelId:  model.NewId(), // different channel ID
				UserId:     model.NewId(),
				IsAdd:      true,
				ChangeTime: 1000,
			},
		},
	}

	err := scs.onReceiveMembershipChanges(syncMsg, rc, nil)
	require.NoError(t, err) // function returns nil even on individual failures

	// The conflict check should never have been called since the mismatch was caught first
	mockSharedChannelStore.AssertNotCalled(t, "GetUserChanges", mock.Anything, mock.Anything, mock.Anything)
}

func TestProcessMemberAdd_RejectsLocalUser(t *testing.T) {
	scs, _, mockApp, _, mockSharedChannelStore, mockChannelStore, mockUserStore := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	localUserId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}
	mockChannelStore.On("Get", channelId, true).Return(channel, nil)
	mockSharedChannelStore.On("Get", channelId).Return(&model.SharedChannel{ChannelId: channelId}, nil)

	// Local user has no remote ID
	localUser := &model.User{Id: localUserId}
	mockUserStore.On("Get", mockTypeContext, localUserId).Return(localUser, nil)

	// No conflict
	mockSharedChannelStore.On("GetUserChanges", localUserId, channelId, mock.AnythingOfType("int64")).Return([]*model.SharedChannelUser{}, nil)

	syncMsg := &model.SyncMsg{
		ChannelId: channelId,
		MembershipChanges: []*model.MembershipChangeMsg{
			{
				ChannelId:  channelId,
				UserId:     localUserId,
				IsAdd:      true,
				ChangeTime: 1000,
			},
		},
	}

	err := scs.onReceiveMembershipChanges(syncMsg, rc, nil)
	require.NoError(t, err) // function returns nil even on individual failures

	mockApp.AssertNotCalled(t, "AddUserToChannel", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestProcessMemberAdd_RejectsOtherRemoteUser(t *testing.T) {
	scs, _, mockApp, _, mockSharedChannelStore, mockChannelStore, mockUserStore := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	otherRemoteId := model.NewId()
	userId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}
	mockChannelStore.On("Get", channelId, true).Return(channel, nil)
	mockSharedChannelStore.On("Get", channelId).Return(&model.SharedChannel{ChannelId: channelId}, nil)

	// User belongs to a different remote
	otherRemoteUser := &model.User{Id: userId, RemoteId: &otherRemoteId}
	mockUserStore.On("Get", mockTypeContext, userId).Return(otherRemoteUser, nil)

	// No conflict
	mockSharedChannelStore.On("GetUserChanges", userId, channelId, mock.AnythingOfType("int64")).Return([]*model.SharedChannelUser{}, nil)

	syncMsg := &model.SyncMsg{
		ChannelId: channelId,
		MembershipChanges: []*model.MembershipChangeMsg{
			{
				ChannelId:  channelId,
				UserId:     userId,
				IsAdd:      true,
				ChangeTime: 1000,
			},
		},
	}

	err := scs.onReceiveMembershipChanges(syncMsg, rc, nil)
	require.NoError(t, err)

	mockApp.AssertNotCalled(t, "AddUserToChannel", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestProcessMemberAdd_AllowsOwnRemoteUser(t *testing.T) {
	scs, _, mockApp, _, mockSharedChannelStore, mockChannelStore, mockUserStore := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	userId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}
	mockChannelStore.On("Get", channelId, true).Return(channel, nil)
	mockSharedChannelStore.On("Get", channelId).Return(&model.SharedChannel{ChannelId: channelId}, nil)

	// User belongs to the sending remote
	remoteUser := &model.User{Id: userId, RemoteId: &remoteId}
	mockUserStore.On("Get", mockTypeContext, userId).Return(remoteUser, nil)

	// No conflict
	mockSharedChannelStore.On("GetUserChanges", userId, channelId, mock.AnythingOfType("int64")).Return([]*model.SharedChannelUser{}, nil)

	// Expect the add to proceed
	mockApp.On("AddUserToChannel", mockTypeReqContext, mockTypeUser, mockTypeChannel, true).Return(&model.ChannelMember{}, nil)
	mockSharedChannelStore.On("UpdateUserLastMembershipSyncAt", userId, channelId, remoteId, int64(1000)).Return(nil)

	syncMsg := &model.SyncMsg{
		ChannelId: channelId,
		MembershipChanges: []*model.MembershipChangeMsg{
			{
				ChannelId:  channelId,
				UserId:     userId,
				IsAdd:      true,
				ChangeTime: 1000,
			},
		},
	}

	err := scs.onReceiveMembershipChanges(syncMsg, rc, nil)
	require.NoError(t, err)

	mockApp.AssertCalled(t, "AddUserToChannel", mockTypeReqContext, mockTypeUser, mockTypeChannel, true)
}

func TestProcessMemberRemove_RejectsLocalUser(t *testing.T) {
	scs, _, mockApp, _, mockSharedChannelStore, mockChannelStore, mockUserStore := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	localUserId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}
	mockChannelStore.On("Get", channelId, true).Return(channel, nil)
	mockSharedChannelStore.On("Get", channelId).Return(&model.SharedChannel{ChannelId: channelId}, nil)

	// Local user has no remote ID
	localUser := &model.User{Id: localUserId}
	mockUserStore.On("Get", mockTypeContext, localUserId).Return(localUser, nil)

	// No conflict
	mockSharedChannelStore.On("GetUserChanges", localUserId, channelId, mock.AnythingOfType("int64")).Return([]*model.SharedChannelUser{}, nil)

	syncMsg := &model.SyncMsg{
		ChannelId: channelId,
		MembershipChanges: []*model.MembershipChangeMsg{
			{
				ChannelId:  channelId,
				UserId:     localUserId,
				IsAdd:      false,
				ChangeTime: 1000,
			},
		},
	}

	err := scs.onReceiveMembershipChanges(syncMsg, rc, nil)
	require.NoError(t, err)

	mockApp.AssertNotCalled(t, "RemoveUserFromChannel", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestProcessMemberRemove_RejectsOtherRemoteUser(t *testing.T) {
	scs, _, mockApp, _, mockSharedChannelStore, mockChannelStore, mockUserStore := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	otherRemoteId := model.NewId()
	userId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}
	mockChannelStore.On("Get", channelId, true).Return(channel, nil)
	mockSharedChannelStore.On("Get", channelId).Return(&model.SharedChannel{ChannelId: channelId}, nil)

	// User belongs to a different remote
	otherRemoteUser := &model.User{Id: userId, RemoteId: &otherRemoteId}
	mockUserStore.On("Get", mockTypeContext, userId).Return(otherRemoteUser, nil)

	// No conflict
	mockSharedChannelStore.On("GetUserChanges", userId, channelId, mock.AnythingOfType("int64")).Return([]*model.SharedChannelUser{}, nil)

	syncMsg := &model.SyncMsg{
		ChannelId: channelId,
		MembershipChanges: []*model.MembershipChangeMsg{
			{
				ChannelId:  channelId,
				UserId:     userId,
				IsAdd:      false,
				ChangeTime: 1000,
			},
		},
	}

	err := scs.onReceiveMembershipChanges(syncMsg, rc, nil)
	require.NoError(t, err)

	mockApp.AssertNotCalled(t, "RemoveUserFromChannel", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestProcessMemberRemove_AllowsOwnRemoteUser(t *testing.T) {
	scs, _, mockApp, _, mockSharedChannelStore, mockChannelStore, mockUserStore := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	userId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}
	mockChannelStore.On("Get", channelId, true).Return(channel, nil)
	mockSharedChannelStore.On("Get", channelId).Return(&model.SharedChannel{ChannelId: channelId}, nil)

	// User belongs to the sending remote
	remoteUser := &model.User{Id: userId, RemoteId: &remoteId}
	mockUserStore.On("Get", mockTypeContext, userId).Return(remoteUser, nil)

	// No conflict
	mockSharedChannelStore.On("GetUserChanges", userId, channelId, mock.AnythingOfType("int64")).Return([]*model.SharedChannelUser{}, nil)

	// Expect the remove to proceed
	mockApp.On("RemoveUserFromChannel", mockTypeReqContext, userId, "", channel).Return(nil)
	mockSharedChannelStore.On("UpdateUserLastMembershipSyncAt", userId, channelId, remoteId, int64(1000)).Return(nil)

	syncMsg := &model.SyncMsg{
		ChannelId: channelId,
		MembershipChanges: []*model.MembershipChangeMsg{
			{
				ChannelId:  channelId,
				UserId:     userId,
				IsAdd:      false,
				ChangeTime: 1000,
			},
		},
	}

	err := scs.onReceiveMembershipChanges(syncMsg, rc, nil)
	require.NoError(t, err)

	mockApp.AssertCalled(t, "RemoveUserFromChannel", mockTypeReqContext, userId, "", channel)
}

func TestProcessMemberAdd_RejectsLocalUser_ErrorMessage(t *testing.T) {
	scs, _, _, _, _, _, mockUserStore := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	localUserId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}

	// Local user (no remote ID) — needed for the fallback User().Get path
	mockUserStore.On("Get", mockTypeContext, localUserId).Return(&model.User{Id: localUserId}, nil)

	change := &model.MembershipChangeMsg{
		ChannelId:  channelId,
		UserId:     localUserId,
		IsAdd:      true,
		ChangeTime: 1000,
	}
	syncMsg := &model.SyncMsg{
		ChannelId: channelId,
	}

	err := scs.processMemberAdd(change, channel, rc, 1000, syncMsg)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrRemoteIDMismatch)
	assert.Contains(t, err.Error(), "membership add sync failed")
}

func TestProcessMemberRemove_RejectsLocalUser_ErrorMessage(t *testing.T) {
	scs, _, _, _, _, mockChannelStore, mockUserStore := setupMembershipTest(t)

	channelId := model.NewId()
	remoteId := model.NewId()
	localUserId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	channel := &model.Channel{Id: channelId, Type: model.ChannelTypeOpen}
	mockChannelStore.On("Get", channelId, true).Return(channel, nil)

	// Local user (no remote ID)
	mockUserStore.On("Get", mockTypeContext, localUserId).Return(&model.User{Id: localUserId}, nil)

	change := &model.MembershipChangeMsg{
		ChannelId:  channelId,
		UserId:     localUserId,
		IsAdd:      false,
		ChangeTime: 1000,
	}

	err := scs.processMemberRemove(change, rc, 1000)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrRemoteIDMismatch)
	assert.Contains(t, err.Error(), "membership remove sync failed")
}
