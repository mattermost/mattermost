// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestBotEventSubscriptionStore(t *testing.T) {
	StoreTestWithSqlStore(t, storetest.TestBotEventSubscriptionStore)
}

func TestBotEventSubscriptionStoreCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	rctx := request.TestContext(t)

	subscribed := func(id string) *model.BotEventSubscription {
		return &model.BotEventSubscription{BotUserId: id, Mode: model.BotEventSubscriptionModePull, Enabled: true, IgnoreBotAuthors: true}
	}

	setup := func(t *testing.T) (LocalCacheStore, *mocks.BotEventSubscriptionStore) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		inner := &mocks.BotEventSubscriptionStore{}
		cachedStore.botEventSubscription.BotEventSubscriptionStore = inner
		return cachedStore, inner
	}

	t.Run("hits and misses are each cached", func(t *testing.T) {
		cachedStore, inner := setup(t)
		inner.On("GetForBots", mock.Anything, []string{"bot1", "bot2"}).Return([]*model.BotEventSubscription{subscribed("bot1")}, nil).Once()

		for range 3 {
			subs, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1", "bot2"})
			require.NoError(t, err)
			require.Len(t, subs, 1)
			assert.Equal(t, "bot1", subs[0].BotUserId)
			assert.True(t, subs[0].Enabled)
		}
		inner.AssertNumberOfCalls(t, "GetForBots", 1)
	})

	t.Run("partial hit queries only the misses", func(t *testing.T) {
		cachedStore, inner := setup(t)
		inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{subscribed("bot1")}, nil).Once()
		inner.On("GetForBots", mock.Anything, []string{"bot2"}).Return([]*model.BotEventSubscription{subscribed("bot2")}, nil).Once()

		_, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)

		subs, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1", "bot2"})
		require.NoError(t, err)
		assert.Len(t, subs, 2)
		inner.AssertNumberOfCalls(t, "GetForBots", 2)
	})

	t.Run("duplicate ids are looked up once", func(t *testing.T) {
		cachedStore, inner := setup(t)
		inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{subscribed("bot1")}, nil).Once()

		subs, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1", "bot1"})
		require.NoError(t, err)
		assert.Len(t, subs, 1)
	})

	t.Run("empty input does not reach the store", func(t *testing.T) {
		cachedStore, inner := setup(t)

		subs, err := cachedStore.BotEventSubscription().GetForBots(rctx, nil)
		require.NoError(t, err)
		assert.Empty(t, subs)
		inner.AssertNotCalled(t, "GetForBots", mock.Anything, mock.Anything)
	})

	type mutation struct {
		name string
		run  func(cachedStore LocalCacheStore, inner *mocks.BotEventSubscriptionStore)
	}
	mutations := []mutation{
		{"Save", func(c LocalCacheStore, inner *mocks.BotEventSubscriptionStore) {
			sub := subscribed("bot1")
			inner.On("Save", mock.Anything, sub).Return(sub, nil)
			_, err := c.BotEventSubscription().Save(rctx, sub)
			require.NoError(t, err)
		}},
		{"Update", func(c LocalCacheStore, inner *mocks.BotEventSubscriptionStore) {
			sub := subscribed("bot1")
			inner.On("Update", mock.Anything, sub).Return(sub, nil)
			_, err := c.BotEventSubscription().Update(rctx, sub)
			require.NoError(t, err)
		}},
		{"SetEnabled", func(c LocalCacheStore, inner *mocks.BotEventSubscriptionStore) {
			inner.On("SetEnabled", mock.Anything, "bot1", false, "manual", int64(1)).Return(nil)
			require.NoError(t, c.BotEventSubscription().SetEnabled(rctx, "bot1", false, "manual", 1))
		}},
		{"Delete", func(c LocalCacheStore, inner *mocks.BotEventSubscriptionStore) {
			inner.On("Delete", mock.Anything, "bot1").Return(nil)
			require.NoError(t, c.BotEventSubscription().Delete(rctx, "bot1"))
		}},
	}
	for _, m := range mutations {
		t.Run(m.name+" invalidates the entry", func(t *testing.T) {
			cachedStore, inner := setup(t)
			inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{subscribed("bot1")}, nil)

			_, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
			require.NoError(t, err)
			inner.AssertNumberOfCalls(t, "GetForBots", 1)

			m.run(cachedStore, inner)

			_, err = cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
			require.NoError(t, err)
			inner.AssertNumberOfCalls(t, "GetForBots", 2)
		})
	}

	t.Run("create invalidates a cached negative entry", func(t *testing.T) {
		cachedStore, inner := setup(t)
		inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{}, nil).Once()

		subs, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)
		assert.Empty(t, subs)

		sub := subscribed("bot1")
		inner.On("Save", mock.Anything, sub).Return(sub, nil)
		_, err = cachedStore.BotEventSubscription().Save(rctx, sub)
		require.NoError(t, err)

		inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{sub}, nil).Once()
		subs, err = cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)
		assert.Len(t, subs, 1)
	})

	t.Run("a failed mutation keeps the entry", func(t *testing.T) {
		cachedStore, inner := setup(t)
		inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{subscribed("bot1")}, nil)
		inner.On("SetEnabled", mock.Anything, "bot1", true, "", int64(1)).Return(assert.AnError)

		_, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)
		require.Error(t, cachedStore.BotEventSubscription().SetEnabled(rctx, "bot1", true, "", 1))
		_, err = cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)
		inner.AssertNumberOfCalls(t, "GetForBots", 1)
	})

	t.Run("cursor and secret updates do not invalidate", func(t *testing.T) {
		cachedStore, inner := setup(t)
		inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{subscribed("bot1")}, nil)
		inner.On("AdvanceAckCursor", mock.Anything, "bot1", mock.Anything, mock.Anything).Return(true, nil)
		inner.On("AdvanceTruncatedCursor", mock.Anything, "bot1", mock.Anything).Return(true, nil)
		inner.On("UpdateSecret", mock.Anything, "bot1", mock.Anything, mock.Anything).Return(nil)

		_, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)

		_, err = cachedStore.BotEventSubscription().AdvanceAckCursor(rctx, "bot1", model.BotEventCursor{CreateAt: 1}, 1)
		require.NoError(t, err)
		_, err = cachedStore.BotEventSubscription().AdvanceTruncatedCursor(rctx, "bot1", model.BotEventCursor{CreateAt: 1})
		require.NoError(t, err)
		require.NoError(t, cachedStore.BotEventSubscription().UpdateSecret(rctx, "bot1", "secret", 1))

		_, err = cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)
		inner.AssertNumberOfCalls(t, "GetForBots", 1)
	})

	t.Run("ClearCaches empties the cache", func(t *testing.T) {
		cachedStore, inner := setup(t)
		inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{subscribed("bot1")}, nil)

		_, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)
		cachedStore.botEventSubscription.ClearCaches()
		_, err = cachedStore.BotEventSubscription().GetForBots(rctx, []string{"bot1"})
		require.NoError(t, err)
		inner.AssertNumberOfCalls(t, "GetForBots", 2)
	})

	t.Run("cluster message removes one key or purges", func(t *testing.T) {
		cachedStore, inner := setup(t)
		inner.On("GetForBots", mock.Anything, []string{"bot1"}).Return([]*model.BotEventSubscription{subscribed("bot1")}, nil)
		inner.On("GetForBots", mock.Anything, []string{"bot2"}).Return([]*model.BotEventSubscription{subscribed("bot2")}, nil)

		for _, id := range []string{"bot1", "bot2"} {
			_, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{id})
			require.NoError(t, err)
		}
		inner.AssertNumberOfCalls(t, "GetForBots", 2)

		cachedStore.botEventSubscription.handleClusterInvalidateBotEventSubscription(&model.ClusterMessage{Data: []byte("bot1")})
		for _, id := range []string{"bot1", "bot2"} {
			_, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{id})
			require.NoError(t, err)
		}
		inner.AssertNumberOfCalls(t, "GetForBots", 3)

		cachedStore.botEventSubscription.handleClusterInvalidateBotEventSubscription(&model.ClusterMessage{Data: clearCacheMessageData})
		for _, id := range []string{"bot1", "bot2"} {
			_, err := cachedStore.BotEventSubscription().GetForBots(rctx, []string{id})
			require.NoError(t, err)
		}
		inner.AssertNumberOfCalls(t, "GetForBots", 5)
	})
}
