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

func TestReactionStore(t *testing.T) {
	StoreTest(t, storetest.TestReactionStore)
}

func TestReactionStoreCache(t *testing.T) {
	fakeReaction := model.Reaction{PostId: "123"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		reaction, err := cachedStore.Reaction().GetForPost("123", true)
		require.Nil(t, err)
		assert.Equal(t, reaction, []*model.Reaction{&fakeReaction})
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
		require.Nil(t, err)
		assert.Equal(t, reaction, []*model.Reaction{&fakeReaction})
		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
	})

	t.Run("first call not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().GetForPost("123", false)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 2)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().Save(&fakeReaction)
		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().Delete(&fakeReaction)
		cachedStore.Reaction().GetForPost("123", true)
		mockStore.Reaction().(*mocks.ReactionStore).AssertNumberOfCalls(t, "GetForPost", 2)
	})
}
