// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"time"
)

// Cache is a representation of any cache store that has keys and values
type Cache interface {
	// Purge is used to completely clear the cache.
	Purge()

	// Add adds the given key and value to the store without an expiry.
	Add(key string, value interface{})

	// AddWithDefaultExpires adds the given key and value to the store with the default expiry.
	AddWithDefaultExpires(key string, value interface{})

	// AddWithExpiresInSecs adds the given key and value to the cache with the given expiry.
	AddWithExpiresInSecs(key string, value interface{}, expireAtSecs int64)

	// Get returns the value stored in the cache for a key, or nil if no value is present. The ok result indicates whether value was found in the cache.
	Get(key string) (value interface{}, ok bool)

	// GetOrAdd returns the existing value for the key if present. Otherwise, it stores and returns the given value. The loaded result is true if the value was loaded, false if stored.
	// This API intentionally deviates from the Add-only variants above for simplicity. We should simplify the entire API in the future.
	GetOrAdd(key string, value interface{}, ttl time.Duration) (actual interface{}, loaded bool)

	// Remove deletes the value for a key.
	Remove(key string)

	// RemoveByPrefix deletes all keys containing the given prefix string.
	RemoveByPrefix(prefix string)

	// Keys returns a slice of the keys in the cache.
	Keys() []string

	// Len returns the number of items in the cache.
	Len() int

	// Name identifies this cache instance among others in the system.
	Name() string

	// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
	GetInvalidateClusterEvent() string
}

// Provider defines how to create new caches
type Provider interface {
	// Connect opens a new connection to the cache using specific provider parameters.
	Connect()

	// NewCache creates a new cache with given size.
	NewCache(size int) Cache

	// NewCacheWithParams creates a new cache with the given parameters.
	NewCacheWithParams(size int, name string, defaultExpiry int64, invalidateClusterEvent string) Cache

	// Close releases any resources used by the cache provider.
	Close()
}
