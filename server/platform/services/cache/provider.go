// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// CacheOptions contains options for initializing a cache
type CacheOptions struct {
	Size                   int
	DefaultExpiry          time.Duration
	Name                   string
	InvalidateClusterEvent model.ClusterEvent
	Striped                bool
	StripedBuckets         int
}

// Provider is a provider for Cache
type Provider[T any] interface {
	// NewCache creates a new cache with given options.
	NewCache(opts *CacheOptions) (Cache[T], error)
	// Connect opens a new connection to the cache using specific provider parameters.
	Connect() error
	// Close releases any resources used by the cache provider.
	Close() error
}

type cacheProvider[T any] struct {
}

// NewProvider creates a new CacheProvider
func NewProvider[T any]() Provider[T] {
	return &cacheProvider[T]{}
}

// NewCache creates a new cache with given opts
func (c *cacheProvider[T]) NewCache(opts *CacheOptions) (Cache[T], error) {
	if opts.Striped {
		return NewLRUStriped[T](LRUOptions{
			Name:                   opts.Name,
			Size:                   opts.Size,
			DefaultExpiry:          opts.DefaultExpiry,
			InvalidateClusterEvent: opts.InvalidateClusterEvent,
			StripedBuckets:         opts.StripedBuckets,
		})
	}
	return NewLRU[T](LRUOptions{
		Name:                   opts.Name,
		Size:                   opts.Size,
		DefaultExpiry:          opts.DefaultExpiry,
		InvalidateClusterEvent: opts.InvalidateClusterEvent,
	}), nil
}

// Connect opens a new connection to the cache using specific provider parameters.
func (c *cacheProvider[T]) Connect() error {
	return nil
}

// Close releases any resources used by the cache provider.
func (c *cacheProvider[T]) Close() error {
	return nil
}
