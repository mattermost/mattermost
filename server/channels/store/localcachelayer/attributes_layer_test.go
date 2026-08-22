// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestAttributesStoreCache(t *testing.T) {
	userID := "user-id"
	logger := mlog.CreateConsoleTestLogger(t)
	rctx := request.TestContext(t)

	t.Run("GetUserPropertyValuesEpoch cached on second call", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		epoch, err := cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		assert.Equal(t, "200-1", epoch)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 1)

		epoch, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		assert.Equal(t, "200-1", epoch)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 1)
	})

	t.Run("InvalidateUserPropertyValuesEpoch forces a re-query", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		_, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 1)

		cachedStore.Attributes().InvalidateUserPropertyValuesEpoch(userID)

		_, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 2)
	})

	t.Run("ClearUserPropertyValuesEpochCache forces a re-query", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		_, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 1)

		cachedStore.Attributes().ClearUserPropertyValuesEpochCache()

		_, err = cachedStore.Attributes().GetUserPropertyValuesEpoch(rctx, userID)
		require.NoError(t, err)
		mockStore.Attributes().(*mocks.AttributesStore).AssertNumberOfCalls(t, "GetUserPropertyValuesEpoch", 2)
	})
}
