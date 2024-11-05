package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSafeDereference(t *testing.T) {
	t.Run("any", func(t *testing.T) {
		s := SafeDereference[any](nil)
		assert.Nil(t, s)
	})

	t.Run("struct", func(t *testing.T) {
		s := SafeDereference[struct{}](nil)
		assert.Equal(t, struct{}{}, s)

		s = SafeDereference(&struct{}{})
		assert.Equal(t, struct{}{}, s)
	})

	t.Run("string", func(t *testing.T) {
		s := SafeDereference[string](nil)
		assert.Equal(t, "", s)

		s = SafeDereference(NewPointer("foo"))
		assert.Equal(t, "foo", s)
	})

	t.Run("string pointer", func(t *testing.T) {
		s := SafeDereference[*string](nil)
		assert.Nil(t, s)

		f := NewPointer("foo")
		s = SafeDereference(&f)
		assert.Equal(t, f, s)
	})
}
