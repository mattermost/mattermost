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

func TestSchemeStore(t *testing.T) {
	StoreTest(t, storetest.TestSchemeStore)
}

func TestSchemeStoreCache(t *testing.T) {
	fakeScheme := model.Scheme{Id: "123", Name: "scheme-name"}
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		scheme, err := cachedStore.Scheme().Get("123")
		require.NoError(t, err)
		assert.Equal(t, scheme, &fakeScheme)
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
		require.NoError(t, err)
		assert.Equal(t, scheme, &fakeScheme)
		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Scheme().Save(&fakeScheme)
		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Scheme().Delete("123")
		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, permanent delete all, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore(t)
		mockCacheProvider := getMockCacheProvider()
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider, logger)
		require.NoError(t, err)

		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Scheme().PermanentDeleteAll()
		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 2)
	})
}
