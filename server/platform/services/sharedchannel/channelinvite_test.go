// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

var (
	mockTypeChannel    = mock.AnythingOfType("*model.Channel")
	mockTypeUser       = mock.AnythingOfType("*model.User")
	mockTypeString     = mock.AnythingOfType("string")
	mockTypeReqContext = mock.AnythingOfType("*request.Context")
	mockTypeContext    = mock.MatchedBy(func(ctx context.Context) bool { return true })
)

// setupMockServerWithConfig sets up the standard mocks that all tests need
func setupMockServerWithConfig(mockServer *MockServerIface) {
	mockConfig := model.Config{}
	mockConfig.SetDefaults()
	mockServer.On("Config").Return(&mockConfig)

	mockServer.On("GetRemoteClusterService").Return(nil)
}

// invitationStoreCalls records side effects from mocks.SharedChannelInvitationStore expectations.
type invitationStoreCalls struct {
	saved          []*model.SharedChannelInvitation
	deletedIDs     []string
	updateStatuses []struct {
		id, status, errMsg string
	}
}

// registerSharedChannelInvitationStoreMocks wires storetest mocks for SharedChannelInvitationStore.
// testify invokes RunFn before returning ReturnArguments; mutating *saveReturn in Run updates what callers receive.
func registerSharedChannelInvitationStoreMocks(inv *mocks.SharedChannelInvitationStore, calls *invitationStoreCalls) {
	saveReturn := &model.SharedChannelInvitation{}
	inv.On("Save", mock.AnythingOfType("*model.SharedChannelInvitation")).
		Return(saveReturn, nil).
		Run(func(args mock.Arguments) {
			src := args.Get(0).(*model.SharedChannelInvitation)
			// Mirror SqlSharedChannelInvitationStore.Save: PreSave mutates before persist.
			src.PreSave()
			*saveReturn = *src
			if saveReturn.Id == "" {
				saveReturn.Id = model.NewId()
			}
			cp := *saveReturn
			calls.saved = append(calls.saved, &cp)
		}).Maybe()
	ensureReturn := &model.SharedChannelInvitation{}
	inv.On("EnsurePendingSent", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).
		Return(ensureReturn, nil).
		Run(func(args mock.Arguments) {
			channelID := args.Get(0).(string)
			remoteID := args.Get(1).(string)
			creatorID := args.Get(2).(string)
			invitation := &model.SharedChannelInvitation{
				ChannelId: channelID,
				RemoteId:  remoteID,
				Direction: model.SharedChannelInvitationDirectionSent,
				CreatorId: creatorID,
			}
			invitation.PreSave()
			if invitation.Id == "" {
				invitation.Id = model.NewId()
			}
			*ensureReturn = *invitation
			cp := *ensureReturn
			calls.saved = append(calls.saved, &cp)
		}).Maybe()
	inv.On("GetAllFromMaster", mock.Anything, mock.Anything, mock.Anything).
		Return([]*model.SharedChannelInvitation{}, nil).Maybe()
	inv.On("Delete", mock.AnythingOfType("string")).
		Return(nil).
		Run(func(args mock.Arguments) {
			calls.deletedIDs = append(calls.deletedIDs, args.Get(0).(string))
		}).Maybe()
	inv.On("UpdateStatus", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).
		Return(&model.SharedChannelInvitation{}, nil).
		Run(func(args mock.Arguments) {
			calls.updateStatuses = append(calls.updateStatuses, struct {
				id, status, errMsg string
			}{args.Get(0).(string), args.Get(1).(string), args.Get(2).(string)})
		}).Maybe()
	lookupInvitation := func(id string) (*model.SharedChannelInvitation, error) {
		if slices.Contains(calls.deletedIDs, id) {
			return nil, store.NewErrNotFound("SharedChannelInvitation", id)
		}
		for _, saved := range calls.saved {
			if saved.Id == id {
				cp := *saved
				return &cp, nil
			}
		}
		return nil, store.NewErrNotFound("SharedChannelInvitation", id)
	}
	inv.On("Get", mock.AnythingOfType("string")).Return(lookupInvitation).Maybe()
	inv.On("GetFromMaster", mock.AnythingOfType("string")).Return(lookupInvitation).Maybe()
	inv.On("DeleteByChannelId", mock.AnythingOfType("string")).Return(nil).Maybe()
	inv.On("DeletePendingByChannelIdAndRemoteId", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil).Maybe()
}

