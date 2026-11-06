// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

type remoteEmailTestPlatform struct{}

func (*remoteEmailTestPlatform) InvalidateCacheForUser(string)            {}
func (*remoteEmailTestPlatform) InvalidateCacheForChannel(*model.Channel) {}

func TestUpsertSyncUserUpdatesRemoteEmail(t *testing.T) {
	cases := []struct {
		name                 string
		forwarded            bool
		forwardedEmailUpdate bool
		wantEmail            string
	}{
		{
			name:      "origin server updates email",
			wantEmail: "alice@blocked.example",
		},
		{
			name:      "forwarded user preserves original email",
			forwarded: true,
			wantEmail: "alice@allowed.example",
		},
		{
			name:                 "forwarded original email update",
			forwarded:            true,
			forwardedEmailUpdate: true,
			wantEmail:            "alice@blocked.example",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			remoteID := model.NewId()
			oldEmail := "alice@allowed.example"
			newEmail := "alice@blocked.example"

			existing := &model.User{
				Id:       model.NewId(),
				Username: "alice:test-remote",
				Email:    model.NewId(),
				RemoteId: &remoteID,
				Props: model.StringMap{
					model.UserPropsKeyRemoteEmail:    oldEmail,
					model.UserPropsKeyRemoteUsername: "alice",
				},
			}

			incoming := &model.User{
				Id:       existing.Id,
				Username: "alice",
				Email:    newEmail,
			}

			if tc.forwarded {
				originID := model.NewId()
				incoming.RemoteId = &originID
				incoming.Email = model.NewId() // Synthetic email from an intermediate cluster
				incoming.Props = model.StringMap{
					model.UserPropsKeyRemoteEmail:      oldEmail,
					model.UserPropsKeyOriginalRemoteId: originID,
				}
				existing.SetProp(model.UserPropsKeyOriginalRemoteId, originID)

				if tc.forwardedEmailUpdate {
					incoming.Props = model.StringMap{
						model.UserPropsKeyRemoteEmail:      newEmail,
						model.UserPropsKeyOriginalRemoteId: originID,
					}
				}
			}

			userStore := &mocks.UserStore{}
			userStore.On("Get", mock.Anything, existing.Id).
				Return(existing, nil)
			userStore.On("Update", mock.Anything, mock.Anything, false).
				Return(&model.UserUpdate{New: existing}, nil)

			mockStore := &mocks.Store{}
			mockStore.On("User").Return(userStore)

			mockServer := &MockServerIface{}
			mockServer.On("GetStore").Return(mockStore)
			mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

			mockApp := &MockAppIface{}
			mockApp.On("NotifySharedChannelUserUpdate", mock.Anything).Return()

			scs := &Service{
				server:   mockServer,
				platform: &remoteEmailTestPlatform{},
				app:      mockApp,
			}

			rc := &model.RemoteCluster{
				RemoteId: remoteID,
				Name:     "test-remote",
			}

			saved, err := scs.upsertSyncUser(
				request.TestContext(t), incoming, nil, rc,
			)
			require.NoError(t, err)

			actualEmail, _ := saved.GetProp(model.UserPropsKeyRemoteEmail)
			require.Equal(t, tc.wantEmail, actualEmail)
			if tc.forwarded {
				originalID, _ := saved.GetProp(model.UserPropsKeyOriginalRemoteId)
				require.Equal(t, *incoming.RemoteId, originalID)
			}
		})
	}
}

