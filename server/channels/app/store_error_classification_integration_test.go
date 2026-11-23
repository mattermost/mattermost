// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestAuditPluginKeyStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	notFound := fmt.Errorf("wrap: %w", store.NewErrNotFound("Thing", model.NewId()))
	plain := errors.New("db down")

	t.Run("GetAudits and GetAuditsPage", func(t *testing.T) {
		mockStore := &storemocks.Store{}
		mockStore.On("Close").Return(nil)
		auditMock := &storemocks.AuditStore{}
		mockStore.On("Audit").Return(auditMock)
		th.App.Srv().SetStore(mockStore)

		outOfBounds := fmt.Errorf("wrap: %w", store.NewErrOutOfBounds(10))
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{outOfBounds, "app.audit.get.limit.app_error", http.StatusBadRequest},
			{plain, "app.audit.get.finding.app_error", http.StatusInternalServerError},
		} {
			auditMock.On("Get", "user", 0, 5).Return(nil, tc.err).Once()
			_, appErr := th.App.GetAudits(th.Context, "user", 5)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)

			auditMock.On("Get", "user", 0, 5).Return(nil, tc.err).Once()
			_, appErr = th.App.GetAuditsPage(th.Context, "user", 0, 5)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})

	t.Run("CompareAndDeletePluginKey", func(t *testing.T) {
		mockStore := &storemocks.Store{}
		mockStore.On("Close").Return(nil)
		pluginMock := &storemocks.PluginStore{}
		mockStore.On("Plugin").Return(pluginMock)
		th.App.Srv().SetStore(mockStore)

		wrapped := model.NewAppError("Test", "test.app_error", nil, "", http.StatusTeapot)
		pluginMock.On("CompareAndDelete", mock.Anything, mock.Anything).Return(true, wrapped).Once()
		deleted, appErr := th.App.CompareAndDeletePluginKey(th.Context, "plugin", "key", []byte("old"))
		assert.True(t, deleted)
		assert.Same(t, wrapped, appErr)

		pluginMock.On("CompareAndDelete", mock.Anything, mock.Anything).Return(true, plain).Once()
		deleted, appErr = th.App.CompareAndDeletePluginKey(th.Context, "plugin", "key", []byte("old"))
		assert.False(t, deleted)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin_store.delete.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("getPluginKey", func(t *testing.T) {
		mockStore := &storemocks.Store{}
		mockStore.On("Close").Return(nil)
		pluginMock := &storemocks.PluginStore{}
		mockStore.On("Plugin").Return(pluginMock)
		th.App.Srv().SetStore(mockStore)

		hashed := getKeyHash("key")

		pluginMock.On("Get", "plugin", "key").Return(nil, notFound).Once()
		pluginMock.On("Get", "plugin", hashed).Return(nil, notFound).Once()
		value, appErr := th.App.Srv().getPluginKey("plugin", "key")
		assert.Nil(t, appErr)
		assert.Nil(t, value)

		pluginMock.On("Get", "plugin", "key").Return(nil, plain).Once()
		_, appErr = th.App.Srv().getPluginKey("plugin", "key")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin_store.get.app_error", appErr.Id)

		pluginMock.On("Get", "plugin", "key").Return(nil, notFound).Once()
		pluginMock.On("Get", "plugin", hashed).Return(nil, plain).Once()
		_, appErr = th.App.Srv().getPluginKey("plugin", "key")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin_store.get.app_error", appErr.Id)
	})
}

func TestPostActionSetupStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)
	mockStore := th.App.Srv().Store().(*storemocks.Store)
	channelMock := &storemocks.ChannelStore{}
	mockStore.On("Channel").Return(channelMock)

	notFound := fmt.Errorf("wrap: %w", store.NewErrNotFound("Thing", model.NewId()))
	plain := errors.New("db down")

	t.Run("populateUpstreamRequestIdentity user", func(t *testing.T) {
		for _, tc := range []struct {
			err error
			id  string
		}{
			{notFound, MissingAccountError},
			{plain, "app.user.get.app_error"},
		} {
			userChan := make(chan store.StoreResult[*model.User], 1)
			userChan <- store.StoreResult[*model.User]{NErr: tc.err}
			err := th.App.populateUpstreamRequestIdentity(&model.PostActionIntegrationRequest{}, userChan)
			var appErr *model.AppError
			require.ErrorAs(t, err, &appErr)
			assert.Equal(t, tc.id, appErr.Id)
		}
	})

	t.Run("populateUpstreamRequestIdentity team", func(t *testing.T) {
		teamMock := &storemocks.TeamStore{}
		mockStore.On("Team").Return(teamMock)
		for _, tc := range []struct {
			err error
			id  string
		}{
			{notFound, "app.team.get.find.app_error"},
			{plain, "app.team.get.finding.app_error"},
		} {
			teamMock.On("Get", "team").Return(nil, tc.err).Once()
			userChan := make(chan store.StoreResult[*model.User], 1)
			userChan <- store.StoreResult[*model.User]{Data: &model.User{Username: "u"}}
			err := th.App.populateUpstreamRequestIdentity(&model.PostActionIntegrationRequest{TeamId: "team"}, userChan)
			var appErr *model.AppError
			require.ErrorAs(t, err, &appErr)
			assert.Equal(t, tc.id, appErr.Id)
		}
	})

	t.Run("resolvePostActionSetupFromCookies", func(t *testing.T) {
		for _, tc := range []struct {
			err    error
			status int
		}{
			{notFound, http.StatusNotFound},
			{plain, http.StatusInternalServerError},
		} {
			_, _, appErr := th.App.resolvePostActionSetupFromCookies("post", "action", nil, nil, nil, &model.PostActionIntegrationRequest{}, store.StoreResult[*model.Post]{NErr: tc.err})
			require.NotNil(t, appErr)
			assert.Equal(t, "app.post.get.app_error", appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}

		channelMock.On("Get", "channel", true).Return(&model.Channel{Id: "channel", TeamId: "team"}, nil)
		for _, tc := range []struct {
			err       error
			ephemeral bool
		}{
			{nil, false},
			{notFound, true},
			{plain, false},
		} {
			cookie := &model.PostActionCookie{
				PostId:      "post",
				ChannelId:   "channel",
				Integration: &model.PostActionIntegration{URL: "http://example.com"},
			}
			setup, _, appErr := th.App.resolvePostActionSetupFromCookies("post", "action", cookie, nil, nil, &model.PostActionIntegrationRequest{}, store.StoreResult[*model.Post]{NErr: tc.err})
			require.Nil(t, appErr)
			assert.Equal(t, tc.ephemeral, setup.ephemeralInteractive)
		}
	})

	t.Run("channelForPostAction", func(t *testing.T) {
		for _, tc := range []struct {
			err    error
			id     string
			status int
		}{
			{notFound, "app.channel.get.existing.app_error", http.StatusNotFound},
			{plain, "app.channel.get.find.app_error", http.StatusInternalServerError},
		} {
			channelMock.On("Get", "other", true).Return(nil, tc.err).Once()
			_, err := th.App.channelForPostAction("other")
			var appErr *model.AppError
			require.ErrorAs(t, err, &appErr)
			assert.Equal(t, tc.id, appErr.Id)
			assert.Equal(t, tc.status, appErr.StatusCode)
		}
	})
}
