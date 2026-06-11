// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChunkDeliveryIDs(t *testing.T) {
	t.Run("nil when empty or all blank", func(t *testing.T) {
		require.Nil(t, chunkDeliveryIDs(nil, 5000))
		require.Nil(t, chunkDeliveryIDs([]string{}, 5000))
		require.Nil(t, chunkDeliveryIDs([]string{"", ""}, 5000))
	})

	t.Run("drops blank ids", func(t *testing.T) {
		chunks := chunkDeliveryIDs([]string{"a", "", "b", ""}, 5000)
		require.Equal(t, [][]string{{"a", "b"}}, chunks)
	})

	t.Run("single chunk when under size", func(t *testing.T) {
		chunks := chunkDeliveryIDs([]string{"a", "b", "c"}, 5000)
		require.Len(t, chunks, 1)
		require.Equal(t, []string{"a", "b", "c"}, chunks[0])
	})

	t.Run("splits on size boundary", func(t *testing.T) {
		ids := make([]string, 12001)
		for i := range ids {
			ids[i] = "u"
		}
		chunks := chunkDeliveryIDs(ids, 5000)
		require.Len(t, chunks, 3) // 5000 + 5000 + 2001
		require.Len(t, chunks[0], 5000)
		require.Len(t, chunks[1], 5000)
		require.Len(t, chunks[2], 2001)

		var total int
		for _, c := range chunks {
			total += len(c)
		}
		require.Equal(t, 12001, total)
	})
}
