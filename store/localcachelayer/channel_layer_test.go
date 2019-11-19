package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelStore(t *testing.T) {
	StoreTest(t, storetest.TestReactionStore)
}

func TestChannelStoreChannelMemberCountsCache(t *testing.T) {
	countResult := int64(10)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		count, err := cachedStore.Channel().GetMemberCount("id", true)
		require.Nil(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		count, err = cachedStore.Channel().GetMemberCount("id", true)
		require.Nil(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().GetMemberCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})

	t.Run("first call force no cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetMemberCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})

	t.Run("first call with GetMemberCountFromCache not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		count := cachedStore.Channel().GetMemberCountFromCache("id")
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		count = cachedStore.Channel().GetMemberCountFromCache("id")
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().ClearCaches()
		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().InvalidateMemberCount("id")
		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})
}