func TestUpsertSyncUserInsertRemoteEmail(t *testing.T) {
	cases := []struct {
		name                 string
		forwarded            bool
		inconsistentOriginID bool
	}{
		{
			name: "direct insert preserves original email",
		},
		{
			name:      "forwarded insert preserves original email",
			forwarded: true,
		},
		{
			name:                 "inconsistent origin metadata does not replace email",
			forwarded:            true,
			inconsistentOriginID: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			remoteID := model.NewId()
			originID := model.NewId()
			userID := model.NewId()
			originalEmail := "alice@allowed.example"

			incoming := &model.User{
				Id:       userID,
				Username: "alice",
				Email:    originalEmail,
			}

			if tc.forwarded {
				incoming.Username = "alice:origin"
				incoming.Email = model.NewId()
				incoming.RemoteId = &originID
				incoming.Props = model.StringMap{
					model.UserPropsKeyRemoteEmail:      originalEmail,
					model.UserPropsKeyOriginalRemoteId: originID,
					model.UserPropsKeyRemoteUsername:   "alice",
				}
			}

			if tc.inconsistentOriginID {
				incoming.SetProp(model.UserPropsKeyOriginalRemoteId, remoteID)
			}

			userStore := &mocks.UserStore{}
			userStore.On("Get", mock.Anything, userID).
				Return(nil, store.NewErrNotFound("User", userID))
			userStore.On("Save", mock.Anything, mock.Anything).
				Return(incoming, nil)

			mockStore := &mocks.Store{}
			mockStore.On("User").Return(userStore)

			mockServer := &MockServerIface{}
			mockServer.On("GetStore").Return(mockStore)
			mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

			mockApp := &MockAppIface{}
			mockApp.On("NotifySharedChannelUserUpdate", mock.Anything).Return()

			scs := &Service{
				server: mockServer,
				app:    mockApp,
			}

			rc := &model.RemoteCluster{
				RemoteId: remoteID,
				Name:     "test-remote",
			}

			saved, err := scs.upsertSyncUser(
				request.TestContext(t), incoming, nil, rc,
			)
			require.NoError(t, err)

			actualEmail, _ := saved.GetProp(model.UserPropsKeyRemoteEmail)
			require.Equal(t, originalEmail, actualEmail)

			if !tc.forwarded {
				originalRemoteID, _ := saved.GetProp(
					model.UserPropsKeyOriginalRemoteId,
				)
				require.Equal(t, remoteID, originalRemoteID)
			}
		})
	}
}

func TestGetOrCreateUserPreservesRemoteEmailFromInvite(t *testing.T) {
	cases := []struct {
		name          string
		existingEmail string
		forwarded     bool
		wantEmail     string
	}{
		{
			name:      "direct invitation stores original email",
			wantEmail: "alice@allowed.example",
		},
		{
			name:          "origin email overrides stale RemoteEmail",
			existingEmail: "alice@original.example",
			wantEmail:     "alice@allowed.example",
		},
		{
			name:          "forwarded invitation preserves original email",
			existingEmail: "alice@original.example",
			forwarded:     true,
			wantEmail:     "alice@original.example",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			remoteID := model.NewId()
			userID := model.NewId()

			inviteUser := &model.User{
				Id:       userID,
				Username: "alice",
				Email:    "alice@allowed.example",
			}
			if tc.existingEmail != "" {
				inviteUser.SetProp(model.UserPropsKeyRemoteEmail, tc.existingEmail)
			}
			if tc.forwarded {
				originID := model.NewId()
				inviteUser.RemoteId = &originID
				inviteUser.Email = model.NewId()
			}

			userStore := &mocks.UserStore{}
			userStore.On("Get", mock.Anything, userID).
				Return(nil, store.NewErrNotFound("User", userID))
			userStore.On("Save", mock.Anything, mock.Anything).
				Return(inviteUser, nil)

			mockStore := &mocks.Store{}
			mockStore.On("User").Return(userStore)

			mockServer := &MockServerIface{}
			mockServer.On("GetStore").Return(mockStore)
			mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

			mockApp := &MockAppIface{}
			mockApp.On("NotifySharedChannelUserUpdate", mock.Anything).Return()

			scs := &Service{
				server: mockServer,
				app:    mockApp,
			}

			rc := &model.RemoteCluster{
				RemoteId: remoteID,
				Name:     "origin",
			}

			saved, err := scs.getOrCreateUser(
				userID,
				map[string]*model.User{userID: inviteUser},
				rc,
			)
			require.NoError(t, err)

			actual, _ := saved.GetProp(model.UserPropsKeyRemoteEmail)
			require.Equal(t, tc.wantEmail, actual)
		})
	}
}
