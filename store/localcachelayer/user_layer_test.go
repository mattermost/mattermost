// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserStore(t *testing.T) {
	StoreTestWithSqlSupplier(t, storetest.TestUserStore)
}

func TestUserStoreCache(t *testing.T) {
	fakeUserIds := []string{"123"}
	fakeUser := []*model.User{{Id: "123"}}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		gotUser, err := cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)

		_, _ = cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		gotUser, err := cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)

		_, _ = cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, false)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 2)
	})

	t.Run("first call not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		gotUser, err := cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUser, gotUser)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 1)

		cachedStore.User().InvalidatProfileCacheForUser("123")

		_, _ = cachedStore.User().GetProfileByIds(fakeUserIds, &store.UserGetByIdsOpts{}, true)
		mockStore.User().(*mocks.UserStore).AssertNumberOfCalls(t, "GetProfileByIds", 2)
	})
}
