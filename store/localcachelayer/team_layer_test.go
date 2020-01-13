// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTeamStore(t *testing.T) {
	StoreTest(t, storetest.TestTeamStore)
}

func TestTeamStoreCache(t *testing.T) {
	fakeUserId := "123"
	fakeUserTeamIds := []string{"1", "2", "3"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotUserTeamIds, err := cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 1)

		gotUserTeamIds, err = cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotUserTeamIds, err := cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 1)

		gotUserTeamIds, err = cachedStore.Team().GetUserTeamIds(fakeUserId, false)
		require.Nil(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 2)
	})

	t.Run("first call not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		gotUserTeamIds, err := cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 1)

		cachedStore.Team().InvalidateAllTeamIdsForUser(fakeUserId)

		gotUserTeamIds, err = cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.Nil(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 2)
	})

}
