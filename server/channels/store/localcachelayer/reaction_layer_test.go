// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestReactionStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestReactionStore)
}

func TestReactionStoreCache(t *testing.T) {
	fakeReaction := model.Reaction{PostId: "123"}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		reaction, err := cachedStore.Reaction().GetForPost("123", true)
		require.NoError(t, err)
		assert.Equal(t, reaction, []*model.Reaction{&fakeReaction})
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
		assert.Equal(t, reaction, []*model.Reaction{&fakeReaction})
		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().GetForPost("123", false)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 2)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().Save(&fakeReaction)
		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().Delete(&fakeReaction)
		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 2)
	})
}
