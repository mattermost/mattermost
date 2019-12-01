// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
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

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetMemberCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 1)
		cachedStore.Channel().GetMemberCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetMemberCount", 2)
	})

	t.Run("first call force not cached, second not cached, third cached", func(t *testing.T) {
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

func TestChannelStoreChannelPinnedPostsCountsCache(t *testing.T) {
	countResult := int64(10)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		count, err := cachedStore.Channel().GetPinnedPostCount("id", true)
		require.Nil(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		count, err = cachedStore.Channel().GetPinnedPostCount("id", true)
		require.Nil(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		cachedStore.Channel().GetPinnedPostCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
	})

	t.Run("first call force not cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetPinnedPostCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		cachedStore.Channel().ClearCaches()
		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 1)
		cachedStore.Channel().InvalidatePinnedPostCount("id")
		cachedStore.Channel().GetPinnedPostCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetPinnedPostCount", 2)
	})
}

func TestChannelStoreGuestCountCache(t *testing.T) {
	countResult := int64(12)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		count, err := cachedStore.Channel().GetGuestCount("id", true)
		require.Nil(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		count, err = cachedStore.Channel().GetGuestCount("id", true)
		require.Nil(t, err)
		assert.Equal(t, count, countResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		cachedStore.Channel().GetGuestCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
	})

	t.Run("first call force not cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetGuestCount("id", false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		cachedStore.Channel().ClearCaches()
		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		cachedStore.Channel().InvalidateGuestCount("id")
		cachedStore.Channel().GetGuestCount("id", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 2)
	})
}

func TestChannelStoreChannel(t *testing.T) {
	channelId := "channel1"
	fakeChannel := model.Channel{Id: channelId}
	t.Run("first call by id not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		channel, err := cachedStore.Channel().Get(channelId, true)
		require.Nil(t, err)
		assert.Equal(t, channel, &fakeChannel)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		channel, err = cachedStore.Channel().Get(channelId, true)
		require.Nil(t, err)
		assert.Equal(t, channel, &fakeChannel)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Channel().Get(channelId, false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call force no cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)
		cachedStore.Channel().Get(channelId, false)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, clear cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Channel().ClearCaches()
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, invalidate cache, second call not cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Channel().InvalidateChannel(channelId)
		cachedStore.Channel().Get(channelId, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "Get", 2)
	})
}

func TestChannelStoreAllChannelMembersForUserCache(t *testing.T) {
	t.Run("first call not cached include deleted, second cached include deleted, returning same data", func(t *testing.T) {
		allChannelMembersForUserResult := map[string]string{
			"channle_id_1": "role1",
		}
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)
		allChannelMembersForUser, err := cachedStore.Channel().GetAllChannelMembersForUser("id", true, true)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, allChannelMembersForUserResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, true)

		allChannelMembersForUser, err = cachedStore.Channel().GetAllChannelMembersForUser("id", true, true)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, allChannelMembersForUserResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, true)
	})

	t.Run("first call not cached exclude deleted, second cached exclude deleted, returning same data", func(t *testing.T) {
		allChannelMembersForUserResult := map[string]string{
			"channle_id_2": "role2",
		}
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		allChannelMembersForUser, err := cachedStore.Channel().GetAllChannelMembersForUser("id", true, false)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, allChannelMembersForUserResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, false)

		allChannelMembersForUser, err = cachedStore.Channel().GetAllChannelMembersForUser("id", true, false)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, allChannelMembersForUserResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, false)
	})

	t.Run("first call not cached include deleted, second call not cached exclude deleted, returning diffrent data", func(t *testing.T) {
		fakeAllChannelMembersForUserIncludeDeleted := map[string]string{
			"channle_id_1": "role1",
		}
		fakeAllChannelMembersForUserExcludeDeleted := map[string]string{
			"channle_id_2": "role2",
		}
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		allChannelMembersForUser, err := cachedStore.Channel().GetAllChannelMembersForUser("id", true, true)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, fakeAllChannelMembersForUserIncludeDeleted)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, true)

		allChannelMembersForUser, err = cachedStore.Channel().GetAllChannelMembersForUser("id", true, false)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, fakeAllChannelMembersForUserExcludeDeleted)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 2)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, false)
	})

	t.Run("first call not cached, clear cache, second not cached, returning same data", func(t *testing.T) {
		allChannelMembersForUserResult := map[string]string{
			"channle_id_2": "role2",
		}
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		allChannelMembersForUser, err := cachedStore.Channel().GetAllChannelMembersForUser("id", true, false)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, allChannelMembersForUserResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, false)

		cachedStore.Channel().InvalidateAllChannelMembersForUser("id")
		allChannelMembersForUser, err = cachedStore.Channel().GetAllChannelMembersForUser("id", true, false)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, allChannelMembersForUserResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 2)
	})

	t.Run("first call force no cached,  second force no cached, returning same data", func(t *testing.T) {
		allChannelMembersForUserResult := map[string]string{
			"channle_id_2": "role2",
		}
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		allChannelMembersForUser, err := cachedStore.Channel().GetAllChannelMembersForUser("id", false, false)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, allChannelMembersForUserResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", false, false)

		cachedStore.Channel().InvalidateAllChannelMembersForUser("id")
		allChannelMembersForUser, err = cachedStore.Channel().GetAllChannelMembersForUser("id", false, false)
		require.Nil(t, err)
		assert.Equal(t, allChannelMembersForUser, allChannelMembersForUserResult)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 2)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", false, false)
	})

	t.Run("first call not cached, second cached, third cached, returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		channelExist := cachedStore.Channel().IsUserInChannelUseCache("id", "channle_id_2")
		assert.Equal(t, channelExist, true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, false)

		channelExist = cachedStore.Channel().IsUserInChannelUseCache("id", "non_existing_channel")
		assert.Equal(t, channelExist, false)

		channelExist = cachedStore.Channel().IsUserInChannelUseCache("id", "channle_id_2")
		assert.Equal(t, channelExist, true)

		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetAllChannelMembersForUser", 1)
		mockStore.Channel().(*mocks.ChannelStore).AssertCalled(t, "GetAllChannelMembersForUser", "id", true, false)
	})
}
