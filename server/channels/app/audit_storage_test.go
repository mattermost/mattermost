// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestChunkDeliveryIDs(t *testing.T) {
	t.Run("empty input returns nil", func(t *testing.T) {
		assert.Nil(t, chunkDeliveryIDs(nil, 10))
		assert.Nil(t, chunkDeliveryIDs([]string{}, 10))
	})

	t.Run("all empty strings returns nil", func(t *testing.T) {
		assert.Nil(t, chunkDeliveryIDs([]string{"", "", ""}, 10))
	})

	t.Run("filters empty strings then chunks", func(t *testing.T) {
		got := chunkDeliveryIDs([]string{"a", "", "b", "", "c"}, 10)
		assert.Equal(t, [][]string{{"a", "b", "c"}}, got)
	})

	t.Run("single chunk when below size", func(t *testing.T) {
		got := chunkDeliveryIDs([]string{"a", "b", "c"}, 10)
		assert.Equal(t, [][]string{{"a", "b", "c"}}, got)
	})

	t.Run("exact multiple of chunk size", func(t *testing.T) {
		got := chunkDeliveryIDs([]string{"a", "b", "c", "d"}, 2)
		assert.Equal(t, [][]string{{"a", "b"}, {"c", "d"}}, got)
	})

	t.Run("uneven trailing chunk", func(t *testing.T) {
		got := chunkDeliveryIDs([]string{"a", "b", "c", "d", "e"}, 2)
		assert.Equal(t, [][]string{{"a", "b"}, {"c", "d"}, {"e"}}, got)
	})

	t.Run("large input splits into many chunks", func(t *testing.T) {
		input := make([]string, 2500)
		for i := range input {
			input[i] = "id"
		}
		got := chunkDeliveryIDs(input, 1000)
		assert.Len(t, got, 3)
		assert.Len(t, got[0], 1000)
		assert.Len(t, got[1], 1000)
		assert.Len(t, got[2], 500)
	})
}
