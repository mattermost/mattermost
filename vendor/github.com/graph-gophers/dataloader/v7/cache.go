package dataloader

import "context"

// The Cache interface. If a custom cache is provided, it must implement this interface.
type Cache[K comparable, V any] interface {
	Get(context.Context, K) (Thunk[V], bool)
	Set(context.Context, K, Thunk[V])
	Delete(context.Context, K) bool
	Clear()
}

// NoCache implements Cache interface where all methods are noops.
// This is useful for when you don't want to cache items but still
// want to use a data loader
type NoCache[K comparable, V any] struct{}

// Get is a NOOP
func (c *NoCache[K, V]) Get(context.Context, K) (Thunk[V], bool) { return nil, false }

// Set is a NOOP
func (c *NoCache[K, V]) Set(context.Context, K, Thunk[V]) { return }

// Delete is a NOOP
func (c *NoCache[K, V]) Delete(context.Context, K) bool { return false }

// Clear is a NOOP
func (c *NoCache[K, V]) Clear() { return }
