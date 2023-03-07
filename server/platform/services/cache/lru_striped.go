// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"fmt"
	"math"
	"time"

	"github.com/cespare/xxhash/v2"

	"github.com/mattermost/mattermost-server/server/v7/model"
)

// LRUStriped keeps LRU caches in buckets in order to lower mutex contention.
// This is achieved by hashing the input key to map it to a dedicated bucket.
// Each bucket (an LRU cache) has its own lock that helps distributing the lock
// contention on multiple threads/cores, leading to less wait times.
//
// LRUStriped implements the Cache interface with the same behavior as LRU.
//
// Note that, because of it's distributed nature, the fixed size cannot be strictly respected
// and you may have a tiny bit more space for keys than you defined through LRUOptions.
// Bucket size is computed as follows: (size / nbuckets) + (size % nbuckets)
//
// Because of this size limit per bucket, and because of the nature of the data, you
// may have buckets filled unevenly, and because of this, keys will be evicted from the entire
// cache where a simple LRU wouldn't have. Example:
//
// Two buckets B1 and B2, of max size 2 each, meaning, theoretically, a max size of 4:
//   - Say you have a set of 3 keys, they could fill an entire LRU cache.
//   - But if all those keys are assigned to a single bucket B1, the first key will be evicted from B1
//   - B2 will remain empty, even though there was enough memory allocated
//
// With 4 buckets and random UUIDs as keys, the amount of false evictions is around 5%.
//
// By default, the number of buckets equals the number of cpus returned from runtime.NumCPU.
//
// This struct is lock-free and intended to be used without lock.
type LRUStriped struct {
	buckets                []*LRU
	name                   string
	invalidateClusterEvent model.ClusterEvent
}

func (L LRUStriped) hashkeyMapHash(key string) uint64 {
	return xxhash.Sum64String(key)
}

func (L LRUStriped) keyBucket(key string) *LRU {
	return L.buckets[L.hashkeyMapHash(key)%uint64(len(L.buckets))]
}

// Purge loops through each LRU cache for purging. Since LRUStriped doesn't use any lock,
// each LRU bucket is purged after another one, which means that keys could still
// be present after a call to Purge.
func (L LRUStriped) Purge() error {
	for _, lru := range L.buckets {
		lru.Purge() // errors from purging LRU can be ignored as they always return nil
	}
	return nil
}

// Set does the same as LRU.Set
func (L LRUStriped) Set(key string, value any) error {
	return L.keyBucket(key).Set(key, value)
}

// SetWithDefaultExpiry does the same as LRU.SetWithDefaultExpiry
func (L LRUStriped) SetWithDefaultExpiry(key string, value any) error {
	return L.keyBucket(key).SetWithDefaultExpiry(key, value)
}

// SetWithExpiry does the same as LRU.SetWithExpiry
func (L LRUStriped) SetWithExpiry(key string, value any, ttl time.Duration) error {
	return L.keyBucket(key).SetWithExpiry(key, value, ttl)
}

// Get does the same as LRU.Get
func (L LRUStriped) Get(key string, value any) error {
	return L.keyBucket(key).Get(key, value)
}

// Remove does the same as LRU.Remove
func (L LRUStriped) Remove(key string) error {
	return L.keyBucket(key).Remove(key)
}

// Keys does the same as LRU.Keys. However, because this is lock-free, keys might be
// inserted or removed from a previously scanned LRU cache.
// This is not as precise as using a single LRU instance.
func (L LRUStriped) Keys() ([]string, error) {
	var keys []string
	for _, lru := range L.buckets {
		k, _ := lru.Keys() // Keys never returns any error
		keys = append(keys, k...)
	}
	return keys, nil
}

// Len does the same as LRU.Len. As for LRUStriped.Keys, this call cannot be precise.
func (L LRUStriped) Len() (int, error) {
	var size int
	for _, lru := range L.buckets {
		s, _ := lru.Len() // Len never returns any error
		size += s
	}
	return size, nil
}

// GetInvalidateClusterEvent does the same as LRU.GetInvalidateClusterEvent
func (L LRUStriped) GetInvalidateClusterEvent() model.ClusterEvent {
	return L.invalidateClusterEvent
}

// Name does the same as LRU.Name
func (L LRUStriped) Name() string {
	return L.name
}

// NewLRUStriped creates a striped LRU cache using the special LRUOptions.StripedBuckets value.
// See LRUStriped and LRUOptions for more details.
//
// Not that in order to prevent false eviction, this LRU cache adds 10% (computation is rounded up) of the
// requested size to the total cache size.
func NewLRUStriped(opts LRUOptions) (Cache, error) {
	if opts.StripedBuckets == 0 {
		return nil, fmt.Errorf("number of buckets is mandatory")
	}

	if opts.Size < opts.StripedBuckets {
		return nil, fmt.Errorf("cache size must at least be equal to the number of buckets")
	}

	// add 10% to the total size, before splitting
	opts.Size += int(math.Ceil(float64(opts.Size) * 10.0 / 100.0))
	// now this is the size for each bucket
	opts.Size = (opts.Size / opts.StripedBuckets) + (opts.Size % opts.StripedBuckets)

	buckets := make([]*LRU, opts.StripedBuckets)
	for i := 0; i < opts.StripedBuckets; i++ {
		buckets[i] = NewLRU(opts).(*LRU)
	}

	return LRUStriped{
		buckets:                buckets,
		invalidateClusterEvent: opts.InvalidateClusterEvent,
		name:                   opts.Name,
	}, nil
}
