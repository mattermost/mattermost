// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
)

func TestUserStore(t *testing.T) {
	StoreTestWithSqlSupplier(t, storetest.TestUserStore)
}

func TestUserStoreCache(t *testing.T) {
	fakeUserIds := []string{"123"}
	fakeUser := []*model.User{{Id: "123"}}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotUser, err := cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)

		_, _ = cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotUser, err := cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)

		_, _ = cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, false)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 2)
	})

	t.Run("first call not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotUser, err := cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)

		cachedStore.User().InvalidateProfileCacheForUser("123")

		_, _ = cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 2)
	})

	t.Run("should always return a copy of the stored data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		storedUsers, err := mockStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, false)
		require.Nil(t, err)

		originalProps := make([]model.StringMap, len(storedUsers))

		for i := 0; i < len(storedUsers); i++ {
			originalProps[i] = storedUsers[i].NotifyProps
			storedUsers[i].NotifyProps = map[string]string{}
			storedUsers[i].NotifyProps["key"] = "somevalue"
		}

		cachedUsers, err := cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.Nil(t, err)

		for i := 0; i < len(storedUsers); i++ {
			assert.Equal(t, storedUsers[i], cachedUsers[i])
			if storedUsers[i] == cachedUsers[i] {
				assert.Fail(t, "should be different pointers")
			}
			cachedUsers[i].NotifyProps["key"] = "othervalue"
			assert.NotEqual(t, storedUsers[i], cachedUsers[i])
		}

		cachedUsers, err = cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.Nil(t, err)
		for i := 0; i < len(storedUsers); i++ {
			assert.Equal(t, storedUsers[i], cachedUsers[i])
			if storedUsers[i] == cachedUsers[i] {
				assert.Fail(t, "should be different pointers")
			}
			cachedUsers[i].NotifyProps["key"] = "othervalue"
			assert.NotEqual(t, storedUsers[i], cachedUsers[i])
		}

		for i := 0; i < len(storedUsers); i++ {
			storedUsers[i].NotifyProps = originalProps[i]
		}
	})
}

func TestUserStoreProfilesInChannelCache(t *testing.T) {
	fakeChannelId := "123"
	fakeUserId := "456"
	fakeMap := map[string]*model.User{
		fakeUserId: {Id: "456"},
	}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotMap, err := cachedStore.User().GetAllProfilesInChannel(fakeChannelId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeMap, gotMap)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)

		_, _ = cachedStore.User().GetAllProfilesInChannel(fakeChannelId, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotMap, err := cachedStore.User().GetAllProfilesInChannel(fakeChannelId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeMap, gotMap)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)

		_, _ = cachedStore.User().GetAllProfilesInChannel(fakeChannelId, false)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 2)
	})

	t.Run("first call not cached, invalidate by channel, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotMap, err := cachedStore.User().GetAllProfilesInChannel(fakeChannelId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeMap, gotMap)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)

		cachedStore.User().InvalidateProfilesInChannelCache("123")

		_, _ = cachedStore.User().GetAllProfilesInChannel(fakeChannelId, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 2)
	})

	t.Run("first call not cached, invalidate by user, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotMap, err := cachedStore.User().GetAllProfilesInChannel(fakeChannelId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeMap, gotMap)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)

		cachedStore.User().InvalidateProfilesInChannelCacheByUser("456")

		_, _ = cachedStore.User().GetAllProfilesInChannel(fakeChannelId, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 2)
	})
}
