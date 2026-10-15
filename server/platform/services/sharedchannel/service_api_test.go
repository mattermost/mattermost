// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// testNoopPlatform satisfies PlatformIface for API tests that trigger websocket/cache notifications.
type testNoopPlatform struct{}

func (testNoopPlatform) InvalidateCacheForUser(userID string) {}

func (testNoopPlatform) InvalidateCacheForChannel(channel *model.Channel) {}

func TestUnshareChannel_systemPostsForEachRemoteWorkspace(t *testing.T) {
	channelID := model.NewId()
	teamID := model.NewId()
	channel := &model.Channel{Id: channelID, TeamId: teamID, Name: "town-square", DisplayName: "Town Square"}

	remoteIDA := model.NewId()
	remoteIDB := model.NewId()
	remotes := []*model.SharedChannelRemote{
		{Id: model.NewId(), ChannelId: channelID, RemoteId: remoteIDA, DeleteAt: 0},
		{Id: model.NewId(), ChannelId: channelID, RemoteId: remoteIDB, DeleteAt: 0},
	}
	rcA := &model.RemoteCluster{RemoteId: remoteIDA, DisplayName: "Workspace A"}
	rcB := &model.RemoteCluster{RemoteId: remoteIDB, Name: "internal-b"}

	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)

	mockStore := &mocks.Store{}
	mockChannelStore := mocks.ChannelStore{}
	mockSharedChannelStore := mocks.SharedChannelStore{}
	mockRemoteClusterStore := mocks.RemoteClusterStore{}

	mockServer.On("GetStore").Return(mockStore)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
	mockStore.On("RemoteCluster").Return(&mockRemoteClusterStore)

	mockChannelStore.On("Get", channelID, true).Return(channel, nil).Once()
	mockChannelStore.On("Get", channelID, false).Return(channel, nil).Once()

	mockSharedChannelStore.On("GetRemotes", 0, 10000, model.SharedChannelRemoteFilterOpts{
		ChannelId:          channelID,
		IncludeUnconfirmed: true,
	}).Return(remotes, nil).Once()
	mockSharedChannelStore.On("Delete", channelID).Return(true, nil).Once()

	mockRemoteClusterStore.On("Get", remoteIDA, false).Return(rcA, nil).Once()
	mockRemoteClusterStore.On("Get", remoteIDB, false).Return(rcB, nil).Once()

	mockApp := &MockAppIface{}
	bot := &model.Bot{UserId: model.NewId()}
	var postedWorkspaces []string
	mockApp.On("GetSystemBot", mock.Anything).Return(bot, (*model.AppError)(nil))
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("CreatePost", mock.Anything, mock.AnythingOfType("*model.Post"), mock.AnythingOfType("*model.Channel"), mock.Anything).
		Run(func(args mock.Arguments) {
			post := args.Get(1).(*model.Post)
			wn, _ := post.GetProps()[model.PostPropsSharedChannelWorkspaceName].(string)
			assert.Equal(t, model.SharedChannelStatePostValueUnshared, post.GetProps()[model.PostPropsSharedChannelState])
			postedWorkspaces = append(postedWorkspaces, wn)
			assert.Equal(t,
				i18n.T("shared_channel.system_message.no_longer_shared", map[string]any{"WorkspaceName": wn}),
				post.Message,
			)
		}).Return(&model.Post{}, false, (*model.AppError)(nil))

	scs := &Service{
		server:   mockServer,
		platform: testNoopPlatform{},
		app:      mockApp,
	}

	deleted, err := scs.UnshareChannel(channelID)
	require.NoError(t, err)
	assert.True(t, deleted)

	mockApp.AssertNumberOfCalls(t, "CreatePost", 2)
	assert.ElementsMatch(t, []string{"Workspace A", "internal-b"}, postedWorkspaces)
	mockApp.AssertExpectations(t)
	mockSharedChannelStore.AssertExpectations(t)
	mockRemoteClusterStore.AssertExpectations(t)
}

