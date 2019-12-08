// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"time"
)

// Cache is a representation of any cache store that has keys and values
type Cache interface {
	Purge()
	Add(key, value interface{})
	AddWithDefaultExpires(key, value interface{})
	AddWithExpiresInSecs(key, value interface{}, expireAtSecs int64)
	Get(key interface{}) (value interface{}, ok bool)
	GetOrAdd(key, value interface{}, ttl time.Duration) (actual interface{}, loaded bool)
	Remove(key interface{})
	Keys() []interface{}
	Len() int
	Name() string
	GetInvalidateClusterEvent() string
}

// CacheProvider defines how to create new caches
type CacheProvider interface {
	NewCache(size int) Cache
	NewCacheWithParams(size int, name string, defaultExpiry int64, invalidateClusterEvent string) Cache
}
