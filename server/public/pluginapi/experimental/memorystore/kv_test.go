package memorystore

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSet(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := Store{}
		ok, err := store.Set("key", []byte("value"))
		assert.NoError(t, err)
		assert.True(t, ok)
	})

}

func TestListKeys(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := Store{}
		keys, err := store.ListKeys(0, 200)
		assert.NoError(t, err)
		assert.Len(t, keys, 0)
	})
}

func TestDelete(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := Store{}
		err := store.Delete("some key")
		assert.NoError(t, err)
	})
}

func TestDeleteAll(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := Store{}
		err := store.DeleteAll()
		assert.NoError(t, err)
	})
}
