package memorystore

import (
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

	t.Run("zero count", func(t *testing.T) {
		store := Store{}
		for i := 0; i < 10; i++ {
			ok, err := store.Set(fmt.Sprintf("k_%d", i), "foo")
			require.NoError(t, err)
			require.True(t, ok)
		}
		keys, err := store.ListKeys(1, 0)
		assert.NoError(t, err)
		assert.Len(t, keys, 0)
	})

	t.Run("negative count", func(t *testing.T) {
		store := Store{}
		for i := 0; i < 10; i++ {
			ok, err := store.Set(fmt.Sprintf("k_%d", i), "foo")
			require.NoError(t, err)
			require.True(t, ok)
		}
		keys, err := store.ListKeys(0, -1)
		assert.Error(t, err)
		assert.Len(t, keys, 0)
	})

	t.Run("negative page", func(t *testing.T) {
		store := Store{}
		for i := 0; i < 10; i++ {
			ok, err := store.Set(fmt.Sprintf("k_%d", i), "foo")
			require.NoError(t, err)
			require.True(t, ok)
		}
		keys, err := store.ListKeys(-1, 200)
		assert.Error(t, err)
		assert.Len(t, keys, 0)
	})

	t.Run("single page", func(t *testing.T) {
		store := Store{}
		for i := 0; i < 10; i++ {
			ok, err := store.Set(fmt.Sprintf("k_%d", i), "foo")
			require.NoError(t, err)
			require.True(t, ok)
		}
		keys, err := store.ListKeys(0, 200)
		assert.NoError(t, err)
		assert.Len(t, keys, 10)
	})

	t.Run("multiple pages", func(t *testing.T) {
		store := Store{}
		for i := 0; i < 7; i++ {
			ok, err := store.Set(fmt.Sprintf("k_%d", i), "foo")
			require.NoError(t, err)
			require.True(t, ok)
		}
		keys, err := store.ListKeys(0, 3)
		assert.NoError(t, err)
		assert.Equal(t, []string{"k_0", "k_1", "k_2"}, keys)

		keys, err = store.ListKeys(1, 3)
		assert.NoError(t, err)
		assert.Equal(t, []string{"k_3", "k_4", "k_5"}, keys)

		keys, err = store.ListKeys(2, 3)
		assert.NoError(t, err)
		assert.Equal(t, []string{"k_6"}, keys)

		keys, err = store.ListKeys(5, 100)
		assert.NoError(t, err)
		assert.Equal(t, []string{}, keys)
	})

	t.Run("with checker", func(t *testing.T) {
		store := Store{}
		odd := func(key string) (bool, error) {
			s := strings.Split(key, "_")
			if len(s) != 2 {
				return false, errors.Errorf("wrongly formated key %v", key)
			}
			i, err := strconv.Atoi(s[1])
			if err != nil {
				return false, err
			}

			return i%2 == 1, nil
		}
		even := func(key string) (bool, error) {
			s := strings.Split(key, "_")
			if len(s) != 2 {
				return false, errors.Errorf("wrongly formated key %v", key)
			}
			i, err := strconv.Atoi(s[1])
			if err != nil {
				return false, err
			}

			return i%2 == 0, nil
		}
		for i := 0; i < 7; i++ {
			ok, err := store.Set(fmt.Sprintf("k_%d", i), "foo")
			require.NoError(t, err)
			require.True(t, ok)
		}
		keys, err := store.ListKeys(0, 3, pluginapi.WithChecker(even))
		assert.NoError(t, err)
		assert.Equal(t, []string{"k_0", "k_2"}, keys)

		keys, err = store.ListKeys(0, 3, pluginapi.WithChecker(odd))
		assert.NoError(t, err)
		assert.Equal(t, []string{"k_1"}, keys)

		keys, err = store.ListKeys(0, 3, pluginapi.WithChecker(odd), pluginapi.WithChecker(even))
		assert.NoError(t, err)
		assert.Equal(t, []string{}, keys)

		keys, err = store.ListKeys(1, 3)
		assert.NoError(t, err)
		assert.Equal(t, []string{"k_3", "k_4", "k_5"}, keys)

		keys, err = store.ListKeys(2, 3)
		assert.NoError(t, err)
		assert.Equal(t, []string{"k_6"}, keys)
	})
}

func TestGet(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := Store{}
		var o []byte
		err := store.Get("key", &o)
		assert.NoError(t, err)
		assert.Nil(t, o)
	})

	t.Run("set empty byte slice", func(t *testing.T) {
		store := Store{}
		in := []byte("")

		ok, err := store.Set("key", in)
		assert.NoError(t, err)
		assert.True(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Nil(t, out)
	})

	t.Run("set and get byte slice", func(t *testing.T) {
		store := Store{}
		in := []byte("foo")

		ok, err := store.Set("key", in)
		assert.NoError(t, err)
		assert.True(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Equal(t, []byte("foo"), out)
	})

	t.Run("set and get struct slice", func(t *testing.T) {
		store := Store{}

		type myStruct struct {
			Int        int
			String     string
			unExported bool
		}
		in := myStruct{
			Int:        1,
			String:     "s",
			unExported: true,
		}

		ok, err := store.Set("key", in)
		assert.NoError(t, err)
		assert.True(t, ok)

		var out myStruct
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Equal(t, myStruct{Int: 1, String: "s"}, out)
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
		keys, err := store.ListKeys(0, 200)
		assert.NoError(t, err)
		assert.Empty(t, keys)
	})

	t.Run("nil map", func(t *testing.T) {
		store := Store{}

		ok, err := store.Set("k_1", "foo")
		require.NoError(t, err)
		require.True(t, ok)

		err = store.DeleteAll()
		assert.NoError(t, err)
		keys, err := store.ListKeys(0, 200)
		assert.NoError(t, err)
		assert.Empty(t, keys)
	})

	t.Run("idempotent", func(t *testing.T) {
		store := Store{}
		err := store.DeleteAll()
		assert.NoError(t, err)
		err = store.DeleteAll()
		assert.NoError(t, err)
		keys, err := store.ListKeys(0, 200)
		assert.NoError(t, err)
		assert.Empty(t, keys)
	})
}
