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

func TestAccessControlPolicyStoreCache(t *testing.T) {
	channelID := "channel-id"
	logger := mlog.CreateConsoleTestLogger(t)
	rctx := request.TestContext(t)

	t.Run("GetEtagEpoch cached on second call", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		epoch, err := cachedStore.AccessControlPolicy().GetEtagEpoch(rctx, channelID)
		require.NoError(t, err)
		assert.Equal(t, "100-1", epoch)
		mockStore.AccessControlPolicy().(*mocks.AccessControlPolicyStore).AssertNumberOfCalls(t, "GetEtagEpoch", 1)

		epoch, err = cachedStore.AccessControlPolicy().GetEtagEpoch(rctx, channelID)
		require.NoError(t, err)
		assert.Equal(t, "100-1", epoch)
		mockStore.AccessControlPolicy().(*mocks.AccessControlPolicyStore).AssertNumberOfCalls(t, "GetEtagEpoch", 1)
	})

	t.Run("InvalidateEtagForChannel forces a re-query", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		_, err = cachedStore.AccessControlPolicy().GetEtagEpoch(rctx, channelID)
		require.NoError(t, err)
		mockStore.AccessControlPolicy().(*mocks.AccessControlPolicyStore).AssertNumberOfCalls(t, "GetEtagEpoch", 1)

		cachedStore.AccessControlPolicy().InvalidateEtagForChannel(channelID)

		_, err = cachedStore.AccessControlPolicy().GetEtagEpoch(rctx, channelID)
		require.NoError(t, err)
		mockStore.AccessControlPolicy().(*mocks.AccessControlPolicyStore).AssertNumberOfCalls(t, "GetEtagEpoch", 2)
	})

	t.Run("ClearEtagCache forces a re-query", func(t *testing.T) {
		mockStore := getMockStore(t)
		cachedStore, err := NewLocalCacheLayer(mockStore, nil, nil, getMockCacheProvider(), logger)
		require.NoError(t, err)

		_, err = cachedStore.AccessControlPolicy().GetEtagEpoch(rctx, channelID)
		require.NoError(t, err)
		mockStore.AccessControlPolicy().(*mocks.AccessControlPolicyStore).AssertNumberOfCalls(t, "GetEtagEpoch", 1)

		cachedStore.AccessControlPolicy().ClearEtagCache()

		_, err = cachedStore.AccessControlPolicy().GetEtagEpoch(rctx, channelID)
		require.NoError(t, err)
		mockStore.AccessControlPolicy().(*mocks.AccessControlPolicyStore).AssertNumberOfCalls(t, "GetEtagEpoch", 2)
	})
}
