// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache_test

import (
	"fmt"
	"runtime"
	"sync"
	"testing"

	"github.com/cespare/xxhash/v2"

	"github.com/mattermost/mattermost-server/v6/platform/services/cache"
)

const (
	m = 500_000
)

func BenchmarkLRUStriped(b *testing.B) {
	opts := cache.LRUOptions{
		Name:                   "",
		Size:                   128,
		DefaultExpiry:          0,
		InvalidateClusterEvent: "",
		StripedBuckets:         runtime.NumCPU() - 1,
	}

	cache, err := cache.NewLRUStriped(opts)
	if err != nil {
		panic(err)
	}
	// prepare keys and initial cache values and set routine
	keys := make([]string, 0, m)
	// bucketKeys is to demonstrate that splitted locks is working correctly
	// by assigning one sequence of key for each bucket.
	bucketKeys := make([][]string, opts.StripedBuckets)
	for i := 0; i < m; i++ {
		key := fmt.Sprintf("%d-key-%d", i, i)
		keys = append(keys, key)
		bucketKey := xxhash.Sum64String(key) % uint64(opts.StripedBuckets)
		bucketKeys[bucketKey] = append(bucketKeys[bucketKey], key)
	}
	for i := 0; i < opts.Size; i++ {
		cache.Set(keys[i], "preflight")
	}

	wgGet := &sync.WaitGroup{}
	wgSet := &sync.WaitGroup{}
	// need buffered chan because if the set routine finished before we write into the chan,
	// we're left without any consumer, making any write to the chan waiting forever.
	stopSet := make(chan bool, 1)
	set := func() {
		defer wgSet.Done()
		for i := 0; i < m; i++ {
			select {
			case <-stopSet:
				return
			default:
				_ = cache.Set(keys[i], "ignored")
			}
		}
	}

	get := func(bucket int) {
		defer wgGet.Done()
		var out string
		for i := 0; i < m; i++ {
			_ = cache.Get(bucketKeys[bucket][i%opts.Size], &out)
		}
	}

	b.StopTimer()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		wgSet.Add(1)
		go set()
		for j := 0; j < opts.StripedBuckets; j++ {
			wgGet.Add(1)
			go get(j)
		}

		b.StartTimer()
		wgGet.Wait()
		b.StopTimer()

		stopSet <- true
		wgSet.Wait()
	}
}
