// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestDeliveryTrackingStoreGetTrackedChannelIDsCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	rctx := request.TestContext(t)

	setBasicMock := func(mockStore *mocks.Store, cachedStore LocalCacheStore) *mocks.DeliveryTrackingStore {
		mockDeliveryTrackingStore := mockStore.DeliveryTracking().(*mocks.DeliveryTrackingStore)
		mockDeliveryTrackingStore.On("GetTrackedChannelIDs", mock.Anything).Return([]string{"channel1", "channel2"}, nil)
		mockDeliveryTrackingStore.On("SaveTrackedChannelIDs", mock.Anything, mock.Anything).Return(nil)
		cachedStore.deliveryTracking.DeliveryTrackingStore = mockDeliveryTrackingStore
		return mockDeliveryTrackingStore
	}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)
		mockDeliveryTrackingStore := setBasicMock(mockStore, cachedStore)

		channelIDs, err := cachedStore.DeliveryTracking().GetTrackedChannelIDs(rctx)
		require.NoError(t, err)
		require.Equal(t, []string{"channel1", "channel2"}, channelIDs)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "GetTrackedChannelIDs", 1)

		channelIDs, err = cachedStore.DeliveryTracking().GetTrackedChannelIDs(rctx)
		require.NoError(t, err)
		require.Equal(t, []string{"channel1", "channel2"}, channelIDs)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "GetTrackedChannelIDs", 1)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)
		mockDeliveryTrackingStore := setBasicMock(mockStore, cachedStore)

		_, err = cachedStore.DeliveryTracking().GetTrackedChannelIDs(rctx)
		require.NoError(t, err)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "GetTrackedChannelIDs", 1)

		cachedStore.DeliveryTracking().ClearCaches()

		_, err = cachedStore.DeliveryTracking().GetTrackedChannelIDs(rctx)
		require.NoError(t, err)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "GetTrackedChannelIDs", 2)
	})

	t.Run("saving the list invalidates the cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)
		mockDeliveryTrackingStore := setBasicMock(mockStore, cachedStore)

		_, err = cachedStore.DeliveryTracking().GetTrackedChannelIDs(rctx)
		require.NoError(t, err)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "GetTrackedChannelIDs", 1)

		require.NoError(t, cachedStore.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{"channel3"}))

		_, err = cachedStore.DeliveryTracking().GetTrackedChannelIDs(rctx)
		require.NoError(t, err)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "GetTrackedChannelIDs", 2)
	})
}

func TestDeliveryTrackingStoreChannelEligibilityCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	rctx := request.TestContext(t)

	newCachedStore := func(t *testing.T) (LocalCacheStore, *mocks.DeliveryTrackingStore) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		mockDeliveryTrackingStore := mockStore.DeliveryTracking().(*mocks.DeliveryTrackingStore)
		mockDeliveryTrackingStore.On("IsChannelTracked", mock.Anything, mock.Anything).Return(true, nil)
		mockDeliveryTrackingStore.On("IsChannelTrackable", mock.Anything, mock.Anything).Return(true, nil)
		mockDeliveryTrackingStore.On("SaveTrackedChannelIDs", mock.Anything, mock.Anything).Return(nil)
		cachedStore.deliveryTracking.DeliveryTrackingStore = mockDeliveryTrackingStore

		return cachedStore, mockDeliveryTrackingStore
	}

	t.Run("IsChannelTracked is resolved once per channel", func(t *testing.T) {
		cachedStore, mockDeliveryTrackingStore := newCachedStore(t)

		for range 3 {
			tracked, err := cachedStore.DeliveryTracking().IsChannelTracked(rctx, "channel1")
			require.NoError(t, err)
			require.True(t, tracked)
		}
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "IsChannelTracked", 1)

		_, err := cachedStore.DeliveryTracking().IsChannelTracked(rctx, "channel2")
		require.NoError(t, err)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "IsChannelTracked", 2)
	})

	t.Run("IsChannelTrackable is resolved once per channel", func(t *testing.T) {
		cachedStore, mockDeliveryTrackingStore := newCachedStore(t)

		for range 3 {
			trackable, err := cachedStore.DeliveryTracking().IsChannelTrackable(rctx, "channel1")
			require.NoError(t, err)
			require.True(t, trackable)
		}
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "IsChannelTrackable", 1)
	})

	t.Run("saving the list re-resolves tracked but not trackable", func(t *testing.T) {
		cachedStore, mockDeliveryTrackingStore := newCachedStore(t)

		_, err := cachedStore.DeliveryTracking().IsChannelTracked(rctx, "channel1")
		require.NoError(t, err)
		_, err = cachedStore.DeliveryTracking().IsChannelTrackable(rctx, "channel1")
		require.NoError(t, err)

		require.NoError(t, cachedStore.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{"channel2"}))

		_, err = cachedStore.DeliveryTracking().IsChannelTracked(rctx, "channel1")
		require.NoError(t, err)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "IsChannelTracked", 2)

		// DM and GM membership is immutable, so those entries survive the invalidation.
		_, err = cachedStore.DeliveryTracking().IsChannelTrackable(rctx, "channel1")
		require.NoError(t, err)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "IsChannelTrackable", 1)
	})

	t.Run("errors are not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		mockDeliveryTrackingStore := mockStore.DeliveryTracking().(*mocks.DeliveryTrackingStore)
		mockDeliveryTrackingStore.On("IsChannelTracked", mock.Anything, mock.Anything).Return(false, errors.New("boom"))
		cachedStore.deliveryTracking.DeliveryTrackingStore = mockDeliveryTrackingStore

		for range 2 {
			_, err = cachedStore.DeliveryTracking().IsChannelTracked(rctx, "channel1")
			require.Error(t, err)
		}
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "IsChannelTracked", 2)
	})
}
