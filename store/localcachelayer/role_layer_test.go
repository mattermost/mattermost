// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoleStore(t *testing.T) {
	StoreTest(t, storetest.TestRoleStore)
}

func TestRoleStoreCache(t *testing.T) {
	fakeRole := model.Role{Id: "123", Name: "role-name"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		role, err := cachedStore.Role().GetByName("role-name")
		require.Nil(t, err)
		assert.Equal(t, role, &fakeRole)
		mockStore.Role().(*mocks.RoleStore).AssertNumberOfCalls(t, "GetByName", 1)
		require.Nil(t, err)
		assert.Equal(t, role, &fakeRole)
		cachedStore.Role().GetByName("role-name")
		mockStore.Role().(*mocks.RoleStore).AssertNumberOfCalls(t, "GetByName", 1)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Role().GetByName("role-name")
		mockStore.Role().(*mocks.RoleStore).AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Role().Save(&fakeRole)
		cachedStore.Role().GetByName("role-name")
		mockStore.Role().(*mocks.RoleStore).AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Role().GetByName("role-name")
		mockStore.Role().(*mocks.RoleStore).AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Role().Delete("123")
		cachedStore.Role().GetByName("role-name")
		mockStore.Role().(*mocks.RoleStore).AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call not cached, permanent delete all, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Role().GetByName("role-name")
		mockStore.Role().(*mocks.RoleStore).AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Role().PermanentDeleteAll()
		cachedStore.Role().GetByName("role-name")
		mockStore.Role().(*mocks.RoleStore).AssertNumberOfCalls(t, "GetByName", 2)
	})
}
