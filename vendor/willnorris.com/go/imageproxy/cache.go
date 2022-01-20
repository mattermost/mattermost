// Copyright 2013 The imageproxy authors.
// SPDX-License-Identifier: Apache-2.0

package imageproxy

// The Cache interface defines a cache for storing arbitrary data.  The
// interface is designed to align with httpcache.Cache.
type Cache interface {
	// Get retrieves the cached data for the provided key.
	Get(key string) (data []byte, ok bool)

	// Set caches the provided data.
	Set(key string, data []byte)

	// Delete deletes the cached data at the specified key.
	Delete(key string)
}

// NopCache provides a no-op cache implementation that doesn't actually cache anything.
var NopCache = new(nopCache)

type nopCache struct{}

func (c nopCache) Get(string) ([]byte, bool) { return nil, false }
func (c nopCache) Set(string, []byte)        {}
func (c nopCache) Delete(string)             {}
