// Copyright 2013 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
