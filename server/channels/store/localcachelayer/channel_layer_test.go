// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	cmocks "github.com/mattermost/mattermost/server/v8/platform/services/cache/mocks"
)

func TestChannelStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestReactionStore)
}

func TestChannelStoreChannelMemberCountsCache(t *testing.T) {
	countResult := int64(10)
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		count, err := cachedStore.Channel().GetMemberCount("id", true)
		require.NoError(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		count, err = cachedStore.Channel().GetMemberCount("id", true)
		require.NoError(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().GetMemberCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})

	t.Run("first call force not cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetMemberCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})

	t.Run("first call with GetMemberCountFromCache not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		count := cachedStore.Channel().GetMemberCountFromCache("id")
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		count = cachedStore.Channel().GetMemberCountFromCache("id")
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().ClearCaches()
		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().InvalidateMemberCount("id")
		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})
}

func TestChannelStoreChannelsMemberCountCache(t *testing.T) {
	channelsCountResult := map[string]int64{
		"channel1": 10,
		"channel2": 20,
	}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		channelsCount, err := cachedStore.Channel().GetChannelsMemberCount([]string{"channel1", "channel2"})
		require.NoError(t, err)
		assert.Equal(t, channelsCount, channelsCountResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetChannelsMemberCount", 1)
		channelsCount, err = cachedStore.Channel().GetChannelsMemberCount([]string{"channel1", "channel2"})
		require.NoError(t, err)
		assert.Equal(t, channelsCount, channelsCountResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetChannelsMemberCount", 1)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetChannelsMemberCount([]string{"channel1", "channel2"})
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetChannelsMemberCount", 1)
		cachedStore.Channel().InvalidateMemberCount("channel1")
		cachedStore.Channel().InvalidateMemberCount("channel2")
		cachedStore.Channel().GetChannelsMemberCount([]string{"channel1", "channel2"})
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetChannelsMemberCount", 2)
	})
}

func TestChannelStoreChannelPinnedPostsCountsCache(t *testing.T) {
	countResult := int64(10)
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		count, err := cachedStore.Channel().GetPinnedPostCount("id", true)
		require.NoError(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		count, err = cachedStore.Channel().GetPinnedPostCount("id", true)
		require.NoError(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		cachedStore.Channel().GetPinnedPostCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
	})

	t.Run("first call force not cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetPinnedPostCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		cachedStore.Channel().ClearCaches()
		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		cachedStore.Channel().InvalidatePinnedPostCount("id")
		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
	})
}

func TestChannelStoreGuestCountCache(t *testing.T) {
	countResult := int64(12)
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		count, err := cachedStore.Channel().GetGuestCount("id", true)
		require.NoError(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		count, err = cachedStore.Channel().GetGuestCount("id", true)
		require.NoError(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		cachedStore.Channel().GetGuestCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
	})

	t.Run("first call force not cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetGuestCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		cachedStore.Channel().ClearCaches()
		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		cachedStore.Channel().InvalidateGuestCount("id")
		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
	})
}

func TestChannelStoreChannel(t *testing.T) {
	channelId := "channel1"
	fakeChannel := model.Channel{Id: channelId, Name: "channel1-name"}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call by id not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		channel, err := cachedStore.Channel().Get(channelId, true)
		require.NoError(t, err)
		assert.Equal(t, channel, &fakeChannel)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		channel, err = cachedStore.Channel().Get(channelId, true)
		require.NoError(t, err)
		assert.Equal(t, channel, &fakeChannel)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Channel().Get(channelId, false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call force no cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)
		cachedStore.Channel().Get(channelId, false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Channel().ClearCaches()
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Channel().InvalidateChannel(channelId)
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})
}

