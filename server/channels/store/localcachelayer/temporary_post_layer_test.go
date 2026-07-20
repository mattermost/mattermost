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

func TestTemporaryPostStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestTemporaryPostStore)
}

func TestTemporaryPostStoreCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		temporaryPost, err := cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		assert.Equal(t, "123", temporaryPost.ID)
		assert.Equal(t, "test message", temporaryPost.Message)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 1)

		// Second call should be cached
		temporaryPost2, err := cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		assert.Equal(t, "123", temporaryPost2.ID)
		assert.Equal(t, "test message", temporaryPost2.Message)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("first call not cached, second with allowFromCache=false bypasses cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// First call - should cache
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 1)

		// Second call with allowFromCache=false - should bypass cache
		_, err = cachedStore.TemporaryPost().Get(nil, "123", false)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("allowFromCache=false always bypasses cache even when cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// First call with caching enabled
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 1)

		// Second call with caching enabled - should use cache
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 1)

		// Third call with allowFromCache=false - should bypass cache
		_, err = cachedStore.TemporaryPost().Get(nil, "123", false)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 2)

		// Fourth call with allowFromCache=false again - should bypass cache again
		_, err = cachedStore.TemporaryPost().Get(nil, "123", false)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 3)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// First call - should cache
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 1)

		// Save should invalidate cache
		tmpPost := &model.TemporaryPost{
			ID:       "123",
			Type:     model.PostTypeBurnOnRead,
			ExpireAt: model.GetMillis() + 300000,
			Message:  "test message",
			FileIDs:  []string{"file1"},
		}
		_, err = cachedStore.TemporaryPost().Save(nil, tmpPost)
		require.NoError(t, err)

		// Next Get should hit the database again
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// First call - should cache
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 1)

		// Delete should invalidate cache
		err = cachedStore.TemporaryPost().Delete(nil, "123")
		require.NoError(t, err)

		// Next Get should hit the database again
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("cache invalidation via InvalidateTemporaryPost", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// First call - should cache
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 1)

		// Manual invalidation
		cachedStore.TemporaryPost().InvalidateTemporaryPost("123")

		// Next Get should hit the database again
		_, err = cachedStore.TemporaryPost().Get(nil, "123", true)
		require.NoError(t, err)
		mockStore.TemporaryPost().(*mocks.TemporaryPostStore).AssertNumberOfCalls(t, "Get", 2)
	})
}
