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

func TestContentFlaggingStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestContentFlaggingStore)
}

func TestContentFlaggingStoreGetReviewerSettingsCache(t *testing.T) {
	reviewerSettings := &model.ReviewerIDsSettings{
		ReviewerIds: []string{"user1", "user2", "user3"},
	}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		settings, err := cachedStore.ContentFlagging().GetReviewerSettings()
		require.NoError(t, err)
		assert.Equal(t, reviewerSettings, settings)
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 1)
		
		settings, err = cachedStore.ContentFlagging().GetReviewerSettings()
		require.NoError(t, err)
		assert.Equal(t, reviewerSettings, settings)
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 1)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.ContentFlagging().GetReviewerSettings()
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 1)
		
		cachedStore.ContentFlagging().ClearCaches()
		
		cachedStore.ContentFlagging().GetReviewerSettings()
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 2)
	})

	t.Run("cluster invalidation clears cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// First call to populate cache
		cachedStore.ContentFlagging().GetReviewerSettings()
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 1)

		// Simulate cluster invalidation message
		msg := &model.ClusterMessage{
			Event: model.ClusterEventInvalidateContentFlagging,
		}
		cachedStore.contentFlagging.handleClusterInvalidateContentFlagging(msg)

		// Next call should hit the store again
		cachedStore.ContentFlagging().GetReviewerSettings()
		mockStore.ContentFlagging().(*mocks.ContentFlaggingStore).AssertNumberOfCalls(t, "GetReviewerSettings", 2)
	})
}
