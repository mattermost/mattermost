// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// CacheOptions contains options for initializing a cache.
// TODO: Rename to Options.
type CacheOptions struct {
	Size                   int
	DefaultExpiry          time.Duration
	Name                   string
	InvalidateClusterEvent model.ClusterEvent
	Striped                bool
	StripedBuckets         int
}

// NewCache creates a new cache with given opts
// TODO: Rename to New.
func NewCache[T any](opts *CacheOptions) (Cache[T], error) {
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