func TestUnshareChannel_whenListRemotesFails_stillUnsharesWithoutSystemPosts(t *testing.T) {
	channelID := model.NewId()
	channel := &model.Channel{Id: channelID, TeamId: model.NewId()}

	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)

	mockStore := &mocks.Store{}
	mockChannelStore := mocks.ChannelStore{}
	mockSharedChannelStore := mocks.SharedChannelStore{}

	mockServer.On("GetStore").Return(mockStore)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("SharedChannel").Return(&mockSharedChannelStore)

	mockChannelStore.On("Get", channelID, true).Return(channel, nil).Once()
	mockChannelStore.On("Get", channelID, false).Return(channel, nil).Once()

	listErr := errors.New("store remotes unavailable")
	mockSharedChannelStore.On("GetRemotes", 0, 10000, model.SharedChannelRemoteFilterOpts{
		ChannelId:          channelID,
		IncludeUnconfirmed: true,
	}).Return(([]*model.SharedChannelRemote)(nil), listErr).Once()
	mockSharedChannelStore.On("Delete", channelID).Return(true, nil).Once()

	mockApp := &MockAppIface{}
	mockApp.On("Publish", mock.Anything).Return()

	scs := &Service{
		server:   mockServer,
		platform: testNoopPlatform{},
		app:      mockApp,
	}

	deleted, err := scs.UnshareChannel(channelID)
	require.NoError(t, err)
	assert.True(t, deleted)

	mockApp.AssertNotCalled(t, "CreatePost")
	mockApp.AssertExpectations(t)
}

func TestUnshareChannel_whenRemoteClusterMissingUsesRemoteIdInPost(t *testing.T) {
	channelID := model.NewId()
	channel := &model.Channel{Id: channelID, TeamId: model.NewId()}
	remoteID := model.NewId()
	remotes := []*model.SharedChannelRemote{
		{Id: model.NewId(), ChannelId: channelID, RemoteId: remoteID, DeleteAt: 0},
	}

	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)

	mockStore := &mocks.Store{}
	mockChannelStore := mocks.ChannelStore{}
	mockSharedChannelStore := mocks.SharedChannelStore{}
	mockRemoteClusterStore := mocks.RemoteClusterStore{}

	mockServer.On("GetStore").Return(mockStore)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
	mockStore.On("RemoteCluster").Return(&mockRemoteClusterStore)

	mockChannelStore.On("Get", channelID, true).Return(channel, nil).Once()
	mockChannelStore.On("Get", channelID, false).Return(channel, nil).Once()
	mockSharedChannelStore.On("GetRemotes", 0, 10000, model.SharedChannelRemoteFilterOpts{
		ChannelId:          channelID,
		IncludeUnconfirmed: true,
	}).Return(remotes, nil).Once()
	mockSharedChannelStore.On("Delete", channelID).Return(true, nil).Once()
	mockRemoteClusterStore.On("Get", remoteID, false).Return((*model.RemoteCluster)(nil), errors.New("not found")).Once()

	mockApp := &MockAppIface{}
	bot := &model.Bot{UserId: model.NewId()}
	mockApp.On("GetSystemBot", mock.Anything).Return(bot, (*model.AppError)(nil))
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("CreatePost", mock.Anything, mock.AnythingOfType("*model.Post"), mock.AnythingOfType("*model.Channel"), mock.Anything).
		Run(func(args mock.Arguments) {
			post := args.Get(1).(*model.Post)
			assert.Equal(t, remoteID, post.GetProps()[model.PostPropsSharedChannelWorkspaceName])
		}).Return(&model.Post{}, false, (*model.AppError)(nil))

	scs := &Service{
		server:   mockServer,
		platform: testNoopPlatform{},
		app:      mockApp,
	}

	_, err := scs.UnshareChannel(channelID)
	require.NoError(t, err)
	mockApp.AssertNumberOfCalls(t, "CreatePost", 1)
}

func TestUninviteRemoteFromChannel_postsUnsharedSystemMessage(t *testing.T) {
	channelID := model.NewId()
	remoteID := model.NewId()
	scrID := model.NewId()
	channel := &model.Channel{Id: channelID, TeamId: model.NewId()}
	scr := &model.SharedChannelRemote{
		Id:        scrID,
		ChannelId: channelID,
		RemoteId:  remoteID,
		DeleteAt:  0,
	}
	rc := &model.RemoteCluster{RemoteId: remoteID, DisplayName: "Peer workspace"}
	remaining := []*model.SharedChannelRemote{{Id: model.NewId(), ChannelId: channelID, RemoteId: model.NewId(), DeleteAt: 0}}

	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)
	setupMockServerWithConfig(mockServer)

	mockStore := &mocks.Store{}
	mockChannelStore := mocks.ChannelStore{}
	mockSharedChannelStore := mocks.SharedChannelStore{}
	mockRemoteClusterStore := mocks.RemoteClusterStore{}

	mockServer.On("GetStore").Return(mockStore)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
	mockStore.On("RemoteCluster").Return(&mockRemoteClusterStore)

	mockSharedChannelStore.On("GetRemoteByIds", channelID, remoteID).Return(scr, nil).Once()
	mockSharedChannelStore.On("DeleteRemote", scrID).Return(true, nil).Once()
	mockChannelStore.On("Get", channelID, true).Return(channel, nil).Once()
	mockRemoteClusterStore.On("Get", remoteID, false).Return(rc, nil).Once()
	mockSharedChannelStore.On("GetRemotes", 0, 1, model.SharedChannelRemoteFilterOpts{
		ChannelId:          channelID,
		IncludeUnconfirmed: true,
	}).Return(remaining, nil).Once()

	mockApp := &MockAppIface{}
	bot := &model.Bot{UserId: model.NewId()}
	mockApp.On("GetSystemBot", mock.Anything).Return(bot, (*model.AppError)(nil))
	mockApp.On("CreatePost", mock.Anything, mock.AnythingOfType("*model.Post"), mock.AnythingOfType("*model.Channel"), mock.Anything).
		Run(func(args mock.Arguments) {
			post := args.Get(1).(*model.Post)
			assert.Equal(t, "Peer workspace", post.GetProps()[model.PostPropsSharedChannelWorkspaceName])
			assert.Equal(t, model.SharedChannelStatePostValueUnshared, post.GetProps()[model.PostPropsSharedChannelState])
		}).Return(&model.Post{}, false, (*model.AppError)(nil))

	scs := &Service{
		server:   mockServer,
		platform: testNoopPlatform{},
		app:      mockApp,
	}

	err := scs.UninviteRemoteFromChannel(channelID, remoteID)
	require.NoError(t, err)

	mockApp.AssertNumberOfCalls(t, "CreatePost", 1)
	mockSharedChannelStore.AssertNotCalled(t, "Delete", mock.Anything)
	mockApp.AssertExpectations(t)
	mockRemoteClusterStore.AssertExpectations(t)
}

