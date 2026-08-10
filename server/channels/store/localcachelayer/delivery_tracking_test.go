// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
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
