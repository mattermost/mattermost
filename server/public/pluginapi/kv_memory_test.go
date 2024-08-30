package pluginapi_test

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/pluginapi"
)

// kvStore is used to check that KVService and MemoryStore implement the same interface.
// Methods names are sorted alphabetically for easier comparison.
type kvStore interface {
	Delete(key string) error
	DeleteAll() error
	Get(key string, o any) error
	ListKeys(page, count int, options ...pluginapi.ListKeysOption) ([]string, error)
	Set(key string, value any, options ...pluginapi.KVSetOption) (bool, error)
	SetAtomicWithRetries(key string, valueFunc func(oldValue []byte) (newValue any, err error)) error
}

var _ kvStore = (*pluginapi.MemoryStore)(nil)
var _ kvStore = (*pluginapi.KVService)(nil)

func TestMemoryStoreSet(t *testing.T) {
	t.Run("empty key", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		ok, err := store.Set("", []byte("value"))
		assert.Error(t, err)
		assert.False(t, ok)
	})

	t.Run("key has mmi_ prefix", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		ok, err := store.Set("mmi_foo", []byte("value"))
		assert.Error(t, err)
		assert.False(t, ok)
	})

	t.Run("nil map", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		ok, err := store.Set("key", []byte("value"))
		assert.NoError(t, err)
		assert.True(t, ok)

		var out []byte
		err = store.Get("key", &out)
		assert.NoError(t, err)
		assert.Equal(t, []byte("value"), out)
	})

	t.Run("atomic with no old value", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		ok, err := store.Set("key", []byte("value"), pluginapi.SetAtomic([]byte("old")))
		assert.NoError(t, err)
		assert.False(t, ok)

		isNil(t, &store, "key")
	})

	t.Run("atomic with same old value", func(t *testing.T) {
		store := pluginapi.MemoryStore{}

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
		store := pluginapi.MemoryStore{}

		ok, err := store.Set("key", []byte("value"))
		assert.NoError(t, err)
		assert.True(t, ok)

		ok, err = store.Set("key", nil)
		assert.NoError(t, err)
		assert.True(t, ok)

		isNil(t, &store, "key")
	})

	t.Run("atomicly setting to nil is deleting", func(t *testing.T) {
		store := pluginapi.MemoryStore{}

		ok, err := store.Set("key", []byte("old"))
		assert.NoError(t, err)
		assert.True(t, ok)

		ok, err = store.Set("key", nil, pluginapi.SetAtomic([]byte("old")))
		assert.NoError(t, err)
		assert.True(t, ok)

		isNil(t, &store, "key")
	})

	t.Run("with long expiry", func(t *testing.T) {
		store := pluginapi.MemoryStore{}

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

		time.Sleep(2 * time.Second)

		isNil(t, &store, "key")
	})

	t.Run("concurrent writes", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		var wg sync.WaitGroup
		const n = 100
		for i := 0; i < n; i++ {
			i := i
			wg.Add(1)
			go func() {
				defer wg.Done()
				ok, err := store.Set(fmt.Sprintf("k_%d", i), []byte("value"))
				require.NoError(t, err)
				require.True(t, ok)
			}()
		}

		wg.Wait()

		for i := 0; i < n; i++ {
			var out []byte
			err := store.Get(fmt.Sprintf("k_%d", i), &out)
			assert.NoError(t, err, "i=%d", i)
			assert.Equal(t, []byte("value"), out, "i=%d", i)
		}
	})
}

func TestMemoryStoreSetAtomicWithRetries(t *testing.T) {
	t.Run("nil function", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		err := store.SetAtomicWithRetries("key", nil)
		assert.Error(t, err)

		isNil(t, &store, "key")
	})

	t.Run("old value not found", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		err := store.SetAtomicWithRetries("key", func(oldValue []byte) (any, error) { return []byte("new"), nil })
		require.NoError(t, err)

		var out []byte
		err = store.Get("key", &out)
		require.NoError(t, err)
		assert.Equal(t, []byte("new"), out)
	})

	t.Run("old value not found", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		err := store.SetAtomicWithRetries("key", func(oldValue []byte) (any, error) { return nil, errors.New("some error") })
		require.Error(t, err)

		isNil(t, &store, "key")
	})

	t.Run("two goroutines race", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		var wg sync.WaitGroup
		const n = 10
		for i := 0; i < n; i++ {
			i := i
			wg.Add(1)
			go func() {
				defer wg.Done()
				err := store.SetAtomicWithRetries("key", func(oldValue []byte) (any, error) { return fmt.Sprintf("k_%d", i), nil })
				require.NoError(t, err)
			}()
		}

		wg.Wait()

		// It undefinded, which goroutine wins the final write. Just check that any value was written.
		var out string
		err := store.Get("key", &out)
		require.NoError(t, err)
		assert.True(t, strings.HasPrefix(out, "k_"))
	})
}

func TestMemoryStoreListKeys(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		keys, err := store.ListKeys(0, 200)
		assert.NoError(t, err)
		assert.Len(t, keys, 0)
	})

	t.Run("zero count", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
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
		store := pluginapi.MemoryStore{}
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
		store := pluginapi.MemoryStore{}
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
		store := pluginapi.MemoryStore{}
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
		store := pluginapi.MemoryStore{}
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
		store := pluginapi.MemoryStore{}
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

	t.Run("with expired entries", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		for i := 0; i < 7; i++ {
			var opt pluginapi.KVSetOption
			if i%2 == 1 {
				opt = pluginapi.SetExpiry(1 * time.Second)
			}
			ok, err := store.Set(fmt.Sprintf("k_%d", i), "foo", opt)
			require.NoError(t, err)
			require.True(t, ok)
		}

		time.Sleep(2 * time.Second)

		keys, err := store.ListKeys(0, 5)
		assert.NoError(t, err)
		assert.Equal(t, []string{"k_0", "k_2", "k_4", "k_6"}, keys)
	})
}

func TestMemoryStoreGet(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		isNil(t, &store, "key")
	})

	t.Run("set empty byte slice", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		in := []byte("")

		ok, err := store.Set("key", in)
		assert.NoError(t, err)
		assert.True(t, ok)

		isNil(t, &store, "key")
	})

	t.Run("set and get byte slice", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
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
		store := pluginapi.MemoryStore{}

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

func TestMemoryStoreDelete(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		err := store.Delete("some key")
		assert.NoError(t, err)
	})
}

func TestMemoryStoreDeleteAll(t *testing.T) {
	t.Run("nil map", func(t *testing.T) {
		store := pluginapi.MemoryStore{}
		err := store.DeleteAll()
		assert.NoError(t, err)
		keys, err := store.ListKeys(0, 200)
		assert.NoError(t, err)
		assert.Empty(t, keys)
	})

	t.Run("nil map", func(t *testing.T) {
		store := pluginapi.MemoryStore{}

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
		store := pluginapi.MemoryStore{}
		err := store.DeleteAll()
		assert.NoError(t, err)
		err = store.DeleteAll()
		assert.NoError(t, err)
		keys, err := store.ListKeys(0, 200)
		assert.NoError(t, err)
		assert.Empty(t, keys)
	})
}

func isNil(t require.TestingT, store *pluginapi.MemoryStore, key string) {
	var out []byte
	err := store.Get(key, &out)
	require.NoError(t, err)
	assert.Nil(t, out)
}