// stubRemoteClusterService is a minimal remotecluster.RemoteClusterServiceIFace for SendChannelInvite tests.
//
// SendChannelInvite returns an error when GetRemoteClusterService() is nil, while setupMockServerWithConfig
// intentionally returns nil so NotifyChannelChanged / membership paths stay inert (same pattern as other
// sharedchannel tests). The remotecluster package tests use NewRemoteClusterService with unexported test
// doubles; we cannot reuse those from here, so this stub satisfies the non-nil check. Offline and plugin
// invite paths never need a real send pipeline; SendMsg only invokes a successful callback if provided.
type stubRemoteClusterService struct{}

func (stubRemoteClusterService) Shutdown() error { return nil }
func (stubRemoteClusterService) Start() error    { return nil }
func (stubRemoteClusterService) Active() bool    { return true }
func (stubRemoteClusterService) AddTopicListener(string, remotecluster.TopicListener) string {
	return ""
}
func (stubRemoteClusterService) RemoveTopicListener(string) {}
func (stubRemoteClusterService) AddConnectionStateListener(remotecluster.ConnectionStateListener) string {
	return ""
}
func (stubRemoteClusterService) RemoveConnectionStateListener(string) {}
func (stubRemoteClusterService) SendFile(context.Context, *model.UploadSession, *model.FileInfo, *model.RemoteCluster, remotecluster.ReaderProvider, remotecluster.SendFileResultFunc) error {
	return nil
}
func (stubRemoteClusterService) SendProfileImage(context.Context, string, *model.RemoteCluster, remotecluster.ProfileImageProvider, remotecluster.SendProfileImageResultFunc) error {
	return nil
}
func (stubRemoteClusterService) AcceptInvitation(*model.RemoteClusterInvite, string, string, string, string, string) (*model.RemoteCluster, error) {
	return nil, nil
}
func (stubRemoteClusterService) ReceiveIncomingMsg(*model.RemoteCluster, model.RemoteClusterMsg) remotecluster.Response {
	return remotecluster.Response{}
}
func (stubRemoteClusterService) ReceiveInviteConfirmation(model.RemoteClusterInvite) (*model.RemoteCluster, error) {
	return nil, nil
}
func (stubRemoteClusterService) PingNow(*model.RemoteCluster) {}
func (stubRemoteClusterService) NotifySyncFailed(string)      {}

func (*stubRemoteClusterService) SendMsg(_ context.Context, msg model.RemoteClusterMsg, rc *model.RemoteCluster, f remotecluster.SendMsgResultFunc) error {
	if f != nil {
		f(msg, rc, &remotecluster.Response{Status: remotecluster.ResponseStatusOK}, nil)
	}
	return nil
}

var _ remotecluster.RemoteClusterServiceIFace = (*stubRemoteClusterService)(nil)

