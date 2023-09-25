package cache

import (
	"context"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/redis/go-redis/v9"
	"github.com/tinylib/msgp/msgp"
	"github.com/vmihailenco/msgpack/v5"
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
	keys, err := r.Keys()
	if err != nil {
		return err
	}
	return r.client.Del(context.Background(), keys...).Err()
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
	var buf []byte
	var err error
	// We use a fast path for hot structs.
	if msgpVal, ok := value.(msgp.Marshaler); ok {
		buf, err = msgpVal.MarshalMsg(nil)
	} else {
		// Slow path for other structs.
		buf, err = msgpack.Marshal(value)
	}
	if err != nil {
		return err
	}

	return r.client.Set(context.Background(), r.name+"_"+key, buf, ttl).Err()
}

// Get the content stored in the cache for the given key, and decode it into the value interface.
// Return ErrKeyNotFound if the key is missing from the cache
func (r *Redis) Get(key string, value any) error {
	val, err := r.client.Get(context.Background(), r.name+"_"+key).Result()
	if err != nil {
		return err
	}

	// We use a fast path for hot structs.
	if msgpVal, ok := value.(msgp.Unmarshaler); ok {
		_, err := msgpVal.UnmarshalMsg([]byte(val))
		return err
	}

	// This is ugly and makes the cache package aware of the model package.
	// But this is due to 2 things.
	// 1. The msgp package works on methods on structs rather than functions.
	// 2. Our cache interface passes pointers to empty pointers, and not pointers
	// to values. This is mainly how all our model structs are passed around.
	// It might be technically possible to use values _just_ for hot structs
	// like these and then return a pointer while returning from the cache function,
	// but it will make the codebase inconsistent, and has some edge-cases to take care of.
	switch v := value.(type) {
	case **model.User:
		var u model.User
		_, err := u.UnmarshalMsg([]byte(val))
		*v = &u
		return err
	case *map[string]*model.User:
		var u model.UserMap
		_, err := u.UnmarshalMsg([]byte(val))
		*v = u
		return err
	}

	// Slow path for other structs.
	return msgpack.Unmarshal([]byte(val), value)
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
