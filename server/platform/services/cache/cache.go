// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"errors"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// ErrKeyNotFound is the error when the given key is not found
var ErrKeyNotFound = errors.New("key not found")

// Cache is a representation of a cache store that aims to replace cache.Cache
type Cache interface {
	// Purge is used to completely clear the cache.
	Purge() error

	// SetWithDefaultExpiry adds the given key and value to the store with the default expiry. If
	// the key already exists, it will overwrite the previous value
	SetWithDefaultExpiry(key string, value any) error

	// SetWithExpiry adds the given key and value to the cache with the given expiry. If the key
	// already exists, it will overwrite the previous value
	SetWithExpiry(key string, value any, ttl time.Duration) error

	// Get the content stored in the cache for the given key, and decode it into the value interface.
	// Returns ErrKeyNotFound if the key is missing from the cache
	Get(key string, value any) error

	// GetMulti returns values for multiple keys in a single operation.
	// Returns ErrKeyNotFound if the key is missing from the cache.
	GetMulti(keys []string, values []any) []error

	// Remove deletes the value for a given key.
	Remove(key string) error

	// RemoveMulti deletes multiple keys in a single operation.
	RemoveMulti(keys []string) error

	// Scan allows incremental iteration over the entire key-space
	// in a performant manner. It provides a callback that consumers
	// can use to process the keys. If the callback returns an error,
	// the scan stops, returning the same error.
	Scan(f func([]string) error) error

	// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
	GetInvalidateClusterEvent() model.ClusterEvent

	// Name returns the name of the cache
	Name() string
}

// ExternalCache is a super-set of the Cache interface with
// a couple of more methods that allows for more efficient cache updates.
// This can be achieved because the cache is external and an update
// is visible to all nodes.
type ExternalCache interface {
	Cache
	// Increment will increment the
	// number stored at that key by the value.
	Increment(key string, val int) error
	// Decrement will decrement the
	// number stored at that key by the value.
	Decrement(key string, val int) error
}