func setupMockServerWithRemoteClusterService(mockServer *MockServerIface, rcs remotecluster.RemoteClusterServiceIFace) {
	mockConfig := model.Config{}
	mockConfig.SetDefaults()
	mockServer.On("Config").Return(&mockConfig)
	mockServer.On("GetRemoteClusterService").Return(rcs)
}

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
			Id:        invitation.ChannelId,
			TeamId:    invitation.TeamId,
			Type:      invitation.Type,
			CreatorId: model.NewId(),
		}

		mockSharedChannelStore.On("GetRemoteByIds", invitation.ChannelId, remoteCluster.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockChannelStore.On("Get", invitation.ChannelId, true).Return(nil, &store.ErrNotFound{})
		mockSharedChannelStore.On("Save", mock.Anything).Return(nil, nil)
		mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithConfig(mockServer)

		createPostPermission := model.ChannelModeratedPermissionsMap[model.PermissionCreatePost.Id]
		createReactionPermission := model.ChannelModeratedPermissionsMap[model.PermissionAddReaction.Id]
		updateMap := model.ChannelModeratedRolesPatch{
			Guests:  new(false),
			Members: new(false),
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
		mockApp.On("GetSystemBot", mockTypeReqContext).Return(&model.Bot{UserId: model.NewId()}, nil).Once()
		mockApp.On("CreatePost", mockTypeReqContext, mock.AnythingOfType("*model.Post"), mockTypeChannel, mock.AnythingOfType("model.CreatePostFlags")).Return(&model.Post{Id: model.NewId()}, false, nil).Once()
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
			Id:        invitation.ChannelId,
			TeamId:    invitation.TeamId,
			Type:      invitation.Type,
			CreatorId: model.NewId(),
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
		setupMockServerWithConfig(mockServer)

		mockApp.On("GetSystemBot", mockTypeReqContext).Return(&model.Bot{UserId: model.NewId()}, nil).Once()
		mockApp.On("CreatePost", mockTypeReqContext, mock.AnythingOfType("*model.Post"), mockTypeChannel, mock.AnythingOfType("model.CreatePostFlags")).Return(&model.Post{Id: model.NewId()}, false, nil).Once()
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
			{"invalid remoteid", &model.User{Id: model.NewId(), RemoteId: new("bogus")}, &model.User{Id: model.NewId()}, true, false, true, false},
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
					Id:        invitation.ChannelId,
					CreatorId: model.NewId(),
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
				invCalls := &invitationStoreCalls{}
				invMock := mocks.NewSharedChannelInvitationStore(t)
				registerSharedChannelInvitationStoreMocks(invMock, invCalls)
				mockStore.On("Channel").Return(&mockChannelStore)
				mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
				mockStore.On("User").Return(&mockUserStore)
				mockStore.On("SharedChannelInvitation").Return(invMock)

				mockServer = scs.server.(*MockServerIface)
				mockServer.On("GetStore").Return(mockStore)
				setupMockServerWithConfig(mockServer)

				mockApp.On("GetOrCreateDirectChannel", mockTypeReqContext, mockTypeString, mockTypeString, mock.AnythingOfType("model.ChannelOption")).
					Return(channel, nil).Maybe()
				mockApp.On("UserCanSeeOtherUser", mockTypeReqContext, mockTypeString, mockTypeString).Return(tc.canSee, nil).Maybe()
				mockApp.On("NotifySharedChannelUserUpdate", mockTypeUser).Return().Maybe()
				if tc.expectSuccess {
					mockApp.On("GetSystemBot", mockTypeReqContext).Return(&model.Bot{UserId: model.NewId()}, nil).Once()
					mockApp.On("CreatePost", mockTypeReqContext, mock.AnythingOfType("*model.Post"), mockTypeChannel, mock.AnythingOfType("model.CreatePostFlags")).Return(&model.Post{Id: model.NewId()}, false, nil).Once()
				}

				defer mockApp.AssertExpectations(t)

				err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
				require.Equal(t, tc.expectSuccess, err == nil)
			})
		}
	})
}

