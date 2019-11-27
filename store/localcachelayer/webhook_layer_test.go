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

func TestWebhookStore(t *testing.T) {
	StoreTest(t, storetest.TestWebhookStore)
}

func TestWebhookStoreCache(t *testing.T) {
	fakeWebhook := model.IncomingWebhook{Id: "123"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		incomingWebhook, err := cachedStore.Webhook().GetIncoming("123", true)
		require.Nil(t, err)
		assert.Equal(t, incomingWebhook, &fakeWebhook)
		mockStore.Webhook().(*mocks.WebhookStore).AssertNumberOfCalls(t, "GetIncoming", 1)

		assert.Equal(t, incomingWebhook, &fakeWebhook)
		cachedStore.Webhook().GetIncoming("123", true)
		mockStore.Webhook().(*mocks.WebhookStore).AssertNumberOfCalls(t, "GetIncoming", 1)
	})

	t.Run("first call not cached, second force no cached", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Webhook().GetIncoming("123", true)
		mockStore.Webhook().(*mocks.WebhookStore).AssertNumberOfCalls(t, "GetIncoming", 1)
		cachedStore.Webhook().GetIncoming("123", false)
		mockStore.Webhook().(*mocks.WebhookStore).AssertNumberOfCalls(t, "GetIncoming", 2)
	})

	t.Run("first call not cached, invalidate, and then not cached again", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		cachedStore.Webhook().GetIncoming("123", true)
		mockStore.Webhook().(*mocks.WebhookStore).AssertNumberOfCalls(t, "GetIncoming", 1)
		cachedStore.Webhook().InvalidateWebhookCache("123")
		cachedStore.Webhook().GetIncoming("123", true)
		mockStore.Webhook().(*mocks.WebhookStore).AssertNumberOfCalls(t, "GetIncoming", 2)
	})
}
