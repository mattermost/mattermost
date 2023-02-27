// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
)

func TestOnReceiveChannelInvite(t *testing.T) {
	t.Run("when msg payload is empty, it does nothing", func(t *testing.T) {
		mockServer := &MockServerIface{}
		mockLogger, err := mlog.NewLogger()
		require.NoError(t, err)
		mockServer.On("Log").Return(mockLogger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		mockStore := &mocks.Store{}
		mockServer = scs.server.(*MockServerIface)
		mockServer.On("GetStore").Return(mockStore)

		remoteCluster := &model.RemoteCluster{}
		msg := model.RemoteClusterMsg{}

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.NoError(t, err)
		mockStore.AssertNotCalled(t, "Channel")
	})

	t.Run("when invitation prescribes a readonly channel, it does create a readonly channel", func(t *testing.T) {
		mockServer := &MockServerIface{}
		mockLogger, err := mlog.NewLogger()
		require.NoError(t, err)
		mockServer.On("Log").Return(mockLogger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		mockStore := &mocks.Store{}
		remoteCluster := &model.RemoteCluster{Name: "test"}
		invitation := channelInviteMsg{
			ChannelId: model.NewId(),
			TeamId:    model.NewId(),
			ReadOnly:  true,
			Type:      "0",
		}
		payload, err := json.Marshal(invitation)
		require.NoError(t, err)

		msg := model.RemoteClusterMsg{
			Payload: payload,
		}
		mockChannelStore := mocks.ChannelStore{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		channel := &model.Channel{}

		mockChannelStore.On("Get", invitation.ChannelId, true).Return(channel, nil)
		mockSharedChannelStore.On("Save", mock.Anything).Return(nil, nil)
		mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)

		mockServer = scs.server.(*MockServerIface)
		mockServer.On("GetStore").Return(mockStore)
		createPostPermission := model.ChannelModeratedPermissionsMap[model.PermissionCreatePost.Id]
		createReactionPermission := model.ChannelModeratedPermissionsMap[model.PermissionAddReaction.Id]
		updateMap := model.ChannelModeratedRolesPatch{
			Guests:  model.NewBool(false),
			Members: model.NewBool(false),
		}

		readonlyChannelModerations := []*model.ChannelModerationPatch{
			{
				Name:  &createPostPermission,
				Roles: &updateMap,
			},
			{
				Name:  &createReactionPermission,
				Roles: &updateMap,
			},
		}
		mockApp.On("PatchChannelModerationsForChannel", mock.Anything, channel, readonlyChannelModerations).Return(nil, nil)
		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.NoError(t, err)
	})

	t.Run("when invitation prescribes a readonly channel and readonly update fails, it returns an error", func(t *testing.T) {
		mockServer := &MockServerIface{}
		mockLogger, err := mlog.NewLogger()
		require.NoError(t, err)
		mockServer.On("Log").Return(mockLogger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		mockStore := &mocks.Store{}
		remoteCluster := &model.RemoteCluster{Name: "test2"}
		invitation := channelInviteMsg{
			ChannelId: model.NewId(),
			TeamId:    model.NewId(),
			ReadOnly:  true,
			Type:      "0",
		}
		payload, err := json.Marshal(invitation)
		require.NoError(t, err)

		msg := model.RemoteClusterMsg{
			Payload: payload,
		}
		mockChannelStore := mocks.ChannelStore{}
		channel := &model.Channel{}

		mockChannelStore.On("Get", invitation.ChannelId, true).Return(channel, nil)
		mockStore.On("Channel").Return(&mockChannelStore)

		mockServer = scs.server.(*MockServerIface)
		mockServer.On("GetStore").Return(mockStore)
		appErr := model.NewAppError("foo", "bar", nil, "boom", http.StatusBadRequest)

		mockApp.On("PatchChannelModerationsForChannel", mock.Anything, channel, mock.Anything).Return(nil, appErr)
		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.Error(t, err)
		assert.Equal(t, fmt.Sprintf("cannot make channel readonly `%s`: foo: bar, boom", invitation.ChannelId), err.Error())
	})

	t.Run("when invitation prescribes a direct channel, it does create a direct channel", func(t *testing.T) {
		mockServer := &MockServerIface{}
		mockLogger, err := mlog.NewLogger()
		require.NoError(t, err)
		mockServer.On("Log").Return(mockLogger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		mockStore := &mocks.Store{}
		remoteCluster := &model.RemoteCluster{Name: "test3", CreatorId: model.NewId()}
		invitation := channelInviteMsg{
			ChannelId:            model.NewId(),
			TeamId:               model.NewId(),
			ReadOnly:             false,
			Type:                 model.ChannelTypeDirect,
			DirectParticipantIDs: []string{model.NewId(), model.NewId()},
		}
		payload, err := json.Marshal(invitation)
		require.NoError(t, err)

		msg := model.RemoteClusterMsg{
			Payload: payload,
		}
		mockChannelStore := mocks.ChannelStore{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		channel := &model.Channel{}

		mockChannelStore.On("Get", invitation.ChannelId, true).Return(nil, errors.New("boom"))
		mockSharedChannelStore.On("Save", mock.Anything).Return(nil, nil)
		mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)

		mockServer = scs.server.(*MockServerIface)
		mockServer.On("GetStore").Return(mockStore)

		mockApp.On("GetOrCreateDirectChannel", mock.AnythingOfType("*request.Context"), invitation.DirectParticipantIDs[0], invitation.DirectParticipantIDs[1], mock.AnythingOfType("model.ChannelOption")).Return(channel, nil)
		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.NoError(t, err)
	})
}
