// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/redis/go-redis/v9"
)

// CacheOptions contains options for initializing a cache
type CacheOptions struct {
	Size                   int
	DefaultExpiry          time.Duration
	Name                   string
	InvalidateClusterEvent model.ClusterEvent
	Striped                bool
	StripedBuckets         int
	RedisAddr              string
	RedisPassword          string
	RedisDB                int
}

// Provider is a provider for Cache
type Provider interface {
	// NewCache creates a new cache with given options.
	NewCache(opts *CacheOptions) (Cache, error)
	// Connect opens a new connection to the cache using specific provider parameters.
	Connect() error
	// Close releases any resources used by the cache provider.
	Close() error
}

type cacheProvider struct {
}

// NewProvider creates a new CacheProvider
func NewProvider() Provider {
	return &cacheProvider{}
}

// NewCache creates a new cache with given opts
func (c *cacheProvider) NewCache(opts *CacheOptions) (Cache, error) {
	if opts.Striped {
		return NewLRUStriped(LRUOptions{
			Name:                   opts.Name,
			Size:                   opts.Size,
			DefaultExpiry:          opts.DefaultExpiry,
			InvalidateClusterEvent: opts.InvalidateClusterEvent,
			StripedBuckets:         opts.StripedBuckets,
		})
	}
	return NewLRU(LRUOptions{
		Name:                   opts.Name,
		Size:                   opts.Size,
		DefaultExpiry:          opts.DefaultExpiry,
		InvalidateClusterEvent: opts.InvalidateClusterEvent,
	}), nil
}

// Connect opens a new connection to the cache using specific provider parameters.
func (c *cacheProvider) Connect() error {
	return nil
}

// Close releases any resources used by the cache provider.
func (c *cacheProvider) Close() error {
	return nil
}

type redisProvider struct {
	client *redis.Client
}

// NewProvider creates a new CacheProvider
func NewRedisProvider(addr string, password string, db int) Provider {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
	return &redisProvider{client: client}
}

// NewCache creates a new cache with given opts
func (c *redisProvider) NewCache(opts *CacheOptions) (Cache, error) {
	cache := NewRedis(RedisOptions{
		Name:          opts.Name,
		DefaultExpiry: opts.DefaultExpiry,
	})
	if c.client == nil {
		c.client = cache.client
	} else {
		cache.client = c.client
	}
	return cache, nil
}

// Connect opens a new connection to the cache using specific provider parameters.
func (c *redisProvider) Connect() error {
	return nil
}

// Close releases any resources used by the cache provider.
func (c *redisProvider) Close() error {
	return c.client.Close()
}
