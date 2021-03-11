package int64cache

import (
	"container/list"
	"fmt"
	"sync"
)

// Int64Cache is an in-memory TTL & LRU cache
type Int64Cache interface {
	Get(key int64) (int64, error)
	Set(key int64, value int64) error
}

// Impl implements the LocalCache interface
type Impl struct {
	maxLen int
	items  map[int64]*list.Element
	lru    *list.List
	mutex  sync.Mutex
}

type entry struct {
	key   int64
	value int64
}

// Get retrieves an item if exist, nil + an error otherwise
func (c *Impl) Get(key int64) (int64, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	node, ok := c.items[key]
	if !ok {
		return 0, &Miss{}
	}

	entry, ok := node.Value.(entry)
	if !ok {
		return 0, fmt.Errorf("Invalid data in cache for key %d", key)
	}

	c.lru.MoveToFront(node)
	return entry.value, nil
}

// Set adds a new item. Since the cache being full results in removing the LRU element, this method never fails.
func (c *Impl) Set(key int64, value int64) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	if node, ok := c.items[key]; ok {
		c.lru.MoveToFront(node)
		node.Value = entry{key: key, value: value}
	} else {
		// Drop the LRU item on the list before adding a new one.
		if c.lru.Len() == c.maxLen {
			entry, ok := c.lru.Back().Value.(entry)
			if !ok {
				return fmt.Errorf("Invalid data in list for key %d", key)
			}
			key := entry.key
			delete(c.items, key)
			c.lru.Remove(c.lru.Back())
		}

		ptr := c.lru.PushFront(entry{key: key, value: value})
		c.items[key] = ptr
	}
	return nil
}

// NewInt64Cache returns a new LocalCache instance of the specified size and TTL
func NewInt64Cache(maxSize int) (*Impl, error) {
	if maxSize <= 0 {
		return nil, fmt.Errorf("Cache size should be > 0. Is: %d", maxSize)
	}

	return &Impl{
		maxLen: maxSize,
		lru:    new(list.List),
		items:  make(map[int64]*list.Element, maxSize),
	}, nil
}

// Miss is a special error indicating the key was not found in the cache
type Miss struct {
	Key int64
}

func (m *Miss) Error() string {
	return fmt.Sprintf("key %d not found in cache", m.Key)
}
