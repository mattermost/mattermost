// This files was copied/modified from https://github.com/hashicorp/golang-lru
// which was (see below)

// This package provides a simple LRU cache. It is based on the
// LRU implementation in groupcache:
// https://github.com/golang/groupcache/tree/master/lru

package utils

import (
	"container/list"
	"sync"
	"time"
)

// Caching Interface
type ObjectCache interface {
	AddWithExpiresInSecs(key, value interface{}, expireAtSecs int64)
	AddWithDefaultExpires(key, value interface{})
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
	name                   string
	defaultExpiry          int64
	invalidateClusterEvent string
	currentGeneration      int64
	len                    int
}

// entry is used to hold a value in the evictList
type entry struct {
	key          interface{}
	value        interface{}
	expireAtSecs int64
	generation   int64
}

// New creates an LRU of the given size
func NewLru(size int) *Cache {
	return &Cache{
		size:      size,
		evictList: list.New(),
		items:     make(map[interface{}]*list.Element, size),
	}
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

	c.len = 0
	c.currentGeneration++
}

func (c *Cache) Add(key, value interface{}) {
	c.AddWithExpiresInSecs(key, value, 0)
}

func (c *Cache) AddWithDefaultExpires(key, value interface{}) {
	c.AddWithExpiresInSecs(key, value, c.defaultExpiry)
}

func (c *Cache) AddWithExpiresInSecs(key, value interface{}, expireAtSecs int64) {
	c.lock.Lock()
	defer c.lock.Unlock()

	if expireAtSecs > 0 {
		expireAtSecs = (time.Now().UnixNano() / int64(time.Second)) + expireAtSecs
	}

	// Check for existing item
	if ent, ok := c.items[key]; ok {
		c.evictList.MoveToFront(ent)
		e := ent.Value.(*entry)
		e.value = value
		e.expireAtSecs = expireAtSecs
		if e.generation != c.currentGeneration {
			e.generation = c.currentGeneration
			c.len++
		}
		return
	}

	// Add new item
	ent := &entry{key, value, expireAtSecs, c.currentGeneration}
	entry := c.evictList.PushFront(ent)
	c.items[key] = entry
	c.len++

	if c.evictList.Len() > c.size {
		c.removeElement(c.evictList.Back())
	}
}

func (c *Cache) Get(key interface{}) (value interface{}, ok bool) {
	c.lock.Lock()
	defer c.lock.Unlock()

	if ent, ok := c.items[key]; ok {
		e := ent.Value.(*entry)

		if e.generation != c.currentGeneration || (e.expireAtSecs > 0 && (time.Now().UnixNano()/int64(time.Second)) > e.expireAtSecs) {
			c.removeElement(ent)
			return nil, false
		}

		c.evictList.MoveToFront(ent)
		return ent.Value.(*entry).value, true
	}

	return nil, false
}

func (c *Cache) Remove(key interface{}) {
	c.lock.Lock()
	defer c.lock.Unlock()

	if ent, ok := c.items[key]; ok {
		c.removeElement(ent)
	}
}

// Keys returns a slice of the keys in the cache, from oldest to newest.
func (c *Cache) Keys() []interface{} {
	c.lock.RLock()
	defer c.lock.RUnlock()

	keys := make([]interface{}, c.len)
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

func (c *Cache) Name() string {
	return c.name
}

func (c *Cache) GetInvalidateClusterEvent() string {
	return c.invalidateClusterEvent
}

// removeElement is used to remove a given list element from the cache
func (c *Cache) removeElement(e *list.Element) {
	c.evictList.Remove(e)
	kv := e.Value.(*entry)
	if kv.generation == c.currentGeneration {
		c.len--
	}
	delete(c.items, kv.key)
}
