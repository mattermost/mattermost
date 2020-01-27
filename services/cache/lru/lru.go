// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This files was copied/modified from https://github.com/hashicorp/golang-lru
// which was (see below)

// This package provides a simple LRU cache. It is based on the
// LRU implementation in groupcache:
// https://github.com/golang/groupcache/tree/master/lru

package lru

import (
	"container/list"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/services/cache"
)

// Cache is a thread-safe fixed size LRU cache.
type Cache struct {
	size                   int
	evictList              *list.List
	items                  map[string]*list.Element
	lock                   sync.RWMutex
	name                   string
	defaultExpiry          int64
	invalidateClusterEvent string
	currentGeneration      int64
	len                    int
}

// CacheProvider is an implementation of cache.Provider to create a new Lru Cache
type CacheProvider struct{}

// NewCache creates a new lru.Cache with given size.
func (c *CacheProvider) NewCache(size int) cache.Cache {
	return New(size)
}

// NewCacheWithParams creates a new lru.Cache with the given parameters.
func (c *CacheProvider) NewCacheWithParams(size int, name string, defaultExpiry int64, invalidateClusterEvent string) cache.Cache {
	return NewWithParams(size, name, defaultExpiry, invalidateClusterEvent)
}

// Connect opens a new connection to the cache using specific provider parameters.
func (c *CacheProvider) Connect() {

}

// Close releases any resources used by the cache provider.
func (c *CacheProvider) Close() {

}

// entry is used to hold a value in the evictList.
type entry struct {
	key        string
	value      interface{}
	expires    time.Time
	generation int64
}

// New creates an LRU of the given size.
func New(size int) *Cache {
	return &Cache{
		size:      size,
		evictList: list.New(),
		items:     make(map[string]*list.Element, size),
	}
}

// NewWithParams creates an LRU with the given parameters.
func NewWithParams(size int, name string, defaultExpiry int64, invalidateClusterEvent string) *Cache {
	lru := New(size)
	lru.name = name
	lru.defaultExpiry = defaultExpiry
	lru.invalidateClusterEvent = invalidateClusterEvent
	return lru
}

// Purge is used to completely clear the cache.
func (c *Cache) Purge() {
	c.lock.Lock()
	defer c.lock.Unlock()

	c.len = 0
	c.currentGeneration++
}

// Add adds the given key and value to the store without an expiry.
func (c *Cache) Add(key string, value interface{}) {
	c.AddWithExpiresInSecs(key, value, 0)
}

// AddWithDefaultExpires adds the given key and value to the store with the default expiry.
func (c *Cache) AddWithDefaultExpires(key string, value interface{}) {
	c.AddWithExpiresInSecs(key, value, c.defaultExpiry)
}

// AddWithExpiresInSecs adds the given key and value to the cache with the given expiry.
func (c *Cache) AddWithExpiresInSecs(key string, value interface{}, expireAtSecs int64) {
	c.lock.Lock()
	defer c.lock.Unlock()

	c.add(key, value, time.Duration(expireAtSecs)*time.Second)
}

func (c *Cache) add(key string, value interface{}, ttl time.Duration) {
	var expires time.Time
	if ttl > 0 {
		expires = time.Now().Add(ttl)
	}

	// Check for existing item, ignoring expiry since we'd update anyway.
	if ent, ok := c.items[key]; ok {
		c.evictList.MoveToFront(ent)
		e := ent.Value.(*entry)
		e.value = value
		e.expires = expires
		if e.generation != c.currentGeneration {
			e.generation = c.currentGeneration
			c.len++
		}
		return
	}

	// Add new item
	ent := &entry{key, value, expires, c.currentGeneration}
	entry := c.evictList.PushFront(ent)
	c.items[key] = entry
	c.len++

	if c.evictList.Len() > c.size {
		c.removeElement(c.evictList.Back())
	}
}

// Get returns the value stored in the cache for a key, or nil if no value is present. The ok result indicates whether value was found in the cache.
func (c *Cache) Get(key string) (value interface{}, ok bool) {
	c.lock.Lock()
	defer c.lock.Unlock()

	return c.getValue(key)
}

func (c *Cache) getValue(key string) (value interface{}, ok bool) {
	if ent, ok := c.items[key]; ok {
		e := ent.Value.(*entry)

		if e.generation != c.currentGeneration || (!e.expires.IsZero() && time.Now().After(e.expires)) {
			c.removeElement(ent)
			return nil, false
		}

		c.evictList.MoveToFront(ent)
		return ent.Value.(*entry).value, true
	}

	return nil, false
}

// GetOrAdd returns the existing value for the key if present. Otherwise, it stores and returns the given value. The loaded result is true if the value was loaded, false if stored.
// This API intentionally deviates from the Add-only variants above for simplicity. We should simplify the entire API in the future.
func (c *Cache) GetOrAdd(key string, value interface{}, ttl time.Duration) (actual interface{}, loaded bool) {
	c.lock.Lock()
	defer c.lock.Unlock()

	// Check for existing item
	if actualValue, ok := c.getValue(key); ok {
		return actualValue, true
	}

	c.add(key, value, ttl)

	return value, false
}

// Remove deletes the value for a key.
func (c *Cache) Remove(key string) {
	c.lock.Lock()
	defer c.lock.Unlock()

	if ent, ok := c.items[key]; ok {
		c.removeElement(ent)
	}
}

// RemoveByPrefix deletes all keys containing the given prefix string.
func (c *Cache) RemoveByPrefix(prefix string) {
	c.lock.Lock()
	defer c.lock.Unlock()

	for ent := c.evictList.Back(); ent != nil; ent = ent.Prev() {
		e := ent.Value.(*entry)
		if e.generation == c.currentGeneration {
			if strings.HasPrefix(e.key, prefix) {
				if ent, ok := c.items[e.key]; ok {
					c.removeElement(ent)
				}
			}
		}
	}
}

// Keys returns a slice of the keys in the cache, from oldest to newest.
func (c *Cache) Keys() []string {
	c.lock.RLock()
	defer c.lock.RUnlock()

	keys := make([]string, c.len)
	i := 0
	for ent := c.evictList.Back(); ent != nil; ent = ent.Prev() {
		e := ent.Value.(*entry)
		if e.generation == c.currentGeneration {
			keys[i] = e.key
			i++
		}
	}

	return keys
}

// Len returns the number of items in the cache.
func (c *Cache) Len() int {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.len
}

// Name identifies this cache instance among others in the system.
func (c *Cache) Name() string {
	return c.name
}

// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
func (c *Cache) GetInvalidateClusterEvent() string {
	return c.invalidateClusterEvent
}

func (c *Cache) removeElement(e *list.Element) {
	c.evictList.Remove(e)
	kv := e.Value.(*entry)
	if kv.generation == c.currentGeneration {
		c.len--
	}
	delete(c.items, kv.key)
}
