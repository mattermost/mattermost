package dataloader

import (
	"context"
	"sync"
)

// InMemoryCache is an in memory implementation of Cache interface.
// This simple implementation is well suited for
// a "per-request" dataloader (i.e. one that only lives
// for the life of an http request) but it's not well suited
// for long lived cached items.
type InMemoryCache[K comparable, V any] struct {
	items map[K]Thunk[V]
	mu    sync.RWMutex
}

// NewCache constructs a new InMemoryCache
func NewCache[K comparable, V any]() *InMemoryCache[K, V] {
	items := make(map[K]Thunk[V])
	return &InMemoryCache[K, V]{
		items: items,
	}
}

// Set sets the `value` at `key` in the cache
func (c *InMemoryCache[K, V]) Set(_ context.Context, key K, value Thunk[V]) {
	c.mu.Lock()
	c.items[key] = value
	c.mu.Unlock()
}

// Get gets the value at `key` if it exsits, returns value (or nil) and bool
// indicating of value was found
func (c *InMemoryCache[K, V]) Get(_ context.Context, key K) (Thunk[V], bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, found := c.items[key]
	if !found {
		return nil, false
	}

	return item, true
}

// Delete deletes item at `key` from cache
func (c *InMemoryCache[K, V]) Delete(ctx context.Context, key K) bool {
	if _, found := c.Get(ctx, key); found {
		c.mu.Lock()
		defer c.mu.Unlock()
		delete(c.items, key)
		return true
	}
	return false
}

// Clear clears the entire cache
func (c *InMemoryCache[K, V]) Clear() {
	c.mu.Lock()
	c.items = map[K]Thunk[V]{}
	c.mu.Unlock()
}