func TestChannelStoreSavePopulatesCache(t *testing.T) {
	channelId := "channel1"
	fakeChannel := model.Channel{Id: channelId, Name: "channel1-name"}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("save populates cache so subsequent get does not hit store", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		_, err = cachedStore.Channel().Save(request.TestContext(t), &fakeChannel, int64(0))
		require.NoError(t, err)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Save", 1)

		// Get should be served from cache without hitting the underlying store
		channel, err := cachedStore.Channel().Get(channelId, true)
		require.NoError(t, err)
		assert.Equal(t, &fakeChannel, channel)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 0)
	})

	t.Run("save populates cache, invalidate removes it, get hits store", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		_, err = cachedStore.Channel().Save(request.TestContext(t), &fakeChannel, int64(0))
		require.NoError(t, err)

		cachedStore.Channel().InvalidateChannel(channelId)

		_, err = cachedStore.Channel().Get(channelId, true)
		require.NoError(t, err)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
	})
}

func TestChannelStoreUpdateInvalidatesCache(t *testing.T) {
	channelId := "channel1"
	fakeChannel := model.Channel{Id: channelId, Name: "channel1-name"}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("update after save invalidates cache, get hits store", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// Save populates cache
		_, err = cachedStore.Channel().Save(request.TestContext(t), &fakeChannel, int64(0))
		require.NoError(t, err)

		// Update invalidates cache
		_, err = cachedStore.Channel().Update(request.TestContext(t), &fakeChannel)
		require.NoError(t, err)

		// Get should miss cache and hit the store
		_, err = cachedStore.Channel().Get(channelId, true)
		require.NoError(t, err)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("update after get invalidates cache, next get hits store", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		// First Get populates cache
		_, err = cachedStore.Channel().Get(channelId, true)
		require.NoError(t, err)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)

		// Update invalidates cache
		_, err = cachedStore.Channel().Update(request.TestContext(t), &fakeChannel)
		require.NoError(t, err)

		// Second Get should miss cache and hit the store again
		_, err = cachedStore.Channel().Get(channelId, true)
		require.NoError(t, err)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})
}

func TestChannelStoreGetManyCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		fakeChannel := model.Channel{Id: "channel1", Name: "channel1-name"}
		fakeChannel2 := model.Channel{Id: "channel2", Name: "channel2-name"}
		channels, err := cachedStore.Channel().GetMany([]string{fakeChannel.Id}, true)
		require.NoError(t, err)
		assert.ElementsMatch(t, model.ChannelList{&fakeChannel}, channels)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMany", 1)

		channels, err = cachedStore.Channel().GetMany([]string{fakeChannel.Id}, true)
		require.NoError(t, err)
		assert.ElementsMatch(t, model.ChannelList{&fakeChannel}, channels)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMany", 1)

		channels, err = cachedStore.Channel().GetMany([]string{fakeChannel.Id, fakeChannel2.Id}, true)
		require.NoError(t, err)
		assert.ElementsMatch(t, model.ChannelList{&fakeChannel, &fakeChannel2}, channels)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMany", 2)
	})

	t.Run("passing allowCache=false should bypass cache", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		fakeChannel := model.Channel{Id: "channel1", Name: "channel1-name"}
		channels, err := cachedStore.Channel().GetMany([]string{fakeChannel.Id}, false)
		require.NoError(t, err)
		assert.ElementsMatch(t, model.ChannelList{&fakeChannel}, channels)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMany", 1)
	})
}

func TestChannelStoreGetByNamesCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		fakeChannel := model.Channel{Id: "channel1", Name: "channel1-name"}
		fakeChannel2 := model.Channel{Id: "channel2", Name: "channel2-name"}
		channels, err := cachedStore.Channel().GetByNames("team1", []string{fakeChannel.Name}, true)
		require.NoError(t, err)
		assert.ElementsMatch(t, []*model.Channel{&fakeChannel}, channels)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetByNames", 1)

		channels, err = cachedStore.Channel().GetByNames("team1", []string{fakeChannel.Name}, true)
		require.NoError(t, err)
		assert.ElementsMatch(t, []*model.Channel{&fakeChannel}, channels)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetByNames", 1)

		channels, err = cachedStore.Channel().GetByNames("team1", []string{fakeChannel.Name, fakeChannel2.Name}, true)
		require.NoError(t, err)
		assert.ElementsMatch(t, []*model.Channel{&fakeChannel, &fakeChannel2}, channels)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetByNames", 2)
	})
}

func TestChannelStoreChannelMemberRolesCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	ctxType := mock.AnythingOfType("*request.Context")
	expectedRoles := store.ChannelMemberRoles{Roles: "custom_role channel_user channel_admin", SchemeUser: true, SchemeAdmin: true}
	member := &model.ChannelMember{ChannelId: "channel1", UserId: "user1"}

	// user1 is a member of channel1 only.
	newCachedStore := func(t *testing.T) (LocalCacheStore, *mocks.ChannelStore) {
		mockStore := getMockStore(t)
		mockChannelStore := mockStore.Channel().(*mocks.ChannelStore)
		for _, allowFromCache := range []bool{true, false} {
			mockChannelStore.On("GetChannelMemberRoles", ctxType, "user1", []string{"channel1"}, allowFromCache).
				Return(map[string]store.ChannelMemberRoles{"channel1": expectedRoles}, nil)
		}
		mockChannelStore.On("GetChannelMemberRoles", ctxType, "user1", []string{"channel2"}, true).
			Return(map[string]store.ChannelMemberRoles{}, nil)
		mockChannelStore.On("GetChannelMemberRoles", ctxType, "user1", []string{"channel1", "channel2"}, true).
			Return(map[string]store.ChannelMemberRoles{"channel1": expectedRoles}, nil)

		mockChannelStore.On("UpdateMember", ctxType, mock.Anything).Return(func(_ request.CTX, m *model.ChannelMember) *model.ChannelMember { return m }, nil)
		mockChannelStore.On("UpdateMultipleMembers", mock.Anything).Return(func(ms []*model.ChannelMember) []*model.ChannelMember { return ms }, nil)
		mockChannelStore.On("RemoveMember", ctxType, mock.Anything, mock.Anything).Return(nil)
		mockChannelStore.On("RemoveMembers", ctxType, mock.Anything, mock.Anything).Return(nil)
		mockChannelStore.On("UpdateMembersRole", "channel1", []string{"user1"}).Return([]*model.ChannelMember{member}, nil)
		mockChannelStore.On("RemoveAllDeactivatedMembers", ctxType, mock.Anything).Return(nil)
		mockChannelStore.On("PermanentDeleteMembersByChannel", ctxType, mock.Anything).Return(nil)
		mockChannelStore.On("PermanentDeleteMembersByUser", ctxType, mock.Anything).Return(nil)
		mockChannelStore.On("MigrateChannelMembers", mock.Anything, mock.Anything).Return(map[string]string{}, nil)
		mockChannelStore.On("ClearAllCustomRoleAssignments").Return(nil)

		mockUserStore := mockStore.User().(*mocks.UserStore)
		mockUserStore.On("PromoteGuestToUser", ctxType, "user1").Return(nil)
		mockUserStore.On("DemoteUserToGuest", ctxType, "user1").Return(&model.User{Id: "user1"}, nil)

		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)
		return cachedStore, mockChannelStore
	}

	getRoles := func(t *testing.T, cachedStore LocalCacheStore, channelIDs ...string) map[string]store.ChannelMemberRoles {
		t.Helper()
		memberRoles, err := cachedStore.Channel().GetChannelMemberRoles(request.TestContext(t), "user1", channelIDs, true)
		require.NoError(t, err)
		return memberRoles
	}

	// fetchCount is how many times the store was asked for user1's roles in exactly channelIDs.
	fetchCount := func(mockChannelStore *mocks.ChannelStore, channelIDs ...string) int {
		count := 0
		for _, call := range mockChannelStore.Calls {
			if call.Method == "GetChannelMemberRoles" && assert.ObjectsAreEqual(channelIDs, call.Arguments.Get(2)) {
				count++
			}
		}
		return count
	}

	t.Run("a second call is served from the cache", func(t *testing.T) {
		cachedStore, mockChannelStore := newCachedStore(t)

		assert.Equal(t, map[string]store.ChannelMemberRoles{"channel1": expectedRoles}, getRoles(t, cachedStore, "channel1"))
		assert.Equal(t, map[string]store.ChannelMemberRoles{"channel1": expectedRoles}, getRoles(t, cachedStore, "channel1"))
		assert.Equal(t, 1, fetchCount(mockChannelStore, "channel1"))
	})

	t.Run("only the channels missing from the cache are fetched", func(t *testing.T) {
		cachedStore, mockChannelStore := newCachedStore(t)

		getRoles(t, cachedStore, "channel1")
		assert.Equal(t, map[string]store.ChannelMemberRoles{"channel1": expectedRoles}, getRoles(t, cachedStore, "channel1", "channel2"))
		assert.Equal(t, 1, fetchCount(mockChannelStore, "channel2"))
		assert.Equal(t, 0, fetchCount(mockChannelStore, "channel1", "channel2"))
	})

	t.Run("a channel the user is not a member of is not cached", func(t *testing.T) {
		cachedStore, mockChannelStore := newCachedStore(t)

		assert.Empty(t, getRoles(t, cachedStore, "channel2"))
		assert.Empty(t, getRoles(t, cachedStore, "channel2"))
		assert.Equal(t, 2, fetchCount(mockChannelStore, "channel2"))
	})

	t.Run("not allowing the cache always reads the store", func(t *testing.T) {
		cachedStore, mockChannelStore := newCachedStore(t)

		getRoles(t, cachedStore, "channel1")
		_, err := cachedStore.Channel().GetChannelMemberRoles(request.TestContext(t), "user1", []string{"channel1"}, false)
		require.NoError(t, err)
		assert.Equal(t, 2, fetchCount(mockChannelStore, "channel1"))
	})

	rctx := request.TestContext(t)
	invalidations := map[string]func(t *testing.T, cachedStore LocalCacheStore){
		"updating the membership": func(t *testing.T, cachedStore LocalCacheStore) {
			_, err := cachedStore.Channel().UpdateMember(rctx, member)
			require.NoError(t, err)
		},
		"updating several memberships": func(t *testing.T, cachedStore LocalCacheStore) {
			_, err := cachedStore.Channel().UpdateMultipleMembers([]*model.ChannelMember{member})
			require.NoError(t, err)
		},
		"removing the member": func(t *testing.T, cachedStore LocalCacheStore) {
			require.NoError(t, cachedStore.Channel().RemoveMember(rctx, "channel1", "user1"))
		},
		"removing several members": func(t *testing.T, cachedStore LocalCacheStore) {
			require.NoError(t, cachedStore.Channel().RemoveMembers(rctx, "channel1", []string{"user1"}))
		},
		"syncing the members' admin role": func(t *testing.T, cachedStore LocalCacheStore) {
			_, err := cachedStore.Channel().UpdateMembersRole("channel1", []string{"user1"})
			require.NoError(t, err)
		},
		"removing deactivated members": func(t *testing.T, cachedStore LocalCacheStore) {
			require.NoError(t, cachedStore.Channel().RemoveAllDeactivatedMembers(rctx, "channel1"))
		},
		"deleting the channel's members": func(t *testing.T, cachedStore LocalCacheStore) {
			require.NoError(t, cachedStore.Channel().PermanentDeleteMembersByChannel(rctx, "channel1"))
		},
		"deleting the user's memberships": func(t *testing.T, cachedStore LocalCacheStore) {
			require.NoError(t, cachedStore.Channel().PermanentDeleteMembersByUser(rctx, "user1"))
		},
		"migrating channel members": func(t *testing.T, cachedStore LocalCacheStore) {
			_, err := cachedStore.Channel().MigrateChannelMembers("", "")
			require.NoError(t, err)
		},
		"clearing custom role assignments": func(t *testing.T, cachedStore LocalCacheStore) {
			require.NoError(t, cachedStore.Channel().ClearAllCustomRoleAssignments())
		},
		"promoting the guest": func(t *testing.T, cachedStore LocalCacheStore) {
			require.NoError(t, cachedStore.User().PromoteGuestToUser(rctx, "user1"))
		},
		"demoting the user": func(t *testing.T, cachedStore LocalCacheStore) {
			_, err := cachedStore.User().DemoteUserToGuest(rctx, "user1")
			require.NoError(t, err)
		},
		"clearing the members-for-user cache": func(t *testing.T, cachedStore LocalCacheStore) {
			cachedStore.Channel().ClearMembersForUserCache()
		},
		"clearing the channel caches": func(t *testing.T, cachedStore LocalCacheStore) {
			cachedStore.Channel().ClearCaches()
		},
		"a cluster invalidation for the membership": func(t *testing.T, cachedStore LocalCacheStore) {
			cachedStore.channel.handleClusterInvalidateChannelMemberRoles(&model.ClusterMessage{Data: []byte(channelMemberRolesKey("user1", "channel1"))})
		},
		"a cluster purge": func(t *testing.T, cachedStore LocalCacheStore) {
			cachedStore.channel.handleClusterInvalidateChannelMemberRoles(&model.ClusterMessage{Data: clearCacheMessageData})
		},
	}
	for name, invalidate := range invalidations {
		t.Run(name+" drops the cached roles", func(t *testing.T) {
			cachedStore, mockChannelStore := newCachedStore(t)

			getRoles(t, cachedStore, "channel1")
			invalidate(t, cachedStore)
			getRoles(t, cachedStore, "channel1")
			assert.Equal(t, 2, fetchCount(mockChannelStore, "channel1"))
		})
	}

	// Per-user invalidations (profile updates, moderation patches) must not cost every one of
	// the user's memberships a re-read on the websocket hub.
	kept := map[string]func(t *testing.T, cachedStore LocalCacheStore){
		"invalidating the user's channel members": func(t *testing.T, cachedStore LocalCacheStore) {
			cachedStore.Channel().InvalidateAllChannelMembersForUser("user1")
		},
		"updating the user's membership in another channel": func(t *testing.T, cachedStore LocalCacheStore) {
			_, err := cachedStore.Channel().UpdateMember(rctx, &model.ChannelMember{ChannelId: "channel2", UserId: "user1"})
			require.NoError(t, err)
		},
		"a cluster invalidation for another membership": func(t *testing.T, cachedStore LocalCacheStore) {
			cachedStore.channel.handleClusterInvalidateChannelMemberRoles(&model.ClusterMessage{Data: []byte(channelMemberRolesKey("user2", "channel1"))})
		},
	}
	for name, keep := range kept {
		t.Run(name+" keeps the cached roles", func(t *testing.T) {
			cachedStore, mockChannelStore := newCachedStore(t)

			getRoles(t, cachedStore, "channel1")
			keep(t, cachedStore)
			getRoles(t, cachedStore, "channel1")
			assert.Equal(t, 1, fetchCount(mockChannelStore, "channel1"))
		})
	}
}

func TestChannelStoreGetAllChannelMembersForUser(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	mockStore := getMockStore(t)
	mockCacheProvider := getMockCacheProvider()
	cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
	require.NoError(t, err)

	cmock := cmocks.NewCache(t)
	cmock.On("Get", "u1", mock.AnythingOfType("*model.StringMap")).Return(nil)

	cachedStore.channel.rootStore.channelMembersForUserCache = cmock

	_, err = cachedStore.Channel().GetAllChannelMembersForUser(request.TestContext(t), "u1", true, false)
	require.NoError(t, err)
}
