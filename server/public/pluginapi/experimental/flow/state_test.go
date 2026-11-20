// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package flow

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStateGet(t *testing.T) {
	s := State{
		"string": "value",
		"int":    42,
		"bool":   true,
		"nil":    nil,
	}

	t.Run("string", func(t *testing.T) {
		assert.Equal(t, "value", s.Get[string]("string"))
		assert.Equal(t, "", s.Get[string]("missing"))
		assert.Equal(t, "", s.Get[string]("int"))
		assert.Equal(t, "", s.Get[string]("nil"))
	})

	t.Run("int", func(t *testing.T) {
		assert.Equal(t, 42, s.Get[int]("int"))
		assert.Equal(t, 0, s.Get[int]("missing"))
		assert.Equal(t, 0, s.Get[int]("string"))
	})

	t.Run("bool", func(t *testing.T) {
		assert.True(t, s.Get[bool]("bool"))
		assert.False(t, s.Get[bool]("missing"))
		assert.False(t, s.Get[bool]("string"))
	})

	t.Run("json round-tripped number is a float64", func(t *testing.T) {
		data, err := json.Marshal(State{"n": 7})
		require.NoError(t, err)

		var rt State
		require.NoError(t, json.Unmarshal(data, &rt))

		assert.Equal(t, 0, rt.Get[int]("n"))
		assert.InDelta(t, 7.0, rt.Get[float64]("n"), 0)
	})

	t.Run("nil state", func(t *testing.T) {
		var nilState State
		assert.Equal(t, "", nilState.Get[string]("key"))
	})
}