func TestUninviteRemoteFromChannel_whenLastRemoteUnsharesChannel(t *testing.T) {
	channelID := model.NewId()
	remoteID := model.NewId()
	scrID := model.NewId()
	channel := &model.Channel{Id: channelID, TeamId: model.NewId()}
	scr := &model.SharedChannelRemote{
		Id:        scrID,
		ChannelId: channelID,
		RemoteId:  remoteID,
		DeleteAt:  0,
	}
	rc := &model.RemoteCluster{RemoteId: remoteID, DisplayName: "Last peer"}

	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)
	setupMockServerWithConfig(mockServer)

	mockStore := &mocks.Store{}
	mockChannelStore := mocks.ChannelStore{}
	mockSharedChannelStore := mocks.SharedChannelStore{}
	mockRemoteClusterStore := mocks.RemoteClusterStore{}

	mockServer.On("GetStore").Return(mockStore)
	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
	mockStore.On("RemoteCluster").Return(&mockRemoteClusterStore)

	mockSharedChannelStore.On("GetRemoteByIds", channelID, remoteID).Return(scr, nil).Once()
	mockSharedChannelStore.On("DeleteRemote", scrID).Return(true, nil).Once()
	// Channel load for uninvite system post, then UnshareChannel initial get, then UnshareChannel post-delete get.
	mockChannelStore.On("Get", channelID, true).Return(channel, nil).Times(2)
	mockChannelStore.On("Get", channelID, false).Return(channel, nil).Once()
	mockRemoteClusterStore.On("Get", remoteID, false).Return(rc, nil).Once()

	mockSharedChannelStore.On("GetRemotes", 0, 1, model.SharedChannelRemoteFilterOpts{
		ChannelId:          channelID,
		IncludeUnconfirmed: true,
	}).Return([]*model.SharedChannelRemote{}, nil).Once()
	mockSharedChannelStore.On("GetRemotes", 0, 10000, model.SharedChannelRemoteFilterOpts{
		ChannelId:          channelID,
		IncludeUnconfirmed: true,
	}).Return([]*model.SharedChannelRemote{}, nil).Once()
	mockSharedChannelStore.On("Delete", channelID).Return(true, nil).Once()

	mockApp := &MockAppIface{}
	bot := &model.Bot{UserId: model.NewId()}
	mockApp.On("GetSystemBot", mock.Anything).Return(bot, (*model.AppError)(nil))
	mockApp.On("Publish", mock.Anything).Return()
	mockApp.On("CreatePost", mock.Anything, mock.AnythingOfType("*model.Post"), mock.AnythingOfType("*model.Channel"), mock.Anything).
		Return(&model.Post{}, false, (*model.AppError)(nil))

	scs := &Service{
		server:   mockServer,
		platform: testNoopPlatform{},
		app:      mockApp,
	}

	err := scs.UninviteRemoteFromChannel(channelID, remoteID)
	require.NoError(t, err)

	// One system post from UninviteRemoteFromChannel; UnshareChannel sees no remotes so it does not add more.
	mockApp.AssertNumberOfCalls(t, "CreatePost", 1)
	mockSharedChannelStore.AssertCalled(t, "Delete", channelID)
	mockRemoteClusterStore.AssertExpectations(t)
}
