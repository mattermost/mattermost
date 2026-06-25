// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestChunkDeliveryIDs(t *testing.T) {
	t.Run("nil/empty input returns nil", func(t *testing.T) {
		require.Nil(t, chunkDeliveryIDs(nil, 100))
		require.Nil(t, chunkDeliveryIDs([]string{}, 100))
	})

	t.Run("all-empty ids return nil", func(t *testing.T) {
		require.Nil(t, chunkDeliveryIDs([]string{"", "", ""}, 100))
	})

	t.Run("single chunk reuses the input backing array (no copy)", func(t *testing.T) {
		ids := []string{"a", "b", "c"}
		chunks := chunkDeliveryIDs(ids, 100)
		require.Len(t, chunks, 1)
		require.Equal(t, ids, chunks[0])
		// Same backing array: mutating the input is visible through the chunk.
		ids[0] = "z"
		require.Equal(t, "z", chunks[0][0])
	})

	t.Run("splits into chunks of at most size", func(t *testing.T) {
		ids := []string{"a", "b", "c", "d", "e"}
		chunks := chunkDeliveryIDs(ids, 2)
		require.Len(t, chunks, 3)
		require.Equal(t, []string{"a", "b"}, chunks[0])
		require.Equal(t, []string{"c", "d"}, chunks[1])
		require.Equal(t, []string{"e"}, chunks[2])
	})

	t.Run("compacts empty ids before chunking", func(t *testing.T) {
		ids := []string{"a", "", "b", "", "c"}
		chunks := chunkDeliveryIDs(ids, 100)
		require.Len(t, chunks, 1)
		require.Equal(t, []string{"a", "b", "c"}, chunks[0])
	})

	t.Run("exact multiple of size", func(t *testing.T) {
		chunks := chunkDeliveryIDs([]string{"a", "b", "c", "d"}, 2)
		require.Len(t, chunks, 2)
		require.Equal(t, []string{"a", "b"}, chunks[0])
		require.Equal(t, []string{"c", "d"}, chunks[1])
	})
}

func TestDeliveryMeta(t *testing.T) {
	t.Run("user target type is omitted (target defaults to user)", func(t *testing.T) {
		meta := deliveryMeta(model.DeliveryTargetUser, model.DeliveryMechProduct)
		require.Equal(t, model.DeliveryMechProduct, meta["mechanism"])
		_, ok := meta["target_type"]
		require.False(t, ok, "target_type should be omitted for the default user type")
	})

	t.Run("empty target type is omitted", func(t *testing.T) {
		meta := deliveryMeta("", model.DeliveryMechPush)
		_, ok := meta["target_type"]
		require.False(t, ok)
	})

	t.Run("non-user target type is written", func(t *testing.T) {
		meta := deliveryMeta(model.DeliveryTargetWebhook, model.DeliveryMechOutgoingWebhook)
		require.Equal(t, model.DeliveryTargetWebhook, meta["target_type"])
		require.Equal(t, model.DeliveryMechOutgoingWebhook, meta["mechanism"])
	})

	t.Run("mechanism is stored as int16 for the target's type assertion", func(t *testing.T) {
		meta := deliveryMeta(model.DeliveryTargetPlugin, model.DeliveryMechPlugin)
		v, ok := meta["mechanism"].(int16)
		require.True(t, ok, "mechanism must be int16 so the audit target can assert it")
		require.Equal(t, model.DeliveryMechPlugin, v)
	})
}
