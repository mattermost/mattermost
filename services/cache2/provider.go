// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache2

import "time"

// Provider is a provider for Cache
type Provider interface {
	// NewCache creates a new cache with given size.
	NewCache(size int) Cache
	// NewCacheWithParams creates a new cache with the given parameters.
	NewCacheWithParams(size int, name string, defaultExpiryInSecs int, invalidateClusterEvent string) Cache
	// Connect opens a new connection to the cache using specific provider parameters.
	Connect()
	// Close releases any resources used by the cache provider.
	Close()
}

type cacheProvider struct {
}

// NewProvider creates a new CacheProvider
func NewProvider() Provider {
	return &cacheProvider{}
}

// NewCache creates a new cache with given size.
func (c *cacheProvider) NewCache(size int) Cache {
	return NewLRU(&LRUOptions{
		Size: size,
	})
}

// NewCacheWithParams creates a new cache with the given parameters.
func (c *cacheProvider) NewCacheWithParams(size int, name string, defaultExpiryInSecs int, invalidateClusterEvent string) Cache {
	return NewLRU(&LRUOptions{
		Size:                   size,
		DefaultExpiry:          time.Duration(defaultExpiryInSecs) * time.Second,
		InvalidateClusterEvent: invalidateClusterEvent,
	})
}

// Connect opens a new connection to the cache using specific provider parameters.
func (c *cacheProvider) Connect() {
}

// Close releases any resources used by the cache provider.
func (c *cacheProvider) Close() {
}
