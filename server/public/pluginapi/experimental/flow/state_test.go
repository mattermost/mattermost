// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package flow

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStateGet(t *testing.T) {
	s := State{
		"str":   "hello",
		"int":   42,
		"bool":  true,
		"float": float64(7),
	}

	t.Run("present", func(t *testing.T) {
		assert.Equal(t, "hello", s.Get[string]("str"))
		assert.Equal(t, 42, s.Get[int]("int"))
		assert.True(t, s.Get[bool]("bool"))
	})

	t.Run("missing", func(t *testing.T) {
		assert.Equal(t, "", s.Get[string]("missing"))
		assert.Equal(t, 0, s.Get[int]("missing"))
		assert.False(t, s.Get[bool]("missing"))
	})

	t.Run("wrong type", func(t *testing.T) {
		assert.Equal(t, "", s.Get[string]("int"))
		assert.Equal(t, 0, s.Get[int]("str"))
		assert.False(t, s.Get[bool]("str"))
	})

	t.Run("json-style float is not an int", func(t *testing.T) {
		assert.Equal(t, 0, s.Get[int]("float"))
		assert.Equal(t, float64(7), s.Get[float64]("float"))
	})

	t.Run("nil state", func(t *testing.T) {
		var nilState State
		assert.Equal(t, "", nilState.Get[string]("str"))
	})

	t.Run("nil value", func(t *testing.T) {
		withNil := State{"k": nil}
		assert.Equal(t, 0, withNil.Get[int]("k"))
		assert.Nil(t, withNil.Get[any]("k"))
	})
}

func TestStateGettersMatchGet(t *testing.T) {
	s := State{"str": "hello", "int": 42, "bool": true, "float": float64(7)}

	for _, key := range []string{"str", "int", "bool", "float", "missing"} {
		assert.Equal(t, s.Get[string](key), s.GetString(key), key)
		assert.Equal(t, s.Get[int](key), s.GetInt(key), key)
		assert.Equal(t, s.Get[bool](key), s.GetBool(key), key)
	}
}
