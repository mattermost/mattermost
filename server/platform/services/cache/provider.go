// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"context"
	"fmt"
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
	// StripedBuckets is used only by LRUStriped and shouldn't be greater than the number
	// of CPUs available on the machine running this cache.
	StripedBuckets int
}

// Provider is a provider for Cache
type Provider interface {
	// NewCache creates a new cache with given options.
	NewCache(opts *CacheOptions) (Cache, error)
	// Connect opens a new connection to the cache using specific provider parameters.
	Connect() (string, error)
	// Close releases any resources used by the cache provider.
	Close() error
	// Type returns what type of cache it generates.
	Type() string
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
		return NewLRUStriped(opts)
	}
	return NewLRU(opts), nil
}

// Connect opens a new connection to the cache using specific provider parameters.
func (c *cacheProvider) Connect() (string, error) {
	return "OK", nil
}

// Close releases any resources used by the cache provider.
func (c *cacheProvider) Close() error {
	return nil
}

func (c *cacheProvider) Type() string {
	return model.CacheTypeLRU
}

type redisProvider struct {
	client *redis.Client
}

type RedisOptions struct {
	RedisAddr      string
	RedisPassword  string
	RedisDB        int
	MaxIdleConns   int
	MaxActiveConns int
}

// NewProvider creates a new CacheProvider
func NewRedisProvider(opts *RedisOptions) Provider {
	client := redis.NewClient(&redis.Options{
		Addr:           opts.RedisAddr,
		Password:       opts.RedisPassword,
		DB:             opts.RedisDB,
		MaxActiveConns: opts.MaxActiveConns,
		MaxIdleConns:   opts.MaxIdleConns,
	})
	return &redisProvider{client: client}
}

// NewCache creates a new cache with given opts
func (r *redisProvider) NewCache(opts *CacheOptions) (Cache, error) {
	return NewRedis(opts, r.client)
}

// Connect opens a new connection to the cache using specific provider parameters.
func (r *redisProvider) Connect() (string, error) {
	res, err := r.client.Ping(context.Background()).Result()
	if err != nil {
		return "", fmt.Errorf("unable to establish connection with redis: %v", err)
	}
	return res, nil
}

func (r *redisProvider) Type() string {
	return model.CacheTypeRedis
}

// Close releases any resources used by the cache provider.
func (r *redisProvider) Close() error {
	return r.client.Close()
}
