// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/plugin/plugintest/mock"
)

func TestUserStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestUserStore)
}

func TestUserStoreCache(t *testing.T) {
	fakeUserIds := []string{"123"}
	fakeUser := []*model.User{{
		Id:          "123",
		AuthData:    model.NewString("authData"),
		AuthService: "authService",
	}}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUser, err := cachedStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.NoError(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)

		_, _ = cachedStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUser, err := cachedStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.NoError(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)

		_, _ = cachedStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, false)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 2)
	})

	t.Run("first call not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUser, err := cachedStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.NoError(t, err)
		assert.Equal(t, fakeUser, gotUser)

		cachedStore.User().InvalidateProfileCacheForUser("123")

		_, _ = cachedStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 2)
	})

	t.Run("should always return a copy of the stored data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		storedUsers, err := mockStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, false)
		require.NoError(t, err)

		originalProps := make([]model.StringMap, len(storedUsers))

		for i := 0; i < len(storedUsers); i++ {
			originalProps[i] = storedUsers[i].NotifyProps
			storedUsers[i].NotifyProps = map[string]string{}
			storedUsers[i].NotifyProps["key"] = "somevalue"
		}

		cachedUsers, err := cachedStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.NoError(t, err)

		for i := 0; i < len(storedUsers); i++ {
			assert.Equal(t, storedUsers[i].Id, cachedUsers[i].Id)
		}

		cachedUsers, err = cachedStore.User().GetProfileByIds(context.Background(), fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.NoError(t, err)
		for i := 0; i < len(storedUsers); i++ {
			storedUsers[i].Props = model.StringMap{}
			storedUsers[i].Timezone = model.StringMap{}
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
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotMap, err := cachedStore.User().GetAllProfilesInChannel(context.Background(), fakeChannelId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeMap, gotMap)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)

		_, _ = cachedStore.User().GetAllProfilesInChannel(context.Background(), fakeChannelId, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotMap, err := cachedStore.User().GetAllProfilesInChannel(context.Background(), fakeChannelId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeMap, gotMap)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)

		_, _ = cachedStore.User().GetAllProfilesInChannel(context.Background(), fakeChannelId, false)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 2)
	})

	t.Run("first call not cached, invalidate by channel, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotMap, err := cachedStore.User().GetAllProfilesInChannel(context.Background(), fakeChannelId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeMap, gotMap)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)

		cachedStore.User().InvalidateProfilesInChannelCache("123")

		_, _ = cachedStore.User().GetAllProfilesInChannel(context.Background(), fakeChannelId, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 2)
	})

	t.Run("first call not cached, invalidate by user, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotMap, err := cachedStore.User().GetAllProfilesInChannel(context.Background(), fakeChannelId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeMap, gotMap)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 1)

		cachedStore.User().InvalidateProfilesInChannelCacheByUser("456")

		_, _ = cachedStore.User().GetAllProfilesInChannel(context.Background(), fakeChannelId, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetAllProfilesInChannel", 2)
	})
}

func TestUserStoreGetCache(t *testing.T) {
	fakeUserId := "123"
	fakeUser := &model.User{
		Id:          "123",
		AuthData:    model.NewString("authData"),
		AuthService: "authService",
	}
	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUser, err := cachedStore.User().Get(context.Background(), fakeUserId)
		require.NoError(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "Get", 1)

		_, _ = cachedStore.User().Get(context.Background(), fakeUserId)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("first call not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUser, err := cachedStore.User().Get(context.Background(), fakeUserId)
		require.NoError(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "Get", 1)

		cachedStore.User().InvalidateProfileCacheForUser("123")

		_, _ = cachedStore.User().Get(context.Background(), fakeUserId)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("should always return a copy of the stored data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		storedUser, err := mockStore.User().Get(context.Background(), fakeUserId)
		require.NoError(t, err)
		originalProps := storedUser.NotifyProps

		storedUser.NotifyProps = map[string]string{}
		storedUser.NotifyProps["key"] = "somevalue"

		cachedUser, err := cachedStore.User().Get(context.Background(), fakeUserId)
		require.NoError(t, err)
		assert.Equal(t, storedUser, cachedUser)

		storedUser.Props = model.StringMap{}
		storedUser.Timezone = model.StringMap{}
		cachedUser, err = cachedStore.User().Get(context.Background(), fakeUserId)
		require.NoError(t, err)
		assert.Equal(t, storedUser, cachedUser)
		if storedUser == cachedUser {
			assert.Fail(t, "should be different pointers")
		}
		cachedUser.NotifyProps["key"] = "othervalue"
		assert.NotEqual(t, storedUser, cachedUser)

		storedUser.NotifyProps = originalProps
	})
}

func TestUserStoreGetManyCache(t *testing.T) {
	fakeUser := &model.User{
		Id:          "123",
		AuthData:    model.NewString("authData"),
		AuthService: "authService",
	}
	otherFakeUser := &model.User{
		Id:          "456",
		AuthData:    model.NewString("authData"),
		AuthService: "authService",
	}
	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUsers, err := cachedStore.User().GetMany(context.Background(), []string{fakeUser.Id, otherFakeUser.Id})
		require.NoError(t, err)
		assert.Len(t, gotUsers, 2)
		assert.Contains(t, gotUsers, fakeUser)
		assert.Contains(t, gotUsers, otherFakeUser)

		gotUsers, err = cachedStore.User().GetMany(context.Background(), []string{fakeUser.Id, otherFakeUser.Id})
		require.NoError(t, err)
		assert.Len(t, gotUsers, 2)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetMany", 1)
	})

	t.Run("first call not cached, invalidate one user, and then check that one is cached and one is fetched from db", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUsers, err := cachedStore.User().GetMany(context.Background(), []string{fakeUser.Id, otherFakeUser.Id})
		require.NoError(t, err)
		assert.Len(t, gotUsers, 2)
		assert.Contains(t, gotUsers, fakeUser)
		assert.Contains(t, gotUsers, otherFakeUser)

		cachedStore.User().InvalidateProfileCacheForUser("123")

		gotUsers, err = cachedStore.User().GetMany(context.Background(), []string{fakeUser.Id, otherFakeUser.Id})
		require.NoError(t, err)
		assert.Len(t, gotUsers, 2)
		mockStore.User().(*mocks.UserStore).AssertCalled(t, "GetMany", mock.Anything, []string{"123"})
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetMany", 2)
	})
}
