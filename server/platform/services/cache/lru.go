// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"container/list"
	"sync"
	"time"

	"github.com/tinylib/msgp/msgp"
	"github.com/vmihailenco/msgpack/v5"

	"github.com/mattermost/mattermost/server/public/model"
)

// LRU is a thread-safe fixed size LRU cache.
type LRU struct {
	lock                   sync.RWMutex
	size                   int
	len                    int
	currentGeneration      int64
	evictList              *list.List
	items                  map[string]*list.Element
	defaultExpiry          time.Duration
	name                   string
	invalidateClusterEvent model.ClusterEvent
}

// entry is used to hold a value in the evictList.
type entry struct {
	key        string
	value      []byte
	expires    time.Time
	generation int64
}

// NewLRU creates an LRU of the given size.
func NewLRU(opts *CacheOptions) Cache {
	return &LRU{
		name:                   opts.Name,
		size:                   opts.Size,
		evictList:              list.New(),
		items:                  make(map[string]*list.Element, opts.Size),
		defaultExpiry:          opts.DefaultExpiry,
		invalidateClusterEvent: opts.InvalidateClusterEvent,
	}
}

// Purge is used to completely clear the cache.
func (l *LRU) Purge() error {
	l.lock.Lock()
	defer l.lock.Unlock()

	l.len = 0
	l.currentGeneration++
	return nil
}

// SetWithDefaultExpiry adds the given key and value to the store with the default expiry. If
// the key already exists, it will overwrite the previous value
func (l *LRU) SetWithDefaultExpiry(key string, value any) error {
	return l.SetWithExpiry(key, value, l.defaultExpiry)
}

// SetWithExpiry adds the given key and value to the cache with the given expiry. If the key
// already exists, it will overwrite the previous value
func (l *LRU) SetWithExpiry(key string, value any, ttl time.Duration) error {
	return l.set(key, value, ttl)
}

// Get the content stored in the cache for the given key, and decode it into the value interface.
// return ErrKeyNotFound if the key is missing from the cache
func (l *LRU) Get(key string, value any) error {
	return l.get(key, value)
}

func (l *LRU) GetMulti(keys []string, values []any) []error {
	errs := make([]error, 0, len(values))
	for i, key := range keys {
		errs = append(errs, l.get(key, values[i]))
	}

	return errs
}

// Remove deletes the value for a key.
func (l *LRU) Remove(key string) error {
	l.lock.Lock()
	defer l.lock.Unlock()

	if ent, ok := l.items[key]; ok {
		l.removeElement(ent)
	}
	return nil
}

func (l *LRU) RemoveMulti(keys []string) error {
	l.lock.Lock()
	defer l.lock.Unlock()

	// Note, this is a copy of l.Remove. But we want to avoid
	// fine-grained locking for every single removal. Therefore,
	// we copy a bit of code for simplicity.
	for _, key := range keys {
		if ent, ok := l.items[key]; ok {
			l.removeElement(ent)
		}
	}

	return nil
}

// Scan passes the whole slice of keys to the callback in LRU mode.
// We don't need this callback style for LRU, but since we share
// the same interface with Redis, we maintain parity.
func (l *LRU) Scan(f func([]string) error) error {
	l.lock.RLock()
	keys := make([]string, l.len)
	i := 0
	for ent := l.evictList.Back(); ent != nil; ent = ent.Prev() {
		e := ent.Value.(*entry)
		if e.generation == l.currentGeneration {
			keys[i] = e.key
			i++
		}
	}
	l.lock.RUnlock()

	return f(keys)
}

// Len returns the number of items in the cache.
func (l *LRU) Len() (int, error) {
	l.lock.RLock()
	defer l.lock.RUnlock()
	return l.len, nil
}

// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
func (l *LRU) GetInvalidateClusterEvent() model.ClusterEvent {
	return l.invalidateClusterEvent
}

// Name returns the name of the cache
func (l *LRU) Name() string {
	return l.name
}

func (l *LRU) set(key string, value any, ttl time.Duration) error {
	var expires time.Time
	if ttl > 0 {
		expires = time.Now().Add(ttl)
	}

	var buf []byte
	var err error
	// We use a fast path for hot structs.
	if msgpVal, ok := value.(msgp.Marshaler); ok {
		buf, err = msgpVal.MarshalMsg(nil)
	} else {
		// Slow path for other structs.
		buf, err = msgpack.Marshal(value)
	}
	if err != nil {
		return err
	}

	l.lock.Lock()
	defer l.lock.Unlock()

	// Check for existing item, ignoring expiry since we'd update anyway.
	if ent, ok := l.items[key]; ok {
		l.evictList.MoveToFront(ent)
		e := ent.Value.(*entry)
		e.value = buf
		e.expires = expires
		if e.generation != l.currentGeneration {
			e.generation = l.currentGeneration
			l.len++
		}
		return nil
	}

	// Add new item
	ent := &entry{key, buf, expires, l.currentGeneration}
	entry := l.evictList.PushFront(ent)
	l.items[key] = entry
	l.len++

	if l.evictList.Len() > l.size {
		l.removeElement(l.evictList.Back())
	}
	return nil
}

func (l *LRU) get(key string, value any) error {
	val, err := l.getItem(key)
	if err != nil {
		return err
	}

	// We use a fast path for hot structs.
	if msgpVal, ok := value.(msgp.Unmarshaler); ok {
		_, err := msgpVal.UnmarshalMsg(val)
		return err
	}

	// Slow path for other structs.
	return msgpack.Unmarshal(val, value)
}

func (l *LRU) getItem(key string) ([]byte, error) {
	l.lock.Lock()
	defer l.lock.Unlock()

	ent, ok := l.items[key]
	if !ok {
		return nil, ErrKeyNotFound
	}
	e := ent.Value.(*entry)
	if e.generation != l.currentGeneration || (!e.expires.IsZero() && time.Now().After(e.expires)) {
		l.removeElement(ent)
		return nil, ErrKeyNotFound
	}
	l.evictList.MoveToFront(ent)
	return e.value, nil
}

func (l *LRU) removeElement(e *list.Element) {
	l.evictList.Remove(e)
	kv := e.Value.(*entry)
	if kv.generation == l.currentGeneration {
		l.len--
	}
	delete(l.items, kv.key)
}
