// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

func TestSessionAttributeStoreCache(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("Refresh writes attributes that Get returns", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		sessionID := model.NewId()
		err = cachedStore.SessionAttribute().Refresh(sessionID, map[string]any{
			model.SessionAttributesPropertyFieldUserAgentBrowserName: "Chrome",
			model.SessionAttributesPropertyFieldIPAddress:            "192.0.2.10",
		}, model.GetMillis())
		require.NoError(t, err)

		got, _, err := cachedStore.SessionAttribute().Get(sessionID)
		require.NoError(t, err)
		require.Equal(t, "Chrome", got[model.SessionAttributesPropertyFieldUserAgentBrowserName])
		require.Equal(t, "192.0.2.10", got[model.SessionAttributesPropertyFieldIPAddress])
	})

	t.Run("Refresh merges partial attributes", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		sessionID := model.NewId()
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionID, map[string]any{
			model.SessionAttributesPropertyFieldUserAgentBrowserName: "Chrome",
			model.SessionAttributesPropertyFieldIPAddress:            "192.0.2.10",
		}, model.GetMillis()))

		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionID, map[string]any{
			model.SessionAttributesPropertyFieldUserAgentBrowserName: "Firefox",
		}, model.GetMillis()))

		got, timestamps, err := cachedStore.SessionAttribute().Get(sessionID)
		require.NoError(t, err)
		require.Equal(t, "Firefox", got[model.SessionAttributesPropertyFieldUserAgentBrowserName])
		require.Equal(t, "192.0.2.10", got[model.SessionAttributesPropertyFieldIPAddress])
		require.NotZero(t, timestamps[model.SessionAttributesPropertyFieldUserAgentBrowserName])
		require.NotZero(t, timestamps[model.SessionAttributesPropertyFieldIPAddress])
	})

	t.Run("Get on missing session returns ErrKeyNotFound", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		got, _, err := cachedStore.SessionAttribute().Get(model.NewId())
		require.ErrorIs(t, err, cache.ErrKeyNotFound)
		require.Nil(t, got)
	})

	t.Run("cluster invalidation with session id removes single entry", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		sessionA := model.NewId()
		sessionB := model.NewId()
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionA, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "192.0.2.10",
		}, model.GetMillis()))
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionB, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "203.0.113.42",
		}, model.GetMillis()))

		cachedStore.sessionAttribute.handleClusterInvalidateSessionAttributes(&model.ClusterMessage{
			Event: model.ClusterEventInvalidateCacheForSessionAttributes,
			Data:  []byte(sessionA),
		})

		_, _, err = cachedStore.SessionAttribute().Get(sessionA)
		require.ErrorIs(t, err, cache.ErrKeyNotFound)

		got, _, err := cachedStore.SessionAttribute().Get(sessionB)
		require.NoError(t, err)
		require.Equal(t, "203.0.113.42", got[model.SessionAttributesPropertyFieldIPAddress])
	})

	t.Run("Invalidate removes only the given session entry", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		sessionA := model.NewId()
		sessionB := model.NewId()
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionA, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "192.0.2.10",
		}, model.GetMillis()))
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionB, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "203.0.113.42",
		}, model.GetMillis()))

		require.NoError(t, cachedStore.SessionAttribute().Invalidate(sessionA))

		_, _, err = cachedStore.SessionAttribute().Get(sessionA)
		require.ErrorIs(t, err, cache.ErrKeyNotFound)

		got, _, err := cachedStore.SessionAttribute().Get(sessionB)
		require.NoError(t, err)
		require.Equal(t, "203.0.113.42", got[model.SessionAttributesPropertyFieldIPAddress])
	})

	t.Run("Clear removes every entry", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		sessionA := model.NewId()
		sessionB := model.NewId()
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionA, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "192.0.2.10",
		}, model.GetMillis()))
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionB, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "203.0.113.42",
		}, model.GetMillis()))

		require.NoError(t, cachedStore.SessionAttribute().Clear())

		_, _, err = cachedStore.SessionAttribute().Get(sessionA)
		require.ErrorIs(t, err, cache.ErrKeyNotFound)
		_, _, err = cachedStore.SessionAttribute().Get(sessionB)
		require.ErrorIs(t, err, cache.ErrKeyNotFound)
	})

	t.Run("Refresh skips an update with an older timestamp", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		sessionID := model.NewId()
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionID, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "203.0.113.42",
		}, model.GetMillis()))

		// A stale update (older timestamp) for the same key must not win.
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionID,
			map[string]any{model.SessionAttributesPropertyFieldIPAddress: "192.0.2.10"},
			int64(1),
		))

		got, _, err := cachedStore.SessionAttribute().Get(sessionID)
		require.NoError(t, err)
		require.Equal(t, "203.0.113.42", got[model.SessionAttributesPropertyFieldIPAddress])
	})

	t.Run("cluster invalidation with clear-cache marker purges every entry", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		sessionA := model.NewId()
		sessionB := model.NewId()
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionA, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "192.0.2.10",
		}, model.GetMillis()))
		require.NoError(t, cachedStore.SessionAttribute().Refresh(sessionB, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress: "203.0.113.42",
		}, model.GetMillis()))

		cachedStore.sessionAttribute.handleClusterInvalidateSessionAttributes(&model.ClusterMessage{
			Event: model.ClusterEventInvalidateCacheForSessionAttributes,
			Data:  clearCacheMessageData,
		})

		_, _, err = cachedStore.SessionAttribute().Get(sessionA)
		require.ErrorIs(t, err, cache.ErrKeyNotFound)
		_, _, err = cachedStore.SessionAttribute().Get(sessionB)
		require.ErrorIs(t, err, cache.ErrKeyNotFound)
	})
}
