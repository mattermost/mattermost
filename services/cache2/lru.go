// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache2

import (
	"bytes"
	"container/list"
	"encoding/gob"
	"sync"
	"time"
)

// LRU is a thread-safe fixed size LRU cache.
type LRU struct {
	size                   int
	evictList              *list.List
	items                  map[string]*list.Element
	lock                   sync.RWMutex
	defaultExpiry          time.Duration
	invalidateClusterEvent string
	currentGeneration      int64
	len                    int
}

// LRUOptions contains options for initializing LRU cache
type LRUOptions struct {
	Size                   int
	DefaultExpiry          time.Duration
	InvalidateClusterEvent string
}

// entry is used to hold a value in the evictList.
type entry struct {
	key        string
	value      []byte
	expires    time.Time
	generation int64
}

// NewLRU creates an LRU of the given size.
func NewLRU(opts *LRUOptions) Cache {
	return &LRU{
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

// Set adds the given key and value to the store without an expiry. If the key already exists,
// it will overwrite the previous value.
func (l *LRU) Set(key string, value interface{}) error {
	return l.SetWithExpiry(key, value, 0)
}

// SetWithDefaultExpiry adds the given key and value to the store with the default expiry. If
// the key already exists, it will overwrite the previoous value
func (l *LRU) SetWithDefaultExpiry(key string, value interface{}) error {
	return l.SetWithExpiry(key, value, l.defaultExpiry)
}

// SetWithExpiry adds the given key and value to the cache with the given expiry. If the key
// already exists, it will overwrite the previoous value
func (l *LRU) SetWithExpiry(key string, value interface{}, ttl time.Duration) error {
	l.lock.Lock()
	defer l.lock.Unlock()
	return l.set(key, value, ttl)
}

// Get the content stored in the cache for the given key, and decode it into the value interface.
// return ErrKeyNotFound if the key is missing from the cache
func (l *LRU) Get(key string, value interface{}) error {
	l.lock.Lock()
	defer l.lock.Unlock()
	return l.get(key, value)
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

// Keys returns a slice of the keys in the cache.
func (l *LRU) Keys() ([]string, error) {
	l.lock.RLock()
	defer l.lock.RUnlock()

	keys := make([]string, l.len)
	i := 0
	for ent := l.evictList.Back(); ent != nil; ent = ent.Prev() {
		e := ent.Value.(*entry)
		if e.generation == l.currentGeneration {
			keys[i] = e.key
			i++
		}
	}
	return keys, nil
}

// Len returns the number of items in the cache.
func (l *LRU) Len() (int, error) {
	l.lock.RLock()
	defer l.lock.RUnlock()
	return l.len, nil
}

// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
func (l *LRU) GetInvalidateClusterEvent() string {
	return l.invalidateClusterEvent
}

func (l *LRU) set(key string, value interface{}, ttl time.Duration) error {
	var expires time.Time
	if ttl > 0 {
		expires = time.Now().Add(ttl)
	}

	var buffer bytes.Buffer
	err := gob.NewEncoder(&buffer).Encode(value)
	if err != nil {
		return err
	}

	// Check for existing item, ignoring expiry since we'd update anyway.
	if ent, ok := l.items[key]; ok {
		l.evictList.MoveToFront(ent)
		e := ent.Value.(*entry)
		e.value = buffer.Bytes()
		e.expires = expires
		if e.generation != l.currentGeneration {
			e.generation = l.currentGeneration
			l.len++
		}
		return nil
	}

	// Add new item
	ent := &entry{key, buffer.Bytes(), expires, l.currentGeneration}
	entry := l.evictList.PushFront(ent)
	l.items[key] = entry
	l.len++

	if l.evictList.Len() > l.size {
		l.removeElement(l.evictList.Back())
	}
	return nil
}

func (l *LRU) get(key string, value interface{}) error {
	if ent, ok := l.items[key]; ok {
		e := ent.Value.(*entry)

		if e.generation != l.currentGeneration || (!e.expires.IsZero() && time.Now().After(e.expires)) {
			l.removeElement(ent)
			return ErrKeyNotFound
		}

		l.evictList.MoveToFront(ent)
		return gob.NewDecoder(bytes.NewBuffer(e.value)).Decode(value)
	}
	return ErrKeyNotFound
}

func (l *LRU) removeElement(e *list.Element) {
	l.evictList.Remove(e)
	kv := e.Value.(*entry)
	if kv.generation == l.currentGeneration {
		l.len--
	}
	delete(l.items, kv.key)
}