func TestOnReceiveChannelInvite_invitationPersistence(t *testing.T) {
	t.Run("saves received invitation then deletes it after successful share", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		creatorID := model.NewId()
		remoteCluster := &model.RemoteCluster{RemoteId: model.NewId(), Name: "test", DefaultTeamId: model.NewId(), CreatorId: creatorID}
		invitation := channelInviteMsg{
			ChannelId: model.NewId(),
			TeamId:    model.NewId(),
			ReadOnly:  false,
			Type:      model.ChannelTypeOpen,
			CreatorID: creatorID,
		}
		payload, err := json.Marshal(invitation)
		require.NoError(t, err)

		msg := model.RemoteClusterMsg{Payload: payload}
		mockChannelStore := mocks.ChannelStore{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		channel := &model.Channel{
			Id:     invitation.ChannelId,
			TeamId: invitation.TeamId,
			Type:   invitation.Type,
		}

		invCalls := &invitationStoreCalls{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, invCalls)
		mockStore := &mocks.Store{}
		mockSharedChannelStore.On("GetRemoteByIds", invitation.ChannelId, remoteCluster.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockChannelStore.On("Get", invitation.ChannelId, true).Return(nil, &store.ErrNotFound{})
		mockSharedChannelStore.On("Save", mock.Anything).Return(nil, nil)
		mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithConfig(mockServer)

		mockApp.On("CreateChannelWithUser", mockTypeReqContext, mockTypeChannel, mockTypeString).Return(channel, nil)
		bot := &model.Bot{UserId: model.NewId()}
		mockApp.On("GetSystemBot", mock.Anything).Return(bot, (*model.AppError)(nil))
		mockApp.On("CreatePost", mock.Anything, mock.AnythingOfType("*model.Post"), mock.AnythingOfType("*model.Channel"), mock.Anything).
			Return(&model.Post{}, false, (*model.AppError)(nil))
		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.NoError(t, err)

		require.Len(t, invCalls.saved, 1)
		assert.Equal(t, model.SharedChannelInvitationDirectionReceived, invCalls.saved[0].Direction)
		assert.Equal(t, invitation.ChannelId, invCalls.saved[0].ChannelId)
		assert.Equal(t, remoteCluster.RemoteId, invCalls.saved[0].RemoteId)
		require.Len(t, invCalls.deletedIDs, 1)
		assert.Equal(t, invCalls.saved[0].Id, invCalls.deletedIDs[0])
	})

	t.Run("marks received invitation failed when channel already exists locally", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		creatorID := model.NewId()
		remoteCluster := &model.RemoteCluster{RemoteId: model.NewId(), Name: "test", CreatorId: creatorID}
		invitation := channelInviteMsg{
			ChannelId: model.NewId(),
			Type:      model.ChannelTypeOpen,
			CreatorID: creatorID,
		}
		payload, err := json.Marshal(invitation)
		require.NoError(t, err)

		msg := model.RemoteClusterMsg{Payload: payload}
		mockChannelStore := mocks.ChannelStore{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		existing := &model.Channel{Id: invitation.ChannelId, Type: model.ChannelTypeOpen}

		invCalls := &invitationStoreCalls{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, invCalls)
		mockStore := &mocks.Store{}
		mockSharedChannelStore.On("GetRemoteByIds", invitation.ChannelId, remoteCluster.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockChannelStore.On("Get", invitation.ChannelId, true).Return(existing, nil)
		mockStore.On("Channel").Return(&mockChannelStore)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithConfig(mockServer)
		defer mockApp.AssertExpectations(t)

		err = scs.onReceiveChannelInvite(msg, remoteCluster, nil)
		require.Error(t, err)

		require.Len(t, invCalls.saved, 1)
		assert.Equal(t, model.SharedChannelInvitationDirectionReceived, invCalls.saved[0].Direction)
		require.Len(t, invCalls.updateStatuses, 1)
		assert.Equal(t, model.SharedChannelInvitationStatusFailed, invCalls.updateStatuses[0].status)
		assert.Equal(t, model.ErrChannelAlreadyExists.Error(), invCalls.updateStatuses[0].errMsg)
	})
}

func TestSendChannelInvite_ExistingSharedConnection(t *testing.T) {
	channelID := model.NewId()
	userID := model.NewId()
	remoteID := model.NewId()
	sharedChannel := &model.SharedChannel{ChannelId: channelID}
	channel := &model.Channel{Id: channelID}
	// Remote with LastPingAt 0 is offline (IsOnline() returns false)
	rc := &model.RemoteCluster{RemoteId: remoteID, Name: "test-remote", DisplayName: "Test Remote", LastPingAt: 0}

	t.Run("when remote is offline and existing connection is not soft deleted, returns ErrChannelAlreadyShared", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{server: mockServer, app: mockApp}

		mockStore := &mocks.Store{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, &invitationStoreCalls{})
		mockStore.On("SharedChannelInvitation").Return(invMock)
		existingScr := &model.SharedChannelRemote{
			ChannelId: channelID,
			RemoteId:  remoteID,
			DeleteAt:  0, // not soft deleted -> already connected
		}

		mockSharedChannelStore.On("Get", channelID).Return(sharedChannel, nil)
		mockSharedChannelStore.On("GetRemoteByIds", channelID, remoteID).Return(existingScr, nil)
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("GetRemoteClusterService").Return(&stubRemoteClusterService{})
		mockApp.On("SendEphemeralPost", mockTypeReqContext, userID, mock.MatchedBy(func(post *model.Post) bool {
			return post != nil && post.ChannelId == channelID && post.Message != ""
		})).Return(nil, true).Once()

		err := scs.SendChannelInvite(channel, userID, rc)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrChannelAlreadyShared)
		mockApp.AssertExpectations(t)
	})

	t.Run("when remote is offline and existing connection is soft deleted, restores and succeeds", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{server: mockServer, app: mockApp}

		mockStore := &mocks.Store{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, &invitationStoreCalls{})
		mockStore.On("SharedChannelInvitation").Return(invMock)
		existingScr := &model.SharedChannelRemote{
			ChannelId: channelID,
			RemoteId:  remoteID,
			DeleteAt:  12345, // soft deleted
		}

		mockSharedChannelStore.On("Get", channelID).Return(sharedChannel, nil)
		mockSharedChannelStore.On("GetRemoteByIds", channelID, remoteID).Return(existingScr, nil)
		mockSharedChannelStore.On("UpdateRemote", mock.MatchedBy(func(scr *model.SharedChannelRemote) bool {
			return scr.ChannelId == channelID && scr.RemoteId == remoteID && scr.DeleteAt == 0 && scr.CreatorId == userID &&
				scr.IsInviteAccepted && !scr.IsInviteConfirmed && scr.LastMembersSyncAt == 0
		})).Return(nil, nil).Once()
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("GetRemoteClusterService").Return(&stubRemoteClusterService{})

		err := scs.SendChannelInvite(channel, userID, rc)
		require.NoError(t, err)
		mockSharedChannelStore.AssertExpectations(t)
	})

	t.Run("when remote is offline and no existing connection, saves new and succeeds", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{server: mockServer, app: mockApp}

		mockStore := &mocks.Store{}
		mockSharedChannelStore := mocks.SharedChannelStore{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, &invitationStoreCalls{})
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockSharedChannelStore.On("Get", channelID).Return(sharedChannel, nil)
		mockSharedChannelStore.On("GetRemoteByIds", channelID, remoteID).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockSharedChannelStore.On("SaveRemote", mock.MatchedBy(func(scr *model.SharedChannelRemote) bool {
			return scr.ChannelId == channelID && scr.RemoteId == remoteID && scr.CreatorId == userID &&
				scr.IsInviteAccepted && !scr.IsInviteConfirmed
		})).Return(nil, nil).Once()
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("GetRemoteClusterService").Return(&stubRemoteClusterService{})

		err := scs.SendChannelInvite(channel, userID, rc)
		require.NoError(t, err)
		mockSharedChannelStore.AssertExpectations(t)
	})
}

