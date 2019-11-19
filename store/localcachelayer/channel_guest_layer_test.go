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

func TestGuestLayerStore(t *testing.T) {
	StoreTest(t, storetest.TestFileInfoStore)
}

func TestFileInfoStoreCache(t *testing.T) {
	fakeChannel := model.Channel{Id: "123"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		channel, err := cachedStore.Channel().GetGuestCount("123", true)
		require.Nil(t, err)
		assert.Equal(t, channel, []*model.Channel{&fakeChannel})
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
		assert.Equal(t, channel, []*model.Channel{&fakeChannel})
		cachedStore.Channel().GetGuestCount("123", true)
		mockStore.Channel().(*mocks.ChannelStore).AssertNumberOfCalls(t, "GetGuestCount", 1)
	})
}
