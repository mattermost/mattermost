// This files was copied/modified from https://github.com/hashicorp/golang-lru
// which was (see below)

// This package provides a simple LRU cache. It is based on the
// LRU implementation in groupcache:
// https://github.com/golang/groupcache/tree/master/lru

package utils

import (
	"container/list"
	"errors"
	"sync"
	"time"
)

// Caching Interface
type ObjectCache interface {
	AddWithExpiresInSecs(key, value interface{}, expireAtSecs int64) bool
	AddWithDefaultExpires(key, value interface{}) bool
	Purge()
	Get(key interface{}) (value interface{}, ok bool)
	Remove(key interface{})
	Len() int
	Name() string
	GetInvalidateClusterEvent() string
}

// Cache is a thread-safe fixed size LRU cache.
type Cache struct {
	size                   int
	evictList              *list.List
	items                  map[interface{}]*list.Element
	lock                   sync.RWMutex
	onEvicted              func(key interface{}, value interface{})
	name                   string
	defaultExpiry          int64
	invalidateClusterEvent string
}

// entry is used to hold a value in the evictList
type entry struct {
	key          interface{}
	value        interface{}
	expireAtSecs int64
}

// New creates an LRU of the given size
func NewLru(size int) *Cache {
	cache, _ := NewLruWithEvict(size, nil)
	return cache
}

func NewLruWithEvict(size int, onEvicted func(key interface{}, value interface{})) (*Cache, error) {
	if size <= 0 {
		return nil, errors.New(T("utils.iru.with_evict"))
	}
	c := &Cache{
		size:      size,
		evictList: list.New(),
		items:     make(map[interface{}]*list.Element, size),
		onEvicted: onEvicted,
	}
	return c, nil
}

func NewLruWithParams(size int, name string, defaultExpiry int64, invalidateClusterEvent string) *Cache {
	lru := NewLru(size)
	lru.name = name
	lru.defaultExpiry = defaultExpiry
	lru.invalidateClusterEvent = invalidateClusterEvent
	return lru
}

// Purge is used to completely clear the cache
func (c *Cache) Purge() {
	c.lock.Lock()
	defer c.lock.Unlock()

	if c.onEvicted != nil {
		for k, v := range c.items {
			c.onEvicted(k, v.Value)
		}
	}

	c.evictList = list.New()
	c.items = make(map[interface{}]*list.Element, c.size)
}

func (c *Cache) Add(key, value interface{}) bool {
	return c.AddWithExpiresInSecs(key, value, 0)
}

func (c *Cache) AddWithDefaultExpires(key, value interface{}) bool {
	return c.AddWithExpiresInSecs(key, value, c.defaultExpiry)
}

// Add adds a value to the cache.  Returns true if an eviction occurred.
func (c *Cache) AddWithExpiresInSecs(key, value interface{}, expireAtSecs int64) bool {
	c.lock.Lock()
	defer c.lock.Unlock()

	if expireAtSecs > 0 {
		expireAtSecs = (time.Now().UnixNano() / int64(time.Second)) + expireAtSecs
	}

	// Check for existing item
	if ent, ok := c.items[key]; ok {
		c.evictList.MoveToFront(ent)
		ent.Value.(*entry).value = value
		ent.Value.(*entry).expireAtSecs = expireAtSecs
		return false
	}

	// Add new item
	ent := &entry{key, value, expireAtSecs}
	entry := c.evictList.PushFront(ent)
	c.items[key] = entry

	evict := c.evictList.Len() > c.size
	// Verify size not exceeded
	if evict {
		c.removeOldest()
	}
	return evict
}

// Get looks up a key's value from the cache.
func (c *Cache) Get(key interface{}) (value interface{}, ok bool) {
	c.lock.Lock()
	defer c.lock.Unlock()

	if ent, ok := c.items[key]; ok {

		if ent.Value.(*entry).expireAtSecs > 0 {
			if (time.Now().UnixNano() / int64(time.Second)) > ent.Value.(*entry).expireAtSecs {
				c.removeElement(ent)
				return nil, false
			}
		}

		c.evictList.MoveToFront(ent)
		return ent.Value.(*entry).value, true
	}
	return
}

// Remove removes the provided key from the cache.
func (c *Cache) Remove(key interface{}) {
	c.lock.Lock()
	defer c.lock.Unlock()

	if ent, ok := c.items[key]; ok {
		c.removeElement(ent)
	}
}

// RemoveOldest removes the oldest item from the cache.
func (c *Cache) RemoveOldest() {
	c.lock.Lock()
	defer c.lock.Unlock()
	c.removeOldest()
}

// Keys returns a slice of the keys in the cache, from oldest to newest.
func (c *Cache) Keys() []interface{} {
	c.lock.RLock()
	defer c.lock.RUnlock()

	keys := make([]interface{}, len(c.items))
	ent := c.evictList.Back()
	i := 0
	for ent != nil {
		keys[i] = ent.Value.(*entry).key
		ent = ent.Prev()
		i++
	}

	return keys
}

// Len returns the number of items in the cache.
func (c *Cache) Len() int {
	c.lock.RLock()
	defer c.lock.RUnlock()
	return c.evictList.Len()
}

func (c *Cache) Name() string {
	return c.name
}

func (c *Cache) GetInvalidateClusterEvent() string {
	return c.invalidateClusterEvent
}

// removeOldest removes the oldest item from the cache.
func (c *Cache) removeOldest() {
	ent := c.evictList.Back()
	if ent != nil {
		c.removeElement(ent)
	}
}

// removeElement is used to remove a given list element from the cache
func (c *Cache) removeElement(e *list.Element) {
	c.evictList.Remove(e)
	kv := e.Value.(*entry)
	delete(c.items, kv.key)
	if c.onEvicted != nil {
		c.onEvicted(kv.key, kv.value)
	}
}
