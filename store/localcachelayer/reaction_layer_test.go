// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/mattermost/mattermost-server/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReactionStore(t *testing.T) {
	StoreTest(t, storetest.TestReactionStore)
}

func TestReactionStoreCache(t *testing.T) {
	fakeReaction := model.Reaction{PostId: "123"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockReactionsStore := mocks.ReactionStore{}
		mockReactionsStore.On("Save", &fakeReaction).Return(&model.Reaction{}, nil)
		mockReactionsStore.On("Delete", &fakeReaction).Return(&model.Reaction{}, nil)
		mockReactionsStore.On("GetForPost", "123", false).Return([]*model.Reaction{&fakeReaction}, nil)
		mockReactionsStore.On("GetForPost", "123", true).Return([]*model.Reaction{&fakeReaction}, nil)
		mockStore.On("Reaction").Return(&mockReactionsStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		reaction, err := cachedStore.Reaction().GetForPost("123", true)
		require.Nil(t, err)
		assert.Equal(t, reaction, []*model.Reaction{&fakeReaction})
		mockReactionsStore.AssertNumberOfCalls(t, "GetForPost", 1)
		require.Nil(t, err)
		assert.Equal(t, reaction, []*model.Reaction{&fakeReaction})
		cachedStore.Reaction().GetForPost("123", true)
		mockReactionsStore.AssertNumberOfCalls(t, "GetForPost", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockReactionsStore := mocks.ReactionStore{}
		mockReactionsStore.On("Save", &fakeReaction).Return(&model.Reaction{}, nil)
		mockReactionsStore.On("Delete", &fakeReaction).Return(&model.Reaction{}, nil)
		mockReactionsStore.On("GetForPost", "123", false).Return([]*model.Reaction{&fakeReaction}, nil)
		mockReactionsStore.On("GetForPost", "123", true).Return([]*model.Reaction{&fakeReaction}, nil)
		mockStore.On("Reaction").Return(&mockReactionsStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Reaction().GetForPost("123", true)
		mockReactionsStore.AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().GetForPost("123", false)
		mockReactionsStore.AssertNumberOfCalls(t, "GetForPost", 2)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockReactionsStore := mocks.ReactionStore{}
		mockReactionsStore.On("Save", &fakeReaction).Return(&model.Reaction{}, nil)
		mockReactionsStore.On("Delete", &fakeReaction).Return(&model.Reaction{}, nil)
		mockReactionsStore.On("GetForPost", "123", false).Return([]*model.Reaction{&fakeReaction}, nil)
		mockReactionsStore.On("GetForPost", "123", true).Return([]*model.Reaction{&fakeReaction}, nil)
		mockStore.On("Reaction").Return(&mockReactionsStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Reaction().GetForPost("123", true)
		mockReactionsStore.AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().Save(&fakeReaction)
		cachedStore.Reaction().GetForPost("123", true)
		mockReactionsStore.AssertNumberOfCalls(t, "GetForPost", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := mocks.Store{}
		mockReactionsStore := mocks.ReactionStore{}
		mockReactionsStore.On("Save", &fakeReaction).Return(&model.Reaction{}, nil)
		mockReactionsStore.On("Delete", &fakeReaction).Return(&model.Reaction{}, nil)
		mockReactionsStore.On("GetForPost", "123", false).Return([]*model.Reaction{&fakeReaction}, nil)
		mockReactionsStore.On("GetForPost", "123", true).Return([]*model.Reaction{&fakeReaction}, nil)
		mockStore.On("Reaction").Return(&mockReactionsStore)
		cachedStore := NewLocalCacheLayer(&mockStore, nil, nil)

		cachedStore.Reaction().GetForPost("123", true)
		mockReactionsStore.AssertNumberOfCalls(t, "GetForPost", 1)
		cachedStore.Reaction().Delete(&fakeReaction)
		cachedStore.Reaction().GetForPost("123", true)
		mockReactionsStore.AssertNumberOfCalls(t, "GetForPost", 2)
	})
}
