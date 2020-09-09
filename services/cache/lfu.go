// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"time"

	"github.com/dgraph-io/ristretto"
	"github.com/vmihailenco/msgpack/v5"
)

// LFU cache implementation using the Ristretto library.
type LFU struct {
	cache                  *ristretto.Cache
	name                   string
	size                   int
	len                    int
	defaultExpiry          time.Duration
	invalidateClusterEvent string
}

// LFUOptions contains options for initializing LFU cache.
type LFUOptions struct {
	config                 *ristretto.Config
	Name                   string
	Size                   int
	DefaultExpiry          time.Duration
	InvalidateClusterEvent string
}

// NewLFU creates an LFU using the Ristretto library.
func NewLFU(config *ristretto.Config) Cache {
	lfu, err := ristretto.NewCache(config)

	if err != nil {
		panic(err)
	}

	return &LFU{
		cache: lfu,
		name:  "testLFU",
	}
}

// NewLFU creates an LFU using the Ristretto library.
// func NewLFU(options *LFUOptions) Cache {
// 	lfu, err := ristretto.NewCache(options.config)

// 	if err != nil {
// 		panic(err)
// 	}

// 	return &LFU{
// 		cache:                  lfu,
// 		name:                   options.Name,
// 		size:                   options.Size,
// 		defaultExpiry:          options.DefaultExpiry,
// 		invalidateClusterEvent: options.InvalidateClusterEvent,
// 	}
// }

// Purge is used to completely clear the cache.
func (l *LFU) Purge() error {
	l.cache.Clear()
	l.len = 0
	return nil
}

// Set adds the given key and value to the store without an expiry. If the key already exists,
// it will overwrite the previous value.
func (l *LFU) Set(key string, value interface{}) error {
	buf, err := msgpack.Marshal(value)

	if err != nil {
		return err
	}

	ok := l.cache.Set(key, buf, 1)

	if !ok {
		return ErrKeyNotFound
	}

	l.len++

	return nil
}

// SetWithDefaultExpiry adds the given key and value to the store with the default expiry. If
// the key already exists, it will overwrite the previoous value
func (l *LFU) SetWithDefaultExpiry(key string, value interface{}) error {
	return nil
}

// SetWithExpiry adds the given key and value to the cache with the given expiry. If the key
// already exists, it will overwrite the previoous value
func (l *LFU) SetWithExpiry(key string, value interface{}, ttl time.Duration) error {
	return nil
}

// Get the content stored in the cache for the given key, and decode it into the value interface.
// return ErrKeyNotFound if the key is missing from the cache
func (l *LFU) Get(key string, value interface{}) error {
	val, found := l.cache.Get(key)

	if !found {
		return ErrKeyNotFound
	}

	err := msgpack.Unmarshal(val.([]byte), value)

	if err != nil {
		panic(err)
	}

	return nil
}

// Remove deletes the value for a key.
func (l *LFU) Remove(key string) error {
	l.cache.Del(key)
	l.len--
	return nil
}

// Keys returns a slice of the keys in the cache.
func (l *LFU) Keys() ([]string, error) {
	keys := []string{"hello", "world"}
	return keys, nil
}

// Len returns the number of items in the cache.
func (l *LFU) Len() (int, error) {
	return l.len, nil
}

// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
func (l *LFU) GetInvalidateClusterEvent() string {
	return l.invalidateClusterEvent
}

// Name returns the name of the cache
func (l *LFU) Name() string {
	return l.name
}