func TestSendChannelInvite_invitationPersistence(t *testing.T) {
	t.Run("plugin remote saves pending invitation then deletes after confirm", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server:       mockServer,
			app:          mockApp,
			changeSignal: make(chan struct{}, 1),
			tasks:        make(map[string]syncTask),
		}

		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Name: "town-square", Type: model.ChannelTypeOpen}
		userID := model.NewId()
		rc := &model.RemoteCluster{
			RemoteId:      model.NewId(),
			PluginID:      "com.example.plugin",
			CreatorId:     userID,
			LastPingAt:    model.GetMillis(),
			DisplayName:   "Plugin",
			DefaultTeamId: channel.TeamId,
		}
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			ReadOnly:         false,
			ShareDisplayName: "Shared",
			ShareHeader:      "H",
			SharePurpose:     "P",
		}

		invCalls := &invitationStoreCalls{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, invCalls)
		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockSharedChannelStore.On("Get", channel.Id).Return(sc, nil)
		mockSharedChannelStore.On("GetRemoteByIds", channel.Id, rc.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockSharedChannelStore.On("SaveRemote", mock.MatchedBy(func(scr *model.SharedChannelRemote) bool {
			return scr.ChannelId == channel.Id && scr.RemoteId == rc.RemoteId && scr.IsInviteConfirmed && scr.IsInviteAccepted
		})).Return(nil, nil)

		mockStore := &mocks.Store{}
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithRemoteClusterService(mockServer, &stubRemoteClusterService{})

		bot := &model.Bot{UserId: model.NewId()}
		mockApp.On("Publish", mock.Anything).Return()
		mockApp.On("GetSystemBot", mock.Anything).Return(bot, (*model.AppError)(nil))
		mockApp.On("CreatePost", mock.Anything, mock.AnythingOfType("*model.Post"), mock.AnythingOfType("*model.Channel"), mock.Anything).
			Return(&model.Post{}, false, (*model.AppError)(nil))
		defer mockApp.AssertExpectations(t)

		err := scs.SendChannelInvite(channel, userID, rc)
		require.NoError(t, err)

		require.Len(t, invCalls.saved, 1)
		assert.Equal(t, model.SharedChannelInvitationDirectionSent, invCalls.saved[0].Direction)
		assert.Equal(t, model.SharedChannelInvitationStatusPending, invCalls.saved[0].Status)
		require.Len(t, invCalls.deletedIDs, 1)
		assert.Equal(t, invCalls.saved[0].Id, invCalls.deletedIDs[0])
	})

	t.Run("withdrawn invitation is not confirmed when remote responds", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server:       mockServer,
			app:          mockApp,
			changeSignal: make(chan struct{}, 1),
			tasks:        make(map[string]syncTask),
		}

		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Name: "town-square", Type: model.ChannelTypeOpen}
		userID := model.NewId()
		rc := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			CreatorId:   userID,
			LastPingAt:  model.GetMillis(),
			DisplayName: "Online",
		}
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			ShareDisplayName: "Shared",
			ShareHeader:      "H",
			SharePurpose:     "P",
		}

		invitationID := model.NewId()
		pendingInv := &model.SharedChannelInvitation{
			Id:        invitationID,
			ChannelId: channel.Id,
			RemoteId:  rc.RemoteId,
			Direction: model.SharedChannelInvitationDirectionSent,
			Status:    model.SharedChannelInvitationStatusPending,
			CreatorId: userID,
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
		}

		invMock := mocks.NewSharedChannelInvitationStore(t)
		invMock.On("EnsurePendingSent", channel.Id, rc.RemoteId, userID).Return(pendingInv, nil).Once()
		invMock.On("GetFromMaster", invitationID).Return(nil, store.NewErrNotFound("SharedChannelInvitation", invitationID)).Once()

		mockSharedChannelStore := mocks.SharedChannelStore{}
		mockSharedChannelStore.On("Get", channel.Id).Return(sc, nil)

		mockStore := &mocks.Store{}
		mockStore.On("SharedChannel").Return(&mockSharedChannelStore)
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithRemoteClusterService(mockServer, &stubRemoteClusterService{})

		err := scs.SendChannelInvite(channel, userID, rc)
		require.NoError(t, err)

		mockSharedChannelStore.AssertNotCalled(t, "SaveRemote", mock.Anything)
		mockSharedChannelStore.AssertNotCalled(t, "UpdateRemote", mock.Anything)
		mockApp.AssertNotCalled(t, "Publish", mock.Anything)
	})

	t.Run("offline remote queues pending invitation when none exists", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}
		userID := model.NewId()
		rc := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			CreatorId:   userID,
			LastPingAt:  0,
			DisplayName: "Offline",
		}
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			ShareDisplayName: "d",
			ShareHeader:      "h",
			SharePurpose:     "p",
		}

		invCalls := &invitationStoreCalls{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, invCalls)
		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockSharedChannelStore.On("Get", channel.Id).Return(sc, nil)
		mockSharedChannelStore.On("GetRemoteByIds", channel.Id, rc.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, nil)

		mockStore := &mocks.Store{}
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithRemoteClusterService(mockServer, &stubRemoteClusterService{})

		err := scs.SendChannelInvite(channel, userID, rc)
		require.NoError(t, err)

		require.Len(t, invCalls.saved, 1)
		assert.Equal(t, model.SharedChannelInvitationDirectionSent, invCalls.saved[0].Direction)
		assert.Equal(t, model.SharedChannelInvitationStatusPending, invCalls.saved[0].Status)
		assert.Empty(t, invCalls.deletedIDs)
	})

	t.Run("offline remote does not insert a second invitation when pending already exists", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}
		userID := model.NewId()
		rc := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			CreatorId:   userID,
			LastPingAt:  0,
			DisplayName: "Offline",
		}
		sc := &model.SharedChannel{ChannelId: channel.Id, ShareDisplayName: "d", ShareHeader: "h", SharePurpose: "p"}

		existingPending := &model.SharedChannelInvitation{
			Id:        model.NewId(),
			ChannelId: channel.Id,
			RemoteId:  rc.RemoteId,
			Direction: model.SharedChannelInvitationDirectionSent,
			Status:    model.SharedChannelInvitationStatusPending,
			CreatorId: userID,
			CreateAt:  1,
			UpdateAt:  1,
		}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		invMock.On("EnsurePendingSent", channel.Id, rc.RemoteId, userID).Return(existingPending, nil).Once()

		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockSharedChannelStore.On("Get", channel.Id).Return(sc, nil)
		mockSharedChannelStore.On("GetRemoteByIds", channel.Id, rc.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, nil)

		mockStore := &mocks.Store{}
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithRemoteClusterService(mockServer, &stubRemoteClusterService{})

		err := scs.SendChannelInvite(channel, userID, rc)
		require.NoError(t, err)

		invMock.AssertExpectations(t)
	})

	t.Run("offline remote save remote failure persists generic error and logs detail", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		var logs mlog.Buffer
		require.NoError(t, mlog.AddWriterTarget(logger, &logs, false, mlog.MlvlAll...))
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}
		userID := model.NewId()
		rc := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			CreatorId:   userID,
			LastPingAt:  0,
			DisplayName: "Offline",
		}
		sc := &model.SharedChannel{
			ChannelId:        channel.Id,
			ShareDisplayName: "d",
			ShareHeader:      "h",
			SharePurpose:     "p",
		}
		dbErr := errors.New("pq: duplicate key value violates unique constraint sharedchannelremotes_pkey")

		invCalls := &invitationStoreCalls{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, invCalls)
		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockSharedChannelStore.On("Get", channel.Id).Return(sc, nil)
		mockSharedChannelStore.On("GetRemoteByIds", channel.Id, rc.RemoteId).Return(nil, store.NewErrNotFound("SharedChannelRemote", ""))
		mockSharedChannelStore.On("SaveRemote", mock.Anything).Return(nil, dbErr).Once()

		mockStore := &mocks.Store{}
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithRemoteClusterService(mockServer, &stubRemoteClusterService{})

		mockApp.On("SendEphemeralPost", mockTypeReqContext, userID, mock.AnythingOfType("*model.Post")).Return(nil, false)
		defer mockApp.AssertExpectations(t)

		err := scs.SendChannelInvite(channel, userID, rc)
		require.ErrorIs(t, err, dbErr)

		require.Len(t, invCalls.saved, 1)
		assert.Equal(t, model.SharedChannelInvitationStatusFailed, invCalls.saved[0].Status)
		assert.Equal(t, invitationInternalErrorMsg, invCalls.saved[0].ErrMsg)
		assert.Eventually(t, func() bool {
			return strings.Contains(logs.String(), "failed to save shared channel remote while sending invite") &&
				strings.Contains(logs.String(), dbErr.Error())
		}, time.Second, 10*time.Millisecond)
	})

	t.Run("offline remote with invite options persists failed invitation only", func(t *testing.T) {
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockApp := &MockAppIface{}
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}
		userID := model.NewId()
		rc := &model.RemoteCluster{
			RemoteId:    model.NewId(),
			CreatorId:   userID,
			LastPingAt:  0,
			DisplayName: "Offline",
		}
		sc := &model.SharedChannel{ChannelId: channel.Id, ShareDisplayName: "d", ShareHeader: "h", SharePurpose: "p"}
		otherUser := &model.User{Id: model.NewId()}

		invCalls := &invitationStoreCalls{}
		invMock := mocks.NewSharedChannelInvitationStore(t)
		registerSharedChannelInvitationStoreMocks(invMock, invCalls)
		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockSharedChannelStore.On("Get", channel.Id).Return(sc, nil)

		mockStore := &mocks.Store{}
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("SharedChannelInvitation").Return(invMock)

		mockServer.On("GetStore").Return(mockStore)
		setupMockServerWithRemoteClusterService(mockServer, &stubRemoteClusterService{})

		mockApp.On("SendEphemeralPost", mockTypeReqContext, userID, mock.AnythingOfType("*model.Post")).Return(nil, false)
		defer mockApp.AssertExpectations(t)

		err := scs.SendChannelInvite(channel, userID, rc, WithCreator(model.NewId()), WithDirectParticipant(otherUser, rc.RemoteId))
		require.ErrorIs(t, err, model.ErrOfflineRemote)

		require.Len(t, invCalls.saved, 1)
		assert.Equal(t, model.SharedChannelInvitationStatusFailed, invCalls.saved[0].Status)
		assert.Equal(t, model.SharedChannelInvitationDirectionSent, invCalls.saved[0].Direction)
		mockSharedChannelStore.AssertNotCalled(t, "SaveRemote")
	})
}
