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
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// noopPlatform implements PlatformIface for API tests that trigger cache invalidation.
type noopPlatform struct{}

func (noopPlatform) InvalidateCacheForUser(userID string) {}

func (noopPlatform) InvalidateCacheForChannel(channel *model.Channel) {}

func TestUnshareChannel_deletesSharedChannelInvitations(t *testing.T) {
	channelID := model.NewId()
	teamID := model.NewId()

	mockServer := &MockServerIface{}
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))
	cfg := model.Config{}
	cfg.SetDefaults()
	mockServer.On("Config").Return(&cfg)

	mockChannelStore := &mocks.ChannelStore{}
	ch := &model.Channel{Id: channelID, TeamId: teamID}
	mockChannelStore.On("Get", channelID, true).Return(ch, nil)
	mockChannelStore.On("Get", channelID, false).Return(ch, nil)

	mockSharedChannelStore := &mocks.SharedChannelStore{}
	mockSharedChannelStore.On("Delete", channelID).Return(true, nil)

	mockInvStore := mocks.NewSharedChannelInvitationStore(t)
	mockInvStore.On("DeleteByChannelId", channelID).Return(nil).Once()

	mockStore := &mocks.Store{}
	mockStore.On("Channel").Return(mockChannelStore)
	mockStore.On("SharedChannel").Return(mockSharedChannelStore)
	mockStore.On("SharedChannelInvitation").Return(mockInvStore)
	mockServer.On("GetStore").Return(mockStore)

	mockApp := &MockAppIface{}
	mockApp.On("Publish", mock.Anything).Return()

	scs := &Service{
		server:   mockServer,
		platform: noopPlatform{},
		app:      mockApp,
	}

	deleted, err := scs.UnshareChannel(channelID)
	require.NoError(t, err)
	assert.True(t, deleted)
}

func TestUnshareChannel_invitationDeleteErrorStillReturnsSuccess(t *testing.T) {
	channelID := model.NewId()

	mockServer := &MockServerIface{}
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))
	cfg := model.Config{}
	cfg.SetDefaults()
	mockServer.On("Config").Return(&cfg)

	mockChannelStore := &mocks.ChannelStore{}
	ch := &model.Channel{Id: channelID}
	mockChannelStore.On("Get", channelID, true).Return(ch, nil)
	mockChannelStore.On("Get", channelID, false).Return(ch, nil)

	mockSharedChannelStore := &mocks.SharedChannelStore{}
	mockSharedChannelStore.On("Delete", channelID).Return(true, nil)

	mockInvStore := mocks.NewSharedChannelInvitationStore(t)
	mockInvStore.On("DeleteByChannelId", channelID).Return(errors.New("db error")).Once()

	mockStore := &mocks.Store{}
	mockStore.On("Channel").Return(mockChannelStore)
	mockStore.On("SharedChannel").Return(mockSharedChannelStore)
	mockStore.On("SharedChannelInvitation").Return(mockInvStore)
	mockServer.On("GetStore").Return(mockStore)

	mockApp := &MockAppIface{}
	mockApp.On("Publish", mock.Anything).Return()

	scs := &Service{
		server:   mockServer,
		platform: noopPlatform{},
		app:      mockApp,
	}

	deleted, err := scs.UnshareChannel(channelID)
	require.NoError(t, err)
	assert.True(t, deleted)
}

func TestUninviteRemoteFromChannel_deletesSharedChannelInvitationsForPair(t *testing.T) {
	channelID := model.NewId()
	remoteID := model.NewId()
	scrID := model.NewId()

	mockServer := &MockServerIface{}
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

	scr := &model.SharedChannelRemote{
		Id:        scrID,
		ChannelId: channelID,
		RemoteId:  remoteID,
		DeleteAt:  0,
	}

	mockSharedChannelStore := &mocks.SharedChannelStore{}
	mockSharedChannelStore.On("GetRemoteByIds", channelID, remoteID).Return(scr, nil)
	mockSharedChannelStore.On("DeleteRemote", scrID).Return(true, nil)
	mockSharedChannelStore.On("GetRemotes", 0, 1, mock.MatchedBy(func(opts model.SharedChannelRemoteFilterOpts) bool {
		return opts.ChannelId == channelID
	})).Return([]*model.SharedChannelRemote{{Id: model.NewId()}}, nil)

	mockInvStore := mocks.NewSharedChannelInvitationStore(t)
	mockInvStore.On("DeleteByChannelIdAndRemoteId", channelID, remoteID).Return(nil).Once()

	mockStore := &mocks.Store{}
	mockStore.On("SharedChannel").Return(mockSharedChannelStore)
	mockStore.On("SharedChannelInvitation").Return(mockInvStore)
	mockServer.On("GetStore").Return(mockStore)

	scs := &Service{
		server: mockServer,
		app:    &MockAppIface{},
	}

	err := scs.UninviteRemoteFromChannel(channelID, remoteID)
	require.NoError(t, err)
}
