// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

var (
	mockTypeChannel    = mock.AnythingOfType("*model.Channel")
	mockTypeUser       = mock.AnythingOfType("*model.User")
	mockTypeString     = mock.AnythingOfType("string")
	mockTypeReqContext = mock.AnythingOfType("*request.Context")
	mockTypeContext    = mock.MatchedBy(func(ctx context.Context) bool { return true })
)

func TestOnReceiveChannelInvite(t *testing.T) {
	t.Run("when msg payload is empty, it does nothing", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
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

		err := scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.NoError(t, err)
		mockStore.AssertNotCalled(t, "Channel")
	})

	t.Run("when invitation prescribes a readonly channel, it does create a readonly channel", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		mockStore := &mocks.Store{}
		remoteCluster := &model.RemoteCluster{RemoteId: model.NewId(), Name: "test", DefaultTeamId: model.NewId()}
		invitation := channelInviteMsg{
			ChannelId: model.NewId(),
			TeamId:    model.NewId(),
			ReadOnly:  true,
			Type:      model.ChannelTypeOpen,
		}
		payload, err := json.Marshal(invitation)
		require.NoError(t, err)

		msg := model.RemoteClusterMsg{
			Payload: payload,
		}
		mockChannelStore := mocks.ChannelStore{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		channel := &model.Channel{
			Id:     invitation.ChannelId,
			TeamId: invitation.TeamId,
			Type:   invitation.Type,
		}

		mockSharedChannelStore.On("GetRemoteByIds", invitation.ChannelId, remoteCluster.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockChannelStore.On("Get", invitation.ChannelId, true).Return(nil, &store.ErrNotFound{})
		mockSharedChannelStore.On("Save", mock.Anything).Return(nil, nil)
		mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)

		mockServer.On("GetStore").Return(mockStore)
		createPostPermission := model.ChannelModeratedPermissionsMap[model.PermissionCreatePost.Id]
		createReactionPermission := model.ChannelModeratedPermissionsMap[model.PermissionAddReaction.Id]
		updateMap := model.ChannelModeratedRolesPatch{
			Guests:  model.NewPointer(false),
			Members: model.NewPointer(false),
		}

		mockApp.On("CreateChannelWithUser", mockTypeReqContext, mockTypeChannel, mockTypeString).Return(channel, nil)

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
		mockApp.On("PatchChannelModerationsForChannel", mock.Anything, channel, readonlyChannelModerations).Return(nil, nil).Maybe()
		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.NoError(t, err)
	})

	t.Run("when invitation prescribes a readonly channel and readonly update fails, it returns an error", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		mockStore := &mocks.Store{}
		remoteCluster := &model.RemoteCluster{RemoteId: model.NewId(), Name: "test2"}
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
		channel := &model.Channel{
			Id: invitation.ChannelId,
		}
		mockTeamStore := mocks.TeamStore{}
		team := &model.Team{
			Id: model.NewId(),
		}
		mockSharedChannelStore := mocks.SharedChannelStore{}

		mockSharedChannelStore.On("GetRemoteByIds", invitation.ChannelId, remoteCluster.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockChannelStore.On("Get", invitation.ChannelId, true).Return(nil, &store.ErrNotFound{})
		mockTeamStore.On("GetAllPage", 0, 1, mock.Anything).Return([]*model.Team{team}, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockStore.On("Team").Return(&mockTeamStore)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)

		mockServer = scs.server.(*MockServerIface)
		mockServer.On("GetStore").Return(mockStore)
		appErr := model.NewAppError("foo", "bar", nil, "boom", http.StatusBadRequest)

		mockApp.On("CreateChannelWithUser", mockTypeReqContext, mockTypeChannel, mockTypeString).Return(channel, nil)
		mockApp.On("PatchChannelModerationsForChannel", mock.Anything, channel, mock.Anything).Return(nil, appErr)
		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.Error(t, err)
		assert.Equal(t, fmt.Sprintf("cannot make channel readonly `%s`: foo: bar, boom", invitation.ChannelId), err.Error())
	})

	t.Run("When invitation points to a deleted shared channel remote", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		mockStore := &mocks.Store{}
		remoteCluster := &model.RemoteCluster{RemoteId: model.NewId(), Name: "test", DefaultTeamId: model.NewId()}
		invitation := channelInviteMsg{
			ChannelId: model.NewId(),
			TeamId:    model.NewId(),
			Type:      model.ChannelTypeOpen,
		}
		payload, err := json.Marshal(invitation)
		require.NoError(t, err)

		msg := model.RemoteClusterMsg{
			Payload: payload,
		}
		mockChannelStore := mocks.ChannelStore{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		channel := &model.Channel{
			Id:     invitation.ChannelId,
			TeamId: invitation.TeamId,
			Type:   invitation.Type,
		}
		sharedChannelRemote := &model.SharedChannelRemote{
			ChannelId: invitation.ChannelId,
			RemoteId:  remoteCluster.RemoteId,
			DeleteAt:  1234,
		}

		mockSharedChannelStore.On("GetRemoteByIds", invitation.ChannelId, mock.Anything).Return(sharedChannelRemote, nil)
		mockChannelStore.On("Get", invitation.ChannelId, true).Return(channel, nil)
		mockSharedChannelStore.On("Save", mock.Anything).Return(nil, nil)
		mockSharedChannelStore.On("UpdateRemote", mock.Anything).Return(nil, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)

		mockServer.On("GetStore").Return(mockStore)
		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.NoError(t, err)
	})

	t.Run("When invitation points to an existing shared channel remote", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		mockStore := &mocks.Store{}
		remoteCluster := &model.RemoteCluster{RemoteId: model.NewId(), Name: "test", DefaultTeamId: model.NewId()}
		invitation := channelInviteMsg{
			ChannelId: model.NewId(),
			TeamId:    model.NewId(),
			Type:      model.ChannelTypeOpen,
		}
		payload, err := json.Marshal(invitation)
		require.NoError(t, err)

		msg := model.RemoteClusterMsg{
			Payload: payload,
		}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		sharedChannelRemote := &model.SharedChannelRemote{
			ChannelId: invitation.ChannelId,
			RemoteId:  remoteCluster.RemoteId,
			DeleteAt:  0,
		}

		mockServer.On("GetStore").Return(mockStore)
		mockSharedChannelStore.On("GetRemoteByIds", invitation.ChannelId, remoteCluster.RemoteId).Return(sharedChannelRemote, nil)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)

		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.NoError(t, err)
	})

	t.Run("DM channels", func(t *testing.T) {
		var testRemoteID = model.NewId()
		testCases := []struct {
			desc                string
			user1               *model.User
			user2               *model.User
			canSee              bool
			expectSuccess       bool
			user2InDB           bool
			user2InParticipants bool
		}{
			{"valid users", &model.User{Id: model.NewId(), RemoteId: &testRemoteID}, &model.User{Id: model.NewId()}, true, true, true, false},
			{"swapped users", &model.User{Id: model.NewId()}, &model.User{Id: model.NewId(), RemoteId: &testRemoteID}, true, true, true, false},
			{"two remotes", &model.User{Id: model.NewId(), RemoteId: &testRemoteID}, &model.User{Id: model.NewId(), RemoteId: &testRemoteID}, true, false, true, false},
			{"two locals", &model.User{Id: model.NewId()}, &model.User{Id: model.NewId()}, true, false, true, false},
			{"can't see", &model.User{Id: model.NewId(), RemoteId: &testRemoteID}, &model.User{Id: model.NewId()}, false, false, true, false},
			{"invalid remoteid", &model.User{Id: model.NewId(), RemoteId: model.NewPointer("bogus")}, &model.User{Id: model.NewId()}, true, false, true, false},
			{"user2 not in DB but in participants", &model.User{Id: model.NewId(), RemoteId: &testRemoteID}, &model.User{Id: model.NewId()}, true, true, false, true},
			{"user2 not in DB and not in participants", &model.User{Id: model.NewId(), RemoteId: &testRemoteID}, &model.User{Id: model.NewId()}, true, false, false, false},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				mockServer := &MockServerIface{}
				logger := mlog.CreateConsoleTestLogger(t)
				mockServer.On("Log").Return(logger)
				mockApp := &MockAppIface{}
				scs := &Service{
					server: mockServer,
					app:    mockApp,
				}

				mockStore := &mocks.Store{}
				remoteCluster := &model.RemoteCluster{RemoteId: testRemoteID, Name: "test3", CreatorId: model.NewId()}
				invitation := channelInviteMsg{
					ChannelId:            model.NewId(),
					TeamId:               model.NewId(),
					ReadOnly:             false,
					Type:                 model.ChannelTypeDirect,
					DirectParticipantIDs: []string{tc.user1.Id, tc.user2.Id},
				}

				// Add participants to the invitation if needed
				if tc.user2InParticipants {
					invitation.DirectParticipants = append(invitation.DirectParticipants, tc.user2)
				}

				payload, err := json.Marshal(invitation)
				require.NoError(t, err)

				msg := model.RemoteClusterMsg{
					Payload: payload,
				}
				mockChannelStore := mocks.ChannelStore{}
				mockSharedChannelStore := mocks.SharedChannelStore{}
				channel := &model.Channel{
					Id: invitation.ChannelId,
				}

				mockUserStore := mocks.UserStore{}
				mockUserStore.On("Get", mockTypeContext, tc.user1.Id).
					Return(tc.user1, nil)
				if tc.user2InDB {
					mockUserStore.On("Get", mockTypeContext, tc.user2.Id).
						Return(tc.user2, nil)
				} else {
					mockUserStore.On("Get", mockTypeContext, tc.user2.Id).
						Return(nil, &store.ErrNotFound{})
				}

				if tc.user2InParticipants {
					mockUserStore.On("Save", mock.AnythingOfType("*request.Context"),
						mock.MatchedBy(func(u *model.User) bool {
							return u.Id == tc.user2.Id
						})).Return(tc.user2, nil)
				}

				mockChannelStore.On("Get", invitation.ChannelId, true).Return(nil, errors.New("boom"))
				mockChannelStore.On("GetByName", "", mockTypeString, true).Return(nil, &store.ErrNotFound{})

				mockSharedChannelStore.On("GetRemoteByIds", invitation.ChannelId, remoteCluster.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
				mockSharedChannelStore.On("Save", mock.Anything).Return(nil, nil)
				mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, nil)
				mockStore.On("Channel").Return(&mockChannelStore)
				mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
				mockStore.On("User").Return(&mockUserStore)

				mockServer = scs.server.(*MockServerIface)
				mockServer.On("GetStore").Return(mockStore)

				mockApp.On("GetOrCreateDirectChannel", mockTypeReqContext, mockTypeString, mockTypeString, mock.AnythingOfType("model.ChannelOption")).
					Return(channel, nil).Maybe()
				mockApp.On("UserCanSeeOtherUser", mockTypeReqContext, mockTypeString, mockTypeString).Return(tc.canSee, nil).Maybe()
				mockApp.On("NotifySharedChannelUserUpdate", mockTypeUser).Return().Maybe()

				defer mockApp.AssertExpectations(t)

				err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
				require.Equal(t, tc.expectSuccess, err == nil)
			})
		}
	})
}
