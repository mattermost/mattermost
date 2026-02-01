// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestUserTermsOfServiceStore(t *testing.T) {
	StoreTest(t, storetest.TestUserTermsOfServiceStore)
}

func TestUserTermsOfServiceCacheByUser(t *testing.T) {
	fakeUserTermsOfService := model.UserTermsOfService{UserId: "user123", TermsOfServiceId: "123", CreateAt: 11111}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		userTermsOfService, err := cachedStore.UserTermsOfService().GetByUser("user123")
		require.NoError(t, err)
		assert.Equal(t, userTermsOfService, &fakeUserTermsOfService)
		mockStore.UserTermsOfService().(*mocks.UserTermsOfServiceStore).AssertNumberOfCalls(t, "GetByUser", 1)

		userTermsOfService, err = cachedStore.UserTermsOfService().GetByUser("user123")
		require.NoError(t, err)
		assert.Equal(t, userTermsOfService, &fakeUserTermsOfService)
		mockStore.UserTermsOfService().(*mocks.UserTermsOfServiceStore).AssertNumberOfCalls(t, "GetByUser", 1)
	})

	t.Run("save should cache the data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		_, err = cachedStore.UserTermsOfService().Save(&fakeUserTermsOfService)
		require.NoError(t, err)
		mockStore.UserTermsOfService().(*mocks.UserTermsOfServiceStore).AssertNumberOfCalls(t, "Save", 1)

		// Should be cached after save
		userTermsOfService, err := cachedStore.UserTermsOfService().GetByUser("user123")
		require.NoError(t, err)
		assert.Equal(t, userTermsOfService, &fakeUserTermsOfService)
		mockStore.UserTermsOfService().(*mocks.UserTermsOfServiceStore).AssertNumberOfCalls(t, "GetByUser", 0)
	})

	t.Run("delete should invalidate cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// First cache the data
		_, err = cachedStore.UserTermsOfService().Save(&fakeUserTermsOfService)
		require.NoError(t, err)
		userTermsOfService, err := cachedStore.UserTermsOfService().GetByUser("user123")
		require.NoError(t, err)
		assert.Equal(t, userTermsOfService, &fakeUserTermsOfService)
		mockStore.UserTermsOfService().(*mocks.UserTermsOfServiceStore).AssertNumberOfCalls(t, "GetByUser", 0)

		// Delete should invalidate cache
		err = cachedStore.UserTermsOfService().Delete("user123", "123")
		require.NoError(t, err)
		mockStore.UserTermsOfService().(*mocks.UserTermsOfServiceStore).AssertNumberOfCalls(t, "Delete", 1)

		// Should call underlying store again after cache invalidation
		userTermsOfService, err = cachedStore.UserTermsOfService().GetByUser("user123")
		require.NoError(t, err)
		assert.Equal(t, userTermsOfService, &fakeUserTermsOfService)
		mockStore.UserTermsOfService().(*mocks.UserTermsOfServiceStore).AssertNumberOfCalls(t, "GetByUser", 1)
	})
}
