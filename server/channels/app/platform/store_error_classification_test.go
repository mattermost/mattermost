// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestStatusStoreErrorClassification(t *testing.T) {
	testCases := []struct {
		name       string
		err        error
		wantStatus int
		wantID     string
	}{
		{"not found", store.NewErrNotFound("Status", "id"), http.StatusNotFound, "app.status.get.missing.app_error"},
		{"other error", errors.New("db down"), http.StatusInternalServerError, "app.status.get.app_error"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			th := SetupWithStoreMock(t)
			userID := model.NewId()
			statusStore := th.Service.Store.Status().(*mocks.StatusStore)
			statusStore.On("Get", userID).Return(nil, tc.err)

			status, appErr := th.Service.GetStatus(userID)
			require.NotNil(t, appErr)
			assert.Nil(t, status)
			assert.Equal(t, tc.wantStatus, appErr.StatusCode)
			assert.Equal(t, tc.wantID, appErr.Id)
		})
	}
}

func TestPluginKeyStoreErrorClassification(t *testing.T) {
	const productID = "com.example.plugin"
	const key = "key"
	otherErr := errors.New("db down")

	t.Run("SetPluginKeyWithOptions returns an AppError from the store as is", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		storeAppErr := model.NewAppError("SetWithOptions", "store.app_error", nil, "", http.StatusConflict)
		pluginStore := &mocks.PluginStore{}
		th.Service.Store.(*mocks.Store).On("Plugin").Return(pluginStore)
		pluginStore.On("SetWithOptions", productID, key, mock.Anything, mock.Anything).Return(false, storeAppErr)

		updated, appErr := th.Service.SetPluginKeyWithOptions(productID, key, []byte("v"), model.PluginKVSetOptions{})
		assert.False(t, updated)
		assert.Same(t, storeAppErr, appErr)
	})

	t.Run("SetPluginKeyWithOptions wraps any other store error", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		pluginStore := &mocks.PluginStore{}
		th.Service.Store.(*mocks.Store).On("Plugin").Return(pluginStore)
		pluginStore.On("SetWithOptions", productID, key, mock.Anything, mock.Anything).Return(false, otherErr)

		updated, appErr := th.Service.SetPluginKeyWithOptions(productID, key, []byte("v"), model.PluginKVSetOptions{})
		assert.False(t, updated)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin_store.save.app_error", appErr.Id)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		assert.ErrorIs(t, appErr, otherErr)
	})

	t.Run("KVGet returns nil when both lookups are not found", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		pluginStore := &mocks.PluginStore{}
		th.Service.Store.(*mocks.Store).On("Plugin").Return(pluginStore)
		pluginStore.On("Get", productID, mock.Anything).Return(nil, store.NewErrNotFound("PluginKeyValue", key)).Twice()

		value, appErr := th.Service.KVGet(productID, key)
		assert.Nil(t, appErr)
		assert.Nil(t, value)
		pluginStore.AssertExpectations(t)
	})

	t.Run("KVGet fails on a non-not-found error from the first lookup", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		pluginStore := &mocks.PluginStore{}
		th.Service.Store.(*mocks.Store).On("Plugin").Return(pluginStore)
		pluginStore.On("Get", productID, key).Return(nil, otherErr).Once()

		value, appErr := th.Service.KVGet(productID, key)
		assert.Nil(t, value)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin_store.get.app_error", appErr.Id)
		pluginStore.AssertExpectations(t)
	})

	t.Run("KVGet fails on a non-not-found error from the hashed key lookup", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		pluginStore := &mocks.PluginStore{}
		th.Service.Store.(*mocks.Store).On("Plugin").Return(pluginStore)
		pluginStore.On("Get", productID, key).Return(nil, store.NewErrNotFound("PluginKeyValue", key)).Once()
		pluginStore.On("Get", productID, getKeyHash(key)).Return(nil, otherErr).Once()

		value, appErr := th.Service.KVGet(productID, key)
		assert.Nil(t, value)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin_store.get.app_error", appErr.Id)
		pluginStore.AssertExpectations(t)
	})
}
