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
	s := State{"str": "hello", "int": 42, "bool": true}

	t.Run("present", func(t *testing.T) {
		assert.Equal(t, "hello", s.Get[string]("str"))
		assert.Equal(t, 42, s.Get[int]("int"))
		assert.True(t, s.Get[bool]("bool"))
	})

	t.Run("missing", func(t *testing.T) {
		assert.Equal(t, "", s.Get[string]("nope"))
		assert.Equal(t, 0, s.Get[int]("nope"))
		assert.False(t, s.Get[bool]("nope"))
	})

	t.Run("wrong type", func(t *testing.T) {
		assert.Equal(t, "", s.Get[string]("int"))
		assert.Equal(t, 0, s.Get[int]("str"))
		assert.False(t, s.Get[bool]("str"))
	})

	t.Run("nil state", func(t *testing.T) {
		var nilState State
		assert.Equal(t, "", nilState.Get[string]("str"))
		assert.Equal(t, 0, nilState.GetInt("int"))
	})

	t.Run("json round-tripped number is a float64", func(t *testing.T) {
		data, err := json.Marshal(s)
		require.NoError(t, err)
		var rt State
		require.NoError(t, json.Unmarshal(data, &rt))
		assert.Equal(t, 0, rt.Get[int]("int"))
		assert.Equal(t, 42.0, rt.Get[float64]("int"))
	})
}

func TestStateGettersMatchGet(t *testing.T) {
	s := State{"str": "hello", "int": 42, "bool": true}
	for _, key := range []string{"str", "int", "bool", "nope"} {
		assert.Equal(t, s.Get[string](key), s.GetString(key), key)
		assert.Equal(t, s.Get[int](key), s.GetInt(key), key)
		assert.Equal(t, s.Get[bool](key), s.GetBool(key), key)
	}
}
