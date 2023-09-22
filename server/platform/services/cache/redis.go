package cache

import (
	"context"
	"errors"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/redis/go-redis/v9"
)

type Redis struct {
	name          string
	client        *redis.Client
	defaultExpiry time.Duration
}

type RedisOptions struct {
	Name          string
	DefaultExpiry time.Duration
}

func NewRedis(opts RedisOptions) *Redis {
	return &Redis{name: opts.Name, defaultExpiry: opts.DefaultExpiry}
}

func (r *Redis) Purge() error {
	return errors.New("not implemented")
}

func (r *Redis) Set(key string, value any) error {
	return r.SetWithExpiry(key, value, 0)
}

// SetWithDefaultExpiry adds the given key and value to the store with the default expiry. If
// the key already exists, it will overwrite the previous value
func (r *Redis) SetWithDefaultExpiry(key string, value any) error {
	return r.SetWithExpiry(key, value, r.defaultExpiry)
}

// SetWithExpiry adds the given key and value to the cache with the given expiry. If the key
// already exists, it will overwrite the previous value
func (r *Redis) SetWithExpiry(key string, value any, ttl time.Duration) error {
	err := r.client.Set(context.Background(), r.name+"_"+key, value, ttl).Err()
	if err != nil {
		return err
	}

	return nil
}

// Get the content stored in the cache for the given key, and decode it into the value interface.
// Return ErrKeyNotFound if the key is missing from the cache
func (r *Redis) Get(key string, value any) error {
	val, err := r.client.Get(context.Background(), r.name+"_"+key).Result()
	if err != nil {
		return err
	}
	value = val
	return nil
}

// Remove deletes the value for a given key.
func (r *Redis) Remove(key string) error {
	return r.client.Del(context.Background(), r.name+"_"+key).Err()
}

// Keys returns a slice of the keys in the cache.
func (r *Redis) Keys() ([]string, error) {
	return r.client.Keys(context.Background(), r.name+"_*").Result()
}

// Len returns the number of items in the cache.
func (r *Redis) Len() (int, error) {
	keys, err := r.client.Keys(context.Background(), r.name+"_*").Result()
	if err != nil {
		return 0, err
	}
	return len(keys), nil
}

// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
func (r *Redis) GetInvalidateClusterEvent() model.ClusterEvent {
	return model.ClusterEventNone
}

func (r *Redis) Name() string {
	return r.name
}
