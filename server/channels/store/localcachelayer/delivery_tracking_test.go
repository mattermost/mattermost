// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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

	openChannel := model.Channel{Id: "channel1", Type: model.ChannelTypeOpen}
	dmChannel := model.Channel{Id: "channel2", Type: model.ChannelTypeDirect}

	newCachedStore := func(t *testing.T) (LocalCacheStore, *mocks.DeliveryTrackingStore, *mocks.ChannelStore) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		mockDeliveryTrackingStore := mockStore.DeliveryTracking().(*mocks.DeliveryTrackingStore)
		mockDeliveryTrackingStore.On("IsChannelTracked", mock.Anything, mock.Anything).Return(true, nil)
		mockDeliveryTrackingStore.On("SaveTrackedChannelIDs", mock.Anything, mock.Anything).Return(nil)
		cachedStore.deliveryTracking.DeliveryTrackingStore = mockDeliveryTrackingStore

		mockChannelStore := mockStore.Channel().(*mocks.ChannelStore)
		mockChannelStore.On("Get", openChannel.Id, true).Return(&openChannel, nil)
		mockChannelStore.On("Get", dmChannel.Id, true).Return(&dmChannel, nil)
		mockChannelStore.On("Get", "missing", true).Return(nil, store.NewErrNotFound("Channel", "missing"))

		return cachedStore, mockDeliveryTrackingStore, mockChannelStore
	}

	t.Run("IsChannelTracked is resolved once per channel", func(t *testing.T) {
		cachedStore, mockDeliveryTrackingStore, _ := newCachedStore(t)

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

	t.Run("IsChannelTrackable resolves through the channel store once per channel", func(t *testing.T) {
		cachedStore, mockDeliveryTrackingStore, mockChannelStore := newCachedStore(t)

		for range 3 {
			trackable, err := cachedStore.DeliveryTracking().IsChannelTrackable(rctx, openChannel.Id)
			require.NoError(t, err)
			require.True(t, trackable)
		}
		mockChannelStore.AssertNumberOfCalls(t, "Get", 1)

		// The dedicated store method is never consulted; the channel store is the source.
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "IsChannelTrackable", 0)
	})

	t.Run("DMs are not trackable", func(t *testing.T) {
		cachedStore, _, _ := newCachedStore(t)

		trackable, err := cachedStore.DeliveryTracking().IsChannelTrackable(rctx, dmChannel.Id)
		require.NoError(t, err)
		require.False(t, trackable)
	})

	t.Run("unknown channels are not trackable and are memoized", func(t *testing.T) {
		cachedStore, _, mockChannelStore := newCachedStore(t)

		for range 2 {
			trackable, err := cachedStore.DeliveryTracking().IsChannelTrackable(rctx, "missing")
			require.NoError(t, err)
			require.False(t, trackable)
		}
		mockChannelStore.AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("saving the list re-resolves tracked but not trackable", func(t *testing.T) {
		cachedStore, mockDeliveryTrackingStore, mockChannelStore := newCachedStore(t)

		_, err := cachedStore.DeliveryTracking().IsChannelTracked(rctx, openChannel.Id)
		require.NoError(t, err)
		_, err = cachedStore.DeliveryTracking().IsChannelTrackable(rctx, openChannel.Id)
		require.NoError(t, err)

		require.NoError(t, cachedStore.DeliveryTracking().SaveTrackedChannelIDs(rctx, []string{"channel3"}))

		_, err = cachedStore.DeliveryTracking().IsChannelTracked(rctx, openChannel.Id)
		require.NoError(t, err)
		mockDeliveryTrackingStore.AssertNumberOfCalls(t, "IsChannelTracked", 2)

		// DM and GM membership is immutable, so those entries survive the invalidation.
		_, err = cachedStore.DeliveryTracking().IsChannelTrackable(rctx, openChannel.Id)
		require.NoError(t, err)
		mockChannelStore.AssertNumberOfCalls(t, "Get", 1)
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
