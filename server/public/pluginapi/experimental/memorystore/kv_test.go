package memorystore

import (
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSet(t *testing.T) {
	t.Run("empty key", func(t *testing.T) {
		store := Store{}
		ok, err := store.Set("", []byte("value"))
		assert.Error(t, err)
		assert.False(t, ok)
	})

	t.Run("key has mmi_ prefix", func(t *testing.T) {
		store := Store{}
		ok, err := store.Set("mmi_foo", []byte("value"))
		assert.Error(t, err)
		assert.False(t, ok)
	})

	t.Run("nil map", func(t *testing.T) {
		store := Store{}
		ok, err := store.Set("key", []byte("value"))
		assert.NoError(t, err)
		assert.True(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Equal(t, []byte("value"), out)
	})

	t.Run("atomic with no old value", func(t *testing.T) {
		store := Store{}
		ok, err := store.Set("key", []byte("value"), pluginapi.SetAtomic([]byte("old")))
		assert.NoError(t, err)
		assert.False(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Nil(t, out)
	})

	t.Run("atomic with same old value", func(t *testing.T) {
		store := Store{}

		ok, err := store.Set("key", []byte("old"))
		assert.NoError(t, err)
		assert.True(t, ok)

		ok, err = store.Set("key", []byte("new"), pluginapi.SetAtomic([]byte("old")))
		assert.NoError(t, err)
		assert.True(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Equal(t, []byte("new"), out)
	})

	t.Run("setting to nil is deleting", func(t *testing.T) {
		store := Store{}

		ok, err := store.Set("key", []byte("value"))
		assert.NoError(t, err)
		assert.True(t, ok)

		ok, err = store.Set("key", nil)
		assert.NoError(t, err)
		assert.True(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Nil(t, out)
	})

	t.Run("atomicly setting to nil is deleting", func(t *testing.T) {
		store := Store{}

		ok, err := store.Set("key", []byte("old"))
		assert.NoError(t, err)
		assert.True(t, ok)

		ok, err = store.Set("key", nil, pluginapi.SetAtomic([]byte("old")))
		assert.NoError(t, err)
		assert.True(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Nil(t, out)
	})

	t.Run("with long expiry", func(t *testing.T) {
		store := Store{}

		ok, err := store.Set("key", []byte("value"), pluginapi.SetExpiry(time.Minute))
		assert.NoError(t, err)
		assert.True(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Equal(t, []byte("value"), out)

		ok, err = store.Set("key", []byte("value"), pluginapi.SetExpiry(time.Second))
		assert.NoError(t, err)
		assert.True(t, ok)

		time.Sleep(time.Second)

		out = nil
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Nil(t, out)
	})
}

func TestSetAtomicWithRetries(t *testing.T) {
	t.Run("nil function", func(t *testing.T) {
		store := Store{}
		err := store.SetAtomicWithRetries("key", nil)
		assert.Error(t, err)
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
