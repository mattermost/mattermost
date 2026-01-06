// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestContentFlaggingStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestContentFlaggingStore)
}

func TestContentFlaggingStoreGetReviewerSettingsCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	setBasicMock := func(mockStore *mocks.Store, cachedStore LocalCacheStore) {
		reviewerSettings := &model.ReviewerIDsSettings{
			CommonReviewerIds: []string{"user1", "user2", "user3"},
		}
		mockContentFlaggingStore := mockStore.ContentFlagging().(*mocks.ContentFlaggingStore)
		mockContentFlaggingStore.On("GetReviewerSettings").Return(reviewerSettings, nil)
		cachedStore.contentFlagging.ContentFlaggingStore = mockContentFlaggingStore
	}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)
		setBasicMock(mockStore, cachedStore)

		settings, err := cachedStore.ContentFlagging().GetReviewerSettings()
		require.NoError(t, err)
		require.Len(t, settings.CommonReviewerIds, 3)
		require.Contains(t, settings.CommonReviewerIds, "user1")
		require.Contains(t, settings.CommonReviewerIds, "user2")
		require.Contains(t, settings.CommonReviewerIds, "user3")

		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 1)

		settings, err = cachedStore.ContentFlagging().GetReviewerSettings()
		require.NoError(t, err)
		require.Len(t, settings.CommonReviewerIds, 3)
		require.Contains(t, settings.CommonReviewerIds, "user1")
		require.Contains(t, settings.CommonReviewerIds, "user2")
		require.Contains(t, settings.CommonReviewerIds, "user3")
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 1)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)
		setBasicMock(mockStore, cachedStore)

		_, err = cachedStore.ContentFlagging().GetReviewerSettings()
		require.NoError(t, err)
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 1)

		cachedStore.ContentFlagging().ClearCaches()

		_, err = cachedStore.ContentFlagging().GetReviewerSettings()
		require.NoError(t, err)
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 2)
	})

	t.Run("cluster invalidation clears cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)
		setBasicMock(mockStore, cachedStore)

		// First call to populate cache
		_, err = cachedStore.ContentFlagging().GetReviewerSettings()
		require.NoError(t, err)
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 1)

		// Simulate cluster invalidation message
		msg := &model.ClusterMessage{
			Event: model.ClusterEventInvalidateCacheForContentFlagging,
		}
		cachedStore.contentFlagging.handleClusterInvalidateContentFlagging(msg)

		// Next call should hit the store again
		_, err = cachedStore.ContentFlagging().GetReviewerSettings()
		require.NoError(t, err)
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 2)
	})
}
