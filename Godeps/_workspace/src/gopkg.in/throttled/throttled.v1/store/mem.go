package store

import (
	"sync"
	"time"

	"github.com/mattermost/platform/Godeps/_workspace/src/github.com/golang/groupcache/lru"
	"github.com/mattermost/platform/Godeps/_workspace/src/gopkg.in/throttled/throttled.v1"
)

// memStore implements an in-memory Store.
type memStore struct {
	sync.Mutex
	keys *lru.Cache
	m    map[string]*counter
}

// NewMemStore creates a new MemStore. If maxKeys > 0, the number of different keys
// is restricted to the specified amount. In this case, it uses an LRU algorithm to
// evict older keys to make room for newer ones. If a request is made for a key that
// has been evicted, it will be processed as if its count was 0, possibly allowing requests
// that should be denied.
//
// If maxKeys <= 0, there is no limit on the number of keys, which may use an unbounded amount of
// memory depending on the server's load.
//
// The MemStore is only for single-process rate-limiting. To share the rate limit state
// among multiple instances of the web server, use a database- or key-value-based
// store.
//
func NewMemStore(maxKeys int) throttled.Store {
	var m *memStore
	if maxKeys > 0 {
		m = &memStore{
			keys: lru.New(maxKeys),
		}
	} else {
		m = &memStore{
			m: make(map[string]*counter),
		}
	}
	return m
}

// A counter represents a single entry in the MemStore.
type counter struct {
	n  int
	ts time.Time
}

// Incr increments the counter for the specified key. It returns the new
// count value and the remaining number of seconds, or an error.
func (ms *memStore) Incr(key string, window time.Duration) (int, int, error) {
	ms.Lock()
	defer ms.Unlock()
	var c *counter
	if ms.keys != nil {
		v, _ := ms.keys.Get(key)
		if v != nil {
			c = v.(*counter)
		}
	} else {
		c = ms.m[key]
	}
	if c == nil {
		c = &counter{0, time.Now().UTC()}
	}
	c.n++
	if ms.keys != nil {
		ms.keys.Add(key, c)
	} else {
		ms.m[key] = c
	}
	return c.n, throttled.RemainingSeconds(c.ts, window), nil
}

// Reset resets the counter for the specified key. It sets the count
// to 1 and initializes the timestamp with the current time, in UTC.
// It returns an error if the operation fails.
func (ms *memStore) Reset(key string, win time.Duration) error {
	ms.Lock()
	defer ms.Unlock()
	c := &counter{1, time.Now().UTC()}
	if ms.keys != nil {
		ms.keys.Add(key, c)
	} else {
		ms.m[key] = c
	}
	return nil
}
