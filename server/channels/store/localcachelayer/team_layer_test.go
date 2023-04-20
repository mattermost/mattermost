// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/storetest/mocks"
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
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUserTeamIds, err := cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 1)

		gotUserTeamIds, err = cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUserTeamIds, err := cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 1)

		gotUserTeamIds, err = cachedStore.Team().GetUserTeamIds(fakeUserId, false)
		require.NoError(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 2)
	})

	t.Run("first call not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)
		require.NoError(t, err)

		gotUserTeamIds, err := cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 1)

		cachedStore.Team().InvalidateAllTeamIdsForUser(fakeUserId)

		gotUserTeamIds, err = cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.NoError(t, err)
		assert.Equal(t, fakeUserTeamIds, gotUserTeamIds)
		mockStore.Team().(*mocks.TeamStore).AssertNumberOfCalls(t, "GetUserTeamIds", 2)
	})

}
