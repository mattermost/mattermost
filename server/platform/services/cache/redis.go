// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces"

	"github.com/redis/rueidis"
	"github.com/tinylib/msgp/msgp"
	"github.com/vmihailenco/msgpack/v5"
)

const clientSideTTL = 5 * time.Minute

type Redis struct {
	name          string
	client        rueidis.Client
	defaultExpiry time.Duration
	metrics       einterfaces.MetricsInterface
}

func NewRedis(opts *CacheOptions, client rueidis.Client) (*Redis, error) {
	if opts.Name == "" {
		return nil, errors.New("no name specified for cache")
	}
	return &Redis{
		name:          opts.Name,
		defaultExpiry: opts.DefaultExpiry,
		client:        client,
	}, nil
}

func (r *Redis) Purge() error {
	// TODO: move to scan
	keys, err := r.Keys()
	if err != nil {
		return err
	}
	return r.client.Do(context.Background(),
		r.client.B().Del().
			Key(keys...).
			Build(),
	).Error()
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
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Set", elapsed)
		}
	}()
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

	return r.client.Do(context.Background(),
		r.client.B().Set().
			Key(r.name+":"+key).
			Value(rueidis.BinaryString(buf)).
			Ex(ttl).
			Build(),
	).Error()
}

// Get the content stored in the cache for the given key, and decode it into the value interface.
// Return ErrKeyNotFound if the key is missing from the cache
func (r *Redis) Get(key string, value any) error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Get", elapsed)
		}
	}()
	val, err := r.client.DoCache(context.Background(),
		r.client.B().Get().
			Key(r.name+":"+key).
			Cache(),
		clientSideTTL,
	).AsBytes()
	if err != nil {
		if rueidis.IsRedisNil(err) {
			return ErrKeyNotFound
		}
		return err
	}

	// We use a fast path for hot structs.
	if msgpVal, ok := value.(msgp.Unmarshaler); ok {
		_, err := msgpVal.UnmarshalMsg(val)
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
		_, err := u.UnmarshalMsg(val)
		*v = &u
		return err
	case *map[string]*model.User:
		var u model.UserMap
		_, err := u.UnmarshalMsg(val)
		*v = u
		return err
	}

	// Slow path for other structs.
	return msgpack.Unmarshal(val, value)
}

func (r *Redis) GetMulti(keys []string, values []any) []error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "GetMulti", elapsed)
		}
	}()

	errs := make([]error, len(keys))
	newKeys := make([]string, len(keys))
	for i := range keys {
		newKeys[i] = r.name + ":" + keys[i]
	}
	vals, err := r.client.DoCache(context.Background(),
		r.client.B().Mget().
			Key(newKeys...).
			Cache(),
		clientSideTTL,
	).ToArray()
	if err != nil {
		for i := range errs {
			errs[i] = err
		}
		return errs
	}

	if len(vals) != len(keys) {
		for i := range errs {
			errs[i] = fmt.Errorf("length of returned vals %d, does not match length of keys %d", len(vals), len(keys))
		}
		return errs
	}

	for i, val := range vals {
		if val.IsNil() {
			errs[i] = ErrKeyNotFound
			continue
		}

		buf, err := val.AsBytes()
		if err != nil {
			errs[i] = err
			continue
		}

		// We use a fast path for hot structs.
		if msgpVal, ok := values[i].(msgp.Unmarshaler); ok {
			_, err := msgpVal.UnmarshalMsg(buf)
			errs[i] = err
			continue
		}

		switch v := values[i].(type) {
		case **model.User:
			var u model.User
			_, err := u.UnmarshalMsg(buf)
			*v = &u
			errs[i] = err
			continue
		case *map[string]*model.User:
			var u model.UserMap
			_, err := u.UnmarshalMsg(buf)
			*v = u
			errs[i] = err
			continue
		}

		// Slow path for other structs.
		errs[i] = msgpack.Unmarshal(buf, values[i])
	}

	return errs
}

// Remove deletes the value for a given key.
func (r *Redis) Remove(key string) error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Del", elapsed)
		}
	}()

	return r.client.Do(context.Background(),
		r.client.B().Del().
			Key(r.name+":"+key).
			Build(),
	).Error()
}

// Keys returns a slice of the keys in the cache.
func (r *Redis) Keys() ([]string, error) {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Keys", elapsed)
		}
	}()

	// TODO: migrate to a function that works on a batch of keys.
	return r.client.Do(context.Background(),
		r.client.B().Keys().
			Pattern(r.name+":*").
			Build(),
	).AsStrSlice()
}

// Len returns the number of items in the cache.
func (r *Redis) Len() (int, error) {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Len", elapsed)
		}
	}()
	// TODO: migrate to scan
	keys, err := r.client.Do(context.Background(),
		r.client.B().Keys().
			Pattern(r.name+":*").
			Build(),
	).AsStrSlice()
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
