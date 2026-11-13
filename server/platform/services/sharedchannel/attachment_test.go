// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

func TestOnReceiveUploadCreate(t *testing.T) {
	remoteId := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteId}

	newRequest := func() model.UploadSession {
		return model.UploadSession{
			Id:        model.NewId(),
			Type:      model.UploadTypeAttachment,
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Filename:  "file.txt",
			FileSize:  100,
			RemoteId:  remoteId,
			ReqFileId: model.NewId(),
		}
	}

	setup := func(t *testing.T, us model.UploadSession) (*Service, *MockAppIface, *mocks.UploadSessionStore, model.RemoteClusterMsg) {
		t.Helper()

		mockServer := &MockServerIface{}
		mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))
		cfg := model.Config{}
		cfg.SetDefaults()
		mockServer.On("Config").Return(&cfg)

		mockSharedChannelStore := &mocks.SharedChannelStore{}
		mockSharedChannelStore.On("HasRemote", us.ChannelId, remoteId).Return(true, nil)
		mockUploadSessionStore := &mocks.UploadSessionStore{}
		mockStore := &mocks.Store{}
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("UploadSession").Return(mockUploadSessionStore)
		mockServer.On("GetStore").Return(mockStore)

		mockApp := &MockAppIface{}
		scs := &Service{server: mockServer, app: mockApp}

		payload, err := json.Marshal(us)
		require.NoError(t, err)
		return scs, mockApp, mockUploadSessionStore, model.NewRemoteClusterMsg(TopicUploadCreate, payload)
	}

	saveErr := model.NewAppError("CreateUploadSession", "app.upload.create.save.app_error", nil, "", http.StatusInternalServerError)

	t.Run("creates a new session", func(t *testing.T) {
		us := newRequest()
		scs, mockApp, _, msg := setup(t, us)
		saved := us
		saved.CreateAt = 1234
		mockApp.On("CreateUploadSession", mock.Anything, mock.Anything).Return(&saved, nil)

		response := &remotecluster.Response{}
		require.NoError(t, scs.onReceiveUploadCreate(msg, rc, response))

		var got model.UploadSession
		require.NoError(t, json.Unmarshal(response.Payload, &got))
		assert.Equal(t, saved, got)
	})

	t.Run("returns the saved session for a repeated request", func(t *testing.T) {
		us := newRequest()
		scs, mockApp, mockUploadSessionStore, msg := setup(t, us)
		existing := us
		existing.CreateAt = 5678
		mockApp.On("CreateUploadSession", mock.Anything, mock.Anything).Return(nil, saveErr)
		mockUploadSessionStore.On("Get", mock.Anything, us.Id).Return(&existing, nil)

		response := &remotecluster.Response{}
		require.NoError(t, scs.onReceiveUploadCreate(msg, rc, response))

		var got model.UploadSession
		require.NoError(t, json.Unmarshal(response.Payload, &got))
		assert.Equal(t, existing, got)
	})

	t.Run("rejects a repeated id that does not match the saved session", func(t *testing.T) {
		mismatches := map[string]func(us *model.UploadSession){
			"remote":    func(us *model.UploadSession) { us.RemoteId = model.NewId() },
			"user":      func(us *model.UploadSession) { us.UserId = model.NewId() },
			"channel":   func(us *model.UploadSession) { us.ChannelId = model.NewId() },
			"filename":  func(us *model.UploadSession) { us.Filename = "other.txt" },
			"file size": func(us *model.UploadSession) { us.FileSize++ },
			"file id":   func(us *model.UploadSession) { us.ReqFileId = model.NewId() },
		}
		for name, mutate := range mismatches {
			t.Run(name, func(t *testing.T) {
				us := newRequest()
				scs, mockApp, mockUploadSessionStore, msg := setup(t, us)
				existing := us
				mutate(&existing)
				mockApp.On("CreateUploadSession", mock.Anything, mock.Anything).Return(nil, saveErr)
				mockUploadSessionStore.On("Get", mock.Anything, us.Id).Return(&existing, nil)

				response := &remotecluster.Response{}
				err := scs.onReceiveUploadCreate(msg, rc, response)
				require.ErrorIs(t, err, saveErr)
				assert.Empty(t, response.Payload)
			})
		}
	})

	t.Run("returns the create error when no session was saved", func(t *testing.T) {
		us := newRequest()
		scs, mockApp, mockUploadSessionStore, msg := setup(t, us)
		mockApp.On("CreateUploadSession", mock.Anything, mock.Anything).Return(nil, saveErr)
		mockUploadSessionStore.On("Get", mock.Anything, us.Id).Return(nil, store.NewErrNotFound("UploadSession", us.Id))

		response := &remotecluster.Response{}
		err := scs.onReceiveUploadCreate(msg, rc, response)
		require.ErrorIs(t, err, saveErr)
		assert.Empty(t, response.Payload)
	})

	t.Run("validates a repeated request before looking up the session", func(t *testing.T) {
		cfg := model.Config{}
		cfg.SetDefaults()
		us := newRequest()
		us.FileSize = *cfg.FileSettings.MaxFileSize + 1
		scs, mockApp, mockUploadSessionStore, msg := setup(t, us)

		err := scs.onReceiveUploadCreate(msg, rc, &remotecluster.Response{})
		require.Error(t, err)
		mockApp.AssertNotCalled(t, "CreateUploadSession", mock.Anything, mock.Anything)
		mockUploadSessionStore.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)
	})
}
