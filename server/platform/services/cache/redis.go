// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
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
	return r.Scan(r.RemoveMulti)
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

	var valueString string
	if intVal, ok := value.(int64); ok {
		valueString = strconv.Itoa(int(intVal))
	} else {
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
		valueString = rueidis.BinaryString(buf)
	}

	return r.client.Do(context.Background(),
		r.client.B().Set().
			Key(r.name+":"+key).
			Value(valueString).
			Ex(ttl).
			Build(),
	).Error()
}

// Increment increments the value of the key by the value.
func (r *Redis) Increment(key string, val int) error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Incr", elapsed)
		}
	}()

	return r.client.Do(context.Background(),
		r.client.B().Incrby().
			Key(r.name+":"+key).
			Increment(int64(val)).
			Build(),
	).Error()
}

// Decrement decrements the value of the key by the value.
func (r *Redis) Decrement(key string, val int) error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Decr", elapsed)
		}
	}()

	return r.client.Do(context.Background(),
		r.client.B().Decrby().
			Key(r.name+":"+key).
			Decrement(int64(val)).
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

	resp := r.client.DoCache(context.Background(),
		r.client.B().Get().
			Key(r.name+":"+key).
			Cache(),
		clientSideTTL,
	)

	var intVal int64
	var bytesVal []byte
	var err error
	vPtr, ok := value.(*int64)
	if ok {
		intVal, err = resp.AsInt64()
	} else {
		bytesVal, err = resp.AsBytes()
	}
	if err != nil {
		if rueidis.IsRedisNil(err) {
			return ErrKeyNotFound
		}
		return err
	}

	if ok {
		*vPtr = intVal
		return nil
	}

	// We use a fast path for hot structs.
	if msgpVal, ok := value.(msgp.Unmarshaler); ok {
		_, err := msgpVal.UnmarshalMsg(bytesVal)
		return err
	}

	// Slow path for other structs.
	return msgpack.Unmarshal(bytesVal, value)
}

// GetMulti uses the MGET primitive to fetch multiple keys in a single operation.
func (r *Redis) GetMulti(keys []string, values []any) []error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "GetMulti", elapsed)
		}
	}()

	errs := make([]error, len(keys))
	newKeys := sliceMapper(keys, func(elem string) string {
		return r.name + ":" + elem
	})
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

	for i, resp := range vals {
		if resp.IsNil() {
			errs[i] = ErrKeyNotFound
			continue
		}

		var intVal int64
		var bytesVal []byte
		var err error
		vPtr, ok := values[i].(*int64)
		if ok {
			intVal, err = resp.AsInt64()
		} else {
			bytesVal, err = resp.AsBytes()
		}
		if err != nil {
			errs[i] = err
			continue
		}

		if ok {
			*vPtr = intVal
			errs[i] = nil
			continue
		}

		// We use a fast path for hot structs.
		if msgpVal, ok := values[i].(msgp.Unmarshaler); ok {
			_, err := msgpVal.UnmarshalMsg(bytesVal)
			errs[i] = err
			continue
		}

		// Slow path for other structs.
		errs[i] = msgpack.Unmarshal(bytesVal, values[i])
	}

	return errs
}

// Remove deletes the value for a given key.
func (r *Redis) Remove(key string) error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Remove", elapsed)
		}
	}()

	return r.client.Do(context.Background(),
		r.client.B().Del().
			Key(r.name+":"+key).
			Build(),
	).Error()
}

func (r *Redis) RemoveMulti(keys []string) error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "RemoveMulti", elapsed)
		}
	}()

	if len(keys) == 0 {
		return nil
	}

	newKeys := sliceMapper(keys, func(elem string) string {
		return r.name + ":" + elem
	})

	return r.client.Do(context.Background(),
		r.client.B().Del().
			Key(newKeys...).
			Build(),
	).Error()
}

func (r *Redis) Scan(f func([]string) error) error {
	now := time.Now()
	defer func() {
		if r.metrics != nil {
			elapsed := time.Since(now).Seconds()
			r.metrics.ObserveRedisEndpointDuration(r.name, "Scan", elapsed)
		}
	}()

	var scan rueidis.ScanEntry
	var err error
	for more := true; more; more = scan.Cursor != 0 {
		scan, err = r.client.Do(context.Background(),
			r.client.B().Scan().
				Cursor(scan.Cursor).
				Match(r.name+":*").
				Count(100).
				Build()).AsScanEntry()
		if err != nil {
			return err
		}

		removed := sliceMapper(scan.Elements, func(elem string) string {
			return strings.TrimPrefix(elem, r.name+":")
		})
		err = f(removed)
		if err != nil {
			return err
		}
	}
	return nil
}

// GetInvalidateClusterEvent returns the cluster event configured when this cache was created.
func (r *Redis) GetInvalidateClusterEvent() model.ClusterEvent {
	return model.ClusterEventNone
}

func (r *Redis) Name() string {
	return r.name
}

func sliceMapper[S ~[]E, E, R any](slice S, mapper func(E) R) []R {
	newSlice := make([]R, len(slice))
	for i, v := range slice {
		newSlice[i] = mapper(v)
	}
	return newSlice
}
