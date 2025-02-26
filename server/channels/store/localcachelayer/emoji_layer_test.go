// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestEmojiStore(t *testing.T) {
	StoreTest(t, storetest.TestEmojiStore)
}

func TestEmojiStoreCache(t *testing.T) {
	rctx := request.TestContext(t)
	logger := mlog.CreateConsoleTestLogger(t)

	fakeEmoji := model.Emoji{Id: "123", Name: "name123"}
	fakeEmoji2 := model.Emoji{Id: "321", Name: "name321"}
	ctxEmoji := model.Emoji{Id: "master", Name: "name123"}

	t.Run("first call by id not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		emoji, err := cachedStore.Emoji().Get(rctx, "123", true)
		require.NoError(t, err)
		assert.Equal(t, emoji, &fakeEmoji)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 1)
		emoji, err = cachedStore.Emoji().Get(rctx, "123", true)
		require.NoError(t, err)
		assert.Equal(t, emoji, &fakeEmoji)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("GetByName: first call by name not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		emoji, err := cachedStore.Emoji().GetByName(rctx, "name123", true)
		require.NoError(t, err)
		assert.Equal(t, emoji, &fakeEmoji)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 1)
		emoji, err = cachedStore.Emoji().GetByName(rctx, "name123", true)
		require.NoError(t, err)
		assert.Equal(t, emoji, &fakeEmoji)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 1)
	})

	t.Run("GetMultipleByName: first call by name not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		emojis, err := cachedStore.Emoji().GetMultipleByName(rctx, []string{"name123"})
		require.NoError(t, err)
		require.Len(t, emojis, 1)
		assert.Equal(t, emojis[0], &fakeEmoji)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetMultipleByName", 1)
		emojis, err = cachedStore.Emoji().GetMultipleByName(rctx, []string{"name123"})
		require.NoError(t, err)
		require.Len(t, emojis, 1)
		assert.Equal(t, emojis[0], &fakeEmoji)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetMultipleByName", 1)
	})

	t.Run("GetMultipleByName: multiple elements", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		emojis, err := cachedStore.Emoji().GetMultipleByName(rctx, []string{"name123", "name321"})
		require.NoError(t, err)
		require.Len(t, emojis, 2)
		assert.Equal(t, emojis[0], &fakeEmoji)
		assert.Equal(t, emojis[1], &fakeEmoji2)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetMultipleByName", 1)
		emojis, err = cachedStore.Emoji().GetMultipleByName(rctx, []string{"name123"})
		require.NoError(t, err)
		require.Len(t, emojis, 1)
		assert.Equal(t, emojis[0], &fakeEmoji)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetMultipleByName", 1)
	})

	t.Run("first call by id not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().Get(rctx, "123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Emoji().Get(rctx, "123", false)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call by name not cached, second force not cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().GetByName(rctx, "name123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Emoji().GetByName(rctx, "name123", false)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call by id force not cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().Get(rctx, "123", false)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Emoji().Get(rctx, "123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 2)
		cachedStore.Emoji().Get(rctx, "123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call by name force not cached, second not cached, third cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().GetByName(rctx, "name123", false)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Emoji().GetByName(rctx, "name123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 2)
		cachedStore.Emoji().GetByName(rctx, "name123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("first call by id, second call by name and GetMultipleByName cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().Get(rctx, "123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Emoji().GetByName(rctx, "name123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 0)
		cachedStore.Emoji().GetMultipleByName(rctx, []string{"name123"})
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetMultipleByName", 0)
	})

	t.Run("first call by name, second call by id cached", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().GetByName(rctx, "name123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Emoji().Get(rctx, "123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 0)
	})

	t.Run("first call by id not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().Get(rctx, "123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Emoji().Delete(&fakeEmoji, 0)
		cachedStore.Emoji().Get(rctx, "123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("call by id, use master", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().Get(rctx, "master", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Emoji().Delete(&ctxEmoji, 0)
		cachedStore.Emoji().Get(rctx, "master", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call by name not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().GetByName(rctx, "name123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Emoji().Delete(&fakeEmoji, 0)
		cachedStore.Emoji().GetByName(rctx, "name123", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 2)
	})

	t.Run("call by name, use master", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Emoji().GetByName(rctx, "master", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 1)
		cachedStore.Emoji().Delete(&ctxEmoji, 0)
		cachedStore.Emoji().GetByName(rctx, "master", true)
		mockStore.Emoji().(*mocks.EmojiStore).AssertNumberOfCalls(t, "GetByName", 2)
	})
}
