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

func TestSchemeStore(t *testing.T) {
	StoreTest(t, storetest.TestSchemeStore)
}

func TestSchemeStoreCache(t *testing.T) {
	fakeScheme := model.Scheme{Id: "123", Name: "scheme-name"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		scheme, err := cachedStore.Scheme().Get("123")
		require.Nil(t, err)
		assert.Equal(t, scheme, &fakeScheme)
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
		require.Nil(t, err)
		assert.Equal(t, scheme, &fakeScheme)
		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("first call not cached, save, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Scheme().Save(&fakeScheme)
		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, delete, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Scheme().Delete("123")
		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 2)
	})

	t.Run("first call not cached, permanent delete all, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		mockCacheProvider := getMockCacheProvider()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil, mockCacheProvider)

		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 1)
		cachedStore.Scheme().PermanentDeleteAll()
		cachedStore.Scheme().Get("123")
		mockStore.Scheme().(*mocks.SchemeStore).AssertNumberOfCalls(t, "Get", 2)
	})
}
